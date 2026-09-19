"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, Flag } from "lucide-react";
import { useMemo, useState } from "react";

import { CORES_PRIORIDADE } from "@/lib/cores";
import { formatarDia } from "@/lib/rotas";
import { PRIORIDADES, RUBRICA_PRIORIDADE } from "@/lib/tipos";
import type { EtiquetaKanban, SprintKanban, TarefaKanban } from "@/lib/tipos";

/**
 * As outras duas visões do quadro, sobre o mesmo filtro: a **lista** (tabela
 * ordenável por qualquer coluna — indispensável para "tudo que vence esta
 * semana, por prioridade") e o **calendário** (o mês, com cada tarefa no
 * dia do prazo). As duas abrem a tarefa no mesmo painel do quadro.
 */

type ChaveDeOrdem = "numero" | "titulo" | "coluna" | "prioridade" | "prazo" | "estimativa" | "sprint" | "criadoEm";

const COLUNAS_DA_LISTA: { chave: ChaveDeOrdem; rotulo: string; classe?: string }[] = [
  { chave: "numero", rotulo: "#", classe: "w-16" },
  { chave: "titulo", rotulo: "Tarefa" },
  { chave: "coluna", rotulo: "Coluna", classe: "w-28" },
  { chave: "prioridade", rotulo: "Prioridade", classe: "w-24" },
  { chave: "prazo", rotulo: "Prazo", classe: "w-24" },
  { chave: "estimativa", rotulo: "Est.", classe: "w-12" },
  { chave: "sprint", rotulo: "Sprint", classe: "w-28" },
  { chave: "criadoEm", rotulo: "Criada", classe: "w-24" },
];

function valorParaOrdenar(tarefa: TarefaKanban, chave: ChaveDeOrdem, sprints: SprintKanban[], colunas: string[]): number | string {
  switch (chave) {
    case "numero":
      return tarefa.numero;
    case "titulo":
      return tarefa.titulo.toLowerCase();
    case "coluna":
      return colunas.indexOf(tarefa.coluna);
    case "prioridade":
      return tarefa.prioridade ? PRIORIDADES.indexOf(tarefa.prioridade) : -1;
    case "prazo":
      return tarefa.prazo ?? "9999";
    case "estimativa":
      return tarefa.estimativa ? ["P", "M", "G"].indexOf(tarefa.estimativa) : -1;
    case "sprint":
      return sprints.find((s) => s.id === tarefa.sprintId)?.nome.toLowerCase() ?? "";
    case "criadoEm":
      return tarefa.criadoEm;
  }
}

