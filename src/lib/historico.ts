import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ, extensaoDe } from "./caminhos";
import type { VersaoHistorico } from "./tipos";

/**
 * Rede de segurança do salvamento automático: antes de gravar por cima de uma
 * nota, a versão anterior vem parar aqui. Como o app salva sozinho enquanto se
 * digita, guardar toda gravação encheria o disco de lixo — então só guardamos
 * uma versão a cada 3 minutos de edição, e mantemos as 20 últimas.
 */
const PASTA_HISTORICO = path.join(RAIZ, PASTA_SISTEMA, "historico");
const JANELA_MS = 3 * 60 * 1000;
const MAXIMO_VERSOES = 20;

/** "Pessoal/Financeiro/orcamento.md" → "Pessoal~Financeiro~orcamento.md" */
function chaveDe(caminho: string): string {
  return caminho.replace(/\//g, "~");
}

function pastaDaNota(caminho: string): string {
  return path.join(PASTA_HISTORICO, chaveDe(caminho));
}

async function versoesOrdenadas(caminho: string): Promise<VersaoHistorico[]> {
  let arquivos: string[];
  try {
    arquivos = await fs.readdir(pastaDaNota(caminho));
  } catch {
    return [];
  }
  const versoes: VersaoHistorico[] = [];
  for (const arquivo of arquivos) {
    const milissegundos = Number(arquivo.slice(0, arquivo.lastIndexOf(".")));
    if (!Number.isFinite(milissegundos)) continue;
    let tamanho = 0;
    try {
      tamanho = (await fs.stat(path.join(pastaDaNota(caminho), arquivo))).size;
    } catch {
      continue;
    }
    versoes.push({ id: arquivo, salvaEm: new Date(milissegundos).toISOString(), tamanho });
  }
  // Mais recente primeiro.
  return versoes.sort((a, b) => b.salvaEm.localeCompare(a.salvaEm));
}

export async function listarVersoes(caminho: string): Promise<VersaoHistorico[]> {
  return versoesOrdenadas(caminho);
}

/**
 * Guarda o conteúdo anterior de uma nota. `forcar` ignora a janela de 3
 * minutos — usado antes de restaurar uma versão antiga, para que o texto atual
 * nunca se perca.
 */
export async function registrarVersao(
  caminho: string,
  conteudoAnterior: string,
  forcar = false,
): Promise<void> {
  const versoes = await versoesOrdenadas(caminho);
  if (!forcar && versoes.length > 0) {
    const idadeDaUltima = Date.now() - new Date(versoes[0].salvaEm).getTime();
    if (idadeDaUltima < JANELA_MS) return;
  }

  const pasta = pastaDaNota(caminho);
  await fs.mkdir(pasta, { recursive: true });
  const extensao = extensaoDe(caminho) || "txt";
  await fs.writeFile(path.join(pasta, `${Date.now()}.${extensao}`), conteudoAnterior, "utf8");

  const sobrando = (await versoesOrdenadas(caminho)).slice(MAXIMO_VERSOES);
  for (const velha of sobrando) {
    await fs.rm(path.join(pasta, velha.id), { force: true });
  }
}

export async function lerVersao(caminho: string, id: string): Promise<string | null> {
  // O id vem da interface: só aceitamos o nome de arquivo puro.
  if (id.includes("/") || id.includes("\\") || id.includes("..")) return null;
  try {
    return await fs.readFile(path.join(pastaDaNota(caminho), id), "utf8");
  } catch {
    return null;
  }
}

/** Acompanha a nota quando ela é renomeada ou movida. */
export async function moverHistorico(de: string, para: string): Promise<void> {
  try {
    await fs.rename(pastaDaNota(de), pastaDaNota(para));
  } catch {
    // Sem histórico ainda: nada a mover.
  }
}

export async function apagarHistorico(caminho: string): Promise<void> {
  await fs.rm(pastaDaNota(caminho), { recursive: true, force: true });
}
