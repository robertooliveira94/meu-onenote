import { NextResponse } from "next/server";

/**
 * Cabeçalhos CORS permissivos só nestas três rotas — pensadas pra extensão
 * do Chrome (`extensao/`) chamar de fora do Next. Um service worker de
 * extensão com `host_permissions` já não esbarra em CORS de qualquer jeito,
 * mas isso cobre o content script chamando direto, sem passar pelo
 * background, e não custa nada num app local de uma pessoa só.
 */
const CABECALHOS_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function comCors(resposta: NextResponse): NextResponse {
  for (const [nome, valor] of Object.entries(CABECALHOS_CORS)) resposta.headers.set(nome, valor);
  return resposta;
}

export function OPTIONS() {
  return comCors(new NextResponse(null, { status: 204 }));
}
