"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { ROTULO_STATUS, ROTULO_TIPO, formatarDataSaude } from "@/lib/saude-comum";
import type { EspecialidadeSaude, EventoSaude } from "@/lib/tipos";

const ALTURA_FAIXA = 26;
const ALTURA_EIXO = 22;
const LARGURA_ROTULO = 132;
const MARGEM_X = 10;
const DIA = 86_400_000;
const PASSOS_MESES = [1, 2, 3, 6, 12, 24, 60, 120];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function emMs(iso: string): number {
  const [ano, mes, dia] = iso.split("-").map(Number);
  return Date.UTC(ano, mes - 1, dia);
}

/** Marcas do eixo no primeiro dia de mês, com passo que caiba na largura. */
function marcasDoEixo(inicio: number, fim: number, largura: number): { ms: number; rotulo: string }[] {
  const meses = (fim - inicio) / (30.44 * DIA);
  const maximo = Math.max(2, Math.floor(largura / 64));
  const passo = PASSOS_MESES.find((candidato) => meses / candidato <= maximo) ?? PASSOS_MESES.at(-1)!;
  const data = new Date(inicio);
  // Primeiro dia de mês depois do início, alinhado ao passo: anual cai em janeiro, semestral em jan/jul…
  const alinhar = Math.min(passo, 12);
  let indice = data.getUTCFullYear() * 12 + Math.ceil((data.getUTCMonth() + 1) / alinhar) * alinhar;
  if (passo > 12) indice = Math.ceil(indice / passo) * passo;
  const marcas: { ms: number; rotulo: string }[] = [];
  for (let guarda = 0; guarda < 200; guarda++, indice += passo) {
    const ano = Math.floor(indice / 12);
    const mes = indice % 12;
    const ms = Date.UTC(ano, mes, 1);
    if (ms > fim) break;
    if (ms >= inicio) marcas.push({ ms, rotulo: passo >= 12 || mes === 0 ? String(ano) : MESES_CURTOS[mes] });
  }
  return marcas;
}

type Ponto = { evento: EventoSaude; x: number; y: number; cor: string };

/**
 * O gráfico da linha do tempo: uma faixa por especialidade, cada registro um
 * ponto na data dele. Cheio = realizado; vazado = previsto (solicitado,
 * agendado, aguardando resultado); cinza = cancelado. A linha tracejada é hoje.
 * Clicar num ponto abre o registro, como na lista abaixo.
 */
