"use client";

import { FileText, Folder, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acaoApagarDaLixeira, acaoEsvaziarLixeira, acaoRestaurarDaLixeira } from "@/app/acoes";
import { formatarDataHora } from "@/lib/rotas";
import type { ItemLixeira } from "@/lib/tipos";

import { DialogoConfirmar } from "./dialogos";
import { Botao, BotaoIcone, Vazio } from "./ui";

/** Lixeira: nada some sozinho, e voltar é um clique. */
export function PainelLixeira({ itens }: { itens: ItemLixeira[] }) {
  const roteador = useRouter();
  const [paraApagar, definirParaApagar] = useState<ItemLixeira | null>(null);
  const [esvaziando, definirEsvaziando] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Lixeira</h1>
            <p className="mt-1 text-[13px] text-tinta-2">
              O que você exclui fica guardado aqui, com etiquetas e favoritos, até você mandar
              apagar de vez.
            </p>
          </div>
          {itens.length > 0 ? (
            <Botao variante="perigo" onClick={() => definirEsvaziando(true)}>
              Esvaziar lixeira
            </Botao>
          ) : null}
        </div>

        {itens.length === 0 ? (
          <Vazio
            icone={<Trash2 size={20} />}
            titulo="Lixeira vazia"
            descricao="Nada esperando para ser restaurado ou apagado."
          />
        ) : (
          <ul className="mt-6 divide-y divide-[var(--linha)] overflow-hidden rounded-xl border border-linha bg-superficie">
            {itens.map((item) => (
              <li key={item.id} className="flex items-center gap-3 p-3">
                <span className="text-tinta-3">
                  {item.tipo === "pasta" ? <Folder size={15} /> : <FileText size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{item.nome}</p>
                  <p className="truncate text-[11.5px] text-tinta-3">
                    vinha de {item.caminhoOriginal.split("/").slice(0, -1).join(" › ") || "raiz"} ·
                    excluído em {formatarDataHora(item.excluidoEm)}
                  </p>
                </div>
                <Botao
                  onClick={async () => {
                    await acaoRestaurarDaLixeira(item.id);
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
        descricao="Some do disco e não volta mais."
        textoBotao="Apagar definitivamente"
        aoFechar={() => definirParaApagar(null)}
        aoConfirmar={async () => {
          if (!paraApagar) return null;
          const resposta = await acaoApagarDaLixeira(paraApagar.id);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={esvaziando}
        titulo="Esvaziar a lixeira?"
        descricao={`${itens.length} ${itens.length === 1 ? "item some" : "itens somem"} do disco de uma vez. Não tem volta.`}
        textoBotao="Esvaziar"
        aoFechar={() => definirEsvaziando(false)}
        aoConfirmar={async () => {
          const resposta = await acaoEsvaziarLixeira();
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />
    </div>
  );
}
