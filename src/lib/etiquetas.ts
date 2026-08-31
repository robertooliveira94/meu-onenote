import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { CORES_ETIQUETA } from "./cores";
import { atualizarIndice } from "./indice";
import type { Etiqueta } from "./tipos";

/**
 * Cadastro de etiquetas. Fica separado do índice porque é uma lista que a
 * pessoa administra na mão, e não algo derivado do disco.
 */
const ARQUIVO_ETIQUETAS = path.join(RAIZ, PASTA_SISTEMA, "etiquetas.json");

export { CORES_ETIQUETA };

let fila: Promise<unknown> = Promise.resolve();

/** Leitura crua do arquivo, sem migração — é o que `alterar` precisa. */
async function lerBruto(): Promise<Etiqueta[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_ETIQUETAS, "utf8")) as Etiqueta[];
  } catch {
    return [];
  }
}

async function gravar(etiquetas: Etiqueta[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_ETIQUETAS), { recursive: true });
  await fs.writeFile(ARQUIVO_ETIQUETAS, JSON.stringify(etiquetas, null, 2), "utf8");
}

async function alterar<T>(mudanca: (etiquetas: Etiqueta[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const etiquetas = await lerBruto();
    const resultado = await mudanca(etiquetas);
    await gravar(etiquetas);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function listarEtiquetas(): Promise<Etiqueta[]> {
  let lidas = await lerBruto();

  // Etiquetas criadas com a paleta antiga passam a usar a cor nova equivalente.
  if (lidas.some((etiqueta) => !CORES_ETIQUETA.includes(etiqueta.cor))) {
    lidas = await alterar((etiquetas) => {
      etiquetas.forEach((etiqueta, posicao) => {
        if (!CORES_ETIQUETA.includes(etiqueta.cor)) {
          etiqueta.cor = CORES_ETIQUETA[posicao % CORES_ETIQUETA.length];
        }
      });
      return etiquetas;
    });
  }

  return [...lidas].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** "Contas a pagar" → "contas-a-pagar" */
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

export async function criarEtiqueta(
  nome: string,
  cor: string,
  descricao = "",
): Promise<Etiqueta> {
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

    const nova: Etiqueta = {
      id,
      nome: limpo,
      cor: CORES_ETIQUETA.includes(cor) ? cor : CORES_ETIQUETA[0],
      descricao: descricao.trim().slice(0, 140),
    };
    etiquetas.push(nova);
    return nova;
  });
}

export async function editarEtiqueta(
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

/** Some com a etiqueta e a retira de todas as notas que a usavam. */
export async function excluirEtiqueta(id: string): Promise<void> {
  await alterar((etiquetas) => {
    const posicao = etiquetas.findIndex((etiqueta) => etiqueta.id === id);
    if (posicao >= 0) etiquetas.splice(posicao, 1);
  });
  await atualizarIndice((indice) => {
    for (const entrada of Object.values(indice.notas)) {
      entrada.etiquetas = entrada.etiquetas.filter((etiqueta) => etiqueta !== id);
    }
  });
}

/** Quantas notas usam cada etiqueta — mostrado na tela de cadastro. */
export async function contarUsos(): Promise<Record<string, number>> {
  const { lerIndice } = await import("./indice");
  const indice = await lerIndice();
  const contagem: Record<string, number> = {};
  for (const entrada of Object.values(indice.notas)) {
    for (const etiqueta of entrada.etiquetas) {
      contagem[etiqueta] = (contagem[etiqueta] ?? 0) + 1;
    }
  }
  return contagem;
}
