import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import type { ItemLixeiraLinks, Link, PastaLink } from "./tipos";

/**
 * Lixeira própria da app de Links — a `lixeira.ts` das Anotações mexe em
 * arquivos de verdade (`fs.rename`/`fs.rm`), o que não serve para uma árvore
 * guardada num JSON só. Aqui o "item excluído" é um nó (pasta ou link)
 * tirado da árvore viva (por `links-app.ts`) e guardado neste registro até
 * ser restaurado ou apagado de vez.
 */
const PASTA_LINKS = "_links";
const ARQUIVO_LIXEIRA = path.join(RAIZ, PASTA_LINKS, "lixeira.json");

type RegistroLixeiraLink = ItemLixeiraLinks & {
  /** Pasta que continha o item no momento da exclusão — para restaurar de volta lá. */
  idPaiOriginal: string;
  dados: Link | PastaLink;
};

let fila: Promise<unknown> = Promise.resolve();

async function lerRegistro(): Promise<RegistroLixeiraLink[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_LIXEIRA, "utf8")) as RegistroLixeiraLink[];
  } catch {
    return [];
  }
}

async function gravarRegistro(itens: RegistroLixeiraLink[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_LIXEIRA), { recursive: true });
  await fs.writeFile(ARQUIVO_LIXEIRA, JSON.stringify(itens, null, 2), "utf8");
}

async function alterar<T>(mudanca: (itens: RegistroLixeiraLink[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const itens = await lerRegistro();
    const resultado = await mudanca(itens);
    await gravarRegistro(itens);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

function gerarId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listarLixeiraLinks(): Promise<ItemLixeiraLinks[]> {
  const itens = await lerRegistro();
  return itens
    .map(({ id, nome, tipo, excluidoEm }) => ({ id, nome, tipo, excluidoEm }))
    .sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm));
}

export async function enviarLinkParaLixeira(link: Link, idPaiOriginal: string): Promise<void> {
  await alterar((itens) => {
    itens.push({
      id: gerarId(),
      nome: link.titulo,
      tipo: "link",
      excluidoEm: new Date().toISOString(),
      idPaiOriginal,
      dados: link,
    });
  });
}

export async function enviarPastaParaLixeira(pasta: PastaLink, idPaiOriginal: string): Promise<void> {
  await alterar((itens) => {
    itens.push({
      id: gerarId(),
      nome: pasta.nome,
      tipo: "pasta-link",
      excluidoEm: new Date().toISOString(),
      idPaiOriginal,
      dados: pasta,
    });
  });
}

/**
 * Tira o item do registro e devolve o que precisa para recolocá-lo na
 * árvore viva — a reinserção em si é responsabilidade de `links-app.ts`
 * (só ele mexe na árvore), este módulo não a conhece.
 */
export async function popItemLixeiraLinks(
  id: string,
): Promise<{ tipo: "link" | "pasta-link"; dados: Link | PastaLink; idPaiOriginal: string } | null> {
  return alterar((itens) => {
    const posicao = itens.findIndex((item) => item.id === id);
    if (posicao < 0) return null;
    const [item] = itens.splice(posicao, 1);
    return { tipo: item.tipo, dados: item.dados, idPaiOriginal: item.idPaiOriginal };
  });
}

export async function apagarDeVezLixeiraLinks(id: string): Promise<void> {
  await alterar((itens) => {
    const posicao = itens.findIndex((item) => item.id === id);
    if (posicao >= 0) itens.splice(posicao, 1);
  });
}

export async function esvaziarLixeiraLinks(): Promise<void> {
  await alterar((itens) => {
    itens.length = 0;
  });
}
