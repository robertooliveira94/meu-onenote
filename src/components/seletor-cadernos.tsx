"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, Download, MoreHorizontal, Palette, Pencil, Plus, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  acaoCriarCaderno,
  acaoDefinirCorCaderno,
  acaoDefinirIconeCaderno,
  acaoExcluir,
  acaoExportarSecao,
  acaoMover,
  acaoRenomear,
  acaoReordenar,
  acaoReordenarCadernosPara,
} from "@/app/acoes";
import {
  calcularNovaOrdem,
  iniciarArrastoDeCaderno,
  lerCaminhoDeSecao,
  lerNomeDeCaderno,
  trazCaderno,
  trazSecao,
} from "@/lib/arrastar";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import { cadernoDaUrl, urlDaSecao } from "@/lib/rotas";
import type { Caderno } from "@/lib/tipos";

import { DialogoConfirmarComTexto, DialogoCor, DialogoIcone, DialogoNome } from "./dialogos";
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
 * A lista de cadernos da aplicação Anotações, na coluna da esquerda. Ao
 * contrário de seção e página, um caderno nunca fica aninhado dentro de
 * outra coisa (é sempre o topo), então aqui não tem árvore nenhuma: só a
 * lista, e as seções do caderno aberto aparecem na coluna ao lado.
 */
