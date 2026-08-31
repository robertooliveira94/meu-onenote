"use client";

import clsx from "clsx";
import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { acaoBuscar } from "@/app/acoes";
import { urlDaNota } from "@/lib/rotas";
import type { Etiqueta, ResultadoBusca } from "@/lib/tipos";

/** Sem acento e sem caixa, do jeito que a pessoa digita com pressa. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Marca as ocorrências do termo no trecho, preservando o texto original. */
function destacar(texto: string, termo: string): React.ReactNode {
  const procurado = normalizar(termo.trim());
  if (procurado.length < 2) return texto;

  const base = normalizar(texto);
  const partes: React.ReactNode[] = [];
  let cursor = 0;

  for (;;) {
    const posicao = base.indexOf(procurado, cursor);
    if (posicao < 0) break;
    if (posicao > cursor) partes.push(texto.slice(cursor, posicao));
    partes.push(
      <mark key={posicao} className="marca-busca text-tinta">
        {texto.slice(posicao, posicao + procurado.length)}
      </mark>,
    );
    cursor = posicao + procurado.length;
  }
  partes.push(texto.slice(cursor));
  return partes;
}

/**
 * Busca global. Existe porque o problema que originou o aplicativo não era
 * escrever — era reencontrar o que já tinha sido escrito.
 */
export function PaletaBusca({
  aberta,
  aoFechar,
  etiquetas,
}: {
  aberta: boolean;
  aoFechar: () => void;
  etiquetas: Etiqueta[];
}) {
  const roteador = useRouter();
  const [termo, definirTermo] = useState("");
  const [resultados, definirResultados] = useState<ResultadoBusca[]>([]);
  const [selecionado, definirSelecionado] = useState(0);
  const [buscando, definirBuscando] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (aberta) {
      definirTermo("");
      definirResultados([]);
      definirSelecionado(0);
      // O foco precisa esperar a pintura para o cursor cair no campo.
      requestAnimationFrame(() => campo.current?.focus());
    }
  }, [aberta]);

  useEffect(() => {
    if (!aberta) return;
    if (termo.trim().length < 2) {
      definirResultados([]);
      definirBuscando(false);
      return;
    }
    definirBuscando(true);
    // Espera a digitação parar antes de varrer os arquivos.
    const espera = setTimeout(async () => {
      const achados = await acaoBuscar(termo);
      definirResultados(achados);
      definirSelecionado(0);
      definirBuscando(false);
    }, 220);
    return () => clearTimeout(espera);
  }, [termo, aberta]);

  useEffect(() => {
    lista.current?.querySelector('[data-selecionado="true"]')?.scrollIntoView({ block: "nearest" });
  }, [selecionado, resultados]);

  if (!aberta) return null;

  function abrir(resultado: ResultadoBusca) {
    aoFechar();
    roteador.push(urlDaNota(resultado.caminho));
  }

  function aoTeclar(evento: React.KeyboardEvent) {
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      definirSelecionado((atual) => Math.min(atual + 1, resultados.length - 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      definirSelecionado((atual) => Math.max(atual - 1, 0));
    } else if (evento.key === "Enter" && resultados[selecionado]) {
      evento.preventDefault();
      abrir(resultados[selecionado]);
    } else if (evento.key === "Escape") {
      aoFechar();
    }
  }

  const semResultado = termo.trim().length >= 2 && !buscando && resultados.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-[#1c232b40] p-4 pt-[10vh] backdrop-blur-[2px]"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar nas anotações"
        className="surgir w-full max-w-xl overflow-hidden rounded-xl border border-linha bg-superficie-alta shadow-[var(--sombra)]"
      >
        <div className="flex items-center gap-2.5 border-b border-linha px-4">
          <Search size={15} className="shrink-0 text-tinta-3" />
          <input
            ref={campo}
            // O campo é montado do zero a cada abertura, então autoFocus basta
            // para o cursor já cair aqui — sem ele, Ctrl+K abriria o painel e
            // deixaria a pessoa procurando onde clicar.
            autoFocus
            value={termo}
            onChange={(evento) => definirTermo(evento.target.value)}
            onKeyDown={aoTeclar}
            placeholder="Buscar em todas as anotações"
            className="h-11 flex-1 border-0 bg-transparent text-[14px] text-tinta placeholder:text-tinta-3 focus:ring-0 focus:outline-none"
          />
          <kbd className="shrink-0 rounded border border-linha px-1.5 py-0.5 font-mono text-[10px] text-tinta-3">
            esc
          </kbd>
        </div>

        <div ref={lista} className="max-h-[52vh] overflow-y-auto p-1.5">
          {termo.trim().length < 2 ? (
            <p className="px-3 py-4 text-[12.5px] text-tinta-3">
              Digite ao menos duas letras. A busca olha o título e o corpo de todas as notas.
            </p>
          ) : null}

          {semResultado ? (
            <p className="px-3 py-4 text-[12.5px] text-tinta-3">
              Nada encontrado para “{termo.trim()}”.
            </p>
          ) : null}

          {resultados.map((resultado, posicao) => {
            const etiquetasDaNota = resultado.etiquetas
              .map((id) => etiquetas.find((etiqueta) => etiqueta.id === id))
              .filter((etiqueta): etiqueta is Etiqueta => Boolean(etiqueta));

            return (
              <button
                key={resultado.caminho}
                type="button"
                data-selecionado={posicao === selecionado}
                onMouseMove={() => definirSelecionado(posicao)}
                onClick={() => abrir(resultado)}
                className={clsx(
                  "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left",
                  posicao === selecionado ? "bg-realce-fraco" : "hover:bg-realce-fraco",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-medium">
                      {destacar(resultado.titulo, termo)}
                    </span>
                    <span className="shrink-0 font-mono text-[10px] text-tinta-3 uppercase">
                      {resultado.formato}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-tinta-2">
                    {destacar(resultado.trecho, termo)}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-tinta-3">
                    {resultado.caminho.split("/").slice(0, -1).join(" › ")}
                  </p>
                </div>

                {etiquetasDaNota.length > 0 ? (
                  <span className="mt-1 flex shrink-0 gap-1">
                    {etiquetasDaNota.slice(0, 3).map((etiqueta) => (
                      <span
                        key={etiqueta.id}
                        title={etiqueta.nome}
                        className="size-2 rounded-full"
                        style={{ background: etiqueta.cor }}
                      />
                    ))}
                  </span>
                ) : null}

                {posicao === selecionado ? (
                  <CornerDownLeft size={13} className="mt-1 shrink-0 text-tinta-3" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
