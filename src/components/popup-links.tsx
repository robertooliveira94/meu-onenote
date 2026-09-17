"use client";

import { Bookmark, Star } from "lucide-react";
import { useState } from "react";

import { acaoMarcarComoAberto } from "@/app/acoes-links";
import type { Link as LinkSalvo } from "@/lib/tipos";

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
        className="size-7 shrink-0 rounded-lg border border-linha bg-superficie-alta object-contain p-1"
      />
    );
  }
  return (
    <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
      <Bookmark size={13} />
    </div>
  );
}

function LinhaLink({ link, onAbrir }: { link: LinkSalvo; onAbrir: (link: LinkSalvo) => void }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onAbrir(link)}
      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-realce-fraco"
    >
      <IconeDoLink link={link} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-tinta">{link.titulo}</p>
        <p className="truncate text-[11px] text-tinta-3">{dominioDaUrl(link.url)}</p>
      </div>
    </a>
  );
}

/**
 * Janelinha compacta de Links: favoritos + recentes, clicar abre o link
 * (numa aba nova, pra não perder a janelinha antes dela fechar sozinha) e
 * marca como lido — mesmo par de ações do clique numa linha do app cheio.
 * Fecha sozinha, como `/salvar-link`, porque só existe como pop-up.
 */
export function PopupLinks({ favoritos, recentes }: { favoritos: LinkSalvo[]; recentes: LinkSalvo[] }) {
  const [aberto, definirAberto] = useState<string | null>(null);

  function abrir(link: LinkSalvo) {
    definirAberto(link.id);
    if (!link.lido) acaoMarcarComoAberto(link.id);
    setTimeout(() => window.close(), 350);
  }

  const vazio = favoritos.length === 0 && recentes.length === 0;

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-papel px-3 py-3">
      <div className="mb-1 flex items-center gap-2 px-1">
        <Bookmark size={15} className="text-[var(--realce)]" />
        <h1 className="text-[13px] font-bold tracking-[-0.02em]">Links</h1>
      </div>

      {vazio ? (
        <p className="px-2 py-6 text-center text-[12px] text-tinta-3">Nenhum link salvo ainda.</p>
      ) : (
        <div className="space-y-3 pt-1">
          {favoritos.length > 0 ? (
            <section>
              <h2 className="mb-1 flex items-center gap-1.5 px-2 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">
                <Star size={10} />
                Favoritos
              </h2>
              {favoritos.map((link) => (
                <LinhaLink key={link.id} link={link} onAbrir={abrir} />
              ))}
            </section>
          ) : null}
          {recentes.length > 0 ? (
            <section>
              <h2 className="mb-1 px-2 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">Recentes</h2>
              {recentes.map((link) => (
                <LinhaLink key={link.id} link={link} onAbrir={abrir} />
              ))}
            </section>
          ) : null}
        </div>
      )}
      {aberto ? <p className="mt-auto pt-2 text-center text-[11px] text-tinta-3">Abrindo…</p> : null}
    </div>
  );
}
