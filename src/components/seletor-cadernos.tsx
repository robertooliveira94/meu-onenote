"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Download, MoreHorizontal, Palette, Pencil, Plus, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import {
  acaoCriarCaderno,
  acaoDefinirCorCaderno,
  acaoDefinirIconeCaderno,
  acaoExcluir,
  acaoExportarSecao,
  acaoRenomear,
  acaoReordenar,
} from "@/app/acoes";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import { cadernoDaUrl, urlDaSecao } from "@/lib/rotas";
import type { Caderno } from "@/lib/tipos";

import { DialogoConfirmar, DialogoCor, DialogoIcone, DialogoNome } from "./dialogos";
import { BotaoIcone, ItemMenu, Menu, SeparadorMenu } from "./ui";

type Acao = { tipo: "renomear" | "cor" | "icone" | "excluir"; caderno: Caderno } | null;

/** Monta o arquivo no servidor e entrega ao navegador como download. */
async function baixarCaderno(caminho: string): Promise<void> {
  const { nome, conteudo } = await acaoExportarSecao(caminho);
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

/**
 * A tira de cadernos no topo da tela — o nível "de cima" que troca tudo
 * abaixo dele. Ao contrário de seção e página, um caderno nunca fica
 * aninhado dentro de outra coisa (é sempre o topo), então aqui não tem
 * árvore nenhuma: só uma lista horizontal, igual ao seletor de cadernos do
 * OneNote de verdade.
 */
export function SeletorDeCadernos({ cadernos }: { cadernos: Caderno[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const [criando, definirCriando] = useState(false);

  const nomeAtivo = cadernoDaUrl(caminhoAtual);
  const fechar = () => definirAcao(null);
  const alvo = acao?.caderno ?? null;

  function atualizar(): void {
    roteador.refresh();
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1 overflow-x-auto border-b border-linha bg-superficie px-3 py-2"
      aria-label="Cadernos"
    >
      {cadernos.map((caderno) => (
        <ChipCaderno
          key={caderno.caminho}
          caderno={caderno}
          ativo={caderno.nome === nomeAtivo}
          aoAgir={definirAcao}
        />
      ))}

      <button
        type="button"
        onClick={() => definirCriando(true)}
        className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] text-tinta-3 transition-colors hover:bg-realce-fraco hover:text-tinta"
      >
        <Plus size={14} />
        Novo caderno
      </button>

      <DialogoNome
        aberto={criando}
        titulo="Novo caderno"
        descricao="Vira uma pasta de primeiro nível dentro de dados/."
        rotulo="Nome do caderno"
        textoBotao="Criar caderno"
        aoFechar={() => definirCriando(false)}
        aoConfirmar={async (nome) => {
          const resposta = await acaoCriarCaderno(nome);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoNome
        aberto={acao?.tipo === "renomear"}
        titulo="Renomear caderno"
        descricao="A pasta é renomeada no disco junto."
        rotulo="Novo nome"
        valorInicial={alvo?.nome ?? ""}
        textoBotao="Renomear"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          if (!alvo) return null;
          const resposta = await acaoRenomear(alvo.caminho, nome);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoIcone
        aberto={acao?.tipo === "icone"}
        icones={ICONES_DISPONIVEIS}
        iconeAtual={alvo?.icone ?? ""}
        aoFechar={fechar}
        aoEscolher={async (icone) => {
          if (!alvo) return null;
          const resposta = await acaoDefinirIconeCaderno(alvo.caminho, icone);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoCor
        aberto={acao?.tipo === "cor"}
        cores={CORES_CADERNO}
        corAtual={alvo?.cor ?? ""}
        aoFechar={fechar}
        aoEscolher={async (cor) => {
          if (!alvo) return null;
          const resposta = await acaoDefinirCorCaderno(alvo.caminho, cor);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={acao?.tipo === "excluir"}
        titulo={`Excluir ${alvo?.nome ?? ""}?`}
        descricao="O caderno e tudo que está dentro (seções e páginas) vão para a lixeira. Dá para restaurar depois."
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo) return null;
          const resposta = await acaoExcluir(alvo.caminho);
          if (!resposta.ok) return resposta.erro;
          // O caderno aberto acabou de ser excluído: ficar nele mostraria
          // uma tela fantasma — parece que não apagou.
          if (alvo.nome === nomeAtivo) roteador.push("/");
          atualizar();
          return null;
        }}
      />
    </div>
  );
}

function ChipCaderno({
  caderno,
  ativo,
  aoAgir,
}: {
  caderno: Caderno;
  ativo: boolean;
  aoAgir: (acao: Acao) => void;
}) {
  const roteador = useRouter();
  // Abrir o caderno leva pra primeira seção dele — se ainda não tiver
  // nenhuma, cai na tela do próprio caderno, que já convida a criar uma.
  const endereco = urlDaSecao(caderno.secoes[0]?.caminho ?? caderno.caminho);

  return (
    <div
      className={clsx(
        "group flex shrink-0 items-center gap-1 rounded-lg pr-1 transition-colors",
        ativo ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      <Link href={endereco} className="flex items-center gap-1.5 py-1.5 pl-2.5">
        <span className="text-[14px] leading-none" aria-hidden>
          {caderno.icone}
        </span>
        <span className={clsx("text-[12.5px] whitespace-nowrap", ativo ? "font-medium text-tinta" : "text-tinta-2")}>
          {caderno.nome}
        </span>
      </Link>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu
          gatilho={(abrir) => (
            <BotaoIcone rotulo={`Opções de ${caderno.nome}`} onClick={abrir} className="size-6">
              <MoreHorizontal size={14} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<Pencil size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "renomear", caderno });
                }}
              >
                Renomear
              </ItemMenu>
              <ItemMenu
                icone={<Download size={14} />}
                onClick={async () => {
                  fechar();
                  await baixarCaderno(caderno.caminho);
                }}
              >
                Exportar em markdown
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Smile size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "icone", caderno });
                }}
              >
                Ícone do caderno
              </ItemMenu>
              <ItemMenu
                icone={<Palette size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "cor", caderno });
                }}
              >
                Cor do caderno
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<ArrowUp size={14} />}
                onClick={async () => {
                  fechar();
                  await acaoReordenar(caderno.caminho, -1, "pasta");
                  roteador.refresh();
                }}
              >
                Mover para a esquerda
              </ItemMenu>
              <ItemMenu
                icone={<ArrowDown size={14} />}
                onClick={async () => {
                  fechar();
                  await acaoReordenar(caderno.caminho, 1, "pasta");
                  roteador.refresh();
                }}
              >
                Mover para a direita
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Trash2 size={14} />}
                perigo
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "excluir", caderno });
                }}
              >
                Excluir
              </ItemMenu>
            </>
          )}
        </Menu>
      </div>
    </div>
  );
}
