import { z } from "zod";

import { HistoricoParaImprimir } from "@/components/saude-imprimir";
import { exportarHistorico } from "@/lib/saude-app";

export const dynamic = "force-dynamic";

/**
 * O histórico numa página limpa, fora da moldura do app (como
 * `/nota-flutuante`): é a versão pra `Ctrl+P` → PDF, pra levar ao médico.
 * O mesmo markdown do download, renderizado.
 */
export default async function PaginaImprimirSaude({
  searchParams,
}: {
  searchParams: Promise<{ especialidade?: string; pessoa?: string }>;
}) {
  const params = await searchParams;
  const especialidadeId = z.string().max(40).catch("").parse(params.especialidade ?? "") || null;
  const pessoaId = z.string().max(40).catch("").parse(params.pessoa ?? "") || null;
  const historico = await exportarHistorico({ especialidadeId, pessoaId });
  return <HistoricoParaImprimir titulo={historico.titulo} markdown={historico.markdown} />;
}
