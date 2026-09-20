"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Circle,
  Download,
  ExternalLink,
  Folder,
  FolderPlus,
  Import,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Rows3,
  ShieldQuestion,
  Star,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acaoAcharDuplicado,
  acaoAtualizarLink,
  acaoBuscarMetadadosUrl,
  acaoCriarLink,
  acaoCriarPastaLink,
  acaoExcluirLink,
  acaoExcluirPastaLink,
  acaoExcluirVarios,
  acaoExportarFavoritosHtml,
  acaoFavoritarLink,
  acaoFavoritarVarios,
  acaoImportarFavoritosHtml,
  acaoMarcarComoAberto,
  acaoMarcarVariosComoLido,
  acaoMoverLink,
  acaoMoverPastaLink,
  acaoMoverVarios,
  acaoReordenarLinks,
  acaoRenomearPastaLink,
  acaoVerificarLinks,
  type RespostaLinks,
} from "@/app/acoes-links";
import {
  calcularNovaOrdem,
  iniciarArrastoDeLink,
  iniciarArrastoDePastaLink,
  lerIdDeLink,
  lerIdDePastaLink,
  trazLink,
  trazPastaLink,
} from "@/lib/arrastar";
import { useAtalho } from "@/lib/atalhos";
import { urlDaPastaLink } from "@/lib/rotas";
import type { Link as LinkSalvo, PastaLink } from "@/lib/tipos";

import { DialogoConfirmar, DialogoConfirmarComTexto, DialogoNome } from "./dialogos";
import { TituloEditavel } from "./titulo-editavel";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, ItemMenu, Menu, Rotulo, SeparadorMenu, Vazio } from "./ui";

function encontrarPasta(raiz: PastaLink, id: string): PastaLink | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.pastas) {
    const achada = encontrarPasta(sub, id);
    if (achada) return achada;
  }
  return null;
}

