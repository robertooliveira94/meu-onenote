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
  Comentario,
  ConfigQuadro,
  Estimativa,
  ExtrasDaTarefa,
  Indice,
  Prioridade,
  Quadro,
  Recorrencia,
  Subtarefa,
  TarefaArquivada,
  TarefaKanban,
} from "./tipos";

/** Pasta, dentro do quadro, onde as tarefas arquivadas moram — fora das colunas, mas ainda no quadro. */
export const PASTA_ARQUIVO = "_arquivo";

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
  return { colunas: [...COLUNAS_KANBAN_PADRAO], colunasConcluidas: ["Feito"] };
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
      // `colunaConcluida` (string) é o formato de antes de várias colunas
      // poderem contar como conclusão — vira um array de um item só na
      // primeira leitura, sem precisar reescrever o arquivo na hora.
      const lida = JSON.parse(await fs.readFile(caminhoCfg, "utf8")) as Partial<ConfigQuadro> & { colunaConcluida?: string };
      const colunasConcluidas = Array.isArray(lida.colunasConcluidas)
        ? lida.colunasConcluidas
        : lida.colunaConcluida
          ? [lida.colunaConcluida]
          : null;
      config =
        Array.isArray(lida.colunas) && lida.colunas.length > 0
          ? {
              colunas: lida.colunas,
              colunasConcluidas: colunasConcluidas ?? [lida.colunas[lida.colunas.length - 1]],
              ...(lida.wip ? { wip: lida.wip } : {}),
              ...(typeof lida.arquivarApos === "number" ? { arquivarApos: lida.arquivarApos } : {}),
            }
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

/** Uma tarefa a partir do caminho e do que o índice sabe dela. */
function montarTarefa(caminho: string, coluna: ColunaKanban, indice: Indice): TarefaKanban {
  const meta = indice.notas[caminho];
  const agora = new Date().toISOString();
  return {
    caminho,
    titulo: tituloDe(caminho),
    coluna,
    criadoEm: meta?.criadoEm ?? agora,
    atualizadoEm: meta?.atualizadoEm ?? agora,
    etiquetas: meta?.etiquetasKanban ?? [],
    favorita: meta?.favorita ?? false,
    dependeDe: meta?.dependeDe ?? [],
    prioridade: meta?.prioridadeKanban ?? null,
    prazo: meta?.prazoKanban ?? null,
    sprintId: meta?.sprintKanban ?? null,
    subtarefas: meta?.subtarefasKanban ?? [],
    comentarios: meta?.comentariosKanban ?? [],
    impedimento: meta?.impedimentoKanban ?? null,
    numero: meta?.numeroKanban ?? 0,
    movidoEm: meta?.movidoEm ?? meta?.criadoEm ?? agora,
    cor: meta?.corKanban ?? null,
    estimativa: meta?.estimativaKanban ?? null,
    recorrencia: meta?.recorrenciaKanban ?? null,
  };
}

/** O maior número já dado a uma tarefa deste quadro (arquivadas incluídas — número não se reusa). */
function maiorNumeroDoQuadro(indice: Indice, quadro: string): number {
  const prefixo = `${PASTA_KANBAN}/${quadro}/`;
  let maior = 0;
  for (const [caminho, entrada] of Object.entries(indice.notas)) {
    if (caminho.startsWith(prefixo) && (entrada.numeroKanban ?? 0) > maior) maior = entrada.numeroKanban!;
  }
  return maior;
}

/**
 * Tarefas de antes do identificador curto não têm número. Na primeira vez
 * que o quadro é listado, cada uma ganha o seu, na ordem em que foram
 * criadas — assim a numeração antiga fica estável dali em diante.
 */
async function numerarTarefasSemNumero(quadro: string, indice: Indice): Promise<boolean> {
  const prefixo = `${PASTA_KANBAN}/${quadro}/`;
  const semNumero = Object.entries(indice.notas)
    .filter(([caminho, entrada]) => caminho.startsWith(prefixo) && !entrada.numeroKanban && ehArquivoDeNota(nomeDe(caminho)))
    .sort(([, a], [, b]) => a.criadoEm.localeCompare(b.criadoEm));
  if (semNumero.length === 0) return false;
  await atualizarIndice((atual) => {
    let proximo = maiorNumeroDoQuadro(atual, quadro);
    for (const [caminho] of semNumero) {
      const entrada = atual.notas[caminho];
      if (entrada && !entrada.numeroKanban) entrada.numeroKanban = ++proximo;
    }
  });
  return true;
}

