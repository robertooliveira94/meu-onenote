import type { Dirent } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import {
  PASTA_KANBAN,
  PASTA_SISTEMA,
  RAIZ,
  ehArquivoDeNota,
  ehPastaInterna,
  juntar,
  limparNome,
  resolverCaminho,
} from "./caminhos";
import { CORES_CADERNO, ICONES_CADERNO } from "./cores";
import { excluirEtiquetasDoQuadro } from "./etiquetas-kanban";
import { atualizarIndice, reapontar } from "./indice";
import { enviarParaLixeira, reapontarNaLixeira } from "./lixeira";
import type { Indice, ResumoQuadro } from "./tipos";

/**
 * Os quadros do Kanban — a lista da aplicação Kanban, equivalente ao que os
 * cadernos são para as Anotações, e completamente independente deles: cada
 * quadro é uma pasta em `_kanban/<Nome>/`, então excluir um quadro nunca
 * mexe num caderno de mesmo nome.
 *
 * O disco manda: a lista sai das pastas que existem em `_kanban/`. Cor,
 * ícone e ordem são acessório e moram em `_sistema/quadros.json` — mesmo
 * papel que o índice tem para as notas, e some sem prejuízo (o quadro
 * continua lá, só volta à cor padrão).
 */

const ARQUIVO_QUADROS = path.join(RAIZ, PASTA_SISTEMA, "quadros.json");

type MetaQuadro = { nome: string; cor: string; icone: string; ordem: number };

let fila: Promise<unknown> = Promise.resolve();

async function lerMetas(): Promise<MetaQuadro[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_QUADROS, "utf8")) as MetaQuadro[];
  } catch {
    return [];
  }
}

async function gravarMetas(metas: MetaQuadro[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_QUADROS), { recursive: true });
  await fs.writeFile(ARQUIVO_QUADROS, JSON.stringify(metas, null, 2), "utf8");
}

