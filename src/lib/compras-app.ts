import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import { lojaDaUrl } from "./compras-comum";
import { CORES_ETIQUETA } from "./cores";
import { buscarMetadadosUrl } from "./links-app";
import type { CategoriaProduto, DadosCompras, EstadoProduto, LojaProduto, PrioridadeProduto, Produto } from "./tipos";

/**
 * A app de Compras: uma lista de desejos. Mesmo esquema de Links — um JSON
 * só (`_compras/compras.json`) com fila de gravação, e as imagens como
 * arquivos reais em `_compras/imagens/`. Não tem lixeira: "desisti" é o
 * estado de quem saiu da lista sem ter sido comprado, e volta com um clique.
 */
const PASTA_COMPRAS = "_compras";
const ARQUIVO_DADOS = path.join(RAIZ, PASTA_COMPRAS, "compras.json");
const PASTA_IMAGENS = path.join(RAIZ, PASTA_COMPRAS, "imagens");

const PRIORIDADES: PrioridadeProduto[] = ["muito", "quero", "talvez"];

function gerarId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function lerDados(): Promise<DadosCompras> {
  try {
    const dados = JSON.parse(await fs.readFile(ARQUIVO_DADOS, "utf8")) as Partial<DadosCompras>;
    return { categorias: dados.categorias ?? [], produtos: dados.produtos ?? [] };
  } catch {
    return { categorias: [], produtos: [] };
  }
}

async function gravarDados(dados: DadosCompras): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_DADOS), { recursive: true });
  await fs.writeFile(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), "utf8");
}

let fila: Promise<unknown> = Promise.resolve();

