"use client";

import clsx from "clsx";
import {
  CalendarDays,
  Download,
  GitBranch,
  House,
  LayoutTemplate,
  ListChecks,
  Moon,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  PocketKnife,
  Search,
  Sun,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { acaoAbrirNotaDoDia, acaoCapturaRapida, acaoExportarTudo } from "@/app/acoes";
import { ColunasProvedor, useColunas } from "@/lib/colunas";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import { cadernoDaUrl } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo } from "@/lib/tipos";

import { ColunaSecoes } from "./coluna-secoes";
import { PaletaBusca } from "./paleta-busca";
import { SeletorDeCadernos } from "./seletor-cadernos";
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
 * Moldura fixa do aplicativo: o trilho lateral e o conteúdo.
 *
 * É aqui que a cor do caderno aberto entra em cena — a variável --realce é
 * redefinida neste nível, então tudo abaixo (botões, marcações, a margem da
 * página) passa a usar a cor daquele caderno.
 */
export function Casca(props: {
  cadernos: Caderno[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  children: React.ReactNode;
}) {
  return (
    <ColunasProvedor>
      <CascaInterna {...props} />
    </ColunasProvedor>
  );
}

function CascaInterna({
  cadernos,
  etiquetas,
  modelos,
  children,
}: {
  cadernos: Caderno[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  children: React.ReactNode;
}) {
  const caminhoAtual = usePathname();
  const [buscaAberta, definirBuscaAberta] = useState(false);
  const [capturando, iniciarCaptura] = useTransition();
  const [indoParaHoje, iniciarIdaParaHoje] = useTransition();
  const [exportando, iniciarExportacao] = useTransition();
  const barraLateral = useLarguraRedimensionavel("largura-barra-lateral", {
    padrao: 248,
    minima: 190,
    maxima: 420,
  });
  const colunas = useColunas();

  // O caderno "aberto" (implícito no endereço atual) decide a cor de
  // destaque de tudo abaixo, e é quem passa suas seções para a coluna ao
  // lado da tira de cadernos — fora de /secao/... e /nota/..., é null (a
  // tela de início, etiquetas, grafo etc. não têm caderno "aberto").
  const nomeCadernoAtivo = cadernoDaUrl(caminhoAtual);
  const cadernoAtivo = cadernos.find((item) => item.nome === nomeCadernoAtivo) ?? null;
  const corAtiva = cadernoAtivo?.cor ?? null;

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const combinando = evento.ctrlKey || evento.metaKey;
      if (combinando && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        definirBuscaAberta(true);
      }
      if (combinando && evento.shiftKey && evento.key.toLowerCase() === "n") {
        evento.preventDefault();
        iniciarCaptura(async () => {
          await acaoCapturaRapida();
        });
      }
      if (combinando && evento.shiftKey && evento.key.toLowerCase() === "d") {
        evento.preventDefault();
        iniciarIdaParaHoje(async () => {
          await acaoAbrirNotaDoDia();
        });
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  return (
    <div
      className="relative flex h-screen overflow-hidden"
      style={corAtiva ? ({ "--realce": corAtiva } as React.CSSProperties) : undefined}
    >
      {colunas.recolhidas ? (
        // Sem isto, recolher as colunas não teria volta: o botão que abre de
        // novo vive dentro da própria coluna que acabou de sumir.
        <div className="absolute top-3 left-3 z-20">
          <BotaoIcone
            rotulo="Mostrar cadernos e páginas"
            onClick={colunas.alternar}
            className="bg-superficie-alta shadow-[var(--sombra-cartao-alta)]"
          >
            <PanelLeftOpen size={15} />
          </BotaoIcone>
        </div>
      ) : null}

      <aside
        className="relative flex shrink-0 flex-col overflow-hidden border-r border-linha bg-superficie"
        style={{ width: colunas.recolhidas ? 0 : barraLateral.largura }}
        aria-hidden={colunas.recolhidas}
        // `aria-hidden` sozinho não tira os links do Tab; `inert` também
        // impede foco por teclado enquanto a coluna está recolhida.
        inert={colunas.recolhidas}
      >
        <div className="flex items-center gap-2 px-3.5 py-3">
          <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
            <span
              className="transicao-realce flex size-7 shrink-0 items-center justify-center rounded-lg text-[14px] text-white"
              style={{ background: "var(--realce)" }}
              aria-hidden
            >
              <NotebookPen size={15} />
            </span>
            <span className="truncate text-[13.5px] font-bold tracking-[-0.01em]">
              Meu bloco de anotações
            </span>
          </Link>
          <BotaoIcone rotulo="Recolher cadernos e páginas" onClick={colunas.alternar}>
            <PanelLeftClose size={14} />
          </BotaoIcone>
          <BotaoTema />
        </div>

        <div className="px-2 pb-2">
          <BotaoDaBarra
            icone={<Search size={14} />}
            atalho="Ctrl K"
            onClick={() => definirBuscaAberta(true)}
          >
            Buscar
          </BotaoDaBarra>
          <BotaoDaBarra
            icone={<Zap size={14} />}
            atalho="Ctrl ⇧ N"
            disabled={capturando}
            onClick={() =>
              iniciarCaptura(async () => {
                await acaoCapturaRapida();
              })
            }
          >
            Captura rápida
          </BotaoDaBarra>
        </div>

        <div className="mx-3 h-px bg-linha" />

        <nav className="flex-1 overflow-y-auto p-2" aria-label="Atalhos">
          <Atalho href="/" icone={<House size={14} />} ativo={caminhoAtual === "/"}>
            Início
          </Atalho>
          <Atalho
            href="/etiquetas"
            icone={<Tag size={14} />}
            ativo={caminhoAtual.startsWith("/etiquetas")}
          >
            Etiquetas
          </Atalho>
          <Atalho
            href="/grafo"
            icone={<GitBranch size={14} />}
            ativo={caminhoAtual.startsWith("/grafo")}
          >
            Grafo
          </Atalho>
          <Atalho
            href="/tarefas"
            icone={<ListChecks size={14} />}
            ativo={caminhoAtual.startsWith("/tarefas")}
          >
            Tarefas
          </Atalho>
          <Atalho
            href="/modelos"
            icone={<LayoutTemplate size={14} />}
            ativo={caminhoAtual.startsWith("/modelos")}
          >
            Modelos
          </Atalho>
          <Atalho
            href="/clipper"
            icone={<PocketKnife size={14} />}
            ativo={caminhoAtual.startsWith("/clipper")}
          >
            Web Clipper
          </Atalho>
          <AtalhoBotao
            icone={<CalendarDays size={14} />}
            disabled={indoParaHoje}
            onClick={() =>
              iniciarIdaParaHoje(async () => {
                await acaoAbrirNotaDoDia();
              })
            }
          >
            Hoje
          </AtalhoBotao>
          <AtalhoBotao icone={<Download size={14} />} disabled={exportando} onClick={() => iniciarExportacao(baixarTudo)}>
            Exportar tudo
          </AtalhoBotao>
          <Atalho
            href="/lixeira"
            icone={<Trash2 size={14} />}
            ativo={caminhoAtual.startsWith("/lixeira")}
          >
            Lixeira
          </Atalho>
        </nav>

        {colunas.recolhidas ? null : (
          <AlcaRedimensionar
            aoArrastar={barraLateral.iniciarArraste}
            aoRestaurar={barraLateral.restaurarPadrao}
            rotulo="Redimensionar a barra lateral"
          />
        )}
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SeletorDeCadernos cadernos={cadernos} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {cadernoAtivo ? (
            <ColunaSecoes caderno={cadernoAtivo} cadernos={cadernos} modelos={modelos} />
          ) : null}
          {children}
        </div>
      </main>

      <PaletaBusca
        aberta={buscaAberta}
        aoFechar={() => definirBuscaAberta(false)}
        etiquetas={etiquetas}
      />
    </div>
  );
}

/** Linha clicável da barra lateral, com o atalho de teclado à direita. */
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

/** Mesma cara do Atalho, mas dispara uma ação em vez de ir para um link fixo
 * — usado por "Hoje", cujo endereço depende da data e só se sabe no servidor. */
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

function BotaoTema() {
  const [tema, definirTema] = useState<"claro" | "escuro">("claro");

  useEffect(() => {
    definirTema(document.documentElement.dataset.tema === "escuro" ? "escuro" : "claro");
  }, []);

  function alternar() {
    const proximo = tema === "claro" ? "escuro" : "claro";
    document.documentElement.dataset.tema = proximo;
    definirTema(proximo);
    try {
      localStorage.setItem("tema", proximo);
    } catch {
      // Sem armazenamento: o tema vale só para esta sessão.
    }
  }

  return (
    <BotaoIcone
      rotulo={tema === "claro" ? "Usar tema escuro" : "Usar tema claro"}
      onClick={alternar}
    >
      {tema === "claro" ? <Moon size={14} /> : <Sun size={14} />}
    </BotaoIcone>
  );
}
