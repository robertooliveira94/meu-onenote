"use client";

import { PocketKnife } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { acaoDefinirDestinoRecorte } from "@/app/acoes";
import type { Caderno } from "@/lib/tipos";

/**
 * Recortar uma página da web direto para uma seção do bloco — arrastando um
 * bookmarklet para a barra de favoritos, sem instalar extensão nenhuma (um
 * app local não tem loja de extensões para publicar em).
 *
 * O endereço do app entra no bookmarklet na hora — `window.location.origin`
 * pega o que estiver de fato no ar (porta do dev, do serviço do Windows, do
 * container Docker), então o botão funciona onde quer que a pessoa tenha
 * aberto esta página. O destino NÃO entra no bookmarklet: ele é lido do
 * `config.json` a cada recorte, então trocar a seção aqui vale na hora, sem
 * precisar salvar o favorito de novo.
 */
export function Clipper({
  cadernos,
  destinoInicial,
}: {
  cadernos: Caderno[];
  destinoInicial: string;
}) {
  const [origem, definirOrigem] = useState("");
  const [destino, definirDestino] = useState(destinoInicial);
  const [copiado, definirCopiado] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    definirOrigem(window.location.origin);
  }, []);

  // Uma expressão só, `void(...)` para o navegador não trocar a página pelo
  // retorno, e sem string de recursos no `window.open` (abre uma aba comum,
  // menos sujeita a bloqueio de pop-up).
  const bookmarklet = origem
    ? `javascript:void(window.open('${origem}/clipar?url='+encodeURIComponent(location.href)+'&titulo='+encodeURIComponent(document.title)+'&selecao='+encodeURIComponent(String(window.getSelection()||''))))`
    : "";

  // O React 19 recusa `javascript:` num `href` passado como prop JSX (proteção
  // contra XSS) — mas é exatamente isso que um bookmarklet precisa ser. Só dá
  // para escapar dessa sanitização escrevendo o atributo direto no elemento
  // pelo DOM, fora do ciclo normal de props do React.
  useEffect(() => {
    if (link.current && bookmarklet) link.current.setAttribute("href", bookmarklet);
  }, [bookmarklet]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(bookmarklet);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 1500);
    } catch {
      // Sem permissão: o textarea abaixo ainda dá para selecionar e copiar.
    }
  }

  async function trocarDestino(caminho: string) {
    definirDestino(caminho);
    await acaoDefinirDestinoRecorte(caminho);
  }

  const nomeDoDestino = (() => {
    for (const caderno of cadernos) {
      const secao = caderno.secoes.find((s) => s.caminho === destino);
      if (secao) return `${caderno.nome} › ${secao.nome}`;
    }
    return "nenhuma";
  })();

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
          uma nota nova com o título da página, o endereço e o texto selecionado — pronta para
          editar depois.
        </p>

        <div className="mt-7 rounded-xl border border-linha bg-superficie-alta p-5">
          <label className="block text-[11px] font-medium tracking-wide text-tinta-2 uppercase">
            Recortar para
          </label>
          {cadernos.length === 0 ? (
            <p className="mt-1.5 text-[12.5px] text-tinta-3">
              Crie um caderno com uma seção primeiro — é para lá que os recortes vão.
            </p>
          ) : (
            <select
              value={destino}
              onChange={(evento) => trocarDestino(evento.target.value)}
              className="mt-1.5 h-9.5 w-full rounded-lg border border-linha bg-superficie px-3 text-[13px] text-tinta focus:border-[var(--realce)] focus:outline-none"
            >
              {cadernos.map((caderno) => (
                <optgroup key={caderno.caminho} label={caderno.nome}>
                  {caderno.secoes.map((secao) => (
                    <option key={secao.caminho} value={secao.caminho}>
                      {secao.nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          )}
        </div>

        <div className="mt-4 rounded-xl border border-linha bg-superficie-alta p-5 text-center">
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
            <li>Dê o nome que quiser — “Recortar”, por exemplo.</li>
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

          <p className="pt-2 text-[12px] text-tinta-3">
            Cada recorte cai na seção <span className="font-medium text-tinta-2">{nomeDoDestino}</span>.
            Alguns sites (com política de segurança estrita) bloqueiam bookmarklets — se num site o
            botão não fizer nada, é limitação do navegador naquele site, não do recorte.
          </p>
        </div>
      </div>
    </div>
  );
}
