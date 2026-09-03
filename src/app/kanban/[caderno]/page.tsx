import { notFound } from "next/navigation";

import { QuadroKanban } from "@/components/quadro-kanban";
import { lerArvore } from "@/lib/arquivos";
import { listarQuadro } from "@/lib/kanban";

export const dynamic = "force-dynamic";

/**
 * O quadro Kanban de um caderno. Valida que o caderno existe antes de
 * qualquer coisa — `listarQuadro` cria as pastas de coluna na hora se
 * faltarem, e isso não pode acontecer para um nome de caderno inventado
 * (ou digitado errado) na URL. Um caderno é sempre um único segmento (nunca
 * tem "/" no nome), por isso `[caderno]` aqui é segmento simples, não
 * catch-all como em /secao e /nota.
 */
export default async function TelaDoKanban({
  params,
}: {
  params: Promise<{ caderno: string }>;
}) {
  const caderno = decodeURIComponent((await params).caderno);
  const cadernos = await lerArvore();
  const cadernoAtual = cadernos.find((item) => item.caminho === caderno);
  if (!cadernoAtual) notFound();

  const quadro = await listarQuadro(caderno);

  return <QuadroKanban caderno={cadernoAtual} quadro={quadro} />;
}
