import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { criarNota, lerArvore } from "@/lib/arquivos";
import { profundidade } from "@/lib/caminhos";
import { lerConfig } from "@/lib/config";
import { urlDaNota } from "@/lib/rotas";

/**
 * Onde o bookmarklet do Web Clipper (ver `/clipper`) entrega a página
 * recortada. GET de propósito — o bookmarklet só abre uma URL, sem
 * formulário nem fetch, então não há como mandar um corpo de requisição.
 *
 * O destino vem, em ordem: do parâmetro `destino` (que o bookmarklet
 * carrega, escolhido na tela do clipper), depois do `config.json`, e por
 * último a primeira seção do primeiro caderno. Se não houver caderno nenhum,
 * não há para onde recortar.
 */

/** Aceita a seção só se for um caminho de profundidade 2 (caderno/seção) que existe. */
async function secaoValida(caminho: string | null): Promise<string | null> {
  if (!caminho || profundidade(caminho) !== 2) return null;
  const [caderno, secao] = caminho.split("/");
  const arvore = await lerArvore();
  const existe = arvore
    .find((c) => c.nome === caderno)
    ?.secoes.some((s) => s.caminho === `${caderno}/${secao}`);
  return existe ? caminho : null;
}

async function resolverDestino(destinoDaUrl: string | null): Promise<string | null> {
  const daUrl = await secaoValida(destinoDaUrl);
  if (daUrl) return daUrl;

  const doConfig = await secaoValida((await lerConfig()).destinoRecorte ?? null);
  if (doConfig) return doConfig;

  const arvore = await lerArvore();
  return arvore[0]?.secoes[0]?.caminho ?? null;
}

export async function GET(requisicao: Request) {
  const params = new URL(requisicao.url).searchParams;
  const titulo = z.string().max(200).catch("").parse(params.get("titulo") ?? "");
  const url = z.string().max(2000).catch("").parse(params.get("url") ?? "");
  const selecao = z.string().max(20_000).catch("").parse(params.get("selecao") ?? "");

  const destino = await resolverDestino(params.get("destino"));
  if (!destino) {
    return new NextResponse(
      "Nenhum caderno para recortar. Crie um caderno com uma seção e tente de novo.",
      { status: 409 },
    );
  }

  const agora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const partes = [`> Recortado ${url ? `de [${url}](${url})` : "da web"} em ${agora}.`];
  if (selecao.trim()) partes.push(selecao.trim());

  const caminho = await criarNota(destino, titulo.trim() || "Recorte da web", "md", partes.join("\n\n"));
  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(urlDaNota(caminho), requisicao.url));
}
