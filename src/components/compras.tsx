"use client";

import clsx from "clsx";
import {
  Check,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  History,
  ImageIcon,
  ListChecks,
  Pencil,
  Plus,
  ShoppingBag,
  ShoppingCart,
  Tags,
  Trash2,
  Undo2,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  acaoAcharProdutoPorUrl,
  acaoAtualizarCategoria,
  acaoAtualizarProduto,
  acaoBuscarDadosDoProduto,
  acaoCriarCategoria,
  acaoCriarProduto,
  acaoExcluirCategoria,
  acaoExcluirProduto,
  acaoMudarEstadoProduto,
  acaoReordenarCategorias,
  type RespostaCompras,
} from "@/app/acoes-compras";
import { useAtalho } from "@/lib/atalhos";
import type { CamposProduto, ImagemBuscada } from "@/lib/compras-app";
import {
  PRIORIDADES,
  ROTULO_CURTO_PRIORIDADE,
  ROTULO_PRIORIDADE,
  formatarPreco,
  interpretarPreco,
  lojaDaUrl,
  menorPreco,
  ordenarProdutos,
  precoParaTexto,
} from "@/lib/compras-comum";
import { CORES_ETIQUETA } from "@/lib/cores";
import type { CategoriaProduto, DadosCompras, PrioridadeProduto, Produto } from "@/lib/tipos";

import { DialogoConfirmar, DialogoNome } from "./dialogos";
import { Aviso, Botao, BotaoIcone, Campo, Dialogo, Rotulo, Vazio } from "./ui";

const SEM_CATEGORIA = "__sem__";

/** Base64 puro, sem o prefixo "data:...;base64," — o mesmo que o servidor espera. */
function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

