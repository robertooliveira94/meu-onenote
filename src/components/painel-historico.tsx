"use client";

import clsx from "clsx";
import { RotateCcw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { acaoLerVersao, acaoListarVersoes, acaoRestaurarVersao } from "@/app/acoes";
import { diferencaDeLinhas, resumoDaDiferenca } from "@/lib/diferenca";
import { formatarDataHora } from "@/lib/rotas";
import type { VersaoHistorico } from "@/lib/tipos";

import { Aviso, Botao, BotaoIcone } from "./ui";

/** "vazia", "412 B", "2,3 kB" — arredondar tudo para kB esconderia as pequenas. */
function descreverTamanho(bytes: number): string {
  if (bytes === 0) return "vazia";
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1).replace(".", ",")} kB`;
}

type Visao = "previa" | "comparar";

/**
 * Painel de versões. O salvamento automático grava por cima do arquivo
 * enquanto se digita — este painel é o caminho de volta quando isso apaga algo
 * que fazia falta.
 *
 * "Comparar" mostra, linha a linha, o que muda entre a versão escolhida e o
 * texto de agora — antes disso, restaurar era um salto no escuro: dava para
 * ler a versão antiga, mas não para ver *o que* ela devolvia ou apagava.
 */
export function PainelHistorico({
  caminho,
  conteudoAtual,
  aoFechar,
  aoRestaurar,
}: {
  caminho: string;
  /** O texto de agora, para o modo "Comparar". */
  conteudoAtual: string;
  aoFechar: () => void;
  aoRestaurar: (conteudo: string) => void;
}) {
  const roteador = useRouter();
  const [versoes, definirVersoes] = useState<VersaoHistorico[] | null>(null);
  const [selecionada, definirSelecionada] = useState<string | null>(null);
  const [previa, definirPrevia] = useState<string>("");
  const [visao, definirVisao] = useState<Visao>("comparar");
  const [erro, definirErro] = useState<string | null>(null);
  const [ocupado, definirOcupado] = useState(false);

  useEffect(() => {
    acaoListarVersoes(caminho).then(definirVersoes);
  }, [caminho]);

  async function escolher(id: string) {
    definirSelecionada(id);
    definirPrevia((await acaoLerVersao(caminho, id)) ?? "");
  }

  async function restaurar() {
    if (!selecionada) return;
    definirOcupado(true);
    const resposta = await acaoRestaurarVersao(caminho, selecionada);
    definirOcupado(false);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    aoRestaurar(previa);
    aoFechar();
    roteador.refresh();
  }

  // Da versão escolhida para o texto de agora: "saiu" é o que restaurar
  // devolve, "entrou" é o que restaurar apaga.
  const diferenca = useMemo(
    () => (selecionada ? diferencaDeLinhas(previa, conteudoAtual) : []),
    [selecionada, previa, conteudoAtual],
  );
  const resumo = useMemo(() => resumoDaDiferenca(diferenca), [diferenca]);
  const semMudanca = selecionada !== null && resumo.sairam === 0 && resumo.entraram === 0;

  return (
    <aside className="flex w-[340px] shrink-0 flex-col border-l border-linha bg-superficie">
      <div className="flex items-center justify-between border-b border-linha px-3 py-2">
        <div>
          <p className="text-[12.5px] font-medium">Histórico</p>
          <p className="text-[11px] text-tinta-3">últimas 20 versões</p>
        </div>
        <BotaoIcone rotulo="Fechar histórico" onClick={aoFechar}>
          <X size={15} />
        </BotaoIcone>
      </div>

      <div className="max-h-[38%] overflow-y-auto p-1.5">
        {versoes === null ? (
          <p className="px-2 py-3 text-[12px] text-tinta-3">Carregando…</p>
        ) : versoes.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-tinta-3">
            Ainda não há versões anteriores. A primeira é guardada depois de alguns minutos de
            edição.
          </p>
        ) : (
          versoes.map((versao) => (
            <button
              key={versao.id}
              type="button"
              onClick={() => escolher(versao.id)}
              className={clsx(
                "flex w-full items-baseline gap-2 rounded-md px-2 py-1.5 text-left text-[12px] transition-colors",
                versao.id === selecionada ? "bg-realce-fraco font-medium" : "hover:bg-realce-fraco",
              )}
            >
              <span className="flex-1">{formatarDataHora(versao.salvaEm)}</span>
              <span className="text-[10.5px] text-tinta-3 tabular-nums">
                {descreverTamanho(versao.tamanho)}
              </span>
            </button>
          ))
        )}
      </div>

      {selecionada ? (
        <div className="flex min-h-0 flex-1 flex-col border-t border-linha">
          <div className="flex items-center gap-1 border-b border-linha px-2 py-1.5">
            <Alternador ativo={visao === "comparar"} onClick={() => definirVisao("comparar")}>
              Comparar
            </Alternador>
            <Alternador ativo={visao === "previa"} onClick={() => definirVisao("previa")}>
              Prévia
            </Alternador>
            {visao === "comparar" ? (
              <span className="ml-auto flex gap-2 font-mono text-[10.5px] tabular-nums">
                <span className="text-[var(--realce)]">+{resumo.sairam}</span>
                <span className="text-perigo">−{resumo.entraram}</span>
              </span>
            ) : null}
          </div>

          {visao === "previa" ? (
            <pre className="editor-texto flex-1 overflow-auto p-3 text-tinta-2 whitespace-pre-wrap">{previa}</pre>
          ) : semMudanca ? (
            <p className="flex-1 px-3 py-4 text-[12px] leading-relaxed text-tinta-3">
              Esta versão é igual ao texto de agora.
            </p>
          ) : (
            <div className="flex-1 overflow-auto py-2">
              {/* Lida de cima para baixo como "o que restaurar faz": verde é o
                  que volta, vermelho é o que some. */}
              {diferenca.map((linha, indice) => (
                <div
                  key={indice}
                  className={clsx(
                    "editor-texto flex gap-2 px-3 whitespace-pre-wrap",
                    linha.tipo === "saiu" && "bg-[color-mix(in_srgb,var(--realce)_14%,transparent)] text-tinta",
                    linha.tipo === "entrou" && "bg-[color-mix(in_srgb,var(--perigo)_12%,transparent)] text-tinta line-through decoration-perigo/60",
                    linha.tipo === "igual" && "text-tinta-3",
                  )}
                >
                  <span className="w-3 shrink-0 select-none text-tinta-3" aria-hidden>
                    {linha.tipo === "saiu" ? "+" : linha.tipo === "entrou" ? "−" : " "}
                  </span>
                  <span className="min-w-0 flex-1">{linha.texto || " "}</span>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-linha p-2.5">
            <Aviso>{erro}</Aviso>
            <Botao variante="primario" className="w-full justify-center" onClick={restaurar} disabled={ocupado}>
              <RotateCcw size={13} />
              Restaurar esta versão
            </Botao>
            <p className="mt-1.5 text-[11px] leading-snug text-tinta-3">
              O texto de agora vira uma versão antes da troca.
            </p>
          </div>
        </div>
      ) : null}
    </aside>
  );
}

function Alternador({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        "rounded-md px-2 py-0.5 text-[11.5px] transition-colors",
        ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco hover:text-tinta",
      )}
    >
      {children}
    </button>
  );
}
