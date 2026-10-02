/**
 * Desenhos (quadro do Excalidraw) dentro de uma página.
 *
 * Cada desenho é um PNG comum em `_anexos/`, com a cena do Excalidraw
 * embutida nos metadados do próprio arquivo — o formato `.excalidraw.png`
 * que o Excalidraw já usa. Por isso no markdown ele é só uma imagem
 * (`![Desenho](_anexos/Desenho.excalidraw.png)`): aparece em qualquer leitor,
 * no export, no GitHub; e aqui dentro dá para reabrir e continuar desenhando,
 * porque a cena viaja junto. Um arquivo só, nada para ficar dessincronizado.
 */

export const EXTENSAO_DESENHO = "excalidraw.png";

/** O endereço (codificado ou não, com ou sem `?v=`) aponta para um desenho? */
export function ehDesenho(endereco: string): boolean {
  return endereco.split(/[?#]/)[0].toLowerCase().endsWith(`.${EXTENSAO_DESENHO}`);
}
