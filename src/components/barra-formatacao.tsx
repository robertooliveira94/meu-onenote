"use client";

import clsx from "clsx";
import {
  Bold,
  CaseUpper,
  Code,
  Heading,
  Indent,
  Italic,
  Link2,
  List,
  ListChecks,
  Minus,
  Quote,
  Strikethrough,
  Table,
} from "lucide-react";

import {
  SEPARADOR_TEXTO,
  TABELA_EXEMPLO,
  type Selecao,
  envolver,
  inserirBloco,
  prefixarLinhas,
  sublinharLinha,
  transformarSelecao,
} from "@/lib/formatacao";
import type { Formato } from "@/lib/tipos";

type Ferramenta = {
  rotulo: string;
  atalho?: string;
  icone: React.ReactNode;
  aplicar: (selecao: Selecao) => Selecao;
  separarAntes?: boolean;
};

const FERRAMENTAS_MARKDOWN: Ferramenta[] = [
  { rotulo: "Negrito", atalho: "Ctrl+B", icone: <Bold size={14} />, aplicar: (s) => envolver(s, "**") },
  { rotulo: "Itálico", atalho: "Ctrl+I", icone: <Italic size={14} />, aplicar: (s) => envolver(s, "*") },
  { rotulo: "Riscado", icone: <Strikethrough size={14} />, aplicar: (s) => envolver(s, "~~") },
  {
    rotulo: "Título",
    icone: <Heading size={14} />,
    aplicar: (s) => prefixarLinhas(s, "## "),
    separarAntes: true,
  },
  { rotulo: "Lista", icone: <List size={14} />, aplicar: (s) => prefixarLinhas(s, "- ") },
  {
    rotulo: "Lista de tarefas",
    icone: <ListChecks size={14} />,
    aplicar: (s) => prefixarLinhas(s, "- [ ] "),
  },
  { rotulo: "Citação", icone: <Quote size={14} />, aplicar: (s) => prefixarLinhas(s, "> ") },
  {
    rotulo: "Código",
    icone: <Code size={14} />,
    aplicar: (s) => envolver(s, "`"),
    separarAntes: true,
  },
  { rotulo: "Link", icone: <Link2 size={14} />, aplicar: (s) => envolver(s, "[", "](endereço)") },
  {
    rotulo: "Tabela",
    icone: <Table size={14} />,
    aplicar: (s) => inserirBloco(s, TABELA_EXEMPLO),
  },
];

/*
  Texto puro não guarda negrito nem cor — o arquivo só tem letras. O que cabe
  aqui é o que sempre se fez no Bloco de Notas: caixa alta, título sublinhado,
  lista, recuo e uma régua para separar assuntos.
*/
const FERRAMENTAS_TEXTO: Ferramenta[] = [
  {
    rotulo: "CAIXA ALTA",
    icone: <CaseUpper size={15} />,
    aplicar: (s) => transformarSelecao(s, (trecho) => trecho.toUpperCase()),
  },
  {
    rotulo: "Título sublinhado",
    icone: <Heading size={14} />,
    aplicar: (s) => sublinharLinha(s, "="),
  },
  {
    rotulo: "Lista",
    icone: <List size={14} />,
    aplicar: (s) => prefixarLinhas(s, "- "),
    separarAntes: true,
  },
  { rotulo: "Recuo", icone: <Indent size={14} />, aplicar: (s) => prefixarLinhas(s, "    ") },
  {
    rotulo: "Separador",
    icone: <Minus size={14} />,
    aplicar: (s) => inserirBloco(s, SEPARADOR_TEXTO),
  },
];

/**
 * Barra de formatação do editor. Trabalha direto sobre a seleção do campo de
 * texto, então o que sai é sempre o arquivo que está no disco — não existe
 * formatação escondida em lugar nenhum.
 */
export function BarraFormatacao({
  formato,
  campo,
  conteudo,
  aoMudar,
  extra,
}: {
  formato: Formato;
  campo: React.RefObject<HTMLTextAreaElement | null>;
  conteudo: string;
  aoMudar: (texto: string) => void;
  extra?: React.ReactNode;
}) {
  const ferramentas = formato === "md" ? FERRAMENTAS_MARKDOWN : FERRAMENTAS_TEXTO;

  function usar(ferramenta: Ferramenta) {
    const area = campo.current;
    if (!area) return;

    const resultado = ferramenta.aplicar({
      texto: conteudo,
      inicio: area.selectionStart,
      fim: area.selectionEnd,
    });
    aoMudar(resultado.texto);

    // O valor só chega ao campo no próximo quadro; a seleção espera por ele.
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(resultado.inicio, resultado.fim);
    });
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-linha bg-superficie px-3 py-1.5">
      {ferramentas.map((ferramenta) => (
        <span key={ferramenta.rotulo} className="contents">
          {ferramenta.separarAntes ? (
            <span className="mx-1.5 h-4 w-px bg-linha" aria-hidden />
          ) : null}
          <button
            type="button"
            title={ferramenta.atalho ? `${ferramenta.rotulo} (${ferramenta.atalho})` : ferramenta.rotulo}
            aria-label={ferramenta.rotulo}
            onClick={() => usar(ferramenta)}
            className={clsx(
              "flex size-7 items-center justify-center rounded-md text-tinta-2 transition-colors",
              "hover:bg-realce-medio hover:text-tinta",
            )}
          >
            {ferramenta.icone}
          </button>
        </span>
      ))}
      {extra ? <div className="ml-auto pl-2">{extra}</div> : null}
    </div>
  );
}

/** Atalhos de teclado do editor de markdown, compartilhados com a barra. */
export function atalhoDeFormatacao(evento: KeyboardEvent | React.KeyboardEvent): "negrito" | "italico" | null {
  if (!(evento.ctrlKey || evento.metaKey) || evento.altKey) return null;
  const tecla = evento.key.toLowerCase();
  if (tecla === "b") return "negrito";
  if (tecla === "i") return "italico";
  return null;
}
