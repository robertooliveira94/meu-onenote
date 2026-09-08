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
import type {
  ColunaKanban,
  ConfigQuadro,
  Indice,
  Prioridade,
  Quadro,
  Subtarefa,
  TarefaKanban,
} from "./tipos";

/**
 * O conteúdo de um quadro Kanban. O Kanban é uma aplicação à parte das
 * anotações, com quadros próprios (ver `quadros.ts`) que não têm nada a ver
 * com os cadernos: cada quadro é uma pasta em `_kanban/<Quadro>/`, cada
 * coluna é uma subpasta e cada tarefa é um arquivo `.md` de verdade.
 * Arrastar uma tarefa entre colunas é literalmente mover o arquivo de pasta.
 * As colunas são configuráveis por quadro (`config.json` dentro dele): todo
 * quadro novo nasce com Backlog/Fazendo/Impedido/Feito, mas dá pra criar,
 * renomear, reordenar e excluir coluna (só vazia).
 *
 * As tarefas continuam entrando no índice geral (`_sistema/indice.json`,
 * mesma `entradaDaNota` das páginas) — ganham favorito, ordem e histórico de
 * datas de graça. Ficam de fora do que é das Anotações (busca, recentes,
 * painel `/tarefas`, árvore de cadernos), porque são de outra aplicação.
 *
 * As funções aqui não passam pelas de `arquivos.ts` (criarNota, moverItem)
 * de propósito: aquelas existem para proteger a hierarquia fixa de páginas
 * (sempre dentro de uma seção, profundidade 2) — a hierarquia do Kanban é
 * outra, então tem sua própria validação, sem afrouxar a das páginas.
 */

function pastaDaColuna(quadro: string, coluna: ColunaKanban): string {
  return juntar(PASTA_KANBAN, quadro, coluna);
}

function caminhoConfig(quadro: string): string {
  return juntar(PASTA_KANBAN, quadro, "config.json");
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

async function salvarConfigQuadro(quadro: string, config: ConfigQuadro): Promise<void> {
  await fs.mkdir(resolverCaminho(juntar(PASTA_KANBAN, quadro)), { recursive: true });
  await fs.writeFile(resolverCaminho(caminhoConfig(quadro)), JSON.stringify(config, null, 2), "utf8");
}

async function garantirPastasDasColunas(quadro: string, config: ConfigQuadro): Promise<void> {
  for (const coluna of config.colunas) {
    await fs.mkdir(resolverCaminho(pastaDaColuna(quadro, coluna)), { recursive: true });
  }
}

/**
 * Garante que o quadro existe (arquivo de configuração + pastas de coluna)
 * e devolve a configuração atual — cria com o padrão de 4 colunas na
 * primeira vez que este quadro é aberto.
 */
export async function garantirQuadro(quadro: string): Promise<ConfigQuadro> {
  const caminhoCfg = resolverCaminho(caminhoConfig(quadro));
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
    await salvarConfigQuadro(quadro, config);
  }
  await garantirPastasDasColunas(quadro, config);
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

/** Todas as tarefas do quadro, já separadas por coluna e na ordem manual. */
export async function listarQuadro(quadro: string): Promise<Quadro> {
  const config = await garantirQuadro(quadro);
  const indice = await lerIndice();

  const tarefasPorColuna: Record<string, TarefaKanban[]> = {};
  for (const coluna of config.colunas) {
    const pasta = pastaDaColuna(quadro, coluna);
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
        subtarefas: meta?.subtarefasKanban ?? [],
        impedimento: meta?.impedimentoKanban ?? null,
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
  quadro: string,
  coluna: ColunaKanban,
  titulo: string,
  conteudoInicial = "",
): Promise<string> {
  const config = await garantirQuadro(quadro);
  if (!config.colunas.includes(coluna)) throw new Error("Coluna não existe");
  const pasta = pastaDaColuna(quadro, coluna);
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

/** Move a tarefa para outra coluna do mesmo quadro — arrastar entre áreas do quadro. */
export async function moverTarefa(caminho: string, colunaDestino: ColunaKanban): Promise<string> {
  garantirForaDoSistema(caminho);
  // "_kanban/<Quadro>/<Coluna>/<Tarefa>.md" — o quadro é o 2º segmento.
  const quadro = segmentos(caminho)[1];
  const config = await garantirQuadro(quadro);
  if (!config.colunas.includes(colunaDestino)) throw new Error("Coluna de destino não existe");
  const pastaDestino = pastaDaColuna(quadro, colunaDestino);

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
      subtarefasKanban: original?.subtarefasKanban?.map((item) => ({ ...item })),
      // `impedimentoKanban` fica de fora junto com `dependeDe`: o que
      // travava a original não trava automaticamente a cópia.
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

/**
 * A checklist da tarefa. Fica no índice, e não no corpo em markdown, de
 * propósito: o corpo é texto livre de quem escreve, e o cartão precisa
 * contar "2/5" sem depender de a pessoa ter escrito as caixinhas num
 * formato específico lá dentro.
 */
export async function definirSubtarefas(caminho: string, subtarefas: Subtarefa[]): Promise<void> {
  const limpas = subtarefas
    .map((item) => ({ id: item.id, texto: item.texto.trim().slice(0, 200), feita: Boolean(item.feita) }))
    .filter((item) => item.texto.length > 0);
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).subtarefasKanban = limpas;
  });
}

/**
 * Marca a tarefa como impedida, com o motivo — `null` destrava. É diferente
 * de "depende de outra tarefa": aqui o bloqueio é externo (esperando
 * terceiro, faltando informação), e por isso aparece escrito no cartão.
 */
export async function definirImpedimento(caminho: string, motivo: string | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).impedimentoKanban = motivo === null ? undefined : motivo.trim().slice(0, 200);
  });
}

