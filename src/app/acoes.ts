"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  buscar,
  converterFormato,
  criarNota,
  criarPasta,
  escreverNota,
  lerNota,
  listarNotas,
  moverItem,
  renomearItem,
  reordenarNota,
  reordenarNotasPara,
  reordenarPasta,
  reordenarPastasPara,
  salvarAnexo,
} from "@/lib/arquivos";
import { PASTA_ENTRADA, PASTA_GERAL, juntar, limparNome, pastaDe } from "@/lib/caminhos";
import { criarEtiqueta, editarEtiqueta, excluirEtiqueta } from "@/lib/etiquetas";
import { exportarSecao, exportarTudo } from "@/lib/exportar";
import { alternarTarefa } from "@/lib/formatacao";
import { lerVersao, listarVersoes, registrarVersao } from "@/lib/historico";
import { atualizarIndice, entradaDaNota, entradaDaPasta } from "@/lib/indice";
import { apagarDeVez, enviarParaLixeira, esvaziarLixeira, restaurar } from "@/lib/lixeira";
import { criarModelo, editarModelo, excluirModelo, lerModelo } from "@/lib/modelos";
import { urlDaNota, urlDaSecao } from "@/lib/rotas";
import type { ResultadoBusca, VersaoHistorico } from "@/lib/tipos";

/**
 * Ponte entre a interface e o disco. Tudo que altera arquivo passa por aqui,
 * com o texto de entrada validado antes de chegar no sistema de arquivos.
 */

export type Resposta = { ok: true; mensagem?: string } | { ok: false; erro: string };

const caminhoValido = z.string().min(1).max(400);
const formatoValido = z.enum(["md", "txt"]);

/** Erros de escrita viram mensagem para a interface, não tela de erro do Next. */
async function tentar(acao: () => Promise<void>): Promise<Resposta> {
  try {
    await acao();
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para concluir" };
  }
}

