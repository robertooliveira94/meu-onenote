import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import { CORES_CADERNO, ICONES_CADERNO } from "./cores";
import type { NoImportado } from "./importar-favoritos";
import {
  apagarDeVezLixeiraLinks,
  enviarLinkParaLixeira,
  enviarPastaParaLixeira,
  esvaziarLixeiraLinks,
  listarLixeiraLinks,
  popItemLixeiraLinks,
} from "./lixeira-links";
import type { ItemLixeiraLinks, Link, PastaLink } from "./tipos";

/**
 * A app de Links: uma árvore de pastas/subpastas com links dentro, guardada
 * inteira num JSON só — diferente de notas/tarefas (arquivo real por item) e
 * do cofre (`.kdbx` cifrado). Um link não tem corpo de texto que justifique
 * ser arquivo próprio, e uma árvore recursiva de profundidade livre (como o
 * `GrupoSenhas` do cofre) resolve pastas aninhadas sem inventar nada novo.
 * É uma exceção deliberada ao "disco é a verdade": os links não são
 * legíveis como arquivos soltos fora daqui (os favicons, esses sim, são
 * arquivos reais em `_links/favicons/`).
 *
 * Sem sessão nem gravação adiada como o cofre: lá o save reconstrói o KDF
 * do Argon2id (caro, visível a cada clique); aqui é só `JSON.stringify` +
 * `fs.writeFile`, então uma fila simples (mesmo padrão de `etiquetas.ts` e
 * `lixeira.ts`) já garante que duas gravações concorrentes não se pisem.
 */
const PASTA_LINKS = "_links";
const ARQUIVO_ARVORE = path.join(RAIZ, PASTA_LINKS, "arvore.json");

/** Id fixo da pasta raiz — sempre existe, nunca é excluída. */
export const ID_PASTA_RAIZ = "raiz";

function gerarId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function pastaRaizPadrao(): PastaLink {
  return {
    id: ID_PASTA_RAIZ,
    nome: "Geral",
    cor: CORES_CADERNO[0],
    icone: ICONES_CADERNO[0],
    pastas: [],
    links: [],
  };
}

async function lerArvore(): Promise<PastaLink> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_ARVORE, "utf8")) as PastaLink;
  } catch {
    return pastaRaizPadrao();
  }
}

async function gravarArvore(raiz: PastaLink): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_ARVORE), { recursive: true });
  await fs.writeFile(ARQUIVO_ARVORE, JSON.stringify(raiz, null, 2), "utf8");
}

let fila: Promise<unknown> = Promise.resolve();

async function alterar<T>(mudanca: (raiz: PastaLink) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const raiz = await lerArvore();
    const resultado = await mudanca(raiz);
    await gravarArvore(raiz);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function obterArvore(): Promise<PastaLink> {
  return lerArvore();
}

function encontrarPasta(raiz: PastaLink, id: string): PastaLink | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.pastas) {
    const achada = encontrarPasta(sub, id);
    if (achada) return achada;
  }
  return null;
}

/** Acha um link e a pasta que o contém — não dá pra mover/editar sem saber onde ele está. */
function encontrarLinkComPai(raiz: PastaLink, id: string): { link: Link; pasta: PastaLink } | null {
  for (const link of raiz.links) {
    if (link.id === id) return { link, pasta: raiz };
  }
  for (const sub of raiz.pastas) {
    const achado = encontrarLinkComPai(sub, id);
    if (achado) return achado;
  }
  return null;
}

/** Acha a pasta-mãe de uma subpasta (para excluir/mover, que mexem no array do pai). */
function encontrarPastaMae(raiz: PastaLink, idFilha: string): PastaLink | null {
  for (const sub of raiz.pastas) {
    if (sub.id === idFilha) return raiz;
    const achada = encontrarPastaMae(sub, idFilha);
    if (achada) return achada;
  }
  return null;
}

function exigirPasta(raiz: PastaLink, id: string): PastaLink {
  const pasta = encontrarPasta(raiz, id);
  if (!pasta) throw new Error("Pasta não encontrada.");
  return pasta;
}

