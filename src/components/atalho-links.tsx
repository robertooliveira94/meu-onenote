"use client";

import { Bookmark } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Atalho de navegador da app de Links — independente do Web Clipper das
 * Anotações (que cria uma nota numa seção). Este aqui abre uma janelinha
 * pop-up pra escolher a pasta e salvar um favorito, sem sair da página que
 * você estava vendo. Tela própria (não dividindo espaço com o clipper de
 * notas) porque são dois atalhos pra duas aplicações diferentes.
 */
export function AtalhoDeLinks() {
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
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-xl">
        <div
          className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "var(--realce-medio)", color: "var(--realce)" }}
          aria-hidden
        >
          <Bookmark size={20} />
        </div>
        <h1 className="text-center text-[25px] leading-tight font-extrabold tracking-[-0.03em]">
          Atalho de Links
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-tinta-2">
          Um botão para a barra de favoritos do navegador. Clicar nele em qualquer site abre uma
          janelinha pequena pra escolher a pasta e guardar aquele link — sem trocar de aba,
          sem virar nota.
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
                <Bookmark size={14} />
                Salvar como link
              </a>
              <p className="mt-3 text-[12px] text-tinta-3">
                Arraste este botão para a barra de favoritos. Clicar nele aqui não faz nada — ele
                precisa estar salvo como favorito para funcionar nas outras páginas.
              </p>
            </>
          ) : (
            <p className="text-[12.5px] text-tinta-3">Carregando…</p>
          )}
        </div>

        <div className="mt-6 space-y-2 text-[12.5px] text-tinta-2">
          <p className="font-semibold text-tinta">Se o navegador não deixar arrastar:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Crie um favorito qualquer (pode apontar para esta página).</li>
            <li>Edite o favorito e troque o endereço pelo código abaixo.</li>
            <li>Dê o nome que quiser — “Salvar link”, por exemplo.</li>
          </ol>
          {origem ? (
            <div className="mt-2">
              <button
                type="button"
                onClick={copiar}
                className="mb-1.5 rounded-md border border-linha px-2.5 py-1 text-[11.5px] font-medium text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
              >
                {copiado ? "Copiado!" : "Copiar código"}
              </button>
              <textarea
                readOnly
                value={bookmarklet}
                onFocus={(evento) => evento.currentTarget.select()}
                rows={4}
                className="w-full resize-none rounded-lg border border-linha bg-superficie px-3 py-2 font-mono text-[11px] text-tinta-2"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-8 rounded-xl border border-linha bg-superficie-alta p-5">
          <h2 className="text-[13px] font-bold tracking-[-0.02em]">Como funciona, passo a passo</h2>
          <ol className="mt-2.5 list-decimal space-y-2 pl-5 text-[12.5px] leading-relaxed text-tinta-2">
            <li>Arraste o botão acima para a barra de favoritos do navegador, uma vez só.</li>
            <li>
              Em qualquer site, clique nesse favorito. Abre uma <strong>janelinha pequena por
              cima</strong> da página — a aba que você estava vendo continua exatamente como
              estava, nada fecha nem recarrega.
            </li>
            <li>
              O título da página já vem preenchido sozinho (dá pra editar). Escolha em qual pasta
              de Links o link deve entrar — a última pasta usada já aparece marcada.
            </li>
            <li>
              Clique em <strong>Salvar</strong>. O link entra na pasta escolhida (com o favicon do
              site buscado automaticamente) e a janelinha <strong>fecha sozinha</strong>.
            </li>
          </ol>
          <p className="mt-3 border-t border-linha pt-3 text-[12px] text-tinta-3">
            Diferente do <strong>Web Clipper</strong> das Anotações (aquele cria uma nota nova
            dentro de um caderno) — este atalho é só para a app de Links: salva um favorito numa
            pasta, sem virar nota nenhuma. São dois atalhos separados, cada um na sua aplicação.
            Alguns sites com política de segurança estrita bloqueiam bookmarklets — se num site o
            botão não fizer nada, é limitação do navegador naquele site.
          </p>
        </div>
      </div>
    </div>
  );
}
