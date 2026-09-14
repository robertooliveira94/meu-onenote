"use server";

import { revalidatePath } from "next/cache";

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

export async function acaoCriarLink(idPasta: string, campos: CamposLink): Promise<RespostaLinks> {
  if (!campos.url.trim()) return { ok: false, erro: "Informe uma URL." };
  return comTratamento(() => linksApp.criarLink(idPasta, campos));
}

export async function acaoAtualizarLink(id: string, campos: CamposLink): Promise<RespostaLinks> {
  if (!campos.url.trim()) return { ok: false, erro: "Informe uma URL." };
  return comTratamento(() => linksApp.atualizarLink(id, campos));
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
