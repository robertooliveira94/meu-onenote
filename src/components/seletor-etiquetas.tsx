"use client";

import { Check, Plus, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acaoDefinirEtiquetasDaNota } from "@/app/acoes";
import type { Etiqueta } from "@/lib/tipos";

import { Etiquetinha, Menu } from "./ui";

/**
 * Etiquetas da nota aberta. Marcar e desmarcar grava na hora — não existe
 * botão "salvar etiquetas", porque não existe motivo para existir.
 */
export function SeletorEtiquetas({
  caminho,
  etiquetasDaNota,
  todasEtiquetas,
}: {
  caminho: string;
  etiquetasDaNota: string[];
  todasEtiquetas: Etiqueta[];
}) {
  const roteador = useRouter();
  const [selecionadas, definirSelecionadas] = useState(etiquetasDaNota);

  async function alternar(id: string) {
    const proximas = selecionadas.includes(id)
      ? selecionadas.filter((etiqueta) => etiqueta !== id)
      : [...selecionadas, id];
    definirSelecionadas(proximas);
    await acaoDefinirEtiquetasDaNota(caminho, proximas);
    roteador.refresh();
  }

  const aplicadas = selecionadas
    .map((id) => todasEtiquetas.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is Etiqueta => Boolean(etiqueta));

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {aplicadas.map((etiqueta) => (
        <Etiquetinha
          key={etiqueta.id}
          nome={etiqueta.nome}
          cor={etiqueta.cor}
          aoRemover={() => alternar(etiqueta.id)}
        />
      ))}

      <Menu
        alinhamento="esquerda"
        gatilho={(abrir) => (
          <button
            type="button"
            onClick={abrir}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-linha-forte px-2 py-0.5 text-[11.5px] text-tinta-3 transition-colors hover:border-[var(--realce)] hover:text-tinta"
          >
            <Plus size={11} />
            etiqueta
          </button>
        )}
      >
        {() => (
          <>
            {todasEtiquetas.length === 0 ? (
              <p className="px-2 py-2 text-[12px] leading-snug text-tinta-3">
                Nenhuma etiqueta cadastrada ainda.
              </p>
            ) : null}

            <div className="max-h-64 overflow-y-auto">
              {todasEtiquetas.map((etiqueta) => {
                const marcada = selecionadas.includes(etiqueta.id);
                return (
                  <button
                    key={etiqueta.id}
                    type="button"
                    onClick={() => alternar(etiqueta.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] hover:bg-realce-fraco"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: etiqueta.cor }}
                    />
                    <span className="flex-1 truncate">{etiqueta.nome}</span>
                    {marcada ? <Check size={13} style={{ color: "var(--realce)" }} /> : null}
                  </button>
                );
              })}
            </div>

            <div className="mt-1 border-t border-linha pt-1">
              <Link
                href="/etiquetas"
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] text-tinta-2 hover:bg-realce-fraco"
              >
                <Tag size={13} />
                Cadastrar etiquetas
              </Link>
            </div>
          </>
        )}
      </Menu>
    </div>
  );
}
