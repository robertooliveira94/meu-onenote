import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { criarNota } from "@/lib/arquivos";
import { PASTA_ENTRADA } from "@/lib/caminhos";
import { urlDaNota } from "@/lib/rotas";

/**
 * Onde o bookmarklet do web clipper (ver `/clipper`) entrega a página
 * recortada. GET de propósito — o bookmarklet só abre uma URL, sem
 * formulário nem fetch, então não há como mandar um corpo de requisição.
 * Cai sempre no caderno "Entrada", como a captura rápida.
 */
export async function GET(requisicao: Request) {
  const params = new URL(requisicao.url).searchParams;
  const titulo = z.string().max(200).catch("").parse(params.get("titulo") ?? "");
  const url = z.string().max(2000).catch("").parse(params.get("url") ?? "");
  const selecao = z.string().max(20_000).catch("").parse(params.get("selecao") ?? "");

  const agora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const partes = [`> Recortado ${url ? `de [${url}](${url})` : "da web"} em ${agora}.`];
  if (selecao.trim()) partes.push(selecao.trim());

  const caminho = await criarNota(
    PASTA_ENTRADA,
    titulo.trim() || "Recorte da web",
    "md",
    partes.join("\n\n"),
  );
  revalidatePath("/", "layout");

  return NextResponse.redirect(new URL(urlDaNota(caminho), requisicao.url));
}
