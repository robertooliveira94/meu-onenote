"use client";

import clsx from "clsx";
import { CalendarCheck, Flag } from "lucide-react";
import Link from "next/link";

import { CORES_PRIORIDADE } from "@/lib/cores";
import type { TarefaAgendada, TarefasAgendadas } from "@/lib/kanban";
import { formatarDia, urlDaTarefaNoQuadro } from "@/lib/rotas";
import { siglaDoQuadro } from "@/lib/sigla";
import type { ResumoQuadro } from "@/lib/tipos";
import { RUBRICA_PRIORIDADE } from "@/lib/tipos";

import { Vazio } from "./ui";

const GRUPOS: { chave: keyof TarefasAgendadas; titulo: string; perigo?: boolean }[] = [
  { chave: "atrasadas", titulo: "Atrasadas", perigo: true },
  { chave: "hoje", titulo: "Hoje" },
  { chave: "semana", titulo: "Esta semana" },
  { chave: "depois", titulo: "Depois" },
];

/**
 * A tela "Hoje" do Kanban: tudo que tem prazo, de todos os quadros, em
 * quatro grupos. É o que se abre de manhã — o quadro responde "o que está
 * onde", esta responde "o que vence quando". Clicar leva ao quadro com a
 * tarefa já aberta no painel.
 */
export function HojeKanban({ grupos, quadros }: { grupos: TarefasAgendadas; quadros: ResumoQuadro[] }) {
  const total = GRUPOS.reduce((soma, grupo) => soma + grupos[grupo.chave].length, 0);
  const corDoQuadro = (nome: string) => quadros.find((quadro) => quadro.nome === nome)?.cor ?? "var(--tinta-3)";

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <header className="flex shrink-0 items-center gap-2.5 border-b border-linha bg-superficie px-6 py-3">
        <CalendarCheck size={18} className="text-tinta-2" aria-hidden />
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-extrabold tracking-[-0.02em]">Hoje</h1>
          <p className="text-[11.5px] text-tinta-2">
            {total === 0
              ? "Nenhuma tarefa com prazo em nenhum quadro."
              : `${total} ${total === 1 ? "tarefa com prazo" : "tarefas com prazo"} em ${quadros.length} ${quadros.length === 1 ? "quadro" : "quadros"} — fora das colunas de conclusão`}
          </p>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-3xl">
          {total === 0 ? (
            <Vazio
              icone={<CalendarCheck size={20} />}
              titulo="Nada com prazo"
              descricao="Dê um prazo a uma tarefa (campo Prazo no painel, ou a tecla D sobre o cartão) e ela aparece aqui, agrupada por urgência."
            />
          ) : (
            GRUPOS.map((grupo) => {
              const tarefas = grupos[grupo.chave];
              if (tarefas.length === 0) return null;
              return (
                <section key={grupo.chave} className="mb-7">
                  <h2
                    className={clsx(
                      "mb-2 flex items-baseline gap-2 text-[11px] font-bold tracking-[0.08em] uppercase",
                      grupo.perigo ? "text-perigo" : "text-tinta-3",
                    )}
                  >
                    {grupo.titulo}
                    <span className="font-normal tabular-nums">{tarefas.length}</span>
                  </h2>
                  <ul className="lista-cartoes">
                    {tarefas.map((tarefa) => (
                      <LinhaAgendada
                        key={tarefa.caminho}
                        tarefa={tarefa}
                        cor={corDoQuadro(tarefa.quadro)}
                        atrasada={grupo.chave === "atrasadas"}
                      />
                    ))}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function LinhaAgendada({ tarefa, cor, atrasada }: { tarefa: TarefaAgendada; cor: string; atrasada: boolean }) {
  const feitas = tarefa.subtarefas.filter((item) => item.feita).length;
  return (
    <li>
      <Link
        href={urlDaTarefaNoQuadro(tarefa.quadro, tarefa.caminho)}
        className="cartao flex items-center gap-3"
        style={{ borderLeft: `3px solid ${cor}` }}
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 font-mono text-[10px] tracking-wide text-tinta-3">
            <span>
              {siglaDoQuadro(tarefa.quadro)}-{tarefa.numero}
            </span>
            <span className="flex items-center gap-1 font-sans text-[10.5px] tracking-normal">
              <span className="size-1.5 rounded-full" style={{ background: cor }} aria-hidden />
              {tarefa.quadro} · {tarefa.coluna}
            </span>
          </p>
          <p className="truncate text-[13px] font-medium text-tinta">{tarefa.titulo}</p>
        </div>
        {tarefa.subtarefas.length > 0 ? (
          <span className="shrink-0 text-[10.5px] text-tinta-3 tabular-nums">
            {feitas}/{tarefa.subtarefas.length}
          </span>
        ) : null}
        {tarefa.prioridade ? (
          <Flag
            size={12}
            className="shrink-0"
            style={{ color: CORES_PRIORIDADE[tarefa.prioridade] }}
            aria-label={`Prioridade ${RUBRICA_PRIORIDADE[tarefa.prioridade]}`}
          />
        ) : null}
        <span
          className={clsx("shrink-0 text-[11.5px] tabular-nums", atrasada ? "font-semibold text-perigo" : "text-tinta-2")}
          title={tarefa.prazo ?? undefined}
        >
          {tarefa.prazo ? formatarDia(tarefa.prazo) : ""}
        </span>
      </Link>
    </li>
  );
}
