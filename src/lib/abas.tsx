"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { urlDaNota, urlDaSecao } from "./rotas";

/**
 * As abas de notas abertas — a faixa acima do conteúdo em Anotações, como
 * num navegador. É o que faz "ir dar uma olhada naquela outra nota e
 * voltar" custar zero: a nota de antes continua a um clique.
 *
 * Só a faixa: sem dividir a tela em painéis (isso fica para uma frente
 * futura). O estado é uma lista de `{ caminho, titulo }` em `localStorage`,
 * e a aba ativa é a nota da URL — a URL continua mandando, as abas só
 * lembram por onde se passou.
 *
 * Regra de abrir, igual à de um navegador de código: clicar numa página
 * substitui a aba atual; Ctrl+clique (ou o botão do meio) abre numa aba
 * nova sem sair da atual.
 */
export type Aba = { caminho: string; titulo: string };

const CHAVE = "abas-abertas";
const LIMITE = 12;

/** "Caderno/Seção/Título.md" → "Título" — o nome do arquivo sem a extensão. */
function tituloDoCaminho(caminho: string): string {
  const nome = caminho.split("/").pop() ?? caminho;
  const ponto = nome.lastIndexOf(".");
  return ponto > 0 ? nome.slice(0, ponto) : nome;
}

/** O caminho da nota aberta, ou null fora de /nota/... */
function notaDaUrl(caminhoAtual: string): string | null {
  const cru = decodeURIComponent(caminhoAtual);
  return cru.startsWith("/nota/") ? cru.slice(6) : null;
}

const AbasContexto = createContext<{
  abas: Aba[];
  ativa: string | null;
  /** Abre numa aba nova sem navegar (Ctrl+clique, botão do meio). */
  abrirAoLado: (caminho: string, titulo?: string) => void;
  fechar: (caminho: string) => void;
  /** Tira a aba sem navegar — para quando a nota foi excluída e quem excluiu já decide para onde ir. */
  remover: (caminho: string) => void;
  fecharOutras: (caminho: string) => void;
  fecharTodas: () => void;
  reordenar: (origem: string, destino: string, antes: boolean) => void;
  /** Uma nota renomeada ou movida: a aba dela acompanha. */
  renomear: (antigo: string, novo: string) => void;
  atualizarTitulo: (caminho: string, titulo: string) => void;
} | null>(null);

