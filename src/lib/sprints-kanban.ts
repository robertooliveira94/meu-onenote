import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { atualizarIndice } from "./indice";
import type { SprintKanban } from "./tipos";

/**
 * Sprints do Kanban — só um agrupador simples de tarefas por nome, sem
 * datas nem burndown. Cadastro global (uma sprint pode juntar tarefas de
 * quadros de cadernos diferentes), mesmo padrão de arquivo-fila de
 * etiquetas-kanban.ts.
 */
const ARQUIVO_SPRINTS = path.join(RAIZ, PASTA_SISTEMA, "sprints-kanban.json");

let fila: Promise<unknown> = Promise.resolve();

async function lerBruto(): Promise<SprintKanban[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_SPRINTS, "utf8")) as SprintKanban[];
  } catch {
    return [];
  }
}

async function gravar(sprints: SprintKanban[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_SPRINTS), { recursive: true });
  await fs.writeFile(ARQUIVO_SPRINTS, JSON.stringify(sprints, null, 2), "utf8");
}

async function alterar<T>(mudanca: (sprints: SprintKanban[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const sprints = await lerBruto();
    const resultado = await mudanca(sprints);
    await gravar(sprints);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function listarSprints(): Promise<SprintKanban[]> {
  const lidas = await lerBruto();
  // Mais recente primeiro — é a que normalmente se quer ver/escolher.
  return [...lidas].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
}

export async function criarSprint(nome: string): Promise<SprintKanban> {
  return alterar((sprints) => {
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para a sprint");
    if (sprints.some((sprint) => sprint.nome.toLowerCase() === limpo.toLowerCase())) {
      throw new Error("Já existe uma sprint com esse nome");
    }
    const nova: SprintKanban = { id: crypto.randomUUID(), nome: limpo, criadoEm: new Date().toISOString() };
    sprints.push(nova);
    return nova;
  });
}

export async function renomearSprint(id: string, nome: string): Promise<void> {
  await alterar((sprints) => {
    const sprint = sprints.find((item) => item.id === id);
    if (!sprint) throw new Error("Sprint não encontrada");
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para a sprint");
    sprint.nome = limpo;
  });
}

/** Some com a sprint e desvincula todas as tarefas que estavam nela. */
export async function excluirSprint(id: string): Promise<void> {
  await alterar((sprints) => {
    const posicao = sprints.findIndex((sprint) => sprint.id === id);
    if (posicao >= 0) sprints.splice(posicao, 1);
  });
  await atualizarIndice((indice) => {
    for (const entrada of Object.values(indice.notas)) {
      if (entrada.sprintKanban === id) entrada.sprintKanban = undefined;
    }
  });
}

/** Quantas tarefas estão em cada sprint — mostrado no cadastro. */
export async function contarTarefasPorSprint(): Promise<Record<string, number>> {
  const { lerIndice } = await import("./indice");
  const indice = await lerIndice();
  const contagem: Record<string, number> = {};
  for (const entrada of Object.values(indice.notas)) {
    if (!entrada.sprintKanban) continue;
    contagem[entrada.sprintKanban] = (contagem[entrada.sprintKanban] ?? 0) + 1;
  }
  return contagem;
}
