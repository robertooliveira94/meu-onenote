import { notFound } from "next/navigation";

import { PaginaNota } from "@/components/nota";
import { lerArvore, lerNota } from "@/lib/arquivos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { linksDaNota, listarBacklinks } from "@/lib/links";
import { listarModelos } from "@/lib/modelos";
import { caminhoDaUrl } from "@/lib/rotas";

export default async function TelaDaNota({
  params,
  searchParams,
}: {
  params: Promise<{ caminho: string[] }>;
  searchParams: Promise<{ editando?: string }>;
}) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const nota = await lerNota(caminho);
  if (!nota) notFound();

  const [etiquetas, cadernos, modelos, mapaDeLinks, backlinks, busca] = await Promise.all([
    listarEtiquetas(),
    lerArvore(),
    listarModelos(),
    linksDaNota(nota.conteudo),
    listarBacklinks(caminho),
    searchParams,
  ]);

  return (
    // A chave remonta o editor ao trocar de página, zerando o estado local.
    <PaginaNota
      key={caminho}
      nota={nota}
      etiquetas={etiquetas}
      modelos={modelos}
      editandoInicial={busca.editando === "1"}
      iconeDoCaderno={cadernos.find((caderno) => caderno.nome === caminho.split("/")[0])?.icone ?? "📓"}
      mapaDeLinks={mapaDeLinks}
      backlinks={backlinks}
    />
  );
}
