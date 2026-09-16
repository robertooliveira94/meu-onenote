"use client";

import clsx from "clsx";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useAbas, type Aba } from "@/lib/abas";
import { useAtalho } from "@/lib/atalhos";
import { urlDaNota } from "@/lib/rotas";

import { ItemMenu, Menu, SeparadorMenu } from "./ui";

const TIPO_ARRASTO = "application/x-aba-nota";

/**
 * A faixa de abas acima do conteúdo de Anotações. Some quando não há aba
 * nenhuma — a tela de início e as globais não precisam dela vazia.
 *
 * Alt+W fecha a atual e Alt+PageUp/PageDown circulam: Ctrl+W e Ctrl+Tab
 * são do navegador, que nem deixa a página interceptar.
 */
export function AbasNotas() {
  const { abas, ativa, fechar, fecharOutras, fecharTodas, reordenar } = useAbas();
  const roteador = useRouter();
  const [sobrevoo, definirSobrevoo] = useState<{ caminho: string; antes: boolean } | null>(null);
  const [arrastando, definirArrastando] = useState<string | null>(null);


  const indiceAtiva = abas.findIndex((aba) => aba.caminho === ativa);
  const grupo = "Anotações";

  useAtalho("alt+w", {
    grupo,
    descricao: "Fechar a aba",
    mesmoEmCampo: true,
    ativo: ativa !== null && indiceAtiva !== -1,
    acao: () => ativa && fechar(ativa),
  });
  useAtalho("alt+pagedown", {
    grupo,
    descricao: "Próxima aba",
    mesmoEmCampo: true,
    ativo: abas.length > 1,
    acao: () => irPara(1),
  });
  useAtalho("alt+pageup", {
    grupo,
    descricao: "Aba anterior",
    mesmoEmCampo: true,
    ativo: abas.length > 1,
    acao: () => irPara(-1),
  });

  function irPara(passo: 1 | -1): void {
    if (abas.length === 0) return;
    const base = indiceAtiva === -1 ? (passo === 1 ? -1 : 0) : indiceAtiva;
    const alvo = abas[(base + passo + abas.length) % abas.length];
    roteador.push(urlDaNota(alvo.caminho));
  }

  if (abas.length === 0) return null;

  return (
    <div
      role="tablist"
      aria-label="Notas abertas"
      className="esconde-no-foco flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-linha bg-superficie px-2 pt-1.5"
    >
      {abas.map((aba) => (
        <AbaItem
          key={aba.caminho}
          aba={aba}
          ativa={aba.caminho === ativa}
          arrastando={arrastando === aba.caminho}
          encaixe={sobrevoo?.caminho === aba.caminho ? sobrevoo.antes : null}
          aoFechar={() => fechar(aba.caminho)}
          aoFecharOutras={() => fecharOutras(aba.caminho)}
          aoFecharTodas={fecharTodas}
          aoArrastar={() => definirArrastando(aba.caminho)}
          aoPassarPorCima={(antes) => definirSobrevoo({ caminho: aba.caminho, antes })}
          aoSairDeCima={() => definirSobrevoo((atual) => (atual?.caminho === aba.caminho ? null : atual))}
          aoSoltar={(origem, antes) => {
            reordenar(origem, aba.caminho, antes);
            definirSobrevoo(null);
            definirArrastando(null);
          }}
        />
      ))}
    </div>
  );
}

