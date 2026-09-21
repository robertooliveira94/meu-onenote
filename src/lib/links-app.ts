import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import { gravarJson } from "./gravacao";
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
import { normalizarUrl } from "./url";

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

/** Links salvos antes de "ler depois"/"mais aberto"/capa existirem ganham os padrões (já lido, nunca aberto, sem capa) na primeira leitura. */
function normalizarArvore(raiz: PastaLink): PastaLink {
  for (const link of raiz.links) {
    if (link.lido === undefined) link.lido = true;
    if (link.aberturas === undefined) link.aberturas = 0;
    if (link.capa === undefined) link.capa = null;
  }
  for (const sub of raiz.pastas) normalizarArvore(sub);
  return raiz;
}

async function lerArvore(): Promise<PastaLink> {
  try {
    return normalizarArvore(JSON.parse(await fs.readFile(ARQUIVO_ARVORE, "utf8")) as PastaLink);
  } catch {
    return pastaRaizPadrao();
  }
}

async function gravarArvore(raiz: PastaLink): Promise<void> {
  await gravarJson(ARQUIVO_ARVORE, raiz);
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
const PASTA_CAPAS = path.join(RAIZ, PASTA_LINKS, "capas");

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

/** Mesma ideia do favicon, pra capa (`og:image`) — guardada em `_links/capas/`. */
async function salvarCapa(idLink: string, capa: FaviconBuscado): Promise<string | null> {
  if (!capa) return null;
  const extensao = EXTENSAO_POR_TIPO[capa.tipo];
  if (!extensao) return null;
  await fs.mkdir(PASTA_CAPAS, { recursive: true });
  const arquivo = `${idLink}.${extensao}`;
  await fs.writeFile(path.join(PASTA_CAPAS, arquivo), Buffer.from(capa.base64, "base64"));
  return arquivo;
}

export async function criarLink(
  idPasta: string,
  campos: CamposLink,
  favicon?: FaviconBuscado,
  capa?: FaviconBuscado,
): Promise<PastaLink> {
  const url = normalizarUrl(campos.url);
  if (!url) throw new Error("Informe uma URL.");
  const titulo = campos.titulo.trim().slice(0, 200) || url;
  const id = gerarId();
  const [nomeFavicon, nomeCapa] = await Promise.all([salvarFavicon(id, favicon), salvarCapa(id, capa)]);
  return alterar((raiz) => {
    const agora = new Date().toISOString();
    exigirPasta(raiz, idPasta).links.push({
      id,
      titulo,
      url,
      favicon: nomeFavicon,
      capa: nomeCapa,
      nota: campos.nota.trim().slice(0, 2000),
      favorito: campos.favorito,
      lido: false,
      aberturas: 0,
      criadoEm: agora,
      atualizadoEm: agora,
    });
    return raiz;
  });
}

/** Abrir o link conta como "lido" — marca na hora, incrementa o contador de aberturas (usado por "mais aberto"). */
export async function marcarComoAberto(id: string): Promise<PastaLink> {
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    achado.link.lido = true;
    achado.link.aberturas += 1;
    return raiz;
  });
}

export async function marcarComoLido(id: string, lido: boolean): Promise<PastaLink> {
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    achado.link.lido = lido;
    return raiz;
  });
}

/** Reordena manualmente os links de uma pasta — a ordem em que ficam salvos no array é a ordem "Manual". */
export async function reordenarLinks(idPasta: string, ordemIds: string[]): Promise<PastaLink> {
  return alterar((raiz) => {
    const pasta = exigirPasta(raiz, idPasta);
    const porId = new Map(pasta.links.map((link) => [link.id, link]));
    const reordenados = ordemIds.map((id) => porId.get(id)).filter((link): link is Link => !!link);
    // Qualquer link que não veio na lista (edge case de concorrência) some do meio — junta no fim, sem perder.
    for (const link of pasta.links) if (!ordemIds.includes(link.id)) reordenados.push(link);
    pasta.links = reordenados;
    return raiz;
  });
}

