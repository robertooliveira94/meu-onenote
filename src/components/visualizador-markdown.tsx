"use client";

import Link from "next/link";
import { Children, isValidElement, memo, useMemo, useRef } from "react";
import Markdown, { defaultUrlTransform, type Components } from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";

import { juntar } from "@/lib/caminho-texto";
import { converterWikilinks } from "@/lib/remark-wikilinks";
import { identificadorDeTitulo } from "@/lib/sumario";
import { urlDaMidia, urlDaNota } from "@/lib/rotas";

// Fora do componente de propósito: um array literal novo a cada render faria
// o react-markdown achar que os plugins mudaram e reprocessar tudo à toa.
const PLUGINS_REMARK = [remarkGfm];
const PLUGINS_REHYPE = [rehypeHighlight];

/** O texto puro de um título, atravessando negrito, código e links dentro dele. */
function textoDoNo(no: React.ReactNode): string {
  return Children.toArray(no)
    .map((filho) => {
      if (typeof filho === "string" || typeof filho === "number") return String(filho);
      if (isValidElement<{ children?: React.ReactNode }>(filho)) return textoDoNo(filho.props.children);
      return "";
    })
    .join("");
}

/**
 * Um título sem texto ("### " recém-digitado, antes do título em si) vira um
 * `<h3></h3>` vazio, que não desenha nada — enquanto se escreve, isso parece
 * que os "#" foram engolidos pela prévia. Aqui esse caso desenha os próprios
 * "#" apagadinhos, então a linha nunca some do olho de quem está digitando;
 * assim que o título ganha texto, vira um título de verdade.
 *
 * Títulos com texto ganham um `id` (ver `identificadorDeTitulo`): é a âncora
 * que o sumário usa para rolar até eles.
 */
function tituloOuMarcaVazia(nivel: 1 | 2 | 3 | 4 | 5 | 6) {
  const Marcacao = `h${nivel}` as const;
  return function Titulo({ children }: { children?: React.ReactNode }) {
    const semTexto = Children.toArray(children).every(
      (filho) => typeof filho === "string" && filho.trim() === "",
    );
    if (!semTexto) return <Marcacao id={identificadorDeTitulo(textoDoNo(children))}>{children}</Marcacao>;
    return (
      <Marcacao className="titulo-vazio" title={`Título de nível ${nivel}, ainda sem texto`}>
        {"#".repeat(nivel)}
      </Marcacao>
    );
  };
}

/** Desfaz o `%20` de um caminho relativo do markdown; o que não estiver codificado passa como está. */
function decodificar(caminho: string): string {
  try {
    return decodeURI(caminho);
  } catch {
    return caminho;
  }
}

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
      h1: tituloOuMarcaVazia(1),
      h2: tituloOuMarcaVazia(2),
      h3: tituloOuMarcaVazia(3),
      h4: tituloOuMarcaVazia(4),
      h5: tituloOuMarcaVazia(5),
      h6: tituloOuMarcaVazia(6),
      a({ href, children }) {
        if (!href?.startsWith("wikilink:")) {
          // Endereço relativo (`_anexos/orcamento.pdf`, como o app grava ao
          // arrastar um arquivo) vira a rota que serve o anexo — senão o
          // navegador o resolveria contra a URL da nota e daria 404. Link
          // comum (http, âncora, rota do app) passa como está.
          const relativo = Boolean(href) && !/^(https?:|mailto:|#|\/)/.test(href!);
          // O markdown guarda o caminho codificado (`Or%C3%A7amento%202026.pdf`);
          // `urlDaMidia` codifica de novo, então decodifica antes.
          const destino = relativo ? urlDaMidia(juntar(pastaBase ?? "", decodificar(href!))) : href;
          return (
            <a href={destino} target={relativo || href?.startsWith("http") ? "_blank" : undefined} rel="noreferrer">
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
        const url = absoluta ? src : urlDaMidia(juntar(pastaBase ?? "", decodificar(src)));
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
