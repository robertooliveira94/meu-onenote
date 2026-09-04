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
import { COLUNAS_KANBAN_PADRAO } from "./tipos";
import type { ColunaKanban, ConfigQuadro, Indice, Prioridade, Quadro, TarefaKanban } from "./tipos";

/**
 * O quadro Kanban de um caderno — independente das anotações, mas do mesmo
 * jeito que elas: cada tarefa é um arquivo `.md` de verdade, e cada coluna é
 * uma pasta (`<Caderno>/_kanban/<Coluna>/`). Arrastar uma tarefa entre
 * colunas é literalmente mover o arquivo de pasta. As colunas em si são
 * configuráveis por caderno (`config.json` dentro de `_kanban/`): todo
 * quadro novo nasce com Backlog/Fazendo/Impedido/Feito, mas dá pra criar,
 * renomear, reordenar e excluir coluna (só vazia).
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
 * outra (sempre dentro de uma coluna, profundidade 3), então tem sua
 * própria validação, sem afrouxar a das páginas.
 */

function pastaDaColuna(caderno: string, coluna: ColunaKanban): string {
  return juntar(caderno, PASTA_KANBAN, coluna);
}

function caminhoConfig(caderno: string): string {
  return juntar(caderno, PASTA_KANBAN, "config.json");
}

function configPadrao(): ConfigQuadro {
  return { colunas: [...COLUNAS_KANBAN_PADRAO], colunaConcluida: "Feito" };
}

async function existe(absoluto: string): Promise<boolean> {
  try {
    await fs.access(absoluto);
    return true;
  } catch {
    return false;
  }
}

async function salvarConfigQuadro(caderno: string, config: ConfigQuadro): Promise<void> {
  await fs.mkdir(resolverCaminho(juntar(caderno, PASTA_KANBAN)), { recursive: true });
  await fs.writeFile(resolverCaminho(caminhoConfig(caderno)), JSON.stringify(config, null, 2), "utf8");
}

async function garantirPastasDasColunas(caderno: string, config: ConfigQuadro): Promise<void> {
  for (const coluna of config.colunas) {
    await fs.mkdir(resolverCaminho(pastaDaColuna(caderno, coluna)), { recursive: true });
  }
}

/**
 * Garante que o quadro do caderno existe (arquivo de configuração + pastas
 * de coluna) e devolve a configuração atual — cria com o padrão de 4
 * colunas na primeira vez que o quadro deste caderno é aberto.
 */
export async function garantirQuadro(caderno: string): Promise<ConfigQuadro> {
  const caminhoCfg = resolverCaminho(caminhoConfig(caderno));
  let config: ConfigQuadro;
  if (await existe(caminhoCfg)) {
    try {
      const lida = JSON.parse(await fs.readFile(caminhoCfg, "utf8")) as Partial<ConfigQuadro>;
      config =
        Array.isArray(lida.colunas) && lida.colunas.length > 0
          ? { colunas: lida.colunas, colunaConcluida: lida.colunaConcluida ?? lida.colunas[lida.colunas.length - 1] }
          : configPadrao();
    } catch {
      config = configPadrao();
    }
  } else {
    config = configPadrao();
    await salvarConfigQuadro(caderno, config);
  }
  await garantirPastasDasColunas(caderno, config);
  return config;
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
 * Quando uma tarefa muda de caminho (mover, renomear ou a coluna dela ser
 * renomeada), qualquer outra tarefa que dependia dela (`dependeDe`) ficaria
 * apontando para um arquivo que não existe mais. Corrige a referência em
 * todo mundo que dependia.
 */
function atualizarDependenciasApósMover(indice: Indice, de: string, para: string): void {
  for (const entrada of Object.values(indice.notas)) {
    if (!entrada.dependeDe?.includes(de)) continue;
    entrada.dependeDe = entrada.dependeDe.map((caminho) => (caminho === de ? para : caminho));
  }
}

/** Todas as tarefas do caderno, já separadas por coluna e na ordem manual. */
export async function listarQuadro(caderno: string): Promise<Quadro> {
  const config = await garantirQuadro(caderno);
  const indice = await lerIndice();

  const tarefasPorColuna: Record<string, TarefaKanban[]> = {};
  for (const coluna of config.colunas) {
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
        prioridade: meta?.prioridadeKanban ?? null,
        prazo: meta?.prazoKanban ?? null,
        sprintId: meta?.sprintKanban ?? null,
      });
    }

    tarefas.sort(
      (a, b) =>
        (indice.notas[a.caminho]?.ordem ?? 0) - (indice.notas[b.caminho]?.ordem ?? 0) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
    tarefasPorColuna[coluna] = tarefas;
  }
  return { config, tarefas: tarefasPorColuna };
}