/** Outro link com a mesma URL (em qualquer pasta) — para o aviso "já está em X" ao criar/editar. */
export async function acharDuplicado(url: string, exceto?: string): Promise<{ id: string; titulo: string; pastaNome: string } | null> {
  const raiz = await lerArvore();
  const alvo = normalizarUrl(url).toLowerCase();
  if (!alvo) return null;
  function buscar(pasta: PastaLink): { id: string; titulo: string; pastaNome: string } | null {
    for (const link of pasta.links) {
      if (link.id !== exceto && link.url.trim().toLowerCase() === alvo) {
        return { id: link.id, titulo: link.titulo, pastaNome: pasta.nome };
      }
    }
    for (const sub of pasta.pastas) {
      const achado = buscar(sub);
      if (achado) return achado;
    }
    return null;
  }
  return buscar(raiz);
}

export async function atualizarLink(
  id: string,
  campos: CamposLink,
  favicon?: FaviconBuscado,
  capa?: FaviconBuscado,
): Promise<PastaLink> {
  const [nomeFavicon, nomeCapa] = await Promise.all([
    favicon !== undefined ? salvarFavicon(id, favicon) : Promise.resolve(undefined),
    capa !== undefined ? salvarCapa(id, capa) : Promise.resolve(undefined),
  ]);
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    const url = normalizarUrl(campos.url);
    if (!url) throw new Error("Informe uma URL.");
    achado.link.titulo = campos.titulo.trim().slice(0, 200) || url;
    achado.link.url = url;
    achado.link.nota = campos.nota.trim().slice(0, 2000);
    achado.link.favorito = campos.favorito;
    if (nomeFavicon !== undefined) achado.link.favicon = nomeFavicon;
    if (nomeCapa !== undefined) achado.link.capa = nomeCapa;
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
): Promise<{ titulo: string | null; descricao: string | null; favicon: FaviconBuscado; capa: FaviconBuscado }> {
  let base: URL;
  try {
    base = new URL(normalizarUrl(url));
  } catch {
    return { titulo: null, descricao: null, favicon: null, capa: null };
  }

  let titulo: string | null = null;
  let descricao: string | null = null;
  let hrefFavicon: string | null = null;
  let hrefCapa: string | null = null;
  try {
    const resposta = await fetch(base, { signal: AbortSignal.timeout(5000), redirect: "follow" });
    if (resposta.ok) {
      const html = await resposta.text();
      const tituloOg = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1];
      const tituloAchado = tituloOg ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
      if (tituloAchado) titulo = decodificarEntidadesHtml(tituloAchado.trim()).slice(0, 200) || null;
      const descricaoAchada =
        html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1] ??
        html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1];
      if (descricaoAchada) descricao = decodificarEntidadesHtml(descricaoAchada.trim()).slice(0, 500) || null;
      const linkAchado = html.match(/<link[^>]+rel=["'](?:shortcut icon|icon|apple-touch-icon)["'][^>]*>/i)?.[0];
      const hrefAchado = linkAchado?.match(/href=["']([^"']+)["']/i)?.[1];
      if (hrefAchado) hrefFavicon = hrefAchado;
      const capaAchada = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["'][^>]*>/i)?.[1];
      if (capaAchada) hrefCapa = decodificarEntidadesHtml(capaAchada.trim());
    }
  } catch {
    // Site fora do ar, timeout, CORS do lado deles não importa aqui (é o
    // servidor buscando, não o navegador) — sem título, cai pro manual.
  }

  async function baixarImagem(href: string | null, padrao: string | null, tamanhoMaximo: number): Promise<FaviconBuscado> {
    if (!href && !padrao) return null;
    try {
      const urlImagem = new URL(href ?? padrao!, base);
      const resposta = await fetch(urlImagem, { signal: AbortSignal.timeout(4000) });
      if (!resposta.ok) return null;
      const bytes = Buffer.from(await resposta.arrayBuffer());
      if (bytes.length === 0 || bytes.length > tamanhoMaximo) return null;
      const tipo = resposta.headers.get("content-type")?.split(";")[0].trim() || "image/x-icon";
      return EXTENSAO_POR_TIPO[tipo] ? { base64: bytes.toString("base64"), tipo } : null;
    } catch {
      return null;
    }
  }

  const [favicon, capa] = await Promise.all([
    baixarImagem(hrefFavicon, "/favicon.ico", 256 * 1024),
    // Sem padrão pra capa: só usa se o site tiver `og:image` de verdade — inventar um "favicon.ico" como capa ficaria estranho.
    hrefCapa ? baixarImagem(hrefCapa, null, 512 * 1024) : Promise.resolve(null),
  ]);

  return { titulo, descricao, favicon, capa };
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

/** Roda `tarefas` com no máximo `limite` ao mesmo tempo — pra não abrir dezenas de conexões de uma vez ao verificar um monte de link. */
async function comConcorrenciaLimitada<T>(itens: T[], limite: number, tarefa: (item: T) => Promise<void>): Promise<void> {
  const fila = [...itens];
  async function trabalhador() {
    let proximo: T | undefined;
    while ((proximo = fila.shift()) !== undefined) await tarefa(proximo);
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador));
}