function atualizarTudo(): void {
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------- estrutura

export async function acaoCriarCaderno(nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarPasta("", z.string().min(1).max(120).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoCriarSecao(pai: string, nome: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarPasta(caminhoValido.parse(pai), z.string().min(1).max(120).parse(nome));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoCriarPagina(
  pasta: string,
  titulo: string,
  formato: "md" | "txt",
  modeloId?: string,
): Promise<void> {
  // Texto simples não tem modelo (a marcação do modelo é markdown); um id
  // vindo de um formato trocado na hora H simplesmente não se aplica.
  const conteudoInicial =
    formato === "md" && modeloId ? ((await lerModelo(modeloId))?.conteudo ?? "") : "";
  const caminho = await criarNota(
    caminhoValido.parse(pasta),
    z.string().max(120).parse(titulo),
    formatoValido.parse(formato),
    conteudoInicial,
  );
  atualizarTudo();
  // Nota nova já abre em edição — não faria sentido abrir uma folha vazia em leitura.
  redirect(`${urlDaNota(caminho)}?editando=1`);
}

/** Captura rápida: uma folha em branco no caderno de entrada, com data no nome. */
export async function acaoCapturaRapida(): Promise<void> {
  const agora = new Date();
  const carimbo = agora
    .toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[/:]/g, "-")
    .replace(", ", " ");
  // Página sempre dentro de uma seção — "Geral" é a seção padrão do caderno
  // de entrada, criada sozinha desde o primeiro uso do app.
  const caminho = await criarNota(juntar(PASTA_ENTRADA, PASTA_GERAL), `Ideia ${carimbo}`, "md");
  atualizarTudo();
  redirect(`${urlDaNota(caminho)}?editando=1`);
}

/**
 * Nota do dia: sempre a mesma página por data, no caderno de entrada. Existe
 * ainda hoje → abre ela (modo leitura, como qualquer nota); não existe →
 * cria em branco e já abre para escrever.
 */
export async function acaoAbrirNotaDoDia(): Promise<void> {
  const titulo = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const nomeDoArquivo = `${limparNome(titulo)}.md`;
  const pastaDoDia = juntar(PASTA_ENTRADA, PASTA_GERAL);
  const caminhoEsperado = juntar(pastaDoDia, nomeDoArquivo);

  const existente = await lerNota(caminhoEsperado);
  if (existente) {
    redirect(urlDaNota(caminhoEsperado));
  }

  const caminhoCriado = await criarNota(pastaDoDia, titulo, "md");
  atualizarTudo();
  redirect(`${urlDaNota(caminhoCriado)}?editando=1`);
}

export async function acaoRenomear(caminho: string, novoNome: string): Promise<Resposta> {
  try {
    const alvo = await renomearItem(caminhoValido.parse(caminho), novoNome);
    atualizarTudo();
    return { ok: true, mensagem: alvo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para renomear" };
  }
}

export async function acaoMover(caminho: string, novaPasta: string): Promise<Resposta> {
  try {
    const alvo = await moverItem(caminhoValido.parse(caminho), novaPasta);
    atualizarTudo();
    return { ok: true, mensagem: alvo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para mover" };
  }
}

export async function acaoExcluir(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await enviarParaLixeira(caminhoValido.parse(caminho));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoReordenar(
  caminho: string,
  direcao: -1 | 1,
  tipo: "nota" | "pasta",
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    if (tipo === "nota") await reordenarNota(validado, direcao);
    else await reordenarPasta(validado, direcao);
  });
  atualizarTudo();
  return resposta;
}

/**
 * Regrava a ordem de todas as páginas de uma seção de uma vez — usada ao
 * soltar uma página arrastada. `pasta` é só para validar que todo caminho
 * da lista é mesmo dali; a ordem de verdade é a lista inteira, já com o
 * item arrastado na posição nova.
 */
export async function acaoReordenarNotasPara(pasta: string, ordem: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const pastaValidada = caminhoValido.parse(pasta);
    const lista = z.array(caminhoValido).max(2000).parse(ordem);
    if (lista.some((caminho) => pastaDe(caminho) !== pastaValidada)) {
      throw new Error("Uma das páginas não é desta seção");
    }
    await reordenarNotasPara(lista);
  });
  atualizarTudo();
  return resposta;
}

/** Mesma ideia de `acaoReordenarNotasPara`, para as seções de um caderno. */
export async function acaoReordenarSecoesPara(caderno: string, ordem: string[]): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const cadernoValidado = caminhoValido.parse(caderno);
    const lista = z.array(caminhoValido).max(500).parse(ordem);
    if (lista.some((caminho) => pastaDe(caminho) !== cadernoValidado)) {
      throw new Error("Uma das seções não é deste caderno");
    }
    await reordenarPastasPara(lista);
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirIconeCaderno(caminho: string, icone: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    // Um emoji só; o campo é decorativo e não deve virar depósito de texto.
    const iconeValido = z.string().min(1).max(8).parse(icone);
    await atualizarIndice((indice) => {
      entradaDaPasta(indice, validado).icone = iconeValido;
    });
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirCorCaderno(caminho: string, cor: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const corValida = z.string().regex(/^#[0-9a-fA-F]{6}$/).parse(cor);
    await atualizarIndice((indice) => {
      entradaDaPasta(indice, validado).cor = corValida;
    });
  });
  atualizarTudo();
  return resposta;
}

// -------------------------------------------------------------------- notas

export async function acaoSalvarNota(caminho: string, conteudo: string): Promise<Resposta> {
  try {
    await escreverNota(caminhoValido.parse(caminho), z.string().parse(conteudo));
    // A lista de páginas mostra um trecho do conteúdo, então precisa acompanhar.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para salvar" };
  }
}

const EXTENSAO_IMAGEM_VALIDA = z.enum(["png", "jpg", "jpeg", "gif", "webp"]);
// 15 MB é bem mais que um print de tela comum, com folga de sobra.
const LIMITE_ANEXO_BYTES = 15 * 1024 * 1024;

/** Colar imagem: salva o arquivo em `_anexos/` e devolve o caminho relativo. */
export async function acaoColarImagem(
  caminhoDaNota: string,
  extensao: string,
  dadosBase64: string,
): Promise<Resposta> {
  try {
    const caminho = caminhoValido.parse(caminhoDaNota);
    const ext = EXTENSAO_IMAGEM_VALIDA.parse(extensao);
    const bytes = Buffer.from(z.string().max(25_000_000).parse(dadosBase64), "base64");
    if (bytes.byteLength === 0) throw new Error("Imagem vazia");
    if (bytes.byteLength > LIMITE_ANEXO_BYTES) {
      throw new Error("Imagem grande demais (máximo 15 MB)");
    }
    const caminhoRelativo = await salvarAnexo(caminho, ext, bytes);
    return { ok: true, mensagem: caminhoRelativo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para colar a imagem" };
  }
}

export async function acaoConverterFormato(
  caminho: string,
  formato: "md" | "txt",
): Promise<Resposta> {
  try {
    const alvo = await converterFormato(caminhoValido.parse(caminho), formatoValido.parse(formato));
    atualizarTudo();
    return { ok: true, mensagem: alvo };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para converter" };
  }
}

export async function acaoAlternarFavorita(caminho: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    await atualizarIndice((indice) => {
      const entrada = entradaDaNota(indice, validado);
      entrada.favorita = !entrada.favorita;
    });
  });
  atualizarTudo();
  return resposta;
}

/** Vira (ou desmarca) a N-ésima tarefa de uma nota — usado pelo painel de tarefas agregadas. */
export async function acaoAlternarTarefaEm(caminho: string, indiceDaTarefa: number): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const indice = z.number().int().min(0).parse(indiceDaTarefa);
    const nota = await lerNota(validado);
    if (!nota) throw new Error("Página não encontrada");
    await escreverNota(validado, alternarTarefa(nota.conteudo, indice));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoDefinirEtiquetasDaNota(
  caminho: string,
  etiquetas: string[],
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const lista = z.array(z.string().max(60)).max(20).parse(etiquetas);
    await atualizarIndice((indice) => {
      entradaDaNota(indice, validado).etiquetas = [...new Set(lista)];
    });
  });
  atualizarTudo();
  return resposta;
}

