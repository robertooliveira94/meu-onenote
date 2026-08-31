"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Tamanho do texto de uma página — leitura, prévia e editor, os três juntos,
 * porque todos usam a mesma variável CSS (`--escala-texto`, ver globals.css).
 * É uma preferência da pessoa, não da nota: fica no `documentElement`, do
 * mesmo jeito que o tema claro/escuro, e vale para o app inteiro.
 */
const CHAVE = "escala-texto";
const MINIMA = 0.7;
const MAXIMA = 2;
const PADRAO = 1;

function aplicar(escala: number) {
  document.documentElement.style.setProperty("--escala-texto", String(escala));
}

function clampar(valor: number) {
  return Math.min(MAXIMA, Math.max(MINIMA, Math.round(valor * 100) / 100));
}

export function useZoomTexto() {
  const [escala, definirEscala] = useState(PADRAO);

  useEffect(() => {
    try {
      const salva = Number(localStorage.getItem(CHAVE));
      if (salva) {
        const valor = clampar(salva);
        definirEscala(valor);
        aplicar(valor);
      }
    } catch {
      // Sem armazenamento: fica no padrão pela sessão inteira.
    }
  }, []);

  // Forma funcional (como o setState do React) para não precisar depender do
  // valor atual de `escala` em quem chama — importante para o listener nativo
  // do scroll, que não pode ficar recriando a cada mudança de zoom.
  const mudar = useCallback((atualizar: number | ((atual: number) => number)) => {
    definirEscala((atual) => {
      const bruto = typeof atualizar === "function" ? atualizar(atual) : atualizar;
      const valor = clampar(bruto);
      aplicar(valor);
      try {
        localStorage.setItem(CHAVE, String(valor));
      } catch {
        // Sem armazenamento: o ajuste vale só para esta sessão.
      }
      return valor;
    });
  }, []);

  const aumentar = useCallback(() => mudar((atual) => atual + 0.1), [mudar]);
  const diminuir = useCallback(() => mudar((atual) => atual - 0.1), [mudar]);
  const resetar = useCallback(() => mudar(PADRAO), [mudar]);

  /**
   * Ref para o container de texto (editor, prévia, leitura) — Ctrl (ou ⌘) +
   * roda do mouse aumenta/diminui, como no Excel. É um `ref`, não um
   * `onWheel`: o React pode registrar `wheel` como passivo por padrão, e um
   * listener passivo não deixa chamar `preventDefault()` — sem isso, a
   * página inteira daria zoom do navegador junto com o texto.
   */
  const refRolagem = useCallback(
    (elemento: HTMLElement | null) => {
      if (!elemento) return;
      function aoRolar(evento: WheelEvent) {
        if (!evento.ctrlKey && !evento.metaKey) return;
        evento.preventDefault();
        mudar((atual) => atual + (evento.deltaY < 0 ? 0.05 : -0.05));
      }
      elemento.addEventListener("wheel", aoRolar, { passive: false });
      return () => elemento.removeEventListener("wheel", aoRolar);
    },
    [mudar],
  );

  return { escala, aumentar, diminuir, resetar, refRolagem };
}
