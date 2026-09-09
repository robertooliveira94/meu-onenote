import { GerenciadorEtiquetasKanban } from "@/components/gerenciador-etiquetas-kanban";
import { contarUsosKanban, listarEtiquetasKanban } from "@/lib/etiquetas-kanban";

export const dynamic = "force-dynamic";

export default async function TelaEtiquetasKanban() {
  const [etiquetas, usos] = await Promise.all([listarEtiquetasKanban(), contarUsosKanban()]);
  return <GerenciadorEtiquetasKanban etiquetas={etiquetas} usos={usos} />;
}
