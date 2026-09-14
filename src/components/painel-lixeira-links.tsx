"use client";

import { Bookmark, Folder, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  acaoApagarDeVezDaLixeiraLinks,
  acaoEsvaziarLixeiraLinks,
  acaoRestaurarDaLixeiraLinks,
} from "@/app/acoes-links";
import { formatarDataHora } from "@/lib/rotas";
import type { ItemLixeiraLinks } from "@/lib/tipos";

import { DialogoConfirmar } from "./dialogos";
import { Botao, BotaoIcone, Vazio } from "./ui";

/** Lixeira da app de Links — mesmo padrão da lixeira das Anotações, mas os itens são nós da árvore, não arquivos. */
export function PainelLixeiraLinks({ itens }: { itens: ItemLixeiraLinks[] }) {
  const roteador = useRouter();
  const [paraApagar, definirParaApagar] = useState<ItemLixeiraLinks | null>(null);
  const [esvaziando, definirEsvaziando] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Lixeira dos Links</h1>
            <p className="mt-1 text-[13px] text-tinta-2">
              Pastas e links excluídos ficam guardados aqui até você restaurar ou apagar de vez.
            </p>
          </div>
          {itens.length > 0 ? (
            <Botao variante="perigo" onClick={() => definirEsvaziando(true)}>
              Esvaziar lixeira
            </Botao>
          ) : null}
        </div>

        {itens.length === 0 ? (
          <Vazio icone={<Trash2 size={20} />} titulo="Lixeira vazia" descricao="Nada esperando para ser restaurado ou apagado." />
        ) : (
          <ul className="mt-6 divide-y divide-[var(--linha)] overflow-hidden rounded-xl border border-linha bg-superficie">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <span className="text-tinta-3">
                  {item.tipo === "pasta-link" ? <Folder size={15} /> : <Bookmark size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.nome}</p>
                  <p className="truncate text-[11.5px] text-tinta-3">excluído em {formatarDataHora(item.excluidoEm)}</p>
                </div>
                <Botao
                  onClick={async () => {
                    const resposta = await acaoRestaurarDaLixeiraLinks(item.id);
                    if (!resposta.ok) alert(resposta.erro);
                    roteador.refresh();
                  }}
                >
                  <RotateCcw size={13} />
                  Restaurar
                </Botao>
                <BotaoIcone rotulo="Apagar de vez" onClick={() => definirParaApagar(item)}>
                  <Trash2 size={14} />
                </BotaoIcone>
              </li>
            ))}
          </ul>
        )}
      </div>

      <DialogoConfirmar
        aberto={paraApagar !== null}
        titulo={`Apagar ${paraApagar?.nome ?? ""} de vez?`}
        descricao="Some de vez e não volta mais."
        textoBotao="Apagar definitivamente"
        aoFechar={() => definirParaApagar(null)}
        aoConfirmar={async () => {
          if (!paraApagar) return null;
          await acaoApagarDeVezDaLixeiraLinks(paraApagar.id);
          roteador.refresh();
          return null;
        }}
      />

      <DialogoConfirmar
        aberto={esvaziando}
        titulo="Esvaziar a lixeira?"
        descricao={`${itens.length} ${itens.length === 1 ? "item some" : "itens somem"} de vez. Não tem volta.`}
        textoBotao="Esvaziar"
        aoFechar={() => definirEsvaziando(false)}
        aoConfirmar={async () => {
          await acaoEsvaziarLixeiraLinks();
          definirEsvaziando(false);
          roteador.refresh();
          return null;
        }}
      />
    </div>
  );
}
