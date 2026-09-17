import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

import { comCors } from "../cors";

export { OPTIONS } from "../cors";

/** A extensão confere isto antes de tentar salvar/preencher — sem isso, ela mostraria "erro" pra um cofre só trancado. */
export async function GET() {
  return comCors(NextResponse.json({ destrancado: senhas.estaDestrancado() }));
}
