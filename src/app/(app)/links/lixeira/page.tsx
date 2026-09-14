import { PainelLixeiraLinks } from "@/components/painel-lixeira-links";
import { listarLixeiraLinks } from "@/lib/links-app";

export const dynamic = "force-dynamic";

export default async function TelaLixeiraLinks() {
  const itens = await listarLixeiraLinks();
  return <PainelLixeiraLinks itens={itens} />;
}
