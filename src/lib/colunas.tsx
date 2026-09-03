"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Recolher a coluna de seções e a de páginas — cada uma por conta própria,
 * não mais as duas juntas. Um contexto só porque cada botão de recolher
 * mora dentro da própria coluna, mas o estado precisa sobreviver a essa
 * coluna trocando de conteúdo (de caderno pra caderno, de seção pra seção)
 * sem se perder.
 */
export type Coluna = "secoes" | "paginas";

const ColunasContexto = createContext<{
  recolhida: (coluna: Coluna) => boolean;
  alternar: (coluna: Coluna) => void;
} | null>(null);

const CHAVES: Record<Coluna, string> = {
  secoes: "coluna-secoes-recolhida",
  paginas: "coluna-paginas-recolhida",
};

export function ColunasProvedor({ children }: { children: React.ReactNode }) {
  const [estado, definirEstado] = useState<Record<Coluna, boolean>>({
    secoes: false,
    paginas: false,
  });

  useEffect(() => {
    try {
      definirEstado({
        secoes: localStorage.getItem(CHAVES.secoes) === "1",
        paginas: localStorage.getItem(CHAVES.paginas) === "1",
      });
    } catch {
      // Sem armazenamento: as duas começam sempre abertas.
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
