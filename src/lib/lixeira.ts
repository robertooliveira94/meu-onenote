import fs from "node:fs/promises";
import path from "node:path";

import {
  PASTA_SISTEMA,
  RAIZ,
  garantirForaDoSistema,
  juntar,
  nomeDe,
  pastaDe,
  resolverCaminho,
} from "./caminhos";
import { atualizarIndice, esquecer } from "./indice";
import type { EntradaNota, EntradaPasta, ItemLixeira } from "./tipos";

/**
 * Excluir aqui nunca apaga de imediato: o item vai para `_sistema/lixeira/` e
 * pode voltar exatamente para onde estava, com etiquetas e favorito
 * preservados. Só "esvaziar a lixeira" apaga de verdade.
 */
const PASTA_LIXEIRA = path.join(RAIZ, PASTA_SISTEMA, "lixeira");
const PASTA_ITENS = path.join(PASTA_LIXEIRA, "itens");
const ARQUIVO_REGISTRO = path.join(PASTA_LIXEIRA, "registro.json");

/** Guardamos os metadados junto para que restaurar devolva as etiquetas. */
type RegistroLixeira = ItemLixeira & {
  notas: Record<string, EntradaNota>;
  pastas: Record<string, EntradaPasta>;
};

let fila: Promise<unknown> = Promise.resolve();

async function lerRegistro(): Promise<RegistroLixeira[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_REGISTRO, "utf8")) as RegistroLixeira[];
  } catch {
    return [];
  }
}

async function gravarRegistro(itens: RegistroLixeira[]): Promise<void> {
  await fs.mkdir(PASTA_LIXEIRA, { recursive: true });
  await fs.writeFile(ARQUIVO_REGISTRO, JSON.stringify(itens, null, 2), "utf8");
}

async function alterar<T>(mudanca: (itens: RegistroLixeira[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const itens = await lerRegistro();
    const resultado = await mudanca(itens);
    await gravarRegistro(itens);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function listarLixeira(): Promise<ItemLixeira[]> {
  const itens = await lerRegistro();
  return itens
    .map(({ id, nome, caminhoOriginal, tipo, excluidoEm }) => ({
      id,
      nome,
      caminhoOriginal,
      tipo,
      excluidoEm,
    }))
    .sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm));
}

export async function enviarParaLixeira(caminho: string): Promise<void> {
  garantirForaDoSistema(caminho);
  const absoluto = resolverCaminho(caminho);
  const info = await fs.stat(absoluto);
  const ehPasta = info.isDirectory();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const destino = path.join(PASTA_ITENS, id);
  await fs.mkdir(destino, { recursive: true });
  await fs.rename(absoluto, path.join(destino, nomeDe(caminho)));

  // Tira os metadados do índice, mas guarda uma cópia para a restauração.
  const guardados = await atualizarIndice((indice) => {
    const notas: Record<string, EntradaNota> = {};
    const pastas: Record<string, EntradaPasta> = {};
    for (const [chave, valor] of Object.entries(indice.notas)) {
      if (chave === caminho || chave.startsWith(`${caminho}/`)) notas[chave] = valor;
    }
    for (const [chave, valor] of Object.entries(indice.pastas)) {
      if (chave === caminho || chave.startsWith(`${caminho}/`)) pastas[chave] = valor;
    }
    esquecer(indice, caminho);
    return { notas, pastas };
  });

  await alterar((itens) => {
    itens.push({
      id,
      nome: nomeDe(caminho),
      caminhoOriginal: caminho,
      tipo: ehPasta ? "pasta" : "nota",
      excluidoEm: new Date().toISOString(),
      notas: guardados.notas,
      pastas: guardados.pastas,
    });
  });
}

export async function restaurar(id: string): Promise<string> {
  const itens = await lerRegistro();
  const item = itens.find((registro) => registro.id === id);
  if (!item) throw new Error("Item não encontrado na lixeira");

  const origem = path.join(PASTA_ITENS, item.id, item.nome);
  const pastaDestino = pastaDe(item.caminhoOriginal);
  let destino = item.caminhoOriginal;

  // Se a pasta de origem sumiu, ela volta a existir para receber o item.
  await fs.mkdir(resolverCaminho(pastaDestino), { recursive: true });

  // Alguém pode ter criado outro item com o mesmo nome nesse meio-tempo.
  try {
    await fs.access(resolverCaminho(destino));
    const extensao = item.tipo === "nota" ? path.extname(item.nome) : "";
    const base = item.nome.slice(0, item.nome.length - extensao.length);
    destino = juntar(pastaDestino, `${base} (restaurada)${extensao}`);
  } catch {
    // Caminho livre: volta para o lugar original.
  }

  await fs.rename(origem, resolverCaminho(destino));
  await fs.rm(path.join(PASTA_ITENS, item.id), { recursive: true, force: true });

  await atualizarIndice((indice) => {
    const ajustar = <T>(mapa: Record<string, T>, guardados: Record<string, T>) => {
      for (const [chave, valor] of Object.entries(guardados)) {
        mapa[destino + chave.slice(item.caminhoOriginal.length)] = valor;
      }
    };
    ajustar(indice.notas, item.notas);
    ajustar(indice.pastas, item.pastas);
  });

  await alterar((registros) => {
    const posicao = registros.findIndex((registro) => registro.id === id);
    if (posicao >= 0) registros.splice(posicao, 1);
  });

  return destino;
}

/** Apaga um item da lixeira em definitivo. */
export async function apagarDeVez(id: string): Promise<void> {
  await fs.rm(path.join(PASTA_ITENS, id), { recursive: true, force: true });
  await alterar((itens) => {
    const posicao = itens.findIndex((registro) => registro.id === id);
    if (posicao >= 0) itens.splice(posicao, 1);
  });
}

export async function esvaziarLixeira(): Promise<void> {
  await fs.rm(PASTA_ITENS, { recursive: true, force: true });
  await alterar((itens) => {
    itens.length = 0;
  });
}
