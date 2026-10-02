"use client";

import { FilePlus2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acaoCriarNotaRapida } from "@/app/acoes";
import { publicarMudancaNasNotas } from "@/lib/eventos-notas";
import { urlDaNota } from "@/lib/rotas";
import type { Caderno } from "@/lib/tipos";

import { SeletorDestinoNotaRapida } from "./seletor-destino-nota-rapida";
import { Dialogo } from "./ui";

export function BotaoNotaRapida({ cadernos }: { cadernos: Caderno[] }) {
  const roteador = useRouter();
  const [ocupado, definirOcupado] = useState(false);
  const [escolhendo, definirEscolhendo] = useState(false);
  const [erro, definirErro] = useState<string | null>(null);

  async function criar(destino?: string) {
    definirOcupado(true);
    definirErro(null);
    const resposta = await acaoCriarNotaRapida(destino);
    definirOcupado(false);
    if (!resposta.ok) {
      if (resposta.precisaDestino) definirEscolhendo(true);
      else definirErro(resposta.erro);
      return;
    }
    definirEscolhendo(false);
    publicarMudancaNasNotas(resposta.caminho);
    roteador.push(`${urlDaNota(resposta.caminho)}?editando=1`);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void criar()}
        disabled={ocupado}
        className="mx-3 mb-1.5 flex h-8 shrink-0 items-center justify-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--realce)_14%,transparent)] px-3 text-[12.5px] font-semibold text-tinta transition-colors hover:bg-[color-mix(in_srgb,var(--realce)_22%,transparent)] disabled:opacity-50"
      >
        {ocupado ? <Loader2 size={14} className="animate-spin" /> : <FilePlus2 size={14} />}
        Nota rápida
      </button>
      {erro ? <p className="mx-3 mb-1.5 text-[11.5px] text-perigo">{erro}</p> : null}

      <Dialogo
        titulo="Onde guardar as notas rápidas?"
        descricao="Essa escolha ficará lembrada. Você ainda poderá trocar a seção na janela rápida."
        aberto={escolhendo}
        aoFechar={() => definirEscolhendo(false)}
        largura="max-w-xl"
      >
        <SeletorDestinoNotaRapida cadernos={cadernos} aoEscolher={criar} />
      </Dialogo>
    </>
  );
}
