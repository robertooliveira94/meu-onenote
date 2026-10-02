import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";
import { minutosRestantes } from "@/lib/extensao-senhas";

import { comCors, recusarOrigemEstranha } from "../cors";

export { OPTIONS } from "../cors";

/** A extensão confere isto antes de tentar salvar/preencher — sem isso, ela mostraria "erro" pra um cofre só trancado. */
export async function GET(requisicao: Request) {
  const recusa = recusarOrigemEstranha(requisicao);
  if (recusa) return recusa;
  const minutos = minutosRestantes(requisicao);
  const autorizado = minutos > 0;
  return comCors(
    requisicao,
    NextResponse.json({
      existe: await senhas.cofreExiste(),
      destrancado: senhas.estaDestrancado(),
      autorizado,
      minutosRestantes: minutos,
    }),
  );
}
