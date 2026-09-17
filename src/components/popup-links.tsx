"use client";

import { Bookmark, ChevronLeft, ChevronRight, Folder, Star } from "lucide-react";
import { useState } from "react";

import { acaoMarcarComoAberto } from "@/app/acoes-links";
import type { Link as LinkSalvo, PastaLink } from "@/lib/tipos";

function encontrarPasta(raiz: PastaLink, id: string): PastaLink | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.pastas) {
    const achada = encontrarPasta(sub, id);
    if (achada) return achada;
  }
  return null;
}

/** Da raiz até `id`, inclusive — usado só pra achar o pai (pra "voltar"). */
function caminhoAte(raiz: PastaLink, id: string): PastaLink[] | null {
  if (raiz.id === id) return [raiz];
  for (const sub of raiz.pastas) {
    const resto = caminhoAte(sub, id);
    if (resto) return [raiz, ...resto];
  }
  return null;
}

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

function LinhaLink({ link, onAbrir }: { link: LinkSalvo; onAbrir: (link: LinkSalvo) => void }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onAbrir(link)}
      className="flex items-center gap-2 rounded-md px-1.5 py-[3px] text-left transition-colors hover:bg-realce-fraco"
    >
      <IconeDoLink link={link} />
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-tinta">{link.titulo}</span>
      <span className="shrink-0 truncate text-[10px] text-tinta-3">{dominioDaUrl(link.url)}</span>
    </a>
  );
}

function LinhaPasta({ pasta, onEntrar }: { pasta: PastaLink; onEntrar: (id: string) => void }) {
  const total = pasta.pastas.length + pasta.links.length;
  return (
    <button
      type="button"
      onClick={() => onEntrar(pasta.id)}
      className="flex w-full items-center gap-2 rounded-md px-1.5 py-[3px] text-left transition-colors hover:bg-realce-fraco"
    >
      <span aria-hidden className="flex size-5 shrink-0 items-center justify-center text-[13px]">
        {pasta.icone || <Folder size={13} style={{ color: pasta.cor }} />}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium text-tinta">{pasta.nome}</span>
      <span className="shrink-0 text-[10px] tabular-nums text-tinta-3">{total}</span>
      <ChevronRight size={12} className="shrink-0 text-tinta-3" />
    </button>
  );
}

function Rubrica({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-0.5 flex items-center gap-1.5 px-1.5 pt-2 text-[10px] font-medium tracking-wide text-tinta-3 uppercase">{children}</h2>;
}

/**
 * Janelinha compacta de Links: começa em favoritos + recentes + as pastas
 * de primeiro nível, e deixa entrar em qualquer pasta (com subpastas
 * dentro) sem sair da janelinha — mesma árvore do app cheio, só que densa
 * o bastante pra caber muita coisa de uma vez. Clicar num link abre numa
 * aba nova (pra não perder a janelinha antes dela fechar sozinha) e marca
 * como lido; clicar numa pasta só navega, não fecha nada. Fecha sozinha ao
 * abrir um link, como `/salvar-link`, porque só existe como pop-up.
 */
export function PopupLinks({ favoritos, recentes, arvore }: { favoritos: LinkSalvo[]; recentes: LinkSalvo[]; arvore: PastaLink }) {
  const [pastaId, definirPastaId] = useState(arvore.id);
  const [aberto, definirAberto] = useState<string | null>(null);

  const pastaAtual = encontrarPasta(arvore, pastaId) ?? arvore;
  const caminho = caminhoAte(arvore, pastaId) ?? [arvore];
  const naRaiz = pastaAtual.id === arvore.id;
  const pastaPai = caminho.length > 1 ? caminho[caminho.length - 2] : null;

  function abrir(link: LinkSalvo) {
    definirAberto(link.id);
    if (!link.lido) acaoMarcarComoAberto(link.id);
    setTimeout(() => window.close(), 350);
  }

  const vazio =
    (!naRaiz || (favoritos.length === 0 && recentes.length === 0)) &&
    pastaAtual.pastas.length === 0 &&
    pastaAtual.links.length === 0;

  return (
    <div className="flex h-screen w-full flex-col overflow-y-auto bg-papel px-2.5 py-2.5">
      <div className="mb-0.5 flex items-center gap-1.5 px-0.5">
        {naRaiz ? (
          <>
            <Bookmark size={14} className="shrink-0 text-[var(--realce)]" />
            <h1 className="truncate text-[12.5px] font-bold tracking-[-0.02em]">Links</h1>
          </>
        ) : (
          <button
            type="button"
            onClick={() => definirPastaId(pastaPai ? pastaPai.id : arvore.id)}
            className="flex min-w-0 items-center gap-1 rounded-md py-0.5 pr-1.5 text-[12.5px] font-bold tracking-[-0.02em] text-tinta transition-colors hover:text-[var(--realce)]"
          >
            <ChevronLeft size={14} className="shrink-0" />
            <span className="truncate">{pastaAtual.nome}</span>
          </button>
        )}
      </div>

      {vazio ? (
        <p className="px-2 py-6 text-center text-[12px] text-tinta-3">
          {naRaiz ? "Nenhum link salvo ainda." : "Pasta vazia."}
        </p>
      ) : (
        <div className="pb-1">
          {naRaiz && favoritos.length > 0 ? (
            <section>
              <Rubrica>
                <Star size={9} />
                Favoritos
              </Rubrica>
              {favoritos.map((link) => (
                <LinhaLink key={link.id} link={link} onAbrir={abrir} />
              ))}
            </section>
          ) : null}
          {naRaiz && recentes.length > 0 ? (
            <section>
              <Rubrica>Recentes</Rubrica>
              {recentes.map((link) => (
                <LinhaLink key={link.id} link={link} onAbrir={abrir} />
              ))}
            </section>
          ) : null}
          {pastaAtual.pastas.length > 0 ? (
            <section>
              <Rubrica>{naRaiz ? "Pastas" : "Subpastas"}</Rubrica>
              {pastaAtual.pastas.map((sub) => (
                <LinhaPasta key={sub.id} pasta={sub} onEntrar={definirPastaId} />
              ))}
            </section>
          ) : null}
          {pastaAtual.links.length > 0 ? (
            <section>
              <Rubrica>{naRaiz ? "Nesta pasta" : "Links"}</Rubrica>
              {pastaAtual.links.map((link) => (
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
