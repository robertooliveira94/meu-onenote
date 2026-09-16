"use client";

import clsx from "clsx";
import {
  AppWindow,
  ArrowLeftRight,
  Check,
  Eye,
  History,
  Link2,
  Loader2,
  PaintBucket,
  ListTree,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Star,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  acaoAlternarFavorita,
  acaoColarImagem,
  acaoConverterFormato,
  acaoDefinirEtiquetasDaNota,
  acaoRenomear,
  acaoSalvarAnexoDaNota,
  acaoSalvarNota,
  acaoTitulosDeNotas,
} from "@/app/acoes";
import { pastaDe } from "@/lib/caminho-texto";
import { contarPalavras, tempoDeLeituraEmMinutos } from "@/lib/contagem";
import { ROTULO_FUNDO, useFundoEditor } from "@/lib/fundo-editor";
import { coordenadasDoCursor } from "@/lib/cursor-editor";
import { continuarLista, duplicarLinha, indentar, moverLinha } from "@/lib/editor-teclado";
import { alternarTarefa, envolver, inserirBloco } from "@/lib/formatacao";
import { useModoFoco } from "@/lib/foco";
import { abrirJanelaFlutuante } from "@/lib/janela-flutuante";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import {
  COMANDO_IMAGEM,
  aplicarComando,
  aplicarLink,
  detectarGatilho,
  limparGatilho,
  sugestoesDeComando,
  sugestoesDeEtiqueta,
  sugestoesDeLink,
  type Gatilho,
  type Sugestao,
  type TituloParaLink,
} from "@/lib/sugestoes-editor";
import { extrairTitulos } from "@/lib/sumario";
import { formatarDataHora, urlDaNota, urlDaNotaFlutuante } from "@/lib/rotas";
import type { Etiqueta, Modelo, Nota } from "@/lib/tipos";
import { useAtalho } from "@/lib/atalhos";
import { useZoomTexto } from "@/lib/zoom";

