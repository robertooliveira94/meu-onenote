"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { BotaoIcone } from "./ui";

type Selecao = { texto: string; inicio: number; fim: number };

function escaparParaRegex(texto: string): string {
  return texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Onde cada ocorrência começa e termina, sem diferenciar maiúsculas. */
function acharOcorrencias(texto: string, termo: string): { inicio: number; fim: number }[] {
  if (!termo) return [];
  const padrao = new RegExp(escaparParaRegex(termo), "gi");
  const achadas: { inicio: number; fim: number }[] = [];
  for (const casamento of texto.matchAll(padrao)) {
    achadas.push({ inicio: casamento.index, fim: casamento.index + casamento[0].length });
  }
  return achadas;
}

/**
 * Buscar e substituir dentro da nota (Ctrl+F / Ctrl+H em edição). O
 * navegador acha, mas não substitui — e o achar dele nem enxerga o que está
 * fora da tela num campo de texto.
 *
 * Opera sobre o texto do `<textarea>` por seleção: cada ocorrência é
 * selecionada no campo, então "Substituir" troca o que está selecionado e o
 * Ctrl+Z nativo continua desfazendo. A caixa fica com o foco enquanto se
 * digita; Esc devolve o foco ao campo com a ocorrência atual selecionada.
 */
export function LocalizarNota({
  campo,
  conteudo,
  comSubstituir,
  aoAplicar,
  aoFechar,
}: {
  campo: RefObject<HTMLTextAreaElement | null>;
  /** O texto de agora — recontar a cada mudança é barato e mantém o "3 de 12" honesto. */
  conteudo: string;
  /** Abre já com o foco no campo de substituir (Ctrl+H). */
  comSubstituir: boolean;
  aoAplicar: (resultado: Selecao) => void;
  aoFechar: () => void;
}) {
  const [termo, definirTermo] = useState("");
  const [substituto, definirSubstituto] = useState("");
  const [atual, definirAtual] = useState(0);
  const caixaBuscar = useRef<HTMLInputElement>(null);
  const caixaSubstituir = useRef<HTMLInputElement>(null);

  const ocorrencias = useMemo(() => acharOcorrencias(conteudo, termo), [conteudo, termo]);

  useEffect(() => {
    (comSubstituir ? caixaSubstituir : caixaBuscar).current?.focus();
  }, [comSubstituir]);

  /** Seleciona a ocorrência no campo (que rola até ela) e devolve o foco à caixa. */
  const irPara = useCallback(
    (indice: number) => {
      const elemento = campo.current;
      const alvo = ocorrencias[indice];
      if (!elemento || !alvo) return;
      const quemTinhaOFoco = document.activeElement as HTMLElement | null;
      // Só um campo com foco rola até a própria seleção.
      elemento.focus();
      elemento.setSelectionRange(alvo.inicio, alvo.fim);
      quemTinhaOFoco?.focus();
      definirAtual(indice);
    },
    [campo, ocorrencias],
  );

  // Termo novo: começa pela primeira ocorrência a partir do cursor.
  useEffect(() => {
    if (ocorrencias.length === 0) {
      definirAtual(0);
      return;
    }
    const cursor = campo.current?.selectionStart ?? 0;
    const primeira = ocorrencias.findIndex((item) => item.inicio >= cursor);
    irPara(primeira === -1 ? 0 : primeira);
    // Só quando o termo (ou o texto) muda — não a cada ida e volta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, conteudo]);

  function proxima(passo: 1 | -1): void {
    if (ocorrencias.length === 0) return;
    irPara((atual + passo + ocorrencias.length) % ocorrencias.length);
  }

  function substituirAtual(): void {
    const alvo = ocorrencias[atual];
    if (!alvo) return;
    const novoTexto = conteudo.slice(0, alvo.inicio) + substituto + conteudo.slice(alvo.fim);
    aoAplicar({ texto: novoTexto, inicio: alvo.inicio, fim: alvo.inicio + substituto.length });
  }

  function substituirTodas(): void {
    if (ocorrencias.length === 0) return;
    const novoTexto = conteudo.replace(new RegExp(escaparParaRegex(termo), "gi"), () => substituto);
    aoAplicar({ texto: novoTexto, inicio: 0, fim: 0 });
  }

  function fechar(): void {
    aoFechar();
    campo.current?.focus();
  }

  function aoTeclar(evento: React.KeyboardEvent): void {
    if (evento.key === "Escape") {
      evento.preventDefault();
      evento.stopPropagation();
      fechar();
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      if (evento.currentTarget === caixaSubstituir.current) substituirAtual();
      else proxima(evento.shiftKey ? -1 : 1);
    }
  }

  const contagem =
    termo === "" ? "" : ocorrencias.length === 0 ? "nenhuma" : `${atual + 1} de ${ocorrencias.length}`;

  return (
    <div
      role="search"
      aria-label="Buscar e substituir na página"
      className="flex flex-wrap items-center gap-1.5 border-b border-linha bg-superficie px-3 py-1.5"
    >
      <input
        ref={caixaBuscar}
        value={termo}
        onChange={(evento) => definirTermo(evento.target.value)}
        onKeyDown={aoTeclar}
        placeholder="Buscar"
        aria-label="Buscar"
        className="h-7 w-[150px] rounded-md border border-linha bg-superficie-alta px-2 text-[12.5px] focus:border-[var(--realce)] focus:outline-none"
      />
      <span className="w-[62px] text-[11px] text-tinta-3 tabular-nums">{contagem}</span>
      <BotaoIcone rotulo="Anterior (Shift+Enter)" onClick={() => proxima(-1)} className="size-6">
        <ChevronUp size={13} />
      </BotaoIcone>
      <BotaoIcone rotulo="Próxima (Enter)" onClick={() => proxima(1)} className="size-6">
        <ChevronDown size={13} />
      </BotaoIcone>

      <span className="mx-1 h-4 w-px bg-linha" aria-hidden />

      <input
        ref={caixaSubstituir}
        value={substituto}
        onChange={(evento) => definirSubstituto(evento.target.value)}
        onKeyDown={aoTeclar}
        placeholder="Substituir por"
        aria-label="Substituir por"
        className="h-7 w-[150px] rounded-md border border-linha bg-superficie-alta px-2 text-[12.5px] focus:border-[var(--realce)] focus:outline-none"
      />
      <button
        type="button"
        onClick={substituirAtual}
        disabled={ocorrencias.length === 0}
        className="h-7 rounded-md px-2 text-[11.5px] text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta disabled:opacity-40"
      >
        Substituir
      </button>
      <button
        type="button"
        onClick={substituirTodas}
        disabled={ocorrencias.length === 0}
        className="h-7 rounded-md px-2 text-[11.5px] text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta disabled:opacity-40"
      >
        Todas
      </button>

      <BotaoIcone rotulo="Fechar (Esc)" onClick={fechar} className="size-6">
        <X size={13} />
      </BotaoIcone>
    </div>
  );
}