const DIAS_PARA_ARQUIVAR_PADRAO = 30;

/**
 * Arquiva sozinho o que está na coluna de conclusão há mais dias que o
 * limite do quadro. Só olha tarefas que têm `movidoEm` de verdade — as de
 * antes desse campo existir ficam onde estão até alguém arquivar à mão;
 * sumir com metade do "Feito" na primeira abertura seria um susto.
 */
async function arquivarVencidas(quadro: string, config: ConfigQuadro, indice: Indice): Promise<number> {
  const dias = config.arquivarApos ?? DIAS_PARA_ARQUIVAR_PADRAO;
  if (dias <= 0) return 0;
  const limite = Date.now() - dias * 86_400_000;
  const pastas = config.colunasConcluidas.map((coluna) => pastaDaColuna(quadro, coluna));
  let arquivadas = 0;
  for (const [caminho, entrada] of Object.entries(indice.notas)) {
    if (!pastas.some((pasta) => caminho.startsWith(`${pasta}/`)) || !entrada.movidoEm) continue;
    if (new Date(entrada.movidoEm).getTime() > limite) continue;
    if (!(await existe(resolverCaminho(caminho)))) continue;
    await arquivarTarefa(caminho);
    arquivadas++;
  }
  return arquivadas;
}

async function contarArquivadas(quadro: string): Promise<number> {
  try {
    const entradas = await fs.readdir(resolverCaminho(juntar(PASTA_KANBAN, quadro, PASTA_ARQUIVO)), { withFileTypes: true });
    return entradas.filter((entrada) => entrada.isFile() && ehArquivoDeNota(entrada.name)).length;
  } catch {
    return 0;
  }
}

/** Todas as tarefas do quadro, já separadas por coluna e na ordem manual. */
export async function listarQuadro(quadro: string): Promise<Quadro> {
  const config = await garantirQuadro(quadro);
  let indice = await lerIndice();
  if (await numerarTarefasSemNumero(quadro, indice)) indice = await lerIndice();
  if ((await arquivarVencidas(quadro, config, indice)) > 0) indice = await lerIndice();
  const arquivadas = await contarArquivadas(quadro);

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
      tarefas.push(montarTarefa(juntar(pasta, entrada.name), coluna, indice));
    }

    tarefas.sort(
      (a, b) =>
        (indice.notas[a.caminho]?.ordem ?? 0) - (indice.notas[b.caminho]?.ordem ?? 0) ||
        a.titulo.localeCompare(b.titulo, "pt-BR"),
    );
    tarefasPorColuna[coluna] = tarefas;
  }
  return { config, tarefas: tarefasPorColuna, arquivadas };
}

// ------------------------------------------------------------------ arquivo

/**
 * Arquivar tira a tarefa do quadro sem jogar fora: o arquivo vai para
 * `_kanban/<Quadro>/_arquivo/`, ainda dentro do quadro, com tudo que era
 * dela no índice. É histórico, não lixeira — dá para procurar e trazer de
 * volta. Sem isto o "Feito" engorda para sempre.
 */
export async function arquivarTarefa(caminho: string): Promise<string> {
  garantirForaDoSistema(caminho);
  const quadro = segmentos(caminho)[1];
  const pastaArquivo = juntar(PASTA_KANBAN, quadro, PASTA_ARQUIVO);
  await fs.mkdir(resolverCaminho(pastaArquivo), { recursive: true });
  const nome = await nomeDisponivel(pastaArquivo, tituloDe(caminho));
  const alvo = juntar(pastaArquivo, nome);

  await fs.rename(resolverCaminho(caminho), resolverCaminho(alvo));
  await atualizarIndice((indice) => {
    reapontar(indice, caminho, alvo);
    atualizarDependenciasApósMover(indice, caminho, alvo);
    entradaDaNota(indice, alvo).arquivadoEmKanban = new Date().toISOString();
  });
  return alvo;
}

