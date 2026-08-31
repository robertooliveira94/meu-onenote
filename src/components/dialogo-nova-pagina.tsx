"use client";

import clsx from "clsx";
import { FileText, Hash } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { acaoCriarPagina } from "@/app/acoes";
import type { Formato, Modelo } from "@/lib/tipos";

import { Aviso, Botao, Campo, Dialogo, Rotulo } from "./ui";

/**
 * A escolha do formato acontece aqui, na criação — é o momento em que a pessoa
 * sabe se aquilo vai ser um rascunho solto ou um texto estruturado.
 */
export function DialogoNovaPagina({
  aberto,
  pasta,
  nomeDaPasta,
  modelos,
  aoFechar,
}: {
  aberto: boolean;
  pasta: string;
  nomeDaPasta: string;
  /** Só entra na escolha quando o formato é markdown — texto simples não herda modelo. */
  modelos?: Modelo[];
  aoFechar: () => void;
}) {
  const [titulo, definirTitulo] = useState("");
  const [formato, definirFormato] = useState<Formato>("md");
  const [modeloId, definirModeloId] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [criando, iniciarCriacao] = useTransition();

  useEffect(() => {
    if (aberto) {
      definirTitulo("");
      definirModeloId("");
      definirErro(null);
    }
  }, [aberto]);

  function criar() {
    if (!titulo.trim()) {
      definirErro("Dê um título para a página");
      return;
    }
    iniciarCriacao(async () => {
      try {
        // A ação redireciona para a página nova, já em modo de edição.
        await acaoCriarPagina(pasta, titulo.trim(), formato, formato === "md" ? modeloId : undefined);
        aoFechar();
      } catch (falha) {
        // O redirecionamento do Next passa por aqui como exceção; só erro real interessa.
        if (falha instanceof Error && falha.message.includes("NEXT_REDIRECT")) throw falha;
        definirErro("Não deu para criar a página");
      }
    });
  }

  const opcoes: { valor: Formato; titulo: string; descricao: string; icone: React.ReactNode }[] = [
    {
      valor: "md",
      titulo: "Markdown",
      descricao: "Títulos, listas de tarefas e tabelas. Abre formatado para ler.",
      icone: <Hash size={15} />,
    },
    {
      valor: "txt",
      titulo: "Texto simples",
      descricao: "Só o texto, sem formatação. Igual ao Bloco de Notas.",
      icone: <FileText size={15} />,
    },
  ];

  return (
    <Dialogo
      titulo="Nova página"
      descricao={`Em ${nomeDaPasta}`}
      aberto={aberto}
      aoFechar={aoFechar}
    >
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        criar();
      }}
    >
      <label className="block">
        <Rotulo>Título</Rotulo>
        <Campo
          value={titulo}
          autoFocus
          placeholder="Orçamento anual"
          onChange={(evento) => definirTitulo(evento.target.value)}
        />
      </label>

      <div className="mt-3">
        <Rotulo>Formato do arquivo</Rotulo>
        <div className="grid gap-2 sm:grid-cols-2">
          {opcoes.map((opcao) => (
            <button
              key={opcao.valor}
              type="button"
              onClick={() => definirFormato(opcao.valor)}
              aria-pressed={formato === opcao.valor}
              className={clsx(
                "rounded-lg border p-2.5 text-left transition-colors",
                formato === opcao.valor
                  ? "border-[var(--realce)] bg-realce-fraco"
                  : "border-linha bg-superficie-alta hover:border-linha-forte",
              )}
            >
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium">
                <span style={{ color: "var(--realce)" }}>{opcao.icone}</span>
                {opcao.titulo}
              </span>
              <span className="mt-1 block text-[11.5px] leading-snug text-tinta-2">
                {opcao.descricao}
              </span>
            </button>
          ))}
        </div>
      </div>

      {formato === "md" && modelos && modelos.length > 0 ? (
        <label className="mt-3 block">
          <Rotulo>Começar de um modelo (opcional)</Rotulo>
          <select
            value={modeloId}
            onChange={(evento) => definirModeloId(evento.target.value)}
            className="h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] text-tinta transition-shadow focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
          >
            <option value="">Página em branco</option>
            {modelos.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      <Aviso>{erro}</Aviso>
      <div className="mt-4 flex justify-end gap-2">
        <Botao variante="sutil" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao type="submit" variante="primario" disabled={criando}>
          Criar página
        </Botao>
      </div>
    </form>
    </Dialogo>
  );
}
