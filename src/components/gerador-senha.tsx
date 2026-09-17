"use client";

import clsx from "clsx";
import { Check, Copy, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  OPCOES_PADRAO,
  ROTULO_FORCA,
  gerarFrase,
  gerarSenha,
  medirForca,
  type NivelForca,
  type OpcoesGerador,
} from "@/lib/forca-senha";

import { Botao, BotaoIcone } from "./ui";

const COR_FORCA: Record<NivelForca, string> = {
  0: "var(--perigo)",
  1: "#F5822C",
  2: "#F5B921",
  3: "var(--realce)",
};

/** Quatro segmentos que acendem conforme a força — embaixo do campo de senha. */
export function BarraForca({ senha, className }: { senha: string; className?: string }) {
  const forca = useMemo(() => medirForca(senha), [senha]);
  if (!senha) return null;
  return (
    <div className={clsx("flex items-center gap-2", className)} aria-label={`Força da senha: ${ROTULO_FORCA[forca.nivel]}`}>
      <div className="flex flex-1 gap-1" aria-hidden>
        {[0, 1, 2, 3].map((segmento) => (
          <span
            key={segmento}
            className="h-1 flex-1 rounded-full bg-linha transition-colors"
            style={segmento <= forca.nivel ? { background: COR_FORCA[forca.nivel] } : undefined}
          />
        ))}
      </div>
      <span className="w-16 text-right text-[11px] tabular-nums" style={{ color: COR_FORCA[forca.nivel] }}>
        {ROTULO_FORCA[forca.nivel]}
      </span>
    </div>
  );
}

/** Pastilha pequena com a força — para o painel de leitura. */
export function SeloForca({ senha }: { senha: string }) {
  const forca = useMemo(() => medirForca(senha), [senha]);
  if (!senha) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
      style={{
        color: `color-mix(in srgb, ${COR_FORCA[forca.nivel]} 85%, var(--tinta))`,
        background: `color-mix(in srgb, ${COR_FORCA[forca.nivel]} 14%, transparent)`,
      }}
      title={`~${forca.bits} bits de entropia`}
    >
      {ROTULO_FORCA[forca.nivel]}
    </span>
  );
}

type Modo = "aleatoria" | "frase";

/**
 * O gerador: painel embutido no formulário (não flutua — assim nunca é
 * recortado pela rolagem do painel nem briga com o diálogo de nova senha).
 * Gera uma na abertura e a cada mudança de opção; "Usar" manda para o campo.
 */
