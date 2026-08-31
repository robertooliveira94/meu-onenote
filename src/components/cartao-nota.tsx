import Link from "next/link";

import { formatarDataCurta, urlDaNota } from "@/lib/rotas";
import type { Etiqueta, ResumoNota } from "@/lib/tipos";

/** Cartão de nota usado na tela inicial e na lista de uma etiqueta. */
export function CartaoNota({ nota, etiquetas }: { nota: ResumoNota; etiquetas: Etiqueta[] }) {
  const aplicadas = nota.etiquetas
    .map((id) => etiquetas.find((etiqueta) => etiqueta.id === id))
    .filter((etiqueta): etiqueta is Etiqueta => Boolean(etiqueta));

  return (
    <Link href={urlDaNota(nota.caminho)} className="cartao flex flex-col p-3.5">
      <p className="truncate text-[13.5px] font-medium">{nota.titulo}</p>
      <p className="mt-1 line-clamp-2 min-h-[2.4em] text-[12px] leading-snug text-tinta-2">
        {nota.trecho || "página em branco"}
      </p>

      {aplicadas.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {aplicadas.map((etiqueta) => (
            <span
              key={etiqueta.id}
              className="pastilha"
              style={{
                color: `color-mix(in srgb, ${etiqueta.cor} 82%, var(--tinta))`,
                background: `color-mix(in srgb, ${etiqueta.cor} 14%, transparent)`,
              }}
            >
              {etiqueta.nome}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-2.5 flex items-center gap-1.5 border-t border-linha pt-2">
        <span className="truncate text-[10.5px] text-tinta-3">
          {nota.caminho.split("/").slice(0, -1).join(" / ")}
        </span>
        <span className="ml-auto shrink-0 text-[10.5px] text-tinta-3">
          {formatarDataCurta(nota.atualizadoEm)}
        </span>
      </div>
    </Link>
  );
}
