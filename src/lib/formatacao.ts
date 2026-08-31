/**
 * Operações da barra de formatação.
 *
 * São funções puras sobre "texto + seleção": recebem o conteúdo e onde está o
 * cursor, devolvem o novo conteúdo e onde o cursor deve ficar. Assim a barra de
 * botões não precisa saber nada sobre o campo de edição.
 */

export type Selecao = {
  texto: string;
  inicio: number;
  fim: number;
};

/**
 * Envolve a seleção com marcadores — e desfaz se já estiver envolvida, para o
 * mesmo botão servir de liga e desliga.
 */
export function envolver(selecao: Selecao, abertura: string, fechamento = abertura): Selecao {
  const { texto, inicio, fim } = selecao;
  const escolhido = texto.slice(inicio, fim);

  const jaEnvolvido =
    texto.slice(inicio - abertura.length, inicio) === abertura &&
    texto.slice(fim, fim + fechamento.length) === fechamento;

  if (jaEnvolvido) {
    return {
      texto:
        texto.slice(0, inicio - abertura.length) +
        escolhido +
        texto.slice(fim + fechamento.length),
      inicio: inicio - abertura.length,
      fim: fim - abertura.length,
    };
  }

  return {
    texto: texto.slice(0, inicio) + abertura + escolhido + fechamento + texto.slice(fim),
    // Sem nada selecionado, o cursor fica entre os marcadores, pronto para digitar.
    inicio: inicio + abertura.length,
    fim: fim + abertura.length,
  };
}

/** Começo da linha que contém a posição. */
function inicioDaLinha(texto: string, posicao: number): number {
  return texto.lastIndexOf("\n", Math.max(0, posicao - 1)) + 1;
}

/** Fim da linha que contém a posição. */
function fimDaLinha(texto: string, posicao: number): number {
  const quebra = texto.indexOf("\n", posicao);
  return quebra === -1 ? texto.length : quebra;
}

/**
 * Põe (ou tira) um prefixo em cada linha tocada pela seleção. Serve para
 * listas, tarefas, citações, títulos e recuo.
 */
export function prefixarLinhas(selecao: Selecao, prefixo: string): Selecao {
  const { texto, inicio, fim } = selecao;
  const comeco = inicioDaLinha(texto, inicio);
  const termino = fimDaLinha(texto, fim);

  const linhas = texto.slice(comeco, termino).split("\n");
  const todasTem = linhas.every((linha) => linha.startsWith(prefixo));

  const novas = linhas.map((linha) =>
    todasTem ? linha.slice(prefixo.length) : prefixo + linha,
  );
  const bloco = novas.join("\n");
  const diferenca = bloco.length - (termino - comeco);

  return {
    texto: texto.slice(0, comeco) + bloco + texto.slice(termino),
    inicio: todasTem ? Math.max(comeco, inicio - prefixo.length) : inicio + prefixo.length,
    fim: fim + diferenca,
  };
}

/** Aplica uma transformação no texto selecionado (usada pelo CAIXA ALTA). */
export function transformarSelecao(
  selecao: Selecao,
  transformar: (trecho: string) => string,
): Selecao {
  const { texto, inicio, fim } = selecao;
  // Sem seleção, vale a linha inteira — ninguém quer selecionar para depois clicar.
  const comeco = inicio === fim ? inicioDaLinha(texto, inicio) : inicio;
  const termino = inicio === fim ? fimDaLinha(texto, fim) : fim;

  const trecho = transformar(texto.slice(comeco, termino));
  return {
    texto: texto.slice(0, comeco) + trecho + texto.slice(termino),
    inicio: comeco,
    fim: comeco + trecho.length,
  };
}

/**
 * Título de texto puro: a linha ganha uma régua de "=" logo abaixo, que é como
 * se marca título num arquivo .txt desde sempre.
 */
export function sublinharLinha(selecao: Selecao, caractere: "=" | "-"): Selecao {
  const { texto, inicio } = selecao;
  const comeco = inicioDaLinha(texto, inicio);
  const termino = fimDaLinha(texto, inicio);
  const linha = texto.slice(comeco, termino);
  if (!linha.trim()) return selecao;

  const proximaLinha = texto.slice(termino + 1, fimDaLinha(texto, termino + 1));
  const jaSublinhada =
    proximaLinha.length > 0 && [...proximaLinha].every((letra) => letra === caractere);

  if (jaSublinhada) {
    return {
      texto: texto.slice(0, termino) + texto.slice(termino + 1 + proximaLinha.length),
      inicio: termino,
      fim: termino,
    };
  }

  const regua = caractere.repeat(Math.min(linha.trim().length, 60));
  return {
    texto: `${texto.slice(0, termino)}\n${regua}${texto.slice(termino)}`,
    inicio: termino + 1 + regua.length,
    fim: termino + 1 + regua.length,
  };
}

/** Insere um bloco pronto (tabela, separador) numa linha só dele. */
export function inserirBloco(selecao: Selecao, bloco: string): Selecao {
  const { texto, fim } = selecao;
  const termino = fimDaLinha(texto, fim);
  const precisaDeEspaco = texto.slice(0, termino).trim().length > 0;
  const trecho = `${precisaDeEspaco ? "\n\n" : ""}${bloco}`;

  return {
    texto: texto.slice(0, termino) + trecho + texto.slice(termino),
    inicio: termino + trecho.length,
    fim: termino + trecho.length,
  };
}

export const TABELA_EXEMPLO = ["| Coluna | Coluna |", "| --- | --- |", "|  |  |"].join("\n");
export const SEPARADOR_TEXTO = "─".repeat(40);

const PADRAO_TAREFA = /^(\s*[-*+]\s+)\[([ xX])\]/;

/**
 * Vira (ou desmarca) a N-ésima tarefa `- [ ]` do texto — usado quando a
 * pessoa clica na caixinha direto na visualização, sem entrar no modo de
 * edição. Conta pela ordem de aparição em vez de por número de linha: o
 * `<input>` que o remark-gfm gera para a caixinha não corresponde a um
 * trecho real do markdown (é sintetizado a partir do estado marcado/
 * desmarcado), então a posição dele no código-fonte não é confiável — mas
 * "a terceira tarefa do documento" sempre é.
 */
export function alternarTarefa(texto: string, indiceDaTarefa: number): string {
  const linhas = texto.split("\n");
  let contador = 0;

  for (let i = 0; i < linhas.length; i += 1) {
    const casada = linhas[i].match(PADRAO_TAREFA);
    if (!casada) continue;
    if (contador === indiceDaTarefa) {
      const novoEstado = casada[2] === " " ? "x" : " ";
      linhas[i] = linhas[i].replace(PADRAO_TAREFA, `$1[${novoEstado}]`);
      return linhas.join("\n");
    }
    contador += 1;
  }
  return texto;
}
