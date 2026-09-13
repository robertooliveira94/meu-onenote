"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { ColunasProvedor } from "@/lib/colunas";
import { cadernoDaUrl, pastaLinkDaUrl, quadroDaUrl } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo, PastaLink, ResumoQuadro } from "@/lib/tipos";

import { BarraAplicacoes } from "./barra-aplicacoes";
import { ColunaSecoes } from "./coluna-secoes";

/** Acha uma pasta de links pelo id, em qualquer profundidade da árvore. */
function encontrarPastaLink(raiz: PastaLink, id: string): PastaLink | null {
  if (raiz.id === id) return raiz;
  for (const sub of raiz.pastas) {
    const achada = encontrarPastaLink(sub, id);
    if (achada) return achada;
  }
  return null;
}

/**
 * Moldura fixa do aplicativo, da esquerda para a direita: a coluna das
 * aplicações (qual está aberta + a lista dela), a coluna de navegação das
 * anotações quando é o caso, e o conteúdo.
 *
 * É aqui que a cor do item aberto entra em cena — a variável --realce é
 * redefinida neste nível, então tudo abaixo (botões, marcações, a margem da
 * página) passa a usar a cor do caderno ou do quadro aberto.
 */
export function Casca(props: {
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  linksRaiz: PastaLink;
  children: React.ReactNode;
}) {
  return (
    <ColunasProvedor>
      {/*
        `useSearchParams` (usado só para saber qual pasta de links está
        aberta) exige um limite de Suspense — sem isso o Next tenta pré-
        renderizar a página inteira como estática e falha no build. Na
        prática o valor já está disponível de cara em toda navegação no
        cliente, então este fallback nunca chega a aparecer de verdade.
      */}
      <Suspense fallback={null}>
        <CascaInterna {...props} />
      </Suspense>
    </ColunasProvedor>
  );
}

function CascaInterna({
  cadernos,
  quadros,
  etiquetas,
  modelos,
  linksRaiz,
  children,
}: {
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  linksRaiz: PastaLink;
  children: React.ReactNode;
}) {
  const caminhoAtual = usePathname();
  const parametros = useSearchParams();

  // As quatro aplicações são independentes: fora de /kanban/..., /senhas e
  // /links, é sempre Anotações — mesmo nas telas globais (início, etiquetas,
  // grafo...) que não têm um caderno "aberto".
  const appAtual: "notas" | "kanban" | "senhas" | "links" = caminhoAtual.startsWith("/kanban")
    ? "kanban"
    : caminhoAtual.startsWith("/senhas")
      ? "senhas"
      : caminhoAtual.startsWith("/links")
        ? "links"
        : "notas";

  const cadernoAtivo = cadernos.find((item) => item.nome === cadernoDaUrl(caminhoAtual)) ?? null;
  const quadroAtivo = quadros.find((item) => item.nome === quadroDaUrl(caminhoAtual)) ?? null;
  const idPastaLinkAtiva = pastaLinkDaUrl(caminhoAtual, parametros);
  const pastaLinkAtiva = idPastaLinkAtiva ? encontrarPastaLink(linksRaiz, idPastaLinkAtiva) : null;
  const corAtiva =
    (appAtual === "kanban"
      ? quadroAtivo?.cor
      : appAtual === "links"
        ? pastaLinkAtiva?.cor
        : cadernoAtivo?.cor) ?? null;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={corAtiva ? ({ "--realce": corAtiva } as React.CSSProperties) : undefined}
    >
      {/* Faixa fina na cor do caderno/quadro/pasta aberta, atravessando o
          app inteiro — é o jeito mais direto de a cor estar sempre à vista,
          sem precisar caçar o detalhezinho colorido de cada tela. */}
      {corAtiva ? (
        <div className="h-[3px] shrink-0" style={{ background: corAtiva }} aria-hidden />
      ) : null}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <BarraAplicacoes appAtual={appAtual} cadernos={cadernos} quadros={quadros} />
        {appAtual === "notas" ? (
          <ColunaSecoes caderno={cadernoAtivo} cadernos={cadernos} etiquetas={etiquetas} modelos={modelos} />
        ) : null}
        <main className="flex min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
