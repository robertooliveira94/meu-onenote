import { AppSenhas } from "@/components/senhas";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada do cofre de senhas. Ao contrário de Anotações e Kanban,
 * não há nada para buscar no servidor antes de renderizar — o conteúdo real
 * só existe depois de destrancar, então quem decide o que mostrar (tela de
 * criar cofre, tela trancada, ou o cofre aberto) é o componente cliente.
 */
export default function TelaDeSenhas() {
  return <AppSenhas />;
}
