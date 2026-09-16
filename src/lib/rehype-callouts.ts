import type { Element, Root, RootContent, Text } from "hast";

/**
 * Callouts: uma citação que começa com `[!nota]`, `[!dica]`, `[!aviso]` ou
 * `[!perigo]` vira um bloco com cor e título — a sintaxe do Obsidian, que
 * em qualquer outro leitor de markdown continua sendo uma citação comum
 * (o arquivo não ganha nada proprietário).
 *
 * É um plugin rehype de propósito: o marcador precisa sair do texto antes de
 * virar React, e a citação precisa saber que é callout antes de ser
 * desenhada. Sem `unist-util-visit`: a caminhada é curta.
 */

export const TIPOS_DE_CALLOUT = {
  nota: "Nota",
  dica: "Dica",
  aviso: "Aviso",
  perigo: "Perigo",
  info: "Info",
  importante: "Importante",
} as const;

export type TipoDeCallout = keyof typeof TIPOS_DE_CALLOUT;

const PADRAO = /^\[!([a-zA-Z]+)\]\s*/;

function ehElemento(no: RootContent | Root, nome?: string): no is Element {
  return no.type === "element" && (nome === undefined || no.tagName === nome);
}

function marcarCallout(citacao: Element): void {
  const paragrafo = citacao.children.find((filho) => ehElemento(filho, "p"));
  if (!paragrafo || !ehElemento(paragrafo)) return;
  const primeiro = paragrafo.children[0];
  if (!primeiro || primeiro.type !== "text") return;
  const texto = primeiro as Text;

  const casamento = texto.value.match(PADRAO);
  if (!casamento) return;
  const tipo = casamento[1].toLowerCase();
  if (!(tipo in TIPOS_DE_CALLOUT)) return;

  // `[!aviso] Cuidado` + linha nova + corpo: "Cuidado" vira o título do
  // bloco. `[!aviso] Só uma linha` sem corpo embaixo é corpo com o título
  // padrão — numa anotação, a frase é o que importa, não o rótulo.
  const resto = texto.value.slice(casamento[0].length);
  const quebra = resto.indexOf("\n");
  let titulo = "";
  if (quebra !== -1 && resto.slice(0, quebra).trim()) {
    titulo = resto.slice(0, quebra).trim();
    texto.value = resto.slice(quebra + 1);
  } else {
    texto.value = resto.replace(/^\n/, "");
  }

  citacao.properties = {
    ...citacao.properties,
    className: ["callout", `callout-${tipo}`],
    dataTipo: tipo,
    dataTitulo: titulo || TIPOS_DE_CALLOUT[tipo as TipoDeCallout],
  };
}

function caminhar(no: Root | Element): void {
  for (const filho of no.children) {
    if (!ehElemento(filho)) continue;
    if (filho.tagName === "blockquote") marcarCallout(filho);
    caminhar(filho);
  }
}

export function rehypeCallouts() {
  return (arvore: Root) => {
    caminhar(arvore);
  };
}
