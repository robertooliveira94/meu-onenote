import fs from "node:fs/promises";

import JSZip from "jszip";
import { NextResponse } from "next/server";

import { exportarHistorico } from "@/lib/saude-app";

/**
 * Baixa o histórico: `?formato=md` entrega o markdown puro; `?formato=zip`
 * embala o .md mais os anexos (rota, não Server Action — binário). Sem
 * `especialidade` é tudo; sem `pessoa` são todas as pessoas.
 */
export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url);
  const formato = url.searchParams.get("formato") === "zip" ? "zip" : "md";
  try {
    const historico = await exportarHistorico({
      especialidadeId: url.searchParams.get("especialidade"),
      pessoaId: url.searchParams.get("pessoa"),
    });
    const nomeCodificado = encodeURIComponent(historico.nomeDoArquivo);
    if (formato === "md") {
      return new NextResponse(historico.markdown, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": `attachment; filename*=UTF-8''${nomeCodificado}.md`,
        },
      });
    }
    const zip = new JSZip();
    zip.file(`${historico.nomeDoArquivo}.md`, historico.markdown);
    for (const anexo of historico.anexos) {
      try {
        zip.file(anexo.caminhoNoZip, await fs.readFile(anexo.caminhoEmDisco));
      } catch {
        // Anexo sumiu do disco: o .md ainda lista o nome; não derruba o zip inteiro.
      }
    }
    const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename*=UTF-8''${nomeCodificado}.zip`,
      },
    });
  } catch (erro) {
    return new NextResponse(erro instanceof Error ? erro.message : "Não deu certo.", { status: 400 });
  }
}
