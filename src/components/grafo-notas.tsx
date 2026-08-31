"use client";

import { GitBranch, Link2Off } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { calcularLayout } from "@/lib/grafo-layout";
import { urlDaNota } from "@/lib/rotas";
import type { NoGrafo } from "@/lib/tipos";

import { Vazio } from "./ui";

const LARGURA = 900;
const ALTURA = 560;

/**
 * Um ponto por página, do tamanho do vault; conectados pelos `[[links]]`
 * entre elas. A cor de cada ponto é herdada do caderno — a mesma "lombada"
 * que já viaja pela barra lateral e pela margem de leitura chega até aqui.
 */
export function GrafoDeNotas({
  nos,
  arestas,
  orfas,
}: {
  nos: NoGrafo[];
  arestas: { de: string; para: string }[];
  orfas: { caminho: string; titulo: string }[];
}) {
  const roteador = useRouter();
  const [emFoco, definirEmFoco] = useState<string | null>(null);

  const posicoes = useMemo(
    () => calcularLayout(nos.map((no) => no.caminho), arestas, LARGURA, ALTURA),
    // Recalcula só quando o conjunto de páginas ou de links muda de verdade,
    // não a cada render — o layout é caro e não precisa ser perfeitamente
    // determinístico a cada vez.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [nos.map((no) => no.caminho).join("|"), arestas.map((a) => `${a.de}>${a.para}`).join("|")],
  );

  const conectados = useMemo(() => {
    if (!emFoco) return null;
    const vizinhos = new Set<string>([emFoco]);
    for (const aresta of arestas) {
      if (aresta.de === emFoco) vizinhos.add(aresta.para);
      if (aresta.para === emFoco) vizinhos.add(aresta.de);
    }
    return vizinhos;
  }, [emFoco, arestas]);

  if (nos.length === 0) {
    return (
      <Vazio
        icone={<GitBranch size={20} />}
        titulo="Nenhuma nota ainda"
        descricao="O grafo aparece assim que houver páginas — e ganha linhas conforme elas se citam com [[assim]]."
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Grafo</h1>
      <p className="mt-1 text-[13px] text-tinta-2">
        Cada ponto é uma página; as linhas são os <code className="font-mono">[[links]]</code> entre
        elas. Passe o mouse pra destacar as conexões de uma nota, clique pra abrir.
      </p>

      <div className="mt-5 overflow-hidden rounded-xl border border-linha bg-superficie">
        <svg viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="w-full" role="img" aria-label="Grafo de notas">
          <g>
            {arestas.map((aresta) => {
              const de = posicoes.get(aresta.de);
              const para = posicoes.get(aresta.para);
              if (!de || !para) return null;
              const destacada = emFoco && (aresta.de === emFoco || aresta.para === emFoco);
              return (
                <line
                  key={`${aresta.de}>${aresta.para}`}
                  x1={de.x}
                  y1={de.y}
                  x2={para.x}
                  y2={para.y}
                  stroke={destacada ? "var(--realce)" : "var(--linha-forte)"}
                  strokeWidth={destacada ? 1.6 : 1}
                  opacity={emFoco && !destacada ? 0.15 : destacada ? 0.9 : 0.5}
                />
              );
            })}
          </g>
          <g>
            {nos.map((no) => {
              const posicao = posicoes.get(no.caminho);
              if (!posicao) return null;
              const apagada = conectados ? !conectados.has(no.caminho) : false;
              return (
                <g
                  key={no.caminho}
                  transform={`translate(${posicao.x}, ${posicao.y})`}
                  onMouseEnter={() => definirEmFoco(no.caminho)}
                  onMouseLeave={() => definirEmFoco(null)}
                  onClick={() => roteador.push(urlDaNota(no.caminho))}
                  className="cursor-pointer"
                  opacity={apagada ? 0.25 : 1}
                >
                  <circle r={emFoco === no.caminho ? 8 : 6} fill={no.cor} stroke="var(--superficie)" strokeWidth={1.5} />
                  <text
                    y={-11}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    style={{ fontSize: 10.5, fill: "var(--tinta-2)", fontFamily: "var(--pilha-ui)" }}
                  >
                    {no.titulo.length > 22 ? `${no.titulo.slice(0, 21)}…` : no.titulo}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      {orfas.length > 0 ? (
        <div className="mt-6">
          <h2 className="flex items-center gap-1.5 text-[13px] font-bold tracking-[-0.02em]">
            <Link2Off size={14} className="text-tinta-3" />
            Notas órfãs
            <span className="font-normal text-tinta-3">— nenhuma outra nota aponta pra elas</span>
          </h2>
          <ul className="mt-2.5 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {orfas.map((orfa) => (
              <li key={orfa.caminho}>
                <a
                  href={urlDaNota(orfa.caminho)}
                  title={orfa.caminho}
                  className="block truncate rounded-lg border border-linha bg-superficie px-3 py-2 text-[12.5px] hover:border-linha-forte hover:bg-realce-fraco"
                >
                  {orfa.titulo}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
