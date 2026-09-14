import { z } from "zod";

import { SalvarLinkPopup } from "@/components/salvar-link";
import { lerConfig } from "@/lib/config";
import { obterArvore } from "@/lib/links-app";
import type { PastaLink } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/** `true` se `id` existir em algum nó da árvore — usado pra validar o destino salvo em config.json. */
function existePasta(raiz: PastaLink, id: string): boolean {
  return raiz.id === id || raiz.pastas.some((sub) => existePasta(sub, id));
}

/**
 * Tela da janela pop-up aberta pelo atalho "salvar link" do Web Clipper
 * (ver `/clipper`) — fora do grupo `(app)` de propósito, sem a moldura do
 * app (barra de aplicativos, coluna de seções), igual a `/nota-flutuante`:
 * é pensada pra abrir numa janelinha pequena por cima do que a pessoa
 * estava vendo, não pra navegar o hub inteiro.
 */
export default async function PaginaSalvarLink({
  searchParams,
}: {
  searchParams: Promise<{ url?: string; titulo?: string }>;
}) {
  const params = await searchParams;
  const url = z.string().max(2000).catch("").parse(params.url ?? "");
  const titulo = z.string().max(200).catch("").parse(params.titulo ?? "");

  const [arvore, config] = await Promise.all([obterArvore(), lerConfig()]);
  const pastaInicial = config.destinoLink && existePasta(arvore, config.destinoLink) ? config.destinoLink : arvore.id;

  return <SalvarLinkPopup arvore={arvore} url={url} tituloInicial={titulo} pastaInicial={pastaInicial} />;
}