export function GraficoLinhaDoTempo({
  eventos,
  especialidades,
  pessoas,
  hoje,
  eventoAtivoId,
  onSelecionar,
}: {
  eventos: EventoSaude[];
  especialidades: EspecialidadeSaude[];
  /** Nome da pessoa por id — só quando a linha precisa dizer de quem é. */
  pessoas: Map<string, string> | null;
  hoje: string;
  eventoAtivoId: string | null;
  onSelecionar: (id: string) => void;
}) {
  const caixa = useRef<HTMLDivElement>(null);
  const [largura, definirLargura] = useState(0);
  const [focado, definirFocado] = useState<Ponto | null>(null);

  const comData = useMemo(() => eventos.filter((evento) => evento.data !== null), [eventos]);
  const semData = eventos.length - comData.length;
  const temPontos = comData.length > 0;

  useEffect(() => {
    const elemento = caixa.current;
    if (!elemento) return;
    const observador = new ResizeObserver(([entrada]) => definirLargura(entrada.contentRect.width));
    observador.observe(elemento);
    return () => observador.disconnect();
    // A caixa só existe quando há registro com data — sem ela, nada a observar.
  }, [temPontos]);

  const faixas = useMemo(() => {
    const usadas = new Set(comData.map((evento) => evento.especialidadeId));
    return especialidades.filter((especialidade) => usadas.has(especialidade.id));
  }, [comData, especialidades]);

  const escala = useMemo(() => {
    if (comData.length === 0) return null;
    const hojeMs = emMs(hoje);
    let inicio = Math.min(...comData.map((evento) => emMs(evento.data!)), hojeMs);
    let fim = Math.max(...comData.map((evento) => emMs(evento.data!)), hojeMs);
    // Um intervalo curto demais espreme tudo num ponto; garante ao menos uns dois meses.
    const minimo = 60 * DIA;
    if (fim - inicio < minimo) {
      const meio = (inicio + fim) / 2;
      inicio = meio - minimo / 2;
      fim = meio + minimo / 2;
    }
    const folga = (fim - inicio) * 0.03;
    return { inicio: inicio - folga, fim: fim + folga, hojeMs };
  }, [comData, hoje]);

  const larguraPlot = Math.max(0, largura - LARGURA_ROTULO);
  const x = (ms: number) => (escala ? MARGEM_X + ((ms - escala.inicio) / (escala.fim - escala.inicio)) * (larguraPlot - 2 * MARGEM_X) : 0);

  const pontos = useMemo<Ponto[]>(() => {
    if (!escala || larguraPlot === 0) return [];
    const faixaDe = new Map(faixas.map((especialidade, indice) => [especialidade.id, { especialidade, indice }]));
    return comData
      .map((evento) => {
        const faixa = faixaDe.get(evento.especialidadeId);
        if (!faixa) return null;
        return { evento, x: x(emMs(evento.data!)), y: faixa.indice * ALTURA_FAIXA + ALTURA_FAIXA / 2, cor: faixa.especialidade.cor };
      })
      .filter((ponto): ponto is Ponto => ponto !== null)
      // Ativo por último, pra ficar por cima dos vizinhos.
      .sort((a, b) => Number(a.evento.id === eventoAtivoId) - Number(b.evento.id === eventoAtivoId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comData, faixas, escala, larguraPlot, eventoAtivoId]);

  if (comData.length === 0) return null;

  const alturaPlot = faixas.length * ALTURA_FAIXA;
  const marcas = escala && larguraPlot > 0 ? marcasDoEixo(escala.inicio, escala.fim, larguraPlot) : [];
  const xHoje = escala ? x(escala.hojeMs) : 0;

  return (
    <section className="rounded-xl border border-linha bg-superficie-alta px-3 pt-2.5 pb-2">
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-tinta-3">
        <span className="font-bold tracking-[0.08em] uppercase">No tempo</span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="4" fill="var(--tinta-3)" />
          </svg>
          Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="3.5" fill="var(--superficie-alta)" stroke="var(--tinta-3)" strokeWidth="1.75" />
          </svg>
          Previsto
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden>
            <circle cx="5" cy="5" r="3.5" fill="none" stroke="var(--linha-forte)" strokeWidth="1.75" strokeDasharray="2 1.5" />
          </svg>
          Cancelado
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="10" aria-hidden>
            <line x1="6" y1="0" x2="6" y2="10" stroke="var(--realce)" strokeWidth="1.5" strokeDasharray="2 2" />
          </svg>
          Hoje
        </span>
        {semData ? <span className="ml-auto">{semData} sem data fora do gráfico</span> : null}
      </div>

      <div ref={caixa} className="relative flex" onMouseLeave={() => definirFocado(null)}>
        <div className="shrink-0" style={{ width: LARGURA_ROTULO }}>
          {faixas.map((especialidade) => (
            <div key={especialidade.id} className="flex items-center gap-1.5 pr-2 text-[12px] text-tinta-2" style={{ height: ALTURA_FAIXA }}>
              <span aria-hidden className="text-[13px]">
                {especialidade.icone}
              </span>
              <span className="truncate">{especialidade.nome}</span>
            </div>
          ))}
        </div>

        {larguraPlot > 0 ? (
          <svg width={larguraPlot} height={alturaPlot + ALTURA_EIXO} className="block overflow-visible" role="img" aria-label="Registros de saúde ao longo do tempo, por especialidade">
            {faixas.map((especialidade, indice) =>
              indice % 2 === 1 ? (
                <rect key={especialidade.id} x={0} y={indice * ALTURA_FAIXA} width={larguraPlot} height={ALTURA_FAIXA} fill="var(--tinta)" opacity={0.025} />
              ) : null,
            )}
            {marcas.map((marca) => (
              <g key={marca.ms}>
                <line x1={x(marca.ms)} x2={x(marca.ms)} y1={0} y2={alturaPlot} stroke="var(--linha)" strokeWidth={1} />
                <text x={x(marca.ms)} y={alturaPlot + 14} textAnchor="middle" fontSize={10.5} fill="var(--tinta-3)" className="tabular-nums">
                  {marca.rotulo}
                </text>
              </g>
            ))}
            <line x1={0} x2={larguraPlot} y1={alturaPlot} y2={alturaPlot} stroke="var(--linha-forte)" strokeWidth={1} />
            <line x1={xHoje} x2={xHoje} y1={-2} y2={alturaPlot} stroke="var(--realce)" strokeWidth={1.5} strokeDasharray="3 3" />

            {pontos.map((ponto) => {
              const { evento } = ponto;
              const ativo = evento.id === eventoAtivoId;
              const cancelado = evento.status === "cancelado";
              const cheio = evento.status === "realizado";
              const raio = ativo ? 6.5 : 5;
              return (
                <g
                  key={evento.id}
                  className="cursor-pointer"
                  onMouseEnter={() => definirFocado(ponto)}
                  onClick={() => onSelecionar(evento.id)}
                >
                  {ativo ? <circle cx={ponto.x} cy={ponto.y} r={raio + 3.5} fill="none" stroke={ponto.cor} strokeWidth={1.5} opacity={0.45} /> : null}
                  <circle
                    cx={ponto.x}
                    cy={ponto.y}
                    r={raio}
                    fill={cheio ? ponto.cor : "var(--superficie-alta)"}
                    stroke={cancelado ? "var(--linha-forte)" : cheio ? "var(--superficie-alta)" : ponto.cor}
                    strokeWidth={2}
                    strokeDasharray={cancelado ? "2.5 2" : undefined}
                  />
                  {/* Alvo maior que a marca: um ponto de 10px é difícil de acertar. */}
                  <circle cx={ponto.x} cy={ponto.y} r={11} fill="transparent" />
                </g>
              );
            })}
          </svg>
        ) : null}

        {focado ? (
          <div
            className="pointer-events-none absolute z-10 w-max max-w-[16rem] rounded-lg border border-linha bg-superficie-alta px-2.5 py-1.5 text-[11.5px] shadow-lg"
            style={{
              left: LARGURA_ROTULO + focado.x,
              top: focado.y,
              transform: `translate(${focado.x > larguraPlot * 0.7 ? "calc(-100% - 12px)" : "12px"}, -50%)`,
            }}
          >
            <span className="block font-medium text-tinta">{focado.evento.titulo}</span>
            <span className="block text-tinta-3 tabular-nums">
              {formatarDataSaude(focado.evento.data)}
              {focado.evento.hora ? ` · ${focado.evento.hora}` : ""}
              {focado.evento.titulo !== ROTULO_TIPO[focado.evento.tipo] ? ` · ${ROTULO_TIPO[focado.evento.tipo]}` : ""}
            </span>
            <span className="block text-tinta-2">
              {ROTULO_STATUS[focado.evento.status]}
              {pessoas ? ` · ${pessoas.get(focado.evento.pessoaId) ?? ""}` : ""}
            </span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