/** Da raiz até `id`, inclusive — a trilha de navegação (`Geral › Trabalho › Projetos`). */
function caminhoAte(raiz: PastaLink, id: string): PastaLink[] | null {
  if (raiz.id === id) return [raiz];
  for (const sub of raiz.pastas) {
    const resto = caminhoAte(sub, id);
    if (resto) return [raiz, ...resto];
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
    () => [...todosOsLinks].sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)).slice(0, 12),
    [todosOsLinks],
  );

  const [linkEmEdicao, definirLinkEmEdicao] = useState<LinkSalvo | "novo" | null>(null);
  const [excluindoLink, definirExcluindoLink] = useState<LinkSalvo | null>(null);
  const [acaoPasta, definirAcaoPasta] = useState<{ tipo: "nova-subpasta" | "excluir"; pasta: PastaLink } | null>(
    null,
  );
  const [importando, definirImportando] = useState(false);

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
  /** Baixa o export de favoritos como um arquivo `.html` — fecha o ciclo do "Importar favoritos". */
  const exportarFavoritos = useCallback(async () => {
    const html = await acaoExportarFavoritosHtml();
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "favoritos.html";
    a.click();
    URL.revokeObjectURL(url);
  }, []);
  useAtalho("n", { grupo: "Links", descricao: `Novo link em ${pastaAtiva.nome}`, acao: novoLink });
  const caminhoAtual = useMemo(() => caminhoAte(arvore, pastaAtiva.id) ?? [pastaAtiva], [arvore, pastaAtiva]);
  useAtalho("backspace", {
    grupo: "Links",
    descricao: "Subir uma pasta",
    ativo: modo === "pasta" && caminhoAtual.length > 1,
    acao: () => selecionarPasta(caminhoAtual[caminhoAtual.length - 2].id),
  });
  const favoritarLink = useCallback(
    async (link: LinkSalvo) => void aplicarResposta(await acaoFavoritarLink(link.id, !link.favorito)),
    [aplicarResposta],
  );
  /** Clicar num link pra visitar o site conta como "lido" — não espera a resposta pra não atrasar a navegação. */
  const visitarLink = useCallback((link: LinkSalvo) => {
    if (link.lido) return;
    acaoMarcarComoAberto(link.id).then(aplicarResposta);
  }, [aplicarResposta]);

  const [criandoDeUrl, definirCriandoDeUrl] = useState(false);
  /** Cria o link direto (colar/arrastar uma URL) — sem passar pelo diálogo: busca título e favicon sozinho. */
  const criarLinkRapido = useCallback(
    async (url: string, idPasta: string) => {
      definirCriandoDeUrl(true);
      const { titulo, favicon } = await acaoBuscarMetadadosUrl(url);
      const resposta = await acaoCriarLink(idPasta, { titulo: titulo ?? url, url, nota: "", favorito: false }, favicon);
      definirCriandoDeUrl(false);
      aplicarResposta(resposta);
    },
    [aplicarResposta],
  );

  // Colar uma URL em qualquer lugar da tela (fora de um campo de texto) cria
  // o link na pasta aberta na hora — sem diálogo. `n` continua abrindo o
  // diálogo completo para quem quer escrever título/nota antes de salvar.
  useEffect(() => {
    function aoColar(evento: ClipboardEvent) {
      const alvo = evento.target as HTMLElement | null;
      if (alvo?.closest("input, textarea, [contenteditable=true]")) return;
      const texto = evento.clipboardData?.getData("text/plain")?.trim();
      if (!texto) return;
      try {
        new URL(texto);
      } catch {
        return;
      }
      evento.preventDefault();
      criarLinkRapido(texto, pastaAtiva.id);
    }
    document.addEventListener("paste", aoColar);
    return () => document.removeEventListener("paste", aoColar);
  }, [criarLinkRapido, pastaAtiva.id]);

  const abrirTodos = useCallback((links: LinkSalvo[]) => {
    if (links.length > 8 && !confirm(`Abrir ${links.length} links em novas abas?`)) return;
    for (const link of links) window.open(link.url, "_blank", "noopener,noreferrer");
  }, []);

  const reordenarLinksDaPasta = useCallback(
    async (idPasta: string, ordemIds: string[]) => void aplicarResposta(await acaoReordenarLinks(idPasta, ordemIds)),
    [aplicarResposta],
  );

  /** Mover, favoritar, marcar lido/não lido ou excluir vários links de uma vez — a barra que aparece ao selecionar. */
  const linksEmLote = useCallback(
    async (
      ids: string[],
      acao: "mover" | "favoritar" | "lido" | "nao-lido" | "excluir",
      idPastaDestino?: string,
    ) => {
      if (acao === "excluir" && !confirm(`Excluir ${ids.length} ${ids.length === 1 ? "link" : "links"}? Vai para a lixeira.`)) return;
      const resposta =
        acao === "mover" && idPastaDestino
          ? await acaoMoverVarios(ids, idPastaDestino)
          : acao === "favoritar"
            ? await acaoFavoritarVarios(ids, true)
            : acao === "lido"
              ? await acaoMarcarVariosComoLido(ids, true)
              : acao === "nao-lido"
                ? await acaoMarcarVariosComoLido(ids, false)
                : await acaoExcluirVarios(ids);
      aplicarResposta(resposta);
    },
    [aplicarResposta],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-linha bg-superficie px-5 py-2.5">
        <Bookmark size={15} className="shrink-0 text-tinta-3" />
        <h1 className="shrink-0 text-[13px] font-bold tracking-[-0.02em]">Links</h1>
        <Link
          href="/links/atalho"
          className="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
        >
          <Link2 size={13} />
          Atalho do navegador
        </Link>
        <button
          type="button"
          onClick={() => definirImportando(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
        >
          <Import size={13} />
          Importar favoritos
        </button>
        <button
          type="button"
          onClick={exportarFavoritos}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
        >
          <Download size={13} />
          Exportar favoritos
        </button>
        <Link
          href="/links/lixeira"
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
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
        {modo === "pasta" ? (
          <ColunaLinks
            pasta={pastaAtiva}
            raiz={arvore}
            caminho={caminhoAtual}
            criandoDeUrl={criandoDeUrl}
            onAbrir={abrirLink}
            onNovo={novoLink}
            onExcluir={definirExcluindoLink}
            onFavoritar={favoritarLink}
            onVisitar={visitarLink}
            onSelecionarPasta={selecionarPasta}
            onCriarLinkRapido={criarLinkRapido}
            onAbrirTodos={abrirTodos}
            onReordenar={reordenarLinksDaPasta}
            onEmLote={linksEmLote}
          />
        ) : (
          <InicioLinks
            favoritos={favoritos}
            recentes={recentes}
            arvore={arvore}
            onAbrir={abrirLink}
            onFavoritar={favoritarLink}
            onVisitar={visitarLink}
            onSelecionarPasta={selecionarPasta}
          />
        )}
      </div>

      {linkEmEdicao ? (
        <DialogoLink
          link={linkEmEdicao === "novo" ? null : linkEmEdicao}
          aoFechar={() => definirLinkEmEdicao(null)}
          aoSalvar={async (id, campos, favicon, capa) => {
            const resposta = id
              ? await acaoAtualizarLink(id, campos, favicon, capa)
              : await acaoCriarLink(pastaAtiva.id, campos, favicon, capa);
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

      {importando ? (
        <DialogoImportarFavoritos
          raiz={arvore}
          aoFechar={() => definirImportando(false)}
          aoImportar={async (html, idPastaDestino) => {
            const resposta = await acaoImportarFavoritosHtml(html, idPastaDestino);
            if (!resposta.ok) return resposta.erro;
            definirArvore(resposta.arvore);
            definirImportando(false);
            return null;
          }}
        />
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
  // "Nova pasta" (o botão do cabeçalho, sem pasta-alvo óbvia como o menu de
  // cada pasta tem) cria dentro de onde a pessoa está agora — não sempre na
  // raiz, que fazia toda pasta nova nascer dentro de "Geral" mesmo navegando
  // fundo em outra.
  const pastaParaNovaPasta = (pastaAtivaId && encontrarPasta(raiz, pastaAtivaId)) || raiz;

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
        <BotaoIcone
          rotulo={pastaParaNovaPasta.id === raiz.id ? "Nova pasta" : `Nova pasta em ${pastaParaNovaPasta.nome}`}
          onClick={() => onCriarSubpasta(pastaParaNovaPasta)}
          className="size-6"
        >
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
          "linha-nav group flex cursor-pointer items-center gap-1.5 rounded-md pr-1 text-[12.5px] transition-colors",
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
        <span className="shrink-0 text-[10px] text-tinta-3 tabular-nums">
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

/** Favicon salvo (servido por /links/favicon/<arquivo>), ou o ícone genérico de link. */
function IconeDoLink({ link }: { link: LinkSalvo }) {
  if (link.favicon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- favicon local pequeno, não vale a pena configurar o otimizador de imagens do Next pra isso.
      <img
        src={`/links/favicon/${link.favicon}`}
        alt=""
        className="size-8 shrink-0 rounded-lg border border-linha bg-superficie-alta object-contain p-1"
      />
    );
  }
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
      <Bookmark size={14} />
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

/** `true` se o que está sendo arrastado é uma URL de fora do app (barra de endereço, link de outra página) — não uma pasta/link internos, que já têm seu próprio tipo de arrasto. */
function trazUrlExterna(evento: React.DragEvent): boolean {
  return !trazLink(evento) && !trazPastaLink(evento) && evento.dataTransfer.types.includes("text/uri-list");
}

/** Nome + ícone dos quatro jeitos de ordenar os links de uma pasta. */
const MODOS_ORDENACAO = [
  ["manual", "Manual"],
  ["nome", "Nome"],
  ["data", "Mais recente"],
  ["aberturas", "Mais aberto"],
] as const;
type ModoOrdenacao = (typeof MODOS_ORDENACAO)[number][0];

function ordenarLinks(links: LinkSalvo[], modo: ModoOrdenacao): LinkSalvo[] {
  if (modo === "manual") return links;
  const copia = [...links];
  if (modo === "nome") copia.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
  else if (modo === "data") copia.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm));
  else copia.sort((a, b) => b.aberturas - a.aberturas);
  return copia;
}

function ColunaLinks({
  pasta,
  raiz,
  caminho,
  criandoDeUrl,
  onAbrir,
  onNovo,
  onExcluir,
  onFavoritar,
  onVisitar,
  onSelecionarPasta,
  onCriarLinkRapido,
  onAbrirTodos,
  onReordenar,
  onEmLote,
}: {
  pasta: PastaLink;
  /** A árvore inteira — só pra montar as opções de "mover para" no lote. */
  raiz: PastaLink;
  /** Da raiz até esta pasta, inclusive — a trilha de navegação. */
  caminho: PastaLink[];
  criandoDeUrl: boolean;
  onAbrir: (link: LinkSalvo) => void;
  onNovo: () => void;
  onExcluir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
  onVisitar: (link: LinkSalvo) => void;
  onSelecionarPasta: (id: string) => void;
  onCriarLinkRapido: (url: string, idPasta: string) => void;
  onAbrirTodos: (links: LinkSalvo[]) => void;
  onReordenar: (idPasta: string, ordemIds: string[]) => void;
  onEmLote: (ids: string[], acao: "mover" | "favoritar" | "lido" | "nao-lido" | "excluir", idPastaDestino?: string) => void;
}) {
  const [sobreUrl, definirSobreUrl] = useState(false);
  const [selecionados, definirSelecionados] = useState<Set<string>>(new Set());
  const ultimoSelecionado = useRef<string | null>(null);
  const [verificando, definirVerificando] = useState(false);
  const [quebrados, definirQuebrados] = useState<Set<string> | null>(null);
  /** O link sob o mouse na Lista — só ali dá pra saber qual link os atalhos `o`/`e`/`f` afetam. */
  const [linkSobMouse, definirLinkSobMouse] = useState<string | null>(null);

  async function verificarLinksQuebrados() {
    definirVerificando(true);
    const resultado = await acaoVerificarLinks(pasta.links.map((link) => link.id));
    definirVerificando(false);
    definirQuebrados(new Set(Object.entries(resultado).filter(([, ok]) => !ok).map(([id]) => id)));
  }

  // Lista · Mosaico · Compacta — lembrado por pasta, mesmo padrão do toggle de visão do Kanban.
  type Visao = "lista" | "mosaico" | "compacta";
  const chaveVisao = `links-visao:${pasta.id}`;
  const [visao, definirVisaoEstado] = useState<Visao>("lista");
  useEffect(() => {
    try {
      const salva = localStorage.getItem(chaveVisao);
      definirVisaoEstado(salva === "mosaico" || salva === "compacta" ? salva : "lista");
    } catch {
      definirVisaoEstado("lista");
    }
  }, [chaveVisao]);
  function definirVisao(proxima: Visao) {
    definirVisaoEstado(proxima);
    try {
      localStorage.setItem(chaveVisao, proxima);
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }

  // A ordenação também é lembrada por pasta.
  const chaveOrdenacao = `links-ordenacao:${pasta.id}`;
  const [ordenacao, definirOrdenacaoEstado] = useState<ModoOrdenacao>("manual");
  useEffect(() => {
    try {
      const salva = localStorage.getItem(chaveOrdenacao) as ModoOrdenacao | null;
      definirOrdenacaoEstado(salva && MODOS_ORDENACAO.some(([id]) => id === salva) ? salva : "manual");
    } catch {
      definirOrdenacaoEstado("manual");
    }
  }, [chaveOrdenacao]);
  function definirOrdenacao(proxima: ModoOrdenacao) {
    definirOrdenacaoEstado(proxima);
    try {
      localStorage.setItem(chaveOrdenacao, proxima);
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }

  // Selecionar limpa sozinho ao trocar de pasta — senão a barra de lote
  // ficaria de pé com ids de uma pasta que não é mais esta. A última
  // verificação de links quebrados também não faz sentido para outra pasta.
  useEffect(() => {
    definirSelecionados(new Set());
    definirQuebrados(null);
  }, [pasta.id]);

  const linksVisiveis = useMemo(() => ordenarLinks(pasta.links, ordenacao), [pasta.links, ordenacao]);

  function selecionar(id: string, evento: React.MouseEvent) {
    definirSelecionados((atual) => {
      const proximo = new Set(atual);
      if (evento.shiftKey && ultimoSelecionado.current) {
        const ids = linksVisiveis.map((link) => link.id);
        const a = ids.indexOf(ultimoSelecionado.current);
        const b = ids.indexOf(id);
        if (a !== -1 && b !== -1) {
          for (const item of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) proximo.add(item);
        }
      } else if (proximo.has(id)) {
        proximo.delete(id);
      } else {
        proximo.add(id);
      }
      return proximo;
    });
    ultimoSelecionado.current = id;
  }
  const limparSelecao = useCallback(() => definirSelecionados(new Set()), []);
  useAtalho("escape", {
    grupo: "Links",
    descricao: "Limpar a seleção",
    ativo: selecionados.size > 0,
    acao: limparSelecao,
  });

  function reordenarComArrasto(origemId: string, alvoId: string, antes: boolean) {
    const nova = calcularNovaOrdem(linksVisiveis.map((link) => link.id), origemId, alvoId, antes);
    if (nova) onReordenar(pasta.id, nova);
  }

  const linkSobMouseObjeto = linkSobMouse ? (linksVisiveis.find((link) => link.id === linkSobMouse) ?? null) : null;
  useAtalho("o", {
    grupo: "Links",
    descricao: "Abrir o link sob o mouse",
    ativo: !!linkSobMouseObjeto,
    acao: () => {
      if (!linkSobMouseObjeto) return;
      window.open(linkSobMouseObjeto.url, "_blank", "noopener,noreferrer");
      onVisitar(linkSobMouseObjeto);
    },
  });
  useAtalho("e", {
    grupo: "Links",
    descricao: "Editar o link sob o mouse",
    ativo: !!linkSobMouseObjeto,
    acao: () => linkSobMouseObjeto && onAbrir(linkSobMouseObjeto),
  });
  useAtalho("f", {
    grupo: "Links",
    descricao: "Favoritar o link sob o mouse",
    ativo: !!linkSobMouseObjeto,
    acao: () => linkSobMouseObjeto && onFavoritar(linkSobMouseObjeto),
  });

  return (
    <div
      className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-papel"
      onDragOver={(evento) => {
        if (!trazUrlExterna(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "copy";
        definirSobreUrl(true);
      }}
      onDragLeave={() => definirSobreUrl(false)}
      onDrop={(evento) => {
        if (!trazUrlExterna(evento)) return;
        evento.preventDefault();
        definirSobreUrl(false);
        const url = evento.dataTransfer.getData("text/uri-list") || evento.dataTransfer.getData("text/plain");
        if (url) onCriarLinkRapido(url.trim(), pasta.id);
      }}
    >
      <div className="flex items-center justify-between gap-2 px-5 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <nav aria-label="Trilha de pastas" className="flex min-w-0 items-center gap-1 truncate text-[11.5px] text-tinta-3">
            {caminho.map((item, indice) => (
              <span key={item.id} className="flex min-w-0 items-center gap-1">
                {indice > 0 ? <ChevronRight size={11} className="shrink-0" /> : null}
                <button
                  type="button"
                  onClick={() => onSelecionarPasta(item.id)}
                  className={clsx(
                    "truncate hover:text-tinta hover:underline",
                    indice === caminho.length - 1 && "font-semibold text-tinta no-underline",
                  )}
                  disabled={indice === caminho.length - 1}
                >
                  {item.nome}
                </button>
              </span>
            ))}
          </nav>
          <p className="mt-0.5 text-[11px] text-tinta-3">
            {pasta.links.length === 0 ? "nenhum link" : `${pasta.links.length} ${pasta.links.length === 1 ? "link" : "links"}`}
            {criandoDeUrl ? " · salvando…" : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Menu
            gatilho={(abrir) => (
              <Botao onClick={abrir}>
                <ArrowDownUp size={13} />
                {MODOS_ORDENACAO.find(([id]) => id === ordenacao)?.[1]}
              </Botao>
            )}
          >
            {(fechar) =>
              MODOS_ORDENACAO.map(([id, rotulo]) => (
                <ItemMenu
                  key={id}
                  onClick={() => {
                    fechar();
                    definirOrdenacao(id);
                  }}
                >
                  {rotulo}
                  {ordenacao === id ? " ✓" : ""}
                </ItemMenu>
              ))
            }
          </Menu>
          <div className="flex items-center gap-0.5 rounded-lg border border-linha p-0.5" role="group" aria-label="Visão">
            {(
              [
                ["lista", "Lista", <List key="l" size={13} />],
                ["mosaico", "Mosaico", <LayoutGrid key="m" size={13} />],
                ["compacta", "Compacta", <Rows3 key="c" size={13} />],
              ] as const
            ).map(([id, rotulo, icone]) => (
              <BotaoIcone
                key={id}
                rotulo={rotulo}
                onClick={() => definirVisao(id)}
                aria-pressed={visao === id}
                className={clsx(visao === id && "bg-realce-medio text-tinta")}
              >
                {icone}
              </BotaoIcone>
            ))}
          </div>
          {pasta.links.length > 0 ? (
            <BotaoIcone rotulo={`Abrir todos · ${pasta.links.length}`} onClick={() => onAbrirTodos(pasta.links)}>
              <ExternalLink size={14} />
            </BotaoIcone>
          ) : null}
          {pasta.links.length > 0 ? (
            <BotaoIcone
              rotulo={verificando ? "Verificando…" : quebrados ? `${quebrados.size} talvez fora do ar` : "Verificar links quebrados"}
              onClick={verificarLinksQuebrados}
              className={clsx(quebrados && quebrados.size > 0 && "text-perigo")}
            >
              {verificando ? <Loader2 size={14} className="animate-spin" /> : <ShieldQuestion size={14} />}
            </BotaoIcone>
          ) : null}
          <Botao variante="primario" onClick={onNovo}>
            <Plus size={13} />
            Novo link
          </Botao>
        </div>
      </div>

      <div className={clsx("flex-1 overflow-y-auto px-4 pb-4", visao === "lista" && "lista-cartoes")}>
        {sobreUrl ? (
          <div className="mb-3 rounded-lg border-2 border-dashed border-[var(--realce)] bg-realce-fraco px-3 py-2 text-center text-[12px] text-tinta">
            Soltar para salvar aqui
          </div>
        ) : null}
        {pasta.pastas.length > 0 ? (
          <div className="mb-3">
            <p className="mb-1.5 text-[10.5px] font-medium tracking-wide text-tinta-3 uppercase">Subpastas</p>
            <div className="flex flex-wrap gap-1.5">
              {pasta.pastas.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => onSelecionarPasta(sub.id)}
                  className="flex items-center gap-1.5 rounded-lg border border-linha bg-superficie-alta px-2.5 py-1.5 text-[12px] text-tinta-2 transition-colors hover:border-linha-forte hover:text-tinta"
                >
                  <Folder size={13} className="shrink-0" style={{ color: sub.cor }} />
                  {sub.nome}
                  <span className="text-tinta-3 tabular-nums">{sub.links.length}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {pasta.links.length === 0 ? (
          <div className="pt-8">
            <Vazio
              icone={<Bookmark size={20} />}
              titulo="Nenhum link nesta pasta"
              descricao='Clique em "Novo link", cole (Ctrl+V) ou arraste uma URL aqui.'
            />
          </div>
        ) : visao === "mosaico" ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
            {linksVisiveis.map((link) => (
              <TileLink
                key={link.id}
                link={link}
                selecionado={selecionados.has(link.id)}
                onAbrir={onAbrir}
                onExcluir={onExcluir}
                onFavoritar={onFavoritar}
                onVisitar={onVisitar}
                onSelecionar={selecionar}
              />
            ))}
          </div>
        ) : visao === "compacta" ? (
          <div>
            {linksVisiveis.map((link) => (
              <LinhaLinkCompacta
                key={link.id}
                link={link}
                selecionado={selecionados.has(link.id)}
                onAbrir={onAbrir}
                onExcluir={onExcluir}
                onFavoritar={onFavoritar}
                onVisitar={onVisitar}
                onSelecionar={selecionar}
              />
            ))}
          </div>
        ) : (
          linksVisiveis.map((link) => (
            <LinhaLink
              key={link.id}
              link={link}
              selecionado={selecionados.has(link.id)}
              quebrado={quebrados?.has(link.id)}
              onAbrir={onAbrir}
              onExcluir={onExcluir}
              onFavoritar={onFavoritar}
              onVisitar={onVisitar}
              onSelecionar={selecionar}
              onArrastarSobre={ordenacao === "manual" ? reordenarComArrasto : undefined}
              onMouseEnter={() => definirLinkSobMouse(link.id)}
              onMouseLeave={() => definirLinkSobMouse((atual) => (atual === link.id ? null : atual))}
            />
          ))
        )}
      </div>

      {selecionados.size > 0 ? (
        <div
          role="toolbar"
          aria-label="Ações nos links selecionados"
          className="surgir absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-linha bg-superficie-alta px-2 py-1.5 shadow-[var(--sombra)]"
        >
          <span className="px-1.5 text-[12px] font-medium tabular-nums">
            {selecionados.size} {selecionados.size === 1 ? "selecionado" : "selecionados"}
          </span>
          <Menu
            gatilho={(abrir) => (
              <Botao onClick={abrir}>
                <Folder size={13} />
                Mover para…
              </Botao>
            )}
          >
            {(fechar) => opcoesDePastaMenu(raiz, 0, (idDestino) => {
              fechar();
              onEmLote([...selecionados], "mover", idDestino);
              limparSelecao();
            })}
          </Menu>
          <BotaoIcone
            rotulo="Favoritar"
            onClick={() => {
              onEmLote([...selecionados], "favoritar");
              limparSelecao();
            }}
          >
            <Star size={14} />
          </BotaoIcone>
          <BotaoIcone
            rotulo="Marcar como lido"
            onClick={() => {
              onEmLote([...selecionados], "lido");
              limparSelecao();
            }}
          >
            <Circle size={14} />
          </BotaoIcone>
          <BotaoIcone
            rotulo="Excluir"
            onClick={() => {
              onEmLote([...selecionados], "excluir");
              limparSelecao();
            }}
          >
            <Trash2 size={14} />
          </BotaoIcone>
          <BotaoIcone rotulo="Limpar seleção (Esc)" onClick={limparSelecao}>
            <X size={14} />
          </BotaoIcone>
        </div>
      ) : null}
    </div>
  );
}

/** A bolinha de "não lido" — mesma cor de realce em todo lugar que mostra um link. */
function PontoNaoLido() {
  return <span aria-label="Não lido" title="Não lido" className="size-1.5 shrink-0 rounded-full bg-[var(--realce)]" />;
}

/** `true` se o clique veio com modificador — nesses casos, o clique seleciona em vez de abrir o link/pasta. */
function comModificador(evento: React.MouseEvent): boolean {
  return evento.ctrlKey || evento.metaKey || evento.shiftKey;
}

const LinhaLink = memo(function LinhaLink({
  link,
  selecionado,
  quebrado,
  onAbrir,
  onExcluir,
  onFavoritar,
  onVisitar,
  onSelecionar,
  onArrastarSobre,
  onMouseEnter,
  onMouseLeave,
}: {
  link: LinkSalvo;
  selecionado?: boolean;
  /** `true` depois de "Verificar links quebrados" não achar o site no ar — nunca persistido, só da última verificação. */
  quebrado?: boolean;
  onAbrir: (link: LinkSalvo) => void;
  onExcluir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
  onVisitar: (link: LinkSalvo) => void;
  onSelecionar?: (id: string, evento: React.MouseEvent) => void;
  /** Presente só na ordenação Manual — soltar outro link aqui reordena os dois. */
  onArrastarSobre?: (origemId: string, alvoId: string, antes: boolean) => void;
  /** Rastreiam qual link está sob o mouse — usado pelos atalhos `o`/`e`/`f`. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const [sobre, definirSobre] = useState<"antes" | "depois" | null>(null);
  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeLink(evento, link.id)}
      onDragOver={(evento) => {
        if (!onArrastarSobre || !trazLink(evento)) return;
        evento.preventDefault();
        const antes = evento.clientY < evento.currentTarget.getBoundingClientRect().top + evento.currentTarget.offsetHeight / 2;
        definirSobre(antes ? "antes" : "depois");
      }}
      onDragLeave={() => definirSobre(null)}
      onDrop={(evento) => {
        if (!onArrastarSobre || !trazLink(evento)) return;
        evento.preventDefault();
        const origemId = lerIdDeLink(evento);
        definirSobre(null);
        if (origemId && origemId !== link.id) onArrastarSobre(origemId, link.id, sobre === "antes");
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={clsx(
        "cartao group relative flex items-center gap-3",
        selecionado && "ring-2 ring-[var(--realce)]",
        sobre === "antes" && "border-t-2 border-t-[var(--realce)]",
        sobre === "depois" && "border-b-2 border-b-[var(--realce)]",
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(evento) => {
          if (onSelecionar && comModificador(evento)) {
            evento.preventDefault();
            onSelecionar(link.id, evento);
            return;
          }
          onVisitar(link);
        }}
        className="flex min-w-0 flex-1 items-center gap-3"
      >
        <IconeDoLink link={link} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-tinta">
            {!link.lido ? <PontoNaoLido /> : null}
            <span className="truncate">{link.titulo}</span>
            {quebrado ? <AlertTriangle size={12} className="shrink-0 text-perigo" aria-label="Talvez esteja fora do ar" /> : null}
          </p>
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

/** Linha de uma tela de página inicial de navegador: só o essencial numa faixa de 28px — pra quem tem dezenas de links numa pasta. */
const LinhaLinkCompacta = memo(function LinhaLinkCompacta({
  link,
  selecionado,
  onAbrir,
  onExcluir,
  onFavoritar,
  onVisitar,
  onSelecionar,
}: {
  link: LinkSalvo;
  selecionado?: boolean;
  onAbrir: (link: LinkSalvo) => void;
  onExcluir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
  onVisitar: (link: LinkSalvo) => void;
  onSelecionar?: (id: string, evento: React.MouseEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeLink(evento, link.id)}
      className={clsx(
        "linha-nav group flex items-center gap-2 rounded-md px-1.5 hover:bg-realce-fraco",
        selecionado && "ring-2 ring-[var(--realce)]",
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(evento) => {
          if (onSelecionar && comModificador(evento)) {
            evento.preventDefault();
            onSelecionar(link.id, evento);
            return;
          }
          onVisitar(link);
        }}
        className="flex min-w-0 flex-1 items-center gap-2"
      >
        {link.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element -- favicon local pequeno, não vale a pena o otimizador de imagens do Next pra isso.
          <img src={`/links/favicon/${link.favicon}`} alt="" className="size-4 shrink-0 rounded object-contain" />
        ) : (
          <Bookmark size={12} className="shrink-0 text-tinta-3" />
        )}
        {!link.lido ? <PontoNaoLido /> : null}
        <p className="min-w-0 flex-1 truncate text-[12.5px] text-tinta">{link.titulo}</p>
        <p className="shrink-0 truncate text-[11px] text-tinta-3">{dominioDaUrl(link.url)}</p>
      </a>
      <BotaoIcone
        rotulo={link.favorito ? "Tirar dos favoritos" : "Marcar como favorito"}
        onClick={() => onFavoritar(link)}
        className={clsx("size-6 shrink-0", !link.favorito && "opacity-0 group-hover:opacity-100")}
      >
        <Star size={12} className={link.favorito ? "fill-current text-[var(--realce)]" : undefined} />
      </BotaoIcone>
      <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
        <BotaoIcone rotulo="Editar" onClick={() => onAbrir(link)} className="size-6">
          <Pencil size={12} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={() => onExcluir(link)} className="size-6">
          <Trash2 size={12} />
        </BotaoIcone>
      </div>
    </div>
  );
});

/** Um quadrado de ~120px com o favicon grande no centro — o formato de página inicial de navegador, pra achar o link certo em meio segundo. */
const TileLink = memo(function TileLink({
  link,
  selecionado,
  onAbrir,
  onExcluir,
  onFavoritar,
  onVisitar,
  onSelecionar,
}: {
  link: LinkSalvo;
  selecionado?: boolean;
  onAbrir: (link: LinkSalvo) => void;
  /** Ausente na tela inicial e na busca (que atravessam pastas — excluir dali ficaria ambíguo sobre em qual pasta). */
  onExcluir?: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
  onVisitar: (link: LinkSalvo) => void;
  onSelecionar?: (id: string, evento: React.MouseEvent) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeLink(evento, link.id)}
      className={clsx(
        "cartao group relative flex flex-col items-center gap-2 px-3 py-4 text-center",
        selecionado && "ring-2 ring-[var(--realce)]",
      )}
    >
      <a
        href={link.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(evento) => {
          if (onSelecionar && comModificador(evento)) {
            evento.preventDefault();
            onSelecionar(link.id, evento);
            return;
          }
          onVisitar(link);
        }}
        className="flex flex-col items-center gap-2"
      >
        {link.capa ? (
          // eslint-disable-next-line @next/next/no-img-element -- capa local, não vale a pena o otimizador de imagens do Next pra isso.
          <img
            src={`/links/capa/${link.capa}`}
            alt=""
            className="-mx-3 -mt-4 mb-0.5 h-16 w-[calc(100%+1.5rem)] rounded-t-[11px] object-cover"
          />
        ) : null}
        {link.favicon ? (
          // eslint-disable-next-line @next/next/no-img-element -- favicon local pequeno, não vale a pena o otimizador de imagens do Next pra isso.
          <img
            src={`/links/favicon/${link.favicon}`}
            alt=""
            className="size-8 rounded-lg border border-linha bg-superficie-alta object-contain p-1"
          />
        ) : (
          <div className="flex size-8 items-center justify-center rounded-lg bg-realce-medio text-[var(--realce)]">
            <Bookmark size={15} />
          </div>
        )}
        <div className="min-w-0">
          <p className="flex items-center justify-center gap-1 line-clamp-2 text-[12px] leading-tight font-medium text-tinta">
            {!link.lido ? <PontoNaoLido /> : null}
            {link.titulo}
          </p>
          <p className="mt-0.5 truncate text-[10.5px] text-tinta-3">{dominioDaUrl(link.url)}</p>
        </div>
      </a>
      {/* Faixa de ações no rodapé do cartão, não em cima do favicon/capa
          (era ali antes e tampava o ícone) — some enquanto não tem hover,
          com um fundo próprio pra não brigar com o domínio atrás dela. */}
      <div
        className={clsx(
          "absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 rounded-b-[11px] px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100",
          "bg-gradient-to-t from-[var(--superficie-alta)] from-40% to-transparent",
        )}
      >
        <div className="flex shrink-0 items-center">
          <BotaoIcone rotulo="Editar" onClick={() => onAbrir(link)} className="size-6">
            <Pencil size={11} />
          </BotaoIcone>
          {onExcluir ? (
            <BotaoIcone rotulo="Excluir" onClick={() => onExcluir(link)} className="size-6">
              <Trash2 size={11} />
            </BotaoIcone>
          ) : null}
        </div>
        <BotaoIcone
          rotulo={link.favorito ? "Tirar dos favoritos" : "Marcar como favorito"}
          onClick={() => onFavoritar(link)}
          className="size-6 shrink-0"
        >
          <Star size={12} className={link.favorito ? "fill-current text-[var(--realce)]" : undefined} />
        </BotaoIcone>
      </div>
      {link.favorito ? (
        <Star
          size={12}
          aria-hidden
          className="absolute top-1.5 right-1.5 fill-current text-[var(--realce)] opacity-100 transition-opacity group-hover:opacity-0"
        />
      ) : null}
    </div>
  );
});

const CHAVE_ORDEM_INICIO = "links-ordem-inicio";
const LIMITE_POR_PASTA = 10;

/** A ordem dos grupos da tela inicial, lembrada entre sessões — pastas novas entram no fim, pastas removidas somem sozinhas. */
function useOrdemDosGrupos(idsAtuais: string[]) {
  const [ordem, definirOrdemEstado] = useState<string[]>(idsAtuais);

  useEffect(() => {
    let salva: string[] = [];
    try {
      const bruto = localStorage.getItem(CHAVE_ORDEM_INICIO);
      salva = bruto ? (JSON.parse(bruto) as string[]) : [];
    } catch {
      salva = [];
    }
    const doConjuntoAtual = new Set(idsAtuais);
    const preservados = salva.filter((id) => doConjuntoAtual.has(id));
    const novos = idsAtuais.filter((id) => !preservados.includes(id));
    definirOrdemEstado([...preservados, ...novos]);
    // Só na primeira vez que a lista de grupos possíveis é conhecida — depois
    // disso quem manda na ordem é `mover`, não o efeito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsAtuais.join(",")]);

  function mover(id: string, direcao: -1 | 1) {
    definirOrdemEstado((atual) => {
      const indice = atual.indexOf(id);
      const alvo = indice + direcao;
      if (indice === -1 || alvo < 0 || alvo >= atual.length) return atual;
      const proximo = [...atual];
      [proximo[indice], proximo[alvo]] = [proximo[alvo], proximo[indice]];
      try {
        localStorage.setItem(CHAVE_ORDEM_INICIO, JSON.stringify(proximo));
      } catch {
        // Sem armazenamento: a ordem vale só para esta sessão.
      }
      return proximo;
    });
  }

  return { ordem, mover };
}

type GrupoInicio = {
  id: string;
  titulo: string;
  icone: React.ReactNode;
  links: LinkComPasta[];
  /** Presente só nos grupos de pasta — "ver todos" leva até ela. */
  pastaId?: string;
};

/**
 * Tela inicial da app: favoritos, recentes e depois um grupo por pasta de
 * primeiro nível (os 10 links mais recentes dela, com "ver todos" pra
 * entrar de vez) — assim dá pra ver o máximo de links possível sem abrir
 * pasta nenhuma. A ordem dos grupos é reorganizável (setas no cabeçalho) e
 * fica lembrada entre sessões.
 */
function InicioLinks({
  favoritos,
  recentes,
  arvore,
  onAbrir,
  onFavoritar,
  onVisitar,
  onSelecionarPasta,
}: {
  favoritos: LinkComPasta[];
  recentes: LinkComPasta[];
  arvore: PastaLink;
  onAbrir: (link: LinkSalvo) => void;
  onFavoritar: (link: LinkSalvo) => void;
  onVisitar: (link: LinkSalvo) => void;
  onSelecionarPasta: (id: string) => void;
}) {
  const grupos = useMemo<GrupoInicio[]>(() => {
    const lista: GrupoInicio[] = [];
    if (favoritos.length > 0) lista.push({ id: "favoritos", titulo: "Favoritos", icone: <Star size={12} />, links: favoritos });
    if (recentes.length > 0) lista.push({ id: "recentes", titulo: "Recentes", icone: null, links: recentes });
    // A raiz também é "uma pasta" pra quem usa o app — aparece na árvore
    // lateral com nome e ícone próprios, e pode ter links direto nela
    // (sem entrar em nenhuma subpasta). Por isso entra na lista junto com
    // as subpastas de primeiro nível, não só elas.
    for (const pasta of [arvore, ...arvore.pastas]) {
      if (pasta.links.length === 0) continue;
      const links = [...pasta.links]
        .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
        .map((link) => ({ ...link, pastaId: pasta.id }));
      lista.push({ id: pasta.id, titulo: pasta.nome, icone: <span aria-hidden>{pasta.icone}</span>, links, pastaId: pasta.id });
    }
    return lista;
  }, [favoritos, recentes, arvore]);

  const idsAtuais = useMemo(() => grupos.map((g) => g.id), [grupos]);
  const { ordem, mover } = useOrdemDosGrupos(idsAtuais);
  const gruposNaOrdem = ordem.map((id) => grupos.find((g) => g.id === id)).filter((g): g is GrupoInicio => Boolean(g));

  if (grupos.length === 0) {
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
      {gruposNaOrdem.map((grupo, indice) => {
        const visiveis = grupo.pastaId ? grupo.links.slice(0, LIMITE_POR_PASTA) : grupo.links;
        return (
          <section key={grupo.id} className="group/grupo">
            <div className="mb-2 flex items-center gap-1.5">
              <h2 className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
                {grupo.icone}
                {grupo.titulo} · {grupo.links.length}
              </h2>
              <div className="flex items-center opacity-0 transition-opacity group-hover/grupo:opacity-100">
                <BotaoIcone
                  rotulo="Mover para cima"
                  onClick={() => mover(grupo.id, -1)}
                  className="size-5"
                  disabled={indice === 0}
                >
                  <ChevronUp size={12} />
                </BotaoIcone>
                <BotaoIcone
                  rotulo="Mover para baixo"
                  onClick={() => mover(grupo.id, 1)}
                  className="size-5"
                  disabled={indice === gruposNaOrdem.length - 1}
                >
                  <ChevronDown size={12} />
                </BotaoIcone>
              </div>
              {grupo.pastaId && grupo.links.length > LIMITE_POR_PASTA ? (
                <button
                  type="button"
                  onClick={() => onSelecionarPasta(grupo.pastaId!)}
                  className="ml-auto flex shrink-0 items-center gap-1 text-[11px] text-tinta-3 hover:text-tinta"
                >
                  Ver todos
                  <ArrowRight size={11} />
                </button>
              ) : null}
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(108px,1fr))] gap-2.5">
              {visiveis.map((link) => (
                <TileLink key={link.id} link={link} onAbrir={onAbrir} onFavoritar={onFavoritar} onVisitar={onVisitar} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/** Opções indentadas de um `<select>`, uma por pasta em qualquer profundidade — usado no importador. */
function opcoesDePasta(pasta: PastaLink, profundidade: number): React.ReactNode[] {
  const prefixo = "  ".repeat(profundidade);
  return [
    <option key={pasta.id} value={pasta.id}>
      {prefixo}
      {pasta.icone} {pasta.nome}
    </option>,
    ...pasta.pastas.flatMap((sub) => opcoesDePasta(sub, profundidade + 1)),
  ];
}

/** A mesma árvore de pastas, mas como itens de `Menu` clicáveis — usado no "Mover para…" do lote. */
function opcoesDePastaMenu(pasta: PastaLink, profundidade: number, aoEscolher: (id: string) => void): React.ReactNode[] {
  return [
    <ItemMenu
      key={pasta.id}
      icone={<span style={{ paddingLeft: profundidade * 12 }}>{pasta.icone}</span>}
      onClick={() => aoEscolher(pasta.id)}
    >
      {pasta.nome}
    </ItemMenu>,
    ...pasta.pastas.flatMap((sub) => opcoesDePastaMenu(sub, profundidade + 1, aoEscolher)),
  ];
}

function DialogoImportarFavoritos({
  raiz,
  aoFechar,
  aoImportar,
}: {
  raiz: PastaLink;
  aoFechar: () => void;
  aoImportar: (html: string, idPastaDestino: string) => Promise<string | null>;
}) {
  const [arquivo, definirArquivo] = useState<File | null>(null);
  const [pastaDestino, definirPastaDestino] = useState(raiz.id);
  const [importando, definirImportandoAgora] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function importar() {
    if (!arquivo) {
      definirErro("Escolha o arquivo .html exportado do navegador.");
      return;
    }
    definirImportandoAgora(true);
    const html = await arquivo.text();
    const falha = await aoImportar(html, pastaDestino);
    definirImportandoAgora(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo
      titulo="Importar favoritos"
      descricao="Um arquivo .html exportado do Chrome, Firefox ou outro navegador — pastas e links entram dentro da pasta escolhida abaixo."
      aberto
      aoFechar={aoFechar}
    >
      <div className="space-y-3">
        <details className="rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[12px] text-tinta-2">
          <summary className="cursor-pointer font-medium text-tinta">Como exportar do navegador</summary>
          <ul className="mt-2 space-y-1.5">
            <li>
              <strong className="text-tinta">Chrome:</strong> menu ⋮ → Favoritos → Gerenciador de favoritos → menu ⋮
              no topo do gerenciador → Exportar favoritos.
            </li>
            <li>
              <strong className="text-tinta">Firefox:</strong> menu ≡ → Favoritos → Gerenciar favoritos (abre a
              Biblioteca) → Importar e Backup → Exportar favoritos para HTML.
            </li>
            <li>
              <strong className="text-tinta">Edge:</strong> menu ⋯ → Favoritos → Gerenciar favoritos → menu ⋯ no
              topo → Exportar favoritos.
            </li>
          </ul>
        </details>
        <div>
          <Rotulo>Arquivo</Rotulo>
          <input
            type="file"
            accept=".html,text/html"
            onChange={(evento) => definirArquivo(evento.target.files?.[0] ?? null)}
            className="block w-full text-[12.5px] text-tinta-2 file:mr-3 file:rounded-md file:border file:border-linha file:bg-superficie-alta file:px-3 file:py-1.5 file:text-[12px] file:font-medium file:text-tinta hover:file:bg-realce-fraco"
          />
        </div>
        <div>
          <Rotulo>Pasta de destino</Rotulo>
          <select
            value={pastaDestino}
            onChange={(evento) => definirPastaDestino(evento.target.value)}
            className="h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] text-tinta focus:border-[var(--realce)] focus:outline-none"
          >
            {opcoesDePasta(raiz, 0)}
          </select>
        </div>
        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao variante="primario" onClick={importar} disabled={importando}>
            {importando ? "Importando…" : "Importar"}
          </Botao>
        </div>
      </div>
    </Dialogo>
  );
}

type CamposLink = { titulo: string; url: string; nota: string; favorito: boolean };
type FaviconBuscado = { base64: string; tipo: string } | null;

function DialogoLink({
  link,
  aoFechar,
  aoSalvar,
}: {
  link: LinkSalvo | null;
  aoFechar: () => void;
  aoSalvar: (id: string | null, campos: CamposLink, favicon?: FaviconBuscado, capa?: FaviconBuscado) => Promise<void>;
}) {
  const [campos, definirCampos] = useState<CamposLink>({
    titulo: link?.titulo ?? "",
    url: link?.url ?? "",
    nota: link?.nota ?? "",
    favorito: link?.favorito ?? false,
  });
  const [salvando, definirSalvando] = useState(false);
  const [buscando, definirBuscando] = useState(false);
  // `undefined` = não mexeu no favicon/capa (mantém o que já tinha, se houver);
  // `null`/objeto = resultado de uma busca (mesmo sem sucesso, já tentou).
  const [favicon, definirFavicon] = useState<FaviconBuscado | undefined>(undefined);
  const [capa, definirCapa] = useState<FaviconBuscado | undefined>(undefined);
  const urlOriginal = useRef(link?.url ?? "");
  const [duplicado, definirDuplicado] = useState<{ id: string; titulo: string; pastaNome: string } | null>(null);

  async function buscarMetadados() {
    const url = campos.url.trim();
    if (!url || url === urlOriginal.current) return;
    definirBuscando(true);
    const [resultado, achadoDuplicado] = await Promise.all([
      acaoBuscarMetadadosUrl(url),
      acaoAcharDuplicado(url, link?.id),
    ]);
    definirBuscando(false);
    definirFavicon(resultado.favicon);
    definirCapa(resultado.capa);
    definirDuplicado(achadoDuplicado);
    definirCampos((atual) => ({
      ...atual,
      titulo: atual.titulo.trim() || resultado.titulo || atual.titulo,
      nota: atual.nota.trim() || resultado.descricao || atual.nota,
    }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    await aoSalvar(link?.id ?? null, campos, favicon, capa);
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
            onBlur={buscarMetadados}
            placeholder="https://…"
          />
          {buscando ? <p className="mt-1 text-[11.5px] text-tinta-3">Buscando título e ícone…</p> : null}
          {duplicado ? (
            <p className="mt-1 text-[11.5px] text-[#F5822C]">
              Já está em <strong>{duplicado.pastaNome}</strong> — &ldquo;{duplicado.titulo}&rdquo;. Pode adicionar mesmo assim.
            </p>
          ) : null}
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
