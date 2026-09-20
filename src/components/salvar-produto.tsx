"use client";

import { Check, ImageIcon, ShoppingCart } from "lucide-react";
import { useEffect, useState } from "react";

import { acaoAdicionarLoja, acaoBuscarDadosDoProduto, acaoCriarCategoria, acaoCriarProduto } from "@/app/acoes-compras";
import type { ImagemBuscada } from "@/lib/compras-app";
import { interpretarPreco, lojaDaUrl } from "@/lib/compras-comum";
import type { CategoriaProduto, PrioridadeProduto } from "@/lib/tipos";

import { SeletorCategoria, SeletorPrioridade } from "./compras";
import { Aviso, Botao, Campo, Rotulo } from "./ui";

/**
 * O formulário compacto da extensão: a página já entregou URL e título, o
 * resto é decidir categoria, prioridade e anotar o preço visto. Se a URL já
 * está em algum produto, oferece juntar como outra loja em vez de duplicar.
 */
export function SalvarProdutoPopup({
  categorias: categoriasIniciais,
  url,
  tituloInicial,
  duplicado,
}: {
  categorias: CategoriaProduto[];
  url: string;
  tituloInicial: string;
  duplicado: { id: string; nome: string } | null;
}) {
  const [categorias, definirCategorias] = useState(categoriasIniciais);
  const [nome, definirNome] = useState(tituloInicial);
  const [modelo, definirModelo] = useState("");
  const [categoriaId, definirCategoriaId] = useState<string | null>(null);
  const [prioridade, definirPrioridade] = useState<PrioridadeProduto>("quero");
  const [precoTexto, definirPrecoTexto] = useState("");
  const [loja, definirLoja] = useState(lojaDaUrl(url));
  const [imagem, definirImagem] = useState<ImagemBuscada>(undefined);
  const [buscando, definirBuscando] = useState(Boolean(url));
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const [salvo, definirSalvo] = useState<"novo" | "loja" | null>(null);
  // Só depois de escolher "salvar como produto novo" o formulário aparece quando há duplicado.
  const [ignorandoDuplicado, definirIgnorandoDuplicado] = useState(false);

  useEffect(() => {
    if (!url) return;
    let cancelado = false;
    acaoBuscarDadosDoProduto(url)
      .then((resultado) => {
        if (cancelado) return;
        // `og:title` costuma ser mais limpo que o `document.title` da aba (sem " | Loja" no fim).
        if (resultado.nome) definirNome((atual) => (atual.trim() ? atual : resultado.nome!));
        definirImagem(resultado.imagem ?? null);
      })
      .finally(() => {
        if (!cancelado) definirBuscando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [url]);

  async function criarCategoria(nomeNovo: string) {
    const resposta = await acaoCriarCategoria(nomeNovo);
    if (!resposta.ok) return { erro: resposta.erro };
    definirCategorias(resposta.dados.categorias);
    const nova = resposta.dados.categorias.find((c) => c.nome.toLowerCase() === nomeNovo.trim().toLowerCase());
    return { id: nova?.id ?? null };
  }

  async function salvar() {
    if (!nome.trim()) {
      definirErro("Dê um nome para o produto.");
      return;
    }
    definirSalvando(true);
    const resposta = await acaoCriarProduto(
      {
        nome,
        modelo,
        categoriaId,
        prioridade,
        observacoes: "",
        lojas: url ? [{ url, loja, preco: interpretarPreco(precoTexto) }] : [],
      },
      imagem ?? undefined,
    );
    definirSalvando(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirSalvo("novo");
  }

  async function juntarComoLoja() {
    if (!duplicado) return;
    definirSalvando(true);
    const resposta = await acaoAdicionarLoja(duplicado.id, { url, loja, preco: interpretarPreco(precoTexto) });
    definirSalvando(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirSalvo("loja");
  }

  if (salvo) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2 bg-papel px-6 text-center">
        <Check size={22} className="text-[var(--realce)]" />
        <p className="text-[13px] font-medium text-tinta">{salvo === "novo" ? "Produto salvo!" : `Loja adicionada em ${duplicado?.nome}.`}</p>
        <a href="/compras" target="_blank" rel="noopener" className="text-[12px] text-tinta-2 underline hover:text-tinta">
          Abrir a lista de compras
        </a>
      </div>
    );
  }

  const previa = imagem ? `data:${imagem.tipo};base64,${imagem.base64}` : null;

  if (duplicado && !ignorandoDuplicado) {
    return (
      <div className="flex h-screen flex-col bg-papel px-5 py-4">
        <Cabecalho />
        <p className="text-[13px] text-tinta">
          Esse link já está na lista, em <strong>{duplicado.nome}</strong>.
        </p>
        <div className="mt-3">
          <Rotulo>Preço visto (opcional)</Rotulo>
          <Campo value={precoTexto} inputMode="decimal" placeholder="R$" onChange={(evento) => definirPrecoTexto(evento.target.value)} />
        </div>
        <Aviso>{erro}</Aviso>
        <div className="mt-auto space-y-2">
          <Botao variante="primario" onClick={juntarComoLoja} disabled={salvando} className="w-full justify-center">
            Adicionar como outra loja
          </Botao>
          <Botao variante="sutil" onClick={() => definirIgnorandoDuplicado(true)} className="w-full justify-center">
            Salvar como produto novo
          </Botao>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col gap-3 overflow-y-auto bg-papel px-5 py-4">
      <Cabecalho />

      <div className="flex gap-3">
        {previa ? (
          // eslint-disable-next-line @next/next/no-img-element -- prévia local.
          <img src={previa} alt="" className="size-16 shrink-0 rounded-lg bg-superficie-alta object-cover" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-realce-fraco text-tinta-3">
            <ImageIcon size={18} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <Rotulo>Nome</Rotulo>
          <Campo autoFocus value={nome} onChange={(evento) => definirNome(evento.target.value)} />
          <p className="mt-1 truncate text-[11px] text-tinta-3">{buscando ? "Buscando nome e imagem…" : url || "Sem link — abra este atalho a partir da página do produto."}</p>
        </div>
      </div>

      <div>
        <Rotulo>Modelo / especificação</Rotulo>
        <Campo value={modelo} onChange={(evento) => definirModelo(evento.target.value)} placeholder="Tamanho, cor, versão…" />
      </div>

      <div>
        <Rotulo>Categoria</Rotulo>
        <SeletorCategoria categorias={categorias} valor={categoriaId} aoMudar={definirCategoriaId} aoCriar={criarCategoria} />
      </div>

      <div>
        <Rotulo>Prioridade</Rotulo>
        <SeletorPrioridade valor={prioridade} aoMudar={definirPrioridade} />
      </div>

      {url ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Rotulo>Loja</Rotulo>
            <Campo value={loja} onChange={(evento) => definirLoja(evento.target.value)} />
          </div>
          <div>
            <Rotulo>Preço visto</Rotulo>
            <Campo value={precoTexto} inputMode="decimal" placeholder="R$" onChange={(evento) => definirPrecoTexto(evento.target.value)} />
          </div>
        </div>
      ) : null}

      <Aviso>{erro}</Aviso>

      <Botao variante="primario" onClick={salvar} disabled={salvando || !nome.trim()} className="mt-auto w-full justify-center">
        {salvando ? "Salvando…" : "Salvar na lista"}
      </Botao>
    </div>
  );
}

function Cabecalho() {
  return (
    <div className="mb-1 flex items-center gap-2">
      <ShoppingCart size={16} className="text-[var(--realce)]" />
      <h1 className="text-[14px] font-bold tracking-[-0.02em]">Salvar produto</h1>
    </div>
  );
}
