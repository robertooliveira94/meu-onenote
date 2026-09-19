/**
 * Contagem de palavras e tempo de leitura estimado — mostrado no cabeçalho
 * da nota, ao lado do indicador de salvamento. Conta em cima do texto cru
 * (markdown ou puro): não vale a pena renderizar só para contar palavras.
 */

export function contarPalavras(texto: string): number {
  const trecho = texto.trim();
  if (!trecho) return 0;
  return trecho.split(/\s+/).length;
}

/** Caracteres do texto cru, mesma régua da contagem de palavras (sem renderizar, aparado nas pontas). */
export function contarCaracteres(texto: string): number {
  return texto.trim().length;
}

/** ~200 palavras por minuto, arredondado para cima — nunca "0 min" com texto de verdade. */
export function tempoDeLeituraEmMinutos(palavras: number): number {
  if (palavras === 0) return 0;
  return Math.max(1, Math.round(palavras / 200));
}
