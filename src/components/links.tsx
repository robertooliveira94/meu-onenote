"use client";

import clsx from "clsx";
import { Bookmark, FolderPlus, MoreHorizontal, Pencil, Plus, Search, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useMemo, useState } from "react";

import {
  acaoAtualizarLink,
  acaoCriarLink,
  acaoCriarPastaLink,
  acaoExcluirLink,
  acaoExcluirPastaLink,
  acaoFavoritarLink,
  acaoMoverLink,
  acaoMoverPastaLink,
  acaoRenomearPastaLink,
  type RespostaLinks,
} from "@/app/acoes-links";
import {
  iniciarArrastoDeLink,
  iniciarArrastoDePastaLink,
  lerIdDeLink,
  lerIdDePastaLink,
  trazLink,
  trazPastaLink,
} from "@/lib/arrastar";
import { urlDaPastaLink } from "@/lib/rotas";
import type { Link as LinkSalvo, PastaLink } from "@/lib/tipos";

import { DialogoConfirmar, DialogoConfirmarComTexto, DialogoNome } from "./dialogos";
import { TituloEditavel } from "./titulo-editavel";
import { Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, Rotulo, SeparadorMenu, Vazio } from "./ui";

function encontrarPasta(raiz: PastaLink, id: string): PastaLink | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.pastas) {
    const achada = encontrarPasta(sub, id);
    if (achada) return achada;
  }
  return null;
}

/** Pasta com conteúdo (subpastas ou links) exige digitar o nome para excluir — vazia basta um clique. */
function pastaTemConteudo(pasta: PastaLink): boolean {
  return pasta.pastas.length > 0 || pasta.links.length > 0;
}

type LinkComPasta = LinkSalvo & { pastaId: string };

/** Achata a árvore inteira numa lista só — para a tela inicial (favoritos + recentes). */
function achatarLinks(raiz: PastaLink): LinkComPasta[] {
  const todos: LinkComPasta[] = raiz.links.map((link) => ({ ...link, pastaId: raiz.id }));
  for (const sub of raiz.pastas) todos.push(...achatarLinks(sub));
  return todos;
}

/**
 * A app de Links: pastas e subpastas à esquerda, os links da pasta aberta à
 * direita — mesmo layout de duas colunas do cofre de senhas (`ColunaGrupos`
 * + `ColunaEntradas`), porque os dados têm a mesma forma (árvore de
 * profundidade livre + folhas dentro de cada nó).
 */
