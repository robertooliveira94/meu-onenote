"use client";

import { Loader2, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { acaoBuscarSemanticaNoCaderno } from "@/app/acoes";
import { urlDaNota } from "@/lib/rotas";
import type { ResultadoBuscaSemantica } from "@/lib/busca-semantica";

import { Botao, Campo, Dialogo, Vazio } from "./ui";

/**
 * Busca inteligente (semântica) dentro de um caderno: acha páginas por
 * significado, não por palavra exata do texto — "quais anotações falam
 * sobre X", em vez de precisar lembrar a palavra exata usada. Roda inteira
 * na máquina (embeddings locais); a primeira busca num caderno grande pode
 * demorar alguns segundos enquanto indexa o que ainda não tinha vetor.
 */
export function DialogoBuscaSemantica({
  aberto,
  caderno,
  aoFechar,
}: {
  aberto: boolean;
  caderno: { caminho: string; nome: string } | null;
  aoFechar: () => void;
}) {
  const [pergunta, definirPergunta] = useState("");
  const [buscando, definirBuscando] = useState(false);
  const [resultados, definirResultados] = useState<ResultadoBuscaSemantica[] | null>(null);
  const [erro, definirErro] = useState<string | null>(null);

  async function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!caderno || !pergunta.trim() || buscando) return;
    definirBuscando(true);
    definirErro(null);
    const resposta = await acaoBuscarSemanticaNoCaderno(caderno.caminho, pergunta);
    definirBuscando(false);
    if (resposta.ok) definirResultados(resposta.resultados ?? []);
    else definirErro(resposta.erro);
  }

  function fechar() {
    aoFechar();
    // Só depois da transição de fechamento, senão o texto some da tela
    // antes da janela terminar de encolher.
    setTimeout(() => {
      definirPergunta("");
      definirResultados(null);
      definirErro(null);
    }, 200);
  }

  return (
    <Dialogo
      titulo={`Busca inteligente em ${caderno?.nome ?? ""}`}
      descricao="Acha páginas pelo significado, não pela palavra exata — pergunte do seu jeito."
      aberto={aberto}
      aoFechar={fechar}
      largura="max-w-lg"
    >
      <form onSubmit={buscar} className="flex items-center gap-2">
        <div className="relative flex-1">
          <Sparkles size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-tinta-3" />
          <Campo
            autoFocus
            value={pergunta}
            onChange={(evento) => definirPergunta(evento.target.value)}
            placeholder="O que você quer lembrar?"
            className="pl-8"
          />
        </div>
        <Botao type="submit" variante="primario" disabled={buscando || !pergunta.trim()}>
          {buscando ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Buscar
        </Botao>
      </form>

      <div className="mt-4 max-h-[50vh] overflow-y-auto">
        {erro ? (
          <p className="py-4 text-center text-[12.5px] text-perigo">{erro}</p>
        ) : buscando ? (
          <p className="py-10 text-center text-[12.5px] text-tinta-3">
            Procurando — a primeira busca num caderno grande demora um pouco mais.
          </p>
        ) : resultados === null ? (
          <p className="py-10 text-center text-[12.5px] text-tinta-3">
            Nenhuma nota fica de fora: a busca olha todas as páginas de {caderno?.nome}, em todas as seções.
          </p>
        ) : resultados.length === 0 ? (
          <Vazio
            icone={<Sparkles size={18} />}
            titulo="Nada parecido"
            descricao="Tente descrever a ideia de outro jeito, ou com menos detalhe."
          />
        ) : (
          <ul className="space-y-1">
            {resultados.map((resultado) => (
              <li key={resultado.caminho}>
                <Link
                  href={urlDaNota(resultado.caminho)}
                  onClick={fechar}
                  className="block rounded-lg px-3 py-2 transition-colors hover:bg-realce-fraco"
                >
                  <p className="truncate text-[13px] font-medium text-tinta">{resultado.titulo}</p>
                  <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-tinta-3">{resultado.trecho}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Dialogo>
  );
}
