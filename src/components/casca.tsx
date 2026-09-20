"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { AbasProvedor } from "@/lib/abas";
import { AtalhosProvedor, useAtalho } from "@/lib/atalhos";
import { useAvisosDePrazo } from "@/lib/avisos-prazo";
import { ColunasProvedor, useColunas } from "@/lib/colunas";
import { PaletaProvedor, usePaleta } from "@/lib/paleta";
import { cadernoDaUrl, pastaLinkDaUrl, quadroDaUrl, urlDaSecao, urlDoQuadro } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo, PastaLink, ResumoQuadro } from "@/lib/tipos";

import { AbasNotas } from "./abas-notas";
import { BarraAplicacoes, type App } from "./barra-aplicacoes";
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
    // `useSearchParams` (usado só para saber qual pasta de links está aberta)
    // exige um limite de Suspense — sem isso o Next tenta pré-renderizar a
    // página inteira como estática e falha no build. Na prática o valor já
    // está disponível de cara em toda navegação no cliente, então este
    // fallback nunca chega a aparecer de verdade.
    //
    // Os provedores ficam DENTRO do limite de propósito. Eles restauram
    // estado do localStorage num efeito (coluna recolhida, abas abertas);
    // fora do limite, hidratavam antes dele, o efeito rodava, e quando o
    // conteúdo de dentro hidratava já via o estado restaurado — diferente do
    // HTML do servidor, que o React acusava como erro de hidratação. Dentro,
    // tudo hidrata junto e o efeito só roda depois.
    <Suspense fallback={null}>
      <ColunasProvedor>
        <AtalhosProvedor>
          <PaletaProvedor>
            <AbasProvedor>
              <CascaInterna {...props} />
            </AbasProvedor>
          </PaletaProvedor>
        </AtalhosProvedor>
      </ColunasProvedor>
    </Suspense>
  );
}

/** Os atalhos que valem no hub inteiro — trocar de aplicação, recolher colunas, a folha. */
function AtalhosDoHub({
  appAtual,
  cadernos,
  quadros,
  aoAbrirFolha,
}: {
  appAtual: App;
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
  useAtalho("alt+5", { grupo, descricao: "Ir para Compras", acao: () => roteador.push("/compras") });
  useAtalho("alt+6", { grupo, descricao: "Ir para Saúde", acao: () => roteador.push("/saude") });

  const colunaDaApp = appAtual === "notas" ? "secoes" : appAtual === "kanban" ? "quadros" : null;
  useAtalho("[", {
    grupo,
    descricao: appAtual === "kanban" ? "Recolher/mostrar os quadros" : "Recolher/mostrar a árvore",
    ativo: colunaDaApp !== null,
    acao: () => colunaDaApp && colunas.alternar(colunaDaApp),
  });
  useAtalho("?", { grupo, descricao: "Esta folha de atalhos", acao: aoAbrirFolha });

  return null;
}

/**
 * Busca sempre à vista, no topo de qualquer aplicação — em vez de cada
 * uma escondendo o próprio jeito de buscar (`Ctrl K` só documentado na
 * folha de atalhos, ou um botão perdido na coluna). Abre a mesma paleta de
 * sempre; não é uma busca nova. Ao lado, o caderno/quadro/pasta aberto no
 * momento — útil quando se navegou fundo o bastante pra esquecer onde se
 * está.
 */
function BarraSuperior({ contexto }: { contexto?: string | null }) {
  const paleta = usePaleta();
  return (
    // Grade de 3 colunas iguais nas pontas: a busca fica centralizada de
    // verdade (não só "colada à esquerda com espaço sobrando"), e o
    // contexto na direita tem uma coluna espelhada vazia à esquerda pra
    // não puxar o centro pro lado.
    <div className="esconde-no-foco grid h-10 shrink-0 grid-cols-[1fr_minmax(0,28rem)_1fr] items-center gap-3 border-b border-linha bg-superficie px-3">
      <span aria-hidden />
      <button
        type="button"
        onClick={() => paleta.abrir()}
        className="flex h-7 w-full items-center gap-2 rounded-lg border border-linha bg-superficie-alta px-2.5 text-left text-[12px] text-tinta-3 transition-colors hover:border-linha-forte hover:text-tinta-2"
      >
        <Search size={13} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Buscar ou fazer qualquer coisa…</span>
        <span className="shrink-0 text-[10.5px]">Ctrl K</span>
      </button>
      {contexto ? (
        <span className="flex min-w-0 items-center justify-end gap-1.5 text-[12px] text-tinta-2">
          <span aria-hidden className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--realce)" }} />
          <span className="truncate">{contexto}</span>
        </span>
      ) : null}
    </div>
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
  const [folhaAberta, definirFolhaAberta] = useState(false);
  const avisosDePrazo = useAvisosDePrazo();

  // As aplicações são independentes: fora de /kanban/..., /senhas, /links,
  // /compras e /saude, é sempre Anotações — mesmo nas telas globais (início,
  // etiquetas, grafo...) que não têm um caderno "aberto".
  const appAtual: App = caminhoAtual.startsWith("/kanban")
    ? "kanban"
    : caminhoAtual.startsWith("/senhas")
      ? "senhas"
      : caminhoAtual.startsWith("/links")
        ? "links"
        : caminhoAtual.startsWith("/compras")
          ? "compras"
          : caminhoAtual.startsWith("/saude")
            ? "saude"
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
  // Onde a pessoa está, pra mostrar ao lado da busca — Senhas fica de fora
  // porque o grupo ativo é estado só do cliente, sem refletir na URL, então
  // este nível (casca, guiado pela URL) não tem como saber qual é.
  const contextoAtivo =
    appAtual === "kanban" ? quadroAtivo?.nome : appAtual === "links" ? pastaLinkAtiva?.nome : cadernoAtivo?.nome;

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
      <BarraSuperior contexto={contextoAtivo} />
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
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {appAtual === "notas" ? <AbasNotas /> : null}
          <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
        </div>
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
