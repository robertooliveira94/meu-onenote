import { LancadorNotaRapida } from "@/components/lancador-nota-rapida";
import { lerArvore } from "@/lib/arquivos";
import { lerConfig } from "@/lib/config";

export const metadata = { title: "Nota rápida" };

export default async function TelaDeLancamentoDaNotaRapida() {
  const [cadernos, config] = await Promise.all([lerArvore(), lerConfig()]);
  const secoes = new Set(cadernos.flatMap((caderno) => caderno.secoes.map((secao) => secao.caminho)));
  const destinoInicial = config.destinoNotaRapida && secoes.has(config.destinoNotaRapida)
    ? config.destinoNotaRapida
    : null;
  return <LancadorNotaRapida cadernos={cadernos} destinoInicial={destinoInicial} />;
}
