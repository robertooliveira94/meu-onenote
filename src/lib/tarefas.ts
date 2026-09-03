import fs from "node:fs/promises";

import { PASTA_KANBAN, resolverCaminho, tituloDe } from "./caminhos";
import { extrairTarefas } from "./formatacao";
import { lerIndice } from "./indice";

/**
 * Tarefas `- [ ]`/`- [x]` espalhadas por todas as notas, reunidas num só
 * lugar — para não precisar abrir caderno por caderno atrás do que falta
 * fazer. A extração em si (regex + contagem por ordem de aparição) mora em
 * `formatacao.ts`, a mesma usada para virar a caixinha ao clicar — assim as
 * duas nunca contam as tarefas de jeitos diferentes.
 */

export type Tarefa = {
  caminho: string;
  titulo: string;
  /** Posição da tarefa na nota, pela ordem de aparição — é o que o servidor
   * espera para saber qual caixinha mexer (ver `acaoAlternarTarefaEm`). */
  indice: number;
  texto: string;
  concluida: boolean;
};

/** Varre o vault inteiro atrás de tarefas — a base do painel `/tarefas`. */
export async function listarTarefas(): Promise<Tarefa[]> {
  const indice = await lerIndice();
  const tarefas: Tarefa[] = [];

  for (const caminho of Object.keys(indice.notas)) {
    // Tarefa do Kanban não entra aqui — o quadro já É o painel de tarefas
    // dela; listar de novo seria só duplicar.
    if (caminho.includes(`/${PASTA_KANBAN}/`)) continue;
    let conteudo: string;
    try {
      conteudo = await fs.readFile(resolverCaminho(caminho), "utf8");
    } catch {
      continue;
    }
    for (const tarefa of extrairTarefas(conteudo)) {
      tarefas.push({ caminho, titulo: tituloDe(caminho), ...tarefa });
    }
  }

  return tarefas;
}
