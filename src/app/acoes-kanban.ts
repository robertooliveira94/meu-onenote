"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  criarEtiquetaKanban,
  editarEtiquetaKanban,
  excluirEtiquetaKanban,
} from "@/lib/etiquetas-kanban";
import {
  criarQuadro,
  definirCorQuadro,
  definirIconeQuadro,
  excluirQuadro,
  renomearQuadro,
  reordenarQuadrosPara,
} from "@/lib/quadros";
import { criarSprint, definirDatasDaSprint, excluirSprint, fecharSprint, renomearSprint } from "@/lib/sprints-kanban";
import { ESTIMATIVAS, PRIORIDADES, RECORRENCIAS } from "@/lib/tipos";
import type { ExtrasDaTarefa } from "@/lib/tipos";
import {
  adicionarComentario,
  alternarColunaConcluida,
  arquivarConcluidas,
  arquivarUmaColuna,
  arquivarTarefa,
  desarquivarTarefa,
  buscarTarefas,
  criarColuna,
  criarTarefa,
  definirDependencias,
  definirEtiquetasDaTarefa,
  definirImpedimento,
  definirPrazo,
  definirArquivarApos,
  definirCorDaTarefa,
  definirEstimativa,
  definirLimiteWip,
  definirPrioridade,
  definirRecorrencia,
  definirSprintDaTarefa,
  definirSubtarefas,
  duplicarTarefa,
  excluirColuna,
  excluirComentario,
  excluirTarefa,
  lerTarefa,
  listarQuadro,
  moverTarefa,
  renomearColuna,
  renomearTarefa,
  reordenarColunas,
  reordenarTarefasPara,
  salvarTarefa,
  tarefasComPrazoVencendo,
} from "@/lib/kanban";
import type { ColunaKanban, Comentario, Quadro, Subtarefa } from "@/lib/tipos";

import type { Resposta } from "./acoes";

/**
 * Ponte entre a interface do Kanban e o disco — mesma ideia de acoes.ts,
 * separada porque o Kanban é um espaço à parte das anotações.
 */

const caminhoValido = z.string().min(1).max(400);
const colunaValida = z.string().min(1).max(40);
const prioridadeValida = z.enum(PRIORIDADES);
const estimativaValida = z.enum(ESTIMATIVAS);
const recorrenciaValida = z.enum(RECORRENCIAS);
const corValida = z.string().regex(/^#[0-9a-fA-F]{6}$/);

async function tentar(acao: () => Promise<void>): Promise<Resposta> {
  try {
    await acao();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: mensagemDeErro(erro) };
  }
}

/** Ver o comentário gêmeo em `acoes.ts` — erro de `z.parse` não pode vazar cru pra tela. */
function mensagemDeErro(erro: unknown): string {
  if (erro instanceof z.ZodError) return "Preencha os campos corretamente.";
  return erro instanceof Error ? erro.message : "Não deu para concluir";
}

function atualizarTudo(): void {
  revalidatePath("/", "layout");
}

export async function acaoListarQuadro(quadro: string): Promise<Quadro> {
  return listarQuadro(caminhoValido.parse(quadro));
}

const dataValida = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const extrasValidos = z.object({
  prioridade: prioridadeValida.nullable().optional(),
  etiquetas: z.array(z.string().max(80)).max(20).optional(),
  prazo: dataValida.nullable().optional(),
  sprintId: z.string().max(80).nullable().optional(),
  estimativa: estimativaValida.nullable().optional(),
});

