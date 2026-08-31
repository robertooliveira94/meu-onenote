import { FilePlus2, FileText } from "lucide-react";

import { ListaPaginas } from "@/components/lista-paginas";
import { Vazio } from "@/components/ui";
import { lerArvore, listarNotas } from "@/lib/arquivos";
import { nomeDe } from "@/lib/caminhos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { listarModelos } from "@/lib/modelos";
import { caminhoDaUrl } from "@/lib/rotas";

/** Seção aberta sem nenhuma página escolhida ainda. */
export default async function TelaDaSecao({
  params,
}: {
  params: Promise<{ caminho: string[] }>;
}) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const [notas, etiquetas, cadernos, modelos] = await Promise.all([
    listarNotas(caminho),
    listarEtiquetas(),
    lerArvore(),
    listarModelos(),
  ]);

  return (
    <>
      <ListaPaginas
        pasta={caminho}
        nomeDaPasta={nomeDe(caminho)}
        notas={notas}
        etiquetas={etiquetas}
        cadernos={cadernos}
        modelos={modelos}
      />
      <section className="flex flex-1 items-center justify-center bg-papel px-8">
        {notas.length === 0 ? (
          <Vazio
            icone={<FilePlus2 size={20} />}
            titulo={`${nomeDe(caminho)} está vazia`}
            descricao="Crie a primeira página no “+” da coluna ao lado. Você escolhe se ela nasce em markdown ou em texto simples."
          />
        ) : (
          <Vazio
            icone={<FileText size={20} />}
            titulo="Escolha uma página"
            descricao="As páginas desta seção estão na coluna ao lado."
          />
        )}
      </section>
    </>
  );
}
