"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Largura do modo leitura: por padrão o texto renderizado usa a tela toda
 * (mesma largura da edição lado a lado); "Estreitar para leitura" liga a
 * coluna de ~72 caracteres (`.coluna-leitura`, ver globals.css) para quem
 * prefere linha mais curta em prosa longa.
 *
 * Preferência da pessoa, não da nota — mesmo padrão do zoom de texto
 * (`zoom.ts`): fica num `data-` no `documentElement`, persistida em
 * localStorage, vale para o app inteiro.
 */
const CHAVE = "largura-leitura-estreita";

export function useLarguraLeitura() {
  const [estreita, definirEstreitaEstado] = useState(false);

  useEffect(() => {
    try {
      const salva = localStorage.getItem(CHAVE) === "1";
      definirEstreitaEstado(salva);
      if (salva) document.documentElement.dataset.larguraLeitura = "estreita";
    } catch {
      // Sem armazenamento: fica na tela toda pela sessão inteira.
    }
  }, []);

  const alternar = useCallback(() => {
    definirEstreitaEstado((atual) => {
      const proximo = !atual;
      if (proximo) document.documentElement.dataset.larguraLeitura = "estreita";
      else delete document.documentElement.dataset.larguraLeitura;
      try {
        localStorage.setItem(CHAVE, proximo ? "1" : "0");
      } catch {
        // Sem armazenamento: o ajuste vale só para esta sessão.
      }
      return proximo;
    });
  }, []);

  return { estreita, alternar };
}
