import { PainelTarefas } from "@/components/painel-tarefas";
import { listarTarefas } from "@/lib/tarefas";

export const dynamic = "force-dynamic";

export default async function TelaDeTarefas() {
  const tarefas = await listarTarefas();
  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <PainelTarefas tarefas={tarefas} />
    </div>
  );
}
