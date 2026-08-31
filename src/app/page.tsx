import { Clock, NotebookPen, Star } from "lucide-react";
import Link from "next/link";

import { CartaoNota } from "@/components/cartao-nota";
import { Vazio } from "@/components/ui";
import { notasFavoritas, notasRecentes } from "@/lib/arquivos";
import { PASTA_ENTRADA } from "@/lib/caminhos";
import { listarEtiquetas } from "@/lib/etiquetas";
import { urlDaSecao } from "@/lib/rotas";

// O conteúdo vem do disco, que muda o tempo todo: nada de página estática.
export const dynamic = "force-dynamic";

/** Tela inicial: o que você fixou e o que mexeu por último. */
export default async function Inicio() {
  const [favoritas, recentes, etiquetas] = await Promise.all([
    notasFavoritas(),
    notasRecentes(9),
    listarEtiquetas(),
  ]);

  const vazio = favoritas.length === 0 && recentes.length === 0;

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Suas anotações</h1>
        <p className="mt-1 text-[13px] text-tinta-2">
          Tudo fica em arquivos dentro de <span className="font-mono text-[12px]">dados/</span>, na
          pasta do projeto.
        </p>

        {vazio ? (
          <Vazio
            icone={<NotebookPen size={20} />}
            titulo="Comece pelo primeiro caderno"
            descricao="Crie um caderno no “+” à esquerda. Ele vira uma pasta no disco, e cada página vira um arquivo .md ou .txt lá dentro."
          />
        ) : null}

        {favoritas.length > 0 ? (
          <section className="mt-9">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-tinta-3 uppercase">
              <Star size={12} />
              Fixadas
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {favoritas.map((nota) => (
                <CartaoNota key={nota.caminho} nota={nota} etiquetas={etiquetas} />
              ))}
            </div>
          </section>
        ) : null}

        {recentes.length > 0 ? (
          <section className="mt-9">
            <h2 className="mb-3 flex items-center gap-2 text-[11px] font-medium tracking-wider text-tinta-3 uppercase">
              <Clock size={12} />
              Editadas recentemente
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {recentes.map((nota) => (
                <CartaoNota key={nota.caminho} nota={nota} etiquetas={etiquetas} />
              ))}
            </div>
          </section>
        ) : null}

        {!vazio ? (
          <p className="mt-10 text-[12px] text-tinta-3">
            Dica: <kbd className="font-mono">Ctrl K</kbd> busca em todas as notas.{" "}
            <kbd className="font-mono">Ctrl Shift N</kbd> abre uma folha em branco no caderno{" "}
            <Link href={urlDaSecao(PASTA_ENTRADA)} className="underline underline-offset-2">
              {PASTA_ENTRADA}
            </Link>
            . <kbd className="font-mono">Ctrl Shift D</kbd> abre a nota de hoje.
          </p>
        ) : null}
      </div>
    </div>
  );
}
