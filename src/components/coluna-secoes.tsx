"use client";

import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  Download,
  FilePlus2,
  GitBranch,
  House,
  LayoutTemplate,
  ListChecks,
  MoreHorizontal,
  MoveRight,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  PocketKnife,
  Plus,
  Search,
  Tag,
  Trash2,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import {
  acaoAbrirNotaDoDia,
  acaoCapturaRapida,
  acaoCriarSecao,
  acaoExcluir,
  acaoExportarSecao,
  acaoExportarTudo,
  acaoMover,
  acaoRenomear,
  acaoReordenar,
  acaoReordenarSecoesPara,
} from "@/app/acoes";
import {
  calcularNovaOrdem,
  iniciarArrastoDeSecao,
  lerCaminhoDePagina,
  lerCaminhoDeSecao,
  trazPagina,
  trazSecao,
} from "@/lib/arrastar";
import { useColunas } from "@/lib/colunas";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import { urlDaNota, urlDaSecao } from "@/lib/rotas";
import type { Caderno, Etiqueta, Modelo, Secao } from "@/lib/tipos";

import { DialogoConfirmar, DialogoMover, DialogoNome } from "./dialogos";
import { DialogoNovaPagina } from "./dialogo-nova-pagina";
import { PaletaBusca } from "./paleta-busca";
import { AlcaRedimensionar, BotaoIcone, ItemMenu, Menu, SeparadorMenu } from "./ui";

type Alvo = { caminho: string; nome: string };
type Acao = {
  tipo: "nova-secao" | "nova-pagina" | "renomear" | "mover" | "excluir";
  alvo: Alvo;
} | null;

/**
 * Onde um item arrastado ficaria se soltasse agora — pra desenhar o
 * indicador certo: uma linha de encaixe (`tipo: "secao"`, reordena entre
 * seções) ou a seção inteira destacada (`tipo: "pagina"`, ela vira o novo
 * lar da página largada em cima).
 */
type Sobrevoo = { caminho: string; antes: boolean; tipo: "secao" | "pagina" } | null;

