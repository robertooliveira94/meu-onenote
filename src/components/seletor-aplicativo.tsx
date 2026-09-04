"use client";

import clsx from "clsx";
import { KanbanSquare, NotebookText } from "lucide-react";
import { useRouter } from "next/navigation";

import { urlDaSecao, urlDoKanban } from "@/lib/rotas";
import type { Caderno } from "@/lib/tipos";

/**
 * Alterna entre as duas aplicações independentes: Anotações (cadernos,
 * seções, páginas — com toda a coluna de navegação) e Kanban (um quadro por
 * caderno, sem nada da coluna de ações das anotações). Fica no topo da
 * tela, acima até da tira de cadernos — a troca não é um detalhe de
 * navegação dentro de um caderno, é uma escolha de qual aplicativo usar.
 */
export function SeletorAplicativo({
  appAtual,
  cadernoAtivo,
  cadernos,
}: {
  appAtual: "notas" | "kanban";
  /** O caderno "aberto" no endereço atual, se houver. */
  cadernoAtivo: Caderno | null;
  cadernos: Caderno[];
}) {
  const roteador = useRouter();
  // Sem caderno aberto (ex.: na tela de Início), cai no primeiro da lista —
  // mesma lógica do clique num chip de caderno.
  const cadernoParaAlternar = cadernoAtivo ?? cadernos[0] ?? null;

  function irParaNotas() {
    if (appAtual === "notas") return;
    const destino = cadernoParaAlternar
      ? urlDaSecao(cadernoParaAlternar.secoes[0]?.caminho ?? cadernoParaAlternar.caminho)
      : "/";
    roteador.push(destino);
  }

  function irParaKanban() {
    if (appAtual === "kanban" || !cadernoParaAlternar) return;
    roteador.push(urlDoKanban(cadernoParaAlternar.caminho));
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <BotaoApp ativo={appAtual === "notas"} icone={<NotebookText size={14} />} onClick={irParaNotas}>
        Anotações
      </BotaoApp>
      <BotaoApp
        ativo={appAtual === "kanban"}
        icone={<KanbanSquare size={14} />}
        disabled={!cadernoParaAlternar}
        titulo={!cadernoParaAlternar ? "Crie um caderno primeiro" : undefined}
        onClick={irParaKanban}
      >
        Kanban
      </BotaoApp>
    </div>
  );
}

function BotaoApp({
  ativo,
  icone,
  disabled,
  titulo,
  onClick,
  children,
}: {
  ativo: boolean;
  icone: React.ReactNode;
  disabled?: boolean;
  titulo?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={titulo}
      aria-pressed={ativo}
      className={clsx(
        "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-[12.5px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-40",
        ativo
          ? "bg-[color-mix(in_srgb,var(--realce)_70%,black)] text-white shadow-[0_1px_2px_#16202e1a]"
          : "text-tinta-2 hover:bg-realce-medio hover:text-tinta",
      )}
    >
      {icone}
      {children}
    </button>
  );
}