/** Arquiva tudo que está numa coluna específica. Devolve quantas foram. */
export async function arquivarUmaColuna(quadro: string, coluna: string): Promise<number> {
  const pasta = pastaDaColuna(quadro, coluna);
  let entradas: Dirent[];
  try {
    entradas = await fs.readdir(resolverCaminho(pasta), { withFileTypes: true });
  } catch {
    return 0;
  }
  let quantas = 0;
  for (const entrada of entradas) {
    if (!entrada.isFile() || !ehArquivoDeNota(entrada.name)) continue;
    await arquivarTarefa(juntar(pasta, entrada.name));
    quantas++;
  }
  return quantas;
}

/** Arquiva tudo que está em qualquer coluna de conclusão. Devolve quantas foram. */
export async function arquivarConcluidas(quadro: string): Promise<number> {
  const config = await garantirQuadro(quadro);
  let quantas = 0;
  for (const coluna of config.colunasConcluidas) quantas += await arquivarUmaColuna(quadro, coluna);
  return quantas;
}

/** De volta ao quadro, na primeira coluna de conclusão (de onde a maioria sai). */
export async function desarquivarTarefa(caminho: string): Promise<string> {
  garantirForaDoSistema(caminho);
  const quadro = segmentos(caminho)[1];
  if (segmentos(caminho)[2] !== PASTA_ARQUIVO) throw new Error("Esta tarefa não está arquivada");
  const config = await garantirQuadro(quadro);
  const pastaDestino = pastaDaColuna(quadro, config.colunasConcluidas[0]);
  const nome = await nomeDisponivel(pastaDestino, tituloDe(caminho));
  const alvo = juntar(pastaDestino, nome);

  await fs.rename(resolverCaminho(caminho), resolverCaminho(alvo));
  await atualizarIndice((indice) => {
    reapontar(indice, caminho, alvo);
    atualizarDependenciasApósMover(indice, caminho, alvo);
    const entrada = entradaDaNota(indice, alvo);
    delete entrada.arquivadoEmKanban;
    entrada.movidoEm = new Date().toISOString();
  });
  return alvo;
}

/** As tarefas arquivadas do quadro, da mais recente para a mais antiga. */
export async function listarArquivadas(quadro: string): Promise<TarefaArquivada[]> {
  const pasta = juntar(PASTA_KANBAN, quadro, PASTA_ARQUIVO);
  let entradas: Dirent[];
  try {
    entradas = await fs.readdir(resolverCaminho(pasta), { withFileTypes: true });
  } catch {
    return [];
  }
  const indice = await lerIndice();
  const tarefas: TarefaArquivada[] = [];
  for (const entrada of entradas) {
    if (!entrada.isFile() || !ehArquivoDeNota(entrada.name)) continue;
    const caminho = juntar(pasta, entrada.name);
    const base = montarTarefa(caminho, PASTA_ARQUIVO, indice);
    tarefas.push({ ...base, arquivadoEm: indice.notas[caminho]?.arquivadoEmKanban ?? base.atualizadoEm });
  }
  return tarefas.sort((a, b) => b.arquivadoEm.localeCompare(a.arquivadoEm));
}

export async function criarTarefa(
  quadro: string,
  coluna: ColunaKanban,
  titulo: string,
  conteudoInicial = "",
  extras: ExtrasDaTarefa = {},
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
      numeroKanban: maiorNumeroDoQuadro(indice, quadro) + 1,
      movidoEm: agora,
      ...(extras.prioridade ? { prioridadeKanban: extras.prioridade } : {}),
      ...(extras.etiquetas?.length ? { etiquetasKanban: [...new Set(extras.etiquetas)] } : {}),
      ...(extras.prazo ? { prazoKanban: extras.prazo } : {}),
      ...(extras.sprintId ? { sprintKanban: extras.sprintId } : {}),
      ...(extras.estimativa ? { estimativaKanban: extras.estimativa } : {}),
    };
  });
  return caminho;
}

