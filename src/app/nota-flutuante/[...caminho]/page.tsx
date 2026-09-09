import { notFound } from "next/navigation";

import { PaginaNota } from "@/components/nota";
import { lerNota } from "@/lib/arquivos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { linksDaNota, listarBacklinks } from "@/lib/links";
import { caminhoDaUrl } from "@/lib/rotas";

/**
 * A mesma nota de `/nota/...`, mas sem a moldura do app (sem barra de
 * aplicações, sem coluna de seções) — pensada para abrir numa janela
 * separada do navegador, ao lado da janela principal, e não para navegar até
 * aqui pelo app (por isso fica fora do grupo `(app)`, que é quem aplica essa
 * moldura). Ver `abrirJanelaFlutuante`.
 */
export default async function TelaDaNotaFlutuante({
  params,
}: {
  params: Promise<{ caminho: string[] }>;
}) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const nota = await lerNota(caminho);
  if (!nota) notFound();

  const [etiquetas, mapaDeLinks, backlinks] = await Promise.all([
    listarEtiquetas(),
    linksDaNota(nota.conteudo),
    listarBacklinks(caminho),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <PaginaNota
        nota={nota}
        etiquetas={etiquetas}
        editandoInicial={false}
        iconeDoCaderno=""
        mapaDeLinks={mapaDeLinks}
        backlinks={backlinks}
      />
    </div>
  );
}
