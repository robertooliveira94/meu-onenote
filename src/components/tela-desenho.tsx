"use client";

import "@excalidraw/excalidraw/index.css";

import { Excalidraw, MainMenu, exportToBlob, getSceneVersion, loadFromBlob } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI, ExcalidrawInitialDataState } from "@excalidraw/excalidraw/types";
import { Check, PenTool, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ehTemaEscuro, useTema } from "@/lib/tema";

import { DialogoConfirmar } from "./dialogos";
import { Aviso, Botao } from "./ui";

declare global {
  interface Window {
    EXCALIDRAW_ASSET_PATH?: string | string[];
  }
}

// As fontes vêm do próprio app (copiadas por scripts/copiar-fontes-excalidraw.mjs),
// não do CDN padrão — funciona sem internet. Definido no carregamento deste
// módulo, antes de o Excalidraw pedir a primeira fonte.
if (typeof window !== "undefined") window.EXCALIDRAW_ASSET_PATH = "/excalidraw/";

/** Resolução do PNG: 2× para ficar nítido em tela de alta densidade (o visualizador mostra na metade). */
const ESCALA_EXPORTACAO = 2;

/**
 * O editor de desenho em tela cheia. Carregado só quando alguém abre um
 * desenho (ver `editor-desenho.tsx`) — o Excalidraw é pesado demais para ir
 * junto com toda página.
 */
