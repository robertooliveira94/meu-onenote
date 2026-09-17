import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

import { comCors } from "../cors";

export { OPTIONS } from "../cors";

/**
 * A extensão chama isto ao carregar uma página com campo de senha, pra
 * saber se tem alguma entrada pra sugerir preencher. `?url=` é a URL da
 * aba — só o domínio importa (ver `dominioDe` em `senhas.ts`).
 */
export async function GET(requisicao: Request) {
  const url = new URL(requisicao.url).searchParams.get("url");
  if (!url) return comCors(NextResponse.json({ erro: "Falta a URL." }, { status: 400 }));
  try {
    return comCors(NextResponse.json({ credenciais: senhas.buscarPorDominio(url) }));
  } catch (erro) {
    if (erro instanceof senhas.CofreTrancado) return comCors(NextResponse.json({ trancado: true }));
    return comCors(NextResponse.json({ erro: "Não deu para consultar o cofre." }, { status: 500 }));
  }
}