export async function criarTarefa(
  caderno: string,
  coluna: ColunaKanban,
  titulo: string,
  conteudoInicial = "",
): Promise<string> {
  const config = await garantirQuadro(caderno);
  if (!config.colunas.includes(coluna)) throw new Error("Coluna não existe");
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
  const config = await garantirQuadro(caderno);
  if (!config.colunas.includes(colunaDestino)) throw new Error("Coluna de destino não existe");
  const pastaDestino = pastaDaColuna(caderno, colunaDestino);

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

/** Cria uma cópia da tarefa na mesma coluna — etiqueta, prioridade e prazo vêm junto; dependências, não. */
export async function duplicarTarefa(caminho: string): Promise<string> {
  garantirForaDoSistema(caminho);
  const conteudo = await fs.readFile(resolverCaminho(caminho), "utf8");
  const pasta = pastaDe(caminho);
  const base = limparNome(`${tituloDe(caminho)} cópia`) || "Tarefa cópia";
  const nome = await nomeDisponivel(pasta, base);
  const alvo = juntar(pasta, nome);

  await fs.writeFile(resolverCaminho(alvo), conteudo, "utf8");
  await atualizarIndice((indice) => {
    const original = indice.notas[caminho];
    const agora = new Date().toISOString();
    indice.notas[alvo] = {
      etiquetas: [],
      favorita: false,
      criadoEm: agora,
      atualizadoEm: agora,
      ordem: Date.now(),
      etiquetasKanban: original?.etiquetasKanban ? [...original.etiquetasKanban] : undefined,
      prioridadeKanban: original?.prioridadeKanban,
      prazoKanban: original?.prazoKanban,
      sprintKanban: original?.sprintKanban,
      // dependeDe fica de fora de propósito: é uma relação da tarefa
      // original, a cópia não deveria nascer bloqueada por causa dela.
    };
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
 * pode entrar na coluna de conclusão quando todas elas já estiverem lá.
 * Recusa depender dela mesma; não faz uma varredura completa atrás de ciclo
 * mais longo (A depende de B, que depende de A de novo por um caminho
 * indireto) — na prática, com quadros pequenos, o próprio "Bloqueado por"
 * já deixa isso bem visível na hora de escolher.
 */
export async function definirDependencias(caminho: string, dependeDe: string[]): Promise<void> {
  const limpas = [...new Set(dependeDe)].filter((item) => item !== caminho);
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).dependeDe = limpas;
  });
}

export async function definirPrioridade(caminho: string, prioridade: Prioridade | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).prioridadeKanban = prioridade ?? undefined;
  });
}

/** `prazo` no formato "AAAA-MM-DD", ou `null` para tirar o prazo. */
export async function definirPrazo(caminho: string, prazo: string | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).prazoKanban = prazo ?? undefined;
  });
}

export async function definirSprintDaTarefa(caminho: string, sprintId: string | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).sprintKanban = sprintId ?? undefined;
  });
}

// ------------------------------------------------------------------ colunas

function limparNomeColuna(nome: string): string {
  return nome.trim().replace(/[/\\]/g, "-").slice(0, 40);
}

