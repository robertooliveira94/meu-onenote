"use client";

import { Expand, GripHorizontal, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { acaoCriarPaginaFlutuante, acaoRenomear, acaoSalvarNota } from "@/app/acoes";
import { tituloDe } from "@/lib/caminho-texto";
import { useJanelaFlutuante } from "@/lib/janela-flutuante";
import { urlDaNota } from "@/lib/rotas";

import { TituloEditavel } from "./titulo-editavel";
import { BotaoIcone } from "./ui";

const CHAVE_POSICAO = "janela-nota-flutuante-pos";
const CHAVE_TAMANHO = "janela-nota-flutuante-tam";
const TAMANHO_PADRAO = { largura: 460, altura: 480 };
const TAMANHO_MINIMO = { largura: 320, altura: 260 };
const MARGEM = 16;
const ESPERA_SALVAMENTO = 800;

type Posicao = { x: number; y: number };
type Tamanho = { largura: number; altura: number };

function lerJson<T>(chave: string): T | null {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : null;
  } catch {
    return null;
  }
}

function gravarJson(chave: string, valor: unknown): void {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Sem armazenamento: posição e tamanho valem só para esta sessão.
  }
}

/**
 * Uma nota nova, editada numa janela flutuante por cima da tela atual — sem
 * navegar pra longe de onde se estava. Arrastável pela barra do topo,
 * redimensionável pelo canto inferior direito; posição e tamanho ficam
 * lembrados entre usos, do mesmo jeito que a largura das colunas.
 *
 * Fica montada uma vez, dentro da Casca — assim sobrevive a uma navegação
 * de rota (a pessoa pode continuar clicando pela árvore com a janela
 * flutuando por cima) até ser fechada de propósito.
 */
export function JanelaNotaFlutuante() {
  const { janela, fechar } = useJanelaFlutuante();
  if (!janela) return null;
  // `key` força uma instância nova por pasta: abrir a janela para outra
  // seção enquanto uma já está aberta começa do zero, sem herdar estado da
  // pasta anterior.
  return <ConteudoDaJanela key={janela.pasta} pasta={janela.pasta} aoFechar={fechar} />;
}

