"use client";

import clsx from "clsx";
import {
  Bold,
  CaseUpper,
  Code,
  Heading,
  Indent,
  Italic,
  LayoutTemplate,
  Link2,
  List,
  ListChecks,
  Minus,
  Quote,
  Strikethrough,
  Table,
} from "lucide-react";

import { useState } from "react";

import {
  SEPARADOR_TEXTO,
  type Selecao,
  envolver,
  gerarTabela,
  inserirBloco,
  prefixarLinhas,
  sublinharLinha,
  transformarSelecao,
} from "@/lib/formatacao";
import type { Formato, Modelo } from "@/lib/tipos";

import { Botao, Menu } from "./ui";

type Ferramenta = {
  rotulo: string;
  atalho?: string;
  icone: React.ReactNode;
  aplicar: (selecao: Selecao) => Selecao;
  separarAntes?: boolean;
  /** "tabela" abre um popover pedindo linhas/colunas, "modelo" um popover com a lista de modelos — nenhum dos dois aplica direto no clique. */
  id?: "tabela" | "modelo";
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
    aplicar: (s) => inserirBloco(s, gerarTabela(3, 2)),
    id: "tabela",
  },
  {
    rotulo: "Modelo",
    icone: <LayoutTemplate size={14} />,
    aplicar: (s) => s,
    id: "modelo",
    separarAntes: true,
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
  aoAplicar,
  modelos,
  aoInserirModelo,
  extra,
}: {
  formato: Formato;
  campo: React.RefObject<HTMLTextAreaElement | null>;
  conteudo: string;
  /** Escreve no campo de verdade (não só no estado) — mesma `aplicarNoCampo` do editor, pra letra não "sumir" até a próxima tecla. */
  aoAplicar: (resultado: Selecao) => void;
  /** Sem modelo cadastrado, o botão "Modelo" nem aparece. */
  modelos?: Modelo[];
  aoInserirModelo?: (modelo: Modelo) => void;
  extra?: React.ReactNode;
}) {
  const semModelos = !modelos || modelos.length === 0;
  const ferramentas = (formato === "md" ? FERRAMENTAS_MARKDOWN : FERRAMENTAS_TEXTO).filter(
    (ferramenta) => ferramenta.id !== "modelo" || !semModelos,
  );

  function usar(ferramenta: Ferramenta) {
    const area = campo.current;
    if (!area) return;

    const resultado = ferramenta.aplicar({
      texto: conteudo,
      inicio: area.selectionStart,
      fim: area.selectionEnd,
    });
    aoAplicar(resultado);
  }

  function inserirTabela(colunas: number, linhas: number) {
    const area = campo.current;
    if (!area) return;
    const resultado = inserirBloco(
      { texto: conteudo, inicio: area.selectionStart, fim: area.selectionEnd },
      gerarTabela(colunas, linhas),
    );
    aoAplicar(resultado);
  }

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-linha bg-superficie px-3 py-1.5">
      {ferramentas.map((ferramenta) => (
        <span key={ferramenta.rotulo} className="contents">
          {ferramenta.separarAntes ? (
            <span className="mx-1.5 h-4 w-px bg-linha" aria-hidden />
          ) : null}
          {ferramenta.id === "tabela" ? (
            <Menu
              gatilho={(abrir) => (
                <button
                  type="button"
                  title={ferramenta.rotulo}
                  aria-label={ferramenta.rotulo}
                  onClick={abrir}
                  className="flex size-7 items-center justify-center rounded-md text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
                >
                  {ferramenta.icone}
                </button>
              )}
            >
              {(fechar) => (
                <PopoverTabela
                  aoInserir={(colunas, linhas) => {
                    fechar();
                    inserirTabela(colunas, linhas);
                  }}
                />
              )}
            </Menu>
          ) : ferramenta.id === "modelo" ? (
            <Menu
              gatilho={(abrir) => (
                <button
                  type="button"
                  title={ferramenta.rotulo}
                  aria-label={ferramenta.rotulo}
                  onClick={abrir}
                  className="flex size-7 items-center justify-center rounded-md text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
                >
                  {ferramenta.icone}
                </button>
              )}
            >
              {(fechar) => (
                <PopoverModelos
                  modelos={modelos ?? []}
                  aoEscolher={(modelo) => {
                    fechar();
                    aoInserirModelo?.(modelo);
                  }}
                />
              )}
            </Menu>
          ) : (
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
          )}
        </span>
      ))}
      {extra ? <div className="ml-auto pl-2">{extra}</div> : null}
    </div>
  );
}

const LIMITE_COLUNAS_LINHAS = 20;

/** Popover pequeno pra escolher o tamanho da tabela antes de inserir — abre no ícone de tabela da barra. */
function PopoverTabela({ aoInserir }: { aoInserir: (colunas: number, linhas: number) => void }) {
  const [colunas, definirColunas] = useState(3);
  const [linhas, definirLinhas] = useState(2);

  return (
    <form
      className="w-52 p-3"
      onSubmit={(evento) => {
        evento.preventDefault();
        aoInserir(colunas, linhas);
      }}
    >
      <p className="mb-2 text-[11px] font-medium tracking-wide text-tinta-2 uppercase">Tamanho da tabela</p>
      <div className="flex items-center gap-2">
        <label className="flex-1">
          <span className="mb-1 block text-[10.5px] text-tinta-3">Colunas</span>
          <input
            type="number"
            min={1}
            max={LIMITE_COLUNAS_LINHAS}
            value={colunas}
            autoFocus
            onChange={(evento) => definirColunas(Number(evento.target.value))}
            className="h-8 w-full rounded-md border border-linha bg-superficie-alta px-2 text-[13px] text-tinta focus:border-[var(--realce)] focus:outline-none"
          />
        </label>
        <label className="flex-1">
          <span className="mb-1 block text-[10.5px] text-tinta-3">Linhas</span>
          <input
            type="number"
            min={1}
            max={LIMITE_COLUNAS_LINHAS}
            value={linhas}
            onChange={(evento) => definirLinhas(Number(evento.target.value))}
            className="h-8 w-full rounded-md border border-linha bg-superficie-alta px-2 text-[13px] text-tinta focus:border-[var(--realce)] focus:outline-none"
          />
        </label>
      </div>
      <Botao type="submit" variante="primario" className="mt-3 w-full justify-center">
        Inserir tabela
      </Botao>
    </form>
  );
}

/** Popover com a lista de modelos cadastrados — cola o escolhido no cursor, sem sair da página. */
function PopoverModelos({ modelos, aoEscolher }: { modelos: Modelo[]; aoEscolher: (modelo: Modelo) => void }) {
  return (
    <div className="max-h-72 w-64 overflow-y-auto p-1">
      {modelos.map((modelo) => (
        <button
          key={modelo.id}
          type="button"
          onClick={() => aoEscolher(modelo)}
          className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-realce-fraco"
        >
          <LayoutTemplate size={14} className="mt-0.5 shrink-0 text-tinta-3" />
          <span className="min-w-0">
            <span className="block text-[12.5px] font-medium">{modelo.nome}</span>
            {modelo.descricao ? (
              <span className="mt-0.5 block text-[11.5px] leading-snug text-tinta-2">{modelo.descricao}</span>
            ) : null}
          </span>
        </button>
      ))}
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
