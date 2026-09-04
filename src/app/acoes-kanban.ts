"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  criarEtiquetaKanban,
  editarEtiquetaKanban,
  excluirEtiquetaKanban,
} from "@/lib/etiquetas-kanban";
import { criarSprint, excluirSprint, renomearSprint } from "@/lib/sprints-kanban";
import { PRIORIDADES } from "@/lib/tipos";
import {
  criarColuna,
  criarTarefa,
  definirColunaConcluida,
  definirDependencias,
  definirEtiquetasDaTarefa,
  definirPrazo,
  definirPrioridade,
  definirSprintDaTarefa,
  duplicarTarefa,
  excluirColuna,
  excluirTarefa,
  lerTarefa,
  listarQuadro,
  moverTarefa,
  renomearColuna,
  renomearTarefa,
  reordenarColunas,
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
const colunaValida = z.string().min(1).max(40);
const prioridadeValida = z.enum(PRIORIDADES);

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

export async function acaoDuplicarTarefa(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await duplicarTarefa(caminhoValido.parse(caminho));
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

export async function acaoDefinirEtiquetasDaTarefa(caminho: string, etiquetas: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(z.string().max(60)).max(20).parse(etiquetas);
    await definirEtiquetasDaTarefa(validado, lista);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirDependencias(caminho: string, dependeDe: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(caminhoValido).max(50).parse(dependeDe);
    await definirDependencias(validado, lista);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirPrioridade(caminho: string, prioridade: string | null): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = prioridade === null ? null : prioridadeValida.parse(prioridade);
    await definirPrioridade(validado, valor);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirPrazo(caminho: string, prazo: string | null): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = prazo === null ? null : z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(prazo);
    await definirPrazo(validado, valor);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirSprintDaTarefa(caminho: string, sprintId: string | null): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = sprintId === null ? null : z.string().max(60).parse(sprintId);
    await definirSprintDaTarefa(validado, valor);
  });
  atualizarTudo();
  return resposta;
}

// --------------------------------------------------------------- colunas

export async function acaoCriarColuna(caderno: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarColuna(caminhoValido.parse(caderno), z.string().min(1).max(40).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoRenomearColuna(caderno: string, nomeAtual: string, novoNome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await renomearColuna(
      caminhoValido.parse(caderno),
      colunaValida.parse(nomeAtual),
      z.string().min(1).max(40).parse(novoNome),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirColuna(caderno: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirColuna(caminhoValido.parse(caderno), colunaValida.parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoReordenarColunas(caderno: string, novaOrdem: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await reordenarColunas(caminhoValido.parse(caderno), z.array(colunaValida).max(30).parse(novaOrdem));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirColunaConcluida(caderno: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await definirColunaConcluida(caminhoValido.parse(caderno), colunaValida.parse(nome));
  });
  atualizarTudo();
  return resposta;
}

// --------------------------------------------------------------- sprints

export async function acaoCriarSprint(nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarSprint(z.string().min(1).max(60).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoRenomearSprint(id: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await renomearSprint(z.string().max(60).parse(id), z.string().min(1).max(60).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirSprint(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirSprint(z.string().max(60).parse(id));
  });
  atualizarTudo();
  return resposta;
}

// --------------------------------------------------------------- etiquetas kanban

export async function acaoCriarEtiquetaKanban(
  nome: string,
  cor: string,
  descricao: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarEtiquetaKanban(
      z.string().min(1).max(40).parse(nome),
      z.string().parse(cor),
      z.string().max(140).parse(descricao),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoEditarEtiquetaKanban(
  id: string,
  nome: string,
  cor: string,
  descricao: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await editarEtiquetaKanban(z.string().max(60).parse(id), {
      nome: z.string().min(1).max(40).parse(nome),
      cor: z.string().parse(cor),
      descricao: z.string().max(140).parse(descricao),
    });
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirEtiquetaKanban(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirEtiquetaKanban(z.string().max(60).parse(id));
  });
  atualizarTudo();
  return resposta;
}
