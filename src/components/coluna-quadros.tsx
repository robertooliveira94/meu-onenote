"use client";

import clsx from "clsx";
import { PanelLeftClose, PanelLeftOpen, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useColunas } from "@/lib/colunas";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import { quadroDaUrl } from "@/lib/rotas";
import type { ResumoQuadro } from "@/lib/tipos";

import { ListaQuadros } from "./lista-quadros";
import { AlcaRedimensionar, BotaoIcone } from "./ui";

/**
 * A coluna do Kanban: a lista de quadros (que morava embaixo do botão da
 * aplicação, na coluna de aplicativos) e o atalho pras etiquetas. Mesmo
 * esqueleto da coluna de seções das Anotações — recolhe pra uma faixa fina
 * com o nome do quadro aberto na vertical, redimensiona pela borda.
 */
export function ColunaQuadros({ quadros }: { quadros: ResumoQuadro[] }) {
  const caminhoAtual = usePathname();
  const colunas = useColunas();
  const recolhida = colunas.recolhida("quadros");
  const largura = useLarguraRedimensionavel("largura-coluna-quadros", {
    padrao: 220,
    minima: 170,
    maxima: 360,
  });

  const nomeAberto = quadroDaUrl(caminhoAtual);
  const quadroAberto = quadros.find((quadro) => quadro.nome === nomeAberto) ?? null;
  const hrefEtiquetas = nomeAberto ? `/kanban/etiquetas?quadro=${encodeURIComponent(nomeAberto)}` : "/kanban/etiquetas";

  if (recolhida) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-linha bg-superficie pt-3">
        <BotaoIcone rotulo="Mostrar quadros" onClick={() => colunas.alternar("quadros")}>
          <PanelLeftOpen size={15} />
        </BotaoIcone>
        {quadroAberto ? (
          <button
            type="button"
            onClick={() => colunas.alternar("quadros")}
            title={`Quadro aberto: ${quadroAberto.nome} (clique para mostrar os quadros)`}
            className="flex min-h-0 flex-1 flex-col items-center gap-2 pb-3"
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: quadroAberto.cor }} aria-hidden />
            <span className="texto-vertical min-h-0 text-[11.5px] font-medium text-tinta-2">{quadroAberto.nome}</span>
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden border-r border-linha bg-superficie"
      style={{ width: largura.largura }}
    >
      <div className="flex items-center gap-2 px-3.5 py-2.5">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold tracking-[-0.01em]">Kanban</span>
        <BotaoIcone rotulo="Recolher quadros" onClick={() => colunas.alternar("quadros")}>
          <PanelLeftClose size={14} />
        </BotaoIcone>
      </div>

      <div className="mx-3 h-px bg-linha" />

      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <ListaQuadros quadros={quadros} />
      </div>

      <div className="mx-3 h-px bg-linha" />

      <nav className="shrink-0 p-2" aria-label="Atalhos do Kanban">
        <Link
          href={hrefEtiquetas}
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
      </nav>

      <AlcaRedimensionar
        aoArrastar={largura.iniciarArraste}
        aoRestaurar={largura.restaurarPadrao}
        rotulo="Redimensionar a coluna de quadros"
      />
    </div>
  );
}
