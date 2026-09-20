import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { RAIZ } from "@/lib/caminhos";

/** Serve as imagens de produto salvas em `_compras/imagens/` — mesmo esquema das capas de Links. */
const TIPOS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

export async function GET(_requisicao: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  if (!/^[a-z0-9-]+\.[a-z]+$/i.test(arquivo)) return new NextResponse(null, { status: 404 });
  const extensao = arquivo.slice(arquivo.lastIndexOf(".") + 1).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) return new NextResponse(null, { status: 404 });

  try {
    const dados = await fs.readFile(path.join(RAIZ, "_compras", "imagens", arquivo));
    return new NextResponse(new Uint8Array(dados), {
      headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=604800, immutable" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
