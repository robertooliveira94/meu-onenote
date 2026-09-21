"use client";

import clsx from "clsx";
import {
  Bookmark,
  CornerDownLeft,
  FileText,
  Folder,
  HeartPulse,
  KanbanSquare,
  Palette,
  Rows3,
  Search,
  ShoppingCart,
  SquareArrowOutUpRight,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { acaoBuscar } from "@/app/acoes";
import { acaoBuscarTarefas } from "@/app/acoes-kanban";
import { acaoBuscarProdutos } from "@/app/acoes-compras";
import { acaoBuscarLinks } from "@/app/acoes-links";
import { acaoBuscarEventosSaude } from "@/app/acoes-saude";
import { partesDoCombo, useExecutarAtalho, useListaDeAtalhos } from "@/lib/atalhos";
import type { ProdutoAchado } from "@/lib/compras-app";
import type { TarefaAchada } from "@/lib/kanban";
import type { EventoAchado } from "@/lib/saude-app";
import { ROTULO_STATUS, ROTULO_TIPO, formatarDataSaude } from "@/lib/saude-comum";
import { DENSIDADES, useDensidade } from "@/lib/densidade";
import { usePaleta } from "@/lib/paleta";
import { urlDaNota, urlDaPastaLink, urlDaSecao, urlDoQuadro } from "@/lib/rotas";
import { TEMAS, useTema } from "@/lib/tema";
import type { Caderno, Etiqueta, Link, PastaLink, ResultadoBusca, ResumoQuadro } from "@/lib/tipos";

/** Sem acento e sem caixa, do jeito que a pessoa digita com pressa. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Marca as ocorrências do termo no trecho, preservando o texto original. */
function destacar(texto: string, termo: string): React.ReactNode {
  const procurado = normalizar(termo.trim());
  if (procurado.length < 2) return texto;
  const base = normalizar(texto);
  const partes: React.ReactNode[] = [];
  let cursor = 0;
  for (;;) {
    const posicao = base.indexOf(procurado, cursor);
    if (posicao < 0) break;
    if (posicao > cursor) partes.push(texto.slice(cursor, posicao));
    partes.push(
      <mark key={posicao} className="marca-busca text-tinta">
        {texto.slice(posicao, posicao + procurado.length)}
      </mark>,
    );
    cursor = posicao + procurado.length;
  }
  partes.push(texto.slice(cursor));
  return partes;
}

type Secao = "Ações" | "Ir para" | "Notas" | "Tarefas" | "Links" | "Compras" | "Saúde";

type Item = {
  id: string;
  secao: Secao;
  icone: React.ReactNode;
  titulo: React.ReactNode;
  detalhe?: React.ReactNode;
  /** Combo do atalho, desenhado à direita quando existe. */
  combo?: string;
  extra?: React.ReactNode;
  executar: () => void;
};

/**
 * Prefixo no começo do texto restringe a uma seção só — o `>` do VS Code,
 * o resto por analogia. Mostrado como dica no rodapé.
 */
const PREFIXOS: Record<string, Secao> = { ">": "Ações", "#": "Notas", "@": "Tarefas", "!": "Links", "$": "Compras", "+": "Saúde" };

function lerPrefixo(texto: string): { secao: Secao | null; termo: string } {
  const prefixo = texto[0];
  if (prefixo && PREFIXOS[prefixo]) return { secao: PREFIXOS[prefixo], termo: texto.slice(1) };
  return { secao: null, termo: texto };
}

/** Achata a árvore de pastas de links com a trilha até cada uma. */
function pastasDeLinks(raiz: PastaLink, trilha: string[] = []): { id: string; nome: string; trilha: string }[] {
  const aqui = { id: raiz.id, nome: raiz.nome, trilha: trilha.join(" › ") };
  return [aqui, ...raiz.pastas.flatMap((sub) => pastasDeLinks(sub, [...trilha, raiz.nome]))];
}

/**
 * A paleta de comandos: uma caixa só que acha (notas, tarefas, links,
 * cadernos, quadros, pastas) e faz (as ações e atalhos da tela atual, trocar
 * tema, abrir em nova janela). Cresceu da busca de notas — que continua aqui
 * dentro como uma das seções.
 */
export function PaletaComandos({
  cadernos,
  quadros,
  etiquetas,
  linksRaiz,
}: {
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  etiquetas: Etiqueta[];
  linksRaiz: PastaLink;
}) {
  const { aberta, termoInicial, fechar } = usePaleta();
  const roteador = useRouter();
  const { tema, mudar: mudarTema } = useTema();
  const { densidade, mudar: mudarDensidade } = useDensidade();
  const atalhos = useListaDeAtalhos();
  const executarAtalho = useExecutarAtalho();

  const [texto, definirTexto] = useState("");
  const [notas, definirNotas] = useState<ResultadoBusca[]>([]);
  const [tarefas, definirTarefas] = useState<TarefaAchada[]>([]);
  const [links, definirLinks] = useState<(Link & { pastaId: string })[]>([]);
  const [produtos, definirProdutos] = useState<ProdutoAchado[]>([]);
  const [eventosSaude, definirEventosSaude] = useState<EventoAchado[]>([]);
  const [selecionado, definirSelecionado] = useState(0);
  const [buscando, definirBuscando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberta) {
      definirTexto(termoInicial);
      definirNotas([]);
      definirTarefas([]);
      definirLinks([]);
      definirProdutos([]);
      definirEventosSaude([]);
      definirSelecionado(0);
      requestAnimationFrame(() => campo.current?.focus());
    }
  }, [aberta, termoInicial]);

  const { secao: secaoForcada, termo } = lerPrefixo(texto);
  const termoLimpo = termo.trim();
  const buscaNoServidor = termoLimpo.length >= 2;

  // As buscas de servidor saem juntas, depois que a digitação parar.
  useEffect(() => {
    if (!aberta || !buscaNoServidor) {
      definirNotas([]);
      definirTarefas([]);
      definirLinks([]);
      definirProdutos([]);
      definirEventosSaude([]);
      definirBuscando(false);
      return;
    }
    definirBuscando(true);
    const espera = setTimeout(async () => {
      const quer = (s: Secao) => secaoForcada === null || secaoForcada === s;
      const [n, t, l, p, s] = await Promise.all([
        quer("Notas") ? acaoBuscar(termoLimpo) : Promise.resolve([]),
        quer("Tarefas") ? acaoBuscarTarefas(termoLimpo) : Promise.resolve([]),
        quer("Links") ? acaoBuscarLinks(termoLimpo) : Promise.resolve([]),
        quer("Compras") ? acaoBuscarProdutos(termoLimpo) : Promise.resolve([]),
        quer("Saúde") ? acaoBuscarEventosSaude(termoLimpo) : Promise.resolve([]),
      ]);
      definirNotas(n.slice(0, 8));
      definirTarefas(t);
      definirLinks(l.slice(0, 6));
      definirProdutos(p.slice(0, 6));
      definirEventosSaude(s.slice(0, 6));
      definirSelecionado(0);
      definirBuscando(false);
    }, 220);
    return () => clearTimeout(espera);
  }, [termoLimpo, buscaNoServidor, secaoForcada, aberta]);

  const itens = useMemo<Item[]>(() => {
    // Cada palavra digitada precisa aparecer em algum lugar do texto do item
    // ("tema sé" acha "Trocar tema: Sépia"; "trab proj" acha "Trabalho › Projetos").
    const palavras = normalizar(termoLimpo).split(/\s+/).filter(Boolean);
    const casa = (...textos: string[]) => {
      if (palavras.length === 0) return true;
      const base = normalizar(textos.join(" "));
      return palavras.every((palavra) => base.includes(palavra));
    };
    const quer = (s: Secao) => secaoForcada === null || secaoForcada === s;
    const todos: Item[] = [];

    if (quer("Ações")) {
      for (const grupo of atalhos) {
        for (const atalho of grupo.atalhos) {
          if (atalho.combo === "?" || atalho.combo === "ctrl+k" || atalho.combo === "/") continue;
          if (!casa(atalho.descricao, grupo.grupo)) continue;
          todos.push({
            id: `atalho:${atalho.combo}`,
            secao: "Ações",
            icone: <Zap size={14} />,
            titulo: destacar(atalho.descricao, termoLimpo),
            detalhe: grupo.grupo,
            combo: atalho.combo,
            executar: () => executarAtalho(atalho.combo),
          });
        }
      }
      for (const opcao of TEMAS) {
        const rotulo = `Trocar tema: ${opcao.nome}`;
        if (opcao.id === tema || !casa(rotulo, "tema")) continue;
        todos.push({
          id: `tema:${opcao.id}`,
          secao: "Ações",
          icone: <Palette size={14} />,
          titulo: destacar(rotulo, termoLimpo),
          executar: () => mudarTema(opcao.id),
        });
      }
      for (const opcao of DENSIDADES) {
        const rotulo = `Densidade: ${opcao.nome}`;
        if (opcao.id === densidade || !casa(rotulo, "densidade")) continue;
        todos.push({
          id: `densidade:${opcao.id}`,
          secao: "Ações",
          icone: <Rows3 size={14} />,
          titulo: destacar(rotulo, termoLimpo),
          executar: () => mudarDensidade(opcao.id),
        });
      }
      for (const [nome, href] of [
        ["Anotações", "/"],
        ["Kanban", "/kanban"],
        ["Senhas", "/senhas"],
        ["Links", "/links"],
        ["Compras", "/compras"],
        ["Saúde", "/saude"],
      ] as const) {
        const rotulo = `Abrir ${nome} em nova janela`;
        if (!casa(rotulo, "janela")) continue;
        todos.push({
          id: `janela:${href}`,
          secao: "Ações",
          icone: <SquareArrowOutUpRight size={14} />,
          titulo: destacar(rotulo, termoLimpo),
          executar: () => window.open(href, "_blank"),
        });
      }
    }

    if (quer("Ir para")) {
      const fixas: [string, string, React.ReactNode][] = [
        ["Início das Anotações", "/", <FileText key="i" size={14} />],
        ["Etiquetas", "/etiquetas", <FileText key="e" size={14} />],
        ["Grafo", "/grafo", <FileText key="g" size={14} />],
        ["Tarefas das anotações", "/tarefas", <FileText key="t" size={14} />],
        ["Modelos", "/modelos", <FileText key="m" size={14} />],
        ["Web Clipper", "/clipper", <FileText key="w" size={14} />],
        ["Lixeira das anotações", "/lixeira", <FileText key="l" size={14} />],
        ["Hoje (Kanban)", "/kanban/hoje", <KanbanSquare key="kh" size={14} />],
        ["Etiquetas do Kanban", "/kanban/etiquetas", <KanbanSquare key="ke" size={14} />],
        ["Senhas", "/senhas", <FileText key="s" size={14} />],
        ["Links", "/links", <Bookmark key="lk" size={14} />],
        ["Lixeira dos links", "/links/lixeira", <Bookmark key="ll" size={14} />],
        ["Atalho do navegador (Links)", "/links/atalho", <Bookmark key="la" size={14} />],
        ["Compras", "/compras", <ShoppingCart key="c" size={14} />],
        ["Novo produto (Compras)", "/compras?novo=1", <ShoppingCart key="cn" size={14} />],
        ["Saúde", "/saude", <HeartPulse key="sa" size={14} />],
      ];
      for (const [rotulo, href, icone] of fixas) {
        if (!casa(rotulo)) continue;
        todos.push({ id: `ir:${href}`, secao: "Ir para", icone, titulo: destacar(rotulo, termoLimpo), executar: () => roteador.push(href) });
      }
      for (const caderno of cadernos) {
        for (const secao of caderno.secoes) {
          if (!casa(caderno.nome, secao.nome, `${caderno.nome} ${secao.nome}`)) continue;
          todos.push({
            id: `secao:${secao.caminho}`,
            secao: "Ir para",
            icone: <span className="size-2.5 rounded-sm" style={{ background: caderno.cor }} aria-hidden />,
            titulo: destacar(secao.nome, termoLimpo),
            detalhe: `Caderno ${caderno.nome}`,
            executar: () => roteador.push(urlDaSecao(secao.caminho)),
          });
        }
      }
      for (const quadro of quadros) {
        if (!casa(quadro.nome, "quadro")) continue;
        todos.push({
          id: `quadro:${quadro.nome}`,
          secao: "Ir para",
          icone: <span className="size-2.5 rounded-sm" style={{ background: quadro.cor }} aria-hidden />,
          titulo: destacar(quadro.nome, termoLimpo),
          detalhe: "Quadro do Kanban",
          executar: () => roteador.push(urlDoQuadro(quadro.nome)),
        });
      }
      for (const pasta of pastasDeLinks(linksRaiz)) {
        if (!casa(pasta.nome, "pasta")) continue;
        todos.push({
          id: `pasta:${pasta.id}`,
          secao: "Ir para",
          icone: <Folder size={14} />,
          titulo: destacar(pasta.nome, termoLimpo),
          detalhe: pasta.trilha ? `Pasta de links · ${pasta.trilha}` : "Pasta de links",
          executar: () => roteador.push(urlDaPastaLink(pasta.id)),
        });
      }
    }

    for (const nota of notas) {
      const cores = nota.etiquetas
        .map((id) => etiquetas.find((e) => e.id === id))
        .filter((e): e is Etiqueta => Boolean(e))
        .slice(0, 3);
      todos.push({
        id: `nota:${nota.caminho}`,
        secao: "Notas",
        icone: <FileText size={14} />,
        titulo: destacar(nota.titulo, termoLimpo),
        detalhe: (
          <>
            <span className="block truncate">{destacar(nota.trecho, termoLimpo)}</span>
            <span className="block truncate text-tinta-3">{nota.caminho.split("/").slice(0, -1).join(" › ")}</span>
          </>
        ),
        extra:
          cores.length > 0 ? (
            <span className="flex gap-1">
              {cores.map((e) => (
                <span key={e.id} title={e.nome} className="size-2 rounded-full" style={{ background: e.cor }} />
              ))}
            </span>
          ) : undefined,
        executar: () => roteador.push(urlDaNota(nota.caminho)),
      });
    }
    for (const tarefa of tarefas) {
      todos.push({
        id: `tarefa:${tarefa.caminho}`,
        secao: "Tarefas",
        icone: <KanbanSquare size={14} />,
        titulo: destacar(tarefa.titulo, termoLimpo),
        detalhe: `${tarefa.quadro} › ${tarefa.coluna}`,
        executar: () => roteador.push(urlDoQuadro(tarefa.quadro)),
      });
    }
    for (const link of links) {
      todos.push({
        id: `link:${link.id}`,
        secao: "Links",
        icone: <Bookmark size={14} />,
        titulo: destacar(link.titulo, termoLimpo),
        detalhe: link.url,
        executar: () => window.open(link.url, "_blank", "noopener,noreferrer"),
      });
    }
    for (const evento of eventosSaude) {
      todos.push({
        id: `saude:${evento.id}`,
        secao: "Saúde",
        icone: <HeartPulse size={14} />,
        titulo: destacar(evento.titulo, termoLimpo),
        detalhe: [ROTULO_TIPO[evento.tipo], evento.pessoa, evento.especialidade, evento.profissional, formatarDataSaude(evento.data), ROTULO_STATUS[evento.status]]
          .filter(Boolean)
          .join(" · "),
        executar: () => roteador.push(`/saude?evento=${encodeURIComponent(evento.id)}`),
      });
    }
    for (const produto of produtos) {
      todos.push({
        id: `produto:${produto.id}`,
        secao: "Compras",
        icone: <ShoppingCart size={14} />,
        titulo: destacar(produto.nome, termoLimpo),
        detalhe: [produto.modelo, produto.categoria, produto.estado === "quero" ? null : produto.estado === "comprado" ? "comprado" : "desisti"]
          .filter(Boolean)
          .join(" · "),
        executar: () => roteador.push(`/compras?produto=${encodeURIComponent(produto.id)}`),
      });
    }
    return todos;
  }, [termoLimpo, secaoForcada, atalhos, executarAtalho, tema, mudarTema, densidade, mudarDensidade, cadernos, quadros, linksRaiz, notas, tarefas, links, produtos, eventosSaude, etiquetas, roteador]);

  useEffect(() => {
    definirSelecionado(0);
  }, [texto]);

  useEffect(() => {
    lista.current?.querySelector('[data-selecionado="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selecionado, itens]);

  if (!aberta) return null;

  function rodar(item: Item) {
    fechar();
    item.executar();
  }

  function aoTeclar(evento: React.KeyboardEvent) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      definirSelecionado((atual) => Math.min(atual + 1, Math.max(itens.length - 1, 0)));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      definirSelecionado((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === "Enter" && itens[selecionado]) {
      evento.preventDefault();
      rodar(itens[selecionado]);
    } else if (evento.key === "Escape") {
      fechar();
    }
  }

  const secoesNaOrdem: Secao[] = ["Ações", "Ir para", "Notas", "Tarefas", "Links", "Compras", "Saúde"];
  const vazio = !buscando && itens.length === 0;
  const placeholder =
    secaoForcada === null
      ? "Buscar ou fazer qualquer coisa…"
      : secaoForcada === "Ações"
        ? "Que ação?"
        : `Buscar em ${secaoForcada.toLowerCase()}…`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#1c232b40] p-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) fechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
        className="surgir w-full max-w-xl overflow-hidden rounded-xl border border-linha bg-superficie-alta shadow-[var(--sombra)]"
      >
        <div className="flex items-center gap-2.5 border-b border-linha px-4">
          <Search size={15} className="shrink-0 text-tinta-3" />
          <input
            ref={campo}
            autoFocus
            value={texto}
            onChange={(evento) => definirTexto(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder={placeholder}
            className="h-11 flex-1 border-0 bg-transparent text-[14px] text-tinta placeholder:text-tinta-3 focus:ring-0 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-linha px-1.5 py-0.5 font-mono text-[10px] text-tinta-3">esc</kbd>
        </div>

        <div ref={lista} className="max-h-[56vh] overflow-y-auto p-1.5">
          {vazio ? (
            <p className="px-3 py-4 text-[12.5px] text-tinta-3">
              {buscaNoServidor ? `Nada encontrado para “${termoLimpo}”.` : "Nada por aqui."}
            </p>
          ) : null}
          {secoesNaOrdem.map((secao) => {
            const daSecao = itens.filter((item) => item.secao === secao);
            if (daSecao.length === 0) return null;
            return (
              <div key={secao} className="mb-1">
                <div className="px-2.5 pt-2 pb-1 text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
                  {secao}
                  {buscando && ["Notas", "Tarefas", "Links", "Compras", "Saúde"].includes(secao) ? " · buscando…" : ""}
                </div>
                {daSecao.map((item) => {
                  const posicao = itens.indexOf(item);
                  const ativo = posicao === selecionado;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-selecionado={ativo}
                      onMouseMove={() => definirSelecionado(posicao)}
                      onClick={() => rodar(item)}
                      className={clsx(
                        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left",
                        ativo ? "bg-realce-fraco" : "hover:bg-realce-fraco",
                      )}
                    >
                      <span className="flex size-5 shrink-0 items-center justify-center text-tinta-3">{item.icone}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium">{item.titulo}</span>
                        {item.detalhe ? <span className="block truncate text-[11.5px] text-tinta-2">{item.detalhe}</span> : null}
                      </span>
                      {item.extra}
                      {item.combo ? (
                        <span className="flex shrink-0 gap-1">
                          {partesDoCombo(item.combo).map((parte, i) => (
                            <kbd key={i} className="rounded border border-linha px-1 py-0.5 font-mono text-[10px] text-tinta-3">
                              {parte}
                            </kbd>
                          ))}
                        </span>
                      ) : null}
                      {ativo ? <CornerDownLeft size={13} className="shrink-0 text-tinta-3" /> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-linha px-4 py-2 text-[11px] text-tinta-3">
          <span><kbd className="font-mono">&gt;</kbd> só ações</span>
          <span><kbd className="font-mono">#</kbd> só notas</span>
          <span><kbd className="font-mono">@</kbd> só tarefas</span>
          <span><kbd className="font-mono">!</kbd> só links</span>
          <span><kbd className="font-mono">$</kbd> só compras</span>
          <span><kbd className="font-mono">+</kbd> só saúde</span>
          {buscando && !buscaNoServidor ? null : <span className="ml-auto">{buscando ? "buscando…" : `${itens.length} ${itens.length === 1 ? "item" : "itens"}`}</span>}
        </div>
      </div>
    </div>
  );
}
