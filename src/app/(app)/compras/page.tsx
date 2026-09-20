import { AppCompras } from "@/components/compras";
import { obterDados } from "@/lib/compras-app";

export const dynamic = "force-dynamic";

export default async function PaginaCompras() {
  const dados = await obterDados();
  return <AppCompras dadosIniciais={dados} />;
}
