import fs from "node:fs/promises";

import { resolverCaminho, tituloDe } from "./caminhos";
import { lerIndice } from "./indice";
import type { NoGrafo } from "./tipos";

/**
 * Links `[[Nome da Página]]` entre notas — a mesma sintaxe do Obsidian, texto
 * puro, sem marcação proprietária. Resolvidos pelo título (sem diferenciar
 * maiúsculas), porque é o que a pessoa digita sem precisar saber o caminho
 * inteiro.
 */

const PADRAO_LINK = /\[\[([^[\]]+)\]\]/g;

function normalizar(titulo: string): string {
  return titulo.trim().toLowerCase();
}

/** Todos os `[[links]]` citados num texto, na ordem em que aparecem. */
export function extrairLinks(conteudo: string): string[] {
  const encontrados: string[] = [];
  for (const casada of conteudo.matchAll(PADRAO_LINK)) {
    encontrados.push(casada[1].trim());
  }
  return encontrados;
}

/** Título normalizado → caminhos que têm esse título (mais de um = ambíguo). */
async function indiceDeTitulos(): Promise<Map<string, string[]>> {
  const indice = await lerIndice();
  const mapa = new Map<string, string[]>();
  for (const caminho of Object.keys(indice.notas)) {
    const chave = normalizar(tituloDe(caminho));
    const lista = mapa.get(chave);
    if (lista) lista.push(caminho);
    else mapa.set(chave, [caminho]);
  }
  return mapa;
}

/**
 * Acha o caminho de um `[[link]]` pelo título. Duas páginas com o mesmo nome
 * em cadernos diferentes: resolve pra primeira em ordem alfabética de
 * caminho — previsível, mas é bom título de página não se repetir.
 */
function resolverTitulo(titulo: string, indice: Map<string, string[]>): string | null {
  const candidatos = indice.get(normalizar(titulo));
  if (!candidatos || candidatos.length === 0) return null;
  return [...candidatos].sort((a, b) => a.localeCompare(b, "pt-BR"))[0];
}

/**
 * Resolve todo `[[link]]` do conteúdo de uma nota para o caminho de destino
 * (ou `null`, link sem página correspondente) — usado para desenhar os links
 * clicáveis na visualização.
 */
export async function linksDaNota(conteudo: string): Promise<Record<string, string | null>> {
  const titulos = extrairLinks(conteudo);
  if (titulos.length === 0) return {};
  const indice = await indiceDeTitulos();
  const mapa: Record<string, string | null> = {};
  for (const titulo of titulos) {
    mapa[normalizar(titulo)] = resolverTitulo(titulo, indice);
  }
  return mapa;
}

/** Lê o conteúdo de todas as notas de uma vez — base para grafo e backlinks. */
async function todosOsLinks(): Promise<{ de: string; para: string }[]> {
  const indice = await lerIndice();
  const indiceTitulos = await indiceDeTitulos();
  const arestas: { de: string; para: string }[] = [];

  for (const caminho of Object.keys(indice.notas)) {
    let conteudo: string;
    try {
      conteudo = await fs.readFile(resolverCaminho(caminho), "utf8");
    } catch {
      continue;
    }
    for (const titulo of extrairLinks(conteudo)) {
      const alvo = resolverTitulo(titulo, indiceTitulos);
      // Link pra ela mesma ou pra um título que não existe não é uma aresta.
      if (alvo && alvo !== caminho) arestas.push({ de: caminho, para: alvo });
    }
  }
  return arestas;
}

/** Notas que citam `[[NomeDestaNota]]` — a trilha inteira, pra desambiguar. */
export async function listarBacklinks(
  caminhoAlvo: string,
): Promise<{ caminho: string; titulo: string }[]> {
  const arestas = await todosOsLinks();
  const vistos = new Set<string>();
  const resultado: { caminho: string; titulo: string }[] = [];
  for (const aresta of arestas) {
    if (aresta.para !== caminhoAlvo || vistos.has(aresta.de)) continue;
    vistos.add(aresta.de);
    resultado.push({ caminho: aresta.de, titulo: tituloDe(aresta.de) });
  }
  return resultado.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

/** Nós (uma bolinha por página, na cor do caderno) e arestas, pro grafo. */
export async function listarGrafo(): Promise<{ nos: NoGrafo[]; arestas: { de: string; para: string }[] }> {
  const indice = await lerIndice();
  const arestas = await todosOsLinks();

  const nos: NoGrafo[] = Object.keys(indice.notas).map((caminho) => {
    const caderno = caminho.split("/")[0];
    return {
      caminho,
      titulo: tituloDe(caminho),
      cor: indice.pastas[caderno]?.cor || "#5b6a7f",
    };
  });

  return { nos, arestas };
}

/** Páginas que ninguém cita em `[[ ]]` — fácil de esquecer que existem. */
export async function listarOrfas(): Promise<{ caminho: string; titulo: string }[]> {
  const { nos, arestas } = await listarGrafo();
  const citadas = new Set(arestas.map((aresta) => aresta.para));
  return nos
    .filter((no) => !citadas.has(no.caminho))
    .map(({ caminho, titulo }) => ({ caminho, titulo }))
    .sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}
