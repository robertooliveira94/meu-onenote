import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

import { comCors, recusarOrigemEstranha } from "../cors";

export { OPTIONS } from "../cors";

/**
 * A extensão chama isto ao carregar uma página com campo de senha, pra
 * saber se tem alguma entrada pra sugerir preencher. `?url=` é a URL da
 * aba — só o domínio importa (ver `dominioDe` em `senhas.ts`).
 */
export async function GET(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  const url = new URL(requisicao.url).searchParams.get("url");
  if (!url) return comCors(requisicao, NextResponse.json({ erro: "Falta a URL." }, { status: 400 }));
  try {
    return comCors(requisicao, NextResponse.json({ credenciais: senhas.buscarPorDominio(url) }));
  } catch (erro) {
    if (erro instanceof senhas.CofreTrancado) return comCors(requisicao, NextResponse.json({ trancado: true }));
    return comCors(requisicao, NextResponse.json({ erro: "Não deu para consultar o cofre." }, { status: 500 }));
  }
}
