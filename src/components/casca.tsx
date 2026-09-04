"use client";

import { usePathname } from "next/navigation";

import { ColunasProvedor } from "@/lib/colunas";
import { cadernoDaUrl } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo } from "@/lib/tipos";

import { ColunaSecoes } from "./coluna-secoes";
import { SeletorAplicativo } from "./seletor-aplicativo";
import { SeletorDeCadernos } from "./seletor-cadernos";
import { BotaoTema } from "./ui";

/**
 * Moldura fixa do aplicativo: a tira de cadernos no topo, a coluna de
 * navegação (seções do caderno aberto + os atalhos fixos, sempre visíveis
 * no rodapé) e o conteúdo.
 *
 * É aqui que a cor do caderno aberto entra em cena — a variável --realce é
 * redefinida neste nível, então tudo abaixo (botões, marcações, a margem da
 * página) passa a usar a cor daquele caderno.
 */
export function Casca(props: {
  cadernos: Caderno[];
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
  etiquetas,
  modelos,
  children,
}: {
  cadernos: Caderno[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
  children: React.ReactNode;
}) {
  const caminhoAtual = usePathname();

  // O caderno "aberto" (implícito no endereço atual) decide a cor de
  // destaque de tudo abaixo, e é quem passa suas seções para a coluna de
  // navegação — fora de /secao/..., /nota/... e /kanban/..., é null (a
  // tela de início, etiquetas, grafo etc. não têm caderno "aberto", e a
  // coluna mostra só os atalhos fixos, sem lista de seções).
  const nomeCadernoAtivo = cadernoDaUrl(caminhoAtual);
  const cadernoAtivo = cadernos.find((item) => item.nome === nomeCadernoAtivo) ?? null;
  const corAtiva = cadernoAtivo?.cor ?? null;
  // As duas aplicações são independentes: fora de /kanban/..., é sempre
  // Anotações — mesmo nas telas globais (início, etiquetas, grafo...) que
  // não têm um caderno "aberto".
  const appAtual: "notas" | "kanban" = caminhoAtual.startsWith("/kanban/") ? "kanban" : "notas";

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={corAtiva ? ({ "--realce": corAtiva } as React.CSSProperties) : undefined}
    >
      <div className="flex shrink-0 items-center gap-2.5 border-b border-linha bg-superficie px-3 py-2">
        <SeletorAplicativo appAtual={appAtual} cadernoAtivo={cadernoAtivo} cadernos={cadernos} />
        <div className="h-5 w-px shrink-0 bg-linha" aria-hidden />
        <SeletorDeCadernos cadernos={cadernos} appAtual={appAtual} />
        <BotaoTema />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {appAtual === "notas" ? (
          <ColunaSecoes caderno={cadernoAtivo} cadernos={cadernos} etiquetas={etiquetas} modelos={modelos} />
        ) : null}
        <main className="flex min-w-0 flex-1 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
