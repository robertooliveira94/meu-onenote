import { ArrowLeft, Tag } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CartaoNota } from "@/components/cartao-nota";
import { Vazio } from "@/components/ui";
import { notasComEtiqueta } from "@/lib/arquivos";
import { listarEtiquetas } from "@/lib/etiquetas";

/** Todas as notas de uma etiqueta, vindas de qualquer caderno. */
export default async function TelaDaEtiqueta({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const etiquetas = await listarEtiquetas();
  const etiqueta = etiquetas.find((item) => item.id === id);
  if (!etiqueta) notFound();

  const notas = await notasComEtiqueta(id);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/etiquetas"
          className="inline-flex items-center gap-1.5 text-[12px] text-tinta-2 hover:text-tinta"
        >
          <ArrowLeft size={13} />
          Etiquetas
        </Link>

        <h1 className="mt-3 flex items-center gap-2.5 text-[25px] leading-tight font-extrabold tracking-[-0.03em]">
          <span className="size-3.5 rounded-full" style={{ background: etiqueta.cor }} />
          {etiqueta.nome}
        </h1>
        <p className="mt-1 text-[13px] text-tinta-2">
          {etiqueta.descricao ||
            `${notas.length} ${notas.length === 1 ? "nota marcada" : "notas marcadas"} com esta etiqueta.`}
        </p>

        {notas.length === 0 ? (
          <Vazio
            icone={<Tag size={20} />}
            titulo="Nenhuma nota com esta etiqueta"
            descricao="Abra uma nota e use o botão “+ etiqueta” no alto da página para marcá-la."
          />
        ) : (
          <div className="mt-7 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {notas.map((nota) => (
              <CartaoNota key={nota.caminho} nota={nota} etiquetas={etiquetas} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
