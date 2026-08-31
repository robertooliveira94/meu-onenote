"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Largura de um painel que a pessoa ajusta arrastando a borda — como uma
 * coluna do Excel. Lembra o valor entre sessões (por painel, via `chave`) e
 * clampa dentro de [minima, maxima] o tempo todo, inclusive o valor salvo:
 * se um dia os limites mudarem, uma largura antiga fora da faixa nova não
 * quebra o layout.
 */
export function useLarguraRedimensionavel(
  chave: string,
  { padrao, minima, maxima }: { padrao: number; minima: number; maxima: number },
) {
  const clampar = useCallback((valor: number) => Math.min(maxima, Math.max(minima, valor)), [minima, maxima]);

  const [largura, definirLargura] = useState(padrao);
  const arrastando = useRef(false);

  // Só lê localStorage depois de montar — evita a largura salva divergir do
  // HTML gerado no servidor (que não tem acesso a ela) no primeiro render.
  useEffect(() => {
    try {
      const salva = localStorage.getItem(chave);
      if (salva) definirLargura(clampar(Number(salva)));
    } catch {
      // Sem armazenamento: fica no padrão pela sessão inteira.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);

  const iniciarArraste = useCallback(
    (evento: React.MouseEvent) => {
      evento.preventDefault();
      const xInicial = evento.clientX;
      const larguraInicial = largura;
      arrastando.current = true;

      // Cursor e seleção de texto travados na janela inteira enquanto
      // arrasta — sem isso, passar por cima de texto ou de um iframe no meio
      // do arraste interrompe o gesto ou seleciona a página toda.
      const corpoOriginal = document.body.style.cursor;
      const selecaoOriginal = document.body.style.userSelect;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";

      function aoMover(e: MouseEvent) {
        definirLargura(clampar(larguraInicial + (e.clientX - xInicial)));
      }

      function aoSoltar() {
        arrastando.current = false;
        document.body.style.cursor = corpoOriginal;
        document.body.style.userSelect = selecaoOriginal;
        window.removeEventListener("mousemove", aoMover);
        window.removeEventListener("mouseup", aoSoltar);
        // Salva só ao soltar, não a cada pixel arrastado.
        definirLargura((atual) => {
          try {
            localStorage.setItem(chave, String(atual));
          } catch {
            // Sem armazenamento: o ajuste vale só para esta sessão.
          }
          return atual;
        });
      }

      window.addEventListener("mousemove", aoMover);
      window.addEventListener("mouseup", aoSoltar);
    },
    [largura, clampar, chave],
  );

  /** Duplo clique na alça volta pro padrão — mesmo gesto do Excel. */
  const restaurarPadrao = useCallback(() => {
    definirLargura(padrao);
    try {
      localStorage.setItem(chave, String(padrao));
    } catch {
      // Sem armazenamento: nada a persistir.
    }
  }, [chave, padrao]);

  return { largura, iniciarArraste, restaurarPadrao };
}
