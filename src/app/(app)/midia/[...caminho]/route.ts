import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { resolverCaminho } from "@/lib/caminhos";
import { caminhoDaUrl } from "@/lib/rotas";

/**
 * Serve os anexos colados nas notas (ver `_anexos/` ao lado de cada página).
 * Só imagens — mesmo sendo um app local de um usuário só, esta rota não deve
 * virar um jeito de ler qualquer arquivo dentro de `dados/` pela URL.
 */
const TIPOS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(
  _requisicao: Request,
  { params }: { params: Promise<{ caminho: string[] }> },
) {
  const { caminho: segmentos } = await params;
  const caminho = caminhoDaUrl(segmentos);
  const extensao = caminho.slice(caminho.lastIndexOf(".") + 1).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) return new NextResponse(null, { status: 404 });

  try {
    const dados = await fs.readFile(resolverCaminho(caminho));
    return new NextResponse(new Uint8Array(dados), {
      headers: { "Content-Type": tipo },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