async function alterar<T>(mudanca: (dados: DadosCompras) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const dados = await lerDados();
    const resultado = await mudanca(dados);
    await gravarDados(dados);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function obterDados(): Promise<DadosCompras> {
  return lerDados();
}

function exigirProduto(dados: DadosCompras, id: string): Produto {
  const produto = dados.produtos.find((item) => item.id === id);
  if (!produto) throw new Error("Produto não encontrado.");
  return produto;
}

// ------------------------------------------------------------- categorias

export async function criarCategoria(nome: string): Promise<DadosCompras> {
  return alterar((dados) => {
    const limpo = nome.trim().slice(0, 60);
    if (!limpo) throw new Error("Dê um nome para a categoria.");
    if (dados.categorias.some((categoria) => categoria.nome.toLowerCase() === limpo.toLowerCase())) {
      throw new Error("Já existe uma categoria com esse nome.");
    }
    dados.categorias.push({
      id: gerarId(),
      nome: limpo,
      cor: CORES_ETIQUETA[dados.categorias.length % CORES_ETIQUETA.length],
    });
    return dados;
  });
}

export async function atualizarCategoria(id: string, campos: { nome?: string; cor?: string }): Promise<DadosCompras> {
  return alterar((dados) => {
    const categoria = dados.categorias.find((item) => item.id === id);
    if (!categoria) throw new Error("Categoria não encontrada.");
    if (campos.nome !== undefined) {
      const limpo = campos.nome.trim().slice(0, 60);
      if (!limpo) throw new Error("Dê um nome para a categoria.");
      categoria.nome = limpo;
    }
    if (campos.cor !== undefined) categoria.cor = campos.cor;
    return dados;
  });
}

/** Os produtos da categoria excluída ficam "sem categoria" — não somem. */
export async function excluirCategoria(id: string): Promise<DadosCompras> {
  return alterar((dados) => {
    dados.categorias = dados.categorias.filter((item) => item.id !== id);
    for (const produto of dados.produtos) if (produto.categoriaId === id) produto.categoriaId = null;
    return dados;
  });
}

export async function reordenarCategorias(ordemIds: string[]): Promise<DadosCompras> {
  return alterar((dados) => {
    const porId = new Map(dados.categorias.map((categoria) => [categoria.id, categoria]));
    const reordenadas = ordemIds.map((id) => porId.get(id)).filter((c): c is CategoriaProduto => !!c);
    for (const categoria of dados.categorias) if (!ordemIds.includes(categoria.id)) reordenadas.push(categoria);
    dados.categorias = reordenadas;
    return dados;
  });
}

// --------------------------------------------------------------- imagens

export type ImagemBuscada = { base64: string; tipo: string } | null | undefined;

const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Grava a imagem em disco e devolve o nome do arquivo (guardado em `Produto.imagem`). */
async function salvarImagem(idProduto: string, imagem: ImagemBuscada): Promise<string | null> {
  if (!imagem) return null;
  const extensao = EXTENSAO_POR_TIPO[imagem.tipo];
  if (!extensao) return null;
  await fs.mkdir(PASTA_IMAGENS, { recursive: true });
  // Sufixo de tempo: trocar a imagem gera arquivo novo, e o antigo em cache do navegador não engana.
  const arquivo = `${idProduto}-${Date.now().toString(36)}.${extensao}`;
  await fs.writeFile(path.join(PASTA_IMAGENS, arquivo), Buffer.from(imagem.base64, "base64"));
  return arquivo;
}

async function apagarImagem(arquivo: string | null): Promise<void> {
  if (!arquivo) return;
  await fs.rm(path.join(PASTA_IMAGENS, arquivo), { force: true });
}

/** Nome e imagem de um produto a partir da página da loja — o mesmo fetch de Links (`og:title`/`og:image`). */
export async function buscarDadosDoProduto(url: string): Promise<{ nome: string | null; imagem: ImagemBuscada }> {
  const { titulo, capa } = await buscarMetadadosUrl(url);
  return { nome: titulo, imagem: capa };
}

// -------------------------------------------------------------- produtos

export type CamposProduto = {
  nome: string;
  modelo: string;
  categoriaId: string | null;
  prioridade: PrioridadeProduto;
  observacoes: string;
  lojas: { id?: string; url: string; loja: string; preco: number | null }[];
};

function limparLojas(lojas: CamposProduto["lojas"]): LojaProduto[] {
  return lojas
    .map((loja) => ({
      id: loja.id ?? gerarId(),
      url: loja.url.trim().slice(0, 2000),
      loja: loja.loja.trim().slice(0, 80) || lojaDaUrl(loja.url),
      preco: loja.preco !== null && Number.isFinite(loja.preco) && loja.preco >= 0 ? loja.preco : null,
    }))
    .filter((loja) => loja.url || loja.loja);
}

function validarCampos(campos: CamposProduto): void {
  if (!campos.nome.trim()) throw new Error("Dê um nome para o produto.");
  if (!PRIORIDADES.includes(campos.prioridade)) throw new Error("Prioridade inválida.");
}

export async function criarProduto(campos: CamposProduto, imagem?: ImagemBuscada): Promise<Produto> {
  validarCampos(campos);
  const id = gerarId();
  const nomeImagem = await salvarImagem(id, imagem);
  return alterar((dados) => {
    if (campos.categoriaId && !dados.categorias.some((c) => c.id === campos.categoriaId)) {
      throw new Error("Categoria não encontrada.");
    }
    const agora = new Date().toISOString();
    const produto: Produto = {
      id,
      nome: campos.nome.trim().slice(0, 200),
      modelo: campos.modelo.trim().slice(0, 300),
      categoriaId: campos.categoriaId,
      prioridade: campos.prioridade,
      imagem: nomeImagem,
      observacoes: campos.observacoes.trim().slice(0, 4000),
      lojas: limparLojas(campos.lojas),
      estado: "quero",
      compradoEm: null,
      precoPago: null,
      lojaDaCompra: "",
      criadoEm: agora,
      atualizadoEm: agora,
    };
    dados.produtos.push(produto);
    return produto;
  });
}

/** `imagem` `undefined` mantém a atual; `null` tira; objeto troca. */
export async function atualizarProduto(id: string, campos: CamposProduto, imagem?: ImagemBuscada): Promise<DadosCompras> {
  validarCampos(campos);
  const nomeImagem = imagem !== undefined ? await salvarImagem(id, imagem) : undefined;
  return alterar(async (dados) => {
    const produto = exigirProduto(dados, id);
    if (campos.categoriaId && !dados.categorias.some((c) => c.id === campos.categoriaId)) {
      throw new Error("Categoria não encontrada.");
    }
    produto.nome = campos.nome.trim().slice(0, 200);
    produto.modelo = campos.modelo.trim().slice(0, 300);
    produto.categoriaId = campos.categoriaId;
    produto.prioridade = campos.prioridade;
    produto.observacoes = campos.observacoes.trim().slice(0, 4000);
    produto.lojas = limparLojas(campos.lojas);
    if (nomeImagem !== undefined) {
      await apagarImagem(produto.imagem);
      produto.imagem = nomeImagem;
    }
    produto.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

/** Mais uma loja num produto que já existe — o caminho do "já está na lista" da extensão. */
export async function adicionarLoja(id: string, loja: { url: string; loja: string; preco: number | null }): Promise<DadosCompras> {
  return alterar((dados) => {
    const produto = exigirProduto(dados, id);
    const [limpa] = limparLojas([loja]);
    if (!limpa) throw new Error("Informe a loja ou o link.");
    produto.lojas.push(limpa);
    produto.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

export async function mudarEstado(
  id: string,
  estado: EstadoProduto,
  compra?: { compradoEm: string; precoPago: number | null; lojaDaCompra: string },
): Promise<DadosCompras> {
  return alterar((dados) => {
    const produto = exigirProduto(dados, id);
    produto.estado = estado;
    if (estado === "comprado") {
      produto.compradoEm = compra?.compradoEm || new Date().toISOString().slice(0, 10);
      produto.precoPago = compra?.precoPago ?? null;
      produto.lojaDaCompra = compra?.lojaDaCompra.trim().slice(0, 80) ?? "";
    } else {
      produto.compradoEm = null;
      produto.precoPago = null;
      produto.lojaDaCompra = "";
    }
    produto.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

/** Apaga de vez — sem lixeira aqui; quem só quer tirar da lista usa "desisti". */
export async function excluirProduto(id: string): Promise<DadosCompras> {
  return alterar(async (dados) => {
    const produto = exigirProduto(dados, id);
    await apagarImagem(produto.imagem);
    dados.produtos = dados.produtos.filter((item) => item.id !== id);
    return dados;
  });
}

/** Produto que já tem essa URL em alguma loja — para o "já está na lista" ao salvar de novo. */
export async function acharPorUrl(url: string): Promise<{ id: string; nome: string } | null> {
  const alvo = url.trim().toLowerCase().replace(/\/+$/, "");
  if (!alvo) return null;
  const dados = await lerDados();
  const achado = dados.produtos.find((produto) =>
    produto.lojas.some((loja) => loja.url.trim().toLowerCase().replace(/\/+$/, "") === alvo),
  );
  return achado ? { id: achado.id, nome: achado.nome } : null;
}

export type ProdutoAchado = Pick<Produto, "id" | "nome" | "modelo" | "estado" | "imagem"> & { categoria: string | null };

export async function buscarProdutos(termo: string): Promise<ProdutoAchado[]> {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return [];
  const dados = await lerDados();
  const nomeDaCategoria = new Map(dados.categorias.map((c) => [c.id, c.nome]));
  return dados.produtos
    .filter(
      (produto) =>
        produto.nome.toLowerCase().includes(alvo) ||
        produto.modelo.toLowerCase().includes(alvo) ||
        produto.lojas.some((loja) => loja.loja.toLowerCase().includes(alvo)),
    )
    .sort((a, b) => (a.estado === b.estado ? b.atualizadoEm.localeCompare(a.atualizadoEm) : a.estado === "quero" ? -1 : 1))
    .slice(0, 8)
    .map(({ id, nome, modelo, estado, imagem, categoriaId }) => ({
      id,
      nome,
      modelo,
      estado,
      imagem,
      categoria: categoriaId ? (nomeDaCategoria.get(categoriaId) ?? null) : null,
    }));
}
