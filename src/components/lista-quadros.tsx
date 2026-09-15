"use client";

import clsx from "clsx";
import { ArrowDown, ArrowUp, MoreHorizontal, Palette, Pencil, Plus, Smile, Trash2 } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  acaoCriarQuadro,
  acaoDefinirCorQuadro,
  acaoDefinirIconeQuadro,
  acaoExcluirQuadro,
  acaoRenomearQuadro,
  acaoReordenarQuadrosPara,
} from "@/app/acoes-kanban";
import { calcularNovaOrdem, iniciarArrastoDeQuadro, lerNomeDeQuadro, trazQuadro } from "@/lib/arrastar";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import { quadroDaUrl, urlDoQuadro } from "@/lib/rotas";
import type { ResumoQuadro } from "@/lib/tipos";

import { DialogoConfirmar, DialogoCor, DialogoIcone, DialogoNome } from "./dialogos";
import { BotaoIcone, ItemMenu, Menu, SeparadorMenu } from "./ui";

type Acao = { tipo: "renomear" | "cor" | "icone" | "excluir"; quadro: ResumoQuadro } | null;

/**
 * A lista de quadros da aplicação Kanban, na coluna da esquerda — o
 * equivalente aos cadernos das anotações, e independente deles: excluir um
 * quadro aqui não mexe em nenhum caderno, mesmo que os dois tenham o mesmo
 * nome.
 */
export function ListaQuadros({ quadros }: { quadros: ResumoQuadro[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const [criando, definirCriando] = useState(false);

  const nomeAtivo = quadroDaUrl(caminhoAtual);
  const fechar = () => definirAcao(null);
  const alvo = acao?.quadro ?? null;

  // Ordem local, para o arraste responder na hora — mesmo padrão dos cadernos.
  const [ordemLocal, definirOrdemLocal] = useState(() => quadros.map((quadro) => quadro.nome));
  const [sobrevoo, definirSobrevoo] = useState<{ nome: string; antes: boolean } | null>(null);
  useEffect(() => {
    definirOrdemLocal(quadros.map((quadro) => quadro.nome));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quadros.map((quadro) => quadro.nome).join("|")]);

  const quadrosOrdenados = ordemLocal
    .map((nome) => quadros.find((quadro) => quadro.nome === nome))
    .filter((quadro): quadro is ResumoQuadro => Boolean(quadro));

  async function mover(nome: string, direcao: -1 | 1) {
    const posicao = ordemLocal.indexOf(nome);
    const destino = posicao + direcao;
    if (posicao < 0 || destino < 0 || destino >= ordemLocal.length) return;
    const nomes = [...ordemLocal];
    [nomes[posicao], nomes[destino]] = [nomes[destino], nomes[posicao]];
    definirOrdemLocal(nomes);
    const resposta = await acaoReordenarQuadrosPara(nomes);
    if (resposta.ok) roteador.refresh();
  }

  function aoSoltarQuadro(origem: string, alvoNome: string, antes: boolean) {
    definirSobrevoo(null);
    const nova = calcularNovaOrdem(ordemLocal, origem, alvoNome, antes);
    if (!nova) return;
    definirOrdemLocal(nova);
    acaoReordenarQuadrosPara(nova).then((resposta) => {
      if (resposta.ok) roteador.refresh();
    });
  }

  return (
    <>
      <div className="flex items-center justify-between px-3 pt-1 pb-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">Quadros</span>
        <BotaoIcone rotulo="Novo quadro" onClick={() => definirCriando(true)} className="size-6">
          <Plus size={13} />
        </BotaoIcone>
      </div>

      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2" aria-label="Quadros">
        {quadrosOrdenados.length === 0 ? (
          <p className="px-2 py-3 text-[11.5px] leading-relaxed text-tinta-3">
            Nenhum quadro ainda. Use o “+” acima para criar o primeiro.
          </p>
        ) : (
          quadrosOrdenados.map((quadro) => (
            <LinhaQuadro
              key={quadro.caminho}
              quadro={quadro}
              ativo={quadro.nome === nomeAtivo}
              aoAgir={definirAcao}
              aoMover={mover}
              sobrevoo={sobrevoo?.nome === quadro.nome ? sobrevoo : null}
              aoPassarPorCima={(antes) => definirSobrevoo({ nome: quadro.nome, antes })}
              aoSairDeCima={() => definirSobrevoo((atual) => (atual?.nome === quadro.nome ? null : atual))}
              aoSoltarQuadro={(origem, antes) => aoSoltarQuadro(origem, quadro.nome, antes)}
            />
          ))
        )}
      </nav>

      <DialogoNome
        aberto={criando}
        titulo="Novo quadro"
        descricao="Nasce com as colunas Backlog, Fazendo, Impedido e Feito — dá para mudar depois."
        rotulo="Nome do quadro"
        textoBotao="Criar quadro"
        aoFechar={() => definirCriando(false)}
        aoConfirmar={async (nome) => {
          const resposta = await acaoCriarQuadro(nome);
          if (!resposta.ok) return resposta.erro;
          roteador.push(urlDoQuadro(resposta.mensagem ?? nome));
          roteador.refresh();
          return null;
        }}
      />

      <DialogoNome
        aberto={acao?.tipo === "renomear"}
        titulo="Renomear quadro"
        descricao="A pasta é renomeada no disco junto."
        rotulo="Novo nome"
        valorInicial={alvo?.nome ?? ""}
        textoBotao="Renomear"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          if (!alvo) return null;
          const resposta = await acaoRenomearQuadro(alvo.nome, nome);
          if (!resposta.ok) return resposta.erro;
          // O endereço tem o nome do quadro: sem trocar, a tela aberta
          // apontaria para um quadro que não existe mais.
          if (alvo.nome === nomeAtivo) roteador.push(urlDoQuadro(resposta.mensagem ?? nome));
          roteador.refresh();
          return null;
        }}
      />

      <DialogoIcone
        aberto={acao?.tipo === "icone"}
        icones={ICONES_DISPONIVEIS}
        iconeAtual={alvo?.icone ?? ""}
        aoFechar={fechar}
        aoEscolher={async (icone) => {
          if (!alvo) return null;
          const resposta = await acaoDefinirIconeQuadro(alvo.nome, icone);
          if (resposta.ok) roteador.refresh();
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
          const resposta = await acaoDefinirCorQuadro(alvo.nome, cor);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={acao?.tipo === "excluir"}
        titulo={`Excluir o quadro ${alvo?.nome ?? ""}?`}
        descricao="O quadro e as tarefas dele vão para a lixeira, dá para restaurar depois. Um caderno de mesmo nome nas anotações não é afetado."
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo) return null;
          const resposta = await acaoExcluirQuadro(alvo.nome);
          if (!resposta.ok) return resposta.erro;
          if (alvo.nome === nomeAtivo) roteador.push("/kanban");
          roteador.refresh();
          return null;
        }}
      />
    </>
  );
}

