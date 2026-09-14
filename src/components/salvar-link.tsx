"use client";

import clsx from "clsx";
import { Bookmark, Check, Folder } from "lucide-react";
import { useState } from "react";

import { acaoDefinirDestinoLink, acaoSalvarLinkDoClipper } from "@/app/acoes-links";
import type { PastaLink } from "@/lib/tipos";

import { Botao, Campo, Rotulo } from "./ui";

/** Lista recursiva de pastas pra escolher o destino — um botão por pasta, indentado pela profundidade. */
function ListaPastas({
  pasta,
  profundidade,
  pastaEscolhidaId,
  onEscolher,
}: {
  pasta: PastaLink;
  profundidade: number;
  pastaEscolhidaId: string;
  onEscolher: (id: string) => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={() => onEscolher(pasta.id)}
        style={{ paddingLeft: 10 + profundidade * 16 }}
        className={clsx(
          "flex w-full items-center gap-1.5 rounded-md py-1.5 pr-2 text-left text-[12.5px] transition-colors",
          pasta.id === pastaEscolhidaId ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
        )}
      >
        <span aria-hidden>{pasta.icone}</span>
        <span className="min-w-0 flex-1 truncate">{pasta.nome}</span>
        {pasta.id === pastaEscolhidaId ? <Check size={13} className="shrink-0" /> : null}
      </button>
      {pasta.pastas.map((sub) => (
        <ListaPastas key={sub.id} pasta={sub} profundidade={profundidade + 1} pastaEscolhidaId={pastaEscolhidaId} onEscolher={onEscolher} />
      ))}
    </>
  );
}

export function SalvarLinkPopup({
  arvore,
  url,
  tituloInicial,
  pastaInicial,
}: {
  arvore: PastaLink;
  url: string;
  tituloInicial: string;
  pastaInicial: string;
}) {
  const [titulo, definirTitulo] = useState(tituloInicial || url);
  const [pastaId, definirPastaId] = useState(pastaInicial);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvo, definirSalvo] = useState(false);

  async function salvar() {
    if (!url.trim()) {
      definirErro("Sem URL — abra este atalho a partir da página que quer salvar.");
      return;
    }
    definirSalvando(true);
    const resposta = await acaoSalvarLinkDoClipper(pastaId, titulo.trim() || url, url);
    definirSalvando(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    await acaoDefinirDestinoLink(pastaId);
    definirSalvo(true);
    // A janela só existe porque o bookmarklet a abriu como pop-up — fechar
    // sozinha é o que faz o atalho parecer "um clique só" de verdade.
    setTimeout(() => window.close(), 600);
  }

  if (salvo) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-papel px-6 text-center">
        <Check size={22} className="text-[var(--realce)]" />
        <p className="text-[13px] font-medium text-tinta">Link salvo!</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-papel px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        <Bookmark size={16} className="text-[var(--realce)]" />
        <h1 className="text-[14px] font-bold tracking-[-0.02em]">Salvar link</h1>
      </div>

      <label className="block">
        <Rotulo>Título</Rotulo>
        <Campo autoFocus value={titulo} onChange={(evento) => definirTitulo(evento.target.value)} />
      </label>
      <p className="mt-1 truncate text-[11.5px] text-tinta-3">{url}</p>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <Rotulo>Pasta</Rotulo>
        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg border border-linha bg-superficie-alta p-1.5">
          {arvore.pastas.length === 0 && arvore.links.length === 0 ? (
            <p className="flex items-center gap-1.5 px-2 py-1.5 text-[12px] text-tinta-3">
              <Folder size={13} />
              {arvore.nome}
            </p>
          ) : null}
          <ListaPastas pasta={arvore} profundidade={0} pastaEscolhidaId={pastaId} onEscolher={definirPastaId} />
        </div>
      </div>

      {erro ? <p className="mt-2 text-[12px] text-perigo">{erro}</p> : null}

      <Botao variante="primario" onClick={salvar} disabled={salvando} className="mt-3 w-full justify-center">
        {salvando ? "Salvando…" : "Salvar"}
      </Botao>
    </div>
  );
}