/**
 * "Verificar links quebrados": um `HEAD` (com `GET` de plano B, pra sites
 * que não respondem `HEAD`) em cada URL, cinco de cada vez. Não altera nada
 * salvo — o resultado é só pra mostrar na hora, cada verificação é nova.
 */
export async function verificarLinks(ids: string[]): Promise<Record<string, boolean>> {
  const raiz = await lerArvore();
  const todos = achatar(raiz);
  const resultado: Record<string, boolean> = {};
  const alvos = todos.filter((link) => ids.includes(link.id));
  await comConcorrenciaLimitada(alvos, 5, async (link) => {
    resultado[link.id] = await estaNoAr(link.url);
  });
  return resultado;
}

async function estaNoAr(url: string): Promise<boolean> {
  for (const metodo of ["HEAD", "GET"] as const) {
    try {
      const resposta = await fetch(url, { method: metodo, signal: AbortSignal.timeout(6000), redirect: "follow" });
      if (resposta.ok) return true;
      // 405/501 = o servidor não gosta de HEAD (comum), não que o link esteja quebrado — tenta GET antes de desistir.
      if (metodo === "HEAD" && resposta.status !== 405 && resposta.status !== 501) return false;
    } catch {
      if (metodo === "GET") return false;
    }
  }
  return false;
}

/**
 * Exporta a árvore inteira no formato Netscape Bookmark (o que todo
 * navegador entende pra importar) — fecha o ciclo do "Importar favoritos".
 */
export async function exportarFavoritosHtml(): Promise<string> {
  const raiz = await lerArvore();
  function escapar(texto: string): string {
    return texto.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function percorrer(pasta: PastaLink, profundidade: number): string {
    const recuo = "    ".repeat(profundidade);
    const linhas: string[] = [];
    for (const link of pasta.links) {
      const data = Math.floor(new Date(link.criadoEm).getTime() / 1000);
      linhas.push(`${recuo}<DT><A HREF="${escapar(link.url)}" ADD_DATE="${data}">${escapar(link.titulo)}</A>`);
    }
    for (const sub of pasta.pastas) {
      const data = Math.floor(Date.now() / 1000);
      linhas.push(`${recuo}<DT><H3 ADD_DATE="${data}">${escapar(sub.nome)}</H3>`);
      linhas.push(`${recuo}<DL><p>`);
      linhas.push(percorrer(sub, profundidade + 1));
      linhas.push(`${recuo}</DL><p>`);
    }
    return linhas.join("\n");
  }
  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Bookmarks</TITLE>",
    "<H1>Bookmarks</H1>",
    "<DL><p>",
    percorrer(raiz, 1),
    "</DL><p>",
  ].join("\n");
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
        capa: null,
        nota: "",
        favorito: false,
        lido: true,
        aberturas: 0,
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
