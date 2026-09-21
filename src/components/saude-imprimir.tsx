"use client";

import { Printer } from "lucide-react";

import { Botao } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

/** Página de impressão do histórico: só o texto, um botão de imprimir que some no papel. */
export function HistoricoParaImprimir({ titulo, markdown }: { titulo: string; markdown: string }) {
  return (
    <div className="min-h-screen bg-papel">
      <div className="esconde-na-impressao sticky top-0 flex items-center gap-3 border-b border-linha bg-superficie px-6 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-tinta-2">{titulo}</span>
        <Botao variante="primario" onClick={() => window.print()}>
          <Printer size={13} />
          Imprimir ou salvar em PDF
        </Botao>
      </div>
      <main className="mx-auto max-w-3xl px-8 py-8">
        <VisualizadorMarkdown conteudo={markdown} />
      </main>
    </div>
  );
}
