"use client";

import {
  ArrowLeftRight,
  Check,
  Eye,
  History,
  Link2,
  Loader2,
  Pencil,
  Star,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import { acaoAlternarFavorita, acaoColarImagem, acaoConverterFormato, acaoSalvarNota } from "@/app/acoes";
import { pastaDe } from "@/lib/caminho-texto";
import { contarPalavras, tempoDeLeituraEmMinutos } from "@/lib/contagem";
import { alternarTarefa, envolver, inserirBloco } from "@/lib/formatacao";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import { formatarDataHora, urlDaNota } from "@/lib/rotas";
import type { Etiqueta, Nota } from "@/lib/tipos";
import { useZoomTexto } from "@/lib/zoom";

import { BarraFormatacao, atalhoDeFormatacao } from "./barra-formatacao";
import { PainelHistorico } from "./painel-historico";
import { SeletorEtiquetas } from "./seletor-etiquetas";
import { AlcaRedimensionar, Botao, BotaoIcone } from "./ui";
import { VisualizadorMarkdown } from "./visualizador-markdown";

type Estado = "salvo" | "pendente" | "salvando" | "erro";

const ESPERA_SALVAMENTO = 800;

const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/** Base64 puro, sem o prefixo "data:...;base64," — é só isso que o servidor precisa. */
function arquivoParaBase64(arquivo: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result).split(",")[1] ?? "");
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(arquivo);
  });
}

/**
 * A página aberta.
 *
 * Markdown abre em leitura — é o estado normal de uma anotação: consultar.
 * "Editar" divide a área em duas colunas, com o texto cru à esquerda e a
 * mesma visualização à direita. Texto simples abre direto no editor, ocupando
 * a largura toda, porque não há prévia para dividir espaço com ele.
 */
