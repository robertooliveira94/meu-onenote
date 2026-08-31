import { notFound } from "next/navigation";

import { ListaPaginas } from "@/components/lista-paginas";
import { PaginaNota } from "@/components/nota";
import { lerArvore, lerNota, listarNotas } from "@/lib/arquivos";
import { nomeDe, pastaDe } from "@/lib/caminhos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarModelos } from "@/lib/modelos";
import { caminhoDaUrl } from "@/lib/rotas";

export default async function TelaDaNota({
  params,
  searchParams,
}: {
  params: Promise<{ caminho: string[] }>;
  searchParams: Promise<{ editando?: string }>;
}) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const nota = await lerNota(caminho);
  if (!nota) notFound();

  const pasta = pastaDe(caminho);
  const [notas, etiquetas, cadernos, modelos, busca] = await Promise.all([
    listarNotas(pasta),
    listarEtiquetas(),
    lerArvore(),
    listarModelos(),
    searchParams,
  ]);

  return (
    <>
      <ListaPaginas
        pasta={pasta}
        nomeDaPasta={nomeDe(pasta) || "Notas"}
        notas={notas}
        etiquetas={etiquetas}
        cadernos={cadernos}
        modelos={modelos}
        caminhoAtivo={caminho}
      />
      {/* A chave remonta o editor ao trocar de página, zerando o estado local. */}
      <PaginaNota
        key={caminho}
        nota={nota}
        etiquetas={etiquetas}
        editandoInicial={busca.editando === "1"}
        iconeDoCaderno={
          cadernos.find((caderno) => caderno.nome === caminho.split("/")[0])?.icone ?? "📓"
        }
      />
    </>
  );
}