/** O prazo seguinte de uma tarefa que se repete: +1 dia, +7 dias ou +1 mês a partir do prazo (ou de hoje). */
function proximoPrazo(prazoAtual: string | undefined, recorrencia: Recorrencia): string {
  const base = prazoAtual ? new Date(`${prazoAtual}T00:00:00`) : new Date();
  const data = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  if (recorrencia === "diaria") data.setDate(data.getDate() + 1);
  else if (recorrencia === "semanal") data.setDate(data.getDate() + 7);
  else data.setMonth(data.getMonth() + 1);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/**
 * Uma tarefa que se repete acabou de ser concluída: nasce a próxima na
 * primeira coluna, com o prazo adiantado, mesmas etiquetas, prioridade,
 * estimativa e repetição — subtarefas desmarcadas, sem comentários. A
 * concluída fica onde está, como registro.
 */
async function gerarProximaOcorrencia(caminhoConcluida: string, quadro: string, config: ConfigQuadro): Promise<void> {
  const indice = await lerIndice();
  const entrada = indice.notas[caminhoConcluida];
  if (!entrada?.recorrenciaKanban) return;
  const conteudo = await fs.readFile(resolverCaminho(caminhoConcluida), "utf8").catch(() => "");
  const nova = await criarTarefa(quadro, config.colunas[0], tituloDe(caminhoConcluida), conteudo, {
    prioridade: entrada.prioridadeKanban ?? null,
    etiquetas: entrada.etiquetasKanban ?? [],
    prazo: proximoPrazo(entrada.prazoKanban, entrada.recorrenciaKanban),
    estimativa: entrada.estimativaKanban ?? null,
  });
  await atualizarIndice((atual) => {
    const criada = entradaDaNota(atual, nova);
    criada.recorrenciaKanban = entrada.recorrenciaKanban;
    if (entrada.subtarefasKanban?.length) {
      criada.subtarefasKanban = entrada.subtarefasKanban.map((item) => ({ ...item, id: crypto.randomUUID(), feita: false }));
    }
  });
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
    entradaDaNota(indice, alvo).movidoEm = new Date().toISOString();
  });
  if (config.colunasConcluidas.includes(colunaDestino)) await gerarProximaOcorrencia(alvo, quadro, config);
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

export async function definirCorDaTarefa(caminho: string, cor: string | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).corKanban = cor ?? undefined;
  });
}

export async function definirEstimativa(caminho: string, estimativa: Estimativa | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).estimativaKanban = estimativa ?? undefined;
  });
}

export async function definirRecorrencia(caminho: string, recorrencia: Recorrencia | null): Promise<void> {
  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).recorrenciaKanban = recorrencia ?? undefined;
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
 * Acrescenta um recado ao mural da tarefa — diferente da descrição, que é o
 * texto principal: aqui é histórico, cada entrada com seu horário, e não dá
 * para editar depois de escrita (só apagar). `texto` vazio não entra.
 */
export async function adicionarComentario(caminho: string, texto: string): Promise<Comentario | null> {
  const limpo = texto.trim().slice(0, 2000);
  if (!limpo) return null;
  const comentario: Comentario = { id: crypto.randomUUID(), texto: limpo, criadoEm: new Date().toISOString() };
  await atualizarIndice((indice) => {
    const entrada = entradaDaNota(indice, caminho);
    entrada.comentariosKanban = [...(entrada.comentariosKanban ?? []), comentario];
  });
  return comentario;
}

