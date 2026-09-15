"use client";

import clsx from "clsx";
import { Bookmark, KanbanSquare, KeyRound, Keyboard, NotebookText, SquareArrowOutUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

import { urlDaSecao, urlDoQuadro } from "@/lib/rotas";
import type { Caderno, ResumoQuadro } from "@/lib/tipos";

import { BotaoIcone, BotaoTema, ItemMenu, Menu } from "./ui";

export type App = "notas" | "kanban" | "senhas" | "links";

/**
 * O trilho de aplicativos: a coluna mais à esquerda, só com ícones.
 *
 * Era uma coluna de 214px com nome, contagem e a lista da aplicação aberta
 * (cadernos, quadros) embaixo. Junto da coluna de seções e da lista de
 * páginas, a moldura chegava a 754px antes de qualquer conteúdo — num
 * notebook de 1366px sobravam ~610px pra nota. Agora são 56px: o nome vai
 * pro tooltip, a contagem junto, e cada lista mora na coluna da própria
 * aplicação (cadernos na coluna de seções, quadros numa coluna própria).
 * O hub continua sendo aplicações independentes — só ocupa menos.
 */
export function BarraAplicacoes({
  appAtual,
  cadernos,
  quadros,
  atrasadas,
  aoAbrirAtalhos,
}: {
  appAtual: App;
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  /** Tarefas com prazo estourado em qualquer quadro — vira o ponto no ícone do Kanban. */
  atrasadas: number;
  aoAbrirAtalhos: () => void;
}) {
  const roteador = useRouter();

  function irParaNotas() {
    if (appAtual === "notas") return;
    const primeiro = cadernos[0];
    roteador.push(primeiro ? urlDaSecao(primeiro.secoes[0]?.caminho ?? primeiro.caminho) : "/");
  }

  function irParaKanban() {
    if (appAtual === "kanban") return;
    roteador.push(quadros[0] ? urlDoQuadro(quadros[0].nome) : "/kanban");
  }

  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center border-r border-linha bg-superficie py-2.5">
      <nav className="flex flex-col items-center gap-1" aria-label="Aplicativos">
        <BotaoApp
          nome="Anotações"
          detalhe={plural(cadernos.length, "caderno", "cadernos")}
          ativo={appAtual === "notas"}
          icone={<NotebookText size={18} />}
          onClick={irParaNotas}
          janela="/"
        />
        <BotaoApp
          nome="Kanban"
          detalhe={
            atrasadas
              ? `${plural(quadros.length, "quadro", "quadros")} · ${plural(atrasadas, "tarefa atrasada", "tarefas atrasadas")}`
              : plural(quadros.length, "quadro", "quadros")
          }
          ativo={appAtual === "kanban"}
          alerta={atrasadas > 0}
          icone={<KanbanSquare size={18} />}
          onClick={irParaKanban}
          janela="/kanban"
        />
        <BotaoApp
          nome="Senhas"
          ativo={appAtual === "senhas"}
          icone={<KeyRound size={18} />}
          onClick={() => appAtual !== "senhas" && roteador.push("/senhas")}
          janela="/senhas"
        />
        <BotaoApp
          nome="Links"
          ativo={appAtual === "links"}
          icone={<Bookmark size={18} />}
          onClick={() => appAtual !== "links" && roteador.push("/links")}
          janela="/links"
        />
      </nav>

      <div className="mt-auto flex flex-col items-center gap-1">
        <BotaoIcone rotulo="Atalhos de teclado (?)" onClick={aoAbrirAtalhos}>
          <Keyboard size={14} />
        </BotaoIcone>
        <BotaoTema />
      </div>
    </aside>
  );
}

function BotaoApp({
  nome,
  detalhe,
  ativo,
  icone,
  onClick,
  janela,
  alerta = false,
}: {
  nome: string;
  /** Contagem da lista da aplicação, no tooltip ("3 cadernos"). Omitido quando não há lista contável. */
  detalhe?: string;
  ativo: boolean;
  icone: React.ReactNode;
  onClick: () => void;
  /** Ponto vermelho no canto do ícone — algo pede atenção lá dentro (tarefa atrasada). */
  alerta?: boolean;
  /** Endereço a abrir numa janela separada do navegador — no menu do botão direito. */
  janela: string;
}) {
  const titulo = detalhe ? `${nome} · ${detalhe}` : nome;
  return (
    <Menu
      alinhamento="esquerda"
      gatilho={(abrir) => (
        <button
          type="button"
          onClick={onClick}
          // Botão direito: "abrir em nova janela". Num trilho de 56px não
          // cabe o botãozinho de hover que existia na coluna larga.
          onContextMenu={(evento) => {
            evento.preventDefault();
            abrir();
          }}
          aria-pressed={ativo}
          aria-label={titulo}
          title={titulo}
          className={clsx(
            "relative flex size-10 items-center justify-center rounded-lg transition-all",
            ativo
              ? "bg-[color-mix(in_srgb,var(--realce)_70%,black)] text-white shadow-[0_1px_2px_#16202e1a]"
              : "text-tinta-2 hover:bg-realce-medio hover:text-tinta",
          )}
        >
          {icone}
          {alerta ? (
            <span
              aria-hidden
              className="absolute top-1.5 right-1.5 size-2 rounded-full bg-perigo ring-2 ring-superficie"
            />
          ) : null}
        </button>
      )}
    >
      {(fechar) => (
        <ItemMenu
          icone={<SquareArrowOutUpRight size={14} />}
          onClick={() => {
            fechar();
            window.open(janela, "_blank");
          }}
        >
          Abrir {nome} em nova janela
        </ItemMenu>
      )}
    </Menu>
  );
}