import { BarraFormatacao, atalhoDeFormatacao } from "./barra-formatacao";
import { PainelHistorico } from "./painel-historico";
import { SeletorEtiquetas } from "./seletor-etiquetas";
import { SugestoesEditor } from "./sugestoes-editor";
import { SumarioNota } from "./sumario-nota";
import { TituloEditavel } from "./titulo-editavel";
import { AlcaRedimensionar, Botao, BotaoIcone, ItemMenu, Menu } from "./ui";
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
  modelos,
  editandoInicial,
  iconeDoCaderno,
  mapaDeLinks,
  backlinks,
  flutuante = false,
}: {
  nota: Nota;
  etiquetas: Etiqueta[];
  /** Para o comando `/modelo` colar um modelo no ponto do cursor. */
  modelos: Modelo[];
  editandoInicial: boolean;
  iconeDoCaderno: string;
  /** Título normalizado → caminho resolvido dos `[[links]]` desta nota, calculado no servidor. */
  mapaDeLinks: Record<string, string | null>;
  /** Notas que citam `[[EstaNota]]`. */
  backlinks: { caminho: string; titulo: string }[];
  /** Renderizada dentro da janela flutuante (janela separada do navegador): esconde o botão "Tornar flutuante". */
  flutuante?: boolean;
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
  // Lembrado entre sessões (é preferência de quem edita, não desta nota em
  // particular) — quem já sabe o que está escrevendo prefere o texto cru
  // ocupando a tela toda em vez de dividir espaço com a prévia.
  const [previaVisivel, definirPreviaVisivel] = useState(true);
  useEffect(() => {
    try {
      const salva = localStorage.getItem("previa-visivel");
      if (salva !== null) definirPreviaVisivel(salva === "1");
    } catch {
      // Sem armazenamento: fica visível pela sessão inteira.
    }
  }, []);
  function alternarPrevia() {
    definirPreviaVisivel((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem("previa-visivel", proximo ? "1" : "0");
      } catch {
        // Sem armazenamento: o ajuste vale só para esta sessão.
      }
      return proximo;
    });
  }
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("sumario-visivel");
      if (salvo !== null) definirSumarioVisivel(salvo === "1");
    } catch {
      // Sem armazenamento: fica visível pela sessão inteira.
    }
  }, []);
  const alternarSumario = useCallback(() => {
    definirSumarioVisivel((atual) => {
      const proximo = !atual;
      try {
        localStorage.setItem("sumario-visivel", proximo ? "1" : "0");
      } catch {
        // Sem armazenamento: o ajuste vale só para esta sessão.
      }
      return proximo;
    });
  }, []);

  const [estado, definirEstado] = useState<Estado>("salvo");
  const [historicoAberto, definirHistoricoAberto] = useState(false);
  const [sumarioVisivel, definirSumarioVisivel] = useState(true);
  const [favorita, definirFavorita] = useState(nota.favorita);
  const [avisoImagem, definirAvisoImagem] = useState<string | null>(null);
  // As etiquetas da nota, em estado: o `#` do editor aplica uma sem passar
  // pelo seletor do cabeçalho, e o seletor precisa acompanhar.
  const [etiquetasAtuais, definirEtiquetasAtuais] = useState(nota.etiquetas);
  // Todos os títulos do vault, para o `[[` — carregados uma vez, ao entrar
  // em edição, e filtrados aqui a cada tecla.
  const [titulosParaLink, definirTitulosParaLink] = useState<TituloParaLink[] | null>(null);
  const [gatilho, definirGatilho] = useState<Gatilho | null>(null);
  const [posicaoSugestoes, definirPosicaoSugestoes] = useState({ esquerda: 0, topo: 0 });
  const [sugestaoAtiva, definirSugestaoAtiva] = useState(0);
  const colunaEditor = useRef<HTMLDivElement>(null);
  const seletorDeArquivo = useRef<HTMLInputElement>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const painelLeitura = useRef<HTMLDivElement | null>(null);
  const zoom = useZoomTexto();
  const fundoEditor = useFundoEditor();
  const modoFoco = useModoFoco();
  // Duas refs no mesmo elemento: a do zoom (Ctrl+roda) e a do sumário, que
  // precisa do painel rolável para saber qual título está na tela. Devolver o
  // retorno de `refRolagem` preserva a limpeza do ouvinte de `wheel`.
  const refPainelLeitura = useCallback(
    (elemento: HTMLDivElement | null) => {
      painelLeitura.current = elemento;
      return zoom.refRolagem(elemento);
    },
    [zoom.refRolagem],
  );
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
    if (conteudo === nota.conteudo) return;
    // Só aqui a casca se atualiza: o salvamento automático não revalida nada
    // (ver `acaoSalvarNota`), então é ao sair da edição que a lista de
    // páginas pega o trecho novo e a data nova.
    salvar(conteudo).then(() => roteador.refresh());
  }, [conteudo, ehMarkdown, nota.conteudo, roteador, salvar]);

  // Do texto adiado, não do imediato: em notas grandes, reextrair os títulos
  // a cada tecla competiria com o próprio campo de texto.
  const titulos = useMemo(() => extrairTitulos(conteudoPreVisualizado), [conteudoPreVisualizado]);
  // Menos de três títulos não é sumário, é repetição do que já está à vista.
  const temSumario = ehMarkdown && titulos.length >= 3;
  const sumarioAberto = temSumario && sumarioVisivel;

  /** Clicar num título do sumário durante a edição leva o cursor até a linha dele. */
  const irParaLinha = useCallback((linha: number) => {
    const campo = area.current;
    if (!campo) return;
    const posicao = campo.value.split("\n").slice(0, linha).reduce((soma, texto) => soma + texto.length + 1, 0);
    campo.focus();
    campo.setSelectionRange(posicao, posicao);

    // Quem rola é o próprio campo (um textarea rola por dentro), e
    // `setSelectionRange` sozinho não garante trazer a linha para a tela.
    // Multiplicar a linha pela altura da linha erraria em texto que quebra
    // sozinho — uma linha lógica pode ocupar três visuais —, então a altura
    // sai de um espelho invisível com a mesma fonte e a mesma largura.
    const estilo = getComputedStyle(campo);
    const espelho = document.createElement("div");
    espelho.style.cssText = [
      "position:absolute",
      "visibility:hidden",
      "white-space:pre-wrap",
      "box-sizing:border-box",
      "top:0",
      "left:-9999px",
      `width:${campo.clientWidth}px`,
      `padding:0 ${estilo.paddingRight} 0 ${estilo.paddingLeft}`,
      `font-family:${estilo.fontFamily}`,
      `font-size:${estilo.fontSize}`,
      `font-weight:${estilo.fontWeight}`,
      `line-height:${estilo.lineHeight}`,
      `letter-spacing:${estilo.letterSpacing}`,
      `overflow-wrap:${estilo.overflowWrap}`,
      `word-break:${estilo.wordBreak}`,
      `tab-size:${estilo.tabSize}`,
    ].join(";");
    espelho.textContent = `${campo.value.split("\n").slice(0, linha).join("\n")}\n`;
    document.body.appendChild(espelho);
    const alturaAteALinha = espelho.getBoundingClientRect().height;
    espelho.remove();

    const respiro = 3 * (parseFloat(estilo.lineHeight) || 20);
    campo.scrollTop = Math.max(0, parseFloat(estilo.paddingTop) + alturaAteALinha - respiro);
  }, []);

  // Atalhos da nota, no registro central (é o que a folha `?` lista).
  useAtalho("ctrl+s", { grupo: "Anotações", descricao: "Salvar agora", mesmoEmCampo: true, acao: () => salvar(conteudo) });
  useAtalho("e", {
    grupo: "Anotações",
    descricao: editando ? "Concluir a edição" : "Editar a página",
    acao: () => (editando ? concluirEdicao() : ehMarkdown && definirEditando(true)),
  });
  useAtalho("]", {
    grupo: "Anotações",
    descricao: sumarioVisivel ? "Esconder o sumário" : "Mostrar o sumário",
    ativo: temSumario,
    acao: alternarSumario,
  });
  useAtalho("ctrl+shift+f", {
    grupo: "Anotações",
    descricao: modoFoco.foco ? "Sair do modo foco" : "Modo foco (só o texto)",
    mesmoEmCampo: true,
    acao: modoFoco.alternar,
  });
  // Esc só sai da edição quando não há um diálogo por cima — o registro já
  // engole teclas soltas com diálogo aberto, mas o Esc do editor precisa
  // valer dentro do próprio campo de texto.
  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      if (evento.key !== "Escape" || document.querySelector("[role=dialog]")) return;
      // Um Esc por vez, do mais recente para o mais antigo: primeiro devolve
      // a moldura, só depois sai da edição.
      if (modoFoco.foco) modoFoco.sair();
      else if (editando) concluirEdicao();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [editando, concluirEdicao, modoFoco]);

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

  /**
   * Escreve no campo e no estado de uma vez.
   *
   * O campo de texto é NÃO controlado (`defaultValue`, e não `value`): quem
   * manda no que está escrito é o DOM, não o React. Isso é o que impede a
   * letra de sumir enquanto se digita — num campo controlado, uma
   * renderização concorrente interrompida pode repor no DOM o texto de uma
   * renderização já vencida (era o caso do "###" que virava "##" e voltava
   * ao apertar Enter, com a prévia mostrando mais "#" que o editor).
   *
   * A contrapartida: mudança feita por código (negrito, imagem colada,
   * restaurar uma versão) precisa escrever no campo na mão — é o que esta
   * função faz.
   */
  const aplicarNoCampo = useCallback(
    (texto: string, selecao?: { inicio: number; fim: number }) => {
      const campo = area.current;
      if (campo) {
        campo.value = texto;
        if (selecao) {
          requestAnimationFrame(() => {
            campo.focus();
            campo.setSelectionRange(selecao.inicio, selecao.fim);
          });
        }
      }
      definirConteudo(texto);
    },
    [],
  );

  // ------------------------------------------------------------ sugestões

  const sugestoes = useMemo<Sugestao[]>(() => {
    if (!gatilho) return [];
    if (gatilho.tipo === "wikilink") return sugestoesDeLink(gatilho.termo, titulosParaLink ?? []);
    if (gatilho.tipo === "etiqueta") return sugestoesDeEtiqueta(gatilho.termo, etiquetas, etiquetasAtuais);
    return sugestoesDeComando(gatilho.termo, modelos);
  }, [gatilho, titulosParaLink, etiquetas, etiquetasAtuais, modelos]);

  useEffect(() => {
    if (editando && ehMarkdown && titulosParaLink === null) {
      acaoTitulosDeNotas().then(definirTitulosParaLink).catch(() => definirTitulosParaLink([]));
    }
  }, [editando, ehMarkdown, titulosParaLink]);

  /**
   * Depois de cada tecla ou clique: há um `[[`, `#` ou `/` logo atrás do
   * cursor? Se sim, a caixinha abre (ou segue) colada nele.
   */
  const atualizarSugestoes = useCallback(
    (campo: HTMLTextAreaElement) => {
      if (!ehMarkdown) return;
      const achado = campo.selectionStart === campo.selectionEnd ? detectarGatilho(campo.value, campo.selectionStart) : null;
      if (!achado) {
        if (gatilho) definirGatilho(null);
        return;
      }
      const mudouDeGatilho = !gatilho || gatilho.tipo !== achado.tipo || gatilho.inicio !== achado.inicio;
      if (mudouDeGatilho) definirSugestaoAtiva(0);
      definirGatilho(achado);

      // Posição relativa à coluna do editor, que é quem posiciona a caixa.
      const cursor = coordenadasDoCursor(campo);
      const coluna = colunaEditor.current?.getBoundingClientRect();
      const caixa = campo.getBoundingClientRect();
      const esquerda = caixa.left - (coluna?.left ?? 0) + cursor.esquerda;
      const topo = caixa.top - (coluna?.top ?? 0) + cursor.topo + cursor.alturaDaLinha + 4;
      const larguraDaColuna = coluna?.width ?? Number.POSITIVE_INFINITY;
      definirPosicaoSugestoes({ esquerda: Math.max(8, Math.min(esquerda, larguraDaColuna - 288)), topo });
    },
    [ehMarkdown, gatilho],
  );

  /** Aplica a sugestão escolhida no texto (ou dispara o que ela pede). */
  const escolherSugestao = useCallback(
    async (item: Sugestao) => {
      const campo = area.current;
      if (!campo || !gatilho) return;
      const selecao = { texto: campo.value, inicio: campo.selectionStart, fim: campo.selectionEnd };
      definirGatilho(null);

      if (gatilho.tipo === "wikilink") {
        const resultado = aplicarLink(selecao, gatilho, item.rotulo);
        aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
        return;
      }

      if (gatilho.tipo === "etiqueta") {
        // `#urg` + escolha → a etiqueta entra na nota e o `#urg` some do
        // texto: etiqueta aqui é metadado do índice, não palavra do arquivo.
        const resultado = limparGatilho(selecao, gatilho);
        aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
        const proximas = [...etiquetasAtuais, item.id];
        definirEtiquetasAtuais(proximas);
        await acaoDefinirEtiquetasDaNota(nota.caminho, proximas);
        return;
      }

      if (item.id === COMANDO_IMAGEM) {
        const resultado = limparGatilho(selecao, gatilho);
        aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
        seletorDeArquivo.current?.click();
        return;
      }
      const resultado = aplicarComando(selecao, gatilho, item.id, modelos);
      aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
    },
    [gatilho, etiquetasAtuais, modelos, nota.caminho, aplicarNoCampo],
  );

  // ------------------------------------------------------------ teclado

  /**
   * O que um editor faz e um `<textarea>` cru não: setas e Enter na caixa de
   * sugestões quando ela está aberta; Enter continuando a lista; Tab
   * indentando; Ctrl+B/I como os botões da barra. Alt+setas e Ctrl+D moram
   * no registro de atalhos (logo abaixo), para a folha `?` listá-los. Tudo o
   * que não for nosso segue para o navegador.
   */
  function aoTeclarNoCampo(evento: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!ehMarkdown) return;
    const campo = evento.currentTarget;
    const selecao = { texto: campo.value, inicio: campo.selectionStart, fim: campo.selectionEnd };
    const aplicar = (resultado: { texto: string; inicio: number; fim: number } | null) => {
      if (!resultado) return;
      evento.preventDefault();
      aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
    };

    if (gatilho) {
      if (evento.key === "ArrowDown" || evento.key === "ArrowUp") {
        evento.preventDefault();
        if (sugestoes.length === 0) return;
        const passo = evento.key === "ArrowDown" ? 1 : -1;
        definirSugestaoAtiva((atual) => (atual + passo + sugestoes.length) % sugestoes.length);
        return;
      }
      if ((evento.key === "Enter" || evento.key === "Tab") && sugestoes[sugestaoAtiva]) {
        evento.preventDefault();
        void escolherSugestao(sugestoes[sugestaoAtiva]);
        return;
      }
      if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        definirGatilho(null);
        return;
      }
    }

    const atalho = atalhoDeFormatacao(evento);
    if (atalho) {
      aplicar(envolver(selecao, atalho === "negrito" ? "**" : "*"));
      return;
    }
    if (evento.key === "Enter" && !evento.shiftKey && !evento.ctrlKey && !evento.altKey) {
      aplicar(continuarLista(selecao));
      return;
    }
    if (evento.key === "Tab") {
      aplicar(indentar(selecao, evento.shiftKey ? -1 : 1));
      return;
    }
  }

  /** Roda uma operação de "texto + seleção" no campo, vinda de um atalho do registro. */
  const operarNoCampo = useCallback(
    (operacao: (selecao: { texto: string; inicio: number; fim: number }) => { texto: string; inicio: number; fim: number } | null) => {
      const campo = area.current;
      if (!campo) return;
      const resultado = operacao({ texto: campo.value, inicio: campo.selectionStart, fim: campo.selectionEnd });
      if (resultado) aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
    },
    [aplicarNoCampo],
  );
  const atalhosDoEditor = { grupo: "Anotações", mesmoEmCampo: true, ativo: editando && ehMarkdown };
  useAtalho("alt+arrowup", { ...atalhosDoEditor, descricao: "Mover a linha para cima", acao: () => operarNoCampo((s) => moverLinha(s, -1)) });
  useAtalho("alt+arrowdown", { ...atalhosDoEditor, descricao: "Mover a linha para baixo", acao: () => operarNoCampo((s) => moverLinha(s, 1)) });
  useAtalho("ctrl+d", { ...atalhosDoEditor, descricao: "Duplicar a linha", acao: () => operarNoCampo(duplicarLinha) });

  // ------------------------------------------------------------ anexos

  /** Um arquivo arrastado (ou escolhido pelo `/imagem`) vira anexo e entra como imagem ou link. */
  async function anexarArquivos(arquivos: FileList | File[]) {
    const campo = area.current;
    if (!campo) return;
    for (const arquivo of Array.from(arquivos)) {
      definirAvisoImagem(null);
      const base64 = await arquivoParaBase64(arquivo);
      const resposta = await acaoSalvarAnexoDaNota(nota.caminho, arquivo.name, base64);
      if (!resposta.ok || !resposta.mensagem) {
        definirAvisoImagem(resposta.ok ? "Não deu para anexar o arquivo." : resposta.erro);
        continue;
      }
      const ehImagem = arquivo.type.startsWith("image/");
      // Espaço e acento no nome quebram o link em markdown (`(Orçamento
      // 2026.pdf)` não é um destino válido); codificado, é link em qualquer
      // leitor — o visualizador decodifica de volta ao servir.
      const destino = encodeURI(resposta.mensagem);
      const trecho = ehImagem ? `![](${destino})` : `[${arquivo.name}](${destino})`;
      const resultado = inserirBloco(
        { texto: campo.value, inicio: campo.selectionStart, fim: campo.selectionEnd },
        trecho,
      );
      aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
    }
  }

  function aoSoltarNoCampo(evento: React.DragEvent<HTMLTextAreaElement>) {
    if (!evento.dataTransfer.files.length) return; // Texto arrastado: o navegador cuida.
    evento.preventDefault();
    void anexarArquivos(evento.dataTransfer.files);
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
      { texto: campo.value, inicio: inicioDaSelecao, fim: fimDaSelecao },
      `![](${resposta.mensagem})`,
    );
    aplicarNoCampo(resultado.texto, { inicio: resultado.inicio, fim: resultado.fim });
  }

  // Edição lado a lado: texto cru à esquerda, prévia à direita. Texto puro
  // nunca divide (não tem o que pré-visualizar).
  const divididoEmDois = ehMarkdown && previaVisivel;

  const palavras = useMemo(() => contarPalavras(conteudo), [conteudo]);
  const minutosDeLeitura = tempoDeLeituraEmMinutos(palavras);

  const secoes = nota.caminho.split("/").slice(0, -1);

  return (
    <section className="relative flex min-w-0 flex-1 flex-col bg-papel">
      {/* No modo foco some tudo, inclusive o botão que ligou o modo — sem
          esta saída flutuante a pessoa fica sem nada clicável na tela.
          Discreto até o mouse chegar perto, para não competir com o texto. */}
      {modoFoco.foco ? (
        <button
          type="button"
          onClick={modoFoco.sair}
          title="Sair do modo foco (Esc)"
          className="absolute top-3 right-4 z-20 flex items-center gap-1.5 rounded-lg border border-linha bg-superficie px-2 py-1 text-[11.5px] text-tinta-2 opacity-35 shadow-[var(--sombra)] transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          <Minimize2 size={13} />
          Sair do foco
        </button>
      ) : null}

      <header className="esconde-no-foco shrink-0 border-b border-linha bg-superficie px-7 pt-3 pb-2.5">
        {/* `flex-wrap`: numa janela estreita (a janela flutuante), o bloco de
            botões desce para baixo do título em vez de esmagá-lo até o texto
            quebrar caractere a caractere. O `minWidth` no h1 é o gatilho: quando
            título + botões não cabem numa linha, são os botões que descem. */}
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <h1 className="flex-1" style={{ minWidth: "13rem" }}>
            <TituloEditavel
              titulo={nota.titulo}
              className="block truncate text-[24px] leading-tight font-extrabold tracking-[-0.03em]"
              aoRenomear={async (novoTitulo) => {
                const resposta = await acaoRenomear(nota.caminho, novoTitulo);
                if (!resposta.ok) return resposta.erro;
                // O endereço tem o nome do arquivo: sem trocar, a página
                // aberta apontaria para um arquivo que não existe mais.
                if (resposta.mensagem) {
                  roteador.replace(`${urlDaNota(resposta.mensagem)}${editando ? "?editando=1" : ""}`);
                }
                return null;
              }}
            />
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

            {temSumario ? (
              <BotaoIcone
                rotulo={sumarioVisivel ? "Esconder o sumário (])" : "Mostrar o sumário (])"}
                onClick={alternarSumario}
              >
                <ListTree size={15} className={sumarioVisivel ? "text-tinta" : undefined} />
              </BotaoIcone>
            ) : null}

            <BotaoIcone
              rotulo={modoFoco.foco ? "Sair do modo foco (Esc)" : "Modo foco (Ctrl+Shift+F)"}
              onClick={modoFoco.alternar}
            >
              {modoFoco.foco ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
            </BotaoIcone>

            {flutuante ? null : (
              <BotaoIcone
                rotulo="Tornar flutuante"
                onClick={() => abrirJanelaFlutuante(urlDaNotaFlutuante(nota.caminho))}
              >
                <AppWindow size={15} />
              </BotaoIcone>
            )}

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

        {/* Uma linha só de metadados: onde a página mora, as etiquetas dela e
            o tamanho do texto. Eram três linhas separadas — trilha em cima do
            título, etiquetas embaixo e contagem numa terceira —, o que fazia
            o cabeçalho comer quase um terço da altura útil numa tela de
            notebook. */}
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11.5px] text-tinta-3">
          <span className="flex min-w-0 shrink-0 items-center gap-1.5">
            <span aria-hidden>{iconeDoCaderno}</span>
            <span className="truncate">{secoes.join(" / ")}</span>
          </span>
          <SeletorEtiquetas
            // A chave remonta o seletor quando o `#` do editor aplica uma
            // etiqueta por fora dele — ele guarda a lista em estado próprio.
            key={etiquetasAtuais.join(",")}
            caminho={nota.caminho}
            etiquetasDaNota={etiquetasAtuais}
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
            <div className="flex min-h-0 flex-1">
              {/* A barra de formatação vive dentro da coluna do texto, não
                  por cima das duas: ela age no que está escrito à esquerda,
                  e atravessar a prévia sugeria que agia nela também. */}
              <div
                ref={colunaEditor}
                className={clsx(
                  "relative flex flex-col overflow-hidden",
                  divididoEmDois ? "shrink-0" : "min-w-0 flex-1",
                )}
                style={divididoEmDois ? { width: divisorEditor.largura } : undefined}
              >
                {gatilho ? (
                  <SugestoesEditor
                    tipo={gatilho.tipo}
                    itens={sugestoes}
                    ativo={sugestaoAtiva}
                    posicao={posicaoSugestoes}
                    aoEscolher={(item) => void escolherSugestao(item)}
                    aoPassarPorCima={definirSugestaoAtiva}
                  />
                ) : null}
                <input
                  ref={seletorDeArquivo}
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(evento) => {
                    if (evento.target.files) void anexarArquivos(evento.target.files);
                    evento.target.value = "";
                  }}
                />
              <BarraFormatacao
                formato={nota.formato}
                campo={area}
                conteudo={conteudo}
                aoMudar={definirConteudo}
                extra={
                  ehMarkdown ? (
                    <div className="flex items-center gap-0.5">
                      <Menu
                        gatilho={(abrir) => (
                          <BotaoIcone rotulo="Cor de fundo da escrita" onClick={abrir}>
                            <PaintBucket size={15} />
                          </BotaoIcone>
                        )}
                      >
                        {(fechar) =>
                          fundoEditor.opcoes.map((opcao) => (
                            <ItemMenu
                              key={opcao}
                              icone={
                                <Check
                                  size={14}
                                  className={fundoEditor.fundo === opcao ? undefined : "invisible"}
                                />
                              }
                              onClick={() => {
                                fundoEditor.mudar(opcao);
                                fechar();
                              }}
                            >
                              {ROTULO_FUNDO[opcao]}
                            </ItemMenu>
                          ))
                        }
                      </Menu>
                      <BotaoIcone
                        rotulo={previaVisivel ? "Esconder a prévia" : "Mostrar a prévia"}
                        onClick={alternarPrevia}
                      >
                        {previaVisivel ? <PanelRightClose size={15} /> : <PanelRightOpen size={15} />}
                      </BotaoIcone>
                    </div>
                  ) : (
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

                {/* A rolagem é deste envoltório, não da coluna inteira: é o
                    que mantém a barra de formatação parada no topo e a alça
                    de redimensionar sempre na borda visível. */}
                <div className="min-h-0 flex-1 overflow-y-auto" ref={zoom.refRolagem}>
                  <textarea
                    ref={area}
                    // Não controlado de propósito — ver `aplicarNoCampo`.
                    defaultValue={conteudo}
                    onChange={(evento) => {
                      definirConteudo(evento.target.value);
                      atualizarSugestoes(evento.target);
                    }}
                    onKeyDown={aoTeclarNoCampo}
                    onKeyUp={(evento) => {
                      // Setas e cliques mudam o cursor sem mudar o texto.
                      if (evento.key.startsWith("Arrow") || evento.key === "Home" || evento.key === "End") {
                        atualizarSugestoes(evento.currentTarget);
                      }
                    }}
                    onClick={(evento) => atualizarSugestoes(evento.currentTarget)}
                    onBlur={() => definirGatilho(null)}
                    onPaste={aoColarNoCampo}
                    onDragOver={(evento) => {
                      if (evento.dataTransfer.types.includes("Files")) evento.preventDefault();
                    }}
                    onDrop={aoSoltarNoCampo}
                    spellCheck
                    placeholder={
                      ehMarkdown
                        ? "Escreva em markdown. # título, - lista, - [ ] tarefa. [[ liga uma página, / insere algo pronto."
                        : "Escreva à vontade."
                    }
                    className={clsx(
                      ehMarkdown ? "editor-texto" : "editor-simples",
                      "min-h-full w-full resize-none px-7 py-5 placeholder:text-tinta-3 focus:outline-none",
                    )}
                  />
                </div>

                {divididoEmDois ? (
                  <AlcaRedimensionar
                    aoArrastar={divisorEditor.iniciarArraste}
                    aoRestaurar={divisorEditor.restaurarPadrao}
                    rotulo="Redimensionar o texto e a prévia"
                  />
                ) : null}
              </div>

              {divididoEmDois ? (
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
          ) : (
            <div className="min-w-0 flex-1 overflow-y-auto px-8 py-8" ref={refPainelLeitura}>
              {/*
                A margem colorida é a lombada do caderno chegando até a
                página — por isso ela desenha a si mesma ao abrir a nota
                (chave `nota.caminho` força o desenho de novo a cada nota
                diferente, mesmo trocando de uma leitura para outra sem
                passar pelo modo de edição), em vez de só aparecer pronta
                junto com o resto do texto.
              */}
              {/* A largura de leitura: passar de ~72 caracteres por linha
                  cansa o olho, e numa tela larga com a coluna recolhida a
                  linha chegava a 150. A prévia da edição continua livre — lá
                  o espaço já é metade. */}
              <article key={nota.caminho} className="coluna-leitura relative pl-7">
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

        {sumarioAberto ? (
          <SumarioNota
            titulos={titulos}
            editando={editando}
            containerLeitura={painelLeitura}
            aoIrParaLinha={irParaLinha}
            aoFechar={alternarSumario}
          />
        ) : null}

        {historicoAberto ? (
          <PainelHistorico
            caminho={nota.caminho}
            aoFechar={() => definirHistoricoAberto(false)}
            aoRestaurar={(texto) => {
              aplicarNoCampo(texto);
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
