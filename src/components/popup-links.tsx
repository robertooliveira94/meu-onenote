"use client";

import { Bookmark } from "lucide-react";
import { useState } from "react";

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

function LinhaLink({ link, onAbrir }: { link: LinkSalvo; onAbrir: (link: LinkSalvo) => void }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onAbrir(link)}
      title={`${link.titulo} — ${dominioDaUrl(link.url)}`}
      className="flex items-center gap-2 rounded-md px-1.5 py-[3px] transition-colors hover:bg-realce-fraco"
    >
      <IconeDoLink link={link} />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-tinta">{link.titulo}</span>
    </a>
  );
}

/** Uma subpasta dentro do cartão: subtítulo e os links dela, recuados; as subpastas dela seguem abaixo, mais recuadas. */
function Subpasta({ pasta, profundidade, onAbrir }: { pasta: PastaLink; profundidade: number; onAbrir: (link: LinkSalvo) => void }) {
  return (
    <div style={{ paddingLeft: profundidade * 10 }}>
      <p className="mt-2 mb-0.5 flex items-center gap-1.5 px-1.5 text-[10.5px] font-semibold tracking-wide text-tinta-2 uppercase">
        <span aria-hidden>{pasta.icone}</span>
        <span className="truncate">{pasta.nome}</span>
      </p>
      {pasta.links.map((link) => (
        <LinhaLink key={link.id} link={link} onAbrir={onAbrir} />
      ))}
      {pasta.links.length === 0 && pasta.pastas.length === 0 ? <p className="px-1.5 text-[11px] text-tinta-3">vazia</p> : null}
      {pasta.pastas.map((sub) => (
        <Subpasta key={sub.id} pasta={sub} profundidade={profundidade + 1} onAbrir={onAbrir} />
      ))}
    </div>
  );
}

/** Um cartão por pasta de primeiro nível: os links dela e, abaixo, cada subpasta com os seus — tudo à vista. */
function CartaoPasta({ pasta, onAbrir }: { pasta: PastaLink; onAbrir: (link: LinkSalvo) => void }) {
  const total = contarLinks(pasta);
  return (
    <section className="cartao flex min-w-0 flex-col p-2.5" style={{ borderTop: `3px solid ${pasta.cor}` }}>
      <h2 className="mb-1 flex items-center gap-1.5 px-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-tinta">
        <span aria-hidden>{pasta.icone}</span>
        <span className="min-w-0 flex-1 truncate">{pasta.nome}</span>
        <span className="text-[10px] font-normal text-tinta-3 tabular-nums">{total || ""}</span>
      </h2>
      {pasta.links.map((link) => (
        <LinhaLink key={link.id} link={link} onAbrir={onAbrir} />
      ))}
      {pasta.pastas.map((sub) => (
        <Subpasta key={sub.id} pasta={sub} profundidade={0} onAbrir={onAbrir} />
      ))}
      {total === 0 ? <p className="px-1.5 py-1 text-[11px] text-tinta-3">Nenhum link.</p> : null}
    </section>
  );
}

function contarLinks(pasta: PastaLink): number {
  return pasta.links.length + pasta.pastas.reduce((soma, sub) => soma + contarLinks(sub), 0);
}

/**
 * Janelinha larga de Links (o favorito "Abrir meus links" abre 820×520):
 * uma grade de cartões, um por pasta de primeiro nível, lado a lado e
 * quebrando pra linha de baixo quando não cabem; dentro de cada um, os
 * links da pasta e as subpastas com os seus, tudo visível de uma vez —
 * nada fechado, sem favoritos nem recentes. Os links soltos da raiz
 * ("Geral") são o primeiro cartão, quando existem. Clicar num link abre
 * numa aba nova e fecha a janelinha sozinha, porque ela só existe como
 * pop-up (igual a `/salvar-link`).
 */
export function PopupLinks({ arvore }: { arvore: PastaLink }) {
  const [aberto, definirAberto] = useState<string | null>(null);

  function abrir(link: LinkSalvo) {
    definirAberto(link.id);
    if (!link.lido) acaoMarcarComoAberto(link.id);
    setTimeout(() => window.close(), 350);
  }

  const cartoes: PastaLink[] = [
    ...(arvore.links.length ? [{ ...arvore, pastas: [] }] : []),
    ...arvore.pastas,
  ];

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-papel px-3 py-2.5">
      <div className="mb-2 flex items-center gap-1.5 px-0.5">
        <Bookmark size={14} className="shrink-0 text-[var(--realce)]" />
        <h1 className="truncate text-[12.5px] font-bold tracking-[-0.02em]">Links</h1>
        {aberto ? <span className="ml-auto text-[11px] text-tinta-3">Abrindo…</span> : null}
      </div>

      {cartoes.length === 0 ? (
        <p className="px-2 py-6 text-center text-[12px] text-tinta-3">Nenhum link salvo ainda.</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] items-start gap-2.5 pb-2">
          {cartoes.map((pasta) => (
            <CartaoPasta key={pasta.id} pasta={pasta} onAbrir={abrir} />
          ))}
        </div>
      )}
    </div>
  );
}
