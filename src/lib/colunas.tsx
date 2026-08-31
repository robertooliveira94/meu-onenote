"use client";

import { createContext, useContext, useEffect, useState } from "react";

/**
 * Recolher a barra lateral e a lista de páginas de uma vez, para escrever
 * com mais espaço. Um estado só, porque as duas colunas moram em componentes
 * diferentes (`Casca` e `ListaPaginas`, esta última dentro de `children`) e
 * o botão que alterna fica num terceiro lugar (o topo da barra lateral).
 */
const ColunasContexto = createContext<{
  recolhidas: boolean;
  alternar: () => void;
} | null>(null);

const CHAVE = "colunas-recolhidas";

export function ColunasProvedor({ children }: { children: React.ReactNode }) {
  const [recolhidas, definirRecolhidas] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(CHAVE) === "1") definirRecolhidas(true);
    } catch {
      // Sem armazenamento: começa sempre aberto.
    }
  }, []);

  function alternar() {
    definirRecolhidas((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem(CHAVE, proximo ? "1" : "0");
      } catch {
        // Sem armazenamento: vale só para esta sessão.
      }
      return proximo;
    });
  }

  return (
    <ColunasContexto.Provider value={{ recolhidas, alternar }}>
      {children}
    </ColunasContexto.Provider>
  );
}

/** Fora de um `ColunasProvedor`, se comporta como se nunca estivesse recolhido. */
export function useColunas() {
  const contexto = useContext(ColunasContexto);
  return contexto ?? { recolhidas: false, alternar: () => {} };
}
