import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

/**
 * Tranca o cofre ao fechar a aba (preferência "Trancar ao fechar" —
 * ver `definirConfig`). `navigator.sendBeacon` no cliente tenta entregar
 * mesmo com a página descarregando; um server action normal não teria essa
 * garantia. Sem corpo, sem resposta — só um POST de "pode trancar".
 */
export async function POST(requisicao: Request) {
  // Só a própria página do cofre: um site qualquer não pode trancar o cofre
  // à distância mandando um POST pra cá.
  const origem = requisicao.headers.get("origin");
  if (origem !== null) {
    let mesmaOrigem = false;
    try {
      mesmaOrigem = new URL(origem).host === new URL(requisicao.url).host;
    } catch {
      mesmaOrigem = false;
    }
    if (!mesmaOrigem) return new NextResponse(null, { status: 403 });
  }
  await senhas.trancar();
  return new NextResponse(null, { status: 204 });
}