export async function criarColuna(caderno: string, nome: string): Promise<void> {
  const config = await garantirQuadro(caderno);
  const limpo = limparNomeColuna(nome);
  if (!limpo) throw new Error("Dê um nome para a coluna");
  if (config.colunas.some((coluna) => coluna.toLowerCase() === limpo.toLowerCase())) {
    throw new Error("Já existe uma coluna com esse nome");
  }
  config.colunas.push(limpo);
  await fs.mkdir(resolverCaminho(pastaDaColuna(caderno, limpo)), { recursive: true });
  await salvarConfigQuadro(caderno, config);
}

export async function renomearColuna(caderno: string, nomeAtual: string, novoNome: string): Promise<void> {
  const config = await garantirQuadro(caderno);
  const limpo = limparNomeColuna(novoNome);
  if (!limpo) throw new Error("Dê um nome para a coluna");
  if (limpo === nomeAtual) return;
  if (!config.colunas.includes(nomeAtual)) throw new Error("Coluna não encontrada");
  if (config.colunas.some((coluna) => coluna.toLowerCase() === limpo.toLowerCase())) {
    throw new Error("Já existe uma coluna com esse nome");
  }

  const pastaAntiga = pastaDaColuna(caderno, nomeAtual);
  const pastaNova = pastaDaColuna(caderno, limpo);
  await fs.rename(resolverCaminho(pastaAntiga), resolverCaminho(pastaNova));

  await atualizarIndice((indice) => {
    const prefixo = `${pastaAntiga}/`;
    const caminhosDeTarefas = Object.keys(indice.notas).filter((caminho) => caminho.startsWith(prefixo));
    for (const de of caminhosDeTarefas) {
      const para = pastaNova + de.slice(pastaAntiga.length);
      atualizarDependenciasApósMover(indice, de, para);
    }
    reapontar(indice, pastaAntiga, pastaNova);
  });

  config.colunas = config.colunas.map((coluna) => (coluna === nomeAtual ? limpo : coluna));
  if (config.colunaConcluida === nomeAtual) config.colunaConcluida = limpo;
  await salvarConfigQuadro(caderno, config);
}

/** Só deixa excluir coluna vazia — evita apagar tarefa por engano ao mexer na estrutura do quadro. */
export async function excluirColuna(caderno: string, nome: string): Promise<void> {
  const config = await garantirQuadro(caderno);
  if (config.colunas.length <= 1) throw new Error("O quadro precisa ter pelo menos uma coluna");
  if (!config.colunas.includes(nome)) throw new Error("Coluna não encontrada");

  const pasta = pastaDaColuna(caderno, nome);
  let entradas: Dirent[] = [];
  try {
    entradas = await fs.readdir(resolverCaminho(pasta), { withFileTypes: true });
  } catch {
    entradas = [];
  }
  if (entradas.some((entrada) => entrada.isFile() && ehArquivoDeNota(entrada.name))) {
    throw new Error("Mova ou exclua as tarefas desta coluna antes de excluí-la");
  }

  await fs.rm(resolverCaminho(pasta), { recursive: true, force: true });
  config.colunas = config.colunas.filter((coluna) => coluna !== nome);
  if (config.colunaConcluida === nome) config.colunaConcluida = config.colunas[config.colunas.length - 1];
  await salvarConfigQuadro(caderno, config);
}

export async function reordenarColunas(caderno: string, novaOrdem: string[]): Promise<void> {
  const config = await garantirQuadro(caderno);
  const mesmoConjunto =
    novaOrdem.length === config.colunas.length && novaOrdem.every((coluna) => config.colunas.includes(coluna));
  if (!mesmoConjunto) throw new Error("A lista de colunas não bate com o quadro atual");
  config.colunas = novaOrdem;
  await salvarConfigQuadro(caderno, config);
}

/** Qual coluna conta como "concluída" pro bloqueio de dependências ("Bloqueado por"). */
export async function definirColunaConcluida(caderno: string, nome: string): Promise<void> {
  const config = await garantirQuadro(caderno);
  if (!config.colunas.includes(nome)) throw new Error("Coluna não encontrada");
  config.colunaConcluida = nome;
  await salvarConfigQuadro(caderno, config);
}
