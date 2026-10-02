import { NextResponse } from "next/server";
import { z } from "zod";

import { escreverNota, lerNota } from "@/lib/arquivos";
import { agendarIndexacao } from "@/lib/busca-semantica";

const corpoValido = z.object({
  caminho: z.string().min(1).max(400),
  conteudo: z.string(),
});

/** Endpoint comum ao debounce e ao `sendBeacon` disparado ao fechar a janela. */
export async function POST(requisicao: Request) {
  try {
    const { caminho, conteudo } = corpoValido.parse(await requisicao.json());
    await escreverNota(caminho, conteudo);
    agendarIndexacao(caminho, () => lerNota(caminho));
    return NextResponse.json({ ok: true });
  } catch (erro) {
    return NextResponse.json(
      { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para salvar" },
      { status: 400 },
    );
  }
}
