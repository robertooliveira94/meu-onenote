import { FilePlus2, FileText } from "lucide-react";

import { Vazio } from "@/components/ui";
import { listarNotas } from "@/lib/arquivos";
import { nomeDe } from "@/lib/caminhos";
import { caminhoDaUrl } from "@/lib/rotas";

/**
 * Seção aberta sem nenhuma página escolhida ainda. A lista de páginas mora
 * na árvore da coluna de navegação — aqui sobra só o convite.
 */
export default async function TelaDaSecao({
  params,
}: {
  params: Promise<{ caminho: string[] }>;
}) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const notas = await listarNotas(caminho);

  return (
    <section className="flex flex-1 items-center justify-center bg-papel px-8">
      {notas.length === 0 ? (
        <Vazio
          icone={<FilePlus2 size={20} />}
          titulo={`${nomeDe(caminho)} está vazia`}
          descricao="Crie a primeira página no “+” da seção, na coluna ao lado, ou com a tecla N."
        />
      ) : (
        <Vazio
          icone={<FileText size={20} />}
          titulo="Escolha uma página"
          descricao="As páginas desta seção estão logo abaixo dela, na coluna ao lado."
        />
      )}
    </section>
  );
}