/** Cor e ícone de uma pasta nova ciclam pela paleta conforme a posição entre as irmãs — mesma regra de cadernos/quadros. */
export async function criarPasta(idPai: string, nome: string): Promise<PastaLink> {
  return alterar((raiz) => {
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para a pasta.");
    const pai = exigirPasta(raiz, idPai);
    const posicao = pai.pastas.length;
    pai.pastas.push({
      id: gerarId(),
      nome: limpo,
      cor: CORES_CADERNO[posicao % CORES_CADERNO.length],
      icone: ICONES_CADERNO[posicao % ICONES_CADERNO.length],
      pastas: [],
      links: [],
    });
    return raiz;
  });
}

export async function renomearPasta(id: string, nome: string): Promise<PastaLink> {
  return alterar((raiz) => {
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para a pasta.");
    exigirPasta(raiz, id).nome = limpo;
    return raiz;
  });
}

export async function recolorirPasta(id: string, cor: string): Promise<PastaLink> {
  return alterar((raiz) => {
    exigirPasta(raiz, id).cor = cor;
    return raiz;
  });
}

export async function reiconizarPasta(id: string, icone: string): Promise<PastaLink> {
  return alterar((raiz) => {
    exigirPasta(raiz, id).icone = icone;
    return raiz;
  });
}

/** Verdadeiro se `possivelAncestral` é a própria pasta ou alguma pasta acima dela. */
function contemPasta(raiz: PastaLink, id: string): boolean {
  return encontrarPasta(raiz, id) !== null;
}

export async function moverPasta(id: string, idNovoPai: string): Promise<PastaLink> {
  return alterar((raiz) => {
    if (id === ID_PASTA_RAIZ) throw new Error("A pasta raiz não pode ser movida.");
    const pasta = exigirPasta(raiz, id);
    const novoPai = exigirPasta(raiz, idNovoPai);
    if (id === idNovoPai) throw new Error("Uma pasta não pode ir para dentro dela mesma.");
    // Não deixa uma pasta cair dentro de uma das suas próprias subpastas —
    // isso desconectaria o resto da árvore do lado de fora.
    if (contemPasta(pasta, idNovoPai)) throw new Error("Não dá para mover uma pasta para dentro dela mesma.");
    const mae = encontrarPastaMae(raiz, id);
    if (!mae) throw new Error("Pasta não encontrada.");
    mae.pastas = mae.pastas.filter((item) => item.id !== id);
    novoPai.pastas.push(pasta);
    return raiz;
  });
}

/** Manda a pasta (com todo o conteúdo dentro) para a lixeira. */
export async function excluirPasta(id: string): Promise<PastaLink> {
  return alterar(async (raiz) => {
    if (id === ID_PASTA_RAIZ) throw new Error("A pasta raiz não pode ser excluída.");
    const pasta = exigirPasta(raiz, id);
    const mae = encontrarPastaMae(raiz, id);
    if (!mae) throw new Error("Pasta não encontrada.");
    mae.pastas = mae.pastas.filter((item) => item.id !== id);
    await enviarPastaParaLixeira(pasta, mae.id);
    return raiz;
  });
}

type CamposLink = { titulo: string; url: string; nota: string; favorito: boolean };

/** Um favicon buscado na hora (ver `buscarMetadadosUrl`) — só bytes + tipo, ainda sem virar arquivo. */
type FaviconBuscado = { base64: string; tipo: string } | null | undefined;

const PASTA_FAVICONS = path.join(RAIZ, PASTA_LINKS, "favicons");

const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
};

/** Grava o favicon em disco e devolve o nome do arquivo (guardado em `Link.favicon`). */
async function salvarFavicon(idLink: string, favicon: FaviconBuscado): Promise<string | null> {
  if (!favicon) return null;
  const extensao = EXTENSAO_POR_TIPO[favicon.tipo];
  if (!extensao) return null;
  await fs.mkdir(PASTA_FAVICONS, { recursive: true });
  const arquivo = `${idLink}.${extensao}`;
  await fs.writeFile(path.join(PASTA_FAVICONS, arquivo), Buffer.from(favicon.base64, "base64"));
  return arquivo;
}

