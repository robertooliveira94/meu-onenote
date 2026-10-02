import { NextResponse } from "next/server";

import { estaAutorizada, paraExtensao } from "@/lib/extensao-senhas";
import * as senhas from "@/lib/senhas";

import { comCors, recusarOrigemEstranha } from "../cors";

export { OPTIONS } from "../cors";

function semAutorizacao(requisicao: Request) {
  return comCors(
    requisicao,
    NextResponse.json({ ok: false, naoAutorizado: true, trancado: !senhas.estaDestrancado() }, { status: 401 }),
  );
}

export async function GET(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  if (!estaAutorizada(requisicao)) return semAutorizacao(requisicao);
  return comCors(requisicao, NextResponse.json({ ok: true, arvore: paraExtensao(senhas.obterArvore()) }));
}

export async function POST(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  if (!estaAutorizada(requisicao)) return semAutorizacao(requisicao);

  let corpo: Record<string, unknown>;
  try {
    corpo = (await requisicao.json()) as Record<string, unknown>;
  } catch {
    return comCors(requisicao, NextResponse.json({ ok: false, erro: "Pedido inválido." }, { status: 400 }));
  }

  try {
    if (corpo.acao === "criar") {
      const grupoId = typeof corpo.grupoId === "string" ? corpo.grupoId : "";
      const titulo = typeof corpo.titulo === "string" ? corpo.titulo.trim().slice(0, 200) : "";
      if (!grupoId || !titulo) {
        return comCors(requisicao, NextResponse.json({ ok: false, erro: "Escolha o grupo e informe o título." }, { status: 400 }));
      }
      const arvore = await senhas.criarEntrada(grupoId, {
        titulo,
        usuario: typeof corpo.usuario === "string" ? corpo.usuario.slice(0, 1000) : "",
        senha: typeof corpo.senha === "string" ? corpo.senha.slice(0, 10_000) : "",
        url: typeof corpo.url === "string" ? corpo.url.slice(0, 4000) : "",
        notas: "",
        expiraEm: null,
        otp: null,
        camposExtras: [],
      });
      return comCors(requisicao, NextResponse.json({ ok: true, arvore: paraExtensao(arvore) }));
    }

    if (corpo.acao === "acesso" && typeof corpo.id === "string") {
      await senhas.registrarAcesso(corpo.id);
      return comCors(requisicao, NextResponse.json({ ok: true }));
    }

    if (corpo.acao === "trancar") {
      await senhas.trancar();
      return comCors(requisicao, NextResponse.json({ ok: true }));
    }

    return comCors(requisicao, NextResponse.json({ ok: false, erro: "Ação desconhecida." }, { status: 400 }));
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : "Não deu para concluir.";
    return comCors(requisicao, NextResponse.json({ ok: false, erro: mensagem }, { status: 400 }));
  }
}
