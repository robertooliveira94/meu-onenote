import { notFound } from "next/navigation";

import { ArquivoKanban } from "@/components/arquivo-kanban";
import { listarArquivadas } from "@/lib/kanban";
import { listarQuadros } from "@/lib/quadros";

export const dynamic = "force-dynamic";

/** O arquivo de um quadro: tarefas concluídas que saíram das colunas. */
export default async function TelaDoArquivo({
  params,
}: {
  params: Promise<{ quadro: string }>;
}) {
  const nome = decodeURIComponent((await params).quadro);
  const quadros = await listarQuadros();
  const atual = quadros.find((item) => item.nome === nome);
  if (!atual) notFound();

  const tarefas = await listarArquivadas(nome);
  return <ArquivoKanban quadro={atual} tarefas={tarefas} />;
}
