import { z } from "zod";

import { SalvarProdutoPopup } from "@/components/salvar-produto";
import { acharPorUrl, obterDados } from "@/lib/compras-app";

export const dynamic = "force-dynamic";

/**
 * Tela embutida na aba "Compras" do popup da extensão (e utilizável como
 * pop-up avulso, igual a `/salvar-link`): fora do grupo `(app)`, sem a
 * moldura do hub. Recebe a URL e o título da aba aberta; nome e imagem do
 * produto são buscados no cliente, depois que a tela já apareceu.
 */
export default async function PaginaSalvarProduto({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; titulo?: string }>;
}) {
  const params = await searchParams;
  const url = z.string().max(2000).catch("").parse(params.url ?? "");
  const titulo = z.string().max(200).catch("").parse(params.titulo ?? "");

  const [dados, duplicado] = await Promise.all([obterDados(), url ? acharPorUrl(url) : Promise.resolve(null)]);

  return <SalvarProdutoPopup categorias={dados.categorias} url={url} tituloInicial={titulo} duplicado={duplicado} />;
}
