import { notFound } from "next/navigation";

import { NotaRapida } from "@/components/nota-rapida";
import { lerArvore, lerNota } from "@/lib/arquivos";
import { caminhoDaUrl } from "@/lib/rotas";

export const metadata = { title: "Nota rápida" };

export default async function TelaDaNotaRapida({ params }: { params: Promise<{ caminho: string[] }> }) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const [nota, cadernos] = await Promise.all([lerNota(caminho), lerArvore()]);
  if (!nota) notFound();
  return <NotaRapida key={caminho} nota={nota} cadernos={cadernos} />;
}