// ---------------------------------------------------------------- histórico

export async function acaoListarVersoes(caminho: string): Promise<VersaoHistorico[]> {
  return listarVersoes(caminhoValido.parse(caminho));
}

export async function acaoLerVersao(caminho: string, id: string): Promise<string | null> {
  return lerVersao(caminhoValido.parse(caminho), z.string().max(120).parse(id));
}

export async function acaoRestaurarVersao(caminho: string, id: string): Promise<Resposta> {
  return tentar(async () => {
    const validado = caminhoValido.parse(caminho);
    const conteudo = await lerVersao(validado, z.string().max(120).parse(id));
    if (conteudo === null) throw new Error("Versão não encontrada");

    // O texto atual vira uma versão antes de ser substituído.
    const atual = await lerNota(validado);
    if (atual) await registrarVersao(validado, atual.conteudo, true);

    await escreverNota(validado, conteudo);
    atualizarTudo();
  });
}

// ----------------------------------------------------------------- lixeira

export async function acaoRestaurarDaLixeira(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await restaurar(z.string().max(80).parse(id));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoApagarDaLixeira(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await apagarDeVez(z.string().max(80).parse(id));
  });
  atualizarTudo();
  return resposta;
}

export async function acaoEsvaziarLixeira(): Promise<Resposta> {
  const resposta = await tentar(esvaziarLixeira);
  atualizarTudo();
  return resposta;
}

// --------------------------------------------------------------- etiquetas

export async function acaoCriarEtiqueta(
  nome: string,
  cor: string,
  descricao: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarEtiqueta(
      z.string().min(1).max(40).parse(nome),
      z.string().parse(cor),
      z.string().max(140).parse(descricao),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoEditarEtiqueta(
  id: string,
  nome: string,
  cor: string,
  descricao: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await editarEtiqueta(z.string().max(60).parse(id), {
      nome: z.string().min(1).max(40).parse(nome),
      cor: z.string().parse(cor),
      descricao: z.string().max(140).parse(descricao),
    });
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirEtiqueta(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirEtiqueta(z.string().max(60).parse(id));
  });
  atualizarTudo();
  return resposta;
}

// ----------------------------------------------------------------- modelos

export async function acaoCriarModelo(
  nome: string,
  descricao: string,
  conteudo: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await criarModelo(
      z.string().min(1).max(60).parse(nome),
      z.string().max(140).parse(descricao),
      z.string().max(50_000).parse(conteudo),
    );
  });
  atualizarTudo();
  return resposta;
}

export async function acaoEditarModelo(
  id: string,
  nome: string,
  descricao: string,
  conteudo: string,
): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await editarModelo(z.string().max(60).parse(id), {
      nome: z.string().min(1).max(60).parse(nome),
      descricao: z.string().max(140).parse(descricao),
      conteudo: z.string().max(50_000).parse(conteudo),
    });
  });
  atualizarTudo();
  return resposta;
}

export async function acaoExcluirModelo(id: string): Promise<Resposta> {
  const resposta = await tentar(async () => {
    await excluirModelo(z.string().max(60).parse(id));
  });
  atualizarTudo();
  return resposta;
}

// ------------------------------------------------------------------- busca

// --------------------------------------------------------------- exportar

/** Devolve o conteúdo pronto; quem baixa é o navegador. */
export async function acaoExportarSecao(
  caminho: string,
): Promise<{ nome: string; conteudo: string }> {
  return exportarSecao(caminhoValido.parse(caminho));
}

/** O vault inteiro, todo caderno, numa única exportação. */
export async function acaoExportarTudo(): Promise<{ nome: string; conteudo: string }> {
  return exportarTudo();
}

// ------------------------------------------------------------------- busca

export async function acaoBuscar(termo: string): Promise<ResultadoBusca[]> {
  return buscar(z.string().max(120).parse(termo));
}

/** Usada pela lista de páginas depois de excluir: para onde ir agora? */
export async function acaoDestinoAposExcluir(caminho: string): Promise<string> {
  const pasta = pastaDe(caminho);
  const restantes = await listarNotas(pasta);
  if (restantes.length > 0) return urlDaNota(restantes[0].caminho);
  return pasta ? urlDaSecao(pasta) : "/";
}