function AbaItem({
  aba,
  ativa,
  arrastando,
  encaixe,
  aoFechar,
  aoFecharOutras,
  aoFecharTodas,
  aoArrastar,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
}: {
  aba: Aba;
  ativa: boolean;
  arrastando: boolean;
  /** Linha de encaixe: à esquerda (true), à direita (false) ou nenhuma (null). */
  encaixe: boolean | null;
  aoFechar: () => void;
  aoFecharOutras: () => void;
  aoFecharTodas: () => void;
  aoArrastar: () => void;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  /** A origem vem do próprio evento de arrasto, não de estado: um drop rápido chega antes de o estado virar renderização. */
  aoSoltar: (origem: string, antes: boolean) => void;
}) {
  function metadeEsquerda(evento: React.DragEvent): boolean {
    const retangulo = evento.currentTarget.getBoundingClientRect();
    return evento.clientX < retangulo.left + retangulo.width / 2;
  }

  return (
    <Menu
      alinhamento="esquerda"
      gatilho={(abrirMenu) => (
        <div
          role="tab"
          aria-selected={ativa}
          draggable
          onDragStart={(evento) => {
            evento.dataTransfer.setData(TIPO_ARRASTO, aba.caminho);
            evento.dataTransfer.effectAllowed = "move";
            aoArrastar();
          }}
          onDragOver={(evento) => {
            if (!evento.dataTransfer.types.includes(TIPO_ARRASTO)) return;
            evento.preventDefault();
            aoPassarPorCima(metadeEsquerda(evento));
          }}
          onDragLeave={aoSairDeCima}
          onDrop={(evento) => {
            if (!evento.dataTransfer.types.includes(TIPO_ARRASTO)) return;
            evento.preventDefault();
            aoSoltar(evento.dataTransfer.getData(TIPO_ARRASTO), metadeEsquerda(evento));
          }}
          onContextMenu={(evento) => {
            evento.preventDefault();
            abrirMenu();
          }}
          // Botão do meio fecha, como num navegador.
          onAuxClick={(evento) => {
            if (evento.button === 1) {
              evento.preventDefault();
              aoFechar();
            }
          }}
          className={clsx(
            "group relative flex max-w-[200px] shrink-0 items-center gap-1 rounded-t-lg border border-b-0 pr-1 pl-3 text-[12px] transition-colors",
            ativa
              ? "border-linha bg-papel font-medium text-tinta"
              : "border-transparent text-tinta-2 hover:bg-realce-fraco hover:text-tinta",
            arrastando && "opacity-50",
          )}
        >
          {encaixe !== null ? (
            <span
              className="pointer-events-none absolute inset-y-1 w-0.5 rounded-full"
              style={{ background: "var(--realce)", [encaixe ? "left" : "right"]: -2 }}
              aria-hidden
            />
          ) : null}
          {/* A aba ativa continua a "descer" para o conteúdo: a borda de baixo
              é apagada por esta faixinha da cor do papel. */}
          {ativa ? <span className="absolute inset-x-0 -bottom-px h-px bg-papel" aria-hidden /> : null}
          <Link href={urlDaNota(aba.caminho)} title={aba.caminho} className="linha-nav min-w-0 flex-1 truncate">
            {aba.titulo}
          </Link>
          <button
            type="button"
            onClick={aoFechar}
            aria-label={`Fechar ${aba.titulo}`}
            className={clsx(
              "flex size-5 shrink-0 items-center justify-center rounded text-tinta-3 hover:bg-realce-medio hover:text-tinta",
              !ativa && "opacity-0 group-hover:opacity-100 focus-visible:opacity-100",
            )}
          >
            <X size={12} />
          </button>
        </div>
      )}
    >
      {(fecharMenu) => (
        <>
          <ItemMenu
            icone={<X size={14} />}
            onClick={() => {
              fecharMenu();
              aoFechar();
            }}
          >
            Fechar aba
          </ItemMenu>
          <ItemMenu
            icone={<X size={14} className="invisible" />}
            onClick={() => {
              fecharMenu();
              aoFecharOutras();
            }}
          >
            Fechar as outras
          </ItemMenu>
          <SeparadorMenu />
          <ItemMenu
            icone={<X size={14} className="invisible" />}
            onClick={() => {
              fecharMenu();
              aoFecharTodas();
            }}
          >
            Fechar todas
          </ItemMenu>
        </>
      )}
    </Menu>
  );
}
