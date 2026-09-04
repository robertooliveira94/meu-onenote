"use client";

import clsx from "clsx";
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Flag,
  FlagOff,
  KanbanSquare,
  ListChecks,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Star,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { acaoAlternarFavorita } from "@/app/acoes";
import {
  acaoCriarColuna,
  acaoCriarSprint,
  acaoCriarTarefa,
  acaoDefinirColunaConcluida,
  acaoDefinirDependencias,
  acaoDefinirPrazo,
  acaoDefinirPrioridade,
  acaoDefinirSprintDaTarefa,
  acaoDuplicarTarefa,
  acaoExcluirColuna,
  acaoExcluirSprint,
  acaoExcluirTarefa,
  acaoLerTarefa,
  acaoMoverTarefa,
  acaoRenomearColuna,
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
import { PRIORIDADES, RUBRICA_PRIORIDADE } from "@/lib/tipos";
import type {
  Caderno,
  ColunaKanban,
  EtiquetaKanban,
  Prioridade,
  Quadro,
  SprintKanban,
  TarefaKanban,
} from "@/lib/tipos";

import { DialogoConfirmar, DialogoNome } from "./dialogos";
import { SeletorEtiquetasKanban } from "./seletor-etiquetas-kanban";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, RotuloMenu, SeparadorMenu } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

const ESPERA_SALVAMENTO = 800;

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
 * O quadro Kanban de um caderno — independente das anotações. Cada tarefa é
 * um arquivo `.md` de verdade (`<Caderno>/_kanban/<Coluna>/<Tarefa>.md`);
 * arrastar entre colunas move o arquivo de pasta. As colunas são
 * configuráveis (criar, renomear, reordenar, excluir se vazia).
 */
