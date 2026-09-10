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

/** As que valem num quadro: as gerais + as daquele quadro. Gerais primeiro. */
export async function etiquetasVisiveisKanban(quadro: string): Promise<EtiquetaKanban[]> {
  const todas = await listarEtiquetasKanban();
  return [
    ...todas.filter((etiqueta) => !etiqueta.quadro),
    ...todas.filter((etiqueta) => etiqueta.quadro === quadro),
  ];
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
  quadro?: string,
): Promise<EtiquetaKanban> {
  return alterar((etiquetas) => {
    const limpo = nome.trim().slice(0, 40);
    if (!limpo) throw new Error("Dê um nome para a etiqueta");
    // Choca com uma etiqueta que apareceria no mesmo lugar: uma geral choca
    // com qualquer outra geral; uma de quadro choca com as gerais e com as
    // do próprio quadro (dois quadros podem ter uma "Urgente" cada).
    const conflita = etiquetas.some(
      (etiqueta) =>
        etiqueta.nome.toLowerCase() === limpo.toLowerCase() &&
        (!etiqueta.quadro || etiqueta.quadro === quadro),
    );
    if (conflita) throw new Error("Já existe uma etiqueta com esse nome aqui");

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
      ...(quadro ? { quadro } : {}),
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
  await removerEtiquetas((etiqueta) => etiqueta.id === id);
}

/** Chamado ao excluir um quadro: leva junto as etiquetas que eram só dele. */
export async function excluirEtiquetasDoQuadro(quadro: string): Promise<void> {
  await removerEtiquetas((etiqueta) => etiqueta.quadro === quadro);
}

async function removerEtiquetas(alvo: (etiqueta: EtiquetaKanban) => boolean): Promise<void> {
  const removidas = new Set<string>();
  await alterar((etiquetas) => {
    for (let i = etiquetas.length - 1; i >= 0; i--) {
      if (alvo(etiquetas[i])) {
        removidas.add(etiquetas[i].id);
        etiquetas.splice(i, 1);
      }
    }
  });
  if (removidas.size === 0) return;
  await atualizarIndice((indice) => {
    for (const entrada of Object.values(indice.notas)) {
      if (!entrada.etiquetasKanban) continue;
      entrada.etiquetasKanban = entrada.etiquetasKanban.filter((etiqueta) => !removidas.has(etiqueta));
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
