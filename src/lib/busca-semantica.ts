import fs from "node:fs/promises";
import path from "node:path";

import { lerArvore, lerNota, listarNotas, resumirConteudo } from "./arquivos";
import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { gravarJson } from "./gravacao";
import type { Caderno } from "./tipos";

/**
 * Busca semântica dentro de um caderno: acha páginas por significado, não
 * por palavra exata, sem sair da máquina. O modelo de embeddings roda no
 * próprio processo (`@huggingface/transformers`, ONNX em CPU) — nenhum
 * texto sai daqui, nem para indexar nem para buscar.
 *
 * Nível 1 do que foi pedido: só busca (lista de páginas relevantes), sem
 * chat nem resposta gerada. Um vetor por página inteira (não por
 * parágrafo) — o resultado é "quais anotações falam disso", não um trecho
 * específico dentro delas.
 */

const ARQUIVO_INDICE = path.join(RAIZ, PASTA_SISTEMA, "busca-semantica.json");
const MODELO = "Xenova/all-MiniLM-L6-v2";
// ~2000 caracteres já cobre bem mais que os ~256 tokens que o modelo olha
// de qualquer forma — cortar aqui evita mandar um texto enorme pro
// tokenizer à toa.
const LIMITE_CARACTERES = 2000;
const MAXIMO_RESULTADOS = 12;

type ItemIndice = { caminho: string; atualizadoEm: string; vetor: number[] };
type IndiceSemantico = { versao: number; itens: ItemIndice[] };

export type ResultadoBuscaSemantica = {
  caminho: string;
  titulo: string;
  trecho: string;
  pontuacao: number;
};

// O pipeline de extração é caro de carregar (baixa e inicializa o modelo
// na primeira vez) — uma promessa só, reaproveitada por todas as chamadas
// deste processo, em vez de recarregar a cada busca ou cada página salva.
function carregarExtrator() {
  return (async () => {
    const { pipeline, env } = await import("@huggingface/transformers");
    // Cache fora de `node_modules` (sobrevive a `npm install`) e fora de
    // `dados/` (não é conteúdo da pessoa, é um artefato do modelo).
    env.cacheDir = path.join(process.cwd(), ".cache", "transformers");
    return pipeline("feature-extraction", MODELO);
  })();
}

let extratorPromessa: ReturnType<typeof carregarExtrator> | null = null;

async function extrator() {
  if (!extratorPromessa) {
    // Se o carregamento falhar (sem internet na primeira vez, por exemplo),
    // a promessa rejeitada não pode ficar guardada — senão toda busca dali
    // em diante falharia até reiniciar o serviço. Zera para a próxima
    // chamada tentar de novo.
    extratorPromessa = carregarExtrator().catch((erro) => {
      extratorPromessa = null;
      throw erro;
    });
  }
  return extratorPromessa;
}

/** O vetor de um texto — mesma função usada para indexar páginas e para a pergunta na hora da busca. */
export async function gerarEmbedding(texto: string): Promise<number[]> {
  const modelo = await extrator();
  const saida = await modelo(texto.slice(0, LIMITE_CARACTERES), { pooling: "mean", normalize: true });
  return Array.from(saida.data);
}

/** Os vetores já saem normalizados (`normalize: true`) — o produto escalar já é a similaridade de cosseno. */
function similaridade(a: number[], b: number[]): number {
  let soma = 0;
  for (let i = 0; i < a.length; i++) soma += a[i] * b[i];
  return soma;
}

async function carregarIndice(): Promise<IndiceSemantico> {
  try {
    const bruto = await fs.readFile(ARQUIVO_INDICE, "utf8");
    const lido = JSON.parse(bruto) as Partial<IndiceSemantico>;
    return { versao: 1, itens: Array.isArray(lido.itens) ? lido.itens : [] };
  } catch {
    return { versao: 1, itens: [] };
  }
}

async function salvarIndice(indice: IndiceSemantico): Promise<void> {
  await gravarJson(ARQUIVO_INDICE, indice, true);
}

// Mesma fila de `indice.ts`: sem isso, duas páginas indexando ao mesmo
// tempo (ex.: reindexação em lote) podiam se atropelar e uma escrita
// perder a outra.
let fila: Promise<unknown> = Promise.resolve();
async function alterarIndice(alterar: (indice: IndiceSemantico) => void): Promise<void> {
  const proxima = fila.then(async () => {
    const indice = await carregarIndice();
    alterar(indice);
    await salvarIndice(indice);
  });
  fila = proxima.catch(() => {});
  await proxima;
}

/**
 * Quanto esperar depois do último salvamento antes de reindexar a página.
 * O autosave grava a cada pausa de menos de um segundo na digitação; gerar
 * um embedding (modelo na CPU) e reescrever o índice inteiro a cada pausa
 * mantinha o processo ocupado durante toda uma sessão de escrita. Com a
 * espera, uma sessão de digitação vira uma indexação só, no fim — e a
 * busca de verdade ainda reindexa na hora o que faltar (`garantirIndiceDoCaderno`).
 */
