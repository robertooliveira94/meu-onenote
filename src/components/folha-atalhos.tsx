"use client";

import { partesDoCombo, useListaDeAtalhos } from "@/lib/atalhos";

import { Dialogo } from "./ui";

/**
 * A folha de atalhos (`?`): lê o registro e mostra só o que vale na tela
 * atual — não é uma lista escrita à mão que envelhece a cada tela nova.
 */
export function FolhaAtalhos({ aberta, aoFechar }: { aberta: boolean; aoFechar: () => void }) {
  const grupos = useListaDeAtalhos();

  return (
    <Dialogo
      titulo="Atalhos de teclado"
      descricao="Os que valem na tela em que você está. Teclas soltas não disparam enquanto você digita."
      aberto={aberta}
      aoFechar={aoFechar}
      largura="max-w-lg"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {grupos.map((grupo) => (
          <section key={grupo.grupo}>
            <h3 className="mb-1.5 text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">{grupo.grupo}</h3>
            <ul className="space-y-1">
              {grupo.atalhos.map((atalho) => (
                <li key={atalho.combo} className="flex items-center justify-between gap-3 text-[12.5px]">
                  <span className="min-w-0 truncate text-tinta-2">{atalho.descricao}</span>
                  <span className="flex shrink-0 gap-1">
                    {partesDoCombo(atalho.combo).map((parte, i) => (
                      <kbd
                        key={i}
                        className="rounded-md border border-linha bg-superficie-alta px-1.5 py-0.5 font-mono text-[10.5px] text-tinta shadow-[var(--sombra-cartao)]"
                      >
                        {parte}
                      </kbd>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Dialogo>
  );
}
