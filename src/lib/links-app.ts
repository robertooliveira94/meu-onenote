import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import { CORES_CADERNO, ICONES_CADERNO } from "./cores";
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

export async function criarLink(idPasta: string, campos: CamposLink): Promise<PastaLink> {
  return alterar((raiz) => {
    const titulo = campos.titulo.trim().slice(0, 200) || campos.url.trim();
    const url = campos.url.trim();
    if (!url) throw new Error("Informe uma URL.");
    const agora = new Date().toISOString();
    exigirPasta(raiz, idPasta).links.push({
      id: gerarId(),
      titulo,
      url,
      favicon: null,
      nota: campos.nota.trim().slice(0, 2000),
      favorito: campos.favorito,
      criadoEm: agora,
      atualizadoEm: agora,
    });
    return raiz;
  });
}

export async function atualizarLink(id: string, campos: CamposLink): Promise<PastaLink> {
  return alterar((raiz) => {
    const achado = encontrarLinkComPai(raiz, id);
    if (!achado) throw new Error("Link não encontrado.");
    const url = campos.url.trim();
    if (!url) throw new Error("Informe uma URL.");
    achado.link.titulo = campos.titulo.trim().slice(0, 200) || url;
    achado.link.url = url;
    achado.link.nota = campos.nota.trim().slice(0, 2000);
    achado.link.favorito = campos.favorito;
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
