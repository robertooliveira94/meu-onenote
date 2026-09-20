"use server";

import { revalidatePath } from "next/cache";

import * as comprasApp from "@/lib/compras-app";
import type { CamposProduto, ImagemBuscada, ProdutoAchado } from "@/lib/compras-app";
import type { DadosCompras, EstadoProduto, Produto } from "@/lib/tipos";

/**
 * Ações da app de Compras. Como em Links, os dados só aparecem dentro de
 * `/compras` (e no popup `/salvar-produto`) — revalidar essa rota basta.
 */

export type RespostaCompras = { ok: true; dados: DadosCompras } | { ok: false; erro: string };

function comTratamento(func: () => Promise<DadosCompras>): Promise<RespostaCompras> {
  return func()
    .then((dados) => {
      revalidatePath("/compras", "layout");
      return { ok: true as const, dados };
    })
    .catch((erro: unknown) => ({ ok: false as const, erro: erro instanceof Error ? erro.message : "Não deu certo." }));
}

export async function acaoObterCompras(): Promise<DadosCompras> {
  return comprasApp.obterDados();
}

export async function acaoCriarCategoria(nome: string): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.criarCategoria(nome));
}

export async function acaoAtualizarCategoria(id: string, campos: { nome?: string; cor?: string }): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.atualizarCategoria(id, campos));
}

export async function acaoExcluirCategoria(id: string): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.excluirCategoria(id));
}

export async function acaoReordenarCategorias(ordemIds: string[]): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.reordenarCategorias(ordemIds));
}

/** Nome e imagem pela página da loja — chamado ao colar um link no diálogo ou ao abrir o popup da extensão. */
export async function acaoBuscarDadosDoProduto(url: string) {
  return comprasApp.buscarDadosDoProduto(url);
}

export async function acaoAcharProdutoPorUrl(url: string) {
  return comprasApp.acharPorUrl(url);
}

export async function acaoCriarProduto(
  campos: CamposProduto,
  imagem?: ImagemBuscada,
): Promise<{ ok: true; produto: Produto; dados: DadosCompras } | { ok: false; erro: string }> {
  try {
    const produto = await comprasApp.criarProduto(campos, imagem);
    revalidatePath("/compras", "layout");
    return { ok: true, produto, dados: await comprasApp.obterDados() };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." };
  }
}

export async function acaoAtualizarProduto(id: string, campos: CamposProduto, imagem?: ImagemBuscada): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.atualizarProduto(id, campos, imagem));
}

export async function acaoAdicionarLoja(
  id: string,
  loja: { url: string; loja: string; preco: number | null },
): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.adicionarLoja(id, loja));
}

export async function acaoMudarEstadoProduto(
  id: string,
  estado: EstadoProduto,
  compra?: { compradoEm: string; precoPago: number | null; lojaDaCompra: string },
): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.mudarEstado(id, estado, compra));
}

export async function acaoExcluirProduto(id: string): Promise<RespostaCompras> {
  return comTratamento(() => comprasApp.excluirProduto(id));
}

export async function acaoBuscarProdutos(termo: string): Promise<ProdutoAchado[]> {
  return comprasApp.buscarProdutos(termo);
}
