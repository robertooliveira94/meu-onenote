"use server";

import { revalidatePath } from "next/cache";

import { gravarConfig } from "@/lib/config";
import { analisarBookmarksHtml } from "@/lib/importar-favoritos";
import * as linksApp from "@/lib/links-app";
import type { ItemLixeiraLinks, PastaLink } from "@/lib/tipos";

type Resposta = { ok: true } | { ok: false; erro: string };

/**
 * Ações da app de Links. Ao contrário das Anotações (onde uma mudança pode
 * afetar a coluna de seções em outra tela), a árvore de Links só aparece
 * dentro de `/links` — revalidar essa rota basta.
 */

export type RespostaLinks = { ok: true; arvore: PastaLink } | { ok: false; erro: string };

function comTratamento(func: () => Promise<PastaLink>): Promise<RespostaLinks> {
  return func()
    .then((arvore) => {
      revalidatePath("/links", "layout");
      return { ok: true as const, arvore };
    })
    .catch((erro: unknown) => ({ ok: false as const, erro: erro instanceof Error ? erro.message : "Não deu certo." }));
}

export async function acaoObterArvoreLinks(): Promise<PastaLink> {
  return linksApp.obterArvore();
}

export async function acaoCriarPastaLink(idPai: string, nome: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.criarPasta(idPai, nome));
}

export async function acaoRenomearPastaLink(id: string, nome: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.renomearPasta(id, nome));
}

export async function acaoRecolorirPastaLink(id: string, cor: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.recolorirPasta(id, cor));
}

export async function acaoReiconizarPastaLink(id: string, icone: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.reiconizarPasta(id, icone));
}

export async function acaoMoverPastaLink(id: string, idNovoPai: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.moverPasta(id, idNovoPai));
}

export async function acaoExcluirPastaLink(id: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.excluirPasta(id));
}

type CamposLink = { titulo: string; url: string; nota: string; favorito: boolean };
type FaviconBuscado = { base64: string; tipo: string } | null;

export async function acaoCriarLink(
  idPasta: string,
  campos: CamposLink,
  favicon?: FaviconBuscado,
): Promise<RespostaLinks> {
  if (!campos.url.trim()) return { ok: false, erro: "Informe uma URL." };
  return comTratamento(() => linksApp.criarLink(idPasta, campos, favicon));
}

export async function acaoAtualizarLink(
  id: string,
  campos: CamposLink,
  favicon?: FaviconBuscado,
): Promise<RespostaLinks> {
  if (!campos.url.trim()) return { ok: false, erro: "Informe uma URL." };
  return comTratamento(() => linksApp.atualizarLink(id, campos, favicon));
}

/** Busca título e favicon do próprio site — usado ao colar uma URL no diálogo de link. */
export async function acaoBuscarMetadadosUrl(url: string) {
  return linksApp.buscarMetadadosUrl(url);
}

export async function acaoMoverLink(id: string, idNovaPasta: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.moverLink(id, idNovaPasta));
}

export async function acaoFavoritarLink(id: string, favorito: boolean): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.favoritarLink(id, favorito));
}

export async function acaoExcluirLink(id: string): Promise<RespostaLinks> {
  return comTratamento(() => linksApp.excluirLink(id));
}

export async function acaoLinksFavoritos() {
  return linksApp.linksFavoritos();
}

export async function acaoLinksRecentes(limite: number) {
  return linksApp.linksRecentes(limite);
}

export async function acaoBuscarLinks(termo: string) {
  return linksApp.buscarLinks(termo);
}

export async function acaoListarLixeiraLinks(): Promise<ItemLixeiraLinks[]> {
  return linksApp.listarLixeiraLinks();
}

export async function acaoRestaurarDaLixeiraLinks(id: string): Promise<Resposta> {
  try {
    await linksApp.restaurarDaLixeira(id);
    revalidatePath("/links", "layout");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." };
  }
}

export async function acaoApagarDeVezDaLixeiraLinks(id: string): Promise<Resposta> {
  await linksApp.apagarDeVezLixeiraLinks(id);
  return { ok: true };
}

export async function acaoEsvaziarLixeiraLinks(): Promise<Resposta> {
  await linksApp.esvaziarLixeiraLinks();
  return { ok: true };
}

/** Importa um arquivo de favoritos exportado do navegador (Netscape Bookmark) pra dentro de uma pasta. */
export async function acaoImportarFavoritosHtml(htmlTexto: string, idPastaDestino: string): Promise<RespostaLinks> {
  const nos = analisarBookmarksHtml(htmlTexto);
  if (nos.length === 0) return { ok: false, erro: "Não achei nenhuma pasta ou link nesse arquivo." };
  return comTratamento(() => linksApp.importarArvore(nos, idPastaDestino));
}

/** Lembra a última pasta usada no atalho "salvar link" — só a pré-seleção, o clique seguinte pode trocar. */
export async function acaoDefinirDestinoLink(idPasta: string): Promise<void> {
  await gravarConfig({ destinoLink: idPasta });
}

/**
 * Onde o atalho "salvar link" (a janelinha pop-up de `/salvar-link`) entrega
 * o link escolhido. Busca o favicon do site (o título já vem do navegador,
 * via `document.title` no bookmarklet — não precisa buscar de novo).
 */
export async function acaoSalvarLinkDoClipper(idPasta: string, titulo: string, url: string): Promise<Resposta> {
  if (!url.trim()) return { ok: false, erro: "URL em branco." };
  try {
    const { favicon } = await linksApp.buscarMetadadosUrl(url);
    await linksApp.criarLink(idPasta, { titulo, url, nota: "", favorito: false }, favicon);
    revalidatePath("/links", "layout");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." };
  }
}
