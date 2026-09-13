"use client";

import clsx from "clsx";
import { Bookmark, KanbanSquare, KeyRound, NotebookText, SquareArrowOutUpRight, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { quadroDaUrl, urlDaSecao, urlDoQuadro } from "@/lib/rotas";
import type { Caderno, ResumoQuadro } from "@/lib/tipos";

import { ListaQuadros } from "./lista-quadros";
import { SeletorDeCadernos } from "./seletor-cadernos";
import { BotaoTema } from "./ui";

/**
 * A coluna mais à esquerda: qual aplicação está aberta e a lista dela.
 *
 * O aplicativo é um hub de aplicações independentes — hoje Anotações e
 * Kanban. Cada uma tem a sua própria lista (cadernos de um lado, quadros do
 * outro), que não se misturam: excluir um quadro não mexe num caderno de
 * mesmo nome, e vice-versa. Por isso a lista fica aqui, embaixo do seletor
 * de aplicação, e não numa tira no topo servindo às duas.
 */
export function BarraAplicacoes({
  appAtual,
  cadernos,
  quadros,
}: {
  appAtual: "notas" | "kanban" | "senhas" | "links";
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
}) {
  const roteador = useRouter();
  const caminhoAtual = usePathname();

  function irParaNotas() {
    if (appAtual === "notas") return;
    const primeiro = cadernos[0];
    roteador.push(primeiro ? urlDaSecao(primeiro.secoes[0]?.caminho ?? primeiro.caminho) : "/");
  }

  function irParaKanban() {
    if (appAtual === "kanban") return;
    roteador.push(quadros[0] ? urlDoQuadro(quadros[0].nome) : "/kanban");
  }

  function irParaSenhas() {
    if (appAtual === "senhas") return;
    roteador.push("/senhas");
  }

  function irParaLinks() {
    if (appAtual === "links") return;
    roteador.push("/links");
  }

  return (
    <aside className="flex w-[214px] shrink-0 flex-col overflow-hidden border-r border-linha bg-superficie">
      <div className="space-y-0.5 px-2 pt-3 pb-2.5">
        <BotaoApp
          ativo={appAtual === "notas"}
          icone={<NotebookText size={14} />}
          contagem={cadernos.length}
          onClick={irParaNotas}
          janela="/"
        >
          Anotações
        </BotaoApp>
        <BotaoApp
          ativo={appAtual === "kanban"}
          icone={<KanbanSquare size={14} />}
          contagem={quadros.length}
          onClick={irParaKanban}
          janela="/kanban"
        >
          Kanban
        </BotaoApp>
        <BotaoApp
          ativo={appAtual === "senhas"}
          icone={<KeyRound size={14} />}
          onClick={irParaSenhas}
          janela="/senhas"
        >
          Senhas
        </BotaoApp>
        <BotaoApp
          ativo={appAtual === "links"}
          icone={<Bookmark size={14} />}
          onClick={irParaLinks}
          janela="/links"
        >
          Links
        </BotaoApp>
      </div>

      <div className="mx-3 h-px bg-linha" />

      <div className="flex min-h-0 flex-1 flex-col pt-2">
        {appAtual === "notas" ? (
          <SeletorDeCadernos cadernos={cadernos} />
        ) : appAtual === "kanban" ? (
          <ListaQuadros quadros={quadros} />
        ) : null}
      </div>

      <div className="shrink-0 border-t border-linha p-2">
        {appAtual === "kanban"
          ? (() => {
              const quadroAberto = quadroDaUrl(caminhoAtual);
              return (
                <Link
                  href={
                    quadroAberto
                      ? `/kanban/etiquetas?quadro=${encodeURIComponent(quadroAberto)}`
                      : "/kanban/etiquetas"
                  }
                  className={clsx(
                    "flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[12.5px] transition-colors",
                    caminhoAtual === "/kanban/etiquetas"
                      ? "bg-realce-medio font-medium text-tinta"
                      : "text-tinta-2 hover:bg-realce-fraco",
                  )}
                >
                  <Tag size={14} className="text-tinta-3" />
                  Etiquetas do Kanban
                </Link>
              );
            })()
          : null}
        <div className="flex items-center justify-end px-1 pt-1">
          <BotaoTema />
        </div>
      </div>
    </aside>
  );
}

function BotaoApp({
  ativo,
  icone,
  contagem,
  onClick,
  janela,
  children,
}: {
  ativo: boolean;
  icone: React.ReactNode;
  /** Omitido para uma aplicação sem lista própria contável (ex.: Senhas, cujo conteúdo fica trancado até destrancar). */
  contagem?: number;
  onClick: () => void;
  /** Endereço a abrir numa janela separada do navegador (usar um app enquanto o outro fica na janela principal). */
  janela: string;
  children: React.ReactNode;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onClick}
        aria-pressed={ativo}
        aria-label={contagem === undefined ? String(children) : `${children} (${contagem})`}
        className={clsx(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-semibold transition-all",
          ativo
            ? "bg-[color-mix(in_srgb,var(--realce)_70%,black)] text-white shadow-[0_1px_2px_#16202e1a]"
            : "text-tinta-2 hover:bg-realce-medio hover:text-tinta",
        )}
      >
        {icone}
        <span className="flex-1 text-left">{children}</span>
        {contagem !== undefined ? (
          <span
            className={clsx(
              "text-[10.5px] tabular-nums group-hover:opacity-0",
              ativo ? "text-white/70" : "text-tinta-3",
            )}
          >
            {contagem}
          </span>
        ) : null}
      </button>
      {/* Aparece no hover, por cima da contagem: abre o app numa janela
          separada, para usar o Kanban enquanto anota (ou o contrário). */}
      <button
        type="button"
        title={`Abrir ${children} em nova janela`}
        aria-label={`Abrir ${children} em nova janela`}
        onClick={() => window.open(janela, "_blank")}
        className={clsx(
          "absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100",
          ativo ? "text-white/80 hover:text-white" : "text-tinta-3 hover:text-tinta",
        )}
      >
        <SquareArrowOutUpRight size={12} />
      </button>
    </div>
  );
}
