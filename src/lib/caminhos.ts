import path from "node:path";

import {
  CaminhoInvalido,
  ehArquivoDeNota,
  ehPastaInterna,
  extensaoDe,
  formatoDe,
  juntar,
  limparNome,
  nomeDe,
  nomeValido,
  pastaDe,
  profundidade,
  segmentos,
  tituloDe,
} from "./caminho-texto";

/**
 * Tudo que a aplicação lê ou escreve mora dentro de `dados/`. Este módulo é o
 * porteiro: nenhum caminho vindo da interface toca o disco sem passar por aqui.
 *
 * Só a parte que precisa de `node:path`/tocar disco fica aqui — o resto
 * (manipulação de caminho como texto puro) mora em `caminho-texto.ts` e é
 * só reexportado, porque esse outro módulo também é usado por componentes
 * de cliente, onde `node:path` não pode aparecer nem por importação
 * transitiva.
 *
 * O local vem de `DADOS_PATH` quando essa variável de ambiente existe —
 * dentro do container Docker ela sempre existe, apontando pro volume
 * montado (ver Dockerfile). Fora do Docker (serviço do Windows, modo
 * desenvolvimento), sem a variável definida, cai no padrão local: dentro do
 * OneDrive, para o backup na nuvem já acontecer sozinho, sem precisar
 * copiar `dados/` na mão de vez em quando.
 */
const PADRAO_LOCAL = "C:\\Users\\rober\\OneDrive\\Documentos\\notas";
export const RAIZ = process.env.DADOS_PATH ? path.resolve(process.env.DADOS_PATH) : PADRAO_LOCAL;
export const PASTA_SISTEMA = "_sistema";
/**
 * Onde a captura rápida e a nota do dia caem — um caderno de verdade, visível
 * na árvore como qualquer outro (renomeável, com cor e ícone próprios), não
 * uma pasta escondida. "Toda nota mora dentro de um caderno" — inclusive as
 * soltas.
 */
export const PASTA_ENTRADA = "Entrada";
/**
 * Seção padrão criada em cada caderno para receber páginas que, por
 * qualquer motivo, apareçam soltas direto na raiz dele (migração de uma
 * versão anterior do app, ou um arquivo copiado ali por fora) — a
 * captura rápida e a nota do dia também caem aqui dentro do caderno
 * Entrada. Uma página nunca fica solta num caderno: a hierarquia é
 * sempre caderno → seção → página.
 */
export const PASTA_GERAL = "Geral";
/**
 * Pasta interna dentro de cada caderno com o quadro Kanban dele. Começa com
 * "_" como `_sistema`, então já fica fora da lista de seções sem precisar
 * de filtro extra. Um quadro por caderno, nunca por seção — o Kanban é
 * pensado como um espaço à parte das anotações, não uma seção disfarçada.
 */
export const PASTA_KANBAN = "_kanban";

export {
  CaminhoInvalido,
  ehArquivoDeNota,
  ehPastaInterna,
  extensaoDe,
  formatoDe,
  juntar,
  limparNome,
  nomeDe,
  nomeValido,
  pastaDe,
  profundidade,
  segmentos,
  tituloDe,
};

/**
 * Converte um caminho relativo em caminho absoluto no disco, recusando
 * qualquer coisa que tente escapar de `dados/`.
 */
export function resolverCaminho(relativo: string): string {
  const absoluto = path.resolve(RAIZ, ...segmentos(relativo));
  if (absoluto !== RAIZ && !absoluto.startsWith(RAIZ + path.sep)) {
    throw new CaminhoInvalido("Caminho fora da pasta de dados");
  }
  return absoluto;
}

/** Recusa escrita dentro da área interna do aplicativo. */
export function garantirForaDoSistema(relativo: string): void {
  if (segmentos(relativo)[0] === PASTA_SISTEMA) {
    throw new CaminhoInvalido("Essa pasta é de uso interno do aplicativo");
  }
}
