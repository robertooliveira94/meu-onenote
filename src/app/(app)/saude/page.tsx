import { AppSaude } from "@/components/saude";
import { obterDados } from "@/lib/saude-app";

export const dynamic = "force-dynamic";

export default async function PaginaSaude() {
  const dados = await obterDados();
  return <AppSaude dadosIniciais={dados} />;
}
