"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

/**
 * Título que vira campo de texto com um duplo clique — usado no cabeçalho da
 * página aberta e no editor de tarefa do Kanban. Um clique simples não faz
 * nada: em cima de um cartão pequeno ele já significa "abrir", e disputar
 * esse clique com a renomeação só atrapalharia.
 */
export function TituloEditavel({
  titulo,
  aoRenomear,
  className,
}: {
  titulo: string;
  /** Devolve a mensagem de erro, ou `null` quando deu certo. */
  aoRenomear: (novoTitulo: string) => Promise<string | null>;
  className?: string;
}) {
  const [editando, definirEditando] = useState(false);
  const [valor, definirValor] = useState(titulo);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editando) return;
    definirValor(titulo);
    definirErro(null);
    campo.current?.focus();
    campo.current?.select();
  }, [editando, titulo]);

  async function confirmar() {
    const limpo = valor.trim();
    if (!limpo || limpo === titulo) {
      definirEditando(false);
      return;
    }
    definirSalvando(true);
    const falha = await aoRenomear(limpo);
    definirSalvando(false);
    if (falha) {
      definirErro(falha);
      return;
    }
    definirEditando(false);
  }

  if (editando) {
    return (
      <div onClick={(evento) => evento.stopPropagation()}>
        <input
          ref={campo}
          value={valor}
          disabled={salvando}
          onChange={(evento) => definirValor(evento.target.value)}
          onKeyDown={(evento) => {
            evento.stopPropagation();
            if (evento.key === "Enter") confirmar();
            if (evento.key === "Escape") definirEditando(false);
          }}
          onBlur={confirmar}
          className={clsx(
            className,
            "w-full border-b border-[var(--realce)] bg-transparent focus:outline-none disabled:opacity-60",
          )}
        />
        {erro ? <p className="mt-1 text-[11.5px] text-perigo">{erro}</p> : null}
      </div>
    );
  }

  return (
    <span
      onClick={(evento) => evento.stopPropagation()}
      onDoubleClick={(evento) => {
        evento.stopPropagation();
        definirEditando(true);
      }}
      title="Clique duas vezes para renomear"
      className={className}
    >
      {titulo}
    </span>
  );
}
