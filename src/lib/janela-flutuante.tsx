"use client";

import { createContext, useCallback, useContext, useState } from "react";

/**
 * Estado de "existe uma nota nova sendo editada numa janela flutuante, por
 * cima da tela atual". Só uma de cada vez — abrir outra troca a que estava
 * ali (nada se perde: o autosave já gravou tudo no disco antes de trocar).
 */
type EstadoJanela = { pasta: string } | null;

const Contexto = createContext<{
  janela: EstadoJanela;
  abrir: (pasta: string) => void;
  fechar: () => void;
} | null>(null);

export function ProvedorJanelaFlutuante({ children }: { children: React.ReactNode }) {
  const [janela, definirJanela] = useState<EstadoJanela>(null);
  const abrir = useCallback((pasta: string) => definirJanela({ pasta }), []);
  const fechar = useCallback(() => definirJanela(null), []);

  return <Contexto.Provider value={{ janela, abrir, fechar }}>{children}</Contexto.Provider>;
}

export function useJanelaFlutuante() {
  const contexto = useContext(Contexto);
  if (!contexto) throw new Error("useJanelaFlutuante precisa estar dentro de um ProvedorJanelaFlutuante");
  return contexto;
}
