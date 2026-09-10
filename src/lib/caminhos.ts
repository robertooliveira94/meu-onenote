import path from "node:path";

import {
  CaminhoInvalido,
  ehArquivoDeNota,
  ehPastaInterna,
  ehTarefaKanban,
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
 * Seção-abrigo criada em cada caderno para receber páginas que, por qualquer
 * motivo, apareçam soltas direto na raiz dele (migração de uma versão
 * anterior do app, ou um arquivo copiado ali por fora). Uma página nunca
 * fica solta num caderno: a hierarquia é sempre caderno → seção → página.
 */
export const PASTA_GERAL = "Geral";
/**
 * Onde mora o Kanban inteiro: `_kanban/<Quadro>/<Coluna>/<Tarefa>.md`, na
 * raiz dos dados e não dentro de um caderno. Começa com "_" como
 * `_sistema`, então fica fora da árvore de cadernos sem precisar de filtro
 * extra — as duas aplicações (Anotações e Kanban) têm listas próprias e
 * independentes, e excluir um quadro nunca mexe num caderno de mesmo nome.
 */
export const PASTA_KANBAN = "_kanban";

export {
  CaminhoInvalido,
  ehArquivoDeNota,
  ehPastaInterna,
  ehTarefaKanban,
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