export function QuadroKanban({
  caderno,
  quadro,
  etiquetasKanban,
  sprints,
}: {
  caderno: Caderno;
  quadro: Quadro;
  etiquetasKanban: EtiquetaKanban[];
  sprints: SprintKanban[];
}) {
  const roteador = useRouter();
  const colunas = quadro.config.colunas;
  const assinaturaTarefas = colunas.map((coluna) => (quadro.tarefas[coluna] ?? []).map((t) => t.caminho).join(",")).join("|");

  const [ordemLocal, definirOrdemLocal] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(colunas.map((coluna) => [coluna, (quadro.tarefas[coluna] ?? []).map((t) => t.caminho)])),
  );
  const [mapa, definirMapa] = useState<Record<string, TarefaKanban>>(() => {
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of colunas) for (const tarefa of quadro.tarefas[coluna] ?? []) m[tarefa.caminho] = tarefa;
    return m;
  });

  useEffect(() => {
    definirOrdemLocal(
      Object.fromEntries(colunas.map((coluna) => [coluna, (quadro.tarefas[coluna] ?? []).map((t) => t.caminho)])),
    );
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of colunas) for (const tarefa of quadro.tarefas[coluna] ?? []) m[tarefa.caminho] = tarefa;
    definirMapa(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caderno.caminho, colunas.join("|"), assinaturaTarefas]);

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
    return juntar(caderno.caminho, "_kanban", coluna);
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

    if (coluna === quadro.config.colunaConcluida) {
      const pendentes = dependenciasPendentes(tarefaOrigem, mapa, quadro.config.colunaConcluida);
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
    const resposta = await acaoCriarTarefa(caderno.caminho, coluna, limpo);
    definirColunaAdicionando(null);
    if (resposta.ok) roteador.refresh();
  }

  async function duplicarTarefaAção(caminho: string) {
    const resposta = await acaoDuplicarTarefa(caminho);
    if (resposta.ok) roteador.refresh();
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

  async function moverColuna(nome: string, direcao: -1 | 1) {
    const indice = colunas.indexOf(nome);
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= colunas.length) return;
    const nova = [...colunas];
    [nova[indice], nova[alvo]] = [nova[alvo], nova[indice]];
    const resposta = await acaoReordenarColunas(caderno.caminho, nova);
    if (resposta.ok) roteador.refresh();
  }

  const etiquetaAtiva = filtroEtiqueta ? etiquetasKanban.find((e) => e.id === filtroEtiqueta) : null;
  const sprintAtiva = filtroSprint ? sprints.find((s) => s.id === filtroSprint) : null;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <header className="flex shrink-0 items-center gap-2 border-b border-linha bg-superficie px-6 py-3.5">
        <KanbanSquare size={16} style={{ color: "var(--realce)" }} aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-extrabold tracking-[-0.02em]">Kanban · {caderno.nome}</h1>
          <p className="text-[11.5px] text-tinta-2">
            Independente das anotações — cada tarefa é um arquivo, salvo dentro de{" "}
            <span className="font-mono">{caderno.nome}/_kanban/</span>.
          </p>
        </div>
        <Link
          href="/kanban/etiquetas"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
        >
          <Tag size={13} />
          Gerenciar etiquetas
        </Link>
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
                {coluna === quadro.config.colunaConcluida ? (
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
                        {coluna !== quadro.config.colunaConcluida ? (
                          <ItemMenu
                            icone={<Check size={13} />}
                            onClick={async () => {
                              fechar();
                              const resposta = await acaoDefinirColunaConcluida(caderno.caminho, coluna);
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
                    pendentes={dependenciasPendentes(tarefa, mapa, quadro.config.colunaConcluida).length}
                    corDaColuna={cor}
                    outrasColunas={colunas.filter((c) => c !== coluna)}
                    atrasada={Boolean(tarefa.prazo) && tarefa.prazo! < hojeISO() && coluna !== quadro.config.colunaConcluida}
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
          const resposta = await acaoCriarColuna(caderno.caminho, nome);
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
          const resposta = await acaoRenomearColuna(caderno.caminho, colunaParaRenomear, nome);
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
          const resposta = await acaoExcluirColuna(caderno.caminho, colunaParaExcluir);
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
  aoExcluir: () => void;
}) {
  const etiquetasDaTarefa = tarefa.etiquetas
    .map((id) => etiquetasKanban.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is EtiquetaKanban => Boolean(etiqueta));
  const sprint = tarefa.sprintId ? sprints.find((s) => s.id === tarefa.sprintId) : null;

  return (
    <div className="group relative">
      {sobrevoo ? (
        <span
          className="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full"
          style={{ background: "var(--realce)", [sobrevoo.antes ? "top" : "bottom"]: "-4px" }}
          aria-hidden
        />
      ) : null}
      <button
        type="button"
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
        className="cartao block w-full cursor-grab px-3 py-2.5 pr-7 text-left active:cursor-grabbing"
        style={{ borderLeft: `3px solid ${corDaColuna}` }}
      >
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
        {etiquetasDaTarefa.length > 0 || tarefa.prazo || sprint ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
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
      </button>

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
}) {
  const caminho = tarefa.caminho;
  const [carregando, definirCarregando] = useState(true);
  const [conteudo, definirConteudo] = useState("");
  const [conteudoOriginal, definirConteudoOriginal] = useState("");
  const [confirmandoExclusao, definirConfirmandoExclusao] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    acaoLerTarefa(caminho).then((lida) => {
      if (cancelado || !lida) return;
      definirConteudo(lida.conteudo);
      definirConteudoOriginal(lida.conteudo);
      definirCarregando(false);
    });
    return () => {
      cancelado = true;
    };
  }, [caminho]);

  // Salva sozinho depois de uma pausa na digitação — mesmo padrão do editor de página.
  useEffect(() => {
    if (carregando || conteudo === conteudoOriginal) return;
    const espera = setTimeout(async () => {
      const resposta = await acaoSalvarTarefa(caminho, conteudo);
      if (resposta.ok) definirConteudoOriginal(conteudo);
      else definirErro(resposta.erro);
    }, ESPERA_SALVAMENTO);
    return () => clearTimeout(espera);
  }, [conteudo, conteudoOriginal, caminho, carregando]);

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
    <Dialogo titulo={tarefa.titulo || "Tarefa"} aberto largura="max-w-3xl" aoFechar={aoFechar}>
      {carregando ? (
        <p className="py-8 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-1.5">
            <Menu
              alinhamento="esquerda"
              gatilho={(abrir) => (
                <button
                  type="button"
                  onClick={abrir}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-[11.5px] text-tinta-2 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                >
                  <Flag size={11} style={tarefa.prioridade ? { color: CORES_PRIORIDADE[tarefa.prioridade] } : undefined} />
                  {tarefa.prioridade ? RUBRICA_PRIORIDADE[tarefa.prioridade] : "Prioridade"}
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

            <label className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-[11.5px] text-tinta-2">
              <Calendar size={11} />
              <input
                type="date"
                value={tarefa.prazo ?? ""}
                onChange={(evento) => mudarPrazo(evento.target.value || null)}
                className="bg-transparent text-[11.5px] text-tinta focus:outline-none"
              />
              {tarefa.prazo ? (
                <button
                  type="button"
                  onClick={() => mudarPrazo(null)}
                  aria-label="Remover prazo"
                  className="text-tinta-3 hover:text-tinta"
                >
                  <X size={11} />
                </button>
              ) : null}
            </label>

            <Menu
              alinhamento="esquerda"
              gatilho={(abrir) => (
                <button
                  type="button"
                  onClick={abrir}
                  className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-[11.5px] text-tinta-2 transition-colors hover:border-[var(--realce)] hover:text-tinta"
                >
                  <ListChecks size={11} />
                  {sprintAtual ? sprintAtual.nome : "Sprint"}
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
          </div>

          <div className="mt-2.5">
            <SeletorEtiquetasKanban
              caminho={caminho}
              etiquetasDaTarefa={tarefa.etiquetas}
              todasEtiquetas={etiquetasKanban}
              aoMudar={(etiquetas) => aoAtualizar({ etiquetas })}
            />
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Bloqueado por</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {dependencias.map((dependencia) => (
                <span
                  key={dependencia.caminho}
                  className="flex items-center gap-1 rounded-full border border-linha bg-superficie py-0.5 pr-1 pl-2 text-[11.5px]"
                >
                  <Lock
                    size={10}
                    className={dependencia.coluna === tarefa.coluna ? "text-tinta-3" : "text-perigo"}
                  />
                  <span className="text-tinta-2">{dependencia.titulo}</span>
                  <button
                    type="button"
                    onClick={() => mudarDependencias(tarefa.dependeDe.filter((item) => item !== dependencia.caminho))}
                    className="rounded-full p-0.5 text-tinta-3 hover:bg-realce-medio hover:text-tinta"
                    aria-label={`Não depender mais de ${dependencia.titulo}`}
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}

              <Menu
                alinhamento="esquerda"
                gatilho={(abrir) => (
                  <button
                    type="button"
                    onClick={abrir}
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-[11.5px] text-tinta-3 transition-colors hover:border-[var(--realce)] hover:text-tinta"
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
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <textarea
              value={conteudo}
              onChange={(evento) => definirConteudo(evento.target.value)}
              placeholder="Descrição, checklist, o que quiser — em markdown."
              rows={12}
              className="editor-texto w-full resize-none rounded-lg border border-linha bg-superficie px-3 py-2.5 text-[13px] text-tinta placeholder:text-tinta-3 focus:border-[var(--realce)] focus:outline-none"
            />
            <div className="prosa overflow-y-auto rounded-lg border border-linha bg-superficie px-3 py-2.5">
              <VisualizadorMarkdown conteudo={conteudo} />
            </div>
          </div>

          <Aviso>{erro}</Aviso>

          <div className="mt-4 flex items-center justify-between">
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
