"use client";

import Link from "next/link";
import { memo, useMemo, useRef } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { juntar } from "@/lib/caminho-texto";
import { converterWikilinks } from "@/lib/remark-wikilinks";
import { urlDaMidia, urlDaNota } from "@/lib/rotas";

// Fora do componente de propósito: um array literal novo a cada render faria
// o react-markdown achar que os plugins mudaram e reprocessar tudo à toa.
const PLUGINS_REMARK = [remarkGfm];
const PLUGINS_REHYPE = [rehypeHighlight];

/** "Pessoal/Financeiro/orçamento.md" → "Pessoal › Financeiro › orçamento" */
function trilhaDoCaminho(caminho: string): string {
  const partes = caminho.split("/");
  const ultima = partes.pop() ?? "";
  const semExtensao = ultima.slice(0, ultima.lastIndexOf(".")) || ultima;
  return [...partes, semExtensao].join(" › ");
}

/**
 * Renderização do markdown. O GFM entra por causa das listas de tarefas e das
 * tabelas — é o que aparece de verdade numa anotação pessoal.
 *
 * A aparência toda vive na classe .prosa, em globals.css.
 *
 * Envolto em memo: reprocessar markdown (e o realce de sintaxe dos blocos de
 * código, que é a parte mais cara) é caro para documentos grandes. Sem o
 * memo, o componente reprocessaria a cada tecla digitada em qualquer outro
 * lugar da página — mesmo recebendo o mesmíssimo texto de antes — o que
 * bastava para atrasar o campo de edição a ponto de perder caracteres
 * digitados rápido.
 */
export const VisualizadorMarkdown = memo(function VisualizadorMarkdown({
  conteudo,
  pastaBase,
  aoAlternarTarefa,
  mapaDeLinks,
}: {
  conteudo: string;
  /** Pasta da nota, para resolver o caminho relativo de imagens coladas. */
  pastaBase?: string;
  /** Presente só em leitura — clicar na caixinha grava a mudança no arquivo. */
  aoAlternarTarefa?: (indiceDaTarefa: number) => void;
  /** Título normalizado → caminho resolvido (ou null) de cada `[[link]]` do texto. */
  mapaDeLinks?: Record<string, string | null>;
}) {
  // Conta "a N-ésima tarefa do documento" enquanto o markdown é montado.
  // Em desenvolvimento, o React invoca cada componente de checkbox duas
  // vezes (o mesmo objeto `node` nas duas) — sem o cache por identidade do
  // nó, a segunda chamada via um contador mutuável simples pegaria o índice
  // seguinte em vez de repetir o primeiro, e a versão que realmente fica no
  // ar é a da segunda chamada. Cada nó só recebe um índice na primeira vez
  // que aparece; da segunda vez em diante, devolve o mesmo de antes.
  const proximoIndice = useRef(0);
  const indicePorNo = useRef(new WeakMap<object, number>());
  proximoIndice.current = 0;
  indicePorNo.current = new WeakMap();

  const componentes = useMemo<Components>(
    () => ({
      a({ href, children }) {
        if (!href?.startsWith("wikilink:")) {
          // Link comum do markdown — mesmo comportamento de sempre.
          return (
            <a href={href} target={href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
              {children}
            </a>
          );
        }
        const titulo = decodeURIComponent(href.slice("wikilink:".length));
        const caminho = mapaDeLinks?.[titulo.trim().toLowerCase()];
        if (!caminho) {
          // Sem página com esse título: ainda assim visível, mas sem fingir
          // que é clicável — nada pior que um link que não leva a lugar nenhum.
          return (
            <span
              className="cursor-default border-b border-dashed border-tinta-3 text-tinta-3"
              title={`Nenhuma página chamada "${titulo}"`}
            >
              {children}
            </span>
          );
        }
        return (
          <Link href={urlDaNota(caminho)} title={trilhaDoCaminho(caminho)}>
            {children}
          </Link>
        );
      },
      img({ src, alt }) {
        // O tipo do react-markdown admite Blob por causa do HTML padrão, mas
        // o markdown nunca produz isso — só um caminho de string mesmo.
        if (!src || typeof src !== "string") return null;
        // Absoluta (http, ou já uma rota do app) passa direto; relativa
        // (`_anexos/foo.png`, como o app grava ao colar) vira a rota que
        // serve o arquivo de dentro de dados/.
        const absoluta = /^(https?:)?\/\//.test(src) || src.startsWith("/");
        const url = absoluta ? src : urlDaMidia(juntar(pastaBase ?? "", src));
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={url} alt={alt ?? ""} loading="lazy" />;
      },
      // A lista de tarefas do remark-gfm já marca `checked`; só sobra dar
      // clique (só em leitura — no editor a mudança é sempre pelo texto).
      // O `<input>` aqui é sintetizado a partir do estado marcado/desmarcado,
      // não corresponde a um trecho real do markdown — por isso a posição
      // dele (`node.position`) não é confiável para achar a linha certa;
      // contar a ordem de aparição é.
      input({ node, checked, ...resto }) {
        if (!aoAlternarTarefa) {
          return <input {...resto} type="checkbox" checked={checked ?? false} readOnly />;
        }
        let indiceDaTarefa = node ? indicePorNo.current.get(node) : undefined;
        if (indiceDaTarefa === undefined) {
          indiceDaTarefa = proximoIndice.current;
          proximoIndice.current += 1;
          if (node) indicePorNo.current.set(node, indiceDaTarefa);
        }
        return (
          <input
            {...resto}
            type="checkbox"
            checked={checked ?? false}
            // O remark-gfm marca todo checkbox como `disabled` por padrão
            // (é para leitura). Aqui é para clicar, então tira de novo.
            disabled={false}
            onChange={() => aoAlternarTarefa(indiceDaTarefa)}
          />
        );
      },
    }),
    [pastaBase, aoAlternarTarefa, mapaDeLinks],
  );

  if (!conteudo.trim()) {
    return <p className="text-[14px] text-tinta-3 italic">Esta página ainda está em branco.</p>;
  }

  return (
    <div className="prosa">
      <Markdown
        remarkPlugins={PLUGINS_REMARK}
        rehypePlugins={PLUGINS_REHYPE}
        components={componentes}
        // O sanitizador padrão do react-markdown descarta qualquer href cujo
        // esquema não esteja na lista dele (http, mailto, etc.) — "wikilink:"
        // não está nela, então virava um href vazio antes mesmo de chegar
        // no componente `a` acima. Deixa esse esquema passar como está.
        urlTransform={(url) => (url.startsWith("wikilink:") ? url : defaultUrlTransform(url))}
      >
        {converterWikilinks(conteudo)}
      </Markdown>
    </div>
  );
});
