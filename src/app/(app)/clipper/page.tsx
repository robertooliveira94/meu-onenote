import { Clipper } from "@/components/clipper";
import { lerArvore } from "@/lib/arquivos";
import { lerConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function TelaDoClipper() {
  const [cadernos, config] = await Promise.all([lerArvore(), lerConfig()]);
  const destinoInicial =
    (config.destinoRecorte &&
      cadernos.some((c) => c.secoes.some((s) => s.caminho === config.destinoRecorte)) &&
      config.destinoRecorte) ||
    cadernos[0]?.secoes[0]?.caminho ||
    "";

  return <Clipper cadernos={cadernos} destinoInicial={destinoInicial} />;
}
