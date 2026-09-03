"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { COLUNAS_KANBAN } from "@/lib/tipos";
import {
  criarTarefa,
  excluirTarefa,
  lerTarefa,
  listarQuadro,
  moverTarefa,
  renomearTarefa,
  reordenarTarefasPara,
  salvarTarefa,
} from "@/lib/kanban";
import type { ColunaKanban, Quadro } from "@/lib/tipos";

import type { Resposta } from "./acoes";

/**
 * Ponte entre a interface do Kanban e o disco — mesma ideia de acoes.ts,
 * separada porque o Kanban é um espaço à parte das anotações.
 */

const caminhoValido = z.string().min(1).max(400);
const colunaValida = z.enum(COLUNAS_KANBAN);

async function tentar(acao: () => Promise<void>): Promise<Resposta> {
  try {
    await acao();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para concluir" };
  }
}

function atualizarTudo(): void {
  revalidatePath("/", "layout");
}

export async function acaoListarQuadro(caderno: string): Promise<Quadro> {
  return listarQuadro(caminhoValido.parse(caderno));
}

export async function acaoCriarTarefa(caderno: string, coluna: ColunaKanban, titulo: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarTarefa(caminhoValido.parse(caderno), colunaValida.parse(coluna), z.string().max(200).parse(titulo));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoLerTarefa(caminho: string): Promise<{ titulo: string; conteudo: string } | null> {
  return lerTarefa(caminhoValido.parse(caminho));
}

export async function acaoSalvarTarefa(caminho: string, conteudo: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await salvarTarefa(caminhoValido.parse(caminho), z.string().max(50_000).parse(conteudo));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoRenomearTarefa(caminho: string, novoTitulo: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await renomearTarefa(caminhoValido.parse(caminho), z.string().max(200).parse(novoTitulo));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoMoverTarefa(caminho: string, colunaDestino: ColunaKanban): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await moverTarefa(caminhoValido.parse(caminho), colunaValida.parse(colunaDestino));
  });
  atualizarTudo();
  return resposta;
}

/** `pastaColuna` é o caminho da pasta da coluna (ex.: "Caderno/_kanban/Backlog"), só para validar. */
export async function acaoReordenarTarefasPara(pastaColuna: string, ordem: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const pastaValidada = caminhoValido.parse(pastaColuna);
    const lista = z.array(caminhoValido).max(1000).parse(ordem);
    if (lista.some((caminho) => !caminho.startsWith(`${pastaValidada}/`))) {
      throw new Error("Uma das tarefas não é desta coluna");
    }
    await reordenarTarefasPara(lista);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirTarefa(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirTarefa(caminhoValido.parse(caminho));
  });
  atualizarTudo();
  return resposta;
}
