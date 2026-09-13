"use client";

import clsx from "clsx";
import { Bookmark, FolderPlus, MoreHorizontal, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useState } from "react";

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
  const pastaAtivaId = parametros.get("pasta") ?? arvoreInicial.id;
  const pastaAtiva = encontrarPasta(arvore, pastaAtivaId) ?? arvore;

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
      <header className="flex shrink-0 items-center gap-2 border-b border-linha bg-superficie px-5 py-2.5">
        <Bookmark size={15} className="text-tinta-3" />
        <h1 className="text-[13px] font-bold tracking-[-0.02em]">Links</h1>
      </header>

      <div className="flex min-h-0 flex-1">
        <ColunaPastasLinks
          raiz={arvore}
          pastaAtivaId={pastaAtiva.id}
          onSelecionar={selecionarPasta}
          onCriarSubpasta={abrirNovaSubpasta}
          onExcluir={abrirExcluirPasta}
          onMoverPasta={moverPasta}
          onMoverLink={moverLink}
          onRenomear={renomearPasta}
        />
        <ColunaLinks
          pasta={pastaAtiva}
          onAbrir={abrirLink}
          onNovo={novoLink}
          onExcluir={definirExcluindoLink}
          onFavoritar={favoritarLink}
        />
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
              if (pastaAtivaId === acaoPasta.pasta.id) roteador.push(urlDaPastaLink(arvore.id));
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
              if (pastaAtivaId === acaoPasta.pasta.id) roteador.push(urlDaPastaLink(arvore.id));
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
  onSelecionar,
  onCriarSubpasta,
  onExcluir,
  onMoverPasta,
  onMoverLink,
  onRenomear,
}: {
  raiz: PastaLink;
  pastaAtivaId: string;
  onSelecionar: (id: string) => void;
  onCriarSubpasta: (pasta: PastaLink) => void;
  onExcluir: (pasta: PastaLink) => void;
  onMoverPasta: (id: string, idNovoPai: string) => void;
  onMoverLink: (id: string, idNovaPasta: string) => void;
  onRenomear: (id: string, nome: string) => Promise<string | null>;
}) {
  return (
    <div className="flex w-64 shrink-0 flex-col overflow-hidden border-r border-linha bg-papel">
      <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
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
function contemId(pasta: PastaLink, id: string): boolean {
  return pasta.id === id || pasta.pastas.some((sub) => contemId(sub, id));
}

type PropsNoPasta = {
  pasta: PastaLink;
  profundidade: number;
  /** A pasta raiz não pode ser excluída/movida/renomeada — só navegada. */
  raiz?: boolean;
  pastaAtivaId: string;
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
