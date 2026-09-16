"use client";

import clsx from "clsx";
import { FileText, Slash, Tag } from "lucide-react";
import { useEffect, useRef } from "react";

import type { Sugestao, TipoDeGatilho } from "@/lib/sugestoes-editor";

const TITULO: Record<TipoDeGatilho, string> = {
  wikilink: "Linkar página",
  etiqueta: "Etiquetar esta página",
  comando: "Inserir",
};

const ICONE: Record<TipoDeGatilho, React.ReactNode> = {
  wikilink: <FileText size={12} />,
  etiqueta: <Tag size={12} />,
  comando: <Slash size={12} />,
};

/**
 * A caixinha de sugestões do editor, colada no cursor. Quem decide o que
 * ela lista, qual item está ativo e o que fazer ao escolher é o editor
 * (`nota.tsx`) — ela só desenha e responde ao clique. As setas e o Enter
 * ficam no `keydown` do campo de texto, porque é lá que a tecla chega.
 */
export function SugestoesEditor({
  tipo,
  itens,
  ativo,
  posicao,
  aoEscolher,
  aoPassarPorCima,
}: {
  tipo: TipoDeGatilho;
  itens: Sugestao[];
  ativo: number;
  /** Relativa ao envoltório posicionado do editor. */
  posicao: { esquerda: number; topo: number };
  aoEscolher: (item: Sugestao) => void;
  aoPassarPorCima: (indice: number) => void;
}) {
  const lista = useRef<HTMLDivElement>(null);

  // O item ativo acompanha as setas mesmo quando a lista rola por dentro.
  useEffect(() => {
    lista.current?.children[ativo]?.scrollIntoView({ block: "nearest" });
  }, [ativo]);

  return (
    <div
      role="listbox"
      aria-label={TITULO[tipo]}
      className="surgir absolute z-30 w-[280px] overflow-hidden rounded-xl border border-linha bg-superficie-alta shadow-[var(--sombra)]"
      style={{ left: posicao.esquerda, top: posicao.topo }}
      // Clicar na caixa não pode tirar o foco do campo — senão a seleção
      // some antes de a escolha ser aplicada.
      onMouseDown={(evento) => evento.preventDefault()}
    >
      <div className="flex items-center gap-1.5 border-b border-linha px-2.5 py-1.5 text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
        {ICONE[tipo]}
        {TITULO[tipo]}
      </div>
      <div ref={lista} className="max-h-[220px] overflow-y-auto p-1">
        {itens.length === 0 ? (
          <p className="px-2 py-2 text-[11.5px] text-tinta-3">Nada com esse nome.</p>
        ) : (
          itens.map((item, indice) => (
            <button
              key={item.id}
              type="button"
              role="option"
              aria-selected={indice === ativo}
              onClick={() => aoEscolher(item)}
              onMouseEnter={() => aoPassarPorCima(indice)}
              className={clsx(
                "flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left",
                indice === ativo ? "bg-realce-medio text-tinta" : "text-tinta-2",
              )}
            >
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{item.rotulo}</span>
              {item.detalhe ? (
                <span className="max-w-[45%] shrink-0 truncate text-[10.5px] text-tinta-3">{item.detalhe}</span>
              ) : null}
            </button>
          ))
        )}
      </div>
      <div className="border-t border-linha px-2.5 py-1 text-[10px] text-tinta-3">
        ↑↓ escolhe · Enter aplica · Esc fecha
      </div>
    </div>
  );
}