export function VisaoLista({
  tarefas,
  colunas,
  sprints,
  etiquetasKanban,
  sigla,
  hoje,
  colunasConcluidas,
  tarefaAberta,
  aoAbrir,
}: {
  tarefas: TarefaKanban[];
  colunas: string[];
  sprints: SprintKanban[];
  etiquetasKanban: EtiquetaKanban[];
  sigla: string;
  hoje: string;
  colunasConcluidas: string[];
  tarefaAberta: string | null;
  aoAbrir: (caminho: string) => void;
}) {
  const [ordem, definirOrdem] = useState<{ chave: ChaveDeOrdem; crescente: boolean }>({ chave: "coluna", crescente: true });

  const ordenadas = useMemo(() => {
    const copia = [...tarefas];
    copia.sort((a, b) => {
      const va = valorParaOrdenar(a, ordem.chave, sprints, colunas);
      const vb = valorParaOrdenar(b, ordem.chave, sprints, colunas);
      const resultado = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return ordem.crescente ? resultado : -resultado;
    });
    return copia;
  }, [tarefas, ordem, sprints, colunas]);

  function alternarOrdem(chave: ChaveDeOrdem) {
    definirOrdem((atual) => (atual.chave === chave ? { chave, crescente: !atual.crescente } : { chave, crescente: true }));
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-[12.5px]">
        <thead className="sticky top-0 z-10 bg-papel">
          <tr>
            {COLUNAS_DA_LISTA.map((coluna) => (
              <th
                key={coluna.chave}
                className={clsx("border-b border-linha px-2 py-1.5 text-left font-medium text-tinta-3", coluna.classe)}
              >
                <button
                  type="button"
                  onClick={() => alternarOrdem(coluna.chave)}
                  className="flex items-center gap-1 text-[10.5px] tracking-[0.06em] uppercase hover:text-tinta"
                  aria-sort={ordem.chave === coluna.chave ? (ordem.crescente ? "ascending" : "descending") : undefined}
                >
                  {coluna.rotulo}
                  {ordem.chave === coluna.chave ? (
                    ordem.crescente ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                  ) : null}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ordenadas.length === 0 ? (
            <tr>
              <td colSpan={COLUNAS_DA_LISTA.length} className="px-2 py-6 text-center text-tinta-3">
                Nenhuma tarefa bate com o filtro atual.
              </td>
            </tr>
          ) : (
            ordenadas.map((tarefa) => {
              const atrasada = Boolean(tarefa.prazo) && tarefa.prazo! < hoje && !colunasConcluidas.includes(tarefa.coluna);
              const sprint = sprints.find((s) => s.id === tarefa.sprintId);
              const etiquetas = tarefa.etiquetas
                .map((id) => etiquetasKanban.find((e) => e.id === id))
                .filter((e): e is EtiquetaKanban => Boolean(e));
              return (
                <tr
                  key={tarefa.caminho}
                  onClick={() => aoAbrir(tarefa.caminho)}
                  className={clsx(
                    "cursor-pointer transition-colors hover:bg-realce-fraco",
                    tarefaAberta === tarefa.caminho && "bg-realce-medio",
                  )}
                >
                  <td className="border-b border-linha px-2 py-1.5 font-mono text-[10.5px] text-tinta-3">
                    {sigla}-{tarefa.numero}
                  </td>
                  <td className="border-b border-linha px-2 py-1.5">
                    <span className="font-medium text-tinta">{tarefa.titulo}</span>
                    {etiquetas.length > 0 ? (
                      <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
                        {etiquetas.map((etiqueta) => (
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
                      </span>
                    ) : null}
                  </td>
                  <td className="border-b border-linha px-2 py-1.5 text-tinta-2">{tarefa.coluna}</td>
                  <td className="border-b border-linha px-2 py-1.5 text-tinta-2">
                    {tarefa.prioridade ? (
                      <span className="flex items-center gap-1">
                        <Flag size={11} style={{ color: CORES_PRIORIDADE[tarefa.prioridade] }} />
                        {RUBRICA_PRIORIDADE[tarefa.prioridade]}
                      </span>
                    ) : (
                      <span className="text-tinta-3">—</span>
                    )}
                  </td>
                  <td className={clsx("border-b border-linha px-2 py-1.5 tabular-nums", atrasada ? "font-semibold text-perigo" : "text-tinta-2")}>
                    {tarefa.prazo ? formatarDia(tarefa.prazo) : <span className="text-tinta-3">—</span>}
                  </td>
                  <td className="border-b border-linha px-2 py-1.5 text-tinta-2">{tarefa.estimativa ?? <span className="text-tinta-3">—</span>}</td>
                  <td className="border-b border-linha px-2 py-1.5 text-tinta-2">{sprint?.nome ?? <span className="text-tinta-3">—</span>}</td>
                  <td className="border-b border-linha px-2 py-1.5 text-tinta-3 tabular-nums">{tarefa.criadoEm.slice(0, 10).split("-").reverse().join("/")}</td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------- calendário

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

function chaveDoDia(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

export function VisaoCalendario({
  tarefas,
  hoje,
  colunasConcluidas,
  sigla,
  tarefaAberta,
  aoAbrir,
}: {
  tarefas: TarefaKanban[];
  hoje: string;
  colunasConcluidas: string[];
  sigla: string;
  tarefaAberta: string | null;
  aoAbrir: (caminho: string) => void;
}) {
  const [ano, mes] = hoje.split("-").map(Number);
  const [cursor, definirCursor] = useState({ ano, mes: mes - 1 });

  const porDia = useMemo(() => {
    const mapa = new Map<string, TarefaKanban[]>();
    for (const tarefa of tarefas) {
      if (!tarefa.prazo) continue;
      const lista = mapa.get(tarefa.prazo) ?? [];
      lista.push(tarefa);
      mapa.set(tarefa.prazo, lista);
    }
    return mapa;
  }, [tarefas]);
  const semPrazo = tarefas.filter((tarefa) => !tarefa.prazo).length;

  // A grade: do domingo antes do dia 1 até o sábado depois do último dia.
  const primeiro = new Date(cursor.ano, cursor.mes, 1);
  const inicio = new Date(primeiro);
  inicio.setDate(1 - primeiro.getDay());
  const celulas: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const dia = new Date(inicio);
    dia.setDate(inicio.getDate() + i);
    celulas.push(dia);
    if (i >= 34 && dia.getMonth() !== cursor.mes && dia.getDay() === 6) break;
  }

  function mudarMes(passo: number) {
    definirCursor((atual) => {
      const data = new Date(atual.ano, atual.mes + passo, 1);
      return { ano: data.getFullYear(), mes: data.getMonth() };
    });
  }

  const nomeDoMes = primeiro.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4">
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
          className="rounded-md p-1 text-tinta-2 hover:bg-realce-fraco hover:text-tinta"
        >
          <ChevronLeft size={15} />
        </button>
        <h2 className="min-w-[180px] text-center text-[13.5px] font-bold capitalize">{nomeDoMes}</h2>
        <button
          type="button"
          onClick={() => mudarMes(1)}
          aria-label="Mês seguinte"
          className="rounded-md p-1 text-tinta-2 hover:bg-realce-fraco hover:text-tinta"
        >
          <ChevronRight size={15} />
        </button>
        <button
          type="button"
          onClick={() => definirCursor({ ano, mes: mes - 1 })}
          className="ml-1 rounded-md px-2 py-1 text-[11.5px] text-tinta-2 hover:bg-realce-fraco hover:text-tinta"
        >
          Hoje
        </button>
        {semPrazo > 0 ? (
          <span className="ml-auto text-[11.5px] text-tinta-3">
            {semPrazo} {semPrazo === 1 ? "tarefa sem prazo" : "tarefas sem prazo"} fora do calendário
          </span>
        ) : null}
      </div>

      <div className="grid shrink-0 grid-cols-7 text-center text-[10.5px] font-medium tracking-[0.06em] text-tinta-3 uppercase">
        {DIAS_DA_SEMANA.map((dia) => (
          <div key={dia} className="pb-1">
            {dia}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-7 gap-px overflow-y-auto rounded-xl border border-linha bg-linha">
        {celulas.map((dia) => {
          const chave = chaveDoDia(dia);
          const doMes = dia.getMonth() === cursor.mes;
          const ehHoje = chave === hoje;
          const lista = porDia.get(chave) ?? [];
          return (
            <div
              key={chave}
              className={clsx("flex min-h-[84px] flex-col gap-0.5 bg-superficie p-1", !doMes && "bg-papel")}
            >
              <span
                className={clsx(
                  "mb-0.5 self-start rounded-full px-1.5 text-[10.5px] tabular-nums",
                  ehHoje ? "bg-[var(--realce)] font-bold text-white" : doMes ? "text-tinta-2" : "text-tinta-3",
                )}
              >
                {dia.getDate()}
              </span>
              {lista.slice(0, 4).map((tarefa) => {
                const atrasada = chave < hoje && !colunasConcluidas.includes(tarefa.coluna);
                const concluida = colunasConcluidas.includes(tarefa.coluna);
                return (
                  <button
                    key={tarefa.caminho}
                    type="button"
                    onClick={() => aoAbrir(tarefa.caminho)}
                    title={`${sigla}-${tarefa.numero} · ${tarefa.titulo} · ${tarefa.coluna}`}
                    className={clsx(
                      "truncate rounded px-1 py-0.5 text-left text-[10.5px] leading-tight transition-colors",
                      tarefaAberta === tarefa.caminho ? "bg-realce-medio text-tinta" : "bg-realce-fraco text-tinta-2 hover:text-tinta",
                      atrasada && "bg-[color-mix(in_srgb,var(--perigo)_12%,transparent)] text-perigo",
                      concluida && "line-through opacity-60",
                    )}
                    style={{ borderLeft: `2px solid ${tarefa.prioridade ? CORES_PRIORIDADE[tarefa.prioridade] : "var(--linha-forte)"}` }}
                  >
                    {tarefa.titulo}
                  </button>
                );
              })}
              {lista.length > 4 ? <span className="px-1 text-[10px] text-tinta-3">+{lista.length - 4}</span> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
