"use client";

import clsx from "clsx";
import {
  Archive,
  Calendar,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ChevronsLeftRight,
  Gauge,
  CheckCheck,
  KanbanSquare,
  CalendarDays,
  List,
  Copy,
  Flag,
  FlagOff,
  GripVertical,
  ListChecks,
  Lock,
  Maximize2,
  MessageSquare,
  Minimize2,
  MoreHorizontal,
  OctagonAlert,
  Pencil,
  Plus,
  Repeat,
  Send,
  Settings2,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { acaoAlternarFavorita } from "@/app/acoes";
import {
  acaoAdicionarComentario,
  acaoAlternarColunaConcluida,
  acaoArquivarConcluidas,
  acaoArquivarTarefa,
  acaoArquivarUmaColuna,
  acaoCriarColuna,
  acaoDefinirArquivarApos,
  acaoCriarSprint,
  acaoCriarTarefa,
  acaoDefinirDatasDaSprint,
  acaoFecharSprint,
  acaoDefinirCorDaTarefa,
  acaoDefinirLimiteWip,
  acaoDefinirDependencias,
  acaoDefinirEstimativa,
  acaoDefinirImpedimento,
  acaoDefinirPrazo,
  acaoDefinirPrioridade,
  acaoDefinirRecorrencia,
  acaoDefinirSprintDaTarefa,
  acaoDefinirSubtarefas,
  acaoDuplicarTarefa,
  acaoExcluirColuna,
  acaoExcluirComentario,
  acaoExcluirSprint,
  acaoExcluirTarefa,
  acaoLerTarefa,
  acaoMoverTarefa,
  acaoRenomearColuna,
  acaoRenomearTarefa,
  acaoReordenarColunas,
  acaoReordenarTarefasPara,
  acaoSalvarTarefa,
} from "@/app/acoes-kanban";
import {
  calcularNovaOrdem,
  iniciarArrastoDeSubtarefa,
  iniciarArrastoDeTarefa,
  lerCaminhoDeTarefa,
  lerIdDeSubtarefa,
  trazSubtarefa,
  trazTarefa,
} from "@/lib/arrastar";
import { interpretarAdicaoRapida } from "@/lib/adicao-rapida";
import { useAtalho } from "@/lib/atalhos";
import { juntar } from "@/lib/caminho-texto";
import { CORES_CADERNO, CORES_PRIORIDADE } from "@/lib/cores";
import { formatarDataCurta, formatarDataHora, urlDoArquivoDoQuadro } from "@/lib/rotas";
import { siglaDoQuadro } from "@/lib/sigla";
import {
  ESTIMATIVAS,
  PONTOS_ESTIMATIVA,
  PRIORIDADES,
  RECORRENCIAS,
  RUBRICA_PRIORIDADE,
  RUBRICA_RECORRENCIA,
} from "@/lib/tipos";
import type {
  ColunaKanban,
  Comentario,
  Estimativa,
  EtiquetaKanban,
  Prioridade,
  Quadro,
  Recorrencia,
  ResumoQuadro,
  SprintKanban,
  Subtarefa,
  TarefaKanban,
} from "@/lib/tipos";

import { DialogoConfirmar, DialogoNome } from "./dialogos";
import { SeletorEtiquetasKanban } from "./seletor-etiquetas-kanban";
import { TituloEditavel } from "./titulo-editavel";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, RotuloMenu, SeparadorMenu } from "./ui";
import { VisaoCalendario, VisaoLista } from "./visoes-kanban";
import { VisualizadorMarkdown } from "./visualizador-markdown";

/** As seis cores da paleta, para a cor própria de um cartão. */
const CORES_CARTAO = CORES_CADERNO;

