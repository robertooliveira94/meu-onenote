/**
 * O sumário de uma nota: os títulos do markdown, na ordem em que aparecem.
 *
 * Lido do texto cru, não do HTML renderizado — assim o painel funciona
 * igual em leitura e em edição, e não depende da prévia ter sido montada.
 * O `id` é o mesmo que `visualizador-markdown.tsx` põe em cada `<h1..h6>`,
 * que é como clicar num item do sumário acha o título na tela.
 */
export type Titulo = {
  nivel: number;
  texto: string;
  id: string;
  /** Linha (base zero) onde o título começa — é o que leva o cursor até lá na edição. */
  linha: number;
};

/**
 * "## Café com leite" → "cafe-com-leite". Sem acento, sem pontuação e sem
 * espaço, porque vira âncora de elemento. Dois títulos com o mesmo texto
 * ficam com o mesmo id de propósito: clicar leva ao primeiro, que é o
 * comportamento menos surpreendente e não exige combinar contagem entre
 * quem extrai e quem renderiza.
 */
export function identificadorDeTitulo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Tira a marcação inline do título, pra o sumário mostrar texto e não sintaxe. */
function limparMarcacao(texto: string): string {
  return texto
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/#+\s*$/, "")
    .trim();
}

/** Linha que pode receber um sublinhado de título setext embaixo. */
function podeSerTituloSetext(linha: string): boolean {
  const limpa = linha.trim();
  if (!limpa) return false;
  return !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|\||```|~~~)/.test(limpa);
}

/**
 * Os títulos de um markdown. Pula blocos de código cercados (um `# comentário`
 * dentro de um bloco de shell não é título de coisa nenhuma) e entende as
 * duas formas: `## Assim` e o sublinhado que a barra de formatação escreve
 * (`Assim` com `===` ou `---` embaixo).
 */
export function extrairTitulos(conteudo: string): Titulo[] {
  // Divide tirando o `\r` junto: num arquivo salvo no Bloco de Notas as
  // linhas terminam em CRLF, e em JavaScript o `.` de uma expressão regular
  // não casa `\r` — com ele sobrando no fim da linha, nenhum `# Título`
  // casava e a nota inteira ficava sem sumário.
  const linhas = conteudo.split(/\r?\n/);
  const titulos: Titulo[] = [];
  let dentroDeBloco: string | null = null;

  for (let indice = 0; indice < linhas.length; indice++) {
    const linha = linhas[indice];
    const cerca = linha.match(/^\s{0,3}(```+|~~~+)/);
    if (cerca) {
      if (dentroDeBloco === null) dentroDeBloco = cerca[1][0];
      else if (cerca[1][0] === dentroDeBloco) dentroDeBloco = null;
      continue;
    }
    if (dentroDeBloco !== null) continue;

    const comCerquilha = linha.match(/^\s{0,3}(#{1,6})\s+(.*)$/);
    if (comCerquilha) {
      const texto = limparMarcacao(comCerquilha[2]);
      if (texto) {
        titulos.push({ nivel: comCerquilha[1].length, texto, id: identificadorDeTitulo(texto), linha: indice });
      }
      continue;
    }

    const sublinhado = linha.match(/^\s{0,3}(=+|-+)\s*$/);
    if (sublinhado && indice > 0 && podeSerTituloSetext(linhas[indice - 1])) {
      const texto = limparMarcacao(linhas[indice - 1]);
      if (texto) {
        titulos.push({
          nivel: sublinhado[1][0] === "=" ? 1 : 2,
          texto,
          id: identificadorDeTitulo(texto),
          linha: indice - 1,
        });
      }
    }
  }

  return titulos;
}