function ConteudoDaJanela({ pasta, aoFechar }: { pasta: string; aoFechar: () => void }) {
  const [caminho, definirCaminho] = useState<string | null>(null);
  const [titulo, definirTitulo] = useState("");
  const [conteudo, definirConteudo] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [tamanho, definirTamanho] = useState<Tamanho>(TAMANHO_PADRAO);
  const [posicao, definirPosicao] = useState<Posicao | null>(null);
  const area = useRef<HTMLTextAreaElement>(null);
  const janelaRef = useRef<HTMLDivElement>(null);
  // Guarda contra o efeito rodando duas vezes (StrictMode, em desenvolvimento,
  // desmonta e remonta de propósito pra pegar efeito sem limpeza correta) —
  // sem isto, cada abertura da janela criava DOIS arquivos em vez de um. O
  // pedido em si só sai uma vez (a promessa fica guardada aqui, mesma
  // instância sobrevivendo ao ciclo); as DUAS rodadas do efeito só se
  // inscrevem para ouvir o resultado dela, cada uma com seu próprio
  // `cancelado` — a primeira (fantasma) é cancelada antes da promessa
  // resolver, a segunda (que fica de verdade) não.
  const criacao = useRef<ReturnType<typeof acaoCriarPaginaFlutuante> | null>(null);

  // Cria a página assim que a janela abre — o que aparece nela é sempre um
  // arquivo de verdade desde o primeiro instante, igual ao "+" normal.
  useEffect(() => {
    let cancelado = false;
    if (!criacao.current) criacao.current = acaoCriarPaginaFlutuante(pasta);
    criacao.current.then((resposta) => {
      if (cancelado) return;
      if (!resposta.ok || !resposta.mensagem) {
        definirErro(resposta.ok ? "Não deu para criar a página" : resposta.erro);
        return;
      }
      definirCaminho(resposta.mensagem);
      definirTitulo(tituloDe(resposta.mensagem));
    });
    return () => {
      cancelado = true;
    };
  }, [pasta]);

  // Tamanho e posição salvos, clampados à janela do navegador de agora —
  // uma janela grande salva numa tela ampla não pode nascer fora da tela
  // numa tela menor.
  useEffect(() => {
    const tamanhoSalvo = lerJson<Tamanho>(CHAVE_TAMANHO) ?? TAMANHO_PADRAO;
    const largura = Math.max(
      TAMANHO_MINIMO.largura,
      Math.min(tamanhoSalvo.largura, window.innerWidth - 2 * MARGEM),
    );
    const altura = Math.max(
      TAMANHO_MINIMO.altura,
      Math.min(tamanhoSalvo.altura, window.innerHeight - 2 * MARGEM),
    );
    definirTamanho({ largura, altura });

    const padrao = { x: window.innerWidth - largura - MARGEM, y: window.innerHeight - altura - MARGEM };
    const salva = lerJson<Posicao>(CHAVE_POSICAO) ?? padrao;
    definirPosicao({
      x: Math.max(MARGEM, Math.min(salva.x, window.innerWidth - largura - MARGEM)),
      y: Math.max(MARGEM, Math.min(salva.y, window.innerHeight - altura - MARGEM)),
    });
  }, []);

  // Salvamento automático — mesmo padrão da página normal (espera a
  // digitação parar), sem revalidar a casca: ver `acaoSalvarNota`.
  useEffect(() => {
    if (!caminho) return;
    const espera = setTimeout(() => {
      acaoSalvarNota(caminho, conteudo);
    }, ESPERA_SALVAMENTO);
    return () => clearTimeout(espera);
  }, [caminho, conteudo]);

  useEffect(() => {
    if (caminho) area.current?.focus();
  }, [caminho]);

  const iniciarArrasteDaJanela = useCallback(
    (evento: React.MouseEvent) => {
      if (!posicao) return;
      evento.preventDefault();
      const xInicial = evento.clientX;
      const yInicial = evento.clientY;
      const posInicial = posicao;
      const largura = janelaRef.current?.offsetWidth ?? tamanho.largura;
      const altura = janelaRef.current?.offsetHeight ?? tamanho.altura;

      function aoMover(e: MouseEvent) {
        definirPosicao({
          x: Math.max(MARGEM, Math.min(posInicial.x + (e.clientX - xInicial), window.innerWidth - largura - MARGEM)),
          y: Math.max(MARGEM, Math.min(posInicial.y + (e.clientY - yInicial), window.innerHeight - altura - MARGEM)),
        });
      }
      function aoSoltar() {
        window.removeEventListener("mousemove", aoMover);
        window.removeEventListener("mouseup", aoSoltar);
        definirPosicao((atual) => {
          if (atual) gravarJson(CHAVE_POSICAO, atual);
          return atual;
        });
      }
      window.addEventListener("mousemove", aoMover);
      window.addEventListener("mouseup", aoSoltar);
    },
    [posicao, tamanho],
  );

  const iniciarRedimensionamento = useCallback(
    (evento: React.MouseEvent) => {
      evento.preventDefault();
      evento.stopPropagation();
      const xInicial = evento.clientX;
      const yInicial = evento.clientY;
      const tamanhoInicial = tamanho;

      function aoMover(e: MouseEvent) {
        definirTamanho({
          largura: Math.max(TAMANHO_MINIMO.largura, tamanhoInicial.largura + (e.clientX - xInicial)),
          altura: Math.max(TAMANHO_MINIMO.altura, tamanhoInicial.altura + (e.clientY - yInicial)),
        });
      }
      function aoSoltar() {
        window.removeEventListener("mousemove", aoMover);
        window.removeEventListener("mouseup", aoSoltar);
        definirTamanho((atual) => {
          gravarJson(CHAVE_TAMANHO, atual);
          return atual;
        });
      }
      window.addEventListener("mousemove", aoMover);
      window.addEventListener("mouseup", aoSoltar);
    },
    [tamanho],
  );

  // Primeiro quadro: ainda calculando onde a janela cai (depende do tamanho
  // da tela, só disponível no navegador) — nada pra mostrar ainda.
  if (!posicao) return null;

  return (
    <div
      ref={janelaRef}
      role="dialog"
      aria-label="Nova página"
      className="surgir fixed z-40 flex flex-col overflow-hidden rounded-xl border border-linha bg-superficie-alta shadow-[var(--sombra)]"
      style={{ left: posicao.x, top: posicao.y, width: tamanho.largura, height: tamanho.altura }}
    >
      <div
        onMouseDown={iniciarArrasteDaJanela}
        className="flex shrink-0 cursor-grab items-center gap-1.5 border-b border-linha bg-superficie px-2.5 py-2 active:cursor-grabbing"
      >
        <GripHorizontal size={13} className="shrink-0 text-tinta-3" aria-hidden />
        <div className="min-w-0 flex-1">
          {caminho ? (
            <TituloEditavel
              titulo={titulo}
              className="block truncate text-[12.5px] font-semibold"
              aoRenomear={async (novoTitulo) => {
                const resposta = await acaoRenomear(caminho, novoTitulo);
                if (!resposta.ok) return resposta.erro;
                if (resposta.mensagem) definirCaminho(resposta.mensagem);
                definirTitulo(novoTitulo);
                return null;
              }}
            />
          ) : (
            <span className="text-[12.5px] text-tinta-3">Criando página…</span>
          )}
        </div>
        {caminho ? (
          <Link
            href={urlDaNota(caminho)}
            onClick={aoFechar}
            title="Abrir na tela inteira"
            aria-label="Abrir na tela inteira"
            className="flex size-6 shrink-0 items-center justify-center rounded-md text-tinta-2 transition-colors hover:bg-realce-medio hover:text-tinta"
          >
            <Expand size={13} />
          </Link>
        ) : null}
        <BotaoIcone rotulo="Fechar" onClick={aoFechar} className="size-6">
          <X size={14} />
        </BotaoIcone>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {caminho ? (
          <textarea
            ref={area}
            defaultValue=""
            onChange={(evento) => definirConteudo(evento.target.value)}
            placeholder="Escreva em markdown. # título, - lista, - [ ] tarefa, **negrito**."
            spellCheck
            className="editor-texto min-h-full w-full resize-none bg-transparent px-3.5 py-3 text-tinta placeholder:text-tinta-3 focus:outline-none"
          />
        ) : erro ? (
          <p className="p-3.5 text-[12.5px] text-perigo">{erro}</p>
        ) : (
          <div className="flex h-full items-center justify-center text-tinta-3">
            <Loader2 size={18} className="animate-spin" />
          </div>
        )}
      </div>

      <div
        onMouseDown={iniciarRedimensionamento}
        title="Redimensionar"
        aria-hidden
        className="absolute right-0 bottom-0 flex size-4 cursor-nwse-resize items-end justify-end p-0.5 text-tinta-3"
      >
        <svg viewBox="0 0 10 10" className="size-2.5" fill="none" stroke="currentColor" strokeWidth="1.2">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" />
        </svg>
      </div>
    </div>
  );
}
