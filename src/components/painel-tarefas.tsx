"use client";

import { ListChecks } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { acaoAlternarTarefaEm } from "@/app/acoes";
import { urlDaNota } from "@/lib/rotas";
import type { Tarefa } from "@/lib/tarefas";

import { Vazio } from "./ui";

/**
 * Todo `- [ ]`/`- [x]` do vault, juntado num só lugar — sem precisar abrir
 * caderno por caderno atrás do que falta fazer. Clicar na caixinha aqui
 * grava direto no arquivo de origem, igual à visualização de uma nota.
 */
export function PainelTarefas({ tarefas: tarefasIniciais }: { tarefas: Tarefa[] }) {
  const [tarefas, definirTarefas] = useState(tarefasIniciais);
  const [mostrarConcluidas, definirMostrarConcluidas] = useState(false);

  const pendentes = tarefas.filter((tarefa) => !tarefa.concluida).length;

  const porNota = useMemo(() => {
    const grupos = new Map<string, { titulo: string; itens: Tarefa[] }>();
    for (const tarefa of tarefas) {
      if (!mostrarConcluidas && tarefa.concluida) continue;
      const grupo = grupos.get(tarefa.caminho);
      if (grupo) grupo.itens.push(tarefa);
      else grupos.set(tarefa.caminho, { titulo: tarefa.titulo, itens: [tarefa] });
    }
    return [...grupos.entries()].sort((a, b) => a[1].titulo.localeCompare(b[1].titulo, "pt-BR"));
  }, [tarefas, mostrarConcluidas]);

  async function alternar(tarefa: Tarefa) {
    definirTarefas((atual) =>
      atual.map((item) =>
        item.caminho === tarefa.caminho && item.indice === tarefa.indice
          ? { ...item, concluida: !item.concluida }
          : item,
      ),
    );
    await acaoAlternarTarefaEm(tarefa.caminho, tarefa.indice);
  }

  if (tarefas.length === 0) {
    return (
      <Vazio
        icone={<ListChecks size={20} />}
        titulo="Nenhuma tarefa ainda"
        descricao="Escreva '- [ ] alguma coisa' em qualquer página — ela aparece aqui, de qualquer caderno."
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Tarefas</h1>
          <p className="mt-1 text-[13px] text-tinta-2">
            {pendentes === 0
              ? "Tudo em dia — nenhuma tarefa pendente."
              : `${pendentes} ${pendentes === 1 ? "tarefa pendente" : "tarefas pendentes"}, de todos os cadernos.`}
          </p>
        </div>
        <label className="flex shrink-0 items-center gap-1.5 pt-1 text-[12.5px] text-tinta-2">
          <input
            type="checkbox"
            checked={mostrarConcluidas}
            onChange={(evento) => definirMostrarConcluidas(evento.target.checked)}
            className="size-3.5 accent-[var(--realce)]"
          />
          Mostrar concluídas
        </label>
      </div>

      {porNota.length === 0 ? (
        <p className="mt-8 text-[13px] text-tinta-3 italic">Nenhuma tarefa pendente para mostrar.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {porNota.map(([caminho, grupo]) => (
            <div key={caminho}>
              <Link
                href={urlDaNota(caminho)}
                title={caminho}
                className="text-[12.5px] font-semibold tracking-[-0.01em] text-tinta-2 hover:text-tinta hover:underline underline-offset-2"
              >
                {grupo.titulo}
              </Link>
              <ul className="mt-1.5 space-y-1 rounded-xl border border-linha bg-superficie-alta">
                {grupo.itens.map((tarefa) => (
                  <li
                    key={tarefa.indice}
                    className="flex items-start gap-2 border-b border-linha px-3 py-2 text-[13px] last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={tarefa.concluida}
                      onChange={() => alternar(tarefa)}
                      className="mt-0.5 size-3.5 shrink-0 accent-[var(--realce)]"
                    />
                    <span className={tarefa.concluida ? "text-tinta-3 line-through" : "text-tinta"}>
                      {tarefa.texto || <span className="italic">(sem texto)</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
