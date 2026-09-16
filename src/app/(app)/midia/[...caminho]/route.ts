import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { resolverCaminho } from "@/lib/caminhos";
import { caminhoDaUrl } from "@/lib/rotas";

/**
 * Serve os anexos das notas (ver `_anexos/` ao lado de cada página): as
 * imagens coladas e os arquivos arrastados para o editor. Só o que está
 * nesta tabela — mesmo sendo um app local de um usuário só, esta rota não
 * deve virar um jeito de ler qualquer arquivo dentro de `dados/` pela URL.
 * SVG fica de fora de propósito: pode carregar script, e seria servido na
 * origem do app.
 */
const TIPOS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  json: "application/json",
  zip: "application/zip",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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
