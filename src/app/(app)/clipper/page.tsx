"use client";

import { PocketKnife } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Recortar uma página da web direto para o caderno "Entrada" — arrastando um
 * bookmarklet para a barra de favoritos, sem instalar extensão nenhuma (um
 * app local não tem loja de extensões para publicar em).
 *
 * O endereço do app entra no bookmarklet na hora — `window.location.origin`
 * pega o que estiver de fato no ar (porta do dev, do serviço do Windows, do
 * container Docker), então o botão funciona onde quer que a pessoa tenha
 * aberto esta página.
 */
export default function TelaDoClipper() {
  const [origem, definirOrigem] = useState("");
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    definirOrigem(window.location.origin);
  }, []);

  const bookmarklet = origem
    ? `javascript:(function(){var s=window.getSelection?window.getSelection().toString():'';var u='${origem}/clipar?titulo='+encodeURIComponent(document.title)+'&url='+encodeURIComponent(location.href)+'&selecao='+encodeURIComponent(s);window.open(u,'_blank','width=480,height=640');})();`
    : "";

  // O React 19 recusa `javascript:` num `href` passado como prop JSX (proteção
  // contra XSS) — mas é exatamente isso que um bookmarklet precisa ser. Só dá
  // para escapar dessa sanitização escrevendo o atributo direto no elemento
  // pelo DOM, fora do ciclo normal de props do React.
  useEffect(() => {
    if (link.current && bookmarklet) link.current.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-xl">
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--realce-medio)", color: "var(--realce)" }}
          aria-hidden
        >
          <PocketKnife size={20} />
        </div>
        <h1 className="text-center text-[25px] leading-tight font-extrabold tracking-[-0.03em]">
          Web Clipper
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-tinta-2">
          Um botão para a barra de favoritos do navegador. Clicar nele em qualquer página cria
          uma nota nova no caderno &quot;Entrada&quot; com o título da página, o endereço e o
          texto que estiver selecionado — pronta para editar depois.
        </p>

        <div className="mt-7 rounded-xl border border-linha bg-superficie-alta p-5 text-center">
          {origem ? (
            <>
              <a
                ref={link}
                href="#"
                onClick={(evento) => evento.preventDefault()}
                draggable
                className="transicao-realce inline-flex cursor-grab items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_#16202e1f] active:cursor-grabbing"
                style={{ background: "color-mix(in srgb, var(--realce) 70%, black)" }}
              >
                <PocketKnife size={14} />
                Recortar para o bloco
              </a>
              <p className="mt-3 text-[12px] text-tinta-3">
                Arraste este botão para a barra de favoritos do navegador — clicar nele aqui não
                faz nada, ele precisa estar salvo como favorito para funcionar nas outras páginas.
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-tinta-3">Carregando…</p>
          )}
        </div>

        <div className="mt-6 space-y-2 text-[12.5px] text-tinta-2">
          <p className="font-semibold text-tinta">Se o navegador não deixar arrastar:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Crie um favorito qualquer, apontando para esta página.</li>
            <li>Edite o favorito e troque o endereço pelo código abaixo.</li>
            <li>Dê o nome que quiser — &quot;Recortar&quot;, por exemplo.</li>
          </ol>
          {origem ? (
            <textarea
              readOnly
              value={bookmarklet}
              onFocus={(evento) => evento.currentTarget.select()}
              rows={4}
              className="mt-2 w-full resize-none rounded-lg border border-linha bg-superficie px-3 py-2 font-mono text-[11px] text-tinta-2"
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
