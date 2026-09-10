import { GerenciadorEtiquetasKanban } from "@/components/gerenciador-etiquetas-kanban";
import { contarUsosKanban, listarEtiquetasKanban } from "@/lib/etiquetas-kanban";
import { listarQuadros } from "@/lib/quadros";

export const dynamic = "force-dynamic";

export default async function TelaEtiquetasKanban({
  searchParams,
}: {
  searchParams: Promise<{ quadro?: string }>;
}) {
  const { quadro } = await searchParams;
  const [todas, usos, quadros] = await Promise.all([
    listarEtiquetasKanban(),
    contarUsosKanban(),
    listarQuadros(),
  ]);

  const quadroAtual = quadro && quadros.some((q) => q.nome === quadro) ? quadro : undefined;
  const visiveis = quadroAtual
    ? todas.filter((etiqueta) => !etiqueta.quadro || etiqueta.quadro === quadroAtual)
    : todas.filter((etiqueta) => !etiqueta.quadro);

  return <GerenciadorEtiquetasKanban etiquetas={visiveis} usos={usos} quadro={quadroAtual} />;
}
