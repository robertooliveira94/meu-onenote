"use client";

import { Bookmark, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/** Um botão de favorito arrastável + o código equivalente, pra quem não pode arrastar. */
function BlocoBookmarklet({ rotulo, icone, codigo }: { rotulo: string; icone: React.ReactNode; codigo: string }) {
  const [copiado, definirCopiado] = useState(false);
  const link = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (link.current) link.current.setAttribute("href", codigo);
  }, [codigo]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 1500);
    } catch {
      // Sem permissão: o textarea abaixo ainda dá pra selecionar e copiar.
    }
  }

  return (
    <div className="rounded-xl border border-linha bg-superficie-alta p-5 text-center">
      <a
        ref={link}
        href="#"
        onClick={(evento) => evento.preventDefault()}
        draggable
        className="transicao-realce inline-flex cursor-grab items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-[0_1px_2px_#16202e1f] active:cursor-grabbing"
        style={{ background: "color-mix(in srgb, var(--realce) 70%, black)" }}
      >
        {icone}
        {rotulo}
      </a>
      <p className="mt-3 text-[12px] text-tinta-3">
        Arraste este botão para a barra de favoritos. Clicar nele aqui não faz nada — ele precisa
        estar salvo como favorito para funcionar nas outras páginas.
      </p>
      <div className="mt-3 border-t border-linha pt-3 text-left">
        <button
          type="button"
          onClick={copiar}
          className="mb-1.5 rounded-md border border-linha px-2.5 py-1 text-[11.5px] font-medium text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
        >
          {copiado ? "Copiado!" : "Copiar código (se não der pra arrastar)"}
        </button>
        <textarea
          readOnly
          value={codigo}
          onFocus={(evento) => evento.currentTarget.select()}
          rows={3}
          className="w-full resize-none rounded-lg border border-linha bg-superficie px-3 py-2 font-mono text-[11px] text-tinta-2"
        />
      </div>
    </div>
  );
}

/**
 * Atalhos de navegador da app de Links — independentes do Web Clipper das
 * Anotações (que cria uma nota numa seção). Dois botões: um pra salvar a
 * página aberta como link, outro pra abrir os favoritos/recentes numa
 * janelinha sem entrar no app inteiro. Tela própria (não dividindo espaço
 * com o clipper de notas) porque são atalhos de outra aplicação.
 */
export function AtalhoDeLinks() {
  const [origem, definirOrigem] = useState("");

  useEffect(() => {
    definirOrigem(window.location.origin);
  }, []);

  const salvarLink = origem
    ? `javascript:void(window.open('${origem}/salvar-link?url='+encodeURIComponent(location.href)+'&titulo='+encodeURIComponent(document.title),'_blank','width=420,height=520'))`
    : "";
  const abrirLinks = origem
    ? `javascript:void(window.open('${origem}/links-popup','_blank','width=340,height=560'))`
    : "";

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
          Atalhos de Links
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-tinta-2">
          Dois botões para a barra de favoritos do navegador: um guarda a página aberta, o outro
          abre seus links salvos — os dois numa janelinha por cima, sem trocar de aba.
        </p>

        {origem ? (
          <div className="mt-7 space-y-4">
            <div>
              <h2 className="mb-2 text-[12px] font-semibold text-tinta">Salvar a página aberta</h2>
              <BlocoBookmarklet rotulo="Salvar como link" icone={<Bookmark size={14} />} codigo={salvarLink} />
            </div>
            <div>
              <h2 className="mb-2 text-[12px] font-semibold text-tinta">Abrir meus links</h2>
              <BlocoBookmarklet rotulo="Abrir meus links" icone={<FolderOpen size={14} />} codigo={abrirLinks} />
            </div>
          </div>
        ) : (
          <p className="mt-7 text-center text-[12.5px] text-tinta-3">Carregando…</p>
        )}

        <div className="mt-6 space-y-2 text-[12.5px] text-tinta-2">
          <p className="font-semibold text-tinta">Se o navegador não deixar arrastar:</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Crie um favorito qualquer (pode apontar para esta página).</li>
            <li>Edite o favorito e troque o endereço pelo código copiado.</li>
            <li>Dê o nome que quiser — “Salvar link” ou “Meus links”, por exemplo.</li>
          </ol>
        </div>

        <div className="mt-8 rounded-xl border border-linha bg-superficie-alta p-5">
          <h2 className="text-[13px] font-bold tracking-[-0.02em]">Como funciona, passo a passo</h2>
          <ol className="mt-2.5 list-decimal space-y-2 pl-5 text-[12.5px] leading-relaxed text-tinta-2">
            <li>Arraste os botões acima para a barra de favoritos do navegador, uma vez só.</li>
            <li>
              Em qualquer site, clique em <strong>Salvar como link</strong>. Abre uma
              <strong> janelinha pequena por cima</strong> da página — a aba que você estava vendo
              continua exatamente como estava, nada fecha nem recarrega. O título já vem
              preenchido sozinho (dá pra editar); escolha a pasta e clique em Salvar. A janelinha{" "}
              <strong>fecha sozinha</strong>.
            </li>
            <li>
              A qualquer momento, clique em <strong>Abrir meus links</strong> pra ver uma lista
              compacta dos favoritos e mais recentes. Clicar num deles abre o site numa aba nova e
              fecha a janelinha sozinha.
            </li>
          </ol>
          <p className="mt-3 border-t border-linha pt-3 text-[12px] text-tinta-3">
            Diferente do <strong>Web Clipper</strong> das Anotações (aquele cria uma nota nova
            dentro de um caderno) — estes atalhos são só para a app de Links: nunca viram nota.
            Alguns sites com política de segurança estrita bloqueiam bookmarklets — se num site o
            botão não fizer nada, é limitação do navegador naquele site.
          </p>
        </div>
      </div>
    </div>
  );
}
