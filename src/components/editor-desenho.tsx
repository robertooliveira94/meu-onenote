"use client";

import dynamic from "next/dynamic";

/**
 * Porta de entrada do editor de desenho. O Excalidraw (e o CSS dele) só é
 * baixado na primeira vez que um desenho abre — e nunca no servidor, porque
 * ele mexe em `window` e em canvas desde o carregamento.
 */
export const EditorDesenho = dynamic(() => import("./tela-desenho"), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-papel text-[13px] text-tinta-3">
      Abrindo o quadro de desenho…
    </div>
  ),
});
