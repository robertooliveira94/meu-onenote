import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import type { Modelo } from "./tipos";

/**
 * Cadastro de modelos de página. Mesma ideia das etiquetas: uma lista que a
 * pessoa administra na mão, separada do índice (que só guarda o que é
 * derivado do disco).
 */
const ARQUIVO_MODELOS = path.join(RAIZ, PASTA_SISTEMA, "modelos.json");

let fila: Promise<unknown> = Promise.resolve();

async function lerBruto(): Promise<Modelo[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_MODELOS, "utf8")) as Modelo[];
  } catch {
    return [];
  }
}

async function gravar(modelos: Modelo[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_MODELOS), { recursive: true });
  await fs.writeFile(ARQUIVO_MODELOS, JSON.stringify(modelos, null, 2), "utf8");
}

async function alterar<T>(mudanca: (modelos: Modelo[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const modelos = await lerBruto();
    const resultado = await mudanca(modelos);
    await gravar(modelos);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function listarModelos(): Promise<Modelo[]> {
  const lidos = await lerBruto();
  return [...lidos].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export async function lerModelo(id: string): Promise<Modelo | null> {
  const modelos = await lerBruto();
  return modelos.find((modelo) => modelo.id === id) ?? null;
}

/** "Reunião semanal" → "reuniao-semanal" */
function gerarId(nome: string): string {
  return (
    nome
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "modelo"
  );
}

export async function criarModelo(
  nome: string,
  descricao: string,
  conteudo: string,
): Promise<Modelo> {
  return alterar((modelos) => {
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para o modelo");
    if (modelos.some((modelo) => modelo.nome.toLowerCase() === limpo.toLowerCase())) {
      throw new Error("Já existe um modelo com esse nome");
    }

    let id = gerarId(limpo);
    let contador = 2;
    while (modelos.some((modelo) => modelo.id === id)) {
      id = `${gerarId(limpo)}-${contador}`;
      contador += 1;
    }

    const novo: Modelo = {
      id,
      nome: limpo,
      descricao: descricao.trim().slice(0, 140),
      conteudo,
    };
    modelos.push(novo);
    return novo;
  });
}

export async function editarModelo(
  id: string,
  dados: { nome: string; descricao: string; conteudo: string },
): Promise<void> {
  await alterar((modelos) => {
    const modelo = modelos.find((item) => item.id === id);
    if (!modelo) throw new Error("Modelo não encontrado");

    const limpo = dados.nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para o modelo");
    const repetido = modelos.some(
      (item) => item.id !== id && item.nome.toLowerCase() === limpo.toLowerCase(),
    );
    if (repetido) throw new Error("Já existe um modelo com esse nome");

    modelo.nome = limpo;
    modelo.descricao = dados.descricao.trim().slice(0, 140);
    modelo.conteudo = dados.conteudo;
  });
}

export async function excluirModelo(id: string): Promise<void> {
  await alterar((modelos) => {
    const posicao = modelos.findIndex((modelo) => modelo.id === id);
    if (posicao >= 0) modelos.splice(posicao, 1);
  });
}
