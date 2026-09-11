"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Temas do app. Cada um redefine o conjunto de tokens de cor em
 * `globals.css`, atrás de `[data-tema="<id>"]`. O `data-escuro` marca os
 * temas de família escura para os poucos ajustes que valem para todos eles
 * de uma vez (as cores do realce de sintaxe do código).
 *
 * A escolha vale para o app inteiro e fica no `localStorage`, do mesmo jeito
 * que o zoom do texto — o script em `layout.tsx` aplica antes da primeira
 * pintura para não piscar.
 */
export type Tema = "claro" | "escuro" | "escuro-suave" | "sepia" | "cinza" | "vibrante";

export const TEMAS: { id: Tema; nome: string }[] = [
  { id: "claro", nome: "Claro" },
  { id: "escuro", nome: "Escuro" },
  { id: "escuro-suave", nome: "Escuro suave" },
  { id: "sepia", nome: "Sépia" },
  { id: "cinza", nome: "Cinza neutro" },
  { id: "vibrante", nome: "Vibrante" },
];

const ESCUROS: Tema[] = ["escuro", "escuro-suave", "vibrante"];

export function ehTemaEscuro(tema: string): boolean {
  return (ESCUROS as string[]).includes(tema);
}

export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  raiz.dataset.tema = tema;
  if (ehTemaEscuro(tema)) raiz.dataset.escuro = "1";
  else delete raiz.dataset.escuro;
}

function temaValido(valor: string | null | undefined): valor is Tema {
  return valor != null && TEMAS.some((t) => t.id === valor);
}

export function useTema() {
  const [tema, definirTema] = useState<Tema>("claro");

  useEffect(() => {
    const atual = document.documentElement.dataset.tema;
    if (temaValido(atual)) definirTema(atual);
  }, []);

  const mudar = useCallback((novo: Tema) => {
    definirTema(novo);
    aplicarTema(novo);
    try {
      localStorage.setItem("tema", novo);
    } catch {
      // Sem armazenamento: o tema vale só para esta sessão.
    }
  }, []);

  return { tema, mudar };
}
