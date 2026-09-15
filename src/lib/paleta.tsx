"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

/**
 * Quem abre a paleta de comandos. A paleta é montada uma vez só, na casca
 * do app; botões espalhados pelas telas (o "Buscar" da coluna de seções,
 * o atalho Ctrl+K) só precisam pedir pra abrir — mesmo padrão do contexto
 * das colunas.
 */
const PaletaContexto = createContext<{
  aberta: boolean;
  /** Texto com que a paleta abre — um prefixo como "#" ou "!" já filtra por tipo. */
  termoInicial: string;
  abrir: (termoInicial?: string) => void;
  fechar: () => void;
} | null>(null);

export function PaletaProvedor({ children }: { children: React.ReactNode }) {
  const [aberta, definirAberta] = useState(false);
  const [termoInicial, definirTermoInicial] = useState("");

  const abrir = useCallback((termo = "") => {
    definirTermoInicial(termo);
    definirAberta(true);
  }, []);
  const fechar = useCallback(() => definirAberta(false), []);

  const valor = useMemo(() => ({ aberta, termoInicial, abrir, fechar }), [aberta, termoInicial, abrir, fechar]);
  return <PaletaContexto.Provider value={valor}>{children}</PaletaContexto.Provider>;
}

/** Fora de um `PaletaProvedor`, abrir não faz nada — não quebra telas montadas sozinhas. */
export function usePaleta() {
  const contexto = useContext(PaletaContexto);
  return contexto ?? { aberta: false, termoInicial: "", abrir: () => {}, fechar: () => {} };
}
