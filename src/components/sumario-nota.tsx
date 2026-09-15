"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import { useEffect, useState, type RefObject } from "react";

import type { Titulo } from "@/lib/sumario";

import { BotaoIcone } from "./ui";

/**
 * O sumário da nota: os títulos dela, indentados por nível, na margem
 * direita.
 *
 * Em leitura, o título que está na tela fica destacado enquanto se rola e
 * clicar leva até ele. Em edição, clicar põe o cursor na linha daquele
 * título no texto cru — que é o que se quer quando o sumário serve para
 * navegar um documento longo que se está escrevendo.
 *
 * Só aparece a partir de três títulos: numa nota de duas seções ele ocuparia
 * espaço para repetir o que já está à vista.
 */
export function SumarioNota({
  titulos,
  editando,
  containerLeitura,
  aoIrParaLinha,
  aoFechar,
}: {
  titulos: Titulo[];
  editando: boolean;
  /** O painel rolável do modo leitura — onde os `<h1..h6>` com `id` estão. */
  containerLeitura: RefObject<HTMLElement | null>;
  aoIrParaLinha: (linha: number) => void;
  aoFechar: () => void;
}) {
  const [ativo, definirAtivo] = useState<string | null>(null);
  const chaveDosTitulos = titulos.map((titulo) => titulo.id).join("|");
  // Uma nota que só usa `##` e `###` não deve aparecer toda indentada: o
  // degrau conta a partir do menor nível que ela tem.
  const nivelBase = Math.min(...titulos.map((titulo) => titulo.nivel));

  // Em leitura, quem manda no destaque é a rolagem. A faixa de detecção é o
  // topo do painel (os 30% de cima): é onde o olho está quando se rola.
  useEffect(() => {
    if (editando) {
      definirAtivo(null);
      return;
    }
    const container = containerLeitura.current;
    if (!container) return;

    const elementos = titulos
      .map((titulo) => container.querySelector<HTMLElement>(`#${CSS.escape(titulo.id)}`))
      .filter((elemento): elemento is HTMLElement => Boolean(elemento));
    if (elementos.length === 0) return;

    /** No fim da rolagem o destaque é sempre o último título — ver `aoRolar`. */
    function noFimDaRolagem(): boolean {
      if (!container) return false;
      return container.scrollTop + container.clientHeight >= container.scrollHeight - 4;
    }

    const observador = new IntersectionObserver(
      (entradas) => {
        // A checagem vem antes de olhar as entradas porque o observador
        // dispara depois do evento de rolagem e, sem isto, desfazia o
        // destaque que `aoRolar` acabou de pôr no último título.
        if (noFimDaRolagem()) {
          definirAtivo(elementos[elementos.length - 1].id);
          return;
        }
        const visiveis = entradas.filter((entrada) => entrada.isIntersecting);
        if (visiveis.length === 0) return;
        // O mais alto dos visíveis: rolando para baixo, o destaque desce um
        // item de cada vez em vez de pular para o último que entrou.
        const primeiro = visiveis.reduce((melhor, atual) =>
          atual.boundingClientRect.top < melhor.boundingClientRect.top ? atual : melhor,
        );
        definirAtivo(primeiro.target.id);
      },
      { root: container, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    for (const elemento of elementos) observador.observe(elemento);

    // No fim da rolagem, o último título já passou da faixa de detecção — sem
    // isto o sumário aponta a seção anterior enquanto se lê a última.
    function aoRolar() {
      if (noFimDaRolagem()) definirAtivo(elementos[elementos.length - 1].id);
    }
    container.addEventListener("scroll", aoRolar, { passive: true });

    return () => {
      observador.disconnect();
      container.removeEventListener("scroll", aoRolar);
    };
    // `chaveDosTitulos` no lugar de `titulos`: o array é novo a cada tecla
    // digitada, mas os títulos em si quase nunca mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveDosTitulos, editando, containerLeitura]);

  function irPara(titulo: Titulo): void {
    if (editando) {
      aoIrParaLinha(titulo.linha);
      return;
    }
    const alvo = containerLeitura.current?.querySelector<HTMLElement>(`#${CSS.escape(titulo.id)}`);
    alvo?.scrollIntoView({ block: "start", behavior: "smooth" });
    definirAtivo(titulo.id);
  }

  return (
    <aside className="esconde-no-foco flex w-[200px] shrink-0 flex-col border-l border-linha bg-superficie">
      <div className="flex items-center justify-between px-3 pt-3 pb-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">Sumário</span>
        <BotaoIcone rotulo="Esconder o sumário (])" onClick={aoFechar} className="size-6">
          <X size={13} />
        </BotaoIcone>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" aria-label="Títulos desta página">
        {titulos.map((titulo, indice) => (
          <button
            key={`${titulo.id}-${indice}`}
            type="button"
            onClick={() => irPara(titulo)}
            title={titulo.texto}
            className={clsx(
              "block w-full truncate rounded-md py-[3px] pr-1 text-left text-[11.5px] transition-colors",
              titulo.id === ativo
                ? "bg-realce-medio font-medium text-tinta"
                : "text-tinta-2 hover:bg-realce-fraco hover:text-tinta",
            )}
            style={{ paddingLeft: `${8 + (titulo.nivel - nivelBase) * 10}px` }}
          >
            {titulo.texto}
          </button>
        ))}
      </nav>
    </aside>
  );
}
