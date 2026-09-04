import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { CORES_ETIQUETA } from "./cores";
import { atualizarIndice } from "./indice";
import type { EtiquetaKanban } from "./tipos";

/**
 * Cadastro de etiquetas do Kanban — arquivo próprio, nunca o mesmo das
 * etiquetas de nota (`etiquetas.json`). Mesma estrutura e as mesmas
 * operações de `etiquetas.ts`, só que aplicadas a `entrada.etiquetasKanban`
 * em vez de `entrada.etiquetas` — é o que mantém os dois mundos sem se
 * misturar mesmo compartilhando o mesmo índice por baixo.
 */
const ARQUIVO_ETIQUETAS = path.join(RAIZ, PASTA_SISTEMA, "etiquetas-kanban.json");

let fila: Promise<unknown> = Promise.resolve();

async function lerBruto(): Promise<EtiquetaKanban[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_ETIQUETAS, "utf8")) as EtiquetaKanban[];
  } catch {
    return [];
  }
}

async function gravar(etiquetas: EtiquetaKanban[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_ETIQUETAS), { recursive: true });
  await fs.writeFile(ARQUIVO_ETIQUETAS, JSON.stringify(etiquetas, null, 2), "utf8");
}

async function alterar<T>(mudanca: (etiquetas: EtiquetaKanban[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const etiquetas = await lerBruto();
    const resultado = await mudanca(etiquetas);
    await gravar(etiquetas);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function listarEtiquetasKanban(): Promise<EtiquetaKanban[]> {
  const lidas = await lerBruto();
  return [...lidas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Urgente" → "urgente" */
function gerarId(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "etiqueta"
  );
}

export async function criarEtiquetaKanban(
  nome: string,
  cor: string,
  descricao = "",
): Promise<EtiquetaKanban> {
  return alterar((etiquetas) => {
    const limpo = nome.trim().slice(0, 40);
    if (!limpo) throw new Error("Dê um nome para a etiqueta");
    if (etiquetas.some((etiqueta) => etiqueta.nome.toLowerCase() === limpo.toLowerCase())) {
      throw new Error("Já existe uma etiqueta com esse nome");
    }

    let id = gerarId(limpo);
    let contador = 2;
    while (etiquetas.some((etiqueta) => etiqueta.id === id)) {
      id = `${gerarId(limpo)}-${contador}`;
      contador += 1;
    }

    const nova: EtiquetaKanban = {
      id,
      nome: limpo,
      cor: CORES_ETIQUETA.includes(cor) ? cor : CORES_ETIQUETA[0],
      descricao: descricao.trim().slice(0, 140),
    };
    etiquetas.push(nova);
    return nova;
  });
}

export async function editarEtiquetaKanban(
  id: string,
  dados: { nome: string; cor: string; descricao: string },
): Promise<void> {
  await alterar((etiquetas) => {
    const etiqueta = etiquetas.find((item) => item.id === id);
    if (!etiqueta) throw new Error("Etiqueta não encontrada");

    const limpo = dados.nome.trim().slice(0, 40);
    if (!limpo) throw new Error("Dê um nome para a etiqueta");
    const repetida = etiquetas.some(
      (item) => item.id !== id && item.nome.toLowerCase() === limpo.toLowerCase(),
    );
    if (repetida) throw new Error("Já existe uma etiqueta com esse nome");

    etiqueta.nome = limpo;
    etiqueta.cor = CORES_ETIQUETA.includes(dados.cor) ? dados.cor : etiqueta.cor;
    etiqueta.descricao = dados.descricao.trim().slice(0, 140);
  });
}

/** Some com a etiqueta e a retira de todas as tarefas que a usavam. */
export async function excluirEtiquetaKanban(id: string): Promise<void> {
  await alterar((etiquetas) => {
    const posicao = etiquetas.findIndex((etiqueta) => etiqueta.id === id);
    if (posicao >= 0) etiquetas.splice(posicao, 1);
  });
  await atualizarIndice((indice) => {
    for (const entrada of Object.values(indice.notas)) {
      if (!entrada.etiquetasKanban) continue;
      entrada.etiquetasKanban = entrada.etiquetasKanban.filter((etiqueta) => etiqueta !== id);
    }
  });
}

/** Quantas tarefas usam cada etiqueta — mostrado na tela de cadastro. */
export async function contarUsosKanban(): Promise<Record<string, number>> {
  const { lerIndice } = await import("./indice");
  const indice = await lerIndice();
  const contagem: Record<string, number> = {};
  for (const entrada of Object.values(indice.notas)) {
    for (const etiqueta of entrada.etiquetasKanban ?? []) {
      contagem[etiqueta] = (contagem[etiqueta] ?? 0) + 1;
    }
  }
  return contagem;
}