export function SeletorDeCadernos({ cadernos }: { cadernos: Caderno[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const [criando, definirCriando] = useState(false);

  const nomeAtivo = cadernoDaUrl(caminhoAtual);
  const fechar = () => definirAcao(null);
  const alvo = acao?.caderno ?? null;

  // Ordem local, para o arraste responder na hora — mesmo padrão das seções
  // e páginas: a ordem "de verdade" só volta depois de um round-trip com o
  // servidor.
  const [ordemLocal, definirOrdemLocal] = useState(() => cadernos.map((caderno) => caderno.caminho));
  const [sobrevoo, definirSobrevoo] = useState<{ caminho: string; antes: boolean } | null>(null);
  useEffect(() => {
    definirOrdemLocal(cadernos.map((caderno) => caderno.caminho));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cadernos.map((caderno) => caderno.caminho).join("|")]);

  const cadernosOrdenados = ordemLocal
    .map((caminho) => cadernos.find((caderno) => caderno.caminho === caminho))
    .filter((caderno): caderno is Caderno => Boolean(caderno));

  function atualizar(): void {
    roteador.refresh();
  }

  function aoSoltarCaderno(origem: string, alvoCaminho: string, antes: boolean) {
    definirSobrevoo(null);
    const nova = calcularNovaOrdem(ordemLocal, origem, alvoCaminho, antes);
    if (!nova) return;
    definirOrdemLocal(nova);
    acaoReordenarCadernosPara(nova).then((resposta) => {
      if (!resposta.ok) atualizar();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">Cadernos</span>
        <BotaoIcone rotulo="Novo caderno" onClick={() => definirCriando(true)} className="size-6">
          <Plus size={13} />
        </BotaoIcone>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" aria-label="Cadernos">
        {cadernosOrdenados.length === 0 ? (
          <p className="px-2 py-3 text-[11.5px] leading-relaxed text-tinta-3">
            Nenhum caderno ainda. Use o “+” acima para criar o primeiro.
          </p>
        ) : (
          cadernosOrdenados.map((caderno) => (
            <LinhaCaderno
              key={caderno.caminho}
              caderno={caderno}
              ativo={caderno.nome === nomeAtivo}
              aoAgir={definirAcao}
              sobrevoo={sobrevoo?.caminho === caderno.caminho ? sobrevoo : null}
              aoPassarPorCima={(antes) => definirSobrevoo({ caminho: caderno.caminho, antes })}
              aoSairDeCima={() => definirSobrevoo((atual) => (atual?.caminho === caderno.caminho ? null : atual))}
              aoSoltarCaderno={(origem, antes) => aoSoltarCaderno(origem, caderno.caminho, antes)}
            />
          ))
        )}
      </nav>

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

      <DialogoConfirmarComTexto
        aberto={acao?.tipo === "excluir"}
        titulo={`Excluir o caderno ${alvo?.nome ?? ""}?`}
        descricao="O caderno e tudo que está dentro (seções e páginas) vão para a lixeira, dá para restaurar depois. Um quadro de mesmo nome no Kanban não é afetado."
        palavra={alvo?.nome ?? ""}
        rotulo={
          <>
            Digite <span className="font-mono text-tinta">{alvo?.nome}</span> para confirmar
          </>
        }
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
    </>
  );
}

function LinhaCaderno({
  caderno,
  ativo,
  aoAgir,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltarCaderno,
}: {
  caderno: Caderno;
  ativo: boolean;
  aoAgir: (acao: Acao) => void;
  sobrevoo: { caminho: string; antes: boolean } | null;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltarCaderno: (origem: string, antes: boolean) => void;
}) {
  const roteador = useRouter();
  const caminhoAtual = usePathname();
  const [sobrevooDeSecao, definirSobrevooDeSecao] = useState(false);
  // Abrir o caderno leva pra primeira seção dele — se ainda não tiver
  // nenhuma, cai na tela do próprio caderno, que já convida a criar uma.
  const endereco = urlDaSecao(caderno.secoes[0]?.caminho ?? caderno.caminho);

  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeCaderno(evento, caderno.caminho)}
      onDragOver={(evento) => {
        if (trazCaderno(evento)) {
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
          const retangulo = evento.currentTarget.getBoundingClientRect();
          aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2);
          return;
        }
        if (!trazSecao(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        definirSobrevooDeSecao(true);
      }}
      onDragLeave={() => {
        aoSairDeCima();
        definirSobrevooDeSecao(false);
      }}
      onDrop={async (evento) => {
        if (trazCaderno(evento)) {
          evento.preventDefault();
          const retangulo = evento.currentTarget.getBoundingClientRect();
          const antes = evento.clientY < retangulo.top + retangulo.height / 2;
          aoSoltarCaderno(lerNomeDeCaderno(evento), antes);
          return;
        }
        if (!trazSecao(evento)) return;
        evento.preventDefault();
        definirSobrevooDeSecao(false);
        const origem = lerCaminhoDeSecao(evento);
        if (!origem) return;
        const resposta = await acaoMover(origem, caderno.caminho);
        if (!resposta.ok) return;
        // A seção que estava aberta acabou de virar deste caderno: segue ela.
        if (resposta.mensagem && decodeURIComponent(caminhoAtual) === `/secao/${origem}`) {
          roteador.push(urlDaSecao(resposta.mensagem));
        } else {
          roteador.refresh();
        }
      }}
      className={clsx(
        "group relative flex cursor-grab items-center gap-0.5 rounded-lg pr-1 transition-colors active:cursor-grabbing",
        ativo || sobrevooDeSecao ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      {ativo ? (
        <span
          className="barra-ativa absolute top-1.5 bottom-1.5 left-0 w-[2.5px] rounded-full"
          style={{ background: caderno.cor }}
          aria-hidden
        />
      ) : null}

      {sobrevoo ? (
        <span
          className="pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full"
          style={{ background: "var(--realce)", [sobrevoo.antes ? "top" : "bottom"]: 0 }}
          aria-hidden
        />
      ) : null}

      <Link href={endereco} className="linha-nav flex min-w-0 flex-1 items-center gap-2 pl-2.5">
        <span className="text-[14px] leading-none" aria-hidden>
          {caderno.icone}
        </span>
        <span
          className={clsx("truncate text-[12.5px]", ativo ? "font-medium text-tinta" : "text-tinta-2")}
        >
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
                Subir
              </ItemMenu>
              <ItemMenu
                icone={<ArrowDown size={14} />}
                onClick={async () => {
                  fechar();
                  await acaoReordenar(caderno.caminho, 1, "pasta");
                  roteador.refresh();
                }}
              >
                Descer
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
