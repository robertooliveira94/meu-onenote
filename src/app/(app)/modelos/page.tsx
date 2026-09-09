import { GerenciadorModelos } from "@/components/gerenciador-modelos";
import { listarModelos } from "@/lib/modelos";

export const dynamic = "force-dynamic";

export default async function TelaModelos() {
  const modelos = await listarModelos();
  return <GerenciadorModelos modelos={modelos} />;
}