export async function criarLink(idPasta: string, campos: CamposLink, favicon?: FaviconBuscado): Promise<PastaLink> {
  const titulo = campos.titulo.trim().slice(0, 200) || campos.url.trim();
  const url = campos.url.trim();
  if (!url) throw new Error("Informe uma URL.");
  const id = gerarId();
  const nomeFavicon = await salvarFavicon(id, favicon);
  return alterar((raiz) => {
    const agora = new Date().toISOString();
    exigirPasta(raiz, idPasta).links.push({
      id,
      titulo,
      url,
      favicon: nomeFavicon,
      nota: campos.nota.trim().slice(0, 2000),
      favorito: campos.favorito,
      criadoEm: agora,
      atualizadoEm: agora,
    });
    return raiz;
  });
}

export async function atualizarLink(id: string, campos: CamposLink, favicon?: FaviconBuscado): Promise<PastaLink> {
  const nomeFavicon = favicon !== undefined ? await salvarFavicon(id, favicon) : undefined;
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    const url = campos.url.trim();
    if (!url) throw new Error("Informe uma URL.");
    achado.link.titulo = campos.titulo.trim().slice(0, 200) || url;
    achado.link.url = url;
    achado.link.nota = campos.nota.trim().slice(0, 2000);
    achado.link.favorito = campos.favorito;
    if (nomeFavicon !== undefined) achado.link.favicon = nomeFavicon;
    achado.link.atualizadoEm = new Date().toISOString();
    return raiz;
  });
}

export async function favoritarLink(id: string, favorito: boolean): Promise<PastaLink> {
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    achado.link.favorito = favorito;
    return raiz;
  });
}

export async function moverLink(id: string, idNovaPasta: string): Promise<PastaLink> {
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    const novaPasta = exigirPasta(raiz, idNovaPasta);
    achado.pasta.links = achado.pasta.links.filter((item) => item.id !== id);
    novaPasta.links.push(achado.link);
    return raiz;
  });
}

/** Manda o link para a lixeira. */
export async function excluirLink(id: string): Promise<PastaLink> {
  return alterar(async (raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    achado.pasta.links = achado.pasta.links.filter((item) => item.id !== id);
    await enviarLinkParaLixeira(achado.link, achado.pasta.id);
    return raiz;
  });
}

export async function restaurarDaLixeira(id: string): Promise<PastaLink> {
  return alterar(async (raiz) => {
    const item = await popItemLixeiraLinks(id);
    if (!item) throw new Error("Item não encontrado na lixeira.");
    const paiAlvo = encontrarPasta(raiz, item.idPaiOriginal) ?? raiz;
    if (item.tipo === "link") paiAlvo.links.push(item.dados as Link);
    else paiAlvo.pastas.push(item.dados as PastaLink);
    return raiz;
  });
}

export { apagarDeVezLixeiraLinks, esvaziarLixeiraLinks, listarLixeiraLinks };
export type { ItemLixeiraLinks };

const ENTIDADES_HTML: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