export async function excluirComentario(caminho: string, id: string): Promise<void> {
  await atualizarIndice((indice) => {
    const entrada = entradaDaNota(indice, caminho);
    entrada.comentariosKanban = (entrada.comentariosKanban ?? []).filter((item) => item.id !== id);
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
  config.colunasConcluidas = config.colunasConcluidas.map((coluna) => (coluna === nomeAtual ? limpo : coluna));
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
  config.colunasConcluidas = config.colunasConcluidas.filter((coluna) => coluna !== nome);
  // Sem nenhuma coluna de conclusão sobrando (era a única marcada), a
  // última coluna que restou assume — mesma regra de antes, generalizada.
  if (config.colunasConcluidas.length === 0) config.colunasConcluidas = [config.colunas[config.colunas.length - 1]];
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

/**
 * Liga ou desliga uma coluna como "concluída" (desbloqueia dependentes,
 * não atrasa, entra no arquivamento — ver `ConfigQuadro.colunasConcluidas`).
 * Mais de uma pode estar ligada ao mesmo tempo; a última não pode ser
 * desligada, senão o quadro fica sem nenhuma.
 */
export async function alternarColunaConcluida(quadro: string, nome: string): Promise<void> {
  const config = await garantirQuadro(quadro);
  if (!config.colunas.includes(nome)) throw new Error("Coluna não encontrada");
  const ligada = config.colunasConcluidas.includes(nome);
  if (ligada && config.colunasConcluidas.length <= 1) {
    throw new Error("O quadro precisa de pelo menos uma coluna de conclusão");
  }
  config.colunasConcluidas = ligada
    ? config.colunasConcluidas.filter((coluna) => coluna !== nome)
    : [...config.colunasConcluidas, nome];
  await salvarConfigQuadro(quadro, config);
}

/** Limite de WIP de uma coluna; `null` tira o limite. */
export async function definirLimiteWip(quadro: string, coluna: string, limite: number | null): Promise<void> {
  const config = await garantirQuadro(quadro);
  if (!config.colunas.includes(coluna)) throw new Error("Coluna não encontrada");
  const wip = { ...(config.wip ?? {}) };
  if (limite === null) delete wip[coluna];
  else wip[coluna] = limite;
  config.wip = Object.keys(wip).length > 0 ? wip : undefined;
  await salvarConfigQuadro(quadro, config);
}

/** Depois de quantos dias na coluna de conclusão a tarefa é arquivada sozinha (0 = nunca). */
export async function definirArquivarApos(quadro: string, dias: number): Promise<void> {
  const config = await garantirQuadro(quadro);
  config.arquivarApos = dias;
  await salvarConfigQuadro(quadro, config);
}

/** Uma tarefa achada pela paleta de comandos — só o que precisa pra listar e abrir o quadro. */
export type TarefaAchada = { caminho: string; titulo: string; quadro: string; coluna: string };

/** Sem acento e sem caixa — mesma normalização da busca de notas. */
function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Busca tarefas em todos os quadros pelo título — só pelo índice, sem abrir
 * arquivo: o título é o nome do arquivo, e o caminho já diz quadro e
 * coluna (`_kanban/<Quadro>/<Coluna>/<Tarefa>.md`). Usada pela paleta de
 * comandos; a busca de notas continua não vendo tarefa nenhuma.
 */
export async function buscarTarefas(termo: string, limite = 8): Promise<TarefaAchada[]> {
  const alvo = normalizarTexto(termo.trim());
  if (alvo.length < 2) return [];
  const indice = await lerIndice();
  const achadas: TarefaAchada[] = [];
  for (const caminho of Object.keys(indice.notas)) {
    if (!caminho.startsWith(`${PASTA_KANBAN}/`)) continue;
    const partes = caminho.split("/");
    if (partes.length !== 4 || partes[2] === PASTA_ARQUIVO) continue;
    const titulo = tituloDe(caminho);
    if (!normalizarTexto(titulo).includes(alvo)) continue;
    achadas.push({ caminho, titulo, quadro: partes[1], coluna: partes[2] });
    if (achadas.length >= limite) break;
  }
  return achadas;
}

/** Uma tarefa com prazo estourado ou vencendo hoje — o que o aviso do hub precisa mostrar. */
export type TarefaComPrazo = TarefaAchada & { prazo: string };

/** Uma tarefa na tela "Hoje": tudo que o cartão compacto mostra, mais o quadro de onde veio. */
export type TarefaAgendada = TarefaKanban & { quadro: string };

export type TarefasAgendadas = {
  atrasadas: TarefaAgendada[];
  hoje: TarefaAgendada[];
  /** Nos próximos 7 dias, depois de hoje. */
  semana: TarefaAgendada[];
  depois: TarefaAgendada[];
};

/**
 * Todas as tarefas com prazo, de todos os quadros, agrupadas em Atrasadas ·
 * Hoje · Esta semana · Depois — a tela que se abre de manhã. Ignora a coluna
 * de conclusão de cada quadro e o arquivo. `hoje` vem do navegador
 * (AAAA-MM-DD), pelo fuso da pessoa.
 */
export async function listarTarefasComPrazo(hoje: string): Promise<TarefasAgendadas> {
  const indice = await lerIndice();
  const configs = new Map<string, Promise<ConfigQuadro>>();
  const grupos: TarefasAgendadas = { atrasadas: [], hoje: [], semana: [], depois: [] };
  const limiteDaSemana = new Date(`${hoje}T00:00:00`);
  limiteDaSemana.setDate(limiteDaSemana.getDate() + 7);
  const fimDaSemana = limiteDaSemana.toISOString().slice(0, 10);

  for (const [caminho, meta] of Object.entries(indice.notas)) {
    const prazo = meta.prazoKanban;
    if (!prazo || !caminho.startsWith(`${PASTA_KANBAN}/`)) continue;
    const partes = caminho.split("/");
    if (partes.length !== 4) continue;
    const [, quadro, coluna] = partes;
    if (coluna === PASTA_ARQUIVO) continue;
    if (!configs.has(quadro)) configs.set(quadro, garantirQuadro(quadro));
    const config = await configs.get(quadro)!;
    if (config.colunasConcluidas.includes(coluna)) continue;
    const tarefa: TarefaAgendada = { ...montarTarefa(caminho, coluna, indice), quadro };
    if (prazo < hoje) grupos.atrasadas.push(tarefa);
    else if (prazo === hoje) grupos.hoje.push(tarefa);
    else if (prazo <= fimDaSemana) grupos.semana.push(tarefa);
    else grupos.depois.push(tarefa);
  }

  const porPrazo = (a: TarefaAgendada, b: TarefaAgendada) =>
    (a.prazo ?? "").localeCompare(b.prazo ?? "") || a.titulo.localeCompare(b.titulo, "pt-BR");
  for (const grupo of Object.values(grupos)) grupo.sort(porPrazo);
  return grupos;
}

/**
 * Tarefas de qualquer quadro com prazo até `hoje` (AAAA-MM-DD), separadas em
 * atrasadas (prazo antes de hoje) e as que vencem hoje. Só pelo índice — o
 * prazo já mora lá — e pulando o que está na coluna de conclusão do quadro,
 * porque tarefa feita não atrasa. A data vem do navegador para não depender
 * do fuso do processo.
 */
export async function tarefasComPrazoVencendo(
  hoje: string,
): Promise<{ atrasadas: TarefaComPrazo[]; vencemHoje: TarefaComPrazo[] }> {
  const indice = await lerIndice();
  const configs = new Map<string, Promise<ConfigQuadro>>();
  const atrasadas: TarefaComPrazo[] = [];
  const vencemHoje: TarefaComPrazo[] = [];

  for (const [caminho, meta] of Object.entries(indice.notas)) {
    const prazo = meta.prazoKanban;
    if (!prazo || prazo > hoje) continue;
    if (!caminho.startsWith(`${PASTA_KANBAN}/`)) continue;
    const partes = caminho.split("/");
    if (partes.length !== 4) continue;
    const [, quadro, coluna] = partes;
    if (coluna === PASTA_ARQUIVO) continue;
    if (!configs.has(quadro)) configs.set(quadro, garantirQuadro(quadro));
    const config = await configs.get(quadro)!;
    if (config.colunasConcluidas.includes(coluna)) continue;
    const tarefa: TarefaComPrazo = { caminho, titulo: tituloDe(caminho), quadro, coluna, prazo };
    (prazo < hoje ? atrasadas : vencemHoje).push(tarefa);
  }

  const porPrazo = (a: TarefaComPrazo, b: TarefaComPrazo) =>
    a.prazo.localeCompare(b.prazo) || a.titulo.localeCompare(b.titulo, "pt-BR");
  atrasadas.sort(porPrazo);
  vencemHoje.sort(porPrazo);
  return { atrasadas, vencemHoje };
}