export async function acaoCriarTarefa(
  quadro: string,
  coluna: ColunaKanban,
  titulo: string,
  extras: ExtrasDaTarefa = {},
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarTarefa(
      caminhoValido.parse(quadro),
      colunaValida.parse(coluna),
      z.string().max(200).parse(titulo),
      "",
      extrasValidos.parse(extras),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoLerTarefa(caminho: string): Promise<{ titulo: string; conteudo: string } | null> {
  return lerTarefa(caminhoValido.parse(caminho));
}

/**
 * Não revalida a casca de propósito, como `acaoSalvarNota`: quem salva já
 * tem o texto na tela, e remontar a lista de quadros inteira a cada
 * gravação só deixaria o editor lento à toa.
 */
export async function acaoSalvarTarefa(caminho: string, conteudo: string): Promise<Resposta> {
  return tentar(async () => {
    await salvarTarefa(caminhoValido.parse(caminho), z.string().max(50_000).parse(conteudo));
  });
}

export async function acaoRenomearTarefa(caminho: string, novoTitulo: string): Promise<Resposta> {
  try {
    const alvo = await renomearTarefa(caminhoValido.parse(caminho), z.string().max(200).parse(novoTitulo));
    atualizarTudo();
    return { ok: true, mensagem: alvo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para renomear" };
  }
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

/** `pastaColuna` é o caminho da pasta da coluna (ex.: "_kanban/Meu quadro/Backlog"), só para validar. */
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

export async function acaoArquivarTarefa(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await arquivarTarefa(caminhoValido.parse(caminho));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoArquivarConcluidas(quadro: string): Promise<Resposta> {
  try {
    const quantas = await arquivarConcluidas(caminhoValido.parse(quadro));
    atualizarTudo();
    return { ok: true, mensagem: String(quantas) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para arquivar" };
  }
}

export async function acaoArquivarUmaColuna(quadro: string, coluna: string): Promise<Resposta> {
  try {
    const quantas = await arquivarUmaColuna(caminhoValido.parse(quadro), colunaValida.parse(coluna));
    atualizarTudo();
    return { ok: true, mensagem: String(quantas) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para arquivar" };
  }
}

export async function acaoDesarquivarTarefa(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await desarquivarTarefa(caminhoValido.parse(caminho));
  });
  atualizarTudo();
  return resposta;
}

/*
 * As ações daqui até `acaoDefinirImpedimento` mexem só em metadado de uma
 * tarefa (etiqueta, prioridade, prazo, sprint, subtarefa, impedimento) e
 * nenhuma delas revalida a casca de propósito: o quadro já atualiza o
 * cartão na hora, no cliente, e revalidar remontava a lista de quadros e a
 * árvore inteira a cada clique numa caixinha de subtarefa — ~26 KB e uns
 * 270 ms por marcação, para desenhar exatamente a mesma tela. As outras
 * telas são dinâmicas e leem tudo de novo ao serem abertas.
 */

export async function acaoDefinirEtiquetasDaTarefa(caminho: string, etiquetas: string[]): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(z.string().max(60)).max(20).parse(etiquetas);
    await definirEtiquetasDaTarefa(validado, lista);
  });
}

export async function acaoDefinirDependencias(caminho: string, dependeDe: string[]): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(caminhoValido).max(50).parse(dependeDe);
    await definirDependencias(validado, lista);
  });
}

export async function acaoDefinirPrioridade(caminho: string, prioridade: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = prioridade === null ? null : prioridadeValida.parse(prioridade);
    await definirPrioridade(validado, valor);
  });
}

export async function acaoDefinirCorDaTarefa(caminho: string, cor: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    await definirCorDaTarefa(validado, cor === null ? null : corValida.parse(cor));
  });
}

export async function acaoDefinirEstimativa(caminho: string, estimativa: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    await definirEstimativa(validado, estimativa === null ? null : estimativaValida.parse(estimativa));
  });
}

export async function acaoDefinirRecorrencia(caminho: string, recorrencia: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    await definirRecorrencia(validado, recorrencia === null ? null : recorrenciaValida.parse(recorrencia));
  });
}

export async function acaoDefinirPrazo(caminho: string, prazo: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = prazo === null ? null : z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(prazo);
    await definirPrazo(validado, valor);
  });
}

export async function acaoDefinirSprintDaTarefa(caminho: string, sprintId: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = sprintId === null ? null : z.string().max(60).parse(sprintId);
    await definirSprintDaTarefa(validado, valor);
  });
}

const subtarefaValida = z.object({
  id: z.string().max(60),
  texto: z.string().max(200),
  feita: z.boolean(),
});

export async function acaoDefinirSubtarefas(caminho: string, subtarefas: Subtarefa[]): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(subtarefaValida).max(100).parse(subtarefas);
    await definirSubtarefas(validado, lista);
  });
}

/**
 * Devolve o comentário criado (não só ok/erro) — o mural mostra o horário
 * exato, decidido no servidor, sem esperar um refresh pra saber qual foi.
 */
export async function acaoAdicionarComentario(
  caminho: string,
  texto: string,
): Promise<{ ok: true; comentario: Comentario } | { ok: false; erro: string }> {
  try {
    const validado = caminhoValido.parse(caminho);
    const limpo = z.string().min(1).max(2000).parse(texto);
    const comentario = await adicionarComentario(validado, limpo);
    if (!comentario) return { ok: false, erro: "Escreva alguma coisa antes de comentar" };
    return { ok: true, comentario };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para comentar" };
  }
}