/** Monta o arquivo no servidor e entrega ao navegador como download. */
async function baixarSecao(caminho: string): Promise<void> {
  const { nome, conteudo } = await acaoExportarSecao(caminho);
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

/** Monta o vault inteiro num único arquivo no servidor e entrega ao navegador como download. */
async function baixarTudo(): Promise<void> {
  const { nome, conteudo } = await acaoExportarTudo();
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

/**
 * A coluna de navegação: sempre visível (busca, captura rápida, tema e os
 * atalhos fixos no rodapé), com as seções do caderno aberto no meio quando
 * houver um. Substitui a antiga barra lateral inteira — não há mais uma
 * coluna à parte só para essas ações.
 */
export function ColunaSecoes({
  caderno,
  cadernos,
  etiquetas,
  modelos,
}: {
  /** O caderno aberto — cujas seções aparecem no meio da coluna. `null` fora de /secao, /nota e /kanban. */
  caderno: Caderno | null;
  /** Todos os cadernos — só para o diálogo "Mover para" oferecer os outros como destino. */
  cadernos: Caderno[];
  etiquetas: Etiqueta[];
  modelos: Modelo[];
}) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const [sobrevoo, definirSobrevoo] = useState<Sobrevoo>(null);
  const [buscaAberta, definirBuscaAberta] = useState(false);
  const [capturando, iniciarCaptura] = useTransition();
  const [indoParaHoje, iniciarIdaParaHoje] = useTransition();
  const [exportando, iniciarExportacao] = useTransition();
  const largura = useLarguraRedimensionavel("largura-coluna-secoes", {
    padrao: 220,
    minima: 170,
    maxima: 360,
  });
  const colunas = useColunas();
  const recolhida = colunas.recolhida("secoes");

  // Ordem local, para o arraste responder na hora — a ordem "de verdade"
  // (no índice, em disco) só chega de volta depois de um round-trip com o
  // servidor. Sincroniza de novo sempre que o caderno aberto muda, ou
  // quando a lista de seções dele muda por outro caminho (criar, excluir).
  const secoesDoCaderno = caderno?.secoes ?? [];
  const [ordemLocal, definirOrdemLocal] = useState(() => secoesDoCaderno.map((secao) => secao.caminho));
  useEffect(() => {
    definirOrdemLocal(secoesDoCaderno.map((secao) => secao.caminho));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caderno?.caminho, secoesDoCaderno.map((secao) => secao.caminho).join("|")]);

  const secoesOrdenadas = ordemLocal
    .map((caminho) => secoesDoCaderno.find((secao) => secao.caminho === caminho))
    .filter((secao): secao is Secao => Boolean(secao));

  const fechar = () => definirAcao(null);
  const alvo = acao?.alvo ?? null;

  function atualizar(): void {
    roteador.refresh();
  }

  /** A página aberta está dentro da seção prestes a ser excluída (ou movida)? */
  function estaDentroDoQueSeraExcluido(caminhoExcluido: string): boolean {
    const semPrefixo = decodeURIComponent(caminhoAtual).replace(/^\/(secao|nota)\//, "");
    if (semPrefixo === caminhoAtual) return false;
    return semPrefixo === caminhoExcluido || semPrefixo.startsWith(`${caminhoExcluido}/`);
  }

  /** Arrastou uma seção pra perto de outra — reordena as duas na hora, sem esperar o servidor. */
  function aoSoltarSecao(origem: string, alvoCaminho: string, antes: boolean) {
    definirSobrevoo(null);
    if (!caderno) return;
    const nova = calcularNovaOrdem(ordemLocal, origem, alvoCaminho, antes);
    if (!nova) return;
    definirOrdemLocal(nova);
    acaoReordenarSecoesPara(caderno.caminho, nova).then((resposta) => {
      if (!resposta.ok) atualizar();
    });
  }

  /** Arrastou uma página (de outra coluna) até aqui — muda ela pra esta seção. */
  async function aoSoltarPagina(origem: string, secaoAlvo: Secao) {
    definirSobrevoo(null);
    const resposta = await acaoMover(origem, secaoAlvo.caminho);
    if (!resposta.ok) return;
    // Só troca de tela se a página movida era a que estava aberta — mover
    // uma página qualquer não deveria puxar a pessoa pra longe do que ela
    // estava lendo.
    if (resposta.mensagem && decodeURIComponent(caminhoAtual) === `/nota/${origem}`) {
      roteador.push(urlDaNota(resposta.mensagem));
    } else {
      atualizar();
    }
  }

  useEffect(() => {
    function aoTeclar(evento: KeyboardEvent) {
      const combinando = evento.ctrlKey || evento.metaKey;
      if (combinando && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        definirBuscaAberta(true);
      }
      if (combinando && evento.shiftKey && evento.key.toLowerCase() === "n") {
        evento.preventDefault();
        iniciarCaptura(async () => {
          await acaoCapturaRapida();
        });
      }
      if (combinando && evento.shiftKey && evento.key.toLowerCase() === "d") {
        evento.preventDefault();
        iniciarIdaParaHoje(async () => {
          await acaoAbrirNotaDoDia();
        });
      }
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, []);

  if (recolhida) {
    return (
      <div className="flex w-10 shrink-0 flex-col items-center gap-2 border-r border-linha bg-superficie pt-3">
        <BotaoIcone rotulo="Mostrar seções e atalhos" onClick={() => colunas.alternar("secoes")}>
          <PanelLeftOpen size={15} />
        </BotaoIcone>
      </div>
    );
  }

  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden border-r border-linha bg-superficie"
      style={{ width: largura.largura }}
    >
      <div className="flex items-center gap-2 px-3.5 py-3">
        <Link href="/" className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className="transicao-realce flex size-7 shrink-0 items-center justify-center rounded-lg text-[14px] text-white"
            style={{ background: "var(--realce)" }}
            aria-hidden
          >
            <NotebookPen size={15} />
          </span>
          <span className="truncate text-[13.5px] font-bold tracking-[-0.01em]">
            Meu bloco de anotações
          </span>
        </Link>
        <BotaoIcone rotulo="Recolher seções" onClick={() => colunas.alternar("secoes")}>
          <PanelLeftClose size={14} />
        </BotaoIcone>
      </div>

      <div className="px-2 pb-2">
        <BotaoDaBarra
          icone={<Search size={14} />}
          atalho="Ctrl K"
          onClick={() => definirBuscaAberta(true)}
        >
          Buscar
        </BotaoDaBarra>
        <BotaoDaBarra
          icone={<Zap size={14} />}
          atalho="Ctrl ⇧ N"
          disabled={capturando}
          onClick={() =>
            iniciarCaptura(async () => {
              await acaoCapturaRapida();
            })
          }
        >
          Captura rápida
        </BotaoDaBarra>
      </div>

      <div className="mx-3 h-px bg-linha" />

      {caderno ? (
        <>
          <div className="flex items-center justify-between px-3.5 pt-3 pb-1.5">
            <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">Seções</span>
            <div className="flex items-center gap-0.5">
              <BotaoIcone
                rotulo={`Nova seção em ${caderno.nome}`}
                onClick={() =>
                  definirAcao({ tipo: "nova-secao", alvo: { caminho: caderno.caminho, nome: caderno.nome } })
                }
              >
                <Plus size={14} />
              </BotaoIcone>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label={`Seções de ${caderno.nome}`}>
            {secoesOrdenadas.length === 0 ? (
              <p className="px-2 py-3 text-[12px] leading-relaxed text-tinta-3">
                Nenhuma seção ainda. Use o “+” acima para criar a primeira.
              </p>
            ) : (
              secoesOrdenadas.map((secao) => (
                <LinhaSecao
                  key={secao.caminho}
                  caderno={caderno}
                  secao={secao}
                  caminhoAtual={caminhoAtual}
                  aoAgir={definirAcao}
                  sobrevoo={sobrevoo?.caminho === secao.caminho ? sobrevoo : null}
                  aoPassarPorCima={(antes, tipo) => definirSobrevoo({ caminho: secao.caminho, antes, tipo })}
                  aoSairDeCima={() => definirSobrevoo((atual) => (atual?.caminho === secao.caminho ? null : atual))}
                  aoSoltarSecao={(origem, antes) => aoSoltarSecao(origem, secao.caminho, antes)}
                  aoSoltarPagina={(origem) => aoSoltarPagina(origem, secao)}
                />
              ))
            )}
          </nav>

          <div className="mx-3 h-px bg-linha" />
        </>
      ) : (
        <div className="min-h-0 flex-1" />
      )}

      <nav className="shrink-0 overflow-y-auto p-2" aria-label="Atalhos">
        <Atalho href="/" icone={<House size={14} />} ativo={caminhoAtual === "/"}>
          Início
        </Atalho>
        <Atalho
          href="/etiquetas"
          icone={<Tag size={14} />}
          ativo={caminhoAtual.startsWith("/etiquetas")}
        >
          Etiquetas
        </Atalho>
        <Atalho
          href="/grafo"
          icone={<GitBranch size={14} />}
          ativo={caminhoAtual.startsWith("/grafo")}
        >
          Grafo
        </Atalho>
        <Atalho
          href="/tarefas"
          icone={<ListChecks size={14} />}
          ativo={caminhoAtual.startsWith("/tarefas")}
        >
          Tarefas
        </Atalho>
        <Atalho
          href="/modelos"
          icone={<LayoutTemplate size={14} />}
          ativo={caminhoAtual.startsWith("/modelos")}
        >
          Modelos
        </Atalho>
        <Atalho
          href="/clipper"
          icone={<PocketKnife size={14} />}
          ativo={caminhoAtual.startsWith("/clipper")}
        >
          Web Clipper
        </Atalho>
        <AtalhoBotao
          icone={<CalendarDays size={14} />}
          disabled={indoParaHoje}
          onClick={() =>
            iniciarIdaParaHoje(async () => {
              await acaoAbrirNotaDoDia();
            })
          }
        >
          Hoje
        </AtalhoBotao>
        <AtalhoBotao icone={<Download size={14} />} disabled={exportando} onClick={() => iniciarExportacao(baixarTudo)}>
          Exportar tudo
        </AtalhoBotao>
        <Atalho
          href="/lixeira"
          icone={<Trash2 size={14} />}
          ativo={caminhoAtual.startsWith("/lixeira")}
        >
          Lixeira
        </Atalho>
      </nav>

      <AlcaRedimensionar
        aoArrastar={largura.iniciarArraste}
        aoRestaurar={largura.restaurarPadrao}
        rotulo="Redimensionar a coluna de seções"
      />

      <DialogoNome
        aberto={acao?.tipo === "nova-secao"}
        titulo="Nova seção"
        descricao={alvo ? `Dentro de ${alvo.nome}` : undefined}
        rotulo="Nome da seção"
        textoBotao="Criar seção"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          if (!alvo) return null;
          const resposta = await acaoCriarSecao(alvo.caminho, nome);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoNome
        aberto={acao?.tipo === "renomear"}
        titulo="Renomear seção"
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

      <DialogoMover
        aberto={acao?.tipo === "mover"}
        tipo="secao"
        cadernos={cadernos}
        caminhoAtual={alvo?.caminho ?? ""}
        aoFechar={fechar}
        aoConfirmar={async (destino) => {
          if (!alvo || !caderno) return null;
          const resposta = await acaoMover(alvo.caminho, destino);
          if (resposta.ok) {
            atualizar();
            // A seção acabou de sair deste caderno: ficar nela mostraria uma
            // seção fantasma na coluna de quem já não é mais dono dela.
            if (estaDentroDoQueSeraExcluido(alvo.caminho)) roteador.push(urlDaSecao(destino));
          }
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmar
        aberto={acao?.tipo === "excluir"}
        titulo={`Excluir ${alvo?.nome ?? ""}?`}
        descricao="A seção e tudo que está dentro vão para a lixeira. Dá para restaurar depois."
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo || !caderno) return null;
          const resposta = await acaoExcluir(alvo.caminho);
          if (!resposta.ok) return resposta.erro;
          if (estaDentroDoQueSeraExcluido(alvo.caminho)) roteador.push(urlDaSecao(caderno.caminho));
          atualizar();
          return null;
        }}
      />

      <DialogoNovaPagina
        aberto={acao?.tipo === "nova-pagina"}
        pasta={alvo?.caminho ?? ""}
        nomeDaPasta={alvo?.nome ?? ""}
        modelos={modelos}
        aoFechar={fechar}
      />

      <PaletaBusca aberta={buscaAberta} aoFechar={() => definirBuscaAberta(false)} etiquetas={etiquetas} />
    </div>
  );
}

/** Linha clicável da coluna, com o atalho de teclado à direita. */
function BotaoDaBarra({
  icone,
  atalho,
  children,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icone: React.ReactNode;
  atalho?: string;
}) {
  return (
    <button
      type="button"
      {...resto}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[12.5px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta disabled:opacity-50"
    >
      <span className="text-tinta-3">{icone}</span>
      <span className="flex-1 truncate">{children}</span>
      {atalho ? <kbd className="font-mono text-[10px] text-tinta-3">{atalho}</kbd> : null}
    </button>
  );
}

function Atalho({
  href,
  icone,
  ativo,
  children,
}: {
  href: string;
  icone: React.ReactNode;
  ativo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-2.5 rounded-md px-2 py-[5px] text-[12.5px] transition-colors",
        ativo ? "bg-realce-medio font-medium text-tinta" : "text-tinta-2 hover:bg-realce-fraco",
      )}
    >
      <span className="text-tinta-3">{icone}</span>
      {children}
    </Link>
  );
}

/** Mesma cara do Atalho, mas dispara uma ação em vez de ir para um link fixo
 * — usado por "Hoje", cujo endereço depende da data e só se sabe no servidor. */
function AtalhoBotao({
  icone,
  disabled,
  onClick,
  children,
}: {
  icone: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left text-[12.5px] text-tinta-2 transition-colors hover:bg-realce-fraco hover:text-tinta disabled:opacity-50"
    >
      <span className="text-tinta-3">{icone}</span>
      {children}
    </button>
  );
}

/** Uma seção — sempre folha: nunca tem outra pasta dentro, só páginas. */
function LinhaSecao({
  caderno,
  secao,
  caminhoAtual,
  aoAgir,
  sobrevoo,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltarSecao,
  aoSoltarPagina,
}: {
  caderno: Caderno;
  secao: Secao;
  caminhoAtual: string;
  aoAgir: (acao: Acao) => void;
  sobrevoo: Sobrevoo;
  aoPassarPorCima: (antes: boolean, tipo: "secao" | "pagina") => void;
  aoSairDeCima: () => void;
  aoSoltarSecao: (origem: string, antes: boolean) => void;
  aoSoltarPagina: (origem: string) => void;
}) {
  const roteador = useRouter();
  const endereco = urlDaSecao(secao.caminho);
  const ativa =
    caminhoAtual === endereco ||
    decodeURIComponent(caminhoAtual).startsWith(`/nota/${secao.caminho}/`);
  const alvo: Alvo = { caminho: secao.caminho, nome: secao.nome };

  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDeSecao(evento, secao.caminho)}
      onDragOver={(evento) => {
        if (!trazSecao(evento) && !trazPagina(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        if (trazSecao(evento)) {
          const retangulo = evento.currentTarget.getBoundingClientRect();
          aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2, "secao");
        } else {
          aoPassarPorCima(false, "pagina");
        }
      }}
      onDragLeave={aoSairDeCima}
      onDrop={(evento) => {
        if (trazSecao(evento)) {
          evento.preventDefault();
          // Recalcula na hora em vez de confiar no `sobrevoo` guardado pelo
          // último `dragover`: como aquele valor só chega numa próxima
          // renderização, um drop rápido logo depois de entrar na linha
          // podia pegar o fechamento (closure) de antes do estado atualizar.
          const retangulo = evento.currentTarget.getBoundingClientRect();
          const antes = evento.clientY < retangulo.top + retangulo.height / 2;
          aoSoltarSecao(lerCaminhoDeSecao(evento), antes);
        } else if (trazPagina(evento)) {
          evento.preventDefault();
          aoSoltarPagina(lerCaminhoDePagina(evento));
        }
      }}
      className={clsx(
        "group relative flex cursor-grab items-center gap-0.5 rounded-md pr-1 transition-colors active:cursor-grabbing",
        ativa || sobrevoo?.tipo === "pagina" ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      {ativa ? (
        <span
          className="barra-ativa absolute top-1 bottom-1 left-0 w-[2.5px] rounded-full"
          style={{ background: caderno.cor }}
          aria-hidden
        />
      ) : null}

      {sobrevoo?.tipo === "secao" ? (
        <span
          className="pointer-events-none absolute inset-x-2 h-0.5 rounded-full"
          style={{ background: "var(--realce)", [sobrevoo.antes ? "top" : "bottom"]: 0 }}
          aria-hidden
        />
      ) : null}

      <Link href={endereco} className="flex min-w-0 flex-1 items-center gap-2 py-[5px] pl-2.5">
        <span
          className="size-1.5 shrink-0 rounded-full opacity-60"
          style={{ background: caderno.cor }}
          aria-hidden
        />
        <span className={clsx("truncate text-[12.5px]", ativa ? "font-medium text-tinta" : "text-tinta-2")}>
          {secao.nome}
        </span>
        {secao.quantidadePaginas > 0 ? (
          <span className="ml-auto shrink-0 pl-1 text-[10.5px] text-tinta-3 tabular-nums transition-opacity group-hover:opacity-0">
            {secao.quantidadePaginas}
          </span>
        ) : null}
      </Link>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <BotaoIcone
          rotulo={`Nova página em ${secao.nome}`}
          onClick={() => aoAgir({ tipo: "nova-pagina", alvo })}
          className="size-6"
        >
          <Plus size={13} />
        </BotaoIcone>

        <Menu
          gatilho={(abrir) => (
            <BotaoIcone rotulo={`Opções de ${secao.nome}`} onClick={abrir} className="size-6">
              <MoreHorizontal size={14} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<FilePlus2 size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "nova-pagina", alvo });
                }}
              >
                Nova página
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Pencil size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "renomear", alvo });
                }}
              >
                Renomear
              </ItemMenu>
              <ItemMenu
                icone={<MoveRight size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "mover", alvo });
                }}
              >
                Mover para…
              </ItemMenu>
              <ItemMenu
                icone={<Download size={14} />}
                onClick={async () => {
                  fechar();
                  await baixarSecao(secao.caminho);
                }}
              >
                Exportar em markdown
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<ArrowUp size={14} />}
                onClick={async () => {
                  fechar();
                  await acaoReordenar(secao.caminho, -1, "pasta");
                  roteador.refresh();
                }}
              >
                Subir
              </ItemMenu>
              <ItemMenu
                icone={<ArrowDown size={14} />}
                onClick={async () => {
                  fechar();
                  await acaoReordenar(secao.caminho, 1, "pasta");
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
                  aoAgir({ tipo: "excluir", alvo });
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