/** Cor de cada coluna — só um acento discreto no topo do cartão, não um fundo colorido inteiro. */
const CORES_COLUNA = ["var(--tinta-3)", "var(--realce)", "#D85A30", "#639922", "#7C5CFC", "#2D7FF9"];
function corDaColuna(indice: number): string {
  return CORES_COLUNA[indice % CORES_COLUNA.length];
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Quantos dias inteiros a tarefa está na coluna atual. */
function diasNaColuna(tarefa: TarefaKanban): number {
  return Math.floor((Date.now() - new Date(tarefa.movidoEm).getTime()) / 86_400_000);
}

/** A partir de quantos dias parada na mesma coluna um cartão "envelhece" (esmaece e avisa). */
const DIAS_PARA_ENVELHECER = 14;

function formatarPrazo(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

type Sobrevoo = { coluna: ColunaKanban; caminho: string; antes: boolean } | null;

/** As dependências de uma tarefa que ainda não chegaram numa coluna de conclusão. */
function dependenciasPendentes(
  tarefa: TarefaKanban,
  mapa: Record<string, TarefaKanban>,
  colunasConcluidas: string[],
): TarefaKanban[] {
  return tarefa.dependeDe
    .map((caminho) => mapa[caminho])
    .filter((dependencia): dependencia is TarefaKanban => Boolean(dependencia) && !colunasConcluidas.includes(dependencia.coluna));
}

/**
 * Um quadro do Kanban — aplicação à parte das anotações, com quadros
 * próprios. Cada tarefa é um arquivo `.md` de verdade
 * (`_kanban/<Quadro>/<Coluna>/<Tarefa>.md`); arrastar entre colunas move o
 * arquivo de pasta. As colunas são configuráveis (criar, renomear,
 * reordenar, excluir se vazia).
 */
export function QuadroKanban({
  quadro,
  conteudo,
  etiquetasKanban,
  sprints,
  tarefaInicial = null,
}: {
  /** O quadro em si: nome, cor, ícone. */
  quadro: ResumoQuadro;
  /** O conteúdo dele: colunas configuradas + tarefas de cada uma. */
  conteudo: Quadro;
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
  /** Caminho de uma tarefa para abrir no painel assim que o quadro monta. */
  tarefaInicial?: string | null;
}) {
  const roteador = useRouter();
  const colunas = conteudo.config.colunas;
  const assinaturaTarefas = colunas.map((coluna) => (conteudo.tarefas[coluna] ?? []).map((t) => t.caminho).join(",")).join("|");

  const [ordemLocal, definirOrdemLocal] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(colunas.map((coluna) => [coluna, (conteudo.tarefas[coluna] ?? []).map((t) => t.caminho)])),
  );
  const [mapa, definirMapa] = useState<Record<string, TarefaKanban>>(() => {
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of colunas) for (const tarefa of conteudo.tarefas[coluna] ?? []) m[tarefa.caminho] = tarefa;
    return m;
  });

  useEffect(() => {
    definirOrdemLocal(
      Object.fromEntries(colunas.map((coluna) => [coluna, (conteudo.tarefas[coluna] ?? []).map((t) => t.caminho)])),
    );
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of colunas) for (const tarefa of conteudo.tarefas[coluna] ?? []) m[tarefa.caminho] = tarefa;
    definirMapa(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quadro.nome, colunas.join("|"), assinaturaTarefas]);

  const [sobrevoo, definirSobrevoo] = useState<Sobrevoo>(null);
  const [tarefaAberta, definirTarefaAberta] = useState<string | null>(tarefaInicial);
  // O cartão que os atalhos de uma tecla afetam: o aberto no painel, senão o sob o mouse.
  const [tarefaSobMouse, definirTarefaSobMouse] = useState<string | null>(null);
  // Seleção múltipla: Ctrl+clique soma, Shift+clique pega o intervalo na
  // coluna; uma barra de ações em lote aparece embaixo enquanto houver
  // seleção. Esc limpa.
  const [selecionadas, definirSelecionadas] = useState<Set<string>>(new Set());
  const [ultimaSelecionada, definirUltimaSelecionada] = useState<string | null>(null);
  const [confirmandoExclusaoEmLote, definirConfirmandoExclusaoEmLote] = useState(false);
  const [gerenciandoSprints, definirGerenciandoSprints] = useState(false);
  function limparSelecao() {
    definirSelecionadas(new Set());
    definirUltimaSelecionada(null);
  }
  function selecionar(caminho: string, evento: React.MouseEvent) {
    definirSelecionadas((atual) => {
      const proximo = new Set(atual);
      if (evento.shiftKey && ultimaSelecionada && mapa[ultimaSelecionada]?.coluna === mapa[caminho]?.coluna) {
        const lista = ordemLocal[mapa[caminho].coluna] ?? [];
        const a = lista.indexOf(ultimaSelecionada);
        const b = lista.indexOf(caminho);
        for (const item of lista.slice(Math.min(a, b), Math.max(a, b) + 1)) proximo.add(item);
      } else if (proximo.has(caminho)) {
        proximo.delete(caminho);
      } else {
        proximo.add(caminho);
      }
      return proximo;
    });
    definirUltimaSelecionada(caminho);
  }
  useAtalho("escape", {
    grupo: "Kanban",
    descricao: "Limpar a seleção",
    ativo: selecionadas.size > 0 && tarefaAberta === null,
    acao: limparSelecao,
  });
  /** Roda uma ação em cada selecionada, depois atualiza tudo de uma vez. */
  async function emLote(acao: (caminho: string) => Promise<unknown>) {
    const alvos = [...selecionadas].filter((caminho) => mapa[caminho]);
    limparSelecao();
    for (const caminho of alvos) await acao(caminho);
    roteador.refresh();
  }
  // Painel lateral por padrão; tela cheia quando a pessoa expande (lembrado).
  const [modoTarefa, definirModoTarefa] = useState<"painel" | "cheia">("painel");
  const [focarPrazo, definirFocarPrazo] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem("kanban-tarefa-modo") === "cheia") definirModoTarefa("cheia");
    } catch {
      // Sem armazenamento: painel.
    }
  }, []);
  function mudarModoTarefa(modo: "painel" | "cheia") {
    definirModoTarefa(modo);
    try {
      localStorage.setItem("kanban-tarefa-modo", modo);
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }
  function abrirTarefa(caminho: string, comFocoNoPrazo = false) {
    definirFocarPrazo(comFocoNoPrazo);
    definirTarefaAberta(caminho);
  }
  useAtalho("escape", {
    grupo: "Kanban",
    descricao: "Fechar a tarefa aberta",
    ativo: tarefaAberta !== null && modoTarefa === "painel",
    acao: () => definirTarefaAberta(null),
  });

  // Atalhos de uma tecla sobre "a tarefa": a aberta no painel, senão a sob
  // o mouse. Tecla solta nunca dispara dentro de um campo (regra do registro).
  const tarefaAlvo = tarefaAberta ?? tarefaSobMouse;
  const atalhoDeTarefa = { grupo: "Kanban", ativo: tarefaAlvo !== null && Boolean(mapa[tarefaAlvo]) };
  useAtalho("e", {
    ...atalhoDeTarefa,
    descricao: "Abrir a tarefa sob o mouse",
    acao: () => tarefaAlvo && abrirTarefa(tarefaAlvo),
  });
  useAtalho("d", {
    ...atalhoDeTarefa,
    descricao: "Prazo da tarefa",
    acao: () => tarefaAlvo && abrirTarefa(tarefaAlvo, true),
  });
  useAtalho("f", {
    ...atalhoDeTarefa,
    descricao: "Favoritar a tarefa",
    acao: () => tarefaAlvo && favoritarAção(tarefaAlvo),
  });
  for (const [tecla, prioridade] of [["1", "baixa"], ["2", "media"], ["3", "alta"], ["4", "urgente"]] as const) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- lista fixa, mesma ordem em todo render
    useAtalho(tecla, {
      ...atalhoDeTarefa,
      descricao: `Prioridade ${RUBRICA_PRIORIDADE[prioridade]}`,
      acao: () =>
        tarefaAlvo && definirPrioridadeAção(tarefaAlvo, mapa[tarefaAlvo]?.prioridade === prioridade ? null : prioridade),
    });
  }
  useAtalho("arrowleft", {
    ...atalhoDeTarefa,
    descricao: "Mover a tarefa uma coluna à esquerda",
    acao: () => {
      if (!tarefaAlvo) return;
      const indice = colunas.indexOf(mapa[tarefaAlvo].coluna);
      if (indice > 0) moverTarefaPara(tarefaAlvo, colunas[indice - 1]);
    },
  });
  useAtalho("arrowright", {
    ...atalhoDeTarefa,
    descricao: "Mover a tarefa uma coluna à direita",
    acao: () => {
      if (!tarefaAlvo) return;
      const indice = colunas.indexOf(mapa[tarefaAlvo].coluna);
      if (indice !== -1 && indice < colunas.length - 1) moverTarefaPara(tarefaAlvo, colunas[indice + 1]);
    },
  });
  const [colunaAdicionando, definirColunaAdicionando] = useState<ColunaKanban | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  useAtalho("n", {
    grupo: "Kanban",
    descricao: `Nova tarefa em ${colunas[0] ?? "…"}`,
    acao: () => colunas[0] && definirColunaAdicionando(colunas[0]),
  });
  const [criandoColuna, definirCriandoColuna] = useState(false);
  const [colunaParaWip, definirColunaParaWip] = useState<string | null>(null);
  const [ajustandoArquivo, definirAjustandoArquivo] = useState(false);
  // Quadro · Lista · Calendário sobre o mesmo filtro — lembrado por quadro.
  type Visao = "quadro" | "lista" | "calendario";
  const chaveVisao = `kanban-visao:${quadro.nome}`;
  const [visao, definirVisao] = useState<Visao>("quadro");
  useEffect(() => {
    try {
      const salva = localStorage.getItem(chaveVisao);
      if (salva === "lista" || salva === "calendario") definirVisao(salva);
      else definirVisao("quadro");
    } catch {
      definirVisao("quadro");
    }
  }, [chaveVisao]);
  function mudarVisao(proxima: Visao) {
    definirVisao(proxima);
    try {
      localStorage.setItem(chaveVisao, proxima);
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }
  // Mover para uma coluna cheia (acima do WIP) pede confirmação antes.
  const [movimentoPendente, definirMovimentoPendente] = useState<{ origem: string; coluna: ColunaKanban } | null>(null);
  // Colunas recolhidas numa faixa fina — lembrado por quadro.
  const chaveRecolhidas = `kanban-colunas-recolhidas:${quadro.nome}`;
  const [recolhidas, definirRecolhidas] = useState<Set<string>>(new Set());
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(chaveRecolhidas);
      definirRecolhidas(new Set(bruto ? (JSON.parse(bruto) as string[]) : []));
    } catch {
      definirRecolhidas(new Set());
    }
  }, [chaveRecolhidas]);
  function alternarRecolhida(coluna: string) {
    definirRecolhidas((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(coluna)) proximo.delete(coluna);
      else proximo.add(coluna);
      try {
        localStorage.setItem(chaveRecolhidas, JSON.stringify([...proximo]));
      } catch {
        // Sem armazenamento: vale só para esta sessão.
      }
      return proximo;
    });
  }

  const [colunaParaRenomear, definirColunaParaRenomear] = useState<string | null>(null);
  const [colunaParaExcluir, definirColunaParaExcluir] = useState<string | null>(null);
  const [tarefaParaExcluir, definirTarefaParaExcluir] = useState<string | null>(null);

  const [filtroEtiqueta, definirFiltroEtiqueta] = useState<string | null>(null);
  const [filtroPrioridade, definirFiltroPrioridade] = useState<Prioridade | null>(null);
  const [filtroSprint, definirFiltroSprint] = useState<string | null>(null);
  const filtrosAtivos = Boolean(filtroEtiqueta || filtroPrioridade || filtroSprint);

  useEffect(() => {
    if (!aviso) return;
    const espera = setTimeout(() => definirAviso(null), 4500);
    return () => clearTimeout(espera);
  }, [aviso]);

  function pastaDaColuna(coluna: ColunaKanban): string {
    return juntar(quadro.caminho, coluna);
  }

  function passaNoFiltro(tarefa: TarefaKanban): boolean {
    if (filtroEtiqueta && !tarefa.etiquetas.includes(filtroEtiqueta)) return false;
    if (filtroPrioridade && tarefa.prioridade !== filtroPrioridade) return false;
    if (filtroSprint && tarefa.sprintId !== filtroSprint) return false;
    return true;
  }

  /** Quantas tarefas a coluna tem agora (pelo estado local, que já reflete o arraste). */
  function contagemDaColuna(coluna: ColunaKanban): number {
    return (ordemLocal[coluna] ?? []).length;
  }

  /** Move uma tarefa pra outra coluna — usado tanto pelo arraste quanto pelo menu do cartão. */
  async function moverTarefaPara(origem: string, coluna: ColunaKanban, confirmadoAcimaDoWip = false) {
    const tarefaOrigem = mapa[origem];
    if (!tarefaOrigem || tarefaOrigem.coluna === coluna) return;

    // Coluna já no limite de WIP: pergunta antes de empilhar mais uma —
    // é o sinal mais barato de "você está começando coisa demais".
    const limite = conteudo.config.wip?.[coluna];
    if (limite && !confirmadoAcimaDoWip && contagemDaColuna(coluna) >= limite) {
      definirMovimentoPendente({ origem, coluna });
      return;
    }

    if (conteudo.config.colunasConcluidas.includes(coluna)) {
      const pendentes = dependenciasPendentes(tarefaOrigem, mapa, conteudo.config.colunasConcluidas);
      if (pendentes.length > 0) {
        definirAviso(
          `"${tarefaOrigem.titulo}" ainda depende de ${pendentes.length === 1 ? "1 tarefa" : `${pendentes.length} tarefas`} não concluída${pendentes.length === 1 ? "" : "s"}: ${pendentes.map((p) => p.titulo).join(", ")}.`,
        );
        return;
      }
    }

    definirOrdemLocal((atual) => ({
      ...atual,
      [tarefaOrigem.coluna]: (atual[tarefaOrigem.coluna] ?? []).filter((caminho) => caminho !== origem),
      [coluna]: [...(atual[coluna] ?? []), origem],
    }));
    definirMapa((atual) => ({ ...atual, [origem]: { ...atual[origem], coluna } }));

    await acaoMoverTarefa(origem, coluna);
    // O caminho muda de pasta quando move — precisa dos dados frescos do
    // servidor pra saber o novo caminho de cada tarefa movida (e pra
    // atualizar quem dependia dela, se for o caso).
    roteador.refresh();
  }

  /** Reordena dentro da mesma coluna (otimista) — mover entre colunas cai em `moverTarefaPara`. */
  function aoSoltarPertoDe(alvo: TarefaKanban, origem: string, antes: boolean) {
    definirSobrevoo(null);
    const tarefaOrigem = mapa[origem];
    if (!tarefaOrigem || origem === alvo.caminho) return;
    if (tarefaOrigem.coluna !== alvo.coluna) {
      moverTarefaPara(origem, alvo.coluna);
      return;
    }
    const nova = calcularNovaOrdem(ordemLocal[alvo.coluna] ?? [], origem, alvo.caminho, antes);
    if (!nova) return;
    definirOrdemLocal((atual) => ({ ...atual, [alvo.coluna]: nova }));
    acaoReordenarTarefasPara(pastaDaColuna(alvo.coluna), nova).then((resposta) => {
      if (!resposta.ok) roteador.refresh();
    });
  }

  /** "Revisar !alta #financeiro @sexta" → título limpo + as propriedades já preenchidas. */
  async function criarTarefaRapida(coluna: ColunaKanban, texto: string) {
    const { titulo, extras } = interpretarAdicaoRapida(texto, etiquetasKanban, sprints);
    if (!titulo) {
      definirColunaAdicionando(null);
      return;
    }
    const resposta = await acaoCriarTarefa(quadro.nome, coluna, titulo, extras);
    definirColunaAdicionando(null);
    if (resposta.ok) roteador.refresh();
    else definirAviso(resposta.erro);
  }

  async function arquivarTarefaAção(caminho: string) {
    const tarefa = mapa[caminho];
    if (!tarefa) return;
    // Some da tela na hora; o servidor confirma no refresh.
    definirOrdemLocal((atual) => ({
      ...atual,
      [tarefa.coluna]: (atual[tarefa.coluna] ?? []).filter((item) => item !== caminho),
    }));
    if (tarefaAberta === caminho) definirTarefaAberta(null);
    const resposta = await acaoArquivarTarefa(caminho);
    if (!resposta.ok) definirAviso(resposta.erro);
    roteador.refresh();
  }

  async function arquivarConcluidasAção() {
    const resposta = await acaoArquivarConcluidas(quadro.nome);
    if (resposta.ok) {
      const quantas = Number(resposta.mensagem ?? 0);
      definirAviso(quantas === 0 ? "Nada para arquivar." : `${quantas} ${quantas === 1 ? "tarefa arquivada" : "tarefas arquivadas"}.`);
    } else {
      definirAviso(resposta.erro);
    }
    roteador.refresh();
  }

  /** Arquivar tudo a partir do menu de uma coluna específica — só aquela, não as outras de conclusão. */
  async function arquivarUmaColunaAção(coluna: string) {
    const resposta = await acaoArquivarUmaColuna(quadro.nome, coluna);
    if (resposta.ok) {
      const quantas = Number(resposta.mensagem ?? 0);
      definirAviso(quantas === 0 ? "Nada para arquivar." : `${quantas} ${quantas === 1 ? "tarefa arquivada" : "tarefas arquivadas"}.`);
    } else {
      definirAviso(resposta.erro);
    }
    roteador.refresh();
  }

  async function duplicarTarefaAção(caminho: string) {
    const resposta = await acaoDuplicarTarefa(caminho);
    if (resposta.ok) roteador.refresh();
  }

  /**
   * Renomear muda o caminho do arquivo — precisa reapontar `mapa`,
   * `ordemLocal` e (se for a tarefa aberta no editor) `tarefaAberta` na
   * hora, senão tudo que depende do caminho antigo (salvar, excluir, o
   * próprio diálogo) fica órfão até o próximo refresh do servidor.
   */
  async function renomearTarefaAção(caminhoAtual: string, novoTitulo: string): Promise<string | null> {
    const resposta = await acaoRenomearTarefa(caminhoAtual, novoTitulo);
    if (!resposta.ok) return resposta.erro;

    const novoCaminho = resposta.mensagem ?? caminhoAtual;
    const tarefaAtual = mapa[caminhoAtual];
    if (novoCaminho !== caminhoAtual && tarefaAtual) {
      definirMapa((atual) => {
        const copia = { ...atual };
        delete copia[caminhoAtual];
        copia[novoCaminho] = { ...tarefaAtual, caminho: novoCaminho, titulo: novoTitulo.trim() };
        return copia;
      });
      definirOrdemLocal((atual) => ({
        ...atual,
        [tarefaAtual.coluna]: (atual[tarefaAtual.coluna] ?? []).map((c) => (c === caminhoAtual ? novoCaminho : c)),
      }));
      definirTarefaAberta((atual) => (atual === caminhoAtual ? novoCaminho : atual));
    } else if (tarefaAtual) {
      definirMapa((atual) => ({ ...atual, [caminhoAtual]: { ...atual[caminhoAtual], titulo: novoTitulo.trim() } }));
    }
    roteador.refresh();
    return null;
  }

  async function favoritarAção(caminho: string) {
    definirMapa((atual) => ({ ...atual, [caminho]: { ...atual[caminho], favorita: !atual[caminho].favorita } }));
    await acaoAlternarFavorita(caminho);
    roteador.refresh();
  }

  async function definirPrioridadeAção(caminho: string, prioridade: Prioridade | null) {
    definirMapa((atual) => ({ ...atual, [caminho]: { ...atual[caminho], prioridade } }));
    await acaoDefinirPrioridade(caminho, prioridade);
  }

  async function definirImpedimentoAção(caminho: string, motivo: string | null) {
    definirMapa((atual) => ({ ...atual, [caminho]: { ...atual[caminho], impedimento: motivo } }));
    await acaoDefinirImpedimento(caminho, motivo);
  }

  async function definirSubtarefasAção(caminho: string, subtarefas: Subtarefa[]) {
    definirMapa((atual) => ({ ...atual, [caminho]: { ...atual[caminho], subtarefas } }));
    await acaoDefinirSubtarefas(caminho, subtarefas);
  }

  async function adicionarComentarioAção(caminho: string, texto: string): Promise<string | null> {
    const resposta = await acaoAdicionarComentario(caminho, texto);
    if (!resposta.ok) return resposta.erro;
    definirMapa((atual) => ({
      ...atual,
      [caminho]: { ...atual[caminho], comentarios: [...atual[caminho].comentarios, resposta.comentario] },
    }));
    return null;
  }

  async function excluirComentarioAção(caminho: string, id: string) {
    definirMapa((atual) => ({
      ...atual,
      [caminho]: { ...atual[caminho], comentarios: atual[caminho].comentarios.filter((item) => item.id !== id) },
    }));
    await acaoExcluirComentario(caminho, id);
  }

  async function moverColuna(nome: string, direcao: -1 | 1) {
    const indice = colunas.indexOf(nome);
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= colunas.length) return;
    const nova = [...colunas];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    const resposta = await acaoReordenarColunas(quadro.nome, nova);
    if (resposta.ok) roteador.refresh();
  }

  const sigla = siglaDoQuadro(quadro.nome);

  /** As props do editor da tarefa aberta — iguais no painel e na tela cheia. */
  function propsDaTarefaAberta(caminho: string) {
    return {
      tarefa: mapa[caminho],
      todasTarefas: Object.values(mapa),
      etiquetasKanban,
      nomeDoQuadro: quadro.nome,
      sprints,
      focarPrazo,
      aoRenomear: (novoTitulo: string) => renomearTarefaAção(caminho, novoTitulo),
      aoDefinirImpedimento: (motivo: string | null) => definirImpedimentoAção(caminho, motivo),
      aoDefinirSubtarefas: (subtarefas: Subtarefa[]) => definirSubtarefasAção(caminho, subtarefas),
      aoAdicionarComentario: (texto: string) => adicionarComentarioAção(caminho, texto),
      aoExcluirComentario: (id: string) => excluirComentarioAção(caminho, id),
      aoAtualizar: (patch: Partial<TarefaKanban>) =>
        definirMapa((atual) => ({ ...atual, [caminho]: { ...atual[caminho], ...patch } })),
      aoExcluir: () => {
        definirTarefaAberta(null);
        roteador.refresh();
      },
    };
  }

  const etiquetaAtiva = filtroEtiqueta ? etiquetasKanban.find((e) => e.id === filtroEtiqueta) : null;
  const sprintAtiva = filtroSprint ? sprints.find((s) => s.id === filtroSprint) : null;
  const totalDeTarefas = Object.keys(mapa).length;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-linha bg-superficie px-6 py-3">
        <span className="text-[18px] leading-none" aria-hidden>
          {quadro.icone}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[16px] font-extrabold tracking-[-0.02em]">{quadro.nome}</h1>
          <p className="text-[11.5px] text-tinta-2">
            {totalDeTarefas === 0
              ? "Quadro vazio — comece criando uma tarefa numa coluna."
              : `${totalDeTarefas} ${totalDeTarefas === 1 ? "tarefa" : "tarefas"} · cada uma é um arquivo em ${quadro.caminho}/`}
          </p>
        </div>
        <Link
          href={urlDoArquivoDoQuadro(quadro.nome)}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta"
          title="Tarefas concluídas que saíram do quadro"
        >
          <Archive size={13} />
          Arquivo
          {conteudo.arquivadas > 0 ? <span className="text-tinta-3 tabular-nums">{conteudo.arquivadas}</span> : null}
        </Link>
        <Menu
          alinhamento="direita"
          gatilho={(abrir) => (
            <BotaoIcone rotulo="Ajustes do quadro" onClick={abrir}>
              <Settings2 size={15} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<Archive size={13} />}
                onClick={() => {
                  fechar();
                  arquivarConcluidasAção();
                }}
              >
                Arquivar tudo em {conteudo.config.colunasConcluidas.join(", ")}
              </ItemMenu>
              <ItemMenu
                icone={<ListChecks size={13} />}
                onClick={() => {
                  fechar();
                  definirGerenciandoSprints(true);
                }}
              >
                Sprints: datas e fechamento
              </ItemMenu>
              <ItemMenu
                icone={<Settings2 size={13} />}
                onClick={() => {
                  fechar();
                  definirAjustandoArquivo(true);
                }}
              >
                {(conteudo.config.arquivarApos ?? 30) === 0
                  ? "Arquivar sozinho: nunca"
                  : `Arquivar sozinho após ${conteudo.config.arquivarApos ?? 30} dias`}
              </ItemMenu>
            </>
          )}
        </Menu>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-linha bg-superficie px-6 py-2">
        <FiltroMenu
          rotulo={etiquetaAtiva ? etiquetaAtiva.nome : "Etiqueta"}
          ativo={Boolean(etiquetaAtiva)}
          aoLimpar={() => definirFiltroEtiqueta(null)}
        >
          {(fechar) =>
            etiquetasKanban.length === 0 ? (
              <p className="px-2 py-2 text-[12px] leading-snug text-tinta-3">Nenhuma etiqueta cadastrada ainda.</p>
            ) : (
              etiquetasKanban.map((etiqueta) => (
                <button
                  key={etiqueta.id}
                  type="button"
                  onClick={() => {
                    definirFiltroEtiqueta(etiqueta.id);
                    fechar();
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
                >
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: etiqueta.cor }} />
                  <span className="flex-1 truncate">{etiqueta.nome}</span>
                  {filtroEtiqueta === etiqueta.id ? <Check size={13} style={{ color: "var(--realce)" }} /> : null}
                </button>
              ))
            )
          }
        </FiltroMenu>

        <FiltroMenu
          rotulo={filtroPrioridade ? RUBRICA_PRIORIDADE[filtroPrioridade] : "Prioridade"}
          ativo={Boolean(filtroPrioridade)}
          aoLimpar={() => definirFiltroPrioridade(null)}
        >
          {(fechar) =>
            PRIORIDADES.map((prioridade) => (
              <button
                key={prioridade}
                type="button"
                onClick={() => {
                  definirFiltroPrioridade(prioridade);
                  fechar();
                }}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
              >
                <Flag size={12} style={{ color: CORES_PRIORIDADE[prioridade] }} />
                <span className="flex-1 truncate">{RUBRICA_PRIORIDADE[prioridade]}</span>
                {filtroPrioridade === prioridade ? <Check size={13} style={{ color: "var(--realce)" }} /> : null}
              </button>
            ))
          }
        </FiltroMenu>

        <FiltroMenu
          rotulo={sprintAtiva ? sprintAtiva.nome : "Sprint"}
          ativo={Boolean(sprintAtiva)}
          aoLimpar={() => definirFiltroSprint(null)}
        >
          {(fechar) => (
            <SeletorSprintConteudo
              sprints={sprints}
              selecionada={filtroSprint}
              aoEscolher={(id) => {
                definirFiltroSprint(id);
                fechar();
              }}
            />
          )}
        </FiltroMenu>

        {filtrosAtivos ? (
          <button
            type="button"
            onClick={() => {
              definirFiltroEtiqueta(null);
              definirFiltroPrioridade(null);
              definirFiltroSprint(null);
            }}
            className="text-[12px] text-tinta-3 underline decoration-dotted transition-colors hover:text-tinta"
          >
            Limpar filtros
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-linha p-0.5" role="group" aria-label="Visão">
          {(
            [
              ["quadro", "Quadro", <KanbanSquare key="q" size={13} />],
              ["lista", "Lista", <List key="l" size={13} />],
              ["calendario", "Calendário", <CalendarDays key="c" size={13} />],
            ] as const
          ).map(([id, rotulo, icone]) => (
            <button
              key={id}
              type="button"
              onClick={() => mudarVisao(id)}
              aria-pressed={visao === id}
              className={clsx(
                "flex items-center gap-1 rounded-md px-2 py-1 text-[11.5px] transition-colors",
                visao === id ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:text-tinta",
              )}
            >
              {icone}
              {rotulo}
            </button>
          ))}
        </div>

        {visao === "quadro" ? (
          <BotaoIcone rotulo="Nova coluna" onClick={() => definirCriandoColuna(true)}>
            <Plus size={14} />
          </BotaoIcone>
        ) : null}
      </div>

      {aviso ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-linha bg-[color-mix(in_srgb,var(--perigo)_8%,transparent)] px-6 py-2">
          <Lock size={13} className="shrink-0 text-perigo" aria-hidden />
          <p className="min-w-0 flex-1 text-[12px] text-perigo">{aviso}</p>
          <button
            type="button"
            onClick={() => definirAviso(null)}
            className="shrink-0 text-tinta-3 hover:text-tinta"
            aria-label="Fechar aviso"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <div className="relative flex min-h-0 flex-1">
      {visao === "lista" ? (
        <VisaoLista
          tarefas={Object.values(mapa).filter(passaNoFiltro)}
          colunas={colunas}
          sprints={sprints}
          etiquetasKanban={etiquetasKanban}
          sigla={sigla}
          hoje={hojeISO()}
          colunasConcluidas={conteudo.config.colunasConcluidas}
          tarefaAberta={tarefaAberta}
          aoAbrir={(caminho) => abrirTarefa(caminho)}
        />
      ) : visao === "calendario" ? (
        <VisaoCalendario
          tarefas={Object.values(mapa).filter(passaNoFiltro)}
          hoje={hojeISO()}
          colunasConcluidas={conteudo.config.colunasConcluidas}
          sigla={sigla}
          tarefaAberta={tarefaAberta}
          aoAbrir={(caminho) => abrirTarefa(caminho)}
        />
      ) : (
      <div className="flex min-h-0 min-w-0 flex-1 gap-3 overflow-x-auto px-4 py-4">
        {colunas.map((coluna, indice) => {
          const caminhos = ordemLocal[coluna] ?? [];
          const tarefas = caminhos
            .map((caminho) => mapa[caminho])
            .filter((tarefa): tarefa is TarefaKanban => Boolean(tarefa));
          const tarefasVisiveis = tarefas.filter(passaNoFiltro);
          const cor = corDaColuna(indice);
          const limiteWip = conteudo.config.wip?.[coluna];
          const acimaDoWip = Boolean(limiteWip && tarefas.length > limiteWip);
          const pontos = tarefas.reduce((soma, t) => soma + (t.estimativa ? PONTOS_ESTIMATIVA[t.estimativa] : 0), 0);
          const ehConclusao = conteudo.config.colunasConcluidas.includes(coluna);

          if (recolhidas.has(coluna)) {
            // Faixa de 40px com o nome de cima para baixo — mesmo gesto das
            // colunas de Anotações. Continua aceitando um cartão solto nela.
            return (
              <div
                key={coluna}
                onDragOver={(evento) => {
                  if (!trazTarefa(evento)) return;
                  evento.preventDefault();
                  evento.dataTransfer.dropEffect = "move";
                }}
                onDrop={(evento) => {
                  if (!trazTarefa(evento)) return;
                  evento.preventDefault();
                  moverTarefaPara(lerCaminhoDeTarefa(evento), coluna);
                }}
                className="flex w-10 shrink-0 flex-col items-center gap-2 rounded-xl border border-linha bg-superficie pt-2 pb-3"
                style={{ boxShadow: `inset 0 2px 0 ${cor}` }}
              >
                <BotaoIcone rotulo={`Mostrar a coluna ${coluna}`} onClick={() => alternarRecolhida(coluna)} className="size-6">
                  <ChevronsLeftRight size={13} />
                </BotaoIcone>
                <button
                  type="button"
                  onClick={() => alternarRecolhida(coluna)}
                  className="flex min-h-0 flex-1 flex-col items-center gap-1.5"
                  title={`${coluna} · ${tarefas.length} ${tarefas.length === 1 ? "tarefa" : "tarefas"}`}
                >
                  <span className="texto-vertical text-[11.5px] font-bold text-tinta-2">{coluna}</span>
                  <span className={clsx("text-[10.5px] tabular-nums", acimaDoWip ? "font-bold text-perigo" : "text-tinta-3")}>
                    {tarefas.length}
                  </span>
                </button>
              </div>
            );
          }

          return (
            <div
              key={coluna}
              onDragOver={(evento) => {
                if (!trazTarefa(evento)) return;
                evento.preventDefault();
                evento.dataTransfer.dropEffect = "move";
              }}
              onDrop={(evento) => {
                if (!trazTarefa(evento)) return;
                evento.preventDefault();
                moverTarefaPara(lerCaminhoDeTarefa(evento), coluna);
              }}
              className={clsx(
                "flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border bg-superficie",
                acimaDoWip ? "border-[color-mix(in_srgb,var(--perigo)_45%,var(--linha))]" : "border-linha",
              )}
            >
              <div
                className="flex shrink-0 items-center gap-1 px-3 pt-2.5 pb-2"
                style={{ boxShadow: `inset 0 2px 0 ${cor}` }}
              >
                <span className="truncate text-[12.5px] font-bold tracking-[-0.01em]">{coluna}</span>
                {ehConclusao ? (
                  <span title="Coluna de conclusão — trava tarefas com dependência pendente">
                    <Check size={11} className="shrink-0 text-tinta-3" />
                  </span>
                ) : null}
                {/* Contagem, e "4/3" em vermelho quando passa do limite de WIP. */}
                <span
                  className={clsx("text-[11px] tabular-nums", acimaDoWip ? "font-bold text-perigo" : "text-tinta-3")}
                  title={limiteWip ? `Limite de ${limiteWip} em andamento` : undefined}
                >
                  {filtrosAtivos ? `${tarefasVisiveis.length}/${tarefas.length}` : tarefas.length}
                  {limiteWip ? `/${limiteWip}` : ""}
                </span>
                {pontos > 0 ? (
                  <span className="text-[10.5px] text-tinta-3 tabular-nums" title={`${pontos} pontos estimados`}>
                    Σ{pontos}
                  </span>
                ) : null}
                <div className="ml-auto flex items-center gap-0.5">
                  <BotaoIcone
                    rotulo={`Nova tarefa em ${coluna}`}
                    onClick={() => definirColunaAdicionando(coluna)}
                    className="size-6"
                  >
                    <Plus size={13} />
                  </BotaoIcone>
                  <Menu
                    gatilho={(abrir) => (
                      <BotaoIcone rotulo={`Opções da coluna ${coluna}`} onClick={abrir} className="size-6">
                        <MoreHorizontal size={13} />
                      </BotaoIcone>
                    )}
                  >
                    {(fechar) => (
                      <>
                        <ItemMenu
                          icone={<Pencil size={13} />}
                          onClick={() => {
                            fechar();
                            definirColunaParaRenomear(coluna);
                          }}
                        >
                          Renomear
                        </ItemMenu>
                        <ItemMenu
                          icone={ehConclusao ? <X size={13} /> : <Check size={13} />}
                          onClick={async () => {
                            fechar();
                            const resposta = await acaoAlternarColunaConcluida(quadro.nome, coluna);
                            if (resposta.ok) roteador.refresh();
                            else definirAviso(resposta.erro);
                          }}
                        >
                          {ehConclusao ? "Desmarcar como conclusão" : "Marcar como conclusão"}
                        </ItemMenu>
                        {ehConclusao && tarefas.length > 0 ? (
                          <ItemMenu
                            icone={<Archive size={13} />}
                            onClick={() => {
                              fechar();
                              arquivarUmaColunaAção(coluna);
                            }}
                          >
                            Arquivar tudo ({tarefas.length})
                          </ItemMenu>
                        ) : null}
                        <ItemMenu
                          icone={<Gauge size={13} />}
                          onClick={() => {
                            fechar();
                            definirColunaParaWip(coluna);
                          }}
                        >
                          {limiteWip ? `Limite de WIP: ${limiteWip}` : "Limite de WIP…"}
                        </ItemMenu>
                        <ItemMenu
                          icone={<ChevronsLeftRight size={13} />}
                          onClick={() => {
                            fechar();
                            alternarRecolhida(coluna);
                          }}
                        >
                          Recolher coluna
                        </ItemMenu>
                        <SeparadorMenu />
                        <ItemMenu
                          icone={<ChevronLeft size={13} />}
                          onClick={() => {
                            fechar();
                            moverColuna(coluna, -1);
                          }}
                        >
                          Mover para esquerda
                        </ItemMenu>
                        <ItemMenu
                          icone={<ChevronRight size={13} />}
                          onClick={() => {
                            fechar();
                            moverColuna(coluna, 1);
                          }}
                        >
                          Mover para direita
                        </ItemMenu>
                        <SeparadorMenu />
                        <ItemMenu
                          icone={<Trash2 size={13} />}
                          perigo
                          onClick={() => {
                            fechar();
                            definirColunaParaExcluir(coluna);
                          }}
                        >
                          Excluir coluna
                        </ItemMenu>
                      </>
                    )}
                  </Menu>
                </div>
              </div>

              <div className="lista-cartoes min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                {tarefasVisiveis.length === 0 && colunaAdicionando !== coluna ? (
                  <p className="px-1.5 py-3 text-[11.5px] leading-relaxed text-tinta-3">
                    {tarefas.length === 0
                      ? "Nenhuma tarefa aqui — arraste uma de outra coluna, ou use o “+” acima."
                      : "Nenhuma tarefa bate com o filtro atual."}
                  </p>
                ) : null}

                {tarefasVisiveis.map((tarefa) => (
                  <CartaoTarefa
                    key={tarefa.caminho}
                    tarefa={tarefa}
                    etiquetasKanban={etiquetasKanban}
                    sprints={sprints}
                    pendentes={dependenciasPendentes(tarefa, mapa, conteudo.config.colunasConcluidas).length}
                    corDaColuna={cor}
                    outrasColunas={colunas.filter((c) => c !== coluna)}
                    atrasada={Boolean(tarefa.prazo) && tarefa.prazo! < hojeISO() && !conteudo.config.colunasConcluidas.includes(coluna)}
                    sobrevoo={sobrevoo?.caminho === tarefa.caminho ? sobrevoo : null}
                    aoPassarPorCima={(antes) => definirSobrevoo({ coluna, caminho: tarefa.caminho, antes })}
                    aoSairDeCima={() =>
                      definirSobrevoo((atual) => (atual?.caminho === tarefa.caminho ? null : atual))
                    }
                    aoSoltar={(origem, antes) => aoSoltarPertoDe(tarefa, origem, antes)}
                    aoAbrir={() => abrirTarefa(tarefa.caminho)}
                    selecionada={selecionadas.has(tarefa.caminho)}
                    aoSelecionar={(evento) => selecionar(tarefa.caminho, evento)}
                    aberta={tarefaAberta === tarefa.caminho}
                    sigla={sigla}
                    diasParada={ehConclusao ? 0 : diasNaColuna(tarefa)}
                    aoEntrarMouse={() => definirTarefaSobMouse(tarefa.caminho)}
                    aoSairMouse={() => definirTarefaSobMouse((atual) => (atual === tarefa.caminho ? null : atual))}
                    aoMoverPara={(destino) => moverTarefaPara(tarefa.caminho, destino)}
                    aoDuplicar={() => duplicarTarefaAção(tarefa.caminho)}
                    aoArquivar={() => arquivarTarefaAção(tarefa.caminho)}
                    aoFavoritar={() => favoritarAção(tarefa.caminho)}
                    aoDefinirPrioridade={(prioridade) => definirPrioridadeAção(tarefa.caminho, prioridade)}
                    aoTirarImpedimento={() => definirImpedimentoAção(tarefa.caminho, null)}
                    aoExcluir={() => definirTarefaParaExcluir(tarefa.caminho)}
                  />
                ))}

                {colunaAdicionando === coluna ? (
                  <CampoNovaTarefa
                    etiquetasKanban={etiquetasKanban}
                    sprints={sprints}
                    aoConfirmar={(titulo) => criarTarefaRapida(coluna, titulo)}
                    aoCancelar={() => definirColunaAdicionando(null)}
                  />
                ) : null}
              </div>

              {/* Sempre à vista, no fim da coluna — o "+" do cabeçalho some
                  de vista quando a lista é longa. */}
              {colunaAdicionando === coluna ? null : (
                <button
                  type="button"
                  onClick={() => definirColunaAdicionando(coluna)}
                  className="flex shrink-0 items-center gap-1.5 border-t border-linha px-3 py-2 text-left text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
                >
                  <Plus size={13} />
                  Adicionar tarefa
                </button>
              )}
            </div>
          );
        })}
      </div>
      )}

      {selecionadas.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Ações nas tarefas selecionadas"
          className="surgir absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-linha bg-superficie-alta px-2 py-1.5 shadow-[var(--sombra)]"
        >
          <span className="px-1.5 text-[12px] font-medium tabular-nums">
            {selecionadas.size} {selecionadas.size === 1 ? "selecionada" : "selecionadas"}
          </span>
          <Menu
            gatilho={(abrir) => (
              <Botao variante="sutil" onClick={abrir}>
                Mover para…
              </Botao>
            )}
          >
            {(fechar) =>
              colunas.map((coluna) => (
                <ItemMenu
                  key={coluna}
                  onClick={() => {
                    fechar();
                    emLote((caminho) => acaoMoverTarefa(caminho, coluna));
                  }}
                >
                  {coluna}
                </ItemMenu>
              ))
            }
          </Menu>
          <Menu
            gatilho={(abrir) => (
              <Botao variante="sutil" onClick={abrir}>
                Prioridade…
              </Botao>
            )}
          >
            {(fechar) => (
              <>
                {PRIORIDADES.map((prioridade) => (
                  <ItemMenu
                    key={prioridade}
                    icone={<Flag size={13} style={{ color: CORES_PRIORIDADE[prioridade] }} />}
                    onClick={() => {
                      fechar();
                      emLote((caminho) => acaoDefinirPrioridade(caminho, prioridade));
                    }}
                  >
                    {RUBRICA_PRIORIDADE[prioridade]}
                  </ItemMenu>
                ))}
                <ItemMenu
                  icone={<FlagOff size={13} />}
                  onClick={() => {
                    fechar();
                    emLote((caminho) => acaoDefinirPrioridade(caminho, null));
                  }}
                >
                  Sem prioridade
                </ItemMenu>
              </>
            )}
          </Menu>
          <Botao variante="sutil" onClick={() => emLote((caminho) => acaoArquivarTarefa(caminho))}>
            <Archive size={13} />
            Arquivar
          </Botao>
          <Botao variante="sutil" onClick={() => definirConfirmandoExclusaoEmLote(true)}>
            <Trash2 size={13} />
            Excluir
          </Botao>
          <BotaoIcone rotulo="Limpar seleção (Esc)" onClick={limparSelecao} className="size-6">
            <X size={13} />
          </BotaoIcone>
        </div>
      ) : null}

      {tarefaAberta && mapa[tarefaAberta] && modoTarefa === "painel" ? (
        <PainelTarefa
          key={tarefaAberta}
          {...propsDaTarefaAberta(tarefaAberta)}
          aoFechar={() => definirTarefaAberta(null)}
          aoExpandir={() => mudarModoTarefa("cheia")}
        />
      ) : null}
      </div>

      {tarefaAberta && mapa[tarefaAberta] && modoTarefa === "cheia" ? (
        <DialogoTarefa
          key={tarefaAberta}
          {...propsDaTarefaAberta(tarefaAberta)}
          aoFechar={() => definirTarefaAberta(null)}
          aoRecolher={() => mudarModoTarefa("painel")}
        />
      ) : null}

      <DialogoNome
        aberto={criandoColuna}
        titulo="Nova coluna"
        descricao="Vira uma pasta nova dentro de _kanban/, exatamente como as outras."
        rotulo="Nome da coluna"
        textoBotao="Criar coluna"
        aoFechar={() => definirCriandoColuna(false)}
        aoConfirmar={async (nome) => {
          const resposta = await acaoCriarColuna(quadro.nome, nome);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoNome
        aberto={colunaParaRenomear !== null}
        titulo="Renomear coluna"
        descricao="A pasta é renomeada no disco junto."
        rotulo="Novo nome"
        valorInicial={colunaParaRenomear ?? ""}
        textoBotao="Renomear"
        aoFechar={() => definirColunaParaRenomear(null)}
        aoConfirmar={async (nome) => {
          if (!colunaParaRenomear) return null;
          const resposta = await acaoRenomearColuna(quadro.nome, colunaParaRenomear, nome);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoNome
        aberto={colunaParaWip !== null}
        titulo={`Limite de WIP em ${colunaParaWip ?? ""}`}
        descricao="Quantas tarefas cabem nesta coluna ao mesmo tempo. O cabeçalho fica vermelho ao passar, e mover mais uma para cá pede confirmação. Em branco tira o limite."
        rotulo="Limite"
        valorInicial={colunaParaWip ? String(conteudo.config.wip?.[colunaParaWip] ?? "") : ""}
        textoBotao="Guardar"
        permitirVazio
        aoFechar={() => definirColunaParaWip(null)}
        aoConfirmar={async (valor) => {
          if (!colunaParaWip) return null;
          const limpo = valor.trim();
          const numero = limpo === "" ? null : Number.parseInt(limpo, 10);
          if (numero !== null && (!Number.isInteger(numero) || numero < 1)) return "Informe um número inteiro maior que zero.";
          const resposta = await acaoDefinirLimiteWip(quadro.nome, colunaParaWip, numero);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={confirmandoExclusaoEmLote}
        titulo={`Excluir ${selecionadas.size} ${selecionadas.size === 1 ? "tarefa" : "tarefas"}?`}
        descricao="Vão para a lixeira, dá para restaurar depois."
        textoBotao="Mandar para a lixeira"
        aoFechar={() => definirConfirmandoExclusaoEmLote(false)}
        aoConfirmar={async () => {
          definirConfirmandoExclusaoEmLote(false);
          await emLote((caminho) => acaoExcluirTarefa(caminho));
          return null;
        }}
      />

      {gerenciandoSprints ? (
        <DialogoSprints sprints={sprints} aoFechar={() => definirGerenciandoSprints(false)} />
      ) : null}

      <DialogoNome
        aberto={ajustandoArquivo}
        titulo="Arquivar sozinho"
        descricao={`Depois de quantos dias em ${conteudo.config.colunasConcluidas.join(" ou ")} a tarefa sai do quadro para o arquivo. 0 desliga. Só vale para tarefas movidas depois desta versão — as de antes ficam até alguém arquivar à mão.`}
        rotulo="Dias"
        valorInicial={String(conteudo.config.arquivarApos ?? 30)}
        textoBotao="Guardar"
        aoFechar={() => definirAjustandoArquivo(false)}
        aoConfirmar={async (valor) => {
          const dias = Number.parseInt(valor.trim(), 10);
          if (!Number.isInteger(dias) || dias < 0) return "Informe um número de dias (0 desliga).";
          const resposta = await acaoDefinirArquivarApos(quadro.nome, dias);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={movimentoPendente !== null}
        titulo={`${movimentoPendente?.coluna ?? ""} já está no limite`}
        descricao={`A coluna tem ${movimentoPendente ? contagemDaColuna(movimentoPendente.coluna) : 0} tarefas e o limite é ${movimentoPendente ? (conteudo.config.wip?.[movimentoPendente.coluna] ?? 0) : 0}. Mover assim mesmo?`}
        textoBotao="Mover assim mesmo"
        aoFechar={() => definirMovimentoPendente(null)}
        aoConfirmar={async () => {
          if (!movimentoPendente) return null;
          const pendente = movimentoPendente;
          definirMovimentoPendente(null);
          await moverTarefaPara(pendente.origem, pendente.coluna, true);
          return null;
        }}
      />

      <DialogoConfirmar
        aberto={colunaParaExcluir !== null}
        titulo={`Excluir a coluna ${colunaParaExcluir ?? ""}?`}
        descricao="Só dá pra excluir uma coluna vazia — mova ou exclua as tarefas dela antes."
        textoBotao="Excluir coluna"
        aoFechar={() => definirColunaParaExcluir(null)}
        aoConfirmar={async () => {
          if (!colunaParaExcluir) return null;
          const resposta = await acaoExcluirColuna(quadro.nome, colunaParaExcluir);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={tarefaParaExcluir !== null}
        titulo={`Excluir "${tarefaParaExcluir ? mapa[tarefaParaExcluir]?.titulo : ""}"?`}
        descricao="Vai para a lixeira, dá para restaurar depois."
        textoBotao="Mandar para a lixeira"
        aoFechar={() => definirTarefaParaExcluir(null)}
        aoConfirmar={async () => {
          if (!tarefaParaExcluir) return null;
          const resposta = await acaoExcluirTarefa(tarefaParaExcluir);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />
    </div>
  );
}

/** Botão de filtro (etiqueta/prioridade/sprint): pílula com nome do filtro ativo + um "x" pra limpar ao lado. */
function FiltroMenu({
  rotulo,
  ativo,
  aoLimpar,
  children,
}: {
  rotulo: string;
  ativo: boolean;
  aoLimpar: () => void;
  children: (fechar: () => void) => React.ReactNode;
}) {
  return (
    <div className="flex items-center">
      <Menu
        alinhamento="esquerda"
        gatilho={(abrir) => (
          <button
            type="button"
            onClick={abrir}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors",
              ativo
                ? "border-[var(--realce)] bg-realce-fraco font-medium text-tinta"
                : "border-linha text-tinta-2 hover:bg-realce-fraco",
            )}
          >
            {rotulo}
          </button>
        )}
      >
        {children}
      </Menu>
      {ativo ? (
        <button
          type="button"
          onClick={aoLimpar}
          aria-label={`Limpar filtro de ${rotulo}`}
          className="ml-0.5 rounded-md p-1 text-tinta-3 hover:bg-realce-medio hover:text-tinta"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

/** Lista de sprints com criação rápida embutida — reaproveitado no filtro e no editor de tarefa. */
function SeletorSprintConteudo({
  sprints,
  selecionada,
  aoEscolher,
}: {
  sprints: SprintKanban[];
  selecionada: string | null;
  aoEscolher: (id: string | null) => void;
}) {
  const roteador = useRouter();
  const [criando, definirCriando] = useState(false);
  const [nome, definirNome] = useState("");
  const [erro, definirErro] = useState<string | null>(null);

  async function criar() {
    if (!nome.trim()) return;
    const resposta = await acaoCriarSprint(nome);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirNome("");
    definirCriando(false);
    definirErro(null);
    roteador.refresh();
  }

  const abertas = sprints.filter((sprint) => !sprint.fechadaEm);

  return (
    <div className="max-h-64 overflow-y-auto">
      {abertas.length === 0 ? (
        <p className="px-2 py-2 text-[12px] leading-snug text-tinta-3">Nenhuma sprint aberta.</p>
      ) : (
        abertas.map((sprint) => (
          <div key={sprint.id} className="group/sprint flex items-center gap-1">
            <button
              type="button"
              onClick={() => aoEscolher(sprint.id)}
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
            >
              <ListChecks size={12} className="shrink-0 text-tinta-3" />
              <span className="flex-1 truncate">{sprint.nome}</span>
              {sprint.fim ? (
                <span className="shrink-0 text-[10.5px] text-tinta-3 tabular-nums" title={`Até ${sprint.fim}`}>
                  {sprint.fim.slice(8, 10)}/{sprint.fim.slice(5, 7)}
                </span>
              ) : null}
              {selecionada === sprint.id ? <Check size={13} style={{ color: "var(--realce)" }} /> : null}
            </button>
            <button
              type="button"
              onClick={async (evento) => {
                evento.stopPropagation();
                const resposta = await acaoExcluirSprint(sprint.id);
                if (resposta.ok) roteador.refresh();
              }}
              aria-label={`Excluir a sprint ${sprint.nome}`}
              className="shrink-0 rounded-md p-1 text-tinta-3 opacity-0 hover:bg-realce-medio hover:text-perigo group-hover/sprint:opacity-100"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))
      )}

      <div className="mt-1 border-t border-linha pt-1">
        {criando ? (
          <form
            onSubmit={(evento) => {
              evento.preventDefault();
              criar();
            }}
            className="flex items-center gap-1 px-1 py-1"
          >
            <Campo
              autoFocus
              value={nome}
              placeholder="Nome da sprint"
              maxLength={60}
              onChange={(evento) => definirNome(evento.target.value)}
              className="h-7 text-[12px]"
            />
            <button type="submit" className="shrink-0 rounded-md p-1.5 text-tinta-2 hover:bg-realce-fraco hover:text-tinta">
              <Check size={13} />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => definirCriando(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-tinta-3 hover:bg-realce-fraco hover:text-tinta"
          >
            <Plus size={13} />
            Nova sprint
          </button>
        )}
        <Aviso>{erro}</Aviso>
      </div>
    </div>
  );
}

/**
 * Sprints com o que a lista do seletor não tem espaço para mostrar: início
 * e fim opcionais, e o "Fechar sprint" — que pergunta o que fazer com o que
 * sobrou (mover para outra sprint aberta, ou soltar). Sem burndown.
 */
function DialogoSprints({ sprints, aoFechar }: { sprints: SprintKanban[]; aoFechar: () => void }) {
  const roteador = useRouter();
  const [fechando, definirFechando] = useState<SprintKanban | null>(null);
  const [destino, definirDestino] = useState<string | null>(null);
  const [erro, definirErro] = useState<string | null>(null);
  const abertas = sprints.filter((sprint) => !sprint.fechadaEm);
  const fechadas = sprints.filter((sprint) => sprint.fechadaEm);

  async function mudarData(sprint: SprintKanban, campo: "inicio" | "fim", valor: string) {
    const inicio = campo === "inicio" ? valor || null : (sprint.inicio ?? null);
    const fim = campo === "fim" ? valor || null : (sprint.fim ?? null);
    const resposta = await acaoDefinirDatasDaSprint(sprint.id, inicio, fim);
    if (!resposta.ok) definirErro(resposta.erro);
    else {
      definirErro(null);
      roteador.refresh();
    }
  }

  async function fechar() {
    if (!fechando) return;
    const resposta = await acaoFecharSprint(fechando.id, destino);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirFechando(null);
    definirDestino(null);
    roteador.refresh();
  }

  return (
    <Dialogo titulo="Sprints" descricao="Início e fim são só para saber quando é; fechar a sprint decide o que fazer com o que sobrou." aberto largura="max-w-lg" aoFechar={aoFechar}>
      {abertas.length === 0 ? (
        <p className="py-3 text-[12.5px] text-tinta-3">Nenhuma sprint aberta. Crie uma pelo filtro “Sprint” do quadro.</p>
      ) : (
        <ul className="space-y-2">
          {abertas.map((sprint) => (
            <li key={sprint.id} className="rounded-lg border border-linha bg-superficie p-2.5">
              <div className="flex items-center gap-2">
                <ListChecks size={13} className="shrink-0 text-tinta-3" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{sprint.nome}</span>
                <Botao variante="sutil" onClick={() => definirFechando(sprint)}>
                  <CheckCheck size={13} />
                  Fechar sprint
                </Botao>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">
                  Início
                  <input
                    type="date"
                    defaultValue={sprint.inicio ?? ""}
                    onChange={(evento) => mudarData(sprint, "inicio", evento.target.value)}
                    className="mt-1 block w-full rounded-lg border border-linha bg-superficie-alta px-2 py-1 text-[12.5px] font-normal tracking-normal text-tinta normal-case focus:border-[var(--realce)] focus:outline-none"
                  />
                </label>
                <label className="text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">
                  Fim
                  <input
                    type="date"
                    defaultValue={sprint.fim ?? ""}
                    onChange={(evento) => mudarData(sprint, "fim", evento.target.value)}
                    className="mt-1 block w-full rounded-lg border border-linha bg-superficie-alta px-2 py-1 text-[12.5px] font-normal tracking-normal text-tinta normal-case focus:border-[var(--realce)] focus:outline-none"
                  />
                </label>
              </div>
            </li>
          ))}
        </ul>
      )}

      {fechando ? (
        <div className="mt-4 rounded-lg border border-linha bg-superficie p-3">
          <p className="text-[12.5px] font-medium">Fechar “{fechando.nome}”</p>
          <p className="mt-0.5 text-[12px] text-tinta-2">
            O que já está concluído fica registrado nela. O que sobrou:
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-[12.5px]">
              <input type="radio" name="destino" checked={destino === null} onChange={() => definirDestino(null)} />
              fica sem sprint
            </label>
            {abertas
              .filter((sprint) => sprint.id !== fechando.id)
              .map((sprint) => (
                <label key={sprint.id} className="flex items-center gap-2 text-[12.5px]">
                  <input type="radio" name="destino" checked={destino === sprint.id} onChange={() => definirDestino(sprint.id)} />
                  vai para {sprint.nome}
                </label>
              ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Botao variante="sutil" onClick={() => definirFechando(null)}>
              Cancelar
            </Botao>
            <Botao variante="primario" onClick={fechar}>
              <CheckCheck size={13} />
              Fechar sprint
            </Botao>
          </div>
        </div>
      ) : null}

      {fechadas.length > 0 ? (
        <p className="mt-4 text-[11.5px] text-tinta-3">
          Fechadas: {fechadas.map((sprint) => sprint.nome).join(", ")}. Continuam no filtro do quadro pelo histórico das tarefas.
        </p>
      ) : null}
      <Aviso>{erro}</Aviso>
    </Dialogo>
  );
}

function CartaoTarefa({
  tarefa,
  etiquetasKanban,
  sprints,
  pendentes,
  corDaColuna,
  outrasColunas,
  atrasada,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
  aoAbrir,
  selecionada,
  aoSelecionar,
  aberta,
  sigla,
  diasParada,
  aoEntrarMouse,
  aoSairMouse,
  aoMoverPara,
  aoDuplicar,
  aoArquivar,
  aoFavoritar,
  aoDefinirPrioridade,
  aoTirarImpedimento,
  aoExcluir,
}: {
  tarefa: TarefaKanban;
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
  /** É a tarefa aberta no painel — ganha o mesmo destaque do cartão aberto das notas. */
  aberta: boolean;
  /** Sigla do quadro, para o identificador "TRB-14". */
  sigla: string;
  /** Dias parada nesta coluna (0 na coluna de conclusão) — passando de 14, o cartão esmaece e avisa. */
  diasParada: number;
  aoEntrarMouse: () => void;
  aoSairMouse: () => void;
  /** Quantas dependências desta tarefa ainda não chegaram na coluna de conclusão. */
  pendentes: number;
  corDaColuna: string;
  outrasColunas: string[];
  atrasada: boolean;
  sobrevoo: Sobrevoo;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltar: (origem: string, antes: boolean) => void;
  aoAbrir: () => void;
  /** Faz parte da seleção múltipla (Ctrl/Shift+clique). */
  selecionada: boolean;
  aoSelecionar: (evento: React.MouseEvent) => void;
  aoMoverPara: (coluna: string) => void;
  aoDuplicar: () => void;
  aoArquivar: () => void;
  aoFavoritar: () => void;
  aoDefinirPrioridade: (prioridade: Prioridade | null) => void;
  aoTirarImpedimento: () => void;
  aoExcluir: () => void;
}) {
  const etiquetasDaTarefa = tarefa.etiquetas
    .map((id) => etiquetasKanban.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is EtiquetaKanban => Boolean(etiqueta));
  const sprint = tarefa.sprintId ? sprints.find((s) => s.id === tarefa.sprintId) : null;
  const feitas = tarefa.subtarefas.filter((item) => item.feita).length;
  const impedida = tarefa.impedimento !== null;
  const envelhecida = diasParada >= DIAS_PARA_ENVELHECER;

  return (
    <div className="group relative" onMouseEnter={aoEntrarMouse} onMouseLeave={aoSairMouse}>
      {sobrevoo ? (
        <span
          className="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full"
          style={{ background: "var(--realce)", [sobrevoo.antes ? "top" : "bottom"]: "-4px" }}
          aria-hidden
        />
      ) : null}
      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(evento) => iniciarArrastoDeTarefa(evento, tarefa.caminho)}
        onDragOver={(evento) => {
          if (!trazTarefa(evento)) return;
          evento.preventDefault();
          // Sem isto, o `dragover` também dispara no `onDragOver` da coluna
          // por baixo (o evento borbulha) — o card já decidiu antes/depois
          // pela posição exata do cursor; a coluna não precisa opinar de novo.
          evento.stopPropagation();
          evento.dataTransfer.dropEffect = "move";
          const retangulo = evento.currentTarget.getBoundingClientRect();
          aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2);
        }}
        onDragLeave={aoSairDeCima}
        onDrop={(evento) => {
          if (!trazTarefa(evento)) return;
          evento.preventDefault();
          // Essencial: sem isto, o mesmo `drop` borbulha até a coluna por
          // baixo do card e o `onDrop` dela roda de novo pro mesmo evento —
          // a tarefa acabava movida (ou reordenada) duas vezes, e como o
          // card já tinha saído da coluna de origem na primeira vez, a
          // segunda rodada duplicava ele na tela.
          evento.stopPropagation();
          const retangulo = evento.currentTarget.getBoundingClientRect();
          const antes = evento.clientY < retangulo.top + retangulo.height / 2;
          aoSoltar(lerCaminhoDeTarefa(evento), antes);
        }}
        onClick={(evento) => {
          // Ctrl/Cmd/Shift + clique seleciona em vez de abrir.
          if (evento.ctrlKey || evento.metaKey || evento.shiftKey) {
            evento.preventDefault();
            aoSelecionar(evento);
            return;
          }
          aoAbrir();
        }}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            aoAbrir();
          }
        }}
        aria-pressed={selecionada || undefined}
        className={clsx(
          "cartao block w-full cursor-grab overflow-hidden pr-7 text-left active:cursor-grabbing",
          aberta && "cartao-aberto",
          selecionada && "ring-2 ring-[var(--realce)] ring-offset-1 ring-offset-superficie",
          impedida && "border-[color-mix(in_srgb,var(--perigo)_45%,var(--linha))]",
          // Parado há semanas na mesma coluna: esmaece um pouco — é como se
          // acha o que travou sem ninguém ter marcado impedimento.
          envelhecida && !aberta && "opacity-85",
        )}
        style={{
          borderLeft: `3px solid ${impedida ? "var(--perigo)" : corDaColuna}`,
          // Cor própria do cartão: faixa fina no topo, sem tomar o fundo.
          boxShadow: tarefa.cor ? `inset 0 3px 0 ${tarefa.cor}` : undefined,
        }}
      >
        {impedida ? (
          <div
            // O cartão tem `pr-7` (espaço do menu de três pontos), então a
            // faixa precisa puxar essa margem também — só `-mx-3` deixava um
            // pedaço sem cor no canto direito.
            className="-mt-2.5 -mr-7 -ml-3 mb-2 flex items-center gap-1.5 py-1 pr-7 pl-3"
            style={{ background: "color-mix(in srgb, var(--perigo) 12%, transparent)" }}
          >
            <OctagonAlert size={11} className="shrink-0 text-perigo" aria-hidden />
            <span className="truncate text-[10.5px] font-bold tracking-[0.04em] text-perigo uppercase">
              Impedido
            </span>
            {tarefa.impedimento ? (
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-perigo/90" title={tarefa.impedimento}>
                · {tarefa.impedimento}
              </span>
            ) : null}
          </div>
        ) : null}

        <p
          className="mb-0.5 font-mono text-[10px] tracking-wide text-tinta-3"
          title={`Criada em ${formatarDataHora(tarefa.criadoEm)}`}
        >
          {sigla}-{tarefa.numero}
        </p>
        <div className="flex items-start gap-1.5">
          {tarefa.favorita ? <Star size={11} className="mt-0.5 shrink-0 fill-current text-[#c69214]" /> : null}
          <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-tinta">{tarefa.titulo}</span>
        </div>
        {etiquetasDaTarefa.length > 0 || sprint ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {sprint ? (
              <span className="pastilha text-tinta-2" style={{ background: "var(--realce-fraco)" }}>
                <ListChecks size={10} />
                {sprint.nome}
              </span>
            ) : null}
            {etiquetasDaTarefa.map((etiqueta) => (
              <span
                key={etiqueta.id}
                className="pastilha"
                style={{
                  color: `color-mix(in srgb, ${etiqueta.cor} 82%, var(--tinta))`,
                  background: `color-mix(in srgb, ${etiqueta.cor} 14%, transparent)`,
                }}
              >
                {etiqueta.nome}
              </span>
            ))}
          </div>
        ) : null}

        {envelhecida ? (
          <p className="mt-1.5 text-[10.5px] text-tinta-3" title={`Nesta coluna desde ${formatarDataHora(tarefa.movidoEm)}`}>
            há {diasParada} dias aqui
          </p>
        ) : null}

        {/* Rodapé com posições fixas: à esquerda prazo · checklist · comentários,
            à direita estimativa · cadeado · prioridade. O olho acha o prazo no
            mesmo lugar em qualquer cartão — antes os indicadores apareciam na
            ordem em que existiam. */}
        {tarefa.prazo ||
        tarefa.subtarefas.length > 0 ||
        tarefa.comentarios.length > 0 ||
        tarefa.estimativa ||
        pendentes > 0 ||
        tarefa.prioridade ? (
          <div className="mt-2 flex items-center gap-2 text-[10.5px] text-tinta-3 tabular-nums">
            {tarefa.prazo ? (
              <span
                className={clsx("flex items-center gap-1", atrasada && "font-semibold text-perigo")}
                title={atrasada ? "Prazo estourado" : "Prazo"}
              >
                <Calendar size={10} />
                {formatarPrazo(tarefa.prazo)}
              </span>
            ) : null}
            {tarefa.subtarefas.length > 0 ? (
              <span
                className={clsx("flex items-center gap-1", feitas === tarefa.subtarefas.length && "text-[#639922]")}
                title={`${feitas} de ${tarefa.subtarefas.length} subtarefas concluídas`}
              >
                <CheckSquare size={10} />
                {feitas}/{tarefa.subtarefas.length}
              </span>
            ) : null}
            {tarefa.comentarios.length > 0 ? (
              <span
                className="flex items-center gap-1"
                title={`${tarefa.comentarios.length} ${tarefa.comentarios.length === 1 ? "comentário" : "comentários"}`}
              >
                <MessageSquare size={10} />
                {tarefa.comentarios.length}
              </span>
            ) : null}
            <span className="ml-auto flex items-center gap-2">
              {tarefa.estimativa ? (
                <span className="rounded border border-linha px-1 font-semibold" title={`Estimativa ${tarefa.estimativa}`}>
                  {tarefa.estimativa}
                </span>
              ) : null}
              {pendentes > 0 ? (
                <span
                  className="flex items-center gap-0.5 text-perigo"
                  title={`Bloqueada por ${pendentes} tarefa${pendentes === 1 ? "" : "s"} não concluída${pendentes === 1 ? "" : "s"}`}
                >
                  <Lock size={10} />
                  {pendentes}
                </span>
              ) : null}
              {tarefa.prioridade ? (
                <Flag
                  size={11}
                  style={{ color: CORES_PRIORIDADE[tarefa.prioridade] }}
                  aria-label={`Prioridade ${RUBRICA_PRIORIDADE[tarefa.prioridade]}`}
                />
              ) : null}
            </span>
          </div>
        ) : null}
      </div>

      <div className="absolute top-1.5 right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu
          alinhamento="direita"
          gatilho={(abrir) => (
            <BotaoIcone
              rotulo="Ações da tarefa"
              onClick={(evento) => {
                evento.stopPropagation();
                abrir();
              }}
              className="size-6"
            >
              <MoreHorizontal size={13} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              {outrasColunas.length > 0 ? (
                <>
                  <RotuloMenu>Mover para</RotuloMenu>
                  {outrasColunas.map((coluna) => (
                    <ItemMenu
                      key={coluna}
                      onClick={() => {
                        fechar();
                        aoMoverPara(coluna);
                      }}
                    >
                      {coluna}
                    </ItemMenu>
                  ))}
                  <SeparadorMenu />
                </>
              ) : null}

              <RotuloMenu>Prioridade</RotuloMenu>
              {PRIORIDADES.map((prioridade) => (
                <ItemMenu
                  key={prioridade}
                  icone={<Flag size={13} style={{ color: CORES_PRIORIDADE[prioridade] }} />}
                  onClick={() => {
                    fechar();
                    aoDefinirPrioridade(tarefa.prioridade === prioridade ? null : prioridade);
                  }}
                >
                  {RUBRICA_PRIORIDADE[prioridade]}
                  {tarefa.prioridade === prioridade ? " ✓" : ""}
                </ItemMenu>
              ))}
              {tarefa.prioridade ? (
                <ItemMenu
                  icone={<FlagOff size={13} />}
                  onClick={() => {
                    fechar();
                    aoDefinirPrioridade(null);
                  }}
                >
                  Remover prioridade
                </ItemMenu>
              ) : null}

              <SeparadorMenu />
              <ItemMenu
                icone={<Copy size={13} />}
                onClick={() => {
                  fechar();
                  aoDuplicar();
                }}
              >
                Duplicar tarefa
              </ItemMenu>
              <ItemMenu
                icone={<Star size={13} />}
                onClick={() => {
                  fechar();
                  aoFavoritar();
                }}
              >
                {tarefa.favorita ? "Desfavoritar" : "Favoritar"}
              </ItemMenu>
              {impedida ? (
                <ItemMenu
                  icone={<OctagonAlert size={13} />}
                  onClick={() => {
                    fechar();
                    aoTirarImpedimento();
                  }}
                >
                  Tirar impedimento
                </ItemMenu>
              ) : null}

              <SeparadorMenu />
              <ItemMenu
                icone={<Archive size={13} />}
                onClick={() => {
                  fechar();
                  aoArquivar();
                }}
              >
                Arquivar
              </ItemMenu>
              <ItemMenu
                icone={<Trash2 size={13} />}
                perigo
                onClick={() => {
                  fechar();
                  aoExcluir();
                }}
              >
                Excluir
              </ItemMenu>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}

/**
 * O campo de tarefa nova, com a adição rápida: enquanto se digita, o que
 * `!`, `#`, `@`, `~` e `=` já reconheceram aparece em pastilhas embaixo —
 * dá para ver "Alta · Financeiro · 18/09" antes de dar Enter.
 */
function CampoNovaTarefa({
  etiquetasKanban,
  sprints,
  aoConfirmar,
  aoCancelar,
}: {
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
  aoConfirmar: (titulo: string) => void;
  aoCancelar: () => void;
}) {
  const [valor, definirValor] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);
  const previa = interpretarAdicaoRapida(valor, etiquetasKanban, sprints);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <div className="cartao">
      <textarea
        ref={campo}
        value={valor}
        onChange={(evento) => definirValor(evento.target.value)}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" && !evento.shiftKey) {
            evento.preventDefault();
            aoConfirmar(valor);
          }
          if (evento.key === "Escape") aoCancelar();
        }}
        onBlur={() => aoConfirmar(valor)}
        placeholder="Título… (!alta #etiqueta @sexta ~sprint =M)"
        rows={2}
        className="w-full resize-none bg-transparent text-[13px] text-tinta placeholder:text-tinta-3 focus:outline-none"
      />
      {previa.reconhecidos.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-1">
          {previa.reconhecidos.map((item) => (
            <span
              key={item.original}
              className="pastilha text-tinta-2"
              style={{ background: "var(--realce-fraco)" }}
              title={item.original}
            >
              {item.tipo === "prioridade" ? <Flag size={10} /> : item.tipo === "prazo" ? <Calendar size={10} /> : null}
              {item.rotulo}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type PropsConteudoTarefa = {
  tarefa: TarefaKanban;
  /** Todas as tarefas do quadro (qualquer coluna) — pra escolher dependência. */
  todasTarefas: TarefaKanban[];
  etiquetasKanban: EtiquetaKanban[];
  nomeDoQuadro: string;
  sprints: SprintKanban[];
  /** Avisa o quadro pra atualizar a tarefa na hora (etiquetas, dependências…), sem esperar um refresh. */
  aoAtualizar: (patch: Partial<TarefaKanban>) => void;
  aoExcluir: () => void;
  aoRenomear: (novoTitulo: string) => Promise<string | null>;
  aoDefinirImpedimento: (motivo: string | null) => void;
  aoDefinirSubtarefas: (subtarefas: Subtarefa[]) => void;
  /** Devolve a mensagem de erro, ou `null` quando deu certo. */
  aoAdicionarComentario: (texto: string) => Promise<string | null>;
  aoExcluirComentario: (id: string) => void;
  /** Ao abrir, põe o foco no campo de prazo (atalho `d`). */
  focarPrazo?: boolean;
};

/**
 * O editor de uma tarefa: descrição em markdown, subtarefas, comentários e
 * as propriedades (impedimento, prioridade, prazo, sprint, etiquetas,
 * "bloqueado por", estimativa, repetição).
 *
 * É o mesmo conteúdo nas duas roupas: no painel lateral (`compacto`, tudo
 * empilhado numa coluna de ~460px) e na tela cheia (duas colunas, como o
 * diálogo de antes). O painel é o padrão porque o quadro continua à vista —
 * ler uma tarefa, olhar a coluna, abrir a próxima, sem fechar e reabrir.
 */
function ConteudoTarefa({
  tarefa,
  todasTarefas,
  etiquetasKanban,
  nomeDoQuadro,
  sprints,
  aoAtualizar,
  aoExcluir,
  aoDefinirImpedimento,
  aoDefinirSubtarefas,
  aoAdicionarComentario,
  aoExcluirComentario,
  focarPrazo = false,
  compacto,
}: Omit<PropsConteudoTarefa, "aoRenomear"> & { compacto: boolean }) {
  const caminho = tarefa.caminho;
  const [carregando, definirCarregando] = useState(true);
  const [conteudo, definirConteudo] = useState("");
  const [modoDescricao, definirModoDescricao] = useState<"leitura" | "edicao">("leitura");
  const [rascunho, definirRascunho] = useState("");
  const [salvandoDescricao, definirSalvandoDescricao] = useState(false);
  const [confirmandoExclusao, definirConfirmandoExclusao] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const campoPrazo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelado = false;
    definirCarregando(true);
    acaoLerTarefa(caminho).then((lida) => {
      if (cancelado || !lida) return;
      definirConteudo(lida.conteudo);
      definirRascunho(lida.conteudo);
      // Tarefa recém-criada (ainda sem corpo) já nasce em edição — economiza
      // um clique em "Editar" pra quem só quer começar a escrever.
      definirModoDescricao(lida.conteudo.trim() ? "leitura" : "edicao");
      definirCarregando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [caminho]);

  useEffect(() => {
    if (focarPrazo && !carregando) campoPrazo.current?.focus();
  }, [focarPrazo, carregando, caminho]);

  async function salvarDescricao() {
    definirSalvandoDescricao(true);
    const resposta = await acaoSalvarTarefa(caminho, rascunho);
    definirSalvandoDescricao(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirConteudo(rascunho);
    definirErro(null);
    definirModoDescricao("leitura");
  }

  const dependencias = tarefa.dependeDe
    .map((caminhoDep) => todasTarefas.find((item) => item.caminho === caminhoDep))
    .filter((item): item is TarefaKanban => Boolean(item));
  const candidatas = todasTarefas.filter(
    (item) => item.caminho !== caminho && !tarefa.dependeDe.includes(item.caminho),
  );
  const sprintAtual = tarefa.sprintId ? sprints.find((s) => s.id === tarefa.sprintId) : null;

  async function mudarDependencias(novaLista: string[]) {
    aoAtualizar({ dependeDe: novaLista });
    await acaoDefinirDependencias(caminho, novaLista);
  }

  async function mudarPrioridade(prioridade: Prioridade | null) {
    aoAtualizar({ prioridade });
    await acaoDefinirPrioridade(caminho, prioridade);
  }

  async function mudarPrazo(prazo: string | null) {
    aoAtualizar({ prazo });
    await acaoDefinirPrazo(caminho, prazo);
  }

  async function mudarSprint(sprintId: string | null) {
    aoAtualizar({ sprintId });
    await acaoDefinirSprintDaTarefa(caminho, sprintId);
  }

  async function mudarEstimativa(estimativa: Estimativa | null) {
    aoAtualizar({ estimativa });
    await acaoDefinirEstimativa(caminho, estimativa);
  }

  async function mudarRecorrencia(recorrencia: Recorrencia | null) {
    aoAtualizar({ recorrencia });
    await acaoDefinirRecorrencia(caminho, recorrencia);
  }

  async function mudarCor(cor: string | null) {
    aoAtualizar({ cor });
    await acaoDefinirCorDaTarefa(caminho, cor);
  }

  if (carregando) {
    return <p className="py-8 text-center text-[12.5px] text-tinta-3">Carregando…</p>;
  }

  const principal = (
    <div className="min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Descrição</p>
                {modoDescricao === "leitura" ? (
                  <button
                    type="button"
                    onClick={() => {
                      definirRascunho(conteudo);
                      definirModoDescricao("edicao");
                    }}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta"
                  >
                    <Pencil size={11} />
                    Editar
                  </button>
                ) : null}
              </div>

              {modoDescricao === "leitura" ? (
                <div className="prosa mt-1.5 max-h-[46vh] min-h-[140px] min-w-0 overflow-y-auto rounded-lg border border-linha bg-superficie px-3 py-2.5">
                  <VisualizadorMarkdown conteudo={conteudo} />
                </div>
              ) : (
                <>
                  <textarea
                    value={rascunho}
                    onChange={(evento) => definirRascunho(evento.target.value)}
                    placeholder="Descrição, checklist, o que quiser — em markdown."
                    rows={14}
                    autoFocus
                    className="editor-texto mt-1.5 w-full resize-none rounded-lg border border-linha bg-superficie px-3 py-2.5 text-[13px] text-tinta placeholder:text-tinta-3 focus:border-[var(--realce)] focus:outline-none"
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    {conteudo.trim() ? (
                      <Botao
                        variante="sutil"
                        onClick={() => {
                          definirRascunho(conteudo);
                          definirModoDescricao("leitura");
                        }}
                      >
                        Cancelar
                      </Botao>
                    ) : null}
                    <Botao variante="primario" disabled={salvandoDescricao} onClick={salvarDescricao}>
                      <Check size={13} />
                      Salvar
                    </Botao>
                  </div>
                </>
              )}

              <ListaSubtarefas subtarefas={tarefa.subtarefas} aoMudar={aoDefinirSubtarefas} />

              <MuralComentarios
                comentarios={tarefa.comentarios}
                aoAdicionar={aoAdicionarComentario}
                aoExcluir={aoExcluirComentario}
              />

              <Aviso>{erro}</Aviso>
            </div>
  );

  const lateral = (
    // No painel, duas colunas de campos curtos (prioridade e prazo lado a
    // lado, e assim por diante) para a descrição não descer demais.
    <div className={clsx(compacto ? "grid grid-cols-2 gap-x-4 gap-y-3" : "flex flex-col gap-4 sm:border-l sm:border-linha sm:pl-5")}>
              <CampoLateral rotulo="Impedimento" className="col-span-2">
                <CampoImpedimento motivo={tarefa.impedimento} aoMudar={aoDefinirImpedimento} />
              </CampoLateral>

              <CampoLateral rotulo="Prioridade">
                <Menu
                  alinhamento="direita"
                  gatilho={(abrir) => (
                    <button
                      type="button"
                      onClick={abrir}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-linha px-2.5 py-1.5 text-[12.5px] text-tinta-2 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                    >
                      <Flag
                        size={12}
                        style={tarefa.prioridade ? { color: CORES_PRIORIDADE[tarefa.prioridade] } : undefined}
                      />
                      {tarefa.prioridade ? RUBRICA_PRIORIDADE[tarefa.prioridade] : "Nenhuma"}
                    </button>
                  )}
                >
                  {(fechar) => (
                    <>
                      {PRIORIDADES.map((prioridade) => (
                        <button
                          key={prioridade}
                          type="button"
                          onClick={() => {
                            mudarPrioridade(prioridade);
                            fechar();
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
                        >
                          <Flag size={12} style={{ color: CORES_PRIORIDADE[prioridade] }} />
                          <span className="flex-1 truncate">{RUBRICA_PRIORIDADE[prioridade]}</span>
                          {tarefa.prioridade === prioridade ? <Check size={13} style={{ color: "var(--realce)" }} /> : null}
                        </button>
                      ))}
                      {tarefa.prioridade ? (
                        <button
                          type="button"
                          onClick={() => {
                            mudarPrioridade(null);
                            fechar();
                          }}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] text-tinta-3 hover:bg-realce-fraco"
                        >
                          <FlagOff size={12} />
                          Remover prioridade
                        </button>
                      ) : null}
                    </>
                  )}
                </Menu>
              </CampoLateral>

              <CampoLateral rotulo="Prazo">
                <label className="flex w-full items-center gap-1.5 rounded-lg border border-linha px-2.5 py-1.5 text-[12.5px] text-tinta-2">
                  <Calendar size={12} className="shrink-0" />
                  <input
                    ref={campoPrazo}
                    type="date"
                    value={tarefa.prazo ?? ""}
                    onChange={(evento) => mudarPrazo(evento.target.value || null)}
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] text-tinta focus:outline-none"
                  />
                  {tarefa.prazo ? (
                    <button
                      type="button"
                      onClick={() => mudarPrazo(null)}
                      aria-label="Remover prazo"
                      className="shrink-0 text-tinta-3 hover:text-tinta"
                    >
                      <X size={12} />
                    </button>
                  ) : null}
                </label>
              </CampoLateral>

              <CampoLateral rotulo="Sprint">
                <Menu
                  alinhamento="direita"
                  gatilho={(abrir) => (
                    <button
                      type="button"
                      onClick={abrir}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-linha px-2.5 py-1.5 text-[12.5px] text-tinta-2 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                    >
                      <ListChecks size={12} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{sprintAtual ? sprintAtual.nome : "Nenhuma"}</span>
                    </button>
                  )}
                >
                  {() => (
                    <SeletorSprintConteudo
                      sprints={sprints}
                      selecionada={tarefa.sprintId}
                      aoEscolher={(id) => mudarSprint(tarefa.sprintId === id ? null : id)}
                    />
                  )}
                </Menu>
              </CampoLateral>

              <CampoLateral rotulo="Etiquetas" className="col-span-2">
                <SeletorEtiquetasKanban
                  caminho={caminho}
                  quadro={nomeDoQuadro}
                  etiquetasDaTarefa={tarefa.etiquetas}
                  todasEtiquetas={etiquetasKanban}
                  aoMudar={(etiquetas) => aoAtualizar({ etiquetas })}
                />
              </CampoLateral>

              <CampoLateral rotulo="Bloqueado por" className="col-span-2">
                <div className="flex flex-col gap-1.5">
                  {dependencias.map((dependencia) => (
                    <span
                      key={dependencia.caminho}
                      className="flex items-center gap-1.5 rounded-lg border border-linha bg-superficie py-1 pr-1.5 pl-2 text-[12px]"
                    >
                      <Lock
                        size={10}
                        className={clsx(
                          "shrink-0",
                          dependencia.coluna === tarefa.coluna ? "text-tinta-3" : "text-perigo",
                        )}
                      />
                      <span className="min-w-0 flex-1 truncate text-tinta-2">{dependencia.titulo}</span>
                      <button
                        type="button"
                        onClick={() => mudarDependencias(tarefa.dependeDe.filter((item) => item !== dependencia.caminho))}
                        className="shrink-0 rounded-full p-0.5 text-tinta-3 hover:bg-realce-medio hover:text-tinta"
                        aria-label={`Não depender mais de ${dependencia.titulo}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}

                  <Menu
                    alinhamento="direita"
                    gatilho={(abrir) => (
                      <button
                        type="button"
                        onClick={abrir}
                        className="flex w-full items-center gap-1 rounded-lg border border-dashed border-linha-forte px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                      >
                        <Plus size={11} />
                        depende de…
                      </button>
                    )}
                  >
                    {() => (
                      <div className="max-h-64 overflow-y-auto">
                        {candidatas.length === 0 ? (
                          <p className="px-2 py-2 text-[12px] leading-snug text-tinta-3">
                            Nenhuma outra tarefa disponível neste quadro.
                          </p>
                        ) : (
                          candidatas.map((candidata) => (
                            <button
                              key={candidata.caminho}
                              type="button"
                              onClick={() => mudarDependencias([...tarefa.dependeDe, candidata.caminho])}
                              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
                            >
                              <span className="flex-1 truncate">{candidata.titulo}</span>
                              <span className="shrink-0 text-[10.5px] text-tinta-3">{candidata.coluna}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </Menu>
                </div>
              </CampoLateral>

              <CampoLateral rotulo="Estimativa">
                <div className="flex gap-1">
                  {ESTIMATIVAS.map((opcao) => (
                    <button
                      key={opcao}
                      type="button"
                      onClick={() => mudarEstimativa(tarefa.estimativa === opcao ? null : opcao)}
                      aria-pressed={tarefa.estimativa === opcao}
                      title={`${opcao} — ${PONTOS_ESTIMATIVA[opcao]} ${PONTOS_ESTIMATIVA[opcao] === 1 ? "ponto" : "pontos"}`}
                      className={clsx(
                        "h-7 flex-1 rounded-lg border text-[12px] font-semibold transition-colors",
                        tarefa.estimativa === opcao
                          ? "border-[var(--realce)] bg-realce-medio text-tinta"
                          : "border-linha text-tinta-2 hover:border-[var(--realce)] hover:text-tinta",
                      )}
                    >
                      {opcao}
                    </button>
                  ))}
                </div>
              </CampoLateral>

              <CampoLateral rotulo="Repetir" className="col-span-2">
                <Menu
                  alinhamento="direita"
                  gatilho={(abrir) => (
                    <button
                      type="button"
                      onClick={abrir}
                      className="flex w-full items-center gap-1.5 rounded-lg border border-linha px-2.5 py-1.5 text-[12.5px] text-tinta-2 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                    >
                      <Repeat size={12} className="shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">
                        {tarefa.recorrencia ? RUBRICA_RECORRENCIA[tarefa.recorrencia] : "Não repete"}
                      </span>
                    </button>
                  )}
                >
                  {(fechar) => (
                    <>
                      {RECORRENCIAS.map((opcao) => (
                        <ItemMenu
                          key={opcao}
                          icone={<Check size={13} className={tarefa.recorrencia === opcao ? undefined : "invisible"} />}
                          onClick={() => {
                            fechar();
                            mudarRecorrencia(opcao);
                          }}
                        >
                          {RUBRICA_RECORRENCIA[opcao]}
                        </ItemMenu>
                      ))}
                      {tarefa.recorrencia ? (
                        <>
                          <SeparadorMenu />
                          <ItemMenu
                            icone={<X size={13} />}
                            onClick={() => {
                              fechar();
                              mudarRecorrencia(null);
                            }}
                          >
                            Não repetir
                          </ItemMenu>
                        </>
                      ) : null}
                    </>
                  )}
                </Menu>
                <p className="mt-1 text-[10.5px] leading-snug text-tinta-3">
                  Ao concluir, nasce uma cópia na primeira coluna com o próximo prazo.
                </p>
              </CampoLateral>

              <CampoLateral rotulo="Cor do cartão" className="col-span-2">
                <div className="flex flex-wrap gap-1.5">
                  {CORES_CARTAO.map((cor) => (
                    <button
                      key={cor}
                      type="button"
                      onClick={() => mudarCor(tarefa.cor === cor ? null : cor)}
                      aria-label={`Cor ${cor}`}
                      aria-pressed={tarefa.cor === cor}
                      className={clsx(
                        "size-5 rounded-full border-2 transition-transform hover:scale-110",
                        tarefa.cor === cor ? "border-tinta" : "border-transparent",
                      )}
                      style={{ background: cor }}
                    />
                  ))}
                  {tarefa.cor ? (
                    <button
                      type="button"
                      onClick={() => mudarCor(null)}
                      className="text-[11px] text-tinta-3 underline decoration-dotted hover:text-tinta"
                    >
                      sem cor
                    </button>
                  ) : null}
                </div>
              </CampoLateral>
            </div>
  );

  return (
    <>
      {compacto ? (
        <div className="flex flex-col gap-5">
          {lateral}
          <div className="h-px bg-linha" />
          {principal}
        </div>
      ) : (
        <div className="mt-1 grid gap-6 sm:grid-cols-[1fr_220px]">
          {principal}
          {lateral}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between border-t border-linha pt-3.5">
        <button
          type="button"
          onClick={() => definirConfirmandoExclusao(true)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-perigo hover:bg-[color-mix(in_srgb,var(--perigo)_10%,transparent)]"
        >
          <Trash2 size={13} />
          Excluir tarefa
        </button>
      </div>

          {confirmandoExclusao ? (
            <div className="mt-3 rounded-lg border border-linha bg-superficie p-3">
              <p className="text-[12.5px] text-tinta-2">
                Excluir “{tarefa.titulo}”? Vai para a lixeira, dá para restaurar depois.
              </p>
              <div className="mt-2.5 flex justify-end gap-2">
                <Botao variante="sutil" onClick={() => definirConfirmandoExclusao(false)}>
                  Cancelar
                </Botao>
                <Botao
                  variante="perigo-solido"
                  onClick={async () => {
                    const resposta = await acaoExcluirTarefa(caminho);
                    if (resposta.ok) aoExcluir();
                    else definirErro(resposta.erro);
                  }}
                >
                  Mandar para a lixeira
                </Botao>
              </div>
            </div>
          ) : null}
    </>
  );
}

/**
 * A tarefa aberta num painel ao lado do quadro — o quadro continua visível
 * e rolável, clicar noutro cartão troca o conteúdo, Esc fecha. O botão de
 * expandir leva para a tela cheia quando a descrição é longa.
 */
function PainelTarefa({
  aoFechar,
  aoExpandir,
  ...props
}: PropsConteudoTarefa & { aoFechar: () => void; aoExpandir: () => void }) {
  return (
    <aside
      className="cartao-aberto flex w-[460px] shrink-0 flex-col overflow-hidden rounded-none border-y-0 border-r-0 border-l border-linha"
      aria-label={`Tarefa ${props.tarefa.titulo}`}
    >
      <div className="flex shrink-0 items-start gap-2 border-b border-linha px-4 pt-3 pb-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-wide text-tinta-3">
            {siglaDoQuadro(props.nomeDoQuadro)}-{props.tarefa.numero} · {props.tarefa.coluna}
          </p>
          <TituloEditavel
            titulo={props.tarefa.titulo}
            aoRenomear={props.aoRenomear}
            className="text-[15px] leading-tight font-bold tracking-[-0.02em]"
          />
        </div>
        <BotaoIcone rotulo="Abrir em tela cheia" onClick={aoExpandir}>
          <Maximize2 size={14} />
        </BotaoIcone>
        <BotaoIcone rotulo="Fechar (Esc)" onClick={aoFechar}>
          <X size={15} />
        </BotaoIcone>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ConteudoTarefa {...props} compacto />
      </div>
    </aside>
  );
}

/** A mesma tarefa em tela cheia — para descrições longas. */
function DialogoTarefa({
  aoFechar,
  aoRecolher,
  ...props
}: PropsConteudoTarefa & { aoFechar: () => void; aoRecolher: () => void }) {
  return (
    <Dialogo
      titulo={props.tarefa.titulo || "Tarefa"}
      aberto
      largura="max-w-4xl"
      realcado
      aoFechar={aoFechar}
      tituloPersonalizado={
        <div className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 font-mono text-[10.5px] text-tinta-3">
            {siglaDoQuadro(props.nomeDoQuadro)}-{props.tarefa.numero}
          </span>
          <TituloEditavel
            titulo={props.tarefa.titulo}
            aoRenomear={props.aoRenomear}
            className="text-[16px] leading-tight font-bold tracking-[-0.02em]"
          />
          <BotaoIcone rotulo="Voltar para o painel lateral" onClick={aoRecolher} className="ml-auto shrink-0">
            <Minimize2 size={14} />
          </BotaoIcone>
        </div>
      }
    >
      <ConteudoTarefa {...props} compacto={false} />
    </Dialogo>
  );
}

/**
 * A checklist da tarefa: marcar é um clique, renomear é dois cliques no
 * texto, criar é digitar e dar Enter (o campo continua aberto para a
 * próxima, que é como se escreve uma lista de verdade — várias seguidas,
 * sem parar para clicar em "adicionar" toda vez), e reordenar é arrastar
 * pela alcinha que aparece ao passar o mouse.
 */
function ListaSubtarefas({
  subtarefas,
  aoMudar,
}: {
  subtarefas: Subtarefa[];
  aoMudar: (subtarefas: Subtarefa[]) => void;
}) {
  const [nova, definirNova] = useState("");
  const [sobrevoo, definirSobrevoo] = useState<{ id: string; antes: boolean } | null>(null);
  const feitas = subtarefas.filter((item) => item.feita).length;
  const campoNovo = useRef<HTMLInputElement>(null);

  function adicionar() {
    const texto = nova.trim();
    if (!texto) return;
    aoMudar([...subtarefas, { id: crypto.randomUUID(), texto, feita: false }]);
    definirNova("");
    campoNovo.current?.focus();
  }

  function aoSoltarPertoDe(origemId: string, alvoId: string, antes: boolean) {
    definirSobrevoo(null);
    if (origemId === alvoId) return;
    const ids = subtarefas.map((item) => item.id);
    const novaOrdem = calcularNovaOrdem(ids, origemId, alvoId, antes);
    if (!novaOrdem) return;
    aoMudar(novaOrdem.map((id) => subtarefas.find((item) => item.id === id)!));
  }

  return (
    <div className="mt-4 rounded-lg border border-linha bg-superficie p-2.5">
      <div className="flex items-center justify-between px-0.5">
        <p className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
          <CheckSquare size={12} />
          Subtarefas
        </p>
        {subtarefas.length > 0 ? (
          <span className="text-[11.5px] text-tinta-3 tabular-nums">
            {feitas}/{subtarefas.length}
          </span>
        ) : null}
      </div>

      {subtarefas.length > 0 ? (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-realce-medio">
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${(feitas / subtarefas.length) * 100}%`,
              background: feitas === subtarefas.length ? "#639922" : "var(--realce)",
            }}
          />
        </div>
      ) : null}

      <ul className="mt-1.5 space-y-0.5">
        {subtarefas.map((item) => (
          <LinhaSubtarefa
            key={item.id}
            item={item}
            sobrevoo={sobrevoo?.id === item.id ? sobrevoo : null}
            aoPassarPorCima={(antes) => definirSobrevoo({ id: item.id, antes })}
            aoSairDeCima={() => definirSobrevoo((atual) => (atual?.id === item.id ? null : atual))}
            aoSoltar={(origemId, antes) => aoSoltarPertoDe(origemId, item.id, antes)}
            aoAlternar={() =>
              aoMudar(subtarefas.map((atual) => (atual.id === item.id ? { ...atual, feita: !atual.feita } : atual)))
            }
            aoRenomear={(texto) =>
              aoMudar(subtarefas.map((atual) => (atual.id === item.id ? { ...atual, texto } : atual)))
            }
            aoExcluir={() => aoMudar(subtarefas.filter((atual) => atual.id !== item.id))}
          />
        ))}
      </ul>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          adicionar();
        }}
        className="mt-1.5 flex items-center gap-1.5 rounded-md border border-dashed border-linha-forte px-2 py-1 focus-within:border-[var(--realce)]"
      >
        <Plus size={13} className="shrink-0 text-tinta-3" aria-hidden />
        <input
          ref={campoNovo}
          value={nova}
          onChange={(evento) => definirNova(evento.target.value)}
          placeholder="Adicionar subtarefa…"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent py-[3px] text-[12.5px] text-tinta placeholder:text-tinta-3 focus:outline-none"
        />
        {nova.trim() ? (
          <button
            type="submit"
            aria-label="Adicionar subtarefa"
            className="shrink-0 rounded-md p-1 text-tinta-3 hover:bg-realce-medio hover:text-tinta"
          >
            <Plus size={13} />
          </button>
        ) : null}
      </form>
    </div>
  );
}

/** Uma linha da checklist — arrastável pela alça, com o texto editável em dois cliques. */
function LinhaSubtarefa({
  item,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
  aoAlternar,
  aoRenomear,
  aoExcluir,
}: {
  item: Subtarefa;
  sobrevoo: { id: string; antes: boolean } | null;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltar: (origemId: string, antes: boolean) => void;
  aoAlternar: () => void;
  aoRenomear: (texto: string) => void;
  aoExcluir: () => void;
}) {
  const [editando, definirEditando] = useState(false);
  const [valor, definirValor] = useState(item.texto);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editando) return;
    definirValor(item.texto);
    campo.current?.focus();
    campo.current?.select();
  }, [editando, item.texto]);

  function confirmar() {
    const limpo = valor.trim();
    if (limpo && limpo !== item.texto) aoRenomear(limpo);
    definirEditando(false);
  }

  return (
    <li
      draggable={!editando}
      onDragStart={(evento) => iniciarArrastoDeSubtarefa(evento, item.id)}
      onDragOver={(evento) => {
        if (!trazSubtarefa(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const retangulo = evento.currentTarget.getBoundingClientRect();
        aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2);
      }}
      onDragLeave={aoSairDeCima}
      onDrop={(evento) => {
        if (!trazSubtarefa(evento)) return;
        evento.preventDefault();
        const retangulo = evento.currentTarget.getBoundingClientRect();
        const antes = evento.clientY < retangulo.top + retangulo.height / 2;
        aoSoltar(lerIdDeSubtarefa(evento), antes);
      }}
      className={clsx(
        "group/sub relative flex items-center gap-1 rounded-md py-[3px] pr-1 pl-0.5 hover:bg-realce-fraco",
        sobrevoo ? "cursor-grabbing" : "cursor-default",
      )}
    >
      {sobrevoo ? (
        <span
          className="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full"
          style={{ background: "var(--realce)", [sobrevoo.antes ? "top" : "bottom"]: "-2px" }}
          aria-hidden
        />
      ) : null}

      <GripVertical
        size={12}
        className="shrink-0 cursor-grab text-tinta-3 opacity-0 transition-opacity group-hover/sub:opacity-100 active:cursor-grabbing"
        aria-hidden
      />

      <button
        type="button"
        onClick={aoAlternar}
        aria-pressed={item.feita}
        aria-label={item.feita ? `Desmarcar ${item.texto}` : `Marcar ${item.texto} como feita`}
        className="shrink-0 text-tinta-3 transition-colors hover:text-tinta"
      >
        {item.feita ? <CheckSquare size={14} style={{ color: "var(--realce)" }} /> : <Square size={14} />}
      </button>

      {editando ? (
        <input
          ref={campo}
          value={valor}
          onChange={(evento) => definirValor(evento.target.value)}
          onBlur={confirmar}
          onKeyDown={(evento) => {
            evento.stopPropagation();
            if (evento.key === "Enter") confirmar();
            if (evento.key === "Escape") definirEditando(false);
          }}
          maxLength={200}
          className="min-w-0 flex-1 border-b border-[var(--realce)] bg-transparent text-[12.5px] text-tinta focus:outline-none"
        />
      ) : (
        <span
          onDoubleClick={() => definirEditando(true)}
          title="Clique duas vezes para renomear"
          className={clsx(
            "min-w-0 flex-1 text-[12.5px] break-words",
            item.feita ? "text-tinta-3 line-through" : "text-tinta-2",
          )}
        >
          {item.texto}
        </span>
      )}

      <button
        type="button"
        onClick={aoExcluir}
        aria-label={`Excluir a subtarefa ${item.texto}`}
        className="shrink-0 rounded-md p-0.5 text-tinta-3 opacity-0 transition-opacity hover:text-perigo group-hover/sub:opacity-100"
      >
        <X size={12} />
      </button>
    </li>
  );
}

/**
 * Mural de recados da tarefa — histórico cronológico e só de acréscimo:
 * escrever manda pro fim da lista com data e hora, e a única edição possível
 * é apagar um recado errado, nunca corrigir o texto (é um registro, não uma
 * descrição viva).
 */
function MuralComentarios({
  comentarios,
  aoAdicionar,
  aoExcluir,
}: {
  comentarios: Comentario[];
  aoAdicionar: (texto: string) => Promise<string | null>;
  aoExcluir: (id: string) => void;
}) {
  const [texto, definirTexto] = useState("");
  const [enviando, definirEnviando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function enviar() {
    const limpo = texto.trim();
    if (!limpo) return;
    definirEnviando(true);
    const falha = await aoAdicionar(limpo);
    definirEnviando(false);
    if (falha) {
      definirErro(falha);
      return;
    }
    definirTexto("");
    definirErro(null);
  }

  return (
    <div className="mt-4 rounded-lg border border-linha bg-superficie p-2.5">
      <p className="flex items-center gap-1.5 px-0.5 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
        <MessageSquare size={12} />
        Comentários
      </p>

      {comentarios.length > 0 ? (
        <ul className="mt-1.5 max-h-56 space-y-1 overflow-y-auto">
          {comentarios.map((item) => (
            <li
              key={item.id}
              className="group/com flex items-start gap-1.5 rounded-md px-1 py-1 hover:bg-realce-fraco"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] break-words whitespace-pre-wrap text-tinta-2">{item.texto}</p>
                <p className="mt-0.5 text-[10.5px] text-tinta-3" title={formatarDataHora(item.criadoEm)}>
                  {formatarDataCurta(item.criadoEm)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => aoExcluir(item.id)}
                aria-label="Excluir comentário"
                className="shrink-0 rounded-md p-0.5 text-tinta-3 opacity-0 transition-opacity hover:text-perigo group-hover/com:opacity-100"
              >
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1.5 px-0.5 text-[12px] text-tinta-3">Nenhum recado ainda.</p>
      )}

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          enviar();
        }}
        className="mt-2 flex items-end gap-1.5"
      >
        <textarea
          value={texto}
          onChange={(evento) => definirTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && !evento.shiftKey) {
              evento.preventDefault();
              enviar();
            }
          }}
          placeholder="Escrever um recado… (Enter envia, Shift+Enter quebra linha)"
          rows={1}
          maxLength={2000}
          className="min-w-0 flex-1 resize-none rounded-md border border-linha bg-superficie-alta px-2 py-1.5 text-[12.5px] text-tinta placeholder:text-tinta-3 focus:border-[var(--realce)] focus:outline-none"
        />
        <button
          type="submit"
          disabled={!texto.trim() || enviando}
          aria-label="Comentar"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta disabled:pointer-events-none disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </form>
      <Aviso>{erro}</Aviso>
    </div>
  );
}

/** Marcar a tarefa como impedida, escrevendo o motivo que aparece no cartão. */
function CampoImpedimento({
  motivo,
  aoMudar,
}: {
  motivo: string | null;
  aoMudar: (motivo: string | null) => void;
}) {
  const [editando, definirEditando] = useState(false);
  const [texto, definirTexto] = useState(motivo ?? "");

  if (!editando && motivo === null) {
    return (
      <button
        type="button"
        onClick={() => {
          definirTexto("");
          definirEditando(true);
        }}
        className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-linha-forte px-2.5 py-1.5 text-[12.5px] text-tinta-3 transition-colors hover:border-perigo hover:text-perigo"
      >
        <OctagonAlert size={12} className="shrink-0" />
        Marcar impedida
      </button>
    );
  }

  if (editando) {
    return (
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          aoMudar(texto.trim());
          definirEditando(false);
        }}
      >
        <input
          value={texto}
          autoFocus
          maxLength={200}
          placeholder="Esperando o quê?"
          onChange={(evento) => definirTexto(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Escape") definirEditando(false);
          }}
          className="w-full rounded-lg border border-linha bg-superficie px-2.5 py-1.5 text-[12.5px] text-tinta placeholder:text-tinta-3 focus:border-perigo focus:outline-none"
        />
        <div className="mt-1.5 flex justify-end gap-1.5">
          <Botao variante="sutil" onClick={() => definirEditando(false)}>
            Cancelar
          </Botao>
          <Botao type="submit" variante="primario">
            Salvar
          </Botao>
        </div>
      </form>
    );
  }

  return (
    <div
      className="rounded-lg border px-2.5 py-1.5"
      style={{
        borderColor: "color-mix(in srgb, var(--perigo) 35%, transparent)",
        background: "color-mix(in srgb, var(--perigo) 8%, transparent)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <OctagonAlert size={12} className="shrink-0 text-perigo" aria-hidden />
        <span className="flex-1 text-[11px] font-bold tracking-[0.04em] text-perigo uppercase">Impedida</span>
        <button
          type="button"
          onClick={() => aoMudar(null)}
          aria-label="Tirar o impedimento"
          className="shrink-0 rounded-full p-0.5 text-perigo/70 hover:text-perigo"
        >
          <X size={12} />
        </button>
      </div>
      <button
        type="button"
        onClick={() => {
          definirTexto(motivo ?? "");
          definirEditando(true);
        }}
        className="mt-0.5 block w-full text-left text-[12px] break-words text-tinta-2 hover:text-tinta"
      >
        {motivo || "Sem motivo escrito — clique para explicar."}
      </button>
    </div>
  );
}

/** Rótulo pequeno acima de um campo, na coluna lateral do editor de tarefa. */
function CampoLateral({ rotulo, className, children }: { rotulo: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <p className="mb-1 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">{rotulo}</p>
      {children}
    </div>
  );
}