// ------------------------------------------------------------------ colunas

function limparNomeColuna(nome: string): string {
  return nome.trim().replace(/[/\\]/g, "-").slice(0, 40);
}

export async function criarColuna(quadro: string, nome: string): Promise<void> {
  const config = await garantirQuadro(quadro);
  const limpo = limparNomeColuna(nome);
  if (!limpo) throw new Error("Dê um nome para a coluna");
  if (config.colunas.some((coluna) => coluna.toLowerCase() === limpo.toLowerCase())) {
    throw new Error("Já existe uma coluna com esse nome");
  }
  config.colunas.push(limpo);
  await fs.mkdir(resolverCaminho(pastaDaColuna(quadro, limpo)), { recursive: true });
  await salvarConfigQuadro(quadro, config);
}

export async function renomearColuna(quadro: string, nomeAtual: string, novoNome: string): Promise<void> {
  const config = await garantirQuadro(quadro);
  const limpo = limparNomeColuna(novoNome);
  if (!limpo) throw new Error("Dê um nome para a coluna");
  if (limpo === nomeAtual) return;
  if (!config.colunas.includes(nomeAtual)) throw new Error("Coluna não encontrada");
  if (config.colunas.some((coluna) => coluna.toLowerCase() === limpo.toLowerCase())) {
    throw new Error("Já existe uma coluna com esse nome");
  }

  const pastaAntiga = pastaDaColuna(quadro, nomeAtual);
  const pastaNova = pastaDaColuna(quadro, limpo);
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
  await salvarConfigQuadro(quadro, config);
}

/** Só deixa excluir coluna vazia — evita apagar tarefa por engano ao mexer na estrutura do quadro. */
export async function excluirColuna(quadro: string, nome: string): Promise<void> {
  const config = await garantirQuadro(quadro);
  if (config.colunas.length <= 1) throw new Error("O quadro precisa ter pelo menos uma coluna");
  if (!config.colunas.includes(nome)) throw new Error("Coluna não encontrada");

  const pasta = pastaDaColuna(quadro, nome);
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
  await salvarConfigQuadro(quadro, config);
}

export async function reordenarColunas(quadro: string, novaOrdem: string[]): Promise<void> {
  const config = await garantirQuadro(quadro);
  const mesmoConjunto =
    novaOrdem.length === config.colunas.length && novaOrdem.every((coluna) => config.colunas.includes(coluna));
  if (!mesmoConjunto) throw new Error("A lista de colunas não bate com o quadro atual");
  config.colunas = novaOrdem;
  await salvarConfigQuadro(quadro, config);
}

/** Qual coluna conta como "concluída" pro bloqueio de dependências ("Bloqueado por"). */
export async function definirColunaConcluida(quadro: string, nome: string): Promise<void> {
  const config = await garantirQuadro(quadro);
  if (!config.colunas.includes(nome)) throw new Error("Coluna não encontrada");
  config.colunaConcluida = nome;
  await salvarConfigQuadro(quadro, config);
}
