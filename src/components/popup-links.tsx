"use client";

import { Bookmark, ChevronDown, ChevronRight, Folder } from "lucide-react";
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
      <img
        src={`/links/favicon/${link.favicon}`}
        alt=""
        className="size-5 shrink-0 rounded-md border border-linha bg-superficie-alta object-contain p-0.5"
      />
    );
  }
  return (
    <div className="flex size-5 shrink-0 items-center justify-center rounded-md bg-realce-medio text-[var(--realce)]">
      <Bookmark size={11} />
    </div>
  );
}

function LinhaLink({ link, profundidade, onAbrir }: { link: LinkSalvo; profundidade: number; onAbrir: (link: LinkSalvo) => void }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onAbrir(link)}
      style={{ paddingLeft: 6 + profundidade * 14 }}
      className="flex items-center gap-2 rounded-md py-[3px] pr-1.5 text-left transition-colors hover:bg-realce-fraco"
    >
      <IconeDoLink link={link} />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-tinta">{link.titulo}</span>
      <span className="shrink-0 truncate text-[10px] text-tinta-3">{dominioDaUrl(link.url)}</span>
    </a>
  );
}

/** Uma pasta da árvore, fechada até clicar; aberta, mostra subpastas e depois os links, recuados. */
function NoPasta({
  pasta,
  profundidade,
  abertas,
  onAlternar,
  onAbrir,
  soLinks = false,
}: {
  pasta: PastaLink;
  profundidade: number;
  abertas: Set<string>;
  onAlternar: (id: string) => void;
  onAbrir: (link: LinkSalvo) => void;
  /** A raiz ("Geral") só carrega os links soltos dela — as pastas de primeiro nível ficam ao lado, como no app. */
  soLinks?: boolean;
}) {
  const aberta = abertas.has(pasta.id);
  const subpastas = soLinks ? [] : pasta.pastas;
  const total = subpastas.length + pasta.links.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => onAlternar(pasta.id)}
        aria-expanded={aberta}
        style={{ paddingLeft: 6 + profundidade * 14 }}
        className="flex w-full items-center gap-1.5 rounded-md py-[3px] pr-1.5 text-left transition-colors hover:bg-realce-fraco"
      >
        {aberta ? <ChevronDown size={12} className="shrink-0 text-tinta-3" /> : <ChevronRight size={12} className="shrink-0 text-tinta-3" />}
        <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-[13px]">
          {pasta.icone || <Folder size={13} style={{ color: pasta.cor }} />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-tinta">{pasta.nome}</span>
        <span className="shrink-0 text-[10px] text-tinta-3 tabular-nums">{total || ""}</span>
      </button>
      {aberta ? (
        <div>
          {subpastas.map((sub) => (
            <NoPasta key={sub.id} pasta={sub} profundidade={profundidade + 1} abertas={abertas} onAlternar={onAlternar} onAbrir={onAbrir} />
          ))}
          {pasta.links.map((link) => (
            <LinhaLink key={link.id} link={link} profundidade={profundidade + 1} onAbrir={onAbrir} />
          ))}
          {total === 0 ? (
            <p style={{ paddingLeft: 6 + (profundidade + 1) * 14 }} className="py-1 text-[11px] text-tinta-3">
              Pasta vazia.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Janelinha compacta de Links: a árvore de pastas, toda fechada, do jeito
 * que está no app — nada de favoritos ou recentes na frente. Clicar numa
 * pasta abre ela ali mesmo (subpastas e links recuados); clicar num link
 * abre numa aba nova, marca como lido e fecha a janelinha sozinha, porque
 * ela só existe como pop-up (igual a `/salvar-link`).
 */
export function PopupLinks({ arvore }: { arvore: PastaLink }) {
  const [abertas, definirAbertas] = useState<Set<string>>(() => new Set());
  const [aberto, definirAberto] = useState<string | null>(null);

  function alternar(id: string) {
    definirAbertas((atuais) => {
      const proximas = new Set(atuais);
      if (proximas.has(id)) proximas.delete(id);
      else proximas.add(id);
      return proximas;
    });
  }

  function abrir(link: LinkSalvo) {
    definirAberto(link.id);
    if (!link.lido) acaoMarcarComoAberto(link.id);
    setTimeout(() => window.close(), 350);
  }

  const vazio = arvore.pastas.length === 0 && arvore.links.length === 0;

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-papel px-2.5 py-2.5">
      <div className="mb-1 flex items-center gap-1.5 px-0.5">
        <Bookmark size={14} className="shrink-0 text-[var(--realce)]" />
        <h1 className="truncate text-[12.5px] font-bold tracking-[-0.02em]">Links</h1>
      </div>

      {vazio ? (
        <p className="px-2 py-6 text-center text-[12px] text-tinta-3">Nenhum link salvo ainda.</p>
      ) : (
        <div className="space-y-0.5 pb-1">
          <NoPasta pasta={arvore} profundidade={0} abertas={abertas} onAlternar={alternar} onAbrir={abrir} soLinks />
          {arvore.pastas.map((sub) => (
            <NoPasta key={sub.id} pasta={sub} profundidade={0} abertas={abertas} onAlternar={alternar} onAbrir={abrir} />
          ))}
        </div>
      )}
      {aberto ? <p className="mt-auto pt-2 text-center text-[11px] text-tinta-3">Abrindo…</p> : null}
    </div>
  );
}
