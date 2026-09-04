"use client";

import { Check, KanbanSquare, Lock, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  acaoCriarTarefa,
  acaoDefinirDependencias,
  acaoExcluirTarefa,
  acaoLerTarefa,
  acaoMoverTarefa,
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
import { COLUNAS_KANBAN } from "@/lib/tipos";
import type { Caderno, ColunaKanban, EtiquetaKanban, Quadro, TarefaKanban } from "@/lib/tipos";

import { SeletorEtiquetasKanban } from "./seletor-etiquetas-kanban";
import { Aviso, Botao, BotaoIcone, Dialogo, Menu } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

const ESPERA_SALVAMENTO = 800;

/** Cor de cada coluna — só um acento discreto no topo do cartão, não um fundo colorido inteiro. */
const COR_DA_COLUNA: Record<ColunaKanban, string> = {
  Backlog: "var(--tinta-3)",
  Fazendo: "var(--realce)",
  Impedido: "#D85A30",
  Feito: "#639922",
};

type Sobrevoo = { coluna: ColunaKanban; caminho: string; antes: boolean } | null;

/** As dependências de uma tarefa que ainda não chegaram em "Feito". */
function dependenciasPendentes(tarefa: TarefaKanban, mapa: Record<string, TarefaKanban>): TarefaKanban[] {
  return tarefa.dependeDe
    .map((caminho) => mapa[caminho])
    .filter((dependencia): dependencia is TarefaKanban => Boolean(dependencia) && dependencia.coluna !== "Feito");
}

/**
 * O quadro Kanban de um caderno — independente das anotações. Cada tarefa é
 * um arquivo `.md` de verdade (`<Caderno>/_kanban/<Coluna>/<Tarefa>.md`);
 * arrastar entre colunas move o arquivo de pasta.
 */
export function QuadroKanban({
  caderno,
  quadro,
  etiquetasKanban,
}: {
  caderno: Caderno;
  quadro: Quadro;
  etiquetasKanban: EtiquetaKanban[];
}) {
  const roteador = useRouter();

  const [ordemLocal, definirOrdemLocal] = useState<Record<ColunaKanban, string[]>>(() =>
    Object.fromEntries(COLUNAS_KANBAN.map((coluna) => [coluna, quadro[coluna].map((t) => t.caminho)])) as Record<
      ColunaKanban,
      string[]
    >,
  );
  const [mapa, definirMapa] = useState<Record<string, TarefaKanban>>(() => {
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of COLUNAS_KANBAN) for (const tarefa of quadro[coluna]) m[tarefa.caminho] = tarefa;
    return m;
  });

  useEffect(() => {
    definirOrdemLocal(
      Object.fromEntries(COLUNAS_KANBAN.map((coluna) => [coluna, quadro[coluna].map((t) => t.caminho)])) as Record<
        ColunaKanban,
        string[]
      >,
    );
    const m: Record<string, TarefaKanban> = {};
    for (const coluna of COLUNAS_KANBAN) for (const tarefa of quadro[coluna]) m[tarefa.caminho] = tarefa;
    definirMapa(m);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caderno.caminho, COLUNAS_KANBAN.map((coluna) => quadro[coluna].map((t) => t.caminho).join(",")).join("|")]);

  const [sobrevoo, definirSobrevoo] = useState<Sobrevoo>(null);
  const [tarefaAberta, definirTarefaAberta] = useState<string | null>(null);
  const [colunaAdicionando, definirColunaAdicionando] = useState<ColunaKanban | null>(null);
  const [bloqueio, definirBloqueio] = useState<string | null>(null);

  useEffect(() => {
    if (!bloqueio) return;
    const espera = setTimeout(() => definirBloqueio(null), 4000);
    return () => clearTimeout(espera);
  }, [bloqueio]);

  function pastaDaColuna(coluna: ColunaKanban): string {
    return juntar(caderno.caminho, "_kanban", coluna);
  }

  /** Reordena dentro da mesma coluna (otimista) — mover entre colunas cai em `aoSoltarNaColuna`. */
  function aoSoltarPertoDe(alvo: TarefaKanban, origem: string, antes: boolean) {
    definirSobrevoo(null);
    const tarefaOrigem = mapa[origem];
    if (!tarefaOrigem || origem === alvo.caminho) return;
    if (tarefaOrigem.coluna !== alvo.coluna) {
      aoSoltarNaColuna(alvo.coluna, origem);
      return;
    }
    const nova = calcularNovaOrdem(ordemLocal[alvo.coluna], origem, alvo.caminho, antes);
    if (!nova) return;
    definirOrdemLocal((atual) => ({ ...atual, [alvo.coluna]: nova }));
    acaoReordenarTarefasPara(pastaDaColuna(alvo.coluna), nova).then((resposta) => {
      if (!resposta.ok) roteador.refresh();
    });
  }

  /** Solto na coluna em si (não perto de um cartão específico) — entra no fim dela. */
  async function aoSoltarNaColuna(coluna: ColunaKanban, origem: string) {
    definirSobrevoo(null);
    const tarefaOrigem = mapa[origem];
    if (!tarefaOrigem || tarefaOrigem.coluna === coluna) return;

    // "Feito" é a única transição com trava: não faz sentido marcar como
    // concluída uma tarefa que ainda depende de outra que não terminou.
    if (coluna === "Feito") {
      const pendentes = dependenciasPendentes(tarefaOrigem, mapa);
      if (pendentes.length > 0) {
        definirBloqueio(
          `"${tarefaOrigem.titulo}" ainda depende de ${pendentes.length === 1 ? "1 tarefa" : `${pendentes.length} tarefas`} não concluída${pendentes.length === 1 ? "" : "s"}: ${pendentes.map((p) => p.titulo).join(", ")}.`,
        );
        return;
      }
    }

    definirOrdemLocal((atual) => ({
      ...atual,
      [tarefaOrigem.coluna]: atual[tarefaOrigem.coluna].filter((caminho) => caminho !== origem),
      [coluna]: [...atual[coluna], origem],
    }));
    definirMapa((atual) => ({ ...atual, [origem]: { ...atual[origem], coluna } }));

    await acaoMoverTarefa(origem, coluna);
    // O caminho muda de pasta quando move — precisa dos dados frescos do
    // servidor pra saber o novo caminho de cada tarefa movida (e pra
    // atualizar quem dependia dela, se for o caso).
    roteador.refresh();
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
      </header>

      {bloqueio ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-linha bg-[color-mix(in_srgb,var(--perigo)_8%,transparent)] px-6 py-2">
          <Lock size={13} className="shrink-0 text-perigo" aria-hidden />
          <p className="min-w-0 flex-1 text-[12px] text-perigo">{bloqueio}</p>
          <button
            type="button"
            onClick={() => definirBloqueio(null)}
            className="shrink-0 text-tinta-3 hover:text-tinta"
            aria-label="Fechar aviso"
          >
            <X size={13} />
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-4 py-4">
        {COLUNAS_KANBAN.map((coluna) => {
          const caminhos = ordemLocal[coluna];
          const tarefas = caminhos.map((caminho) => mapa[caminho]).filter((tarefa): tarefa is TarefaKanban => Boolean(tarefa));

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
                aoSoltarNaColuna(coluna, lerCaminhoDeTarefa(evento));
              }}
              className="flex w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-linha bg-superficie"
            >
              <div
                className="flex shrink-0 items-center gap-2 px-3 pt-2.5 pb-2"
                style={{ boxShadow: `inset 0 2px 0 ${COR_DA_COLUNA[coluna]}` }}
              >
                <span className="text-[12.5px] font-bold tracking-[-0.01em]">{coluna}</span>
                <span className="text-[11px] text-tinta-3 tabular-nums">{tarefas.length}</span>
                <BotaoIcone
                  rotulo={`Nova tarefa em ${coluna}`}
                  onClick={() => definirColunaAdicionando(coluna)}
                  className="ml-auto size-6"
                >
                  <Plus size={13} />
                </BotaoIcone>
              </div>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-2 pb-2">
                {tarefas.length === 0 && colunaAdicionando !== coluna ? (
                  <p className="px-1.5 py-3 text-[11.5px] leading-relaxed text-tinta-3">
                    Nenhuma tarefa aqui — arraste uma de outra coluna, ou use o “+” acima.
                  </p>
                ) : null}

                {tarefas.map((tarefa) => (
                  <CartaoTarefa
                    key={tarefa.caminho}
                    tarefa={tarefa}
                    etiquetasKanban={etiquetasKanban}
                    pendentes={dependenciasPendentes(tarefa, mapa).length}
                    corDaColuna={COR_DA_COLUNA[coluna]}
                    sobrevoo={sobrevoo?.caminho === tarefa.caminho ? sobrevoo : null}
                    aoPassarPorCima={(antes) => definirSobrevoo({ coluna, caminho: tarefa.caminho, antes })}
                    aoSairDeCima={() =>
                      definirSobrevoo((atual) => (atual?.caminho === tarefa.caminho ? null : atual))
                    }
                    aoSoltar={(origem, antes) => aoSoltarPertoDe(tarefa, origem, antes)}
                    aoAbrir={() => definirTarefaAberta(tarefa.caminho)}
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
    </div>
  );
}

function CartaoTarefa({
  tarefa,
  etiquetasKanban,
  pendentes,
  corDaColuna,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
  aoAbrir,
}: {
  tarefa: TarefaKanban;
  etiquetasKanban: EtiquetaKanban[];
  /** Quantas dependências desta tarefa ainda não chegaram em "Feito". */
  pendentes: number;
  corDaColuna: string;
  sobrevoo: Sobrevoo;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltar: (origem: string, antes: boolean) => void;
  aoAbrir: () => void;
}) {
  const etiquetasDaTarefa = tarefa.etiquetas
    .map((id) => etiquetasKanban.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is EtiquetaKanban => Boolean(etiqueta));

  return (
    <div className="relative">
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
        className="cartao block w-full cursor-grab px-3 py-2.5 text-left active:cursor-grabbing"
        style={{ borderLeft: `3px solid ${corDaColuna}` }}
      >
        <div className="flex items-start gap-1.5">
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
        {etiquetasDaTarefa.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
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

/** Editor de uma tarefa: título, etiquetas, dependências, corpo em markdown com prévia ao lado. */
function DialogoTarefa({
  tarefa,
  todasTarefas,
  etiquetasKanban,
  aoFechar,
  aoAtualizar,
  aoExcluir,
}: {
  tarefa: TarefaKanban;
  /** Todas as tarefas do quadro (qualquer coluna) — pra escolher dependência. */
  todasTarefas: TarefaKanban[];
  etiquetasKanban: EtiquetaKanban[];
  aoFechar: () => void;
  /** Avisa o quadro pra atualizar a tarefa na hora (etiquetas, dependências), sem esperar um refresh. */
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

  async function mudarDependencias(novaLista: string[]) {
    aoAtualizar({ dependeDe: novaLista });
    await acaoDefinirDependencias(caminho, novaLista);
  }

  return (
    <Dialogo titulo={tarefa.titulo || "Tarefa"} aberto largura="max-w-3xl" aoFechar={aoFechar}>
      {carregando ? (
        <p className="py-8 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : (
        <>
          <SeletorEtiquetasKanban
            caminho={caminho}
            etiquetasDaTarefa={tarefa.etiquetas}
            todasEtiquetas={etiquetasKanban}
            aoMudar={(etiquetas) => aoAtualizar({ etiquetas })}
          />

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
                    className={dependencia.coluna === "Feito" ? "text-tinta-3" : "text-perigo"}
                  />
                  <span className={dependencia.coluna === "Feito" ? "text-tinta-3 line-through" : "text-tinta-2"}>
                    {dependencia.titulo}
                  </span>
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
