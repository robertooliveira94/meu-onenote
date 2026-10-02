import { NextResponse } from "next/server";

import { obterArvore } from "@/lib/links-app";
import type { PastaLink } from "@/lib/tipos";

export const dynamic = "force-dynamic";

type PastaParaExtensao = {
  id: string;
  nome: string;
  links: { id: string; titulo: string; url: string }[];
  pastas: PastaParaExtensao[];
};

/**
 * Entrega à extensão somente o necessário para montar os favoritos nativos.
 * Notas, estados de leitura e caminhos dos favicons continuam privados no app.
 */
function paraExtensao(pasta: PastaLink): PastaParaExtensao {
  return {
    id: pasta.id,
    nome: pasta.nome,
    links: pasta.links.map(({ id, titulo, url }) => ({ id, titulo, url })),
    pastas: pasta.pastas.map(paraExtensao),
  };
}

export async function GET() {
  const arvore = await obterArvore();
  return NextResponse.json({ arvore: paraExtensao(arvore) });
}
