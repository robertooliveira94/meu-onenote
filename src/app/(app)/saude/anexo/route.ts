import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { adicionarAnexo } from "@/lib/saude-app";

/**
 * Upload de anexo (multipart): rota em vez de Server Action porque o corpo
 * de uma action é limitado a 1 MB por padrão, e um laudo em PDF ou uma
 * foto de receita passa disso com folga. Devolve os dados inteiros, como
 * as actions, pra tela aplicar do mesmo jeito.
 */
export async function POST(requisicao: Request) {
  try {
    const formulario = await requisicao.formData();
    const idEvento = String(formulario.get("evento") ?? "");
    const arquivo = formulario.get("arquivo");
    if (!idEvento || !(arquivo instanceof File)) {
      return NextResponse.json({ ok: false, erro: "Faltou o arquivo." }, { status: 400 });
    }
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const dados = await adicionarAnexo(idEvento, arquivo.name, bytes);
    revalidatePath("/saude", "layout");
    return NextResponse.json({ ok: true, dados });
  } catch (erro) {
    return NextResponse.json({ ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." }, { status: 400 });
  }
}