function LinhaQuadro({
  quadro,
  ativo,
  aoAgir,
  aoMover,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltarQuadro,
}: {
  quadro: ResumoQuadro;
  ativo: boolean;
  aoAgir: (acao: Acao) => void;
  aoMover: (nome: string, direcao: -1 | 1) => void;
  sobrevoo: { nome: string; antes: boolean } | null;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltarQuadro: (origem: string, antes: boolean) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeQuadro(evento, quadro.nome)}
      onDragOver={(evento) => {
        if (!trazQuadro(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const retangulo = evento.currentTarget.getBoundingClientRect();
        aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2);
      }}
      onDragLeave={aoSairDeCima}
      onDrop={(evento) => {
        if (!trazQuadro(evento)) return;
        evento.preventDefault();
        const retangulo = evento.currentTarget.getBoundingClientRect();
        const antes = evento.clientY < retangulo.top + retangulo.height / 2;
        aoSoltarQuadro(lerNomeDeQuadro(evento), antes);
      }}
      className={clsx(
        "group relative flex cursor-grab items-center gap-0.5 rounded-lg pr-1 transition-colors active:cursor-grabbing",
        ativo ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      {ativo ? (
        <span
          className="barra-ativa absolute top-1.5 bottom-1.5 left-0 w-[2.5px] rounded-full"
          style={{ background: quadro.cor }}
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

      <Link href={urlDoQuadro(quadro.nome)} className="linha-nav flex min-w-0 flex-1 items-center gap-2 pl-2.5">
        <span className="text-[14px] leading-none" aria-hidden>
          {quadro.icone}
        </span>
        <span className={clsx("truncate text-[12.5px]", ativo ? "font-medium text-tinta" : "text-tinta-2")}>
          {quadro.nome}
        </span>
        {quadro.quantidadeTarefas > 0 ? (
          <span className="ml-auto shrink-0 pl-1 text-[10.5px] text-tinta-3 tabular-nums transition-opacity group-hover:opacity-0">
            {quadro.quantidadeTarefas}
          </span>
        ) : null}
      </Link>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu
          gatilho={(abrir) => (
            <BotaoIcone rotulo={`Opções de ${quadro.nome}`} onClick={abrir} className="size-6">
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
                  aoAgir({ tipo: "renomear", quadro });
                }}
              >
                Renomear
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Smile size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "icone", quadro });
                }}
              >
                Ícone do quadro
              </ItemMenu>
              <ItemMenu
                icone={<Palette size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "cor", quadro });
                }}
              >
                Cor do quadro
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<ArrowUp size={14} />}
                onClick={() => {
                  fechar();
                  aoMover(quadro.nome, -1);
                }}
              >
                Subir
              </ItemMenu>
              <ItemMenu
                icone={<ArrowDown size={14} />}
                onClick={() => {
                  fechar();
                  aoMover(quadro.nome, 1);
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
                  aoAgir({ tipo: "excluir", quadro });
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