export function PaginaNota({
  nota,
  etiquetas,
  editandoInicial,
  iconeDoCaderno,
  mapaDeLinks,
  backlinks,
}: {
  nota: Nota;
  etiquetas: Etiqueta[];
  editandoInicial: boolean;
  iconeDoCaderno: string;
  /** Título normalizado → caminho resolvido dos `[[links]]` desta nota, calculado no servidor. */
  mapaDeLinks: Record<string, string | null>;
  /** Notas que citam `[[EstaNota]]`. */
  backlinks: { caminho: string; titulo: string }[];
}) {
  const roteador = useRouter();
  const ehMarkdown = nota.formato === "md";
  const [conteudo, definirConteudo] = useState(nota.conteudo);
  // A prévia é cara de renderizar (markdown + realce de sintaxe do zero a cada
  // chamada). Se ela acompanhasse `conteudo` direto, cada tecla digitada
  // esperaria essa renderização terminar antes do campo de texto conseguir se
  // redesenhar — em notas grandes isso já bastou para o texto parecer
  // "sumir" enquanto se digita rápido, mesmo o valor real estando correto.
  //
  // `useDeferredValue` resolve isso do jeito certo: o React sempre prioriza
  // redesenhar o campo de texto primeiro, e só faz a prévia (que pode ser
  // interrompida a qualquer momento por uma tecla nova) quando sobra tempo.
  // Um `setTimeout` de duração fixa não dava essa garantia — se a pessoa
  // digitasse com uma pausa naturalmente maior que o tempo escolhido, a
  // prévia cara ainda disparava no meio da digitação.
  const conteudoPreVisualizado = useDeferredValue(conteudo);
  const [editando, definirEditando] = useState(editandoInicial || !ehMarkdown);
  const [estado, definirEstado] = useState<Estado>("salvo");
  const [historicoAberto, definirHistoricoAberto] = useState(false);
  const [favorita, definirFavorita] = useState(nota.favorita);
  const [avisoImagem, definirAvisoImagem] = useState<string | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const zoom = useZoomTexto();
  const pastaDaNota = pastaDe(nota.caminho);
  // Largura do texto cru na edição lado a lado — a prévia ocupa o resto.
  // Mesmo padrão das outras colunas ajustáveis do app (barra lateral,
  // coluna de seções, lista de páginas): arrasta a borda, some ao dobrar
  // clique nela.
  const divisorEditor = useLarguraRedimensionavel("largura-editor-texto", {
    padrao: 560,
    minima: 280,
    maxima: 1400,
  });

  const salvar = useCallback(
    async (texto: string) => {
      definirEstado("salvando");
      try {
        const resposta = await acaoSalvarNota(nota.caminho, texto);
        definirEstado(resposta.ok ? "salvo" : "erro");
      } catch {
        // Uma exceção (rede caiu, servidor fora do ar) não vem como
        // `{ ok: false }` — sem isto o estado ficava preso em "salvando"
        // para sempre, sem nunca oferecer o botão de tentar de novo.
        definirEstado("erro");
      }
    },
    [nota.caminho],
  );

  // Salvamento automático: espera a digitação dar uma pausa antes de gravar.
  useEffect(() => {
    if (conteudo === nota.conteudo) return;
    definirEstado("pendente");
    const espera = setTimeout(() => salvar(conteudo), ESPERA_SALVAMENTO);
    return () => clearTimeout(espera);
  }, [conteudo, nota.conteudo, salvar]);

  const concluirEdicao = useCallback(() => {
    if (!ehMarkdown) return;
    definirEditando(false);
    if (conteudo !== nota.conteudo) salvar(conteudo);
  }, [conteudo, ehMarkdown, nota.conteudo, salvar]);

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") {
        evento.preventDefault();
        salvar(conteudo);
      }
      // Esc só sai da edição quando não há um diálogo por cima.
      if (evento.key === "Escape" && editando && !document.querySelector("[role=dialog]")) {
        concluirEdicao();
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [conteudo, editando, concluirEdicao, salvar]);

  useEffect(() => {
    if (editando) area.current?.focus();
  }, [editando]);

  // Se o salvamento falhar (ou ainda estiver pendente) e a pessoa tentar
  // fechar a aba, o navegador confirma antes — sem isso a edição fica presa
  // só no estado do React e some sem aviso.
  useEffect(() => {
    if (estado === "salvo") return;
    function aoFechar(evento: BeforeUnloadEvent) {
      evento.preventDefault();
    }
    window.addEventListener("beforeunload", aoFechar);
    return () => window.removeEventListener("beforeunload", aoFechar);
  }, [estado]);

  /** Ctrl+B e Ctrl+I fazem o mesmo que os botões da barra. */
  function aoTeclarNoCampo(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!ehMarkdown) return;
    const atalho = atalhoDeFormatacao(evento);
    if (!atalho) return;

    evento.preventDefault();
    const campo = evento.currentTarget;
    const resultado = envolver(
      { texto: conteudo, inicio: campo.selectionStart, fim: campo.selectionEnd },
      atalho === "negrito" ? "**" : "*",
    );
    definirConteudo(resultado.texto);
    requestAnimationFrame(() => campo.setSelectionRange(resultado.inicio, resultado.fim));
  }

  /** Clicar numa tarefa em modo leitura já grava — sem precisar entrar em edição. */
  const aoAlternarTarefa = useCallback(
    (indiceDaTarefa: number) => definirConteudo((atual) => alternarTarefa(atual, indiceDaTarefa)),
    [],
  );

  /** Print colado no editor vira arquivo em `_anexos/` e entra como imagem. */
  async function aoColarNoCampo(evento: React.ClipboardEvent<HTMLTextAreaElement>) {
    const item = [...evento.clipboardData.items].find((item) => item.type.startsWith("image/"));
    if (!item) return; // Texto comum: deixa o navegador colar do jeito normal.
    evento.preventDefault();
    // Guardado já aqui: depois do primeiro `await`, o React já zerou
    // `evento.currentTarget` (o evento sintético só é válido durante o
    // despacho síncrono) — acessar depois disso dá null.
    const campo = evento.currentTarget;
    const inicioDaSelecao = campo.selectionStart;
    const fimDaSelecao = campo.selectionEnd;

    const extensao = EXTENSAO_POR_TIPO[item.type];
    const arquivo = item.getAsFile();
    if (!extensao || !arquivo) {
      definirAvisoImagem("Esse formato de imagem não é aceito.");
      return;
    }

    definirAvisoImagem(null);
    const base64 = await arquivoParaBase64(arquivo);
    const resposta = await acaoColarImagem(nota.caminho, extensao, base64);
    if (!resposta.ok || !resposta.mensagem) {
      definirAvisoImagem(resposta.ok ? "Não deu para colar a imagem." : resposta.erro);
      return;
    }

    const resultado = inserirBloco(
      { texto: conteudo, inicio: inicioDaSelecao, fim: fimDaSelecao },
      `![](${resposta.mensagem})`,
    );
    definirConteudo(resultado.texto);
    requestAnimationFrame(() => {
      campo.focus();
      campo.setSelectionRange(resultado.inicio, resultado.fim);
    });
  }

  const palavras = useMemo(() => contarPalavras(conteudo), [conteudo]);
  const minutosDeLeitura = tempoDeLeituraEmMinutos(palavras);

  const secoes = nota.caminho.split("/").slice(0, -1);

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-papel">
      <header className="shrink-0 border-b border-linha bg-superficie px-7 pt-3.5 pb-3">
        <div className="mb-1.5 flex items-center gap-1.5 text-[11.5px] text-tinta-3">
          <span aria-hidden>{iconeDoCaderno}</span>
          <span className="truncate">{secoes.join(" / ")}</span>
        </div>

        <div className="flex items-start gap-3">
          <h1 className="min-w-0 flex-1 text-[24px] leading-tight font-extrabold tracking-[-0.03em]">
            {nota.titulo}
          </h1>

          <div className="flex shrink-0 items-center gap-1">
            <IndicadorEstado
              estado={estado}
              atualizadoEm={nota.atualizadoEm}
              aoTentarDeNovo={() => salvar(conteudo)}
            />

            <ControleZoom zoom={zoom} />

            <BotaoIcone
              rotulo={favorita ? "Tirar dos favoritos" : "Marcar como favorita"}
              onClick={async () => {
                definirFavorita((valor) => !valor);
                await acaoAlternarFavorita(nota.caminho);
                roteador.refresh();
              }}
            >
              <Star size={15} className={favorita ? "fill-current text-[#c69214]" : undefined} />
            </BotaoIcone>

            <BotaoIcone
              rotulo="Histórico de versões"
              onClick={() => definirHistoricoAberto((valor) => !valor)}
            >
              <History size={15} />
            </BotaoIcone>

            {ehMarkdown ? (
              editando ? (
                <Botao onClick={concluirEdicao}>
                  <Eye size={13} />
                  Concluir
                </Botao>
              ) : (
                <Botao variante="primario" onClick={() => definirEditando(true)}>
                  <Pencil size={13} />
                  Editar
                </Botao>
              )
            ) : null}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <SeletorEtiquetas
            caminho={nota.caminho}
            etiquetasDaNota={nota.etiquetas}
            todasEtiquetas={etiquetas}
          />
          <span className="ml-auto shrink-0 text-[11px] text-tinta-3">
            {palavras === 0
              ? "página em branco"
              : `${palavras} ${palavras === 1 ? "palavra" : "palavras"} · ${minutosDeLeitura} min de leitura`}
          </span>
          <span className="shrink-0 font-mono text-[10px] tracking-wide text-tinta-3 uppercase">
            {nota.formato}
          </span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          {editando ? (
            <>
              <BarraFormatacao
                formato={nota.formato}
                campo={area}
                conteudo={conteudo}
                aoMudar={definirConteudo}
                extra={
                  ehMarkdown ? null : (
                    // Texto puro não guarda negrito; quem precisa disso quer markdown.
                    <button
                      type="button"
                      title="Converter esta página para markdown"
                      onClick={async () => {
                        const resposta = await acaoConverterFormato(nota.caminho, "md");
                        if (resposta.ok && resposta.mensagem) {
                          roteador.push(`${urlDaNota(resposta.mensagem)}?editando=1`);
                        }
                      }}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
                    >
                      <ArrowLeftRight size={12} />
                      Precisa de negrito? Converter para markdown
                    </button>
                  )
                }
              />

              {avisoImagem ? (
                <p className="border-b border-linha bg-[color-mix(in_srgb,var(--perigo)_8%,transparent)] px-7 py-1.5 text-[11.5px] text-perigo">
                  {avisoImagem}
                </p>
              ) : null}

              <div className="flex min-h-0 flex-1">
                {ehMarkdown ? (
                  // Envoltório à parte, sem rolagem própria: é o que faz a
                  // alça de redimensionar (posicionada em relação a ele)
                  // ficar sempre na borda visível, em vez de rolar junto
                  // com o texto — mesmo padrão da lista de páginas e da
                  // coluna de seções.
                  <div className="relative shrink-0 overflow-hidden" style={{ width: divisorEditor.largura }}>
                    <div className="h-full overflow-y-auto" ref={zoom.refRolagem}>
                      <textarea
                        ref={area}
                        value={conteudo}
                        onChange={(evento) => definirConteudo(evento.target.value)}
                        onKeyDown={aoTeclarNoCampo}
                        onPaste={aoColarNoCampo}
                        spellCheck
                        placeholder="Escreva em markdown. # título, - lista, - [ ] tarefa, **negrito**."
                        className="editor-texto min-h-full w-full resize-none bg-transparent px-7 py-5 text-tinta placeholder:text-tinta-3 focus:outline-none"
                      />
                    </div>
                    <AlcaRedimensionar
                      aoArrastar={divisorEditor.iniciarArraste}
                      aoRestaurar={divisorEditor.restaurarPadrao}
                      rotulo="Redimensionar o texto e a prévia"
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 overflow-y-auto" ref={zoom.refRolagem}>
                    <textarea
                      ref={area}
                      value={conteudo}
                      onChange={(evento) => definirConteudo(evento.target.value)}
                      onKeyDown={aoTeclarNoCampo}
                      onPaste={aoColarNoCampo}
                      spellCheck
                      placeholder="Escreva à vontade."
                      className="editor-simples min-h-full w-full resize-none bg-transparent px-7 py-5 text-tinta placeholder:text-tinta-3 focus:outline-none"
                    />
                  </div>
                )}

                {ehMarkdown ? (
                  <div
                    className="min-w-0 flex-1 overflow-y-auto border-l border-linha bg-superficie px-8 py-5"
                    ref={zoom.refRolagem}
                  >
                    <VisualizadorMarkdown
                      conteudo={conteudoPreVisualizado}
                      pastaBase={pastaDaNota}
                      mapaDeLinks={mapaDeLinks}
                    />
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8" ref={zoom.refRolagem}>
              {/*
                A margem colorida é a lombada do caderno chegando até a
                página — por isso ela desenha a si mesma ao abrir a nota
                (chave `nota.caminho` força o desenho de novo a cada nota
                diferente, mesmo trocando de uma leitura para outra sem
                passar pelo modo de edição), em vez de só aparecer pronta
                junto com o resto do texto.
              */}
              <article key={nota.caminho} className="relative pl-7">
                <span
                  aria-hidden
                  className="spinha-lombada absolute inset-y-0 left-0 w-[2px] origin-top rounded-full"
                  style={{ background: "color-mix(in srgb, var(--realce) 30%, transparent)" }}
                />
                <VisualizadorMarkdown
                  conteudo={conteudo}
                  pastaBase={pastaDaNota}
                  aoAlternarTarefa={aoAlternarTarefa}
                  mapaDeLinks={mapaDeLinks}
                />

                {backlinks.length > 0 ? (
                  <div className="mt-10 border-t border-linha pt-4">
                    <h2 className="text-[11px] font-medium tracking-wide text-tinta-3 uppercase">
                      Notas que apontam para esta
                    </h2>
                    <ul className="mt-2 space-y-1.5">
                      {backlinks.map((link) => (
                        <li key={link.caminho}>
                          <Link
                            href={urlDaNota(link.caminho)}
                            title={link.caminho}
                            className="flex items-center gap-1.5 text-[13px] text-[var(--realce)] hover:underline underline-offset-2"
                          >
                            <Link2 size={13} className="shrink-0 text-tinta-3" />
                            <span className="truncate">{link.titulo}</span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            </div>
          )}
        </div>

        {historicoAberto ? (
          <PainelHistorico
            caminho={nota.caminho}
            aoFechar={() => definirHistoricoAberto(false)}
            aoRestaurar={(texto) => {
              definirConteudo(texto);
              definirEstado("salvo");
            }}
          />
        ) : null}
      </div>
    </section>
  );
}

/** +/- do tamanho do texto (leitura, prévia e editor) — clicar no número volta ao padrão. */
function ControleZoom({ zoom }: { zoom: ReturnType<typeof useZoomTexto> }) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-linha px-0.5">
      <BotaoIcone rotulo="Diminuir o texto" onClick={zoom.diminuir} className="size-6">
        <ZoomOut size={13} />
      </BotaoIcone>
      <button
        type="button"
        onClick={zoom.resetar}
        title="Voltar ao tamanho padrão"
        className="w-9 text-center text-[10.5px] tabular-nums text-tinta-3 hover:text-tinta"
      >
        {Math.round(zoom.escala * 100)}%
      </button>
      <BotaoIcone rotulo="Aumentar o texto" onClick={zoom.aumentar} className="size-6">
        <ZoomIn size={13} />
      </BotaoIcone>
    </div>
  );
}

function IndicadorEstado({
  estado,
  atualizadoEm,
  aoTentarDeNovo,
}: {
  estado: Estado;
  atualizadoEm: string;
  aoTentarDeNovo: () => void;
}) {
  if (estado === "salvando") {
    return (
      <span className="flex items-center gap-1 px-1.5 text-[11.5px] text-tinta-3">
        <Loader2 size={12} className="animate-spin" />
        salvando
      </span>
    );
  }
  if (estado === "pendente") {
    return <span className="px-1.5 text-[11.5px] text-tinta-3">alterações não salvas</span>;
  }
  if (estado === "erro") {
    // A edição continua presa no navegador até salvar de verdade — por isso
    // o botão de tentar de novo fica junto do aviso, não escondido num menu.
    return (
      <span className="flex items-center gap-1.5 px-1.5 text-[11.5px] text-perigo" role="alert">
        não deu para salvar
        <button
          type="button"
          onClick={aoTentarDeNovo}
          className="font-semibold underline decoration-1 underline-offset-2 hover:decoration-2"
        >
          tentar de novo
        </button>
      </span>
    );
  }
  return (
    <span
      className="flex items-center gap-1 px-1.5 text-[11.5px] text-tinta-3"
      title={`Última alteração em ${formatarDataHora(atualizadoEm)}`}
    >
      <Check size={12} />
      salvo
    </span>
  );
}
