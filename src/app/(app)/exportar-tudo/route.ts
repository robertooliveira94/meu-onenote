import { NextResponse } from "next/server";

import { exportarTudoZip } from "@/lib/exportar";

/**
 * O vault inteiro num `.zip` — cada caderno/seção como pasta de verdade,
 * cada página como arquivo próprio, espelhando `dados/`. Rota (não Server
 * Action) porque o zip é binário: uma Server Action serializaria o
 * resultado como se fosse JSON, e um arquivo de alguns MB nesse formato
 * fica pesado à toa — aqui a resposta já sai como bytes, do jeito que o
 * navegador espera para um download.
 */
export async function GET() {
  const zip = await exportarTudoZip();
  return new NextResponse(new Uint8Array(zip), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": 'attachment; filename="Meu bloco de anotacoes.zip"',
    },
  });
}
