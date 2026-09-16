import { HojeKanban } from "@/components/hoje-kanban";
import { listarTarefasComPrazo } from "@/lib/kanban";
import { listarQuadros } from "@/lib/quadros";

export const dynamic = "force-dynamic";

/** Data local do processo — o servidor e o navegador estão na mesma máquina. */
function hojeLocal(): string {
  const agora = new Date();
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}-${String(agora.getDate()).padStart(2, "0")}`;
}

/** "Hoje": todas as tarefas com prazo, de todos os quadros, por urgência. */
export default async function TelaHoje() {
  const [grupos, quadros] = await Promise.all([listarTarefasComPrazo(hojeLocal()), listarQuadros()]);
  return <HojeKanban grupos={grupos} quadros={quadros} />;
}