export function AppLinks({ arvoreInicial }: { arvoreInicial: PastaLink }) {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const [arvore, definirArvore] = useState(arvoreInicial);
  // Sem `?pasta=` na URL: tela inicial (favoritos + recentes). Com o
  // parâmetro: navegando dentro daquela pasta especificamente.
  const idPastaNaUrl = parametros.get("pasta");
  const modo: "inicio" | "pasta" = idPastaNaUrl ? "pasta" : "inicio";
  const pastaAtiva = idPastaNaUrl ? (encontrarPasta(arvore, idPastaNaUrl) ?? arvore) : arvore;
  const todosOsLinks = useMemo(() => achatarLinks(arvore), [arvore]);
  const favoritos = useMemo(
    () => todosOsLinks.filter((link) => link.favorito).sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
    [todosOsLinks],
  );
  const recentes = useMemo(
    () => [...todosOsLinks].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 9),
    [todosOsLinks],
  );

  const [busca, definirBusca] = useState("");
  const buscando = busca.trim().length > 0;
  const resultadosBusca = useMemo(() => {
    const alvo = busca.trim().toLowerCase();
    if (!alvo) return [];
    return todosOsLinks
      .filter((link) => link.titulo.toLowerCase().includes(alvo) || link.url.toLowerCase().includes(alvo))
      .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
  }, [busca, todosOsLinks]);

  const [linkEmEdicao, definirLinkEmEdicao] = useState<LinkSalvo | "novo" | null>(null);
  const [excluindoLink, definirExcluindoLink] = useState<LinkSalvo | null>(null);
  const [acaoPasta, definirAcaoPasta] = useState<{ tipo: "nova-subpasta" | "excluir"; pasta: PastaLink } | null>(
    null,
  );

  const aplicarResposta = useCallback((resposta: RespostaLinks): boolean => {
    if (resposta.ok) {
      definirArvore(resposta.arvore);
      return true;
    }
    alert(resposta.erro);
    return false;
  }, []);

  const selecionarPasta = useCallback(
    (id: string) => roteador.push(urlDaPastaLink(id)),
    [roteador],
  );
  const abrirNovaSubpasta = useCallback(
    (pasta: PastaLink) => definirAcaoPasta({ tipo: "nova-subpasta", pasta }),
    [],
  );
  const abrirExcluirPasta = useCallback(
    (pasta: PastaLink) => definirAcaoPasta({ tipo: "excluir", pasta }),
    [],
  );
  const moverPasta = useCallback(
    async (id: string, idNovoPai: string) => void aplicarResposta(await acaoMoverPastaLink(id, idNovoPai)),
    [aplicarResposta],
  );
  const moverLink = useCallback(
    async (id: string, idNovaPasta: string) => void aplicarResposta(await acaoMoverLink(id, idNovaPasta)),
    [aplicarResposta],
  );
  const renomearPasta = useCallback(async (id: string, nome: string) => {
    const resposta = await acaoRenomearPastaLink(id, nome);
    if (!resposta.ok) return resposta.erro;
    definirArvore(resposta.arvore);
    return null;
  }, []);
  const abrirLink = useCallback((link: LinkSalvo) => definirLinkEmEdicao(link), []);
  const novoLink = useCallback(() => definirLinkEmEdicao("novo"), []);
  const favoritarLink = useCallback(
    async (link: LinkSalvo) => void aplicarResposta(await acaoFavoritarLink(link.id, !link.favorito)),
    [aplicarResposta],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-linha bg-superficie px-5 py-2.5">
        <Bookmark size={15} className="shrink-0 text-tinta-3" />
        <h1 className="shrink-0 text-[13px] font-bold tracking-[-0.02em]">Links</h1>
        <div className="relative max-w-xs flex-1">
          <Search size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-tinta-3" />
          <input
            value={busca}
            onChange={(evento) => definirBusca(evento.target.value)}
            placeholder="Buscar por título ou URL…"
            className="h-8 w-full rounded-lg border border-linha bg-superficie-alta py-1 pr-2 pl-8 text-[12.5px] text-tinta placeholder:text-tinta-3 focus:border-[var(--realce)] focus:outline-none"
          />
        </div>
        <Link
          href="/links/lixeira"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
        >
          <Trash2 size={13} />
          Lixeira
        </Link>
      </header>

      <div className="flex min-h-0 flex-1">
        <ColunaPastasLinks
          raiz={arvore}
          pastaAtivaId={modo === "pasta" ? pastaAtiva.id : null}
          onInicio={() => roteador.push("/links")}
          onSelecionar={selecionarPasta}
          onCriarSubpasta={abrirNovaSubpasta}
          onExcluir={abrirExcluirPasta}
          onMoverPasta={moverPasta}
          onMoverLink={moverLink}
          onRenomear={renomearPasta}
        />
        {buscando ? (
          <ResultadosBusca termo={busca} resultados={resultadosBusca} onAbrir={abrirLink} onFavoritar={favoritarLink} />
        ) : modo === "pasta" ? (
          <ColunaLinks
            pasta={pastaAtiva}
            onAbrir={abrirLink}
            onNovo={novoLink}
            onExcluir={definirExcluindoLink}
            onFavoritar={favoritarLink}
          />
        ) : (
          <InicioLinks favoritos={favoritos} recentes={recentes} onAbrir={abrirLink} onFavoritar={favoritarLink} />
        )}
      </div>

      {linkEmEdicao ? (
        <DialogoLink
          link={linkEmEdicao === "novo" ? null : linkEmEdicao}
          aoFechar={() => definirLinkEmEdicao(null)}
          aoSalvar={async (id, campos) => {
            const resposta = id ? await acaoAtualizarLink(id, campos) : await acaoCriarLink(pastaAtiva.id, campos);
            if (aplicarResposta(resposta)) definirLinkEmEdicao(null);
          }}
        />
      ) : null}

      {excluindoLink ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir "${excluindoLink.titulo}"?`}
          descricao="Vai para a lixeira — dá para restaurar depois."
          textoBotao="Excluir"
          aoFechar={() => definirExcluindoLink(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirLink(excluindoLink.id);
            if (!resposta.ok) return resposta.erro;
            definirArvore(resposta.arvore);
            definirExcluindoLink(null);
            return null;
          }}
        />
      ) : null}

      {acaoPasta?.tipo === "nova-subpasta" ? (
        <DialogoNome
          aberto
          titulo={`Nova pasta em ${acaoPasta.pasta.nome}`}
          rotulo="Nome"
          textoBotao="Criar pasta"
          aoFechar={() => definirAcaoPasta(null)}
          aoConfirmar={async (nome) => {
            const resposta = await acaoCriarPastaLink(acaoPasta.pasta.id, nome);
            if (!resposta.ok) return resposta.erro;
            definirArvore(resposta.arvore);
            definirAcaoPasta(null);
            return null;
          }}
        />
      ) : null}

      {acaoPasta?.tipo === "excluir" ? (
        pastaTemConteudo(acaoPasta.pasta) ? (
          <DialogoConfirmarComTexto
            aberto
            titulo={`Excluir a pasta ${acaoPasta.pasta.nome}?`}
            descricao="As subpastas e links dentro dela vão junto para a lixeira — dá para restaurar depois."
            palavra={acaoPasta.pasta.nome}
            rotulo={
              <>
                Digite <span className="font-mono text-tinta">{acaoPasta.pasta.nome}</span> para confirmar
              </>
            }
            textoBotao="Excluir pasta"
            aoFechar={() => definirAcaoPasta(null)}
            aoConfirmar={async () => {
              const resposta = await acaoExcluirPastaLink(acaoPasta.pasta.id);
              if (!resposta.ok) return resposta.erro;
              definirArvore(resposta.arvore);
              definirAcaoPasta(null);
              if (idPastaNaUrl === acaoPasta.pasta.id) roteador.push(urlDaPastaLink(arvore.id));
              return null;
            }}
          />
        ) : (
          <DialogoConfirmar
            aberto
            titulo={`Excluir a pasta ${acaoPasta.pasta.nome}?`}
            descricao="Vai para a lixeira — dá para restaurar depois."
            textoBotao="Excluir pasta"
            aoFechar={() => definirAcaoPasta(null)}
            aoConfirmar={async () => {
              const resposta = await acaoExcluirPastaLink(acaoPasta.pasta.id);
              if (!resposta.ok) return resposta.erro;
              definirArvore(resposta.arvore);
              definirAcaoPasta(null);
              if (idPastaNaUrl === acaoPasta.pasta.id) roteador.push(urlDaPastaLink(arvore.id));
              return null;
            }}
          />
        )
      ) : null}
    </div>
  );
}

function ColunaPastasLinks({
  raiz,
  pastaAtivaId,
  onInicio,
  onSelecionar,
  onCriarSubpasta,
  onExcluir,
  onMoverPasta,
  onMoverLink,
  onRenomear,
}: {
  raiz: PastaLink;
  /** `null` = nenhuma pasta selecionada (tela inicial de favoritos + recentes). */
  pastaAtivaId: string | null;
  onInicio: () => void;
  onSelecionar: (id: string) => void;
  onCriarSubpasta: (pasta: PastaLink) => void;
  onExcluir: (pasta: PastaLink) => void;
  onMoverPasta: (id: string, idNovoPai: string) => void;
  onMoverLink: (id: string, idNovaPasta: string) => void;
  onRenomear: (id: string, nome: string) => Promise<string | null>;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="px-2 pt-2">
        <button
          type="button"
          onClick={onInicio}
          className={clsx(
            "flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors",
            pastaAtivaId === null ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          )}
        >
          <Star size={13} className="shrink-0 text-tinta-3" />
          Início
        </button>
      </div>
      <div className="flex items-center justify-between px-3.5 pt-2.5 pb-2">
        <p className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Pastas</p>
        <BotaoIcone rotulo="Nova pasta" onClick={() => onCriarSubpasta(raiz)} className="size-6">
          <FolderPlus size={13} />
        </BotaoIcone>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        <NoPastaLink
          pasta={raiz}
          profundidade={0}
          raiz
          pastaAtivaId={pastaAtivaId}
          onSelecionar={onSelecionar}
          onCriarSubpasta={onCriarSubpasta}
          onExcluir={onExcluir}
          onMoverPasta={onMoverPasta}
          onMoverLink={onMoverLink}
          onRenomear={onRenomear}
        />
      </div>
    </div>
  );
}

/** `true` se `id` é esta pasta ou alguma descendente. */
function contemId(pasta: PastaLink, id: string | null): boolean {
  return id !== null && (pasta.id === id || pasta.pastas.some((sub) => contemId(sub, id)));
}

type PropsNoPasta = {
  pasta: PastaLink;
  profundidade: number;
  /** A pasta raiz não pode ser excluída/movida/renomeada — só navegada. */
  raiz?: boolean;
  pastaAtivaId: string | null;
  onSelecionar: (id: string) => void;
  onCriarSubpasta: (pasta: PastaLink) => void;
  onExcluir: (pasta: PastaLink) => void;
  onMoverPasta: (id: string, idNovoPai: string) => void;
  onMoverLink: (id: string, idNovaPasta: string) => void;
  onRenomear: (id: string, nome: string) => Promise<string | null>;
};

/**
 * `memo` com comparador próprio: navegar entre pastas muda `pastaAtivaId`
 * para todos os nós, mas só os dois que trocam de estado (o que sai e o que
 * entra) precisam re-renderizar — mesmo padrão de `NoGrupo` no cofre.
 */
const NoPastaLink = memo(NoPastaLinkImpl, (anterior, proximo) => {
  if (anterior.pasta !== proximo.pasta || anterior.profundidade !== proximo.profundidade) return false;
  if (anterior.pastaAtivaId === proximo.pastaAtivaId) return true;
  return !contemId(anterior.pasta, anterior.pastaAtivaId) && !contemId(anterior.pasta, proximo.pastaAtivaId);
});

function NoPastaLinkImpl({
  pasta,
  profundidade,
  raiz,
  pastaAtivaId,
  onSelecionar,
  onCriarSubpasta,
  onExcluir,
  onMoverPasta,
  onMoverLink,
  onRenomear,
}: PropsNoPasta) {
  const [sobre, definirSobre] = useState(false);
  const [renomeando, definirRenomeando] = useState(false);
  const ativa = pasta.id === pastaAtivaId;

  return (
    <div>
      <div
        draggable={!raiz && !renomeando}
        onDragStart={(evento) => iniciarArrastoDePastaLink(evento, pasta.id)}
        onDragOver={(evento) => {
          if (!trazPastaLink(evento) && !trazLink(evento)) return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
          definirSobre(true);
        }}
        onDragLeave={() => definirSobre(false)}
        onDrop={(evento) => {
          definirSobre(false);
          if (trazPastaLink(evento)) {
            evento.preventDefault();
            const id = lerIdDePastaLink(evento);
            if (id && id !== pasta.id) onMoverPasta(id, pasta.id);
          } else if (trazLink(evento)) {
            evento.preventDefault();
            const id = lerIdDeLink(evento);
            if (id) onMoverLink(id, pasta.id);
          }
        }}
        onClick={() => onSelecionar(pasta.id)}
        style={{ paddingLeft: 8 + profundidade * 14, color: ativa ? undefined : undefined }}
        className={clsx(
          "group flex cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-1 text-[12.5px] transition-colors",
          ativa ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          sobre && "ring-2 ring-[var(--realce)]",
        )}
      >
        <span aria-hidden>{pasta.icone}</span>
        <div className="min-w-0 flex-1 truncate">
          {raiz ? (
            <span>{pasta.nome}</span>
          ) : (
            <TituloEditavel
              titulo={pasta.nome}
              aoAlternarEdicao={definirRenomeando}
              aoRenomear={(novoNome) => onRenomear(pasta.id, novoNome)}
            />
          )}
        </div>
        <span className="shrink-0 text-[10px] text-tinta-3 tabular-nums opacity-0 group-hover:opacity-100">
          {pasta.links.length || ""}
        </span>
        <Menu
          gatilho={(abrir) => (
            <BotaoIcone
              rotulo={`Opções de ${pasta.nome}`}
              onClick={(evento) => {
                evento.stopPropagation();
                abrir();
              }}
              className="size-5 opacity-0 group-hover:opacity-100"
            >
              <MoreHorizontal size={12} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<FolderPlus size={14} />}
                onClick={() => {
                  fechar();
                  onCriarSubpasta(pasta);
                }}
              >
                Nova subpasta
              </ItemMenu>
              {!raiz ? (
                <>
                  <SeparadorMenu />
                  <ItemMenu
                    icone={<Trash2 size={14} />}
                    perigo
                    onClick={() => {
                      fechar();
                      onExcluir(pasta);
                    }}
                  >
                    Excluir
                  </ItemMenu>
                </>
              ) : null}
            </>
          )}
        </Menu>
      </div>
      {pasta.pastas.length > 0 ? (
        <div>
          {pasta.pastas.map((sub) => (
            <NoPastaLink
              key={sub.id}
              pasta={sub}
              profundidade={profundidade + 1}
              pastaAtivaId={pastaAtivaId}
              onSelecionar={onSelecionar}
              onCriarSubpasta={onCriarSubpasta}
              onExcluir={onExcluir}
              onMoverPasta={onMoverPasta}
              onMoverLink={onMoverLink}
              onRenomear={onRenomear}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function dominioDaUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function ColunaLinks({
  pasta,
  onAbrir,
  onNovo,
  onExcluir,
  onFavoritar,
}: {
  pasta: PastaLink;
  onAbrir: (link: LinkSalvo) => void;
  onNovo: () => void;
  onExcluir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold tracking-[-0.02em]">
            <span aria-hidden className="mr-1">
              {pasta.icone}
            </span>
            {pasta.nome}
          </p>
          <p className="text-[11px] text-tinta-3">
            {pasta.links.length === 0 ? "nenhum link" : `${pasta.links.length} ${pasta.links.length === 1 ? "link" : "links"}`}
          </p>
        </div>
        <Botao variante="primario" onClick={onNovo}>
          <Plus size={13} />
          Novo link
        </Botao>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-4 pb-4">
        {pasta.links.length === 0 ? (
          <div className="pt-8">
            <Vazio
              icone={<Bookmark size={20} />}
              titulo="Nenhum link nesta pasta"
              descricao='Clique em "Novo link" para guardar o primeiro aqui.'
            />
          </div>
        ) : (
          pasta.links.map((link) => (
            <LinhaLink key={link.id} link={link} onAbrir={onAbrir} onExcluir={onExcluir} onFavoritar={onFavoritar} />
          ))
        )}
      </div>
    </div>
  );
}

const LinhaLink = memo(function LinhaLink({
  link,
  onAbrir,
  onExcluir,
  onFavoritar,
}: {
  link: LinkSalvo;
  onAbrir: (link: LinkSalvo) => void;
  onExcluir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeLink(evento, link.id)}
      className="cartao group flex items-center gap-3 px-3.5 py-2.5"
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
          <Bookmark size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-tinta">{link.titulo}</p>
          <p className="truncate text-[11.5px] text-tinta-3">{dominioDaUrl(link.url)}</p>
        </div>
      </a>
      <BotaoIcone
        rotulo={link.favorito ? "Tirar dos favoritos" : "Marcar como favorito"}
        onClick={() => onFavoritar(link)}
        className={clsx("shrink-0", !link.favorito && "opacity-0 group-hover:opacity-100")}
      >
        <Star size={14} className={link.favorito ? "fill-current text-[var(--realce)]" : undefined} />
      </BotaoIcone>
      <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
        <BotaoIcone rotulo="Editar" onClick={() => onAbrir(link)}>
          <Pencil size={14} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={() => onExcluir(link)}>
          <Trash2 size={14} />
        </BotaoIcone>
      </div>
    </div>
  );
});

/**
 * Tela inicial da app: todos os links, mais recentes primeiro, com uma
 * seção de favoritos acima — mesmo formato da página inicial de Anotações
 * ("Fixadas" + "Editadas recentemente"), mas achatando a árvore de pastas
 * inteira em vez de olhar só um caderno.
 */
function InicioLinks({
  favoritos,
  recentes,
  onAbrir,
  onFavoritar,
}: {
  favoritos: LinkComPasta[];
  recentes: LinkComPasta[];
  onAbrir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
}) {
  if (favoritos.length === 0 && recentes.length === 0) {
    return (
      <div className="min-w-0 flex-1 overflow-y-auto bg-papel px-5 py-8">
        <Vazio
          icone={<Bookmark size={20} />}
          titulo="Nenhum link salvo ainda"
          descricao='Escolha uma pasta ao lado e clique em "Novo link" para começar.'
        />
      </div>
    );
  }
  return (
    <div className="min-w-0 flex-1 space-y-7 overflow-y-auto bg-papel px-5 py-5">
      {favoritos.length > 0 ? (
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
            <Star size={12} />
            Favoritos
          </h2>
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {favoritos.map((link) => (
              <CartaoLink key={link.id} link={link} onAbrir={onAbrir} onFavoritar={onFavoritar} />
            ))}
          </div>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">Recentes</h2>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {recentes.map((link) => (
            <CartaoLink key={link.id} link={link} onAbrir={onAbrir} onFavoritar={onFavoritar} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CartaoLink({
  link,
  onAbrir,
  onFavoritar,
}: {
  link: LinkComPasta;
  onAbrir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
}) {
  return (
    <div className="cartao group flex items-center gap-3 px-3.5 py-2.5">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
          <Bookmark size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-tinta">{link.titulo}</p>
          <p className="truncate text-[11.5px] text-tinta-3">{dominioDaUrl(link.url)}</p>
        </div>
      </a>
      <BotaoIcone
        rotulo={link.favorito ? "Tirar dos favoritos" : "Marcar como favorito"}
        onClick={() => onFavoritar(link)}
        className={clsx("shrink-0", !link.favorito && "opacity-0 group-hover:opacity-100")}
      >
        <Star size={14} className={link.favorito ? "fill-current text-[var(--realce)]" : undefined} />
      </BotaoIcone>
      <BotaoIcone rotulo="Editar" onClick={() => onAbrir(link)} className="shrink-0 opacity-0 group-hover:opacity-100">
        <Pencil size={14} />
      </BotaoIcone>
    </div>
  );
}

function ResultadosBusca({
  termo,
  resultados,
  onAbrir,
  onFavoritar,
}: {
  termo: string;
  resultados: LinkComPasta[];
  onAbrir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
}) {
  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-papel px-5 py-5">
      <p className="mb-3 text-[11.5px] text-tinta-3">
        {resultados.length === 0
          ? `Nada encontrado para "${termo}".`
          : `${resultados.length} ${resultados.length === 1 ? "resultado" : "resultados"} para "${termo}"`}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {resultados.map((link) => (
          <CartaoLink key={link.id} link={link} onAbrir={onAbrir} onFavoritar={onFavoritar} />
        ))}
      </div>
    </div>
  );
}

type CamposLink = { titulo: string; url: string; nota: string; favorito: boolean };

function DialogoLink({
  link,
  aoFechar,
  aoSalvar,
}: {
  link: LinkSalvo | null;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposLink) => Promise<void>;
}) {
  const [campos, definirCampos] = useState<CamposLink>({
    titulo: link?.titulo ?? "",
    url: link?.url ?? "",
    nota: link?.nota ?? "",
    favorito: link?.favorito ?? false,
  });
  const [salvando, definirSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    await aoSalvar(link?.id ?? null, campos);
    definirSalvando(false);
  }

  return (
    <Dialogo titulo={link ? "Editar link" : "Novo link"} aberto aoFechar={aoFechar} largura="max-w-lg" realcado>
      <form onSubmit={enviar} className="space-y-3">
        <div>
          <Rotulo>URL</Rotulo>
          <Campo
            autoFocus
            value={campos.url}
            onChange={(evento) => definirCampos({ ...campos, url: evento.target.value })}
            placeholder="https://…"
          />
        </div>
        <div>
          <Rotulo>Título</Rotulo>
          <Campo
            value={campos.titulo}
            onChange={(evento) => definirCampos({ ...campos, titulo: evento.target.value })}
            placeholder="Deixe em branco para usar a URL"
          />
        </div>
        <div>
          <Rotulo>Nota (opcional)</Rotulo>
          <textarea
            value={campos.nota}
            onChange={(evento) => definirCampos({ ...campos, nota: evento.target.value })}
            rows={3}
            className="w-full resize-none rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
            placeholder="Por que salvou este link"
          />
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-tinta-2">
          <input
            type="checkbox"
            checked={campos.favorito}
            onChange={(evento) => definirCampos({ ...campos, favorito: evento.target.checked })}
          />
          Marcar como favorito
        </label>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !campos.url.trim()}>
            {link ? "Salvar" : "Adicionar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}
