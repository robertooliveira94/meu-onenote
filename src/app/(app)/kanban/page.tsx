import { KanbanSquare } from "lucide-react";
import { redirect } from "next/navigation";

import { Vazio } from "@/components/ui";
import { listarQuadros } from "@/lib/quadros";
import { urlDoQuadro } from "@/lib/rotas";

export const dynamic = "force-dynamic";

/**
 * Porta de entrada do Kanban: quem chega aqui cai direto no primeiro quadro
 * da lista. Só sobra tela para ver quando ainda não existe quadro nenhum.
 */
export default async function TelaInicialDoKanban() {
  const quadros = await listarQuadros();
  if (quadros.length > 0) redirect(urlDoQuadro(quadros[0].nome));

  return (
    <div className="flex flex-1 items-center justify-center px-8">
      <Vazio
        icone={<KanbanSquare size={22} />}
        titulo="Nenhum quadro por aqui"
        descricao="Os quadros do Kanban são independentes dos cadernos das anotações. Crie o primeiro pelo “+” na coluna ao lado."
      />
    </div>
  );
}
