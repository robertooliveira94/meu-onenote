"use client";

import { LayoutTemplate } from "lucide-react";
import { useState, useTransition } from "react";

import { acaoCriarPagina } from "@/app/acoes";
import type { Modelo } from "@/lib/tipos";

import { Aviso, Botao, Dialogo } from "./ui";

/**
 * Criar página não pergunta mais nada: o "+" cria na hora, com nome tirado da
 * seção e da data. Este diálogo só aparece para quem quer começar de um
 * modelo — a única escolha que o app não tem como adivinhar.
 */
export function DialogoModeloDePagina({
  aberto,
  pasta,
  nomeDaPasta,
  modelos,
  aoFechar,
}: {
  aberto: boolean;
  pasta: string;
  nomeDaPasta: string;
  modelos: Modelo[];
  aoFechar: () => void;
}) {
  const [erro, definirErro] = useState<string | null>(null);
  const [criando, iniciarCriacao] = useTransition();

  function criar(modeloId: string) {
    iniciarCriacao(async () => {
      try {
        // A ação redireciona para a página nova, já em modo de edição.
        await acaoCriarPagina(pasta, modeloId);
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
      titulo="Começar de um modelo"
      descricao={`A página nova entra em ${nomeDaPasta}.`}
      aberto={aberto}
      aoFechar={aoFechar}
    >
      <div className="max-h-[46vh] space-y-1 overflow-y-auto rounded-lg border border-linha bg-superficie-alta p-1">
        {modelos.map((modelo) => (
          <button
            key={modelo.id}
            type="button"
            disabled={criando}
            onClick={() => criar(modelo.id)}
            className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left transition-colors hover:bg-realce-fraco disabled:opacity-50"
          >
            <LayoutTemplate size={14} className="mt-0.5 shrink-0 text-tinta-3" />
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium">{modelo.nome}</span>
              {modelo.descricao ? (
                <span className="mt-0.5 block text-[11.5px] leading-snug text-tinta-2">
                  {modelo.descricao}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <Aviso>{erro}</Aviso>
      <div className="mt-4 flex justify-end">
        <Botao variante="sutil" onClick={aoFechar}>
          Cancelar
        </Botao>
      </div>
    </Dialogo>
  );
}