const ESPERA_REINDEXAR_MS = 15_000;
const reindexacoesPendentes = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * Agenda a reindexação de uma página, adiando de novo a cada chamada — para
 * o gatilho do salvamento automático. `carregar` é chamado só na hora, para
 * indexar o conteúdo final e não o do momento em que foi agendado.
 */
export function agendarIndexacao(
  caminho: string,
  carregar: () => Promise<{ titulo: string; conteudo: string; atualizadoEm: string } | null>,
): void {
  const pendente = reindexacoesPendentes.get(caminho);
  if (pendente) clearTimeout(pendente);
  reindexacoesPendentes.set(
    caminho,
    setTimeout(() => {
      reindexacoesPendentes.delete(caminho);
      carregar()
        .then((nota) => nota && indexarPagina(caminho, nota.titulo, nota.conteudo, nota.atualizadoEm))
        .catch(() => {
          // Sem modelo ainda (primeira vez baixando, sem internet…): a busca
          // de verdade reindexa o que faltar na hora de procurar.
        });
    }, ESPERA_REINDEXAR_MS),
  );
}

/** Uma página que deixou de existir nesse caminho não precisa mais ser indexada nele. */
export function cancelarIndexacao(caminho: string): void {
  const pendente = reindexacoesPendentes.get(caminho);
  if (pendente) clearTimeout(pendente);
  reindexacoesPendentes.delete(caminho);
}

/** Reindexa uma página — chamado depois que ela é salva de verdade em disco. */
export async function indexarPagina(caminho: string, titulo: string, conteudo: string, atualizadoEm: string): Promise<void> {
  const vetor = await gerarEmbedding(`${titulo}\n\n${conteudo}`);
  await alterarIndice((indice) => {
    const existente = indice.itens.find((item) => item.caminho === caminho);
    if (existente) {
      existente.vetor = vetor;
      existente.atualizadoEm = atualizadoEm;
    } else {
      indice.itens.push({ caminho, atualizadoEm, vetor });
    }
  });
}

/** Tira uma página do índice — chamado ao excluir, mover ou renomear (o caminho velho não existe mais). */
export async function removerDoIndiceSemantico(caminho: string): Promise<void> {
  await alterarIndice((indice) => {
    indice.itens = indice.itens.filter((item) => item.caminho !== caminho);
  });
}

/**
 * Garante que todas as páginas do caderno estão no índice e em dia —
 * chamado no início de cada busca, então a primeira busca num caderno
 * nunca-indexado (ou com páginas editadas por fora do app) paga o preço
 * de indexar o que faltar antes de responder; da segunda em diante já
 * está tudo pronto pelo gatilho no salvamento.
 */
async function garantirIndiceDoCaderno(caderno: Caderno): Promise<void> {
  const indice = await carregarIndice();
  const porCaminho = new Map(indice.itens.map((item) => [item.caminho, item]));
  for (const secao of caderno.secoes) {
    for (const pagina of await listarNotas(secao.caminho)) {
      const existente = porCaminho.get(pagina.caminho);
      if (existente && existente.atualizadoEm === pagina.atualizadoEm) continue;
      const nota = await lerNota(pagina.caminho);
      if (!nota) continue;
      await indexarPagina(nota.caminho, nota.titulo, nota.conteudo, nota.atualizadoEm);
    }
  }
}

/** Busca semântica nas páginas de um caderno — devolve as mais parecidas com a pergunta, por significado. */
export async function buscarSemanticaNoCaderno(caminhoDoCaderno: string, pergunta: string): Promise<ResultadoBuscaSemantica[]> {
  const alvo = pergunta.trim();
  if (!alvo) return [];

  const arvore = await lerArvore();
  const caderno = arvore.find((item) => item.caminho === caminhoDoCaderno);
  if (!caderno) return [];

  await garantirIndiceDoCaderno(caderno);

  const caminhosDoCaderno = new Set<string>();
  for (const secao of caderno.secoes) {
    for (const pagina of await listarNotas(secao.caminho)) caminhosDoCaderno.add(pagina.caminho);
  }
  if (caminhosDoCaderno.size === 0) return [];

  const indice = await carregarIndice();
  const vetorDaPergunta = await gerarEmbedding(alvo);

  const ordenados = indice.itens
    .filter((item) => caminhosDoCaderno.has(item.caminho))
    .map((item) => ({ caminho: item.caminho, pontuacao: similaridade(vetorDaPergunta, item.vetor) }))
    .sort((a, b) => b.pontuacao - a.pontuacao)
    .slice(0, MAXIMO_RESULTADOS);

  const resultados: ResultadoBuscaSemantica[] = [];
  for (const { caminho, pontuacao } of ordenados) {
    const nota = await lerNota(caminho);
    if (!nota) continue;
    resultados.push({ caminho, titulo: nota.titulo, trecho: resumirConteudo(nota.conteudo, 130), pontuacao });
  }
  return resultados;
}