/** Só as entidades mais comuns em `<title>` — sem puxar uma lib de HTML inteira pra isso. */
function decodificarEntidadesHtml(texto: string): string {
  return texto.replace(/&(#?\w+);/g, (bruto, nome: string) => ENTIDADES_HTML[nome.toLowerCase()] ?? bruto);
}

/**
 * Busca o `<title>` e um favicon da própria página — nada de serviço de
 * terceiros (o app é local/sem-nuvem por princípio, ver PRODUCT.md), então o
 * favicon é buscado direto do site de origem e salvo aqui dentro.
 * Falha em qualquer etapa (site fora do ar, sem favicon, resposta grande
 * demais) devolve campos nulos — quem chama cai pro título manual/ícone
 * genérico, nunca trava a tela de criar link.
 */
export async function buscarMetadadosUrl(
  url: string,
): Promise<{ titulo: string | null; favicon: FaviconBuscado }> {
  let base: URL;
  try {
    base = new URL(url);
  } catch {
    return { titulo: null, favicon: null };
  }

  let titulo: string | null = null;
  let hrefFavicon: string | null = null;
  try {
    const resposta = await fetch(base, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (resposta.ok) {
      const html = await resposta.text();
      const tituloAchado = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
      if (tituloAchado) titulo = decodificarEntidadesHtml(tituloAchado.trim()).slice(0, 200) || null;
      const linkAchado = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*>/i)?.[0];
      const hrefAchado = linkAchado?.match(/href=["']([^"']+)["']/i)?.[1];
      if (hrefAchado) hrefFavicon = hrefAchado;
    }
  } catch {
    // Site fora do ar, timeout, CORS do lado deles não importa aqui (é o
    // servidor buscando, não o navegador) — sem título, cai pro manual.
  }

  let favicon: FaviconBuscado = null;
  try {
    const urlFavicon = new URL(hrefFavicon ?? "/favicon.ico", base);
    const resposta = await fetch(urlFavicon, { signal: AbortSignal.timeout(4000) });
    if (resposta.ok) {
      const bytes = Buffer.from(await resposta.arrayBuffer());
      const TAMANHO_MAXIMO = 256 * 1024;
      if (bytes.length > 0 && bytes.length <= TAMANHO_MAXIMO) {
        const tipo = resposta.headers.get("content-type")?.split(";")[0].trim() || "image/x-icon";
        if (EXTENSAO_POR_TIPO[tipo]) favicon = { base64: bytes.toString("base64"), tipo };
      }
    }
  } catch {
    // Sem favicon: ícone genérico na interface, sem drama.
  }

  return { titulo, favicon };
}

type LinkComPasta = Link & { pastaId: string };

function achatar(raiz: PastaLink): LinkComPasta[] {
  const todos: LinkComPasta[] = raiz.links.map((link) => ({ ...link, pastaId: raiz.id }));
  for (const sub of raiz.pastas) todos.push(...achatar(sub));
  return todos;
}

export async function linksFavoritos(): Promise<LinkComPasta[]> {
  const raiz = await lerArvore();
  return achatar(raiz)
    .filter((link) => link.favorito)
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

export async function linksRecentes(limite: number): Promise<LinkComPasta[]> {
  const raiz = await lerArvore();
  return achatar(raiz)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
    .slice(0, limite);
}

export async function buscarLinks(termo: string): Promise<LinkComPasta[]> {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return [];
  const raiz = await lerArvore();
  return achatar(raiz)
    .filter((link) => link.titulo.toLowerCase().includes(alvo) || link.url.toLowerCase().includes(alvo))
    .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

/**
 * Mescla os nós importados dentro de `pastaDestino`: uma pasta com o mesmo
 * nome de uma já existente (só entre irmãs diretas) recebe o conteúdo
 * dentro dela em vez de duplicar; links sempre entram — sem checar
 * duplicidade, favoritos de navegador raramente repetem por acaso.
 */
function mesclarImportados(pastaDestino: PastaLink, nos: NoImportado[]): void {
  const agora = new Date().toISOString();
  for (const no of nos) {
    if (no.tipo === "link") {
      pastaDestino.links.push({
        id: gerarId(),
        titulo: no.titulo,
        url: no.url,
        favicon: null,
        nota: "",
        favorito: false,
        criadoEm: agora,
        atualizadoEm: agora,
      });
      continue;
    }
    let alvo = pastaDestino.pastas.find((pasta) => pasta.nome === no.nome);
    if (!alvo) {
      const posicao = pastaDestino.pastas.length;
      alvo = {
        id: gerarId(),
        nome: no.nome,
        cor: CORES_CADERNO[posicao % CORES_CADERNO.length],
        icone: ICONES_CADERNO[posicao % ICONES_CADERNO.length],
        pastas: [],
        links: [],
      };
      pastaDestino.pastas.push(alvo);
    }
    mesclarImportados(alvo, no.filhos);
  }
}

export async function importarArvore(nos: NoImportado[], idPastaDestino: string): Promise<PastaLink> {
  return alterar((raiz) => {
    mesclarImportados(exigirPasta(raiz, idPastaDestino), nos);
    return raiz;
  });
}
