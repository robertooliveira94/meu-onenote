"use client";

import { usePathname } from "next/navigation";

import { ColunasProvedor } from "@/lib/colunas";
import { cadernoDaUrl, quadroDaUrl } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo, ResumoQuadro } from "@/lib/tipos";

import { BarraAplicacoes } from "./barra-aplicacoes";
import { ColunaSecoes } from "./coluna-secoes";

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
  children: React.ReactNode;
}) {
  return (
    <ColunasProvedor>
      <CascaInterna {...props} />
    </ColunasProvedor>
  );
}

function CascaInterna({
  cadernos,
  quadros,
  etiquetas,
  modelos,
  children,
}: {
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  children: React.ReactNode;
}) {
  const caminhoAtual = usePathname();

  // As três aplicações são independentes: fora de /kanban/... e /senhas,
  // é sempre Anotações — mesmo nas telas globais (início, etiquetas,
  // grafo...) que não têm um caderno "aberto".
  const appAtual: "notas" | "kanban" | "senhas" = caminhoAtual.startsWith("/kanban")
    ? "kanban"
    : caminhoAtual.startsWith("/senhas")
      ? "senhas"
      : "notas";

  const cadernoAtivo = cadernos.find((item) => item.nome === cadernoDaUrl(caminhoAtual)) ?? null;
  const quadroAtivo = quadros.find((item) => item.nome === quadroDaUrl(caminhoAtual)) ?? null;
  const corAtiva = (appAtual === "kanban" ? quadroAtivo?.cor : cadernoAtivo?.cor) ?? null;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={corAtiva ? ({ "--realce": corAtiva } as React.CSSProperties) : undefined}
    >
      {/* Faixa fina na cor do caderno/quadro aberto, atravessando o app
          inteiro — é o jeito mais direto de a cor estar sempre à vista, sem
          precisar caçar o detalhezinho colorido de cada tela. */}
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