export async function acaoExcluirComentario(caminho: string, id: string): Promise<Resposta> {
  return tentar(async () => {
    await excluirComentario(caminhoValido.parse(caminho), z.string().max(60).parse(id));
  });
}

export async function acaoDefinirImpedimento(caminho: string, motivo: string | null): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const valor = motivo === null ? null : z.string().max(200).parse(motivo);
    await definirImpedimento(validado, valor);
  });
}

// ---------------------------------------------------------------- quadros

export async function acaoCriarQuadro(nome: string): Promise<Resposta> {
  try {
    const criado = await criarQuadro(z.string().min(1).max(120).parse(nome));
    atualizarTudo();
    return { ok: true, mensagem: criado };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para criar o quadro" };
  }
}

export async function acaoRenomearQuadro(nome: string, novoNome: string): Promise<Resposta> {
  try {
    const alvo = await renomearQuadro(
      z.string().min(1).max(120).parse(nome),
      z.string().min(1).max(120).parse(novoNome),
    );
    atualizarTudo();
    return { ok: true, mensagem: alvo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para renomear o quadro" };
  }
}

export async function acaoExcluirQuadro(nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirQuadro(z.string().min(1).max(120).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirCorQuadro(nome: string, cor: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await definirCorQuadro(z.string().min(1).max(120).parse(nome), z.string().max(40).parse(cor));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirIconeQuadro(nome: string, icone: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await definirIconeQuadro(z.string().min(1).max(120).parse(nome), z.string().max(8).parse(icone));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoReordenarQuadrosPara(nomes: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await reordenarQuadrosPara(z.array(z.string().min(1).max(120)).max(200).parse(nomes));
  });
  atualizarTudo();
  return resposta;
}

// --------------------------------------------------------------- colunas

export async function acaoCriarColuna(quadro: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarColuna(caminhoValido.parse(quadro), z.string().min(1).max(40).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoRenomearColuna(quadro: string, nomeAtual: string, novoNome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await renomearColuna(
      caminhoValido.parse(quadro),
      colunaValida.parse(nomeAtual),
      z.string().min(1).max(40).parse(novoNome),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirColuna(quadro: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirColuna(caminhoValido.parse(quadro), colunaValida.parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoReordenarColunas(quadro: string, novaOrdem: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await reordenarColunas(caminhoValido.parse(quadro), z.array(colunaValida).max(30).parse(novaOrdem));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoAlternarColunaConcluida(quadro: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await alternarColunaConcluida(caminhoValido.parse(quadro), colunaValida.parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirLimiteWip(quadro: string, coluna: string, limite: number | null): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const valor = limite === null ? null : z.number().int().min(1).max(999).parse(limite);
    await definirLimiteWip(caminhoValido.parse(quadro), colunaValida.parse(coluna), valor);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirArquivarApos(quadro: string, dias: number): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await definirArquivarApos(caminhoValido.parse(quadro), z.number().int().min(0).max(3650).parse(dias));
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

export async function acaoDefinirDatasDaSprint(id: string, inicio: string | null, fim: string | null): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await definirDatasDaSprint(
      z.string().max(60).parse(id),
      inicio === null ? null : dataValida.parse(inicio),
      fim === null ? null : dataValida.parse(fim),
    );
  });
  atualizarTudo();
  return resposta;
}

/** Fecha a sprint; o que sobrou vai para `destino` (outra sprint) ou fica solto (`null`). Devolve quantas sobraram. */
export async function acaoFecharSprint(id: string, destino: string | null): Promise<Resposta> {
  try {
    const movidas = await fecharSprint(z.string().max(60).parse(id), destino === null ? null : z.string().max(60).parse(destino));
    atualizarTudo();
    return { ok: true, mensagem: String(movidas) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para fechar a sprint" };
  }
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
  quadro?: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarEtiquetaKanban(
      z.string().min(1).max(40).parse(nome),
      z.string().parse(cor),
      z.string().max(140).parse(descricao),
      quadro ? z.string().max(80).parse(quadro) : undefined,
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

/** Busca de tarefas em todos os quadros pra paleta de comandos — só pelo índice, pelo título. */
export async function acaoBuscarTarefas(termo: string) {
  return buscarTarefas(z.string().max(120).parse(termo));
}

/** Tarefas atrasadas e vencendo hoje, para o aviso do hub. `hoje` é a data do navegador (AAAA-MM-DD). */
export async function acaoTarefasComPrazoVencendo(hoje: string) {
  return tarefasComPrazoVencendo(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(hoje));
}
