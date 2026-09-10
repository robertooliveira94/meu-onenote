import { notFound } from "next/navigation";

import { QuadroKanban } from "@/components/quadro-kanban";
import { etiquetasVisiveisKanban } from "@/lib/etiquetas-kanban";
import { listarQuadro } from "@/lib/kanban";
import { listarQuadros } from "@/lib/quadros";
import { listarSprints } from "@/lib/sprints-kanban";

export const dynamic = "force-dynamic";

/**
 * Um quadro do Kanban. Valida que o quadro existe antes de qualquer coisa —
 * `listarQuadro` cria as pastas de coluna na hora se faltarem, e isso não
 * pode acontecer para um nome inventado (ou digitado errado) na URL. O nome
 * do quadro é sempre um único segmento, por isso `[quadro]` aqui é segmento
 * simples, não catch-all como em /secao e /nota.
 */
export default async function TelaDoQuadro({
  params,
}: {
  params: Promise<{ quadro: string }>;
}) {
  const nome = decodeURIComponent((await params).quadro);
  const quadros = await listarQuadros();
  const atual = quadros.find((item) => item.nome === nome);
  if (!atual) notFound();

  const [conteudo, etiquetasKanban, sprints] = await Promise.all([
    listarQuadro(nome),
    etiquetasVisiveisKanban(nome),
    listarSprints(),
  ]);

  return (
    <QuadroKanban
      quadro={atual}
      conteudo={conteudo}
      etiquetasKanban={etiquetasKanban}
      sprints={sprints}
    />
  );
}
