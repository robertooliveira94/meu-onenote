import { NextResponse } from "next/server";

import * as senhas from "@/lib/senhas";

/**
 * Serve o favicon guardado dentro da entrada (um ícone próprio do `.kdbx`,
 * ver `definirFavicon`/`obterFavicon` em `senhas.ts`) — ao contrário do
 * favicon de Links, este nunca fica em disco fora do cofre: só existe
 * enquanto o cofre está destrancado, na sessão do processo.
 */
export async function GET(_requisicao: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const favicon = senhas.obterFavicon(id);
    if (!favicon) return new NextResponse(null, { status: 404 });
    return new NextResponse(new Uint8Array(favicon.bytes), {
      // Sem `public`/`immutable`: o ícone pode trocar (ou sumir, se o cofre
      // trancar) e é só desta sessão — nada a compartilhar entre pessoas.
      headers: { "Content-Type": favicon.tipo, "Cache-Control": "private, max-age=300" },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
