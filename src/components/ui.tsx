"use client";

import clsx from "clsx";
import { Moon, Sun, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Peças de interface reaproveitadas em todas as telas. */

type VarianteBotao = "primario" | "normal" | "sutil" | "perigo" | "perigo-solido";

const estilosBotao: Record<VarianteBotao, string> = {
  // Texto branco sobre a cor cheia do caderno: nenhuma das seis cores
  // cíclicas passa 4.5:1 com branco na saturação documentada no DESIGN.md,
  // então o fundo do botão usa uma versão escurecida — só aqui, nunca na
  // bolinha/barra/carimbo/margem, que continuam com a cor exata do caderno.
  primario:
    "transicao-realce bg-[color-mix(in_srgb,var(--realce)_70%,black)] text-white border border-transparent shadow-[0_1px_2px_#16202e1a] hover:brightness-108 active:brightness-95",
  normal:
    "bg-superficie-alta text-tinta border border-linha shadow-[var(--sombra-cartao)] hover:border-linha-forte hover:bg-papel",
  sutil: "text-tinta-2 border border-transparent hover:bg-realce-medio hover:text-tinta",
  // Contorno: o gatilho na tela ("Esvaziar lixeira"). Sinaliza que a ação é
  // destrutiva sem gritar antes da hora — o vermelho cheio fica reservado
  // para dentro do diálogo de confirmação, ver `perigo-solido`.
  perigo:
    "text-perigo border border-[color-mix(in_srgb,var(--perigo)_30%,transparent)] hover:bg-[color-mix(in_srgb,var(--perigo)_10%,transparent)]",
  // Preenchido: só o botão de confirmar dentro de um `DialogoConfirmar`. É a
  // única vez que o vermelho aparece sólido — a escalada de gravidade do
  // "isso é definitivo mesmo" bate exatamente no clique final, não antes.
  "perigo-solido":
    "bg-perigo text-white border border-transparent shadow-[0_1px_2px_#16202e1a] hover:brightness-108 active:brightness-95",
};

export function Botao({
  variante = "normal",
  className,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variante?: VarianteBotao }) {
  return (
    <button
      type="button"
      {...resto}
      className={clsx(
        "inline-flex h-8.5 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[12.5px] font-semibold transition-all disabled:pointer-events-none disabled:opacity-45",
        estilosBotao[variante],
        className,
      )}
    />
  );
}

/** Botão só de ícone — sempre com rótulo acessível. */
export function BotaoIcone({
  rotulo,
  className,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { rotulo: string }) {
  return (
    <button
      type="button"
      title={rotulo}
      aria-label={rotulo}
      {...resto}
      className={clsx(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    />
  );
}

export function Campo({
  className,
  ...resto
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...resto}
      className={clsx(
        "h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none",
        className,
      )}
    />
  );
}

export function Rotulo({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-[11px] font-medium tracking-wide text-tinta-2 uppercase">
      {children}
    </span>
  );
}

/** Janela modal. Fecha no Esc e no clique fora. */
export function Dialogo({
  titulo,
  descricao,
  aberto,
  aoFechar,
  children,
  largura = "max-w-md",
  tituloPersonalizado,
}: {
  titulo: string;
  descricao?: string;
  aberto: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
  largura?: string;
  /** Substitui o `<h2>` padrão por outro conteúdo (ex.: um título editável) — `titulo` continua servindo de aria-label. */
  tituloPersonalizado?: React.ReactNode;
}) {
  const caixa = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") {
        evento.stopPropagation();
        aoFechar();
      }
    };
    document.addEventListener("keydown", aoTeclar);
    // Foca o primeiro campo para dar para digitar de cara.
    const primeiro = caixa.current?.querySelector<HTMLElement>("input, textarea, button");
    primeiro?.focus();
    return () => document.removeEventListener("keydown", aoTeclar);
  }, [aberto, aoFechar]);

  if (!aberto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#1c232b40] p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={clsx(
          "surgir w-full rounded-2xl border border-linha bg-superficie-alta p-5 shadow-[var(--sombra)]",
          largura,
        )}
      >
        <div className="mb-3 flex items-start gap-3">
          <div className="min-w-0 flex-1">
            {tituloPersonalizado ?? (
              <h2 className="text-[16px] leading-tight font-bold tracking-[-0.02em]">{titulo}</h2>
            )}
            {descricao ? <p className="mt-1 text-[12.5px] text-tinta-2">{descricao}</p> : null}
          </div>
          <BotaoIcone rotulo="Fechar" onClick={aoFechar}>
            <X size={15} />
          </BotaoIcone>
        </div>
        {children}
      </div>
    </div>
  );
}

