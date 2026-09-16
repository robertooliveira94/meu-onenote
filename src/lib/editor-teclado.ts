import type { Selecao } from "./formatacao";

/**
 * O que um editor de texto faz sozinho e um `<textarea>` cru não faz:
 * continuar a lista no Enter, indentar com Tab, mover a linha com Alt+seta,
 * duplicar com Ctrl+D.
 *
 * São funções puras sobre "texto + seleção", como as de `formatacao.ts` — o
 * campo de edição só aplica o resultado. Assim dá para raciocinar (e testar)
 * cada regra sem DOM nenhum.
 */

const RECUO = "  ";

/** Marcador de lista no começo da linha: `- `, `* `, `1. `, com ou sem `[ ]`. */
const PADRAO_MARCADOR = /^(\s*)([-*+]|\d+[.)])(\s+)(\[[ xX]\]\s+)?/;

function inicioDaLinha(texto: string, posicao: number): number {
  return texto.lastIndexOf("\n", posicao - 1) + 1;
}

function fimDaLinha(texto: string, posicao: number): number {
  const quebra = texto.indexOf("\n", posicao);
  return quebra === -1 ? texto.length : quebra;
}

/** As linhas inteiras que a seleção toca, como um trecho contínuo. */
function faixaDasLinhas(selecao: Selecao): { inicio: number; fim: number } {
  return {
    inicio: inicioDaLinha(selecao.texto, selecao.inicio),
    fim: fimDaLinha(selecao.texto, selecao.fim),
  };
}

/**
 * Enter dentro de uma lista continua a lista; numa lista numerada, com o
 * número seguinte. Enter num item vazio encerra a lista em vez de empilhar
 * marcadores para sempre — é o que todo editor faz e o que a mão espera.
 *
 * Devolve `null` quando a linha não é item de lista: aí o Enter é o do
 * navegador mesmo, que já sabe desfazer com Ctrl+Z.
 */
export function continuarLista(selecao: Selecao): Selecao | null {
  const { texto, inicio, fim } = selecao;
  if (inicio !== fim) return null;

  const comeco = inicioDaLinha(texto, inicio);
  const linha = texto.slice(comeco, fimDaLinha(texto, inicio));
  const marcador = linha.match(PADRAO_MARCADOR);
  if (!marcador) return null;

  const [prefixo, recuo, sinal, espaco, caixa] = marcador;
  // Item sem conteúdo: o Enter apaga o marcador e sai da lista.
  if (linha.slice(prefixo.length).trim() === "") {
    return {
      texto: texto.slice(0, comeco) + texto.slice(comeco + prefixo.length),
      inicio: comeco,
      fim: comeco,
    };
  }

  const proximoSinal = /^\d+[.)]$/.test(sinal)
    ? `${Number.parseInt(sinal, 10) + 1}${sinal.slice(-1)}`
    : sinal;
  // Uma tarefa continua como tarefa, sempre desmarcada.
  const novoPrefixo = `\n${recuo}${proximoSinal}${espaco}${caixa ? "[ ] " : ""}`;

  return {
    texto: texto.slice(0, inicio) + novoPrefixo + texto.slice(fim),
    inicio: inicio + novoPrefixo.length,
    fim: inicio + novoPrefixo.length,
  };
}

/**
 * Tab indenta as linhas da seleção, Shift+Tab desindenta. Sem seleção, Tab
 * dentro de um item de lista também indenta a linha (é o gesto de criar
 * subitem); fora de lista, insere o recuo onde o cursor está, que é o que
 * se quer ao alinhar um bloco de código.
 */
export function indentar(selecao: Selecao, sentido: 1 | -1): Selecao {
  const { texto, inicio, fim } = selecao;
  const faixa = faixaDasLinhas(selecao);
  const semSelecao = inicio === fim;
  const linhaAtual = texto.slice(faixa.inicio, fimDaLinha(texto, inicio));

  if (sentido === 1 && semSelecao && !PADRAO_MARCADOR.test(linhaAtual)) {
    return {
      texto: texto.slice(0, inicio) + RECUO + texto.slice(fim),
      inicio: inicio + RECUO.length,
      fim: inicio + RECUO.length,
    };
  }

  const bloco = texto.slice(faixa.inicio, faixa.fim);
  let removidoNaPrimeira = 0;
  let deslocamentoTotal = 0;

  const novoBloco = bloco
    .split("\n")
    .map((linha, indice) => {
      if (sentido === 1) {
        deslocamentoTotal += RECUO.length;
        if (indice === 0) removidoNaPrimeira = -RECUO.length;
        return RECUO + linha;
      }
      const recuoAtual = linha.match(/^[ \t]+/)?.[0] ?? "";
      // Tira um nível: dois espaços, ou uma tabulação, ou o que houver.
      const aTirar = recuoAtual.startsWith(RECUO)
        ? RECUO.length
        : recuoAtual.startsWith("\t")
          ? 1
          : recuoAtual.length;
      deslocamentoTotal -= aTirar;
      if (indice === 0) removidoNaPrimeira = aTirar;
      return linha.slice(aTirar);
    })
    .join("\n");

  return {
    texto: texto.slice(0, faixa.inicio) + novoBloco + texto.slice(faixa.fim),
    inicio: Math.max(faixa.inicio, inicio - removidoNaPrimeira),
    fim: Math.max(faixa.inicio, fim + (sentido === 1 ? deslocamentoTotal : -Math.abs(deslocamentoTotal))),
  };
}

/**
 * Sobe ou desce as linhas da seleção, trocando de lugar com a vizinha.
 * Devolve `null` quando não há para onde ir (já está no topo ou no fim).
 */
export function moverLinha(selecao: Selecao, direcao: 1 | -1): Selecao | null {
  const { texto, inicio, fim } = selecao;
  const faixa = faixaDasLinhas(selecao);

  if (direcao === -1) {
    if (faixa.inicio === 0) return null;
    const inicioAnterior = inicioDaLinha(texto, faixa.inicio - 1);
    const anterior = texto.slice(inicioAnterior, faixa.inicio - 1);
    const bloco = texto.slice(faixa.inicio, faixa.fim);
    const novo = `${texto.slice(0, inicioAnterior)}${bloco}\n${anterior}${texto.slice(faixa.fim)}`;
    const deslocamento = anterior.length + 1;
    return { texto: novo, inicio: inicio - deslocamento, fim: fim - deslocamento };
  }

  if (faixa.fim >= texto.length) return null;
  const fimSeguinte = fimDaLinha(texto, faixa.fim + 1);
  const seguinte = texto.slice(faixa.fim + 1, fimSeguinte);
  const bloco = texto.slice(faixa.inicio, faixa.fim);
  const novo = `${texto.slice(0, faixa.inicio)}${seguinte}\n${bloco}${texto.slice(fimSeguinte)}`;
  const deslocamento = seguinte.length + 1;
  return { texto: novo, inicio: inicio + deslocamento, fim: fim + deslocamento };
}

/** Duplica as linhas da seleção logo abaixo, com o cursor na cópia. */
export function duplicarLinha(selecao: Selecao): Selecao {
  const { texto, inicio, fim } = selecao;
  const faixa = faixaDasLinhas(selecao);
  const bloco = texto.slice(faixa.inicio, faixa.fim);
  const deslocamento = bloco.length + 1;

  return {
    texto: `${texto.slice(0, faixa.fim)}\n${bloco}${texto.slice(faixa.fim)}`,
    inicio: inicio + deslocamento,
    fim: fim + deslocamento,
  };
}
