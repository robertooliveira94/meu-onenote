"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AtalhosProvedor, useAtalho } from "@/lib/atalhos";
import { useAvisosDePrazo } from "@/lib/avisos-prazo";
import { ColunasProvedor, useColunas } from "@/lib/colunas";
import { PaletaProvedor, usePaleta } from "@/lib/paleta";
import { cadernoDaUrl, pastaLinkDaUrl, quadroDaUrl, urlDaSecao, urlDoQuadro } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo, PastaLink, ResumoQuadro } from "@/lib/tipos";

import { BarraAplicacoes } from "./barra-aplicacoes";
import { ColunaQuadros } from "./coluna-quadros";
import { ColunaSecoes } from "./coluna-secoes";
import { FolhaAtalhos } from "./folha-atalhos";
import { PaletaComandos } from "./paleta-comandos";

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
      <AtalhosProvedor>
        <PaletaProvedor>
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
        </PaletaProvedor>
      </AtalhosProvedor>
    </ColunasProvedor>
  );
}

/** Os atalhos que valem no hub inteiro — trocar de aplicação, recolher colunas, a folha. */
function AtalhosDoHub({
  appAtual,
  cadernos,
  quadros,
  aoAbrirFolha,
}: {
  appAtual: "notas" | "kanban" | "senhas" | "links";
  cadernos: Caderno[];
  quadros: ResumoQuadro[];
  aoAbrirFolha: () => void;
}) {
  const roteador = useRouter();
  const colunas = useColunas();
  const paleta = usePaleta();
  const grupo = "Hub";

  useAtalho("ctrl+k", { grupo, descricao: "Paleta de comandos", mesmoEmCampo: true, acao: () => paleta.abrir() });
  useAtalho("/", { grupo, descricao: "Buscar (paleta)", acao: () => paleta.abrir() });

  // Alt+dígito, não Ctrl+dígito: o navegador reserva Ctrl+1..8 pra trocar
  // de aba e nem deixa a página interceptar.
  useAtalho("alt+1", {
    grupo,
    descricao: "Ir para Anotações",
    acao: () => {
      const primeiro = cadernos[0];
      roteador.push(primeiro ? urlDaSecao(primeiro.secoes[0]?.caminho ?? primeiro.caminho) : "/");
    },
  });
  useAtalho("alt+2", {
    grupo,
    descricao: "Ir para o Kanban",
    acao: () => roteador.push(quadros[0] ? urlDoQuadro(quadros[0].nome) : "/kanban"),
  });
  useAtalho("alt+3", { grupo, descricao: "Ir para Senhas", acao: () => roteador.push("/senhas") });
  useAtalho("alt+4", { grupo, descricao: "Ir para Links", acao: () => roteador.push("/links") });

  const colunaDaApp = appAtual === "notas" ? "secoes" : appAtual === "kanban" ? "quadros" : null;
  useAtalho("[", {
    grupo,
    descricao: appAtual === "kanban" ? "Recolher/mostrar os quadros" : "Recolher/mostrar cadernos e seções",
    ativo: colunaDaApp !== null,
    acao: () => colunaDaApp && colunas.alternar(colunaDaApp),
  });
  useAtalho("]", {
    grupo,
    descricao: "Recolher/mostrar a lista de páginas",
    ativo: appAtual === "notas",
    acao: () => colunas.alternar("paginas"),
  });
  useAtalho("?", { grupo, descricao: "Esta folha de atalhos", acao: aoAbrirFolha });

  return null;
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
  const [folhaAberta, definirFolhaAberta] = useState(false);
  const avisosDePrazo = useAvisosDePrazo();

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
        <BarraAplicacoes
          appAtual={appAtual}
          cadernos={cadernos}
          quadros={quadros}
          atrasadas={avisosDePrazo.atrasadas.length}
          aoAbrirAtalhos={() => definirFolhaAberta(true)}
        />
        {appAtual === "notas" ? (
          <ColunaSecoes caderno={cadernoAtivo} cadernos={cadernos} modelos={modelos} />
        ) : appAtual === "kanban" ? (
          <ColunaQuadros quadros={quadros} />
        ) : null}
        <main className="flex min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
      <AtalhosDoHub
        appAtual={appAtual}
        cadernos={cadernos}
        quadros={quadros}
        aoAbrirFolha={() => definirFolhaAberta(true)}
      />
      <FolhaAtalhos aberta={folhaAberta} aoFechar={() => definirFolhaAberta(false)} />
      <PaletaComandos cadernos={cadernos} quadros={quadros} etiquetas={etiquetas} linksRaiz={linksRaiz} />
    </div>
  );
}