type PosicaoMenu = { top?: number; bottom?: number; left?: number; right?: number };

/**
 * Menu suspenso ancorado num gatilho.
 *
 * Renderiza num portal em `document.body`, fora de qualquer lista com rolagem
 * — sem isso, um `position: absolute` dentro de um painel com
 * `overflow-y-auto` (como a árvore de cadernos ou a lista de páginas) fica
 * cortado ou escondido atrás do que vem depois na lista, porque o
 * `overflow` do ancestral recorta qualquer coisa fora da área visível,
 * independente do z-index. A posição é calculada a partir do próprio botão
 * que abre o menu, e ele vira para cima sozinho quando não cabe embaixo.
 */
export function Menu({
  gatilho,
  children,
  alinhamento = "direita",
}: {
  gatilho: (aoAbrir: () => void, aberto: boolean) => React.ReactNode;
  children: (fechar: () => void) => React.ReactNode;
  alinhamento?: "direita" | "esquerda";
}) {
  const [aberto, definirAberto] = useState(false);
  const [posicao, definirPosicao] = useState<PosicaoMenu | null>(null);
  const gatilhoRef = useRef<HTMLDivElement>(null);
  const painelRef = useRef<HTMLDivElement>(null);

  function calcularPosicao() {
    const elemento = gatilhoRef.current;
    if (!elemento) return;
    const retangulo = elemento.getBoundingClientRect();
    const espacoAbaixo = window.innerHeight - retangulo.bottom;
    const viraParaCima = espacoAbaixo < 240 && retangulo.top > espacoAbaixo;

    const vertical = viraParaCima
      ? { bottom: window.innerHeight - retangulo.top + 6 }
      : { top: retangulo.bottom + 6 };
    const horizontal =
      alinhamento === "direita"
        ? { right: window.innerWidth - retangulo.right }
        : { left: retangulo.left };

    definirPosicao({ ...vertical, ...horizontal });
  }

  function abrir() {
    calcularPosicao();
    definirAberto(true);
  }

  useEffect(() => {
    if (!aberto) return;
    const aoClicar = (evento: MouseEvent) => {
      const alvo = evento.target as Node;
      if (gatilhoRef.current?.contains(alvo)) return;
      if (painelRef.current?.contains(alvo)) return;
      definirAberto(false);
    };
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") definirAberto(false);
    };
    // Fecha ao rolar (o gatilho pode estar dentro de uma lista rolável) em vez
    // de tentar acompanhar a posição — mais simples e já é o padrão comum.
    const aoRolar = () => definirAberto(false);

    document.addEventListener("mousedown", aoClicar);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener("scroll", aoRolar, true);
    window.addEventListener("resize", aoRolar);
    return () => {
      document.removeEventListener("mousedown", aoClicar);
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener("scroll", aoRolar, true);
      window.removeEventListener("resize", aoRolar);
    };
  }, [aberto]);

  return (
    <div ref={gatilhoRef} className="relative inline-flex">
      {gatilho(() => (aberto ? definirAberto(false) : abrir()), aberto)}
      {aberto && posicao
        ? createPortal(
            <div
              ref={painelRef}
              style={{ position: "fixed", ...posicao }}
              className="surgir z-50 min-w-[190px] rounded-xl border border-linha bg-superficie-alta p-1.5 shadow-[var(--sombra)]"
            >
              {children(() => definirAberto(false))}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export function ItemMenu({
  icone,
  children,
  perigo,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icone?: React.ReactNode;
  perigo?: boolean;
}) {
  return (
    <button
      type="button"
      {...resto}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-[12.5px] font-medium transition-colors hover:bg-realce-fraco disabled:pointer-events-none disabled:opacity-40",
        perigo ? "text-perigo" : "text-tinta",
      )}
    >
      {icone ? <span className="text-tinta-3">{icone}</span> : null}
      <span className="flex-1 truncate">{children}</span>
    </button>
  );
}

export function SeparadorMenu() {
  return <div className="my-1 h-px bg-linha" />;
}

/**
 * Alça para redimensionar um painel arrastando a borda — como uma coluna do
 * Excel. Fica encostada na borda direita de um container `relative`; a faixa
 * clicável é mais larga que a linha visível (6px vs. 2px) para não exigir
 * mirar num traço de 1px. Duplo clique volta pro padrão.
 */
export function AlcaRedimensionar({
  aoArrastar,
  aoRestaurar,
  rotulo,
}: {
  aoArrastar: (evento: React.MouseEvent) => void;
  aoRestaurar: () => void;
  rotulo: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={rotulo}
      title={rotulo}
      onMouseDown={aoArrastar}
      onDoubleClick={aoRestaurar}
      className="group absolute inset-y-0 right-0 z-10 w-1.5 translate-x-1/2 cursor-col-resize"
    >
      <div className="mx-auto h-full w-0.5 bg-transparent transition-colors group-hover:bg-[var(--realce)] group-active:bg-[var(--realce)]" />
    </div>
  );
}

/**
 * Rótulo curto acima de um grupo de itens dentro de um `Menu` — só para
 * grupos que, sem isso, poderiam parecer continuação do grupo anterior (ex.:
 * ações cosméticas logo depois de ações estruturais). Não é para todo grupo;
 * a separação por `SeparadorMenu` já basta quando o corte é óbvio.
 */
export function RotuloMenu({ children }: { children: React.ReactNode }) {
  return (
    <span className="block px-2 pt-1 pb-0.5 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
      {children}
    </span>
  );
}

/**
 * Alterna entre tema claro e escuro — comum às duas aplicações (Anotações e
 * Kanban), por isso mora aqui em vez de dentro de uma coluna que só existe
 * numa delas.
 */
export function BotaoTema() {
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
    <BotaoIcone rotulo={tema === "claro" ? "Usar tema escuro" : "Usar tema claro"} onClick={alternar}>
      {tema === "claro" ? <Moon size={14} /> : <Sun size={14} />}
    </BotaoIcone>
  );
}

