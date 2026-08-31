/**
 * Transforma `[[Nome da Página]]` em `[Nome da Página](wikilink:Nome...)` —
 * sintaxe de link padrão que o markdown já sabe processar sozinho.
 *
 * Não dá pra fazer isso como plugin remark de verdade (visitando a árvore
 * já pronta): colchete duplo colide com a sintaxe de link do próprio
 * CommonMark — `[[Nota B]]` já vira uma referência de link quebrada
 * *durante o parse*, antes de qualquer plugin ver um nó de texto pra
 * transformar. Por isso isto mexe no texto cru, antes do markdown ser
 * processado.
 *
 * Protege blocos de código (crase tripla) e código em linha (crase simples)
 * trocando por um marcador antes de converter, e devolve o trecho original
 * depois — sem isso, um `[[colchete]]` escrito de propósito dentro de um
 * bloco de código apareceria como link.
 */

const PADRAO_BLOCO_CODIGO = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const PADRAO_CODIGO_LINHA = /`[^`\n]*`/g;
const PADRAO_LINK = /\[\[([^[\]]+)\]\]/g;

// Caracteres da Área de Uso Privado do Unicode (U+E000/U+E001) como
// delimitador do marcador temporário — nenhum teclado digita isso e nenhum
// texto real contém, então não há risco de colidir com algo que a pessoa
// escreveu de verdade. `String.fromCharCode` em vez do caractere cru no
// arquivo: mais explícito, e sem risco de alguma ferramenta "normalizar"
// um caractere invisível ao salvar.
const MARCADOR_INICIO = String.fromCharCode(0xe000);
const MARCADOR_FIM = String.fromCharCode(0xe001);

export function converterWikilinks(texto: string): string {
  const protegidos: string[] = [];
  function proteger(trecho: string): string {
    protegidos.push(trecho);
    return `${MARCADOR_INICIO}${protegidos.length - 1}${MARCADOR_FIM}`;
  }

  const semCodigo = texto
    .replace(PADRAO_BLOCO_CODIGO, proteger)
    .replace(PADRAO_CODIGO_LINHA, proteger);

  const convertido = semCodigo.replace(PADRAO_LINK, (_match, titulo: string) => {
    const limpo = titulo.trim();
    return `[${limpo}](wikilink:${encodeURIComponent(limpo)})`;
  });

  const padraoMarcador = new RegExp(`${MARCADOR_INICIO}(\\d+)${MARCADOR_FIM}`, "g");
  return convertido.replace(padraoMarcador, (_match, indice: string) => protegidos[Number(indice)]);
}
