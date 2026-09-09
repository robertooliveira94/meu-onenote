"use client";

import clsx from "clsx";
import {
  Calendar,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  FlagOff,
  ListChecks,
  Lock,
  MoreHorizontal,
  OctagonAlert,
  Pencil,
  Plus,
  Square,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { acaoAlternarFavorita } from "@/app/acoes";
import {
  acaoCriarColuna,
  acaoCriarSprint,
  acaoCriarTarefa,
  acaoDefinirColunaConcluida,
  acaoDefinirDependencias,
  acaoDefinirImpedimento,
  acaoDefinirPrazo,
  acaoDefinirPrioridade,
  acaoDefinirSprintDaTarefa,
  acaoDefinirSubtarefas,
  acaoDuplicarTarefa,
  acaoExcluirColuna,
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
  iniciarArrastoDeTarefa,
  lerCaminhoDeTarefa,
  trazTarefa,
} from "@/lib/arrastar";
import { juntar } from "@/lib/caminho-texto";
import { CORES_PRIORIDADE } from "@/lib/cores";
import { formatarDataCurta, formatarDataHora } from "@/lib/rotas";
import { PRIORIDADES, RUBRICA_PRIORIDADE } from "@/lib/tipos";
import type {
  ColunaKanban,
  EtiquetaKanban,
  Prioridade,
  Quadro,
  ResumoQuadro,
  SprintKanban,
  Subtarefa,
  TarefaKanban,
} from "@/lib/tipos";

import { DialogoConfirmar, DialogoNome } from "./dialogos";
import { SeletorEtiquetasKanban } from "./seletor-etiquetas-kanban";
import { TituloEditavel } from "./titulo-editavel";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, RotuloMenu, SeparadorMenu } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

/** Cor de cada coluna — só um acento discreto no topo do cartão, não um fundo colorido inteiro. */
const CORES_COLUNA = ["var(--tinta-3)", "var(--realce)", "#D85A30", "#639922", "#7C5CFC", "#2D7FF9"];
function corDaColuna(indice: number): string {
  return CORES_COLUNA[indice % CORES_COLUNA.length];
}

function hojeISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatarPrazo(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano.slice(2)}`;
}

type Sobrevoo = { coluna: ColunaKanban; caminho: string; antes: boolean } | null;

/** As dependências de uma tarefa que ainda não chegaram na coluna de conclusão. */
function dependenciasPendentes(
  tarefa: TarefaKanban,
  mapa: Record<string, TarefaKanban>,
  colunaConcluida: string,
): TarefaKanban[] {
  return tarefa.dependeDe
    .map((caminho) => mapa[caminho])
    .filter((dependencia): dependencia is TarefaKanban => Boolean(dependencia) && dependencia.coluna !== colunaConcluida);
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
}: {
  /** O quadro em si: nome, cor, ícone. */
  quadro: ResumoQuadro;
  /** O conteúdo dele: colunas configuradas + tarefas de cada uma. */
  conteudo: Quadro;
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
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
  const [tarefaAberta, definirTarefaAberta] = useState<string | null>(null);
  const [colunaAdicionando, definirColunaAdicionando] = useState<ColunaKanban | null>(null);
  const [aviso, definirAviso] = useState<string | null>(null);
  const [criandoColuna, definirCriandoColuna] = useState(false);
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

  /** Move uma tarefa pra outra coluna — usado tanto pelo arraste quanto pelo menu do cartão. */
  async function moverTarefaPara(origem: string, coluna: ColunaKanban) {
    const tarefaOrigem = mapa[origem];
    if (!tarefaOrigem || tarefaOrigem.coluna === coluna) return;

    if (coluna === conteudo.config.colunaConcluida) {
      const pendentes = dependenciasPendentes(tarefaOrigem, mapa, conteudo.config.colunaConcluida);
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

  async function criarTarefaRapida(coluna: ColunaKanban, titulo: string) {
    const limpo = titulo.trim();
    if (!limpo) {
      definirColunaAdicionando(null);
      return;
    }
    const resposta = await acaoCriarTarefa(quadro.nome, coluna, limpo);
    definirColunaAdicionando(null);
    if (resposta.ok) roteador.refresh();
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

  async function moverColuna(nome: string, direcao: -1 | 1) {
    const indice = colunas.indexOf(nome);
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= colunas.length) return;
    const nova = [...colunas];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    const resposta = await acaoReordenarColunas(quadro.nome, nova);
    if (resposta.ok) roteador.refresh();
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
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-extrabold tracking-[-0.02em]">{quadro.nome}</h1>
          <p className="text-[11.5px] text-tinta-2">
            {totalDeTarefas === 0
              ? "Quadro vazio — comece criando uma tarefa numa coluna."
              : `${totalDeTarefas} ${totalDeTarefas === 1 ? "tarefa" : "tarefas"} · cada uma é um arquivo em ${quadro.caminho}/`}
          </p>
        </div>
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

        <BotaoIcone
          rotulo="Nova coluna"
          onClick={() => definirCriandoColuna(true)}
          className="ml-auto"
        >
          <Plus size={14} />
        </BotaoIcone>
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

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 py-4">
        {colunas.map((coluna, indice) => {
          const caminhos = ordemLocal[coluna] ?? [];
          const tarefas = caminhos
            .map((caminho) => mapa[caminho])
            .filter((tarefa): tarefa is TarefaKanban => Boolean(tarefa));
          const tarefasVisiveis = tarefas.filter(passaNoFiltro);
          const cor = corDaColuna(indice);

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
              className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-linha bg-superficie"
            >
              <div
                className="flex shrink-0 items-center gap-1 px-3 pt-2.5 pb-2"
                style={{ boxShadow: `inset 0 2px 0 ${cor}` }}
              >
                <span className="truncate text-[12.5px] font-bold tracking-[-0.01em]">{coluna}</span>
                {coluna === conteudo.config.colunaConcluida ? (
                  <span title="Coluna de conclusão — trava tarefas com dependência pendente">
                    <Check size={11} className="shrink-0 text-tinta-3" />
                  </span>
                ) : null}
                <span className="text-[11px] text-tinta-3 tabular-nums">
                  {filtrosAtivos ? `${tarefasVisiveis.length}/${tarefas.length}` : tarefas.length}
                </span>
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
                        {coluna !== conteudo.config.colunaConcluida ? (
                          <ItemMenu
                            icone={<Check size={13} />}
                            onClick={async () => {
                              fechar();
                              const resposta = await acaoDefinirColunaConcluida(quadro.nome, coluna);
                              if (resposta.ok) roteador.refresh();
                            }}
                          >
                            Marcar como conclusão
                          </ItemMenu>
                        ) : null}
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

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
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
                    pendentes={dependenciasPendentes(tarefa, mapa, conteudo.config.colunaConcluida).length}
                    corDaColuna={cor}
                    outrasColunas={colunas.filter((c) => c !== coluna)}
                    atrasada={Boolean(tarefa.prazo) && tarefa.prazo! < hojeISO() && coluna !== conteudo.config.colunaConcluida}
                    sobrevoo={sobrevoo?.caminho === tarefa.caminho ? sobrevoo : null}
                    aoPassarPorCima={(antes) => definirSobrevoo({ coluna, caminho: tarefa.caminho, antes })}
                    aoSairDeCima={() =>
                      definirSobrevoo((atual) => (atual?.caminho === tarefa.caminho ? null : atual))
                    }
                    aoSoltar={(origem, antes) => aoSoltarPertoDe(tarefa, origem, antes)}
                    aoAbrir={() => definirTarefaAberta(tarefa.caminho)}
                    aoMoverPara={(destino) => moverTarefaPara(tarefa.caminho, destino)}
                    aoDuplicar={() => duplicarTarefaAção(tarefa.caminho)}
                    aoFavoritar={() => favoritarAção(tarefa.caminho)}
                    aoDefinirPrioridade={(prioridade) => definirPrioridadeAção(tarefa.caminho, prioridade)}
                    aoTirarImpedimento={() => definirImpedimentoAção(tarefa.caminho, null)}
                    aoExcluir={() => definirTarefaParaExcluir(tarefa.caminho)}
                  />
                ))}

                {colunaAdicionando === coluna ? (
                  <CampoNovaTarefa
                    aoConfirmar={(titulo) => criarTarefaRapida(coluna, titulo)}
                    aoCancelar={() => definirColunaAdicionando(null)}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {tarefaAberta && mapa[tarefaAberta] ? (
        <DialogoTarefa
          tarefa={mapa[tarefaAberta]}
          todasTarefas={Object.values(mapa)}
          etiquetasKanban={etiquetasKanban}
          sprints={sprints}
          aoFechar={() => definirTarefaAberta(null)}
          aoRenomear={(novoTitulo) => renomearTarefaAção(tarefaAberta, novoTitulo)}
          aoDefinirImpedimento={(motivo) => definirImpedimentoAção(tarefaAberta, motivo)}
          aoDefinirSubtarefas={(subtarefas) => definirSubtarefasAção(tarefaAberta, subtarefas)}
          aoAtualizar={(patch) =>
            definirMapa((atual) => ({ ...atual, [tarefaAberta]: { ...atual[tarefaAberta], ...patch } }))
          }
          aoExcluir={() => {
            definirTarefaAberta(null);
            roteador.refresh();
          }}
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

  return (
    <div className="max-h-64 overflow-y-auto">
      {sprints.length === 0 ? (
        <p className="px-2 py-2 text-[12px] leading-snug text-tinta-3">Nenhuma sprint cadastrada ainda.</p>
      ) : (
        sprints.map((sprint) => (
          <div key={sprint.id} className="group/sprint flex items-center gap-1">
            <button
              type="button"
              onClick={() => aoEscolher(sprint.id)}
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
            >
              <ListChecks size={12} className="shrink-0 text-tinta-3" />
              <span className="flex-1 truncate">{sprint.nome}</span>
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
  aoMoverPara,
  aoDuplicar,
  aoFavoritar,
  aoDefinirPrioridade,
  aoTirarImpedimento,
  aoExcluir,
}: {
  tarefa: TarefaKanban;
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
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
  aoMoverPara: (coluna: string) => void;
  aoDuplicar: () => void;
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

  return (
    <div className="group relative">
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
        onClick={aoAbrir}
        onKeyDown={(evento) => {
          if (evento.key === "Enter" || evento.key === " ") {
            evento.preventDefault();
            aoAbrir();
          }
        }}
        className={clsx(
          "cartao block w-full cursor-grab overflow-hidden px-3 py-2.5 pr-7 text-left active:cursor-grabbing",
          impedida && "border-[color-mix(in_srgb,var(--perigo)_45%,var(--linha))]",
        )}
        style={{ borderLeft: `3px solid ${impedida ? "var(--perigo)" : corDaColuna}` }}
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

        <div className="flex items-start gap-1.5">
          {tarefa.prioridade ? (
            <Flag
              size={11}
              className="mt-0.5 shrink-0"
              style={{ color: CORES_PRIORIDADE[tarefa.prioridade] }}
              aria-label={`Prioridade ${RUBRICA_PRIORIDADE[tarefa.prioridade]}`}
            />
          ) : null}
          {tarefa.favorita ? <Star size={11} className="mt-0.5 shrink-0 fill-current text-[#c69214]" /> : null}
          <span className="min-w-0 flex-1 text-[13px] leading-snug font-medium text-tinta">{tarefa.titulo}</span>
          {pendentes > 0 ? (
            <span
              className="flex shrink-0 items-center gap-0.5 text-[10.5px] text-perigo"
              title={`Bloqueada por ${pendentes} tarefa${pendentes === 1 ? "" : "s"} não concluída${pendentes === 1 ? "" : "s"}`}
            >
              <Lock size={11} />
              {pendentes}
            </span>
          ) : null}
        </div>
        {etiquetasDaTarefa.length > 0 || tarefa.prazo || sprint || tarefa.subtarefas.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {tarefa.subtarefas.length > 0 ? (
              <span
                className={clsx("pastilha", feitas === tarefa.subtarefas.length ? "text-[#639922]" : "text-tinta-2")}
                style={{ background: "var(--realce-fraco)" }}
                title={`${feitas} de ${tarefa.subtarefas.length} subtarefas concluídas`}
              >
                <CheckSquare size={10} />
                {feitas}/{tarefa.subtarefas.length}
              </span>
            ) : null}
            {tarefa.prazo ? (
              <span
                className={clsx(
                  "pastilha",
                  atrasada ? "text-perigo" : "text-tinta-2",
                )}
                style={{ background: atrasada ? "color-mix(in srgb, var(--perigo) 12%, transparent)" : "var(--realce-fraco)" }}
              >
                <Calendar size={10} />
                {formatarPrazo(tarefa.prazo)}
              </span>
            ) : null}
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

        <p className="mt-1.5 text-[10.5px] text-tinta-3" title={`Criada em ${formatarDataHora(tarefa.criadoEm)}`}>
          Criada {formatarDataCurta(tarefa.criadoEm)}
        </p>
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

function CampoNovaTarefa({
  aoConfirmar,
  aoCancelar,
}: {
  aoConfirmar: (titulo: string) => void;
  aoCancelar: () => void;
}) {
  const [valor, definirValor] = useState("");
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    campo.current?.focus();
  }, []);

  return (
    <div className="cartao px-2.5 py-2">
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
        placeholder="Título da tarefa…"
        rows={2}
        className="w-full resize-none bg-transparent text-[13px] text-tinta placeholder:text-tinta-3 focus:outline-none"
      />
    </div>
  );
}

/** Editor de uma tarefa: título, etiquetas, prioridade, prazo, sprint, dependências, corpo em markdown com prévia. */
function DialogoTarefa({
  tarefa,
  todasTarefas,
  etiquetasKanban,
  sprints,
  aoFechar,
  aoAtualizar,
  aoExcluir,
  aoRenomear,
  aoDefinirImpedimento,
  aoDefinirSubtarefas,
}: {
  tarefa: TarefaKanban;
  /** Todas as tarefas do quadro (qualquer coluna) — pra escolher dependência. */
  todasTarefas: TarefaKanban[];
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
  aoFechar: () => void;
  /** Avisa o quadro pra atualizar a tarefa na hora (etiquetas, dependências…), sem esperar um refresh. */
  aoAtualizar: (patch: Partial<TarefaKanban>) => void;
  aoExcluir: () => void;
  aoRenomear: (novoTitulo: string) => Promise<string | null>;
  aoDefinirImpedimento: (motivo: string | null) => void;
  aoDefinirSubtarefas: (subtarefas: Subtarefa[]) => void;
}) {
  const caminho = tarefa.caminho;
  const [carregando, definirCarregando] = useState(true);
  const [conteudo, definirConteudo] = useState("");
  const [modoDescricao, definirModoDescricao] = useState<"leitura" | "edicao">("leitura");
  const [rascunho, definirRascunho] = useState("");
  const [salvandoDescricao, definirSalvandoDescricao] = useState(false);
  const [confirmandoExclusao, definirConfirmandoExclusao] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
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

  return (
    <Dialogo
      titulo={tarefa.titulo || "Tarefa"}
      aberto
      largura="max-w-4xl"
      aoFechar={aoFechar}
      tituloPersonalizado={
        <TituloEditavel
          titulo={tarefa.titulo}
          aoRenomear={aoRenomear}
          className="text-[16px] leading-tight font-bold tracking-[-0.02em]"
        />
      }
    >
      {carregando ? (
        <p className="py-8 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : (
        <>
          <div className="mt-1 grid gap-6 sm:grid-cols-[1fr_220px]">
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

              <Aviso>{erro}</Aviso>
            </div>

            <div className="flex flex-col gap-4 sm:border-l sm:border-linha sm:pl-5">
              <CampoLateral rotulo="Impedimento">
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

              <CampoLateral rotulo="Etiquetas">
                <SeletorEtiquetasKanban
                  caminho={caminho}
                  etiquetasDaTarefa={tarefa.etiquetas}
                  todasEtiquetas={etiquetasKanban}
                  aoMudar={(etiquetas) => aoAtualizar({ etiquetas })}
                />
              </CampoLateral>

              <CampoLateral rotulo="Bloqueado por">
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
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-linha pt-3.5">
            <button
              type="button"
              onClick={() => definirConfirmandoExclusao(true)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-perigo hover:bg-[color-mix(in_srgb,var(--perigo)_10%,transparent)]"
            >
              <Trash2 size={13} />
              Excluir tarefa
            </button>
            <Botao variante="sutil" onClick={aoFechar}>
              <Check size={13} />
              Fechar
            </Botao>
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
      )}
    </Dialogo>
  );
}

/**
 * A checklist da tarefa: marcar é um clique, criar é digitar e dar Enter —
 * o campo continua aberto para a próxima, que é como se escreve uma lista
 * de subtarefas de verdade (várias seguidas, sem parar para clicar em
 * "adicionar" toda vez).
 */
function ListaSubtarefas({
  subtarefas,
  aoMudar,
}: {
  subtarefas: Subtarefa[];
  aoMudar: (subtarefas: Subtarefa[]) => void;
}) {
  const [nova, definirNova] = useState("");
  const feitas = subtarefas.filter((item) => item.feita).length;

  function adicionar() {
    const texto = nova.trim();
    if (!texto) return;
    aoMudar([...subtarefas, { id: crypto.randomUUID(), texto, feita: false }]);
    definirNova("");
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Subtarefas</p>
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
          <li key={item.id} className="group/sub flex items-center gap-2 rounded-md px-1 py-[3px] hover:bg-realce-fraco">
            <button
              type="button"
              onClick={() =>
                aoMudar(subtarefas.map((atual) => (atual.id === item.id ? { ...atual, feita: !atual.feita } : atual)))
              }
              aria-pressed={item.feita}
              aria-label={item.feita ? `Desmarcar ${item.texto}` : `Marcar ${item.texto} como feita`}
              className="shrink-0 text-tinta-3 transition-colors hover:text-tinta"
            >
              {item.feita ? (
                <CheckSquare size={14} style={{ color: "var(--realce)" }} />
              ) : (
                <Square size={14} />
              )}
            </button>
            <span
              className={clsx(
                "min-w-0 flex-1 text-[12.5px] break-words",
                item.feita ? "text-tinta-3 line-through" : "text-tinta-2",
              )}
            >
              {item.texto}
            </span>
            <button
              type="button"
              onClick={() => aoMudar(subtarefas.filter((atual) => atual.id !== item.id))}
              aria-label={`Excluir a subtarefa ${item.texto}`}
              className="shrink-0 rounded-md p-0.5 text-tinta-3 opacity-0 transition-opacity hover:text-perigo group-hover/sub:opacity-100"
            >
              <X size={12} />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          adicionar();
        }}
        className="mt-1 flex items-center gap-1.5 px-1"
      >
        <Plus size={13} className="shrink-0 text-tinta-3" aria-hidden />
        <input
          value={nova}
          onChange={(evento) => definirNova(evento.target.value)}
          placeholder="Adicionar subtarefa…"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent py-[3px] text-[12.5px] text-tinta placeholder:text-tinta-3 focus:outline-none"
        />
      </form>
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
function CampoLateral({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">{rotulo}</p>
      {children}
    </div>
  );
}
