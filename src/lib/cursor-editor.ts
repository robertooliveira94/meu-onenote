"use client";

/**
 * Onde o cursor está, em pixels, dentro de um `<textarea>`.
 *
 * O navegador não conta isso: um campo de texto não expõe a posição do
 * cursor na tela. A saída é desenhar um espelho invisível com exatamente a
 * mesma fonte, largura e recuos, cortar o texto no cursor e medir onde a
 * marca caiu — a mesma ideia usada para rolar até uma linha em `nota.tsx`.
 *
 * É o que permite abrir a lista de sugestões (`[[`, `#`, `/`) colada no
 * ponto onde se está digitando, em vez de num canto fixo da tela.
 */

const PROPRIEDADES = [
  "boxSizing",
  "width",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "tabSize",
  "overflowWrap",
  "wordBreak",
] as const;

export type CoordenadasDoCursor = {
  /** Em pixels, relativo ao canto do próprio campo, já descontada a rolagem interna. */
  esquerda: number;
  topo: number;
  alturaDaLinha: number;
};

export function coordenadasDoCursor(campo: HTMLTextAreaElement): CoordenadasDoCursor {
  const estilo = getComputedStyle(campo);
  const espelho = document.createElement("div");

  for (const propriedade of PROPRIEDADES) {
    espelho.style[propriedade] = estilo[propriedade];
  }
  espelho.style.position = "absolute";
  espelho.style.top = "0";
  espelho.style.left = "-9999px";
  espelho.style.visibility = "hidden";
  espelho.style.whiteSpace = "pre-wrap";
  espelho.style.overflow = "hidden";

  espelho.textContent = campo.value.slice(0, campo.selectionStart);
  const marca = document.createElement("span");
  // Um caractere qualquer: um `<span>` vazio não tem posição própria.
  marca.textContent = campo.value.slice(campo.selectionStart) || ".";
  espelho.appendChild(marca);
  document.body.appendChild(espelho);

  const alturaDaLinha = parseFloat(estilo.lineHeight) || parseFloat(estilo.fontSize) * 1.4;
  const coordenadas = {
    esquerda: marca.offsetLeft - campo.scrollLeft,
    topo: marca.offsetTop - campo.scrollTop,
    alturaDaLinha,
  };
  espelho.remove();
  return coordenadas;
}
