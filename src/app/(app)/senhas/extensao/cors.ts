import { NextResponse } from "next/server";

/**
 * Estas rotas devolvem senhas em texto puro pra extensão do Chrome — e a
 * extensão é a ÚNICA que pode chamá-las de outra origem.
 *
 * Um app local não está protegido por rodar em `localhost`: o navegador da
 * própria pessoa alcança `http://localhost:3100` a partir de qualquer site
 * aberto numa aba. O que impede esse site de LER a resposta é o CORS — e um
 * `Access-Control-Allow-Origin: *` aqui desligava justamente isso: com o cofre
 * destrancado, qualquer página podia fazer `fetch('/senhas/extensao/buscar?
 * url=https://banco.com')` e receber usuário e senha.
 *
 * Então: a origem só é aceita se for a de uma extensão de navegador
 * (`chrome-extension://…`, `moz-extension://…`) — o service worker da
 * extensão manda esse `Origin` — ou se não houver `Origin` nenhum (chamada da
 * mesma origem, ou ferramenta de linha de comando). Qualquer `http(s)://` de
 * fora recebe 403 e nenhum cabeçalho CORS.
 */
const ESQUEMAS_DE_EXTENSAO = ["chrome-extension://", "moz-extension://", "safari-web-extension://"];

function origemDeExtensao(origem: string | null): origem is string {
  return origem !== null && ESQUEMAS_DE_EXTENSAO.some((esquema) => origem.startsWith(esquema));
}

/** `null` = pode responder; senão a resposta 403 já pronta. */
export function recusarOrigemEstranha(requisicao: Request): NextResponse | null {
  const origem = requisicao.headers.get("origin");
  if (origem === null || origemDeExtensao(origem)) return null;
  // Mesma origem do app (a página do cofre chamando a si mesma) também vale.
  try {
    if (new URL(origem).host === new URL(requisicao.url).host) return null;
  } catch {
    // Origin malformado: recusa como qualquer outro.
  }
  return NextResponse.json({ erro: "Origem não permitida." }, { status: 403 });
}

export function comCors(requisicao: Request, resposta: NextResponse): NextResponse {
  const origem = requisicao.headers.get("origin");
  if (origemDeExtensao(origem)) {
    resposta.headers.set("Access-Control-Allow-Origin", origem);
    resposta.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    resposta.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    resposta.headers.set("Vary", "Origin");
  }
  return resposta;
}

export function OPTIONS(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  return comCors(requisicao, new NextResponse(null, { status: 204 }));
}
