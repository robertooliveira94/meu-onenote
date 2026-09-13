import { AppLinks } from "@/components/links";
import { obterArvore } from "@/lib/links-app";

export const dynamic = "force-dynamic";

export default async function PaginaLinks() {
  const arvore = await obterArvore();
  return <AppLinks arvoreInicial={arvore} />;
}