async function alterarMetas<T>(mudanca: (metas: MetaQuadro[]) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const metas = await lerMetas();
    const resultado = await mudanca(metas);
    await gravarMetas(metas);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

async function existe(absoluto: string): Promise<boolean> {
  try {
    await fs.access(absoluto);
    return true;
  } catch {
    return false;
  }
}

async function lerPasta(relativo: string): Promise<Dirent[]> {
  try {
    return await fs.readdir(resolverCaminho(relativo), { withFileTypes: true });
  } catch {
    return [];
  }
}

/**
 * Versões anteriores guardavam o quadro dentro do caderno
 * (`<Caderno>/_kanban/<Coluna>/`). Agora o Kanban é uma aplicação à parte,
 * com quadros próprios em `_kanban/<Quadro>/` — então a primeira vez que a
 * lista é lida, cada `_kanban` antigo vira um quadro com o nome do caderno
 * de onde saiu. Idempotente: depois da primeira passada não acha mais nada.
 */
async function migrarQuadrosAntigos(): Promise<void> {
  let entradasRaiz: Dirent[];
  try {
    entradasRaiz = await fs.readdir(RAIZ, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entrada of entradasRaiz) {
    if (!entrada.isDirectory() || ehPastaInterna(entrada.name)) continue;
    const antigo = juntar(entrada.name, PASTA_KANBAN);
    if (!(await existe(resolverCaminho(antigo)))) continue;

    const novo = juntar(PASTA_KANBAN, entrada.name);
    // Já existe um quadro com esse nome: deixa o antigo onde está em vez de
    // misturar dois quadros diferentes num só.
    if (await existe(resolverCaminho(novo))) continue;

    await fs.mkdir(resolverCaminho(PASTA_KANBAN), { recursive: true });
    await fs.rename(resolverCaminho(antigo), resolverCaminho(novo));

    await atualizarIndice((indice: Indice) => {
      // `dependeDe` guarda caminhos de outras tarefas — sem reescrever aqui,
      // toda dependência apontaria para um arquivo que não existe mais.
      for (const nota of Object.values(indice.notas)) {
        if (!nota.dependeDe) continue;
        nota.dependeDe = nota.dependeDe.map((caminho) =>
          caminho === antigo || caminho.startsWith(`${antigo}/`)
            ? novo + caminho.slice(antigo.length)
            : caminho,
        );
      }
      reapontar(indice, antigo, novo);
    });
    // Tarefa que já estava na lixeira também aponta para o caminho antigo —
    // sem isto, restaurar devolveria o arquivo para fora do quadro.
    await reapontarNaLixeira(antigo, novo);
  }
}

/** Quantas tarefas o quadro tem, somando todas as colunas. */
async function contarTarefas(quadro: string): Promise<number> {
  const colunas = await lerPasta(juntar(PASTA_KANBAN, quadro));
  let total = 0;
  for (const coluna of colunas) {
    if (!coluna.isDirectory()) continue;
    const arquivos = await lerPasta(juntar(PASTA_KANBAN, quadro, coluna.name));
    total += arquivos.filter((item) => item.isFile() && ehArquivoDeNota(item.name)).length;
  }
  return total;
}

export async function listarQuadros(): Promise<ResumoQuadro[]> {
  await migrarQuadrosAntigos();
  await fs.mkdir(resolverCaminho(PASTA_KANBAN), { recursive: true });

  const entradas = await lerPasta(PASTA_KANBAN);
  const nomes = entradas.filter((entrada) => entrada.isDirectory()).map((entrada) => entrada.name);
  const metas = await lerMetas();

  const quadros: ResumoQuadro[] = [];
  for (const [posicao, nome] of nomes.entries()) {
    const meta = metas.find((item) => item.nome === nome);
    quadros.push({
      nome,
      caminho: juntar(PASTA_KANBAN, nome),
      cor: meta?.cor || CORES_CADERNO[posicao % CORES_CADERNO.length],
      icone: meta?.icone || ICONES_CADERNO[posicao % ICONES_CADERNO.length],
      quantidadeTarefas: await contarTarefas(nome),
    });
  }

  return quadros.sort(
    (a, b) =>
      (metas.find((item) => item.nome === a.nome)?.ordem ?? 0) -
        (metas.find((item) => item.nome === b.nome)?.ordem ?? 0) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
}

export async function criarQuadro(nome: string): Promise<string> {
  const limpo = limparNome(nome) || "Novo quadro";
  const caminho = juntar(PASTA_KANBAN, limpo);
  if (await existe(resolverCaminho(caminho))) throw new Error("Já existe um quadro com esse nome");

  await fs.mkdir(resolverCaminho(caminho), { recursive: true });
  await alterarMetas((metas) => {
    metas.push({
      nome: limpo,
      cor: CORES_CADERNO[metas.length % CORES_CADERNO.length],
      icone: ICONES_CADERNO[metas.length % ICONES_CADERNO.length],
      ordem: metas.length,
    });
  });
  return limpo;
}

export async function renomearQuadro(nome: string, novoNome: string): Promise<string> {
  const limpo = limparNome(novoNome);
  if (!limpo) throw new Error("Informe um nome");
  if (limpo === nome) return nome;

  const antigo = juntar(PASTA_KANBAN, nome);
  const novo = juntar(PASTA_KANBAN, limpo);
  if (await existe(resolverCaminho(novo))) throw new Error("Já existe um quadro com esse nome");

  await fs.rename(resolverCaminho(antigo), resolverCaminho(novo));
  await atualizarIndice((indice: Indice) => {
    for (const nota of Object.values(indice.notas)) {
      if (!nota.dependeDe) continue;
      nota.dependeDe = nota.dependeDe.map((caminho) =>
        caminho.startsWith(`${antigo}/`) ? novo + caminho.slice(antigo.length) : caminho,
      );
    }
    reapontar(indice, antigo, novo);
  });
  await alterarMetas((metas) => {
    const meta = metas.find((item) => item.nome === nome);
    if (meta) meta.nome = limpo;
  });
  return limpo;
}

/** Vai para a mesma lixeira das notas — com as tarefas dentro, restaurável. */
export async function excluirQuadro(nome: string): Promise<void> {
  await enviarParaLixeira(juntar(PASTA_KANBAN, nome));
  await alterarMetas((metas) => {
    const posicao = metas.findIndex((item) => item.nome === nome);
    if (posicao >= 0) metas.splice(posicao, 1);
  });
  // As etiquetas que eram só deste quadro não fazem sentido sem ele.
  await excluirEtiquetasDoQuadro(nome);
}

async function definirMeta(nome: string, campo: "cor" | "icone", valor: string): Promise<void> {
  await alterarMetas((metas) => {
    const meta = metas.find((item) => item.nome === nome);
    if (meta) {
      meta[campo] = valor;
      return;
    }
    metas.push({
      nome,
      cor: campo === "cor" ? valor : CORES_CADERNO[metas.length % CORES_CADERNO.length],
      icone: campo === "icone" ? valor : ICONES_CADERNO[metas.length % ICONES_CADERNO.length],
      ordem: metas.length,
    });
  });
}

export async function definirCorQuadro(nome: string, cor: string): Promise<void> {
  await definirMeta(nome, "cor", cor);
}

export async function definirIconeQuadro(nome: string, icone: string): Promise<void> {
  await definirMeta(nome, "icone", icone);
}

export async function reordenarQuadrosPara(nomes: string[]): Promise<void> {
  await alterarMetas((metas) => {
    nomes.forEach((nome, posicao) => {
      const meta = metas.find((item) => item.nome === nome);
      if (meta) {
        meta.ordem = posicao;
        return;
      }
      metas.push({
        nome,
        cor: CORES_CADERNO[posicao % CORES_CADERNO.length],
        icone: ICONES_CADERNO[posicao % ICONES_CADERNO.length],
        ordem: posicao,
      });
    });
  });
}