export function GeradorSenha({ aoUsar, aoFechar }: { aoUsar: (senha: string) => void; aoFechar: () => void }) {
  const [modo, definirModo] = useState<Modo>("aleatoria");
  const [opcoes, definirOpcoes] = useState<OpcoesGerador>(OPCOES_PADRAO);
  const [palavras, definirPalavras] = useState(5);
  const [separador, definirSeparador] = useState("-");
  const [senha, definirSenha] = useState("");
  const [copiado, definirCopiado] = useState(false);

  function gerar() {
    definirSenha(modo === "aleatoria" ? gerarSenha(opcoes) : gerarFrase(palavras, separador));
  }
  // Regenera sempre que uma opção muda — a prévia acompanha o que está marcado.
  useEffect(gerar, [modo, opcoes, palavras, separador]);

  async function copiar() {
    await navigator.clipboard.writeText(senha).catch(() => {});
    definirCopiado(true);
    setTimeout(() => definirCopiado(false), 1500);
  }

  const alternar = (chave: keyof OpcoesGerador) => () =>
    definirOpcoes((atual) => ({ ...atual, [chave]: !atual[chave] }));

  return (
    <div className="painel mt-2 p-3" role="group" aria-label="Gerador de senha">
      <div className="flex items-center gap-1">
        <div className="flex rounded-lg border border-linha p-0.5 text-[11.5px] font-medium">
          {(["aleatoria", "frase"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => definirModo(item)}
              aria-pressed={modo === item}
              className={clsx(
                "rounded-md px-2.5 py-1 transition-colors",
                modo === item ? "bg-realce-medio text-tinta" : "text-tinta-2 hover:text-tinta",
              )}
            >
              {item === "aleatoria" ? "Aleatória" : "Frase-senha"}
            </button>
          ))}
        </div>
        <span className="ml-auto text-[11px] text-tinta-3">Esc fecha</span>
      </div>

      <div className="mt-2.5 flex items-center gap-1.5 rounded-lg border border-linha bg-superficie-alta px-3 py-2">
        <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-tinta">{senha}</code>
        <BotaoIcone rotulo="Gerar outra" onClick={gerar} className="size-7">
          <RefreshCw size={13} />
        </BotaoIcone>
        <BotaoIcone rotulo={copiado ? "Copiada!" : "Copiar"} onClick={copiar} className={clsx("size-7", copiado && "text-[var(--realce)]")}>
          {copiado ? <Check size={13} /> : <Copy size={13} />}
        </BotaoIcone>
      </div>
      <BarraForca senha={senha} className="mt-2" />

      {modo === "aleatoria" ? (
        <div className="mt-3 space-y-2.5">
          <label className="flex items-center gap-3 text-[12px] text-tinta-2">
            <span className="w-20 shrink-0">Tamanho</span>
            <input
              type="range"
              min={8}
              max={64}
              value={opcoes.tamanho}
              onChange={(evento) => definirOpcoes({ ...opcoes, tamanho: Number(evento.target.value) })}
              className="flex-1 accent-[var(--realce)]"
            />
            <span className="w-6 text-right text-tinta tabular-nums">{opcoes.tamanho}</span>
          </label>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-tinta-2">
            <Marcacao marcado={opcoes.minusculas} onChange={alternar("minusculas")}>
              a–z
            </Marcacao>
            <Marcacao marcado={opcoes.maiusculas} onChange={alternar("maiusculas")}>
              A–Z
            </Marcacao>
            <Marcacao marcado={opcoes.numeros} onChange={alternar("numeros")}>
              0–9
            </Marcacao>
            <Marcacao marcado={opcoes.simbolos} onChange={alternar("simbolos")}>
              !@#…
            </Marcacao>
            <Marcacao marcado={opcoes.evitarAmbiguos} onChange={alternar("evitarAmbiguos")}>
              Evitar l, 1, O, 0
            </Marcacao>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5">
          <label className="flex items-center gap-3 text-[12px] text-tinta-2">
            <span className="w-20 shrink-0">Palavras</span>
            <input
              type="range"
              min={3}
              max={8}
              value={palavras}
              onChange={(evento) => definirPalavras(Number(evento.target.value))}
              className="flex-1 accent-[var(--realce)]"
            />
            <span className="w-6 text-right text-tinta tabular-nums">{palavras}</span>
          </label>
          <div className="flex items-center gap-3 text-[12px] text-tinta-2">
            <span className="w-20 shrink-0">Separador</span>
            <div className="flex gap-1">
              {["-", " ", ".", "_"].map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => definirSeparador(item)}
                  aria-pressed={separador === item}
                  className={clsx(
                    "size-7 rounded-md border font-mono text-[12px]",
                    separador === item ? "border-[var(--realce)] bg-realce-medio text-tinta" : "border-linha text-tinta-2",
                  )}
                >
                  {item === " " ? "␣" : item}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-tinta-3">Fácil de lembrar, longa de chutar.</span>
          </div>
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Botao type="button" onClick={aoFechar}>
          Fechar
        </Botao>
        <Botao type="button" variante="primario" onClick={() => aoUsar(senha)}>
          Usar esta senha
        </Botao>
      </div>
    </div>
  );
}

function Marcacao({ marcado, onChange, children }: { marcado: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-1.5">
      <input type="checkbox" checked={marcado} onChange={onChange} className="accent-[var(--realce)]" />
      {children}
    </label>
  );
}