export function AbasProvedor({ children }: { children: React.ReactNode }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [abas, definirAbas] = useState<Aba[]>([]);
  const carregadas = useRef(false);
  // O estado de partida, antes de restaurar: o efeito de gravar não pode
  // escrevê-lo por cima do que está guardado — os dois efeitos rodam no
  // mesmo ciclo da montagem, e gravar `[]` ali apagaria as abas de antes.
  const estadoInicial = useRef(abas);
  // A aba que estava ativa antes da navegação atual — é ela que um clique
  // simples substitui.
  const anterior = useRef<string | null>(null);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE);
      if (bruto) {
        const lidas = JSON.parse(bruto) as unknown;
        if (Array.isArray(lidas)) {
          definirAbas(
            lidas
              .filter((item): item is Aba => Boolean(item) && typeof item.caminho === "string")
              .map((item) => ({ caminho: item.caminho, titulo: item.titulo || tituloDoCaminho(item.caminho) })),
          );
        }
      }
    } catch {
      // Sem armazenamento: as abas duram só esta sessão.
    }
    carregadas.current = true;
  }, []);

  useEffect(() => {
    if (!carregadas.current || abas === estadoInicial.current) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(abas));
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }, [abas]);

  const ativa = notaDaUrl(caminhoAtual);

  // A URL mudou para uma nota: se ela já tem aba, vira a ativa; se não,
  // entra no lugar da aba de onde se veio (ou no fim, se não havia aba).
  useEffect(() => {
    if (!carregadas.current || !ativa) return;
    definirAbas((atual) => {
      if (atual.some((aba) => aba.caminho === ativa)) return atual;
      const nova: Aba = { caminho: ativa, titulo: tituloDoCaminho(ativa) };
      const indiceAnterior = atual.findIndex((aba) => aba.caminho === anterior.current);
      const proximo = [...atual];
      if (indiceAnterior === -1) proximo.push(nova);
      else proximo[indiceAnterior] = nova;
      // Sem limite a faixa vira uma fila infinita de abas esquecidas.
      return proximo.slice(-LIMITE);
    });
  }, [ativa]);

  useEffect(() => {
    if (ativa) anterior.current = ativa;
  }, [ativa]);

  const abrirAoLado = useCallback((caminho: string, titulo?: string) => {
    definirAbas((atual) => {
      if (atual.some((aba) => aba.caminho === caminho)) return atual;
      return [...atual, { caminho, titulo: titulo ?? tituloDoCaminho(caminho) }].slice(-LIMITE);
    });
  }, []);

  const fechar = useCallback(
    (caminho: string) => {
      const indice = abas.findIndex((aba) => aba.caminho === caminho);
      if (indice === -1) return;
      const proximo = abas.filter((aba) => aba.caminho !== caminho);
      definirAbas(proximo);
      // Fechou a aba aberta: vai para a vizinha da direita, senão da
      // esquerda; sem nenhuma, para a seção da nota. (Fora do updater de
      // propósito: navegar é efeito, e updaters podem rodar duas vezes.)
      if (caminho === ativa) {
        const vizinha = proximo[indice] ?? proximo[indice - 1];
        anterior.current = vizinha?.caminho ?? null;
        roteador.push(vizinha ? urlDaNota(vizinha.caminho) : urlDaSecao(caminho.split("/").slice(0, -1).join("/")));
      }
    },
    [abas, ativa, roteador],
  );

  const remover = useCallback((caminho: string) => {
    definirAbas((atual) => atual.filter((aba) => aba.caminho !== caminho && !aba.caminho.startsWith(`${caminho}/`)));
    if (anterior.current === caminho) anterior.current = null;
  }, []);

  const fecharOutras = useCallback((caminho: string) => {
    definirAbas((atual) => atual.filter((aba) => aba.caminho === caminho));
  }, []);

  const fecharTodas = useCallback(() => {
    definirAbas([]);
    anterior.current = null;
  }, []);

  const reordenar = useCallback((origem: string, destino: string, antes: boolean) => {
    definirAbas((atual) => {
      const de = atual.findIndex((aba) => aba.caminho === origem);
      const para = atual.findIndex((aba) => aba.caminho === destino);
      if (de === -1 || para === -1 || de === para) return atual;
      const sem = atual.filter((aba) => aba.caminho !== origem);
      const alvo = sem.findIndex((aba) => aba.caminho === destino);
      sem.splice(antes ? alvo : alvo + 1, 0, atual[de]);
      return sem;
    });
  }, []);

  const renomear = useCallback((antigo: string, novo: string) => {
    definirAbas((atual) =>
      atual.map((aba) =>
        aba.caminho === antigo || aba.caminho.startsWith(`${antigo}/`)
          ? { caminho: novo + aba.caminho.slice(antigo.length), titulo: tituloDoCaminho(novo + aba.caminho.slice(antigo.length)) }
          : aba,
      ),
    );
    if (anterior.current === antigo) anterior.current = novo;
  }, []);

  const atualizarTitulo = useCallback((caminho: string, titulo: string) => {
    definirAbas((atual) =>
      atual.some((aba) => aba.caminho === caminho && aba.titulo !== titulo)
        ? atual.map((aba) => (aba.caminho === caminho ? { ...aba, titulo } : aba))
        : atual,
    );
  }, []);

  const valor = useMemo(
    () => ({ abas, ativa, abrirAoLado, fechar, remover, fecharOutras, fecharTodas, reordenar, renomear, atualizarTitulo }),
    [abas, ativa, abrirAoLado, fechar, remover, fecharOutras, fecharTodas, reordenar, renomear, atualizarTitulo],
  );
  return <AbasContexto.Provider value={valor}>{children}</AbasContexto.Provider>;
}

/** Fora de um `AbasProvedor` (a janela flutuante), tudo é inerte — a nota continua funcionando. */
export function useAbas() {
  const contexto = useContext(AbasContexto);
  return (
    contexto ?? {
      abas: [] as Aba[],
      ativa: null,
      abrirAoLado: () => {},
      fechar: () => {},
      remover: () => {},
      fecharOutras: () => {},
      fecharTodas: () => {},
      reordenar: () => {},
      renomear: () => {},
      atualizarTitulo: () => {},
    }
  );
}
