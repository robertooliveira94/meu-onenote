"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Recolher a coluna de navegação de cada aplicação. Um contexto só porque o
 * botão de recolher mora dentro da própria coluna, mas o estado precisa
 * sobreviver a essa coluna trocando de conteúdo (de caderno pra caderno, de
 * quadro pra quadro) sem se perder.
 *
 * `atalhos` não é uma coluna: é a lista fixa (Início, Etiquetas, Grafo…)
 * no rodapé da coluna de Anotações. Mora aqui porque é o mesmo
 * "recolhido, e lembrado entre sessões" — em tela pequena, fechar essa
 * lista é o que dá altura pra árvore de cadernos.
 */
export type Coluna = "secoes" | "quadros" | "atalhos";

const ColunasContexto = createContext<{
  recolhida: (coluna: Coluna) => boolean;
  alternar: (coluna: Coluna) => void;
} | null>(null);

const CHAVES: Record<Coluna, string> = {
  secoes: "coluna-secoes-recolhida",
  quadros: "coluna-quadros-recolhida",
  atalhos: "atalhos-notas-recolhidos",
};

export function ColunasProvedor({ children }: { children: React.ReactNode }) {
  const [estado, definirEstado] = useState<Record<Coluna, boolean>>({
    secoes: false,
    quadros: false,
    atalhos: false,
  });

  useEffect(() => {
    try {
      definirEstado({
        secoes: localStorage.getItem(CHAVES.secoes) === "1",
        quadros: localStorage.getItem(CHAVES.quadros) === "1",
        atalhos: localStorage.getItem(CHAVES.atalhos) === "1",
      });
    } catch {
      // Sem armazenamento: começam sempre abertas.
    }
  }, []);

  function alternar(coluna: Coluna) {
    definirEstado((atual) => {
      const proximo = { ...atual, [coluna]: !atual[coluna] };
      try {
        localStorage.setItem(CHAVES[coluna], proximo[coluna] ? "1" : "0");
      } catch {
        // Sem armazenamento: vale só para esta sessão.
      }
      return proximo;
    });
  }

  return (
    <ColunasContexto.Provider value={{ recolhida: (coluna) => estado[coluna], alternar }}>
      {children}
    </ColunasContexto.Provider>
  );
}

/** Fora de um `ColunasProvedor`, se comporta como se nunca estivesse recolhido. */
export function useColunas() {
  const contexto = useContext(ColunasContexto);
  return contexto ?? { recolhida: () => false, alternar: () => {} };
}
