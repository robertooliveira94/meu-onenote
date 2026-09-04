"use client";

import { KanbanSquare, Plus, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  acaoCriarTarefa,
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
import { urlDaSecao } from "@/lib/rotas";
import { COLUNAS_KANBAN } from "@/lib/tipos";
import type { Caderno, ColunaKanban, Quadro, TarefaKanban } from "@/lib/tipos";

import { Aviso, Botao, BotaoIcone, Dialogo } from "./ui";
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

/**
 * O quadro Kanban de um caderno — independente das anotações. Cada tarefa é
 * um arquivo `.md` de verdade (`<Caderno>/_kanban/<Coluna>/<Tarefa>.md`);
 * arrastar entre colunas move o arquivo de pasta.
 */
export function QuadroKanban({ caderno, quadro }: { caderno: Caderno; quadro: Quadro }) {
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

    definirOrdemLocal((atual) => ({
      ...atual,
      [tarefaOrigem.coluna]: atual[tarefaOrigem.coluna].filter((caminho) => caminho !== origem),
      [coluna]: [...atual[coluna], origem],
    }));
    definirMapa((atual) => ({ ...atual, [origem]: { ...atual[origem], coluna } }));

    await acaoMoverTarefa(origem, coluna);
    // O caminho muda de pasta quando move — precisa dos dados frescos do
    // servidor pra saber o novo caminho de cada tarefa movida.
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
        <Link
          href={urlDaSecao(caderno.secoes[0]?.caminho ?? caderno.caminho)}
          className="ml-auto shrink-0 text-[12px] text-tinta-3 hover:text-tinta hover:underline underline-offset-2"
        >
          Ver seções
        </Link>
      </header>

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

      {tarefaAberta ? (
        <DialogoTarefa
          caminho={tarefaAberta}
          aoFechar={() => definirTarefaAberta(null)}
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
  corDaColuna,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
  aoAbrir,
}: {
  tarefa: TarefaKanban;
  corDaColuna: string;
  sobrevoo: Sobrevoo;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltar: (origem: string, antes: boolean) => void;
  aoAbrir: () => void;
}) {
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
        </div>
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

/** Editor de uma tarefa: título (renomeia o arquivo) + corpo em markdown, com prévia ao lado. */
function DialogoTarefa({
  caminho,
  aoFechar,
  aoExcluir,
}: {
  caminho: string;
  aoFechar: () => void;
  aoExcluir: () => void;
}) {
  const [carregando, definirCarregando] = useState(true);
  const [titulo, definirTitulo] = useState("");
  const [conteudo, definirConteudo] = useState("");
  const [conteudoOriginal, definirConteudoOriginal] = useState("");
  const [confirmandoExclusao, definirConfirmandoExclusao] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  useEffect(() => {
    let cancelado = false;
    acaoLerTarefa(caminho).then((tarefa) => {
      if (cancelado || !tarefa) return;
      definirTitulo(tarefa.titulo);
      definirConteudo(tarefa.conteudo);
      definirConteudoOriginal(tarefa.conteudo);
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

  return (
    <Dialogo titulo={titulo || "Tarefa"} aberto largura="max-w-3xl" aoFechar={aoFechar}>
      {carregando ? (
        <p className="py-8 text-center text-[12.5px] text-tinta-3">Carregando…</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <textarea
              value={conteudo}
              onChange={(evento) => definirConteudo(evento.target.value)}
              placeholder="Descrição, checklist, o que quiser — em markdown."
              rows={14}
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
              <X size={13} />
              Fechar
            </Botao>
          </div>

          {confirmandoExclusao ? (
            <div className="mt-3 rounded-lg border border-linha bg-superficie p-3">
              <p className="text-[12.5px] text-tinta-2">
                Excluir “{titulo}”? Vai para a lixeira, dá para restaurar depois.
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
