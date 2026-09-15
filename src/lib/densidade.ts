"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Densidade da interface: "confortável" (padrão) ou "compacta" — a compacta
 * aperta o espaçamento interno dos cartões, o vão entre eles e a altura das
 * linhas das árvores, pra caber mais coisa na tela em listas que crescem
 * (40 senhas, 200 links). Não mexe em tamanho de fonte.
 *
 * Mesmo padrão do tema: `data-densidade` no `<html>`, valor no
 * `localStorage`, aplicado pelo script em `layout.tsx` antes da primeira
 * pintura pra não piscar. O CSS que reage está em `globals.css`
 * (`[data-densidade="compacta"]`).
 */
export type Densidade = "confortavel" | "compacta";

export const DENSIDADES: { id: Densidade; nome: string }[] = [
  { id: "confortavel", nome: "Confortável" },
  { id: "compacta", nome: "Compacta" },
];

export function aplicarDensidade(densidade: Densidade): void {
  const raiz = document.documentElement;
  if (densidade === "compacta") raiz.dataset.densidade = "compacta";
  else delete raiz.dataset.densidade;
}

export function useDensidade() {
  const [densidade, definirDensidade] = useState<Densidade>("confortavel");

  useEffect(() => {
    definirDensidade(document.documentElement.dataset.densidade === "compacta" ? "compacta" : "confortavel");
  }, []);

  const mudar = useCallback((nova: Densidade) => {
    definirDensidade(nova);
    aplicarDensidade(nova);
    try {
      localStorage.setItem("densidade", nova);
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }, []);

  return { densidade, mudar };
}
