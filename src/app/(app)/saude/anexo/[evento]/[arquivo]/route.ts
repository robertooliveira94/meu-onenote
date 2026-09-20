import fs from "node:fs/promises";

import { NextResponse } from "next/server";

import { caminhoDoAnexo } from "@/lib/saude-app";

/**
 * Serve um anexo de evento de saúde. Só o que está no registro do evento —
 * o nome vem do JSON, não da URL, então não dá pra ler outro arquivo por
 * aqui. PDF e imagem abrem inline (nova aba); o resto baixa.
 */
const TIPOS: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  txt: "text/plain; charset=utf-8",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

const INLINE = new Set(["pdf", "png", "jpg", "jpeg", "gif", "webp", "txt"]);

export async function GET(_requisicao: Request, { params }: { params: Promise<{ evento: string; arquivo: string }> }) {
  const { evento, arquivo } = await params;
  if (!/^[a-z0-9]+$/i.test(evento) || !/^[a-z0-9]+\.[a-z0-9]+$/i.test(arquivo)) return new NextResponse(null, { status: 404 });
  const extensao = arquivo.slice(arquivo.lastIndexOf(".") + 1).toLowerCase();
  const tipo = TIPOS[extensao];
  if (!tipo) return new NextResponse(null, { status: 404 });

  const achado = await caminhoDoAnexo(evento, arquivo);
  if (!achado) return new NextResponse(null, { status: 404 });
  try {
    const dados = await fs.readFile(achado.caminho);
    const disposicao = INLINE.has(extensao) ? "inline" : "attachment";
    return new NextResponse(new Uint8Array(dados), {
      headers: {
        "Content-Type": tipo,
        "Content-Disposition": `${disposicao}; filename*=UTF-8''${encodeURIComponent(achado.nome)}`,
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
