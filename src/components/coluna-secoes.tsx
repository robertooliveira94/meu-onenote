"use client";

import clsx from "clsx";
import {
  Download,
  GitBranch,
  House,
  LayoutTemplate,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  PocketKnife,
  Search,
  Tag,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";

import { acaoExportarTudo } from "@/app/acoes";
import { useColunas } from "@/lib/colunas";
import { usePaleta } from "@/lib/paleta";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import type { Caderno, Modelo } from "@/lib/tipos";

import { ArvoreNotas } from "./arvore-notas";
import { AlcaRedimensionar, BotaoIcone } from "./ui";

/** Monta o vault inteiro num único arquivo no servidor e entrega ao navegador como download. */
async function baixarTudo(): Promise<void> {
  const { nome, conteudo } = await acaoExportarTudo();
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

/**
 * A coluna de navegação de Anotações: busca no topo, a árvore inteira
 * (cadernos › seções › páginas) no meio e os atalhos fixos no rodapé.
 *
 * Era uma coluna só de seções, com os cadernos espremidos em cima e as
 * páginas numa terceira coluna à parte. Agora é uma só — ver
 * `arvore-notas.tsx` para o porquê.
 */
export function ColunaSecoes({
  caderno,
  cadernos,
  modelos,
}: {
  /** O caderno aberto — só para a faixa recolhida dizer onde a pessoa está. */
  caderno: Caderno | null;
  cadernos: Caderno[];
  modelos: Modelo[];
}) {
  const caminhoAtual = usePathname();
  const paleta = usePaleta();
  const [exportando, iniciarExportacao] = useTransition();
  // 300 de partida (era 248): a coluna agora carrega a hierarquia inteira,
  // já que a lista de páginas deixou de ser uma coluna à parte.
  const largura = useLarguraRedimensionavel("largura-coluna-secoes", {
    padrao: 300,
    minima: 220,
    maxima: 460,
  });
  const colunas = useColunas();

  const secaoAtiva = caderno?.secoes.find((secao) =>
    decodeURIComponent(caminhoAtual).startsWith(`/nota/${secao.caminho}/`) ||
    caminhoAtual === `/secao/${encodeURIComponent(secao.caminho)}`,
  );

  if (colunas.recolhida("secoes")) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-linha bg-superficie pt-3">
        <BotaoIcone rotulo="Mostrar cadernos, seções e páginas" onClick={() => colunas.alternar("secoes")}>
          <PanelLeftOpen size={15} />
        </BotaoIcone>
        {/* Recolhida, a coluna ainda precisa dizer onde a pessoa está — o
            caminho escrito de cima para baixo é o que cabe nesta faixa.
            Clicar nele abre a coluna de volta. */}
        {caderno ? (
          <button
            type="button"
            onClick={() => colunas.alternar("secoes")}
            title={`${caderno.nome}${secaoAtiva ? ` › ${secaoAtiva.nome}` : ""} (clique para mostrar a árvore)`}
            className="flex min-h-0 flex-1 flex-col items-center gap-2 pb-3"
          >
            <span className="size-1.5 shrink-0 rounded-full" style={{ background: caderno.cor }} aria-hidden />
            <span className="texto-vertical min-h-0 text-[11.5px] font-medium text-tinta-2">
              {caderno.nome}
              {secaoAtiva ? ` › ${secaoAtiva.nome}` : ""}
            </span>
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
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold tracking-[-0.01em]">
          Anotações
        </span>
        <BotaoIcone rotulo="Recolher a árvore" onClick={() => colunas.alternar("secoes")}>
          <PanelLeftClose size={14} />
        </BotaoIcone>
      </div>

      <div className="px-2 pb-2">
        <BotaoDaBarra icone={<Search size={14} />} atalho="Ctrl K" onClick={() => paleta.abrir()}>
          Buscar
        </BotaoDaBarra>
      </div>

      <div className="mx-3 h-px bg-linha" />

      <ArvoreNotas cadernos={cadernos} modelos={modelos} />

      <div className="mx-3 h-px bg-linha" />

      <nav className="shrink-0 overflow-y-auto p-2" aria-label="Atalhos">
        <Atalho href="/" icone={<House size={14} />} ativo={caminhoAtual === "/"}>
          Início
        </Atalho>
        <Atalho href="/etiquetas" icone={<Tag size={14} />} ativo={caminhoAtual.startsWith("/etiquetas")}>
          Etiquetas
        </Atalho>
        <Atalho href="/grafo" icone={<GitBranch size={14} />} ativo={caminhoAtual.startsWith("/grafo")}>
          Grafo
        </Atalho>
        <Atalho href="/tarefas" icone={<ListChecks size={14} />} ativo={caminhoAtual.startsWith("/tarefas")}>
          Tarefas
        </Atalho>
        <Atalho href="/modelos" icone={<LayoutTemplate size={14} />} ativo={caminhoAtual.startsWith("/modelos")}>
          Modelos
        </Atalho>
        <Atalho href="/clipper" icone={<PocketKnife size={14} />} ativo={caminhoAtual.startsWith("/clipper")}>
          Web Clipper
        </Atalho>
        <AtalhoBotao
          icone={<Download size={14} />}
          disabled={exportando}
          onClick={() => iniciarExportacao(baixarTudo)}
        >
          Exportar tudo
        </AtalhoBotao>
        <Atalho href="/lixeira" icone={<Trash2 size={14} />} ativo={caminhoAtual.startsWith("/lixeira")}>
          Lixeira
        </Atalho>
      </nav>

      <AlcaRedimensionar
        aoArrastar={largura.iniciarArraste}
        aoRestaurar={largura.restaurarPadrao}
        rotulo="Redimensionar a coluna de navegação"
      />
    </div>
  );
}

/** Linha clicável da coluna, com o atalho de teclado à direita. */
function BotaoDaBarra({
  icone,
  atalho,
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icone: React.ReactNode;
  atalho?: string;
}) {
  return (
    <button
      type="button"
      {...resto}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[12.5px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta disabled:opacity-50"
    >
      <span className="text-tinta-3">{icone}</span>
      <span className="flex-1 truncate">{children}</span>
      {atalho ? <kbd className="font-mono text-[10px] text-tinta-3">{atalho}</kbd> : null}
    </button>
  );
}

function Atalho({
  href,
  icone,
  ativo,
  children,
}: {
  href: string;
  icone: React.ReactNode;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[12.5px] transition-colors",
        ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
      )}
    >
      <span className="text-tinta-3">{icone}</span>
      {children}
    </Link>
  );
}

/** Mesma cara do Atalho, mas dispara uma ação em vez de ir para um link fixo. */
function AtalhoBotao({
  icone,
  disabled,
  onClick,
  children,
}: {
  icone: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[12.5px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta disabled:opacity-50"
    >
      <span className="text-tinta-3">{icone}</span>
      {children}
    </button>
  );
}
