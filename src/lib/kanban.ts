import type { Dirent } from "node:fs";
import fs from "node:fs/promises";

import {
  PASTA_KANBAN,
  ehArquivoDeNota,
  garantirForaDoSistema,
  juntar,
  limparNome,
  nomeDe,
  pastaDe,
  resolverCaminho,
  segmentos,
  tituloDe,
} from "./caminhos";
import { enviarParaLixeira } from "./lixeira";
import { atualizarIndice, entradaDaNota, lerIndice, reapontar } from "./indice";
import { COLUNAS_KANBAN } from "./tipos";
import type { ColunaKanban, Indice, Quadro, TarefaKanban } from "./tipos";

/**
 * O quadro Kanban de um caderno — independente das anotações, mas do mesmo
 * jeito que elas: cada tarefa é um arquivo `.md` de verdade, e cada coluna é
 * uma pasta (`<Caderno>/_kanban/<Coluna>/`). Arrastar uma tarefa entre
 * colunas é literalmente mover o arquivo de pasta.
 *
 * As tarefas continuam entrando no índice geral (`_sistema/indice.json`,
 * mesma `entradaDaNota` das páginas) — ganham etiqueta, favorito e ordem de
 * graça, e aparecem na busca global. Só ficam de fora do painel `/tarefas`
 * (que já é sobre isso) e da árvore de seções (automático: `_kanban` começa
 * com "_", igual a `_sistema`).
 *
 * As funções aqui não passam pelas de `arquivos.ts` (criarNota, moverItem)
 * de propósito: aquelas existem para proteger a hierarquia fixa de páginas
 * (sempre dentro de uma seção, profundidade 2) — a hierarquia do Kanban é
 * outra (sempre dentro de uma coluna fixa, profundidade 3), então tem sua
 * própria validação, sem afrouxar a das páginas.
 */

function pastaDaColuna(caderno: string, coluna: ColunaKanban): string {
  return juntar(caderno, PASTA_KANBAN, coluna);
}

/** Cria as 4 pastas de coluna se ainda não existirem — idempotente. */
export async function garantirQuadro(caderno: string): Promise<void> {
  for (const coluna of COLUNAS_KANBAN) {
    await fs.mkdir(resolverCaminho(pastaDaColuna(caderno, coluna)), { recursive: true });
  }
}

async function existe(absoluto: string): Promise<boolean> {
  try {
    await fs.access(absoluto);
    return true;
  } catch {
    return false;
  }
}

/** Acha um nome livre acrescentando " 2", " 3"... quando já existe. */
async function nomeDisponivel(pasta: string, base: string): Promise<string> {
  let tentativa = `${base}.md`;
  let contador = 2;
  while (await existe(resolverCaminho(juntar(pasta, tentativa)))) {
    tentativa = `${base} ${contador}.md`;
    contador += 1;
  }
  return tentativa;
}

/**
 * Quando uma tarefa muda de caminho (mover ou renomear), qualquer outra
 * tarefa que dependia dela (`dependeDe`) ficaria apontando para um arquivo
 * que não existe mais. Corrige a referência em todo mundo que dependia.
 */
function atualizarDependenciasApósMover(indice: Indice, de: string, para: string): void {
  for (const entrada of Object.values(indice.notas)) {
    if (!entrada.dependeDe?.includes(de)) continue;
    entrada.dependeDe = entrada.dependeDe.map((caminho) => (caminho === de ? para : caminho));
  }
}

