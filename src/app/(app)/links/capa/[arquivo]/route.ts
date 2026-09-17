import fs from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { RAIZ } from "@/lib/caminhos";

/**
 * Serve as capas salvas em `_links/capas/` (`og:image`, ver
 * `buscarMetadadosUrl` em `links-app.ts`). Mesmo esquema do favicon: só um
 * segmento, sem barra — o nome do arquivo é o próprio `Link.capa`.
 */
const TIPOS: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
};

export async function GET(_requisicao: Request, { params }: { params: Promise<{ arquivo: string }> }) {
  const { arquivo } = await params;
  if (!/^[a-z0-9-]+\.[a-z]+$/i.test(arquivo)) return new NextResponse(null, { status: 404 });
  const extensao = arquivo.slice(arquivo.lastIndexOf(".") + 1).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) return new NextResponse(null, { status: 404 });

  try {
    const dados = await fs.readFile(path.join(RAIZ, "_links", "capas", arquivo));
    return new NextResponse(new Uint8Array(dados), {
      headers: { "Content-Type": tipo, "Cache-Control": "public, max-age=604800, immutable" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