function formatarData(iso: string | null): string {
  if (!iso) return "";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

/**
 * A app de Compras: a lista de desejos agrupada por categoria, o histórico
 * do que foi comprado ou abandonado, e os diálogos de produto/categoria.
 * Estado local otimista igual a Links — cada ação devolve os dados inteiros.
 */
export function AppCompras({ dadosIniciais }: { dadosIniciais: DadosCompras }) {
  const roteador = useRouter();
  const parametros = useSearchParams();
  const [dados, definirDados] = useState(dadosIniciais);
  const [aba, definirAba] = useState<"lista" | "historico">("lista");
  const [produtoEmEdicao, definirProdutoEmEdicao] = useState<Produto | "novo" | null>(null);
  const [comprando, definirComprando] = useState<Produto | null>(null);
  const [excluindo, definirExcluindo] = useState<Produto | null>(null);
  const [gerenciandoCategorias, definirGerenciandoCategorias] = useState(false);

  // `?novo=1` (paleta, de qualquer lugar) e `?produto=<id>` (resultado da
  // busca global) abrem o diálogo já na chegada; a URL volta a limpa em
  // seguida pra um F5 não reabrir.
  const novoNaUrl = parametros.get("novo");
  const produtoNaUrl = parametros.get("produto");
  useEffect(() => {
    if (novoNaUrl) {
      definirProdutoEmEdicao("novo");
      roteador.replace("/compras");
    } else if (produtoNaUrl) {
      const produto = dados.produtos.find((item) => item.id === produtoNaUrl);
      if (produto) {
        definirAba(produto.estado === "quero" ? "lista" : "historico");
        definirProdutoEmEdicao(produto);
      }
      roteador.replace("/compras");
    }
    // Só na chegada com parâmetro — `dados` mudar depois não deve reabrir nada.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [novoNaUrl, produtoNaUrl, roteador]);

  const aplicarResposta = useCallback((resposta: RespostaCompras): boolean => {
    if (resposta.ok) {
      definirDados(resposta.dados);
      return true;
    }
    alert(resposta.erro);
    return false;
  }, []);

  useAtalho("n", {
    grupo: "Compras",
    descricao: "Novo produto",
    acao: () => definirProdutoEmEdicao("novo"),
  });

  const naLista = useMemo(() => dados.produtos.filter((produto) => produto.estado === "quero"), [dados.produtos]);
  const grupos = useMemo(() => {
    const porCategoria = new Map<string, Produto[]>();
    for (const produto of naLista) {
      const chave = produto.categoriaId ?? SEM_CATEGORIA;
      porCategoria.set(chave, [...(porCategoria.get(chave) ?? []), produto]);
    }
    const lista: { categoria: CategoriaProduto | null; produtos: Produto[] }[] = [];
    for (const categoria of dados.categorias) {
      const seus = porCategoria.get(categoria.id);
      if (seus?.length) lista.push({ categoria, produtos: ordenarProdutos(seus) });
    }
    const soltos = porCategoria.get(SEM_CATEGORIA);
    if (soltos?.length) lista.push({ categoria: null, produtos: ordenarProdutos(soltos) });
    return lista;
  }, [naLista, dados.categorias]);

  const historico = useMemo(
    () =>
      dados.produtos
        .filter((produto) => produto.estado !== "quero")
        .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm)),
    [dados.produtos],
  );

  const mudarEstado = useCallback(
    async (produto: Produto, estado: Produto["estado"]) => void aplicarResposta(await acaoMudarEstadoProduto(produto.id, estado)),
    [aplicarResposta],
  );

  const nomeDaCategoria = useCallback(
    (id: string | null) => (id ? (dados.categorias.find((c) => c.id === id) ?? null) : null),
    [dados.categorias],
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 border-b border-linha bg-superficie px-5 py-2.5">
        <ShoppingCart size={15} className="shrink-0 text-tinta-3" />
        <h1 className="shrink-0 text-[13px] font-bold tracking-[-0.02em]">Compras</h1>
        <span className="text-[11.5px] text-tinta-3">
          {naLista.length === 0 ? "" : `${naLista.length} ${naLista.length === 1 ? "item" : "itens"} na lista`}
        </span>

        <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-linha p-0.5">
          <BotaoAba ativa={aba === "lista"} onClick={() => definirAba("lista")} icone={<ListChecks size={13} />}>
            Lista
          </BotaoAba>
          <BotaoAba ativa={aba === "historico"} onClick={() => definirAba("historico")} icone={<History size={13} />}>
            Histórico{historico.length ? ` · ${historico.length}` : ""}
          </BotaoAba>
        </div>
        <button
          type="button"
          onClick={() => definirGerenciandoCategorias(true)}
          className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
        >
          <Tags size={13} />
          Categorias
        </button>
        <Botao variante="primario" onClick={() => definirProdutoEmEdicao("novo")}>
          <Plus size={13} />
          Novo produto
        </Botao>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {aba === "lista" ? (
          grupos.length === 0 ? (
            <Vazio
              icone={<ShoppingBag size={22} />}
              titulo="Nada na lista ainda"
              descricao="Lembrou de um produto? Anote antes de esquecer — com link, o nome e a foto vêm sozinhos."
            >
              <Botao variante="primario" onClick={() => definirProdutoEmEdicao("novo")}>
                <Plus size={13} />
                Novo produto
              </Botao>
            </Vazio>
          ) : (
            <div className="mx-auto max-w-4xl space-y-6">
              {grupos.map((grupo) => (
                <section key={grupo.categoria?.id ?? SEM_CATEGORIA}>
                  <h2 className="mb-1.5 flex items-center gap-2 px-2 text-[11px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
                    <span
                      aria-hidden
                      className="size-2 rounded-full"
                      style={{ background: grupo.categoria?.cor ?? "var(--tinta-3)" }}
                    />
                    {grupo.categoria?.nome ?? "Sem categoria"}
                    <span className="font-medium tabular-nums">{grupo.produtos.length}</span>
                  </h2>
                  <div className="space-y-0.5">
                    {grupo.produtos.map((produto) => (
                      <LinhaProduto
                        key={produto.id}
                        produto={produto}
                        onEditar={definirProdutoEmEdicao}
                        onComprei={definirComprando}
                        onDesisti={(item) => mudarEstado(item, "desisti")}
                        onExcluir={definirExcluindo}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : historico.length === 0 ? (
          <Vazio
            icone={<History size={22} />}
            titulo="Histórico vazio"
            descricao="O que você marcar como comprado ou desistir fica aqui, com data, preço pago e loja."
          />
        ) : (
          <div className="mx-auto max-w-4xl space-y-0.5">
            {historico.map((produto) => (
              <LinhaHistorico
                key={produto.id}
                produto={produto}
                categoria={nomeDaCategoria(produto.categoriaId)}
                onEditar={definirProdutoEmEdicao}
                onVoltar={(item) => mudarEstado(item, "quero")}
                onExcluir={definirExcluindo}
              />
            ))}
          </div>
        )}
      </div>

      {produtoEmEdicao ? (
        <DialogoProduto
          produto={produtoEmEdicao === "novo" ? null : produtoEmEdicao}
          categorias={dados.categorias}
          aoFechar={() => definirProdutoEmEdicao(null)}
          aoCriarCategoria={async (nome) => {
            const resposta = await acaoCriarCategoria(nome);
            if (!resposta.ok) return { erro: resposta.erro };
            definirDados(resposta.dados);
            const nova = resposta.dados.categorias.find((c) => c.nome.toLowerCase() === nome.trim().toLowerCase());
            return { id: nova?.id ?? null };
          }}
          aoSalvar={async (id, campos, imagem) => {
            const resposta = id ? await acaoAtualizarProduto(id, campos, imagem) : await acaoCriarProduto(campos, imagem);
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            definirProdutoEmEdicao(null);
            return null;
          }}
        />
      ) : null}

      {comprando ? (
        <DialogoComprado
          produto={comprando}
          aoFechar={() => definirComprando(null)}
          aoConfirmar={async (compra) => {
            const resposta = await acaoMudarEstadoProduto(comprando.id, "comprado", compra);
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            definirComprando(null);
            return null;
          }}
        />
      ) : null}

      {excluindo ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir "${excluindo.nome}"?`}
          descricao="Apaga de vez, sem lixeira. Se só quer tirar da lista, use “desisti” — dá para voltar depois."
          textoBotao="Excluir"
          aoFechar={() => definirExcluindo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirProduto(excluindo.id);
            if (!resposta.ok) return resposta.erro;
            definirDados(resposta.dados);
            definirExcluindo(null);
            return null;
          }}
        />
      ) : null}

      {gerenciandoCategorias ? (
        <DialogoCategorias
          categorias={dados.categorias}
          contagem={(id) => dados.produtos.filter((p) => p.categoriaId === id).length}
          aoFechar={() => definirGerenciandoCategorias(false)}
          aplicar={aplicarResposta}
        />
      ) : null}
    </div>
  );
}

function BotaoAba({
  ativa,
  icone,
  onClick,
  children,
}: {
  ativa: boolean;
  icone: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativa}
      className={clsx(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] transition-colors",
        ativa ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
      )}
    >
      {icone}
      {children}
    </button>
  );
}

function Miniatura({ produto, tamanho = 40 }: { produto: Pick<Produto, "imagem" | "nome">; tamanho?: number }) {
  if (!produto.imagem) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-md bg-realce-fraco text-tinta-3"
        style={{ width: tamanho, height: tamanho }}
        aria-hidden
      >
        <ShoppingBag size={Math.round(tamanho * 0.4)} />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagem local pequena, não vale o otimizador do Next.
    <img
      src={`/compras/imagem/${produto.imagem}`}
      alt=""
      loading="lazy"
      className="shrink-0 rounded-md bg-superficie-alta object-cover"
      style={{ width: tamanho, height: tamanho }}
    />
  );
}

const ESTILO_PRIORIDADE: Record<PrioridadeProduto, string> = {
  muito: "bg-[color-mix(in_srgb,var(--realce)_18%,transparent)] text-[color-mix(in_srgb,var(--realce)_80%,var(--tinta))] font-semibold",
  quero: "bg-realce-fraco text-tinta-2",
  talvez: "text-tinta-3",
};

function SeloPrioridade({ prioridade }: { prioridade: PrioridadeProduto }) {
  return (
    <span className={clsx("shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px]", ESTILO_PRIORIDADE[prioridade])}>
      {ROTULO_PRIORIDADE[prioridade]}
    </span>
  );
}

const LinhaProduto = memo(function LinhaProduto({
  produto,
  onEditar,
  onComprei,
  onDesisti,
  onExcluir,
}: {
  produto: Produto;
  onEditar: (produto: Produto) => void;
  onComprei: (produto: Produto) => void;
  onDesisti: (produto: Produto) => void;
  onExcluir: (produto: Produto) => void;
}) {
  const melhor = menorPreco(produto.lojas);
  const primeiraLoja = produto.lojas.find((loja) => loja.url) ?? null;
  const lojaMostrada = melhor ?? primeiraLoja;
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-realce-fraco">
      <button type="button" onClick={() => onEditar(produto)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Miniatura produto={produto} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-tinta">{produto.nome}</span>
          {produto.modelo ? <span className="block truncate text-[11.5px] text-tinta-3">{produto.modelo}</span> : null}
        </span>
      </button>
      <SeloPrioridade prioridade={produto.prioridade} />
      <span className="flex w-40 shrink-0 flex-col items-end text-right">
        {melhor ? <span className="text-[12.5px] font-medium tabular-nums">{formatarPreco(melhor.preco)}</span> : null}
        {lojaMostrada ? (
          lojaMostrada.url ? (
            <a
              href={lojaMostrada.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 truncate text-[11px] text-tinta-3 hover:text-tinta"
              title={lojaMostrada.url}
            >
              {lojaMostrada.loja}
              <ExternalLink size={10} />
            </a>
          ) : (
            <span className="truncate text-[11px] text-tinta-3">{lojaMostrada.loja}</span>
          )
        ) : null}
        {produto.lojas.length > 1 ? (
          <span className="text-[10.5px] text-tinta-3">+{produto.lojas.length - 1} {produto.lojas.length === 2 ? "loja" : "lojas"}</span>
        ) : null}
      </span>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <BotaoIcone rotulo="Comprei" onClick={() => onComprei(produto)} className="size-7">
          <Check size={13} />
        </BotaoIcone>
        <BotaoIcone rotulo="Desisti" onClick={() => onDesisti(produto)} className="size-7">
          <X size={13} />
        </BotaoIcone>
        <BotaoIcone rotulo="Editar" onClick={() => onEditar(produto)} className="size-7">
          <Pencil size={13} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={() => onExcluir(produto)} className="size-7">
          <Trash2 size={13} />
        </BotaoIcone>
      </div>
    </div>
  );
});

const LinhaHistorico = memo(function LinhaHistorico({
  produto,
  categoria,
  onEditar,
  onVoltar,
  onExcluir,
}: {
  produto: Produto;
  categoria: CategoriaProduto | null;
  onEditar: (produto: Produto) => void;
  onVoltar: (produto: Produto) => void;
  onExcluir: (produto: Produto) => void;
}) {
  const comprado = produto.estado === "comprado";
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-realce-fraco">
      <button type="button" onClick={() => onEditar(produto)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <Miniatura produto={produto} tamanho={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-tinta">{produto.nome}</span>
          <span className="block truncate text-[11.5px] text-tinta-3">
            {[produto.modelo, categoria?.nome].filter(Boolean).join(" · ")}
          </span>
        </span>
      </button>
      <span
        className={clsx(
          "shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px]",
          comprado ? "bg-[color-mix(in_srgb,#0EA47C_16%,transparent)] text-[#0EA47C]" : "bg-realce-fraco text-tinta-3",
        )}
      >
        {comprado ? "Comprado" : "Desisti"}
      </span>
      <span className="flex w-44 shrink-0 flex-col items-end text-right text-[11.5px] text-tinta-3">
        {comprado ? (
          <>
            <span className="text-[12.5px] font-medium text-tinta tabular-nums">{formatarPreco(produto.precoPago) || "—"}</span>
            <span className="truncate">
              {[formatarData(produto.compradoEm), produto.lojaDaCompra].filter(Boolean).join(" · ")}
            </span>
          </>
        ) : (
          <span>{formatarData(produto.atualizadoEm)}</span>
        )}
      </span>
      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <BotaoIcone rotulo="Voltar para a lista" onClick={() => onVoltar(produto)} className="size-7">
          <Undo2 size={13} />
        </BotaoIcone>
        <BotaoIcone rotulo="Excluir" onClick={() => onExcluir(produto)} className="size-7">
          <Trash2 size={13} />
        </BotaoIcone>
      </div>
    </div>
  );
});

/* ---------------------------------------------------------------------- */
/* Diálogo de produto                                                       */
/* ---------------------------------------------------------------------- */

type LojaEmEdicao = { id?: string; url: string; loja: string; precoTexto: string };

const CLASSE_SELECT =
  "h-9.5 w-full rounded-lg border border-linha bg-superficie-alta px-3 text-[13px] text-tinta focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none";

/** Categoria com "+ nova" embutido — a mesma escolha tanto no diálogo quanto no popup da extensão. */
export function SeletorCategoria({
  categorias,
  valor,
  aoMudar,
  aoCriar,
}: {
  categorias: CategoriaProduto[];
  valor: string | null;
  aoMudar: (id: string | null) => void;
  aoCriar: (nome: string) => Promise<{ id?: string | null; erro?: string }>;
}) {
  const [criando, definirCriando] = useState(false);
  const [nome, definirNome] = useState("");
  const [erro, definirErro] = useState<string | null>(null);

  async function confirmar() {
    if (!nome.trim()) return;
    const resultado = await aoCriar(nome);
    if (resultado.erro) {
      definirErro(resultado.erro);
      return;
    }
    if (resultado.id) aoMudar(resultado.id);
    definirNome("");
    definirErro(null);
    definirCriando(false);
  }

  if (criando) {
    return (
      <div>
        <div className="flex gap-1.5">
          <Campo
            autoFocus
            value={nome}
            placeholder="Nome da categoria"
            onChange={(evento) => definirNome(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                confirmar();
              } else if (evento.key === "Escape") {
                evento.stopPropagation();
                definirCriando(false);
              }
            }}
          />
          <Botao variante="primario" onClick={confirmar} disabled={!nome.trim()}>
            Criar
          </Botao>
          <Botao variante="sutil" onClick={() => definirCriando(false)}>
            <X size={13} />
          </Botao>
        </div>
        <Aviso>{erro}</Aviso>
      </div>
    );
  }

  return (
    <select
      value={valor ?? ""}
      onChange={(evento) => {
        if (evento.target.value === "__nova__") definirCriando(true);
        else aoMudar(evento.target.value || null);
      }}
      className={CLASSE_SELECT}
    >
      <option value="">Sem categoria</option>
      {categorias.map((categoria) => (
        <option key={categoria.id} value={categoria.id}>
          {categoria.nome}
        </option>
      ))}
      <option value="__nova__">+ Nova categoria…</option>
    </select>
  );
}

export function SeletorPrioridade({
  valor,
  aoMudar,
}: {
  valor: PrioridadeProduto;
  aoMudar: (prioridade: PrioridadeProduto) => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-linha p-0.5">
      {PRIORIDADES.map((prioridade) => (
        <button
          key={prioridade}
          type="button"
          onClick={() => aoMudar(prioridade)}
          aria-pressed={valor === prioridade}
          title={ROTULO_PRIORIDADE[prioridade]}
          className={clsx(
            "flex-1 rounded-md px-2 py-1.5 text-[12px] whitespace-nowrap transition-colors",
            valor === prioridade ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
          )}
        >
          {ROTULO_CURTO_PRIORIDADE[prioridade]}
        </button>
      ))}
    </div>
  );
}

function DialogoProduto({
  produto,
  categorias,
  aoFechar,
  aoCriarCategoria,
  aoSalvar,
}: {
  produto: Produto | null;
  categorias: CategoriaProduto[];
  aoFechar: () => void;
  aoCriarCategoria: (nome: string) => Promise<{ id?: string | null; erro?: string }>;
  aoSalvar: (id: string | null, campos: CamposProduto, imagem?: ImagemBuscada) => Promise<string | null>;
}) {
  const [nome, definirNome] = useState(produto?.nome ?? "");
  const [modelo, definirModelo] = useState(produto?.modelo ?? "");
  const [categoriaId, definirCategoriaId] = useState<string | null>(produto?.categoriaId ?? null);
  const [prioridade, definirPrioridade] = useState<PrioridadeProduto>(produto?.prioridade ?? "quero");
  const [observacoes, definirObservacoes] = useState(produto?.observacoes ?? "");
  const [lojas, definirLojas] = useState<LojaEmEdicao[]>(
    produto?.lojas.length
      ? produto.lojas.map((loja) => ({ id: loja.id, url: loja.url, loja: loja.loja, precoTexto: precoParaTexto(loja.preco) }))
      : [{ url: "", loja: "", precoTexto: "" }],
  );
  // `undefined` = imagem como está; `null` = tirar; objeto = trocar.
  const [imagem, definirImagem] = useState<ImagemBuscada>(undefined);
  const [buscando, definirBuscando] = useState(false);
  const [duplicado, definirDuplicado] = useState<{ id: string; nome: string } | null>(null);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  const urlsJaBuscadas = useRef(new Set(produto?.lojas.map((loja) => loja.url) ?? []));

  const previaImagem =
    imagem === undefined
      ? produto?.imagem
        ? `/compras/imagem/${produto.imagem}`
        : null
      : imagem
        ? `data:${imagem.tipo};base64,${imagem.base64}`
        : null;

  async function aoSairDaUrl(indice: number) {
    const url = lojas[indice].url.trim();
    if (!url || urlsJaBuscadas.current.has(url)) return;
    urlsJaBuscadas.current.add(url);
    definirLojas((atuais) =>
      atuais.map((loja, i) => (i === indice && !loja.loja.trim() ? { ...loja, loja: lojaDaUrl(url) } : loja)),
    );
    // Nome e imagem só vêm da primeira loja com link — as outras são só "onde mais comprar".
    const precisaDeNome = !nome.trim();
    const precisaDeImagem = previaImagem === null;
    definirBuscando(true);
    const [resultado, achado] = await Promise.all([
      precisaDeNome || precisaDeImagem ? acaoBuscarDadosDoProduto(url) : Promise.resolve(null),
      acaoAcharProdutoPorUrl(url),
    ]);
    definirBuscando(false);
    if (achado && achado.id !== produto?.id) definirDuplicado(achado);
    if (resultado) {
      if (precisaDeNome && resultado.nome) definirNome(resultado.nome);
      if (precisaDeImagem && resultado.imagem) definirImagem(resultado.imagem);
    }
  }

  async function escolherArquivo(arquivo: File | undefined) {
    if (!arquivo || !arquivo.type.startsWith("image/")) return;
    if (arquivo.size > 2 * 1024 * 1024) {
      definirErro("Imagem grande demais — use uma de até 2 MB.");
      return;
    }
    definirImagem({ base64: await arquivoParaBase64(arquivo), tipo: arquivo.type });
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) {
      definirErro("Dê um nome para o produto.");
      return;
    }
    definirSalvando(true);
    const campos: CamposProduto = {
      nome,
      modelo,
      categoriaId,
      prioridade,
      observacoes,
      lojas: lojas.map((loja) => ({ id: loja.id, url: loja.url, loja: loja.loja, preco: interpretarPreco(loja.precoTexto) })),
    };
    const falha = await aoSalvar(produto?.id ?? null, campos, imagem);
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo titulo={produto ? "Editar produto" : "Novo produto"} aberto aoFechar={aoFechar} largura="max-w-xl" realcado>
      <form onSubmit={enviar} className="space-y-3">
        <div className="flex gap-4">
          <div className="flex w-28 shrink-0 flex-col items-center gap-1.5">
            {previaImagem ? (
              // eslint-disable-next-line @next/next/no-img-element -- prévia local.
              <img src={previaImagem} alt="" className="size-28 rounded-lg bg-superficie-alta object-cover" />
            ) : (
              <span className="flex size-28 items-center justify-center rounded-lg bg-realce-fraco text-tinta-3">
                <ImageIcon size={24} />
              </span>
            )}
            <input
              ref={seletorDeArquivo}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(evento) => {
                void escolherArquivo(evento.target.files?.[0]);
                evento.target.value = "";
              }}
            />
            <div className="flex gap-1">
              <Botao variante="sutil" className="h-7 px-2 text-[11.5px]" onClick={() => seletorDeArquivo.current?.click()}>
                {previaImagem ? "Trocar" : "Imagem"}
              </Botao>
              {previaImagem ? (
                <Botao variante="sutil" className="h-7 px-2 text-[11.5px]" onClick={() => definirImagem(null)}>
                  Tirar
                </Botao>
              ) : null}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <Rotulo>Nome</Rotulo>
              <Campo autoFocus value={nome} onChange={(evento) => definirNome(evento.target.value)} placeholder="O que é" />
            </div>
            <div>
              <Rotulo>Modelo / especificação</Rotulo>
              <Campo
                value={modelo}
                onChange={(evento) => definirModelo(evento.target.value)}
                placeholder="Tamanho, cor, versão, código — o que você esquece"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Rotulo>Categoria</Rotulo>
            <SeletorCategoria categorias={categorias} valor={categoriaId} aoMudar={definirCategoriaId} aoCriar={aoCriarCategoria} />
          </div>
          <div>
            <Rotulo>Prioridade</Rotulo>
            <SeletorPrioridade valor={prioridade} aoMudar={definirPrioridade} />
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <Rotulo>Onde comprar (opcional)</Rotulo>
            {buscando ? <span className="text-[11px] text-tinta-3">Buscando nome e imagem…</span> : null}
          </div>
          <div className="space-y-1.5">
            {lojas.map((loja, indice) => (
              <div key={loja.id ?? indice} className="flex gap-1.5">
                <div className="min-w-0 flex-[3]">
                  <Campo
                    value={loja.url}
                    placeholder="https://…"
                    onChange={(evento) => definirLojas(lojas.map((item, i) => (i === indice ? { ...item, url: evento.target.value } : item)))}
                    onBlur={() => aoSairDaUrl(indice)}
                  />
                </div>
                <div className="min-w-0 flex-[2]">
                  <Campo
                    value={loja.loja}
                    placeholder="Loja"
                    onChange={(evento) => definirLojas(lojas.map((item, i) => (i === indice ? { ...item, loja: evento.target.value } : item)))}
                  />
                </div>
                <div className="w-24 shrink-0">
                  <Campo
                    value={loja.precoTexto}
                    placeholder="R$"
                    inputMode="decimal"
                    onChange={(evento) => definirLojas(lojas.map((item, i) => (i === indice ? { ...item, precoTexto: evento.target.value } : item)))}
                  />
                </div>
                <BotaoIcone
                  rotulo="Tirar esta loja"
                  onClick={() => definirLojas(lojas.length === 1 ? [{ url: "", loja: "", precoTexto: "" }] : lojas.filter((_, i) => i !== indice))}
                  className="size-9.5 shrink-0"
                >
                  <X size={13} />
                </BotaoIcone>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => definirLojas([...lojas, { url: "", loja: "", precoTexto: "" }])}
            className="mt-1.5 flex items-center gap-1 text-[12px] text-tinta-2 hover:text-tinta"
          >
            <Plus size={12} />
            Outra loja
          </button>
          {duplicado ? (
            <p className="mt-1 text-[11.5px] text-[#F5822C]">
              Esse link já está em <strong>{duplicado.nome}</strong>. Pode salvar mesmo assim.
            </p>
          ) : null}
        </div>

        <div>
          <Rotulo>Observações (opcional)</Rotulo>
          <textarea
            value={observacoes}
            onChange={(evento) => definirObservacoes(evento.target.value)}
            rows={2}
            className="w-full resize-none rounded-lg border border-linha bg-superficie-alta px-3 py-2 text-[13px] text-tinta transition-shadow placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
            placeholder="Por que quer, pra que serve, o que comparar"
          />
        </div>

        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando || !nome.trim()}>
            {produto ? "Salvar" : "Adicionar"}
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/* ---------------------------------------------------------------------- */
/* Comprei                                                                  */
/* ---------------------------------------------------------------------- */

function DialogoComprado({
  produto,
  aoFechar,
  aoConfirmar,
}: {
  produto: Produto;
  aoFechar: () => void;
  aoConfirmar: (compra: { compradoEm: string; precoPago: number | null; lojaDaCompra: string }) => Promise<string | null>;
}) {
  const melhor = menorPreco(produto.lojas);
  const [data, definirData] = useState(new Date().toISOString().slice(0, 10));
  const [precoTexto, definirPrecoTexto] = useState(precoParaTexto(melhor?.preco ?? null));
  const [loja, definirLoja] = useState(melhor?.loja ?? produto.lojas[0]?.loja ?? "");
  const [erro, definirErro] = useState<string | null>(null);
  const [salvando, definirSalvando] = useState(false);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    definirSalvando(true);
    const falha = await aoConfirmar({ compradoEm: data, precoPago: interpretarPreco(precoTexto), lojaDaCompra: loja });
    definirSalvando(false);
    if (falha) definirErro(falha);
  }

  return (
    <Dialogo titulo={`Comprou ${produto.nome}?`} descricao="Vai para o histórico — dá para voltar à lista depois." aberto aoFechar={aoFechar}>
      <form onSubmit={enviar} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Rotulo>Quando</Rotulo>
            <Campo type="date" value={data} onChange={(evento) => definirData(evento.target.value)} />
          </div>
          <div>
            <Rotulo>Preço pago</Rotulo>
            <Campo value={precoTexto} inputMode="decimal" placeholder="R$" onChange={(evento) => definirPrecoTexto(evento.target.value)} />
          </div>
        </div>
        <div>
          <Rotulo>Loja</Rotulo>
          <Campo value={loja} list="lojas-do-produto" onChange={(evento) => definirLoja(evento.target.value)} placeholder="Onde comprou" />
          <datalist id="lojas-do-produto">
            {produto.lojas.map((item) => (
              <option key={item.id} value={item.loja} />
            ))}
          </datalist>
        </div>
        <Aviso>{erro}</Aviso>
        <div className="flex justify-end gap-2 pt-1">
          <Botao onClick={aoFechar}>Cancelar</Botao>
          <Botao type="submit" variante="primario" disabled={salvando}>
            <Check size={13} />
            Comprei
          </Botao>
        </div>
      </form>
    </Dialogo>
  );
}

/* ---------------------------------------------------------------------- */
/* Categorias                                                               */
/* ---------------------------------------------------------------------- */

function DialogoCategorias({
  categorias,
  contagem,
  aoFechar,
  aplicar,
}: {
  categorias: CategoriaProduto[];
  contagem: (id: string) => number;
  aoFechar: () => void;
  aplicar: (resposta: RespostaCompras) => boolean;
}) {
  const [nova, definirNova] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [renomeando, definirRenomeando] = useState<CategoriaProduto | null>(null);
  const [excluindo, definirExcluindo] = useState<CategoriaProduto | null>(null);
  const [escolhendoCor, definirEscolhendoCor] = useState<string | null>(null);

  async function criar() {
    if (!nova.trim()) return;
    const resposta = await acaoCriarCategoria(nova);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    aplicar(resposta);
    definirNova("");
    definirErro(null);
  }

  async function mover(indice: number, direcao: -1 | 1) {
    const alvo = indice + direcao;
    if (alvo < 0 || alvo >= categorias.length) return;
    const ordem = categorias.map((c) => c.id);
    [ordem[indice], ordem[alvo]] = [ordem[alvo], ordem[indice]];
    aplicar(await acaoReordenarCategorias(ordem));
  }

  return (
    <>
      <Dialogo titulo="Categorias" descricao="A ordem aqui é a ordem dos grupos na lista." aberto aoFechar={aoFechar}>
        <div className="flex gap-1.5">
          <Campo
            value={nova}
            placeholder="Nova categoria"
            onChange={(evento) => definirNova(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter") {
                evento.preventDefault();
                criar();
              }
            }}
          />
          <Botao variante="primario" onClick={criar} disabled={!nova.trim()}>
            <Plus size={13} />
            Criar
          </Botao>
        </div>
        <Aviso>{erro}</Aviso>

        <div className="mt-3 space-y-0.5">
          {categorias.length === 0 ? <p className="px-2 py-3 text-[12px] text-tinta-3">Nenhuma categoria ainda.</p> : null}
          {categorias.map((categoria, indice) => (
            <div key={categoria.id} className="group flex items-center gap-2 rounded-md px-2 py-1">
              <div className="relative">
                <button
                  type="button"
                  aria-label={`Cor de ${categoria.nome}`}
                  onClick={() => definirEscolhendoCor(escolhendoCor === categoria.id ? null : categoria.id)}
                  className="size-4 rounded-full ring-2 ring-transparent transition-shadow hover:ring-linha-forte"
                  style={{ background: categoria.cor }}
                />
                {escolhendoCor === categoria.id ? (
                  <div className="absolute top-6 left-0 z-10 flex gap-1 rounded-lg border border-linha bg-superficie-alta p-1.5 shadow-[var(--sombra)]">
                    {CORES_ETIQUETA.map((cor) => (
                      <button
                        key={cor}
                        type="button"
                        aria-label={`Usar a cor ${cor}`}
                        onClick={async () => {
                          definirEscolhendoCor(null);
                          aplicar(await acaoAtualizarCategoria(categoria.id, { cor }));
                        }}
                        className={clsx("size-5 rounded-md border-2", cor === categoria.cor ? "border-tinta" : "border-transparent")}
                        style={{ background: cor }}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
              <span className="min-w-0 flex-1 truncate text-[13px]">{categoria.nome}</span>
              <span className="text-[11px] text-tinta-3 tabular-nums">{contagem(categoria.id) || ""}</span>
              <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <BotaoIcone rotulo="Subir" onClick={() => mover(indice, -1)} disabled={indice === 0} className="size-6">
                  <ChevronUp size={13} />
                </BotaoIcone>
                <BotaoIcone rotulo="Descer" onClick={() => mover(indice, 1)} disabled={indice === categorias.length - 1} className="size-6">
                  <ChevronDown size={13} />
                </BotaoIcone>
                <BotaoIcone rotulo="Renomear" onClick={() => definirRenomeando(categoria)} className="size-6">
                  <Pencil size={12} />
                </BotaoIcone>
                <BotaoIcone rotulo="Excluir" onClick={() => definirExcluindo(categoria)} className="size-6">
                  <Trash2 size={12} />
                </BotaoIcone>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <Botao variante="sutil" onClick={aoFechar}>
            Fechar
          </Botao>
        </div>
      </Dialogo>

      {renomeando ? (
        <DialogoNome
          aberto
          titulo="Renomear categoria"
          rotulo="Nome"
          valorInicial={renomeando.nome}
          textoBotao="Salvar"
          aoFechar={() => definirRenomeando(null)}
          aoConfirmar={async (nome) => {
            const resposta = await acaoAtualizarCategoria(renomeando.id, { nome });
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirRenomeando(null);
            return null;
          }}
        />
      ) : null}

      {excluindo ? (
        <DialogoConfirmar
          aberto
          titulo={`Excluir a categoria ${excluindo.nome}?`}
          descricao={
            contagem(excluindo.id)
              ? `${contagem(excluindo.id)} ${contagem(excluindo.id) === 1 ? "produto fica" : "produtos ficam"} sem categoria — nenhum é apagado.`
              : "Nenhum produto usa esta categoria."
          }
          textoBotao="Excluir categoria"
          aoFechar={() => definirExcluindo(null)}
          aoConfirmar={async () => {
            const resposta = await acaoExcluirCategoria(excluindo.id);
            if (!resposta.ok) return resposta.erro;
            aplicar(resposta);
            definirExcluindo(null);
            return null;
          }}
        />
      ) : null}
    </>
  );
}
