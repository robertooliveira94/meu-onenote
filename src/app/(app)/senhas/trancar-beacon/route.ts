import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

/**
 * Tranca o cofre ao fechar a aba (preferência "Trancar ao fechar" —
 * ver `definirConfig`). `navigator.sendBeacon` no cliente tenta entregar
 * mesmo com a página descarregando; um server action normal não teria essa
 * garantia. Sem corpo, sem resposta — só um POST de "pode trancar".
 */
export async function POST() {
  await senhas.trancar();
  return new NextResponse(null, { status: 204 });
}
