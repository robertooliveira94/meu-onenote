"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Segundo atalho de navegador, irmão do Web Clipper: em vez de virar uma
 * nota, abre uma janelinha pop-up pequena pra escolher a pasta e salvar
 * como link — sem sair da página que você estava vendo. Componente à
 * parte (não uma opção dentro de `Clipper`) porque o destino se escolhe
 * OUTRA hora: aqui é sempre uma tela pop-up por clique, nunca uma seção
 * fixa configurada com antecedência.
 */
export function SalvarComoLinkBookmarklet() {
  const [origem, definirOrigem] = useState("");
  const [copiado, definirCopiado] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    definirOrigem(window.location.origin);
  }, []);

  const bookmarklet = origem
    ? `javascript:void(window.open('${origem}/salvar-link?url='+encodeURIComponent(location.href)+'&titulo='+encodeURIComponent(document.title),'_blank','width=420,height=520'))`
    : "";

  useEffect(() => {
    if (link.current && bookmarklet) link.current.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 1500);
    } catch {
      // Sem permissão: o textarea abaixo ainda dá pra selecionar e copiar.
    }
  }

  return (
    <div className="mx-auto mt-6 max-w-xl">
      <div className="rounded-xl border border-linha bg-superficie-alta p-5 text-center">
        <h2 className="text-[14px] font-bold tracking-[-0.02em]">Salvar como link</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-tinta-2">
          Outro botão pra barra de favoritos: abre uma janelinha pequena pra escolher a pasta e
          guardar o link, sem trocar a aba que você estava vendo.
        </p>
        {origem ? (
          <>
            <a
              ref={link}
              href="#"
              onClick={(evento) => evento.preventDefault()}
              draggable
              className="transicao-realce mt-3 inline-flex cursor-grab items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_#16202e1f] active:cursor-grabbing"
              style={{ background: "color-mix(in srgb, var(--realce) 70%, black)" }}
            >
              <Bookmark size={14} />
              Salvar como link
            </a>
            <p className="mt-3 text-[12px] text-tinta-3">
              Arraste este botão para a barra de favoritos — clicar nele aqui não faz nada.
            </p>
            <button
              type="button"
              onClick={copiar}
              className="mt-2 rounded-md border border-linha px-2.5 py-1 text-[11.5px] font-medium text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
            >
              {copiado ? "Copiado!" : "Copiar código"}
            </button>
          </>
        ) : (
          <p className="mt-3 text-[12.5px] text-tinta-3">Carregando…</p>
        )}
      </div>
    </div>
  );
}