/** Todas as tarefas do caderno, já separadas por coluna e na ordem manual. */
export async function listarQuadro(caderno: string): Promise<Quadro> {
  await garantirQuadro(caderno);
  const indice = await lerIndice();

  const resultado = {} as Quadro;
  for (const coluna of COLUNAS_KANBAN) {
    const pasta = pastaDaColuna(caderno, coluna);
    let entradas: Dirent[];
    try {
      entradas = await fs.readdir(resolverCaminho(pasta), { withFileTypes: true });
    } catch {
      entradas = [];
    }

    const tarefas: TarefaKanban[] = [];
    for (const entrada of entradas) {
      if (!entrada.isFile() || !ehArquivoDeNota(entrada.name)) continue;
      const caminho = juntar(pasta, entrada.name);
      const meta = indice.notas[caminho];
      tarefas.push({
        caminho,
        titulo: tituloDe(caminho),
        coluna,
        criadoEm: meta?.criadoEm ?? new Date().toISOString(),
        atualizadoEm: meta?.atualizadoEm ?? new Date().toISOString(),
        etiquetas: meta?.etiquetasKanban ?? [],
        favorita: meta?.favorita ?? false,
        dependeDe: meta?.dependeDe ?? [],
      });
    }

    tarefas.sort(
      (a, b) =>
        (indice.notas[a.caminho]?.ordem ?? 0) - (indice.notas[b.caminho]?.ordem ?? 0) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
    resultado[coluna] = tarefas;
  }
  return resultado;
}

export async function criarTarefa(
  caderno: string,
  coluna: ColunaKanban,
  titulo: string,
  conteudoInicial = "",
): Promise<string> {
  await garantirQuadro(caderno);
  const pasta = pastaDaColuna(caderno, coluna);
  const base = limparNome(titulo) || "Nova tarefa";
  const nome = await nomeDisponivel(pasta, base);
  const caminho = juntar(pasta, nome);

  await fs.writeFile(resolverCaminho(caminho), conteudoInicial, "utf8");
  await atualizarIndice((indice) => {
    const agora = new Date().toISOString();
    indice.notas[caminho] = {
      etiquetas: [],
      favorita: false,
      criadoEm: agora,
      atualizadoEm: agora,
      ordem: Date.now(),
    };
  });
  return caminho;
}

export async function lerTarefa(caminho: string): Promise<{ titulo: string; conteudo: string } | null> {
  try {
    const conteudo = await fs.readFile(resolverCaminho(caminho), "utf8");
    return { titulo: tituloDe(caminho), conteudo };
  } catch {
    return null;
  }
}

export async function salvarTarefa(caminho: string, conteudo: string): Promise<void> {
  garantirForaDoSistema(caminho);
  await fs.writeFile(resolverCaminho(caminho), conteudo, "utf8");
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).atualizadoEm = new Date().toISOString();
  });
}

export async function renomearTarefa(caminho: string, novoTitulo: string): Promise<string> {
  garantirForaDoSistema(caminho);
  const limpo = limparNome(novoTitulo);
  if (!limpo) throw new Error("Informe um nome");

  const pasta = pastaDe(caminho);
  const alvo = juntar(pasta, `${limpo}.md`);
  if (alvo === caminho) return caminho;
  if (await existe(resolverCaminho(alvo))) throw new Error("Já existe uma tarefa com esse nome aqui");

  await fs.rename(resolverCaminho(caminho), resolverCaminho(alvo));
  await atualizarIndice((indice) => {
    reapontar(indice, caminho, alvo);
    atualizarDependenciasApósMover(indice, caminho, alvo);
  });
  return alvo;
}

/** Move a tarefa para outra coluna do mesmo caderno — arrastar entre áreas do quadro. */
export async function moverTarefa(caminho: string, colunaDestino: ColunaKanban): Promise<string> {
  garantirForaDoSistema(caminho);
  const caderno = segmentos(caminho)[0];
  const pastaDestino = pastaDaColuna(caderno, colunaDestino);
  await fs.mkdir(resolverCaminho(pastaDestino), { recursive: true });

  const alvo = juntar(pastaDestino, nomeDe(caminho));
  if (alvo === caminho) return caminho;
  if (await existe(resolverCaminho(alvo))) throw new Error("Já existe uma tarefa com esse nome na coluna de destino");

  await fs.rename(resolverCaminho(caminho), resolverCaminho(alvo));
  await atualizarIndice((indice) => {
    reapontar(indice, caminho, alvo);
    atualizarDependenciasApósMover(indice, caminho, alvo);
  });
  return alvo;
}

/** Regrava a ordem de todas as tarefas de uma coluna de uma vez — usado ao soltar um arraste. */
export async function reordenarTarefasPara(ordemDosCaminhos: string[]): Promise<void> {
  await atualizarIndice((indice) => {
    ordemDosCaminhos.forEach((caminho, posicao) => {
      entradaDaNota(indice, caminho).ordem = posicao;
    });
  });
}

/** Manda para a mesma lixeira das notas — reaproveitada como está, sem nada específico de Kanban. */
export async function excluirTarefa(caminho: string): Promise<void> {
  await enviarParaLixeira(caminho);
}

export async function definirEtiquetasDaTarefa(caminho: string, etiquetas: string[]): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).etiquetasKanban = [...new Set(etiquetas)];
  });
}

/**
 * `dependeDe` são caminhos de outras tarefas que bloqueiam esta — ela só
 * pode entrar em "Feito" quando todas elas já estiverem lá. Recusa depender
 * dela mesma; não faz uma varredura completa atrás de ciclo mais longo
 * (A depende de B, que depende de A de novo por um caminho indireto) —
 * na prática, com quadros pequenos, o próprio "Bloqueado por" já deixa
 * isso bem visível na hora de escolher.
 */
export async function definirDependencias(caminho: string, dependeDe: string[]): Promise<void> {
  const limpas = [...new Set(dependeDe)].filter((item) => item !== caminho);
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).dependeDe = limpas;
  });
}
