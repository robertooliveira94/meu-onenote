"use client";

import { Bookmark, ChevronDown, ChevronRight, Folder } from "lucide-react";
import { type MouseEvent, useState } from "react";

import { acaoMarcarComoAberto } from "@/app/acoes-links";
import type { Link as LinkSalvo, PastaLink } from "@/lib/tipos";

function dominioDaUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function IconeDoLink({ link }: { link: LinkSalvo }) {
  if (link.favicon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- favicon local pequeno, não vale a pena configurar o otimizador de imagens do Next pra isso.
      <img src={`/links/favicon/${link.favicon}`} alt="" className="size-4 shrink-0 rounded object-contain" />
    );
  }
  return <Bookmark size={12} className="shrink-0 text-tinta-3" />;
}

function LinhaLink({ link, onAbrir }: { link: LinkSalvo; onAbrir: (evento: MouseEvent<HTMLAnchorElement>, link: LinkSalvo) => void }) {
  return (
    <a
      href={link.url}
      onClick={(evento) => onAbrir(evento, link)}
      title={`${link.titulo} — ${dominioDaUrl(link.url)}`}
      className="flex h-7 min-w-0 items-center gap-2 rounded-sm pr-2 transition-colors hover:bg-realce-fraco focus-visible:bg-realce-fraco focus-visible:outline-none"
    >
      <IconeDoLink link={link} />
      <span className="min-w-0 flex-1 truncate text-[12px] text-tinta">{link.titulo}</span>
    </a>
  );
}

/** Pasta recolhível no mesmo padrão compacto e hierárquico do menu de favoritos do navegador. */
function GrupoPasta({
  pasta,
  profundidade,
  onAbrir,
}: {
  pasta: PastaLink;
  profundidade: number;
  onAbrir: (evento: MouseEvent<HTMLAnchorElement>, link: LinkSalvo) => void;
}) {
  const [recolhida, definirRecolhida] = useState(false);
  const total = contarLinks(pasta);

  return (
    <section className="min-w-0">
      <button
        type="button"
        onClick={() => definirRecolhida((atual) => !atual)}
        aria-expanded={!recolhida}
        className="flex h-8 w-full min-w-0 items-center gap-1.5 rounded-sm pr-2 text-left transition-colors hover:bg-realce-fraco focus-visible:bg-realce-fraco focus-visible:outline-none"
        style={{ paddingLeft: 7 + profundidade * 14 }}
      >
        {recolhida ? <ChevronRight size={13} className="shrink-0 text-tinta-3" /> : <ChevronDown size={13} className="shrink-0 text-tinta-3" />}
        <Folder size={15} className="shrink-0" fill={pasta.cor} color={pasta.cor} strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-tinta">{pasta.nome}</span>
        <span className="shrink-0 text-[10px] text-tinta-3 tabular-nums">{total}</span>
      </button>

      {!recolhida ? (
        <div>
          {pasta.links.map((link) => (
            <div key={link.id} style={{ paddingLeft: 36 + profundidade * 14 }}>
              <LinhaLink link={link} onAbrir={onAbrir} />
            </div>
          ))}
          {pasta.pastas.map((sub) => (
            <GrupoPasta key={sub.id} pasta={sub} profundidade={profundidade + 1} onAbrir={onAbrir} />
          ))}
          {total === 0 ? (
            <p className="h-7 truncate pr-2 text-[11px] leading-7 text-tinta-3" style={{ paddingLeft: 36 + profundidade * 14 }}>
              Pasta vazia
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function contarLinks(pasta: PastaLink): number {
  return pasta.links.length + pasta.pastas.reduce((soma, sub) => soma + contarLinks(sub), 0);
}

/**
 * Lista de Links usada no popup e no painel da extensão. Segue o padrão
 * compacto dos favoritos do navegador: uma única coluna, pastas recolhíveis
 * e linhas pequenas com favicon. O clique comum navega a aba atual; os
 * modificadores do navegador continuam podendo abrir uma nova aba.
 */
export function PopupLinks({ arvore }: { arvore: PastaLink }) {
  const [aberto, definirAberto] = useState<string | null>(null);

  function abrir(evento: MouseEvent<HTMLAnchorElement>, link: LinkSalvo) {
    definirAberto(link.id);
    if (!link.lido) acaoMarcarComoAberto(link.id);

    // Modificadores e clique do meio continuam com o comportamento nativo
    // (nova aba). O clique comum pede à página da extensão para navegar a aba
    // ativa; fora de um iframe, esta própria aba é usada.
    if (evento.ctrlKey || evento.metaKey || evento.shiftKey || evento.altKey) return;
    evento.preventDefault();
    if (window.parent !== window) {
      window.parent.postMessage({ tipo: "meu-bloco-abrir-link", url: link.url }, "*");
    } else {
      window.location.assign(link.url);
    }
  }

  const grupos: PastaLink[] = [
    ...(arvore.links.length ? [{ ...arvore, pastas: [] }] : []),
    ...arvore.pastas,
  ];
  const total = contarLinks(arvore);

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-papel">
      <header className="flex h-10 shrink-0 items-center gap-2 border-b border-linha px-3">
        <Bookmark size={15} className="shrink-0 text-[var(--realce)]" fill="currentColor" />
        <h1 className="min-w-0 flex-1 truncate text-[13px] font-semibold tracking-[-0.01em]">Favoritos</h1>
        {!aberto ? <span className="text-[10px] text-tinta-3 tabular-nums">{total}</span> : null}
        {aberto ? <span className="ml-auto text-[11px] text-tinta-3">Abrindo…</span> : null}
      </header>

      {grupos.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-tinta-3">Nenhum link salvo ainda.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {grupos.map((pasta) => (
            <GrupoPasta key={pasta.id} pasta={pasta} profundidade={0} onAbrir={abrir} />
          ))}
        </div>
      )}
    </div>
  );
}
