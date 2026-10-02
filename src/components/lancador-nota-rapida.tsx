"use client";

import { FilePenLine, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { acaoCriarNotaRapida } from "@/app/acoes";
import { CANAL_NOTA_RAPIDA, publicarMudancaNasNotas } from "@/lib/eventos-notas";
import { urlDaNotaRapida } from "@/lib/rotas";
import type { Caderno } from "@/lib/tipos";

import { SeletorDestinoNotaRapida } from "./seletor-destino-nota-rapida";
import { Botao } from "./ui";

type Estado = "procurando" | "criando" | "destino" | "reutilizada" | "erro";

export function LancadorNotaRapida({
  cadernos,
  destinoInicial,
}: {
  cadernos: Caderno[];
  destinoInicial: string | null;
}) {
  const roteador = useRouter();
  const [estado, definirEstado] = useState<Estado>(destinoInicial ? "procurando" : "destino");
  const [erro, definirErro] = useState<string | null>(null);

  const criar = useCallback(async (destino?: string) => {
    definirEstado("criando");
    definirErro(null);
    const resposta = await acaoCriarNotaRapida(destino);
    if (!resposta.ok) {
      if (resposta.precisaDestino) definirEstado("destino");
      else {
        definirErro(resposta.erro);
        definirEstado("erro");
      }
      return;
    }
    publicarMudancaNasNotas(resposta.caminho);
    roteador.replace(urlDaNotaRapida(resposta.caminho));
  }, [roteador]);

  useEffect(() => {
    if (!destinoInicial) return;

    let canal: BroadcastChannel | null = null;
    let reutilizada = false;
    const token = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    try {
      canal = new BroadcastChannel(CANAL_NOTA_RAPIDA);
      canal.onmessage = (evento: MessageEvent<{ tipo?: string; token?: string }>) => {
        if (evento.data.tipo !== "nota-vazia-disponivel" || evento.data.token !== token) return;
        reutilizada = true;
        definirEstado("reutilizada");
        window.close();
      };
      canal.postMessage({ tipo: "procurar-nota-vazia", token });
    } catch {
      canal = null;
    }

    const espera = window.setTimeout(() => {
      canal?.close();
      if (!reutilizada) void criar(destinoInicial);
    }, canal ? 220 : 0);
    return () => {
      window.clearTimeout(espera);
      canal?.close();
    };
  }, [criar, destinoInicial]);

  if (estado === "destino") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-papel p-5">
        <section className="w-full max-w-xl rounded-2xl border border-linha bg-superficie p-5 shadow-[var(--sombra)]">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-xl bg-realce-medio text-[var(--realce)]">
              <FilePenLine size={20} />
            </span>
            <div>
              <h1 className="text-[18px] font-bold tracking-[-0.02em]">Primeira nota rápida</h1>
              <p className="text-[12.5px] text-tinta-2">Escolha uma seção uma vez; nas próximas, o editor abre direto.</p>
            </div>
          </div>
          <SeletorDestinoNotaRapida cadernos={cadernos} aoEscolher={criar} />
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-papel p-5 text-center">
      <div>
        {estado === "erro" ? (
          <>
            <p className="mb-3 text-[13px] text-perigo">{erro}</p>
            <Botao onClick={() => void criar(destinoInicial ?? undefined)}>Tentar de novo</Botao>
          </>
        ) : estado === "reutilizada" ? (
          <>
            <p className="text-[13px] font-medium">A nota vazia que já estava aberta recebeu o foco.</p>
            <p className="mt-1 text-[12px] text-tinta-3">Você pode fechar esta janela.</p>
          </>
        ) : (
          <span className="flex items-center gap-2 text-[13px] text-tinta-2">
            <Loader2 size={15} className="animate-spin" />
            {estado === "procurando" ? "Abrindo a nota rápida…" : "Criando a nota…"}
          </span>
        )}
      </div>
    </main>
  );
}