export default function TelaDesenho({
  url,
  aoSalvar,
  aoFechar,
}: {
  /** Endereço do `.excalidraw.png` a reabrir; sem ele, quadro em branco. */
  url: string | null;
  /** Recebe o PNG com a cena embutida; devolve a mensagem de erro, ou null quando deu certo. */
  aoSalvar: (png: Blob) => Promise<string | null>;
  aoFechar: () => void;
}) {
  const { tema } = useTema();
  const api = useRef<ExcalidrawImperativeAPI | null>(null);
  const versaoInicial = useRef(0);
  const [sujo, definirSujo] = useState(false);
  const [salvando, definirSalvando] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);
  // Se a cena não carregou (PNG sem cena dentro, arquivo sumiu), salvar
  // trocaria o desenho de verdade por um quadro vazio. Então não deixa.
  const [falhaAoAbrir, definirFalhaAoAbrir] = useState<string | null>(null);
  const [confirmarDescarte, definirConfirmarDescarte] = useState(false);

  const dadosIniciais = useMemo<Promise<ExcalidrawInitialDataState | null> | null>(() => {
    if (!url) return null;
    return fetch(url, { cache: "no-store" })
      .then((resposta) => {
        if (!resposta.ok) throw new Error("O arquivo do desenho não foi encontrado.");
        return resposta.blob();
      })
      .then((arquivo) => loadFromBlob(arquivo, null, null))
      .then((cena) => {
        versaoInicial.current = getSceneVersion(cena.elements);
        return {
          elements: cena.elements,
          files: cena.files,
          appState: { viewBackgroundColor: cena.appState.viewBackgroundColor },
          scrollToContent: true,
        };
      })
      .catch((falha: unknown) => {
        definirFalhaAoAbrir(
          falha instanceof Error && falha.message.startsWith("O arquivo")
            ? falha.message
            : "Esta imagem não guarda um desenho editável (foi feita fora do editor ou perdeu os dados).",
        );
        return null;
      });
  }, [url]);

  const salvar = useCallback(async () => {
    const excalidraw = api.current;
    if (!excalidraw || salvando || falhaAoAbrir) return;
    const elementos = excalidraw.getSceneElements();
    if (elementos.length === 0) {
      if (!url) {
        aoFechar(); // Quadro novo que ficou em branco: nada a inserir.
        return;
      }
      definirErro("O desenho está vazio. Para tirá-lo da página, apague a linha dele no texto.");
      return;
    }
    definirSalvando(true);
    definirErro(null);
    try {
      const png = await exportToBlob({
        elements: elementos,
        files: excalidraw.getFiles(),
        mimeType: "image/png",
        exportPadding: 16,
        // A escala vem daqui — `exportScale` no appState o exportToBlob ignora.
        getDimensions: (largura: number, altura: number) => ({
          width: largura * ESCALA_EXPORTACAO,
          height: altura * ESCALA_EXPORTACAO,
          scale: ESCALA_EXPORTACAO,
        }),
        appState: {
          ...excalidraw.getAppState(),
          exportEmbedScene: true,
          exportBackground: true,
          // O arquivo é sempre claro, independente do tema de quem desenhou:
          // é uma imagem que vai para export, impressão, outro leitor.
          exportWithDarkMode: false,
        },
      });
      const falha = await aoSalvar(png);
      if (falha) definirErro(falha);
    } catch {
      definirErro("Não deu para gerar a imagem do desenho.");
    } finally {
      definirSalvando(false);
    }
  }, [aoFechar, aoSalvar, falhaAoAbrir, salvando, url]);

  const fechar = useCallback(() => {
    if (sujo && !falhaAoAbrir) definirConfirmarDescarte(true);
    else aoFechar();
  }, [aoFechar, falhaAoAbrir, sujo]);

  // Ctrl+S salva o desenho — e só ele: na fase de captura, antes do atalho
  // de salvar da página e do "salvar em arquivo" do próprio Excalidraw.
  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.ctrlKey || evento.metaKey) && evento.key.toLowerCase() === "s") {
        evento.preventDefault();
        evento.stopPropagation();
        void salvar();
      }
    };
    window.addEventListener("keydown", aoTeclar, true);
    return () => window.removeEventListener("keydown", aoTeclar, true);
  }, [salvar]);

  // A página de trás não rola enquanto o editor cobre a tela.
  useEffect(() => {
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-papel" role="dialog" aria-modal aria-label="Desenho">
      <header className="flex shrink-0 items-center gap-2 border-b border-linha bg-superficie px-4 py-2">
        <PenTool size={15} className="text-tinta-2" />
        <h2 className="text-[14px] font-bold">{url ? "Editar desenho" : "Novo desenho"}</h2>
        <span className="text-[11.5px] text-tinta-3">
          {falhaAoAbrir ? "" : sujo ? "alterações não salvas" : ""}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <Botao variante="sutil" onClick={fechar}>
            <X size={14} />
            {falhaAoAbrir ? "Fechar" : "Cancelar"}
          </Botao>
          {falhaAoAbrir ? null : (
            <Botao variante="primario" onClick={() => void salvar()} disabled={salvando} title="Salvar (Ctrl+S)">
              <Check size={14} />
              {salvando ? "Salvando…" : url ? "Salvar" : "Inserir na página"}
            </Botao>
          )}
        </div>
      </header>
      {falhaAoAbrir || erro ? (
        <div className="shrink-0 px-4 pt-2">
          <Aviso>{falhaAoAbrir ?? erro}</Aviso>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">
        <div className="absolute inset-0">
          <Excalidraw
            excalidrawAPI={(instancia) => {
              api.current = instancia;
            }}
            initialData={dadosIniciais}
            theme={ehTemaEscuro(tema) ? "dark" : "light"}
            langCode="pt-BR"
            onChange={(elementos) => definirSujo(getSceneVersion(elementos) !== versaoInicial.current)}
            UIOptions={{
              // Abrir/salvar arquivo e exportar ficam de fora: o desenho mora
              // na página, e quem salva é o botão lá em cima.
              canvasActions: { loadScene: false, saveToActiveFile: false, export: false, toggleTheme: false },
            }}
          >
            <MainMenu>
              <MainMenu.DefaultItems.SaveAsImage />
              <MainMenu.DefaultItems.ClearCanvas />
              <MainMenu.DefaultItems.ChangeCanvasBackground />
              <MainMenu.Separator />
              <MainMenu.DefaultItems.Help />
            </MainMenu>
          </Excalidraw>
        </div>
      </div>

      <DialogoConfirmar
        aberto={confirmarDescarte}
        titulo="Descartar o desenho?"
        descricao="As alterações feitas desde que o editor abriu vão se perder."
        textoBotao="Descartar"
        aoConfirmar={async () => {
          aoFechar();
          return null;
        }}
        aoFechar={() => definirConfirmarDescarte(false)}
      />
    </div>
  );
}
