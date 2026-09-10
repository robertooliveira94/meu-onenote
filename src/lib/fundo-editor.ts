"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cor de fundo da área de escrita do markdown — preferência de quem edita,
 * não da nota. Mesmo esquema do zoom do texto (`src/lib/zoom.ts`): fica no
 * `documentElement` e vale para o app inteiro. Serve para quem gosta de
 * escrever numa folha clara mesmo com o resto do app no tema escuro (ou o
 * contrário).
 *
 * O CSS de cada opção mora em `globals.css`, atrás de `[data-fundo-editor]`.
 */
const CHAVE = "fundo-editor";

export type FundoEditor = "tema" | "claro" | "escuro" | "sepia";

const OPCOES: FundoEditor[] = ["tema", "claro", "escuro", "sepia"];

export const ROTULO_FUNDO: Record<FundoEditor, string> = {
  tema: "Acompanhar o tema",
  claro: "Sempre claro",
  escuro: "Sempre escuro",
  sepia: "Sépia",
};

function ehFundo(valor: string | null): valor is FundoEditor {
  return valor !== null && (OPCOES as string[]).includes(valor);
}

function aplicar(fundo: FundoEditor) {
  const raiz = document.documentElement;
  if (fundo === "tema") delete raiz.dataset.fundoEditor;
  else raiz.dataset.fundoEditor = fundo;
}

export function useFundoEditor() {
  const [fundo, definirFundo] = useState<FundoEditor>("tema");

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE);
      if (ehFundo(salvo)) {
        definirFundo(salvo);
        aplicar(salvo);
      }
    } catch {
      // Sem armazenamento: fica no padrão pela sessão inteira.
    }
  }, []);

  const mudar = useCallback((valor: FundoEditor) => {
    definirFundo(valor);
    aplicar(valor);
    try {
      localStorage.setItem(CHAVE, valor);
    } catch {
      // Sem armazenamento: o ajuste vale só para esta sessão.
    }
  }, []);

  return { fundo, opcoes: OPCOES, mudar };
}
