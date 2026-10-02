import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

import { comCors, recusarOrigemEstranha } from "../cors";

export { OPTIONS } from "../cors";

/**
 * A extensão chama isto quando percebe uma senha sendo enviada num
 * formulário e a pessoa confirma "salvar no cofre". Atualiza uma entrada
 * existente (mesmo site + usuário) ou cria uma nova em "Do navegador".
 */
export async function POST(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  let corpo: unknown;
  try {
    corpo = await requisicao.json();
  } catch {
    return comCors(requisicao, NextResponse.json({ erro: "Corpo inválido." }, { status: 400 }));
  }
  const dados = corpo as Partial<{ url: string; usuario: string; senha: string; titulo: string }>;
  if (!dados.url || !dados.senha) {
    return comCors(requisicao, NextResponse.json({ erro: "Faltam url e senha." }, { status: 400 }));
  }
  try {
    const resultado = await senhas.salvarDoNavegador({
      url: dados.url,
      usuario: dados.usuario ?? "",
      senha: dados.senha,
      titulo: dados.titulo,
    });
    return comCors(requisicao, NextResponse.json({ ok: true, ...resultado }));
  } catch (erro) {
    if (erro instanceof senhas.CofreTrancado) return comCors(requisicao, NextResponse.json({ ok: false, trancado: true }));
    return comCors(requisicao, NextResponse.json({ ok: false, erro: "Não deu para salvar." }, { status: 500 }));
  }
}