/** Mensagem de erro curta, no lugar onde a ação falhou. */
export function Aviso({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-2 text-[12px] text-perigo" role="alert">
      {children}
    </p>
  );
}

/** Pastilha de etiqueta: fundo suave na cor da etiqueta, sem borda. */
export function Etiquetinha({
  nome,
  cor,
  aoRemover,
}: {
  nome: string;
  cor: string;
  aoRemover?: () => void;
}) {
  return (
    <span
      className="pastilha"
      style={{
        color: `color-mix(in srgb, ${cor} 82%, var(--tinta))`,
        background: `color-mix(in srgb, ${cor} 14%, transparent)`,
      }}
    >
      {nome}
      {aoRemover ? (
        <button
          type="button"
          onClick={aoRemover}
          aria-label={`Tirar a etiqueta ${nome}`}
          className="-mr-1 opacity-55 transition-opacity hover:opacity-100"
        >
          <X size={11} />
        </button>
      ) : null}
    </span>
  );
}

/** Estado vazio: um convite, não um pedido de desculpas. */
export function Vazio({
  icone,
  titulo,
  descricao,
  children,
}: {
  icone?: React.ReactNode;
  titulo: string;
  descricao: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-sm py-14 text-center">
      {icone ? (
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--realce-medio)", color: "var(--realce)" }}
          aria-hidden
        >
          {icone}
        </div>
      ) : null}
      <h2 className="text-[17px] font-bold tracking-[-0.02em]">{titulo}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-tinta-2">{descricao}</p>
      {children ? <div className="mt-4 flex justify-center gap-2">{children}</div> : null}
    </div>
  );
}
