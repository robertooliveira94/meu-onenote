import { NextResponse } from "next/server";

import { emitirAutorizacao, paraExtensao } from "@/lib/extensao-senhas";
import * as senhas from "@/lib/senhas";

import { comCors, recusarOrigemEstranha } from "../cors";

export { OPTIONS } from "../cors";

export async function POST(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;

  let senhaMestra = "";
  let minutos = 15;
  try {
    const corpo = (await requisicao.json()) as { senhaMestra?: unknown; minutos?: unknown };
    senhaMestra = typeof corpo.senhaMestra === "string" ? corpo.senhaMestra : "";
    const solicitado = typeof corpo.minutos === "number" ? corpo.minutos : 15;
    minutos = Math.min(480, Math.max(5, Math.round(solicitado)));
  } catch {
    // A resposta abaixo também cobre corpo malformado sem revelar detalhes.
  }
  if (!senhaMestra) {
    return comCors(requisicao, NextResponse.json({ ok: false, erro: "Digite a senha mestra." }, { status: 400 }));
  }
  if (!(await senhas.cofreExiste())) {
    return comCors(requisicao, NextResponse.json({ ok: false, semCofre: true, erro: "O cofre ainda não existe." }, { status: 404 }));
  }

  const certo = senhas.estaDestrancado()
    ? await senhas.conferirSenhaMestra(senhaMestra)
    : await senhas.destrancar(senhaMestra);
  if (!certo) {
    return comCors(requisicao, NextResponse.json({ ok: false, erro: "Senha mestra incorreta." }, { status: 401 }));
  }

  await senhas.definirTravaDaSessao(minutos);
  const token = emitirAutorizacao(requisicao, minutos);
  return comCors(
    requisicao,
    NextResponse.json({ ok: true, token, minutos, arvore: paraExtensao(senhas.obterArvore()) }),
  );
}
