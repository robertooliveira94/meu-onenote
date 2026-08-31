import { PainelLixeira } from "@/components/painel-lixeira";
import { listarLixeira } from "@/lib/lixeira";

export const dynamic = "force-dynamic";

export default async function TelaLixeira() {
  const itens = await listarLixeira();
  return <PainelLixeira itens={itens} />;
}
