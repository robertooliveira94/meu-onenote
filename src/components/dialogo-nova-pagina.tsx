"use client";

import { useEffect, useState, useTransition } from "react";

import { acaoCriarPagina } from "@/app/acoes";
import type { Modelo } from "@/lib/tipos";

import { Aviso, Botao, Campo, Dialogo, Rotulo } from "./ui";

/**
 * Toda página nasce em markdown — não há mais escolha de formato aqui. Os
 * `.txt` antigos continuam abrindo, mas criar um novo só adicionava uma
 * decisão sem ganho na hora de começar a escrever.
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
  modelos?: Modelo[];
  aoFechar: () => void;
}) {
  const [titulo, definirTitulo] = useState("");
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
        await acaoCriarPagina(pasta, titulo.trim(), modeloId || undefined);
        aoFechar();
      } catch (falha) {
        // O redirecionamento do Next passa por aqui como exceção; só erro real interessa.
        if (falha instanceof Error && falha.message.includes("NEXT_REDIRECT")) throw falha;
        definirErro("Não deu para criar a página");
      }
    });
  }

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

      {modelos && modelos.length > 0 ? (
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
