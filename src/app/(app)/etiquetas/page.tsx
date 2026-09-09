import { GerenciadorEtiquetas } from "@/components/gerenciador-etiquetas";
import { contarUsos, listarEtiquetas } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

export default async function TelaEtiquetas() {
  const [etiquetas, usos] = await Promise.all([listarEtiquetas(), contarUsos()]);
  return <GerenciadorEtiquetas etiquetas={etiquetas} usos={usos} />;
}
