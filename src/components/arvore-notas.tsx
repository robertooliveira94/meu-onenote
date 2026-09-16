"use client";

import clsx from "clsx";
import {
  AppWindow,
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  ChevronRight,
  Download,
  FilePlus2,
  LayoutTemplate,
  MoreHorizontal,
  MoveRight,
  Palette,
  Pencil,
  Pin,
  Plus,
  Smile,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  acaoAlternarFavorita,
  acaoAlternarFixada,
  acaoConverterFormato,
  acaoCriarCaderno,
  acaoCriarPagina,
  acaoCriarPaginaFlutuante,
  acaoCriarSecao,
  acaoDefinirCorCaderno,
  acaoDefinirIconeCaderno,
  acaoDestinoAposExcluir,
  acaoExcluir,
  acaoExportarSecao,
  acaoListarNotas,
  acaoMover,
  acaoRenomear,
  acaoReordenar,
  acaoReordenarCadernosPara,
  acaoReordenarNotasPara,
  acaoReordenarSecoesPara,
} from "@/app/acoes";
import {
  calcularNovaOrdem,
  iniciarArrastoDeCaderno,
  iniciarArrastoDePagina,
  iniciarArrastoDeSecao,
  lerCaminhoDePagina,
  lerCaminhoDeSecao,
  lerNomeDeCaderno,
  trazCaderno,
  trazPagina,
  trazSecao,
} from "@/lib/arrastar";
import { useAbas } from "@/lib/abas";
import { useAtalho } from "@/lib/atalhos";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import { abrirJanelaFlutuante } from "@/lib/janela-flutuante";
import { formatarDataCurta, urlDaNota, urlDaNotaFlutuante, urlDaSecao } from "@/lib/rotas";
import type { Caderno, Modelo, ResumoNota, Secao } from "@/lib/tipos";

import { DialogoConfirmar, DialogoConfirmarComTexto, DialogoCor, DialogoIcone, DialogoMover, DialogoNome } from "./dialogos";
import { DialogoModeloDePagina } from "./dialogo-nova-pagina";
import { BotaoIcone, ItemMenu, Menu, SeparadorMenu } from "./ui";

const CHAVE_ABERTOS = "arvore-aberta";

type Nivel = "caderno" | "secao" | "pagina";
type Alvo = { nivel: Nivel; caminho: string; nome: string; formato?: string; favorita?: boolean };
type Acao =
  | { tipo: "novo-caderno" }
  | { tipo: "nova-secao" | "modelo" | "renomear" | "mover" | "excluir" | "cor" | "icone"; alvo: Alvo }
  | null;

/**
 * Onde o item arrastado cairia: uma linha de encaixe entre irmãos
 * (`encaixe`) ou o alvo inteiro destacado, quando soltar ali muda de dono.
 */
type Sobrevoo = { caminho: string; antes: boolean; modo: "encaixe" | "dentro" } | null;

/** Monta o arquivo no servidor e entrega ao navegador como download. */
async function baixarPasta(caminho: string): Promise<void> {
  const { nome, conteudo } = await acaoExportarSecao(caminho);
  const endereco = URL.createObjectURL(new Blob([conteudo], { type: "text/markdown" }));
  const link = document.createElement("a");
  link.href = endereco;
  link.download = nome;
  link.click();
  URL.revokeObjectURL(endereco);
}

/** O caderno e a seção que a URL aberta indica — a trilha que a árvore abre sozinha. */
function trilhaDaUrl(caminhoAtual: string): { caderno: string | null; secao: string | null } {
  const cru = decodeURIComponent(caminhoAtual);
  const resto = cru.startsWith("/nota/")
    ? cru.slice(6)
    : cru.startsWith("/secao/")
      ? cru.slice(7)
      : null;
  if (!resto) return { caderno: null, secao: null };
  const partes = resto.split("/");
  return {
    caderno: partes[0] ?? null,
    // Em /secao/Caderno (caderno sem seção nenhuma) não há seção na URL.
    secao: partes.length >= 2 ? `${partes[0]}/${partes[1]}` : null,
  };
}

/**
 * A navegação inteira de Anotações numa árvore só: cadernos, as seções de
 * cada um e as páginas de cada seção.
 *
 * Antes eram três lugares diferentes — a lista de cadernos, a coluna de
 * seções e uma coluna à parte com as páginas em cartões. Isso custava quase
 * 600px de moldura antes da nota e mostrava cinco páginas por tela. Aqui a
 * hierarquia inteira mora numa coluna só, em linhas: dá pra ver o caderno, a
 * seção e a página ao mesmo tempo, com mais de uma seção aberta, e sobra
 * tela pro texto.
 *
 * As páginas de uma seção só são buscadas quando ela é aberta
 * (`acaoListarNotas`) — um layout do App Router não re-renderiza quando só o
 * segmento filho muda, então elas não podem vir por props da casca.
 */
export function ArvoreNotas({ cadernos, modelos }: { cadernos: Caderno[]; modelos: Modelo[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const [sobrevoo, definirSobrevoo] = useState<Sobrevoo>(null);
  const [, iniciarCriacaoDePagina] = useTransition();
  const abas = useAbas();

  const trilha = trilhaDaUrl(caminhoAtual);

  // Quem está aberto na árvore. Começa pela trilha da URL para a primeira
  // pintura já mostrar onde a pessoa está; o que ela tinha aberto antes
  // entra logo depois, na montagem (localStorage não existe no servidor).
  const [abertos, definirAbertos] = useState<Set<string>>(() => {
    const inicial = new Set<string>();
    if (trilha.caderno) inicial.add(trilha.caderno);
    if (trilha.secao) inicial.add(trilha.secao);
    return inicial;
  });
  const montado = useRef(false);
  // Mesma proteção do provedor de abas: o efeito de gravar roda no mesmo
  // ciclo do de restaurar, e não pode escrever a trilha inicial por cima
  // do que estava guardado.
  const estadoInicial = useRef(abertos);

  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_ABERTOS);
      if (bruto) {
        const lidos = JSON.parse(bruto) as unknown;
        if (Array.isArray(lidos)) {
          definirAbertos((atual) => {
            const proximo = new Set(atual);
            for (const item of lidos) if (typeof item === "string") proximo.add(item);
            return proximo;
          });
        }
      }
    } catch {
      // Sem armazenamento: a árvore abre só a trilha da URL.
    }
    montado.current = true;
  }, []);

  useEffect(() => {
    if (!montado.current || abertos === estadoInicial.current) return;
    try {
      localStorage.setItem(CHAVE_ABERTOS, JSON.stringify([...abertos]));
    } catch {
      // Sem armazenamento: vale só para esta sessão.
    }
  }, [abertos]);

  // A trilha da URL abre sozinha — criar uma página por atalho, ou cair numa
  // nota vinda da paleta, não pode deixar a árvore fechada em cima dela.
  useEffect(() => {
    definirAbertos((atual) => {
      const faltando = [trilha.caderno, trilha.secao].filter(
        (item): item is string => Boolean(item) && !atual.has(item as string),
      );
      if (faltando.length === 0) return atual;
      const proximo = new Set(atual);
      for (const item of faltando) proximo.add(item);
      return proximo;
    });
  }, [trilha.caderno, trilha.secao]);

  function alternar(caminho: string): void {
    definirAbertos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(caminho)) proximo.delete(caminho);
      else proximo.add(caminho);
      return proximo;
    });
  }

  // ------------------------------------------------ páginas sob demanda
  const [paginas, definirPaginas] = useState<Record<string, ResumoNota[]>>({});
  const pedidas = useRef(new Set<string>());
  const [recarga, definirRecarga] = useState(0);

  /** Marca as páginas de uma seção (ou de todas) como velhas e busca de novo. */
  const invalidar = useCallback((secao?: string) => {
    if (secao) pedidas.current.delete(secao);
    else pedidas.current.clear();
    definirRecarga((numero) => numero + 1);
  }, []);

  const secoesAbertas = useMemo(
    () => [...abertos].filter((caminho) => caminho.includes("/")),
    [abertos],
  );

  useEffect(() => {
    for (const secao of secoesAbertas) {
      if (pedidas.current.has(secao)) continue;
      pedidas.current.add(secao);
      acaoListarNotas(secao)
        .then((notas) => definirPaginas((atual) => ({ ...atual, [secao]: notas })))
        .catch(() => pedidas.current.delete(secao));
    }
  }, [secoesAbertas, recarga]);

  // Mudou de página: a seção dela pode ter ganhado, perdido ou renomeado uma
  // página fora daqui (atalho, paleta, diálogo). Recarregar só ela é barato.
  useEffect(() => {
    if (trilha.secao) invalidar(trilha.secao);
  }, [caminhoAtual, trilha.secao, invalidar]);

  function atualizar(secao?: string): void {
    invalidar(secao);
    roteador.refresh();
  }

  // ------------------------------------------------ ordem local (arraste)
  // A ordem "de verdade" mora no índice e só volta depois de um round-trip;
  // estas listas deixam o arraste responder na hora. A chave é o pai:
  // "" para os cadernos, o caminho do caderno para as seções dele.
  const [ordens, definirOrdens] = useState<Record<string, string[]>>({});
  const assinatura = cadernos
    .map((caderno) => `${caderno.caminho}:${caderno.secoes.map((secao) => secao.caminho).join(",")}`)
    .join("|");
  useEffect(() => {
    definirOrdens({});
  }, [assinatura]);

  function ordenar<T>(chave: string, itens: T[], caminhoDe: (item: T) => string): T[] {
    const ordem = ordens[chave];
    if (!ordem) return itens;
    const achados = ordem
      .map((caminho) => itens.find((item) => caminhoDe(item) === caminho))
      .filter((item): item is T => Boolean(item));
    // Um item criado depois do arraste não está na ordem local: entra no fim.
    const novos = itens.filter((item) => !ordem.includes(caminhoDe(item)));
    return [...achados, ...novos];
  }

  const cadernosOrdenados = ordenar("", cadernos, (caderno) => caderno.caminho);

  function aoSoltarCaderno(origem: string, alvoCaminho: string, antes: boolean): void {
    definirSobrevoo(null);
    const atual = cadernosOrdenados.map((caderno) => caderno.caminho);
    const nova = calcularNovaOrdem(atual, origem, alvoCaminho, antes);
    if (!nova) return;
    definirOrdens((anteriores) => ({ ...anteriores, "": nova }));
    acaoReordenarCadernosPara(nova).then((resposta) => {
      if (!resposta.ok) atualizar();
    });
  }

  function aoSoltarSecao(caderno: Caderno, origem: string, alvoCaminho: string, antes: boolean): void {
    definirSobrevoo(null);
    if (!origem) return;
    // Seção vinda de outro caderno não reordena: ela muda de dono.
    if (!origem.startsWith(`${caderno.caminho}/`)) {
      void moverPara(origem, caderno.caminho, "secao");
      return;
    }
    const atual = ordenar(caderno.caminho, caderno.secoes, (secao) => secao.caminho).map(
      (secao) => secao.caminho,
    );
    const nova = calcularNovaOrdem(atual, origem, alvoCaminho, antes);
    if (!nova) return;
    definirOrdens((anteriores) => ({ ...anteriores, [caderno.caminho]: nova }));
    acaoReordenarSecoesPara(caderno.caminho, nova).then((resposta) => {
      if (!resposta.ok) atualizar();
    });
  }

  function aoSoltarPagina(secao: string, origem: string, alvoCaminho: string, antes: boolean): void {
    definirSobrevoo(null);
    if (!origem) return;
    // Página de outra seção: muda de seção em vez de reordenar.
    if (!origem.startsWith(`${secao}/`)) {
      void moverPara(origem, secao, "pagina");
      return;
    }
    const lista = paginas[secao] ?? [];
    const nova = calcularNovaOrdem(lista.map((nota) => nota.caminho), origem, alvoCaminho, antes);
    if (!nova) return;
    definirPaginas((atual) => ({
      ...atual,
      [secao]: nova
        .map((caminho) => lista.find((nota) => nota.caminho === caminho))
        .filter((nota): nota is ResumoNota => Boolean(nota)),
    }));
    acaoReordenarNotasPara(secao, nova).then((resposta) => {
      if (!resposta.ok) atualizar(secao);
    });
  }

  /** Solta um item dentro de outro dono (página numa seção, seção num caderno). */
  async function moverPara(origem: string, destino: string, nivel: "secao" | "pagina"): Promise<void> {
    definirSobrevoo(null);
    const paiAntigo = origem.slice(0, origem.lastIndexOf("/"));
    const resposta = await acaoMover(origem, destino);
    if (!resposta.ok) return;
    if (resposta.mensagem) abas.renomear(origem, resposta.mensagem);
    invalidar(paiAntigo);
    invalidar(destino);
    definirAbertos((atual) => new Set(atual).add(destino));
    const aberto = decodeURIComponent(caminhoAtual);
    const eraOAberto =
      nivel === "pagina" ? aberto === `/nota/${origem}` : aberto.startsWith(`/secao/${origem}`);
    // Só puxa a pessoa de tela se o que se moveu era justamente o que ela
    // estava lendo — mover outra coisa não deveria tirá-la do lugar.
    if (eraOAberto && resposta.mensagem) {
      roteador.push(nivel === "pagina" ? urlDaNota(resposta.mensagem) : urlDaSecao(resposta.mensagem));
    } else {
      roteador.refresh();
    }
  }

  // ------------------------------------------------ criar
  function criarPagina(secao: string): void {
    iniciarCriacaoDePagina(async () => {
      await acaoCriarPagina(secao);
    });
  }

  async function criarPaginaFlutuante(secao: string): Promise<void> {
    const resposta = await acaoCriarPaginaFlutuante(secao);
    if (resposta.ok && resposta.mensagem) {
      abrirJanelaFlutuante(urlDaNotaFlutuante(resposta.mensagem));
      invalidar(secao);
      roteador.refresh();
    }
  }

  const secaoParaNova = trilha.secao ?? secoesAbertas[0] ?? null;
  useAtalho("n", {
    grupo: "Anotações",
    descricao: secaoParaNova ? `Nova página em ${secaoParaNova.split("/").pop()}` : "Nova página",
    ativo: Boolean(secaoParaNova),
    acao: () => secaoParaNova && criarPagina(secaoParaNova),
  });

  const fechar = () => definirAcao(null);
  const alvo = acao && "alvo" in acao ? acao.alvo : null;
  const cadernoDoAlvo = alvo ? cadernos.find((item) => item.caminho === alvo.caminho) : undefined;

  /** A tela aberta está dentro do que vai ser excluído/movido? */
  function estaDentroDe(caminho: string): boolean {
    const cru = decodeURIComponent(caminhoAtual);
    const resto = cru.startsWith("/nota/") ? cru.slice(6) : cru.startsWith("/secao/") ? cru.slice(7) : null;
    if (!resto) return false;
    return resto === caminho || resto.startsWith(`${caminho}/`);
  }

  return (
    <>
      <div className="flex items-center justify-between px-3.5 pt-2 pb-1">
        <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">Cadernos</span>
        <BotaoIcone rotulo="Novo caderno" onClick={() => definirAcao({ tipo: "novo-caderno" })} className="size-6">
          <Plus size={13} />
        </BotaoIcone>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Cadernos, seções e páginas">
        {cadernosOrdenados.length === 0 ? (
          <p className="px-2 py-3 text-[11.5px] leading-relaxed text-tinta-3">
            Nenhum caderno ainda. Use o “+” acima para criar o primeiro.
          </p>
        ) : null}

        {cadernosOrdenados.map((caderno) => {
          const aberto = abertos.has(caderno.caminho);
          const secoes = ordenar(caderno.caminho, caderno.secoes, (secao) => secao.caminho);
          return (
            <div key={caderno.caminho}>
              <LinhaCaderno
                caderno={caderno}
                aberto={aberto}
                ativo={caderno.nome === trilha.caderno}
                sobrevoo={sobrevoo?.caminho === caderno.caminho ? sobrevoo : null}
                aoAlternar={() => alternar(caderno.caminho)}
                aoAgir={definirAcao}
                aoPassarPorCima={(antes, modo) => definirSobrevoo({ caminho: caderno.caminho, antes, modo })}
                aoSairDeCima={() =>
                  definirSobrevoo((atual) => (atual?.caminho === caderno.caminho ? null : atual))
                }
                aoSoltarCaderno={(origem, antes) => aoSoltarCaderno(origem, caderno.caminho, antes)}
                aoSoltarSecao={(origem) => moverPara(origem, caderno.caminho, "secao")}
              />

              {aberto ? (
                secoes.length === 0 ? (
                  <p className="py-1 pr-2 pl-8 text-[11.5px] leading-relaxed text-tinta-3">
                    Nenhuma seção ainda.{" "}
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:text-tinta"
                      onClick={() =>
                        definirAcao({
                          tipo: "nova-secao",
                          alvo: { nivel: "caderno", caminho: caderno.caminho, nome: caderno.nome },
                        })
                      }
                    >
                      Criar a primeira
                    </button>
                    .
                  </p>
                ) : (
                  secoes.map((secao) => (
                    <RamoSecao
                      key={secao.caminho}
                      caderno={caderno}
                      secao={secao}
                      aberta={abertos.has(secao.caminho)}
                      trilhaSecao={trilha.secao}
                      caminhoAtual={caminhoAtual}
                      paginas={paginas[secao.caminho]}
                      temModelos={modelos.length > 0}
                      sobrevoo={sobrevoo}
                      aoAlternar={() => alternar(secao.caminho)}
                      aoAgir={definirAcao}
                      aoCriarPagina={criarPagina}
                      aoCriarPaginaFlutuante={criarPaginaFlutuante}
                      aoFavoritar={async (nota) => {
                        await acaoAlternarFavorita(nota.caminho);
                        atualizar(secao.caminho);
                      }}
                      aoFixar={async (nota) => {
                        await acaoAlternarFixada(nota.caminho);
                        atualizar(secao.caminho);
                      }}
                      aoConverter={async (nota) => {
                        const resposta = await acaoConverterFormato(nota.caminho, "md");
                        invalidar(secao.caminho);
                        if (resposta.ok && resposta.mensagem) roteador.push(urlDaNota(resposta.mensagem));
                      }}
                      aoReordenarItem={async (caminho, direcao, tipo) => {
                        await acaoReordenar(caminho, direcao, tipo);
                        atualizar(tipo === "nota" ? secao.caminho : undefined);
                      }}
                      definirSobrevoo={definirSobrevoo}
                      aoSoltarSecao={(origem, antes) => aoSoltarSecao(caderno, origem, secao.caminho, antes)}
                      aoSoltarPaginaDentro={(origem) => moverPara(origem, secao.caminho, "pagina")}
                      aoSoltarPagina={(origem, alvoCaminho, antes) =>
                        aoSoltarPagina(secao.caminho, origem, alvoCaminho, antes)
                      }
                      aoAbrirAoLado={abas.abrirAoLado}
                    />
                  ))
                )
              ) : null}
            </div>
          );
        })}
      </nav>

      {/* ------------------------------------------------------- diálogos */}

      <DialogoNome
        aberto={acao?.tipo === "novo-caderno"}
        titulo="Novo caderno"
        descricao="Vira uma pasta de primeiro nível dentro de dados/."
        rotulo="Nome do caderno"
        textoBotao="Criar caderno"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          const resposta = await acaoCriarCaderno(nome);
          if (resposta.ok) atualizar();
          return resposta.ok ? null : resposta.erro;
        }}
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
          if (resposta.ok) {
            definirAbertos((atual) => new Set(atual).add(alvo.caminho));
            atualizar();
          }
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoNome
        aberto={acao?.tipo === "renomear"}
        titulo={
          alvo?.nivel === "caderno"
            ? "Renomear caderno"
            : alvo?.nivel === "secao"
              ? "Renomear seção"
              : "Renomear página"
        }
        descricao={
          alvo?.nivel === "pagina"
            ? "O arquivo é renomeado no disco, mantendo a extensão."
            : "A pasta é renomeada no disco junto."
        }
        rotulo={alvo?.nivel === "pagina" ? "Novo título" : "Novo nome"}
        valorInicial={alvo?.nome ?? ""}
        textoBotao="Renomear"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          if (!alvo) return null;
          const resposta = await acaoRenomear(alvo.caminho, nome);
          if (!resposta.ok) return resposta.erro;
          invalidar();
          if (resposta.mensagem) abas.renomear(alvo.caminho, resposta.mensagem);
          if (alvo.nivel === "pagina" && resposta.mensagem) roteador.push(urlDaNota(resposta.mensagem));
          else roteador.refresh();
          return null;
        }}
      />

      <DialogoMover
        aberto={acao?.tipo === "mover"}
        tipo={alvo?.nivel === "secao" ? "secao" : "pagina"}
        cadernos={cadernos}
        caminhoAtual={alvo?.caminho ?? ""}
        aoFechar={fechar}
        aoConfirmar={async (destino) => {
          if (!alvo) return null;
          const resposta = await acaoMover(alvo.caminho, destino);
          if (!resposta.ok) return resposta.erro;
          invalidar();
          if (resposta.mensagem) abas.renomear(alvo.caminho, resposta.mensagem);
          definirAbertos((atual) => new Set(atual).add(destino));
          if (estaDentroDe(alvo.caminho) && resposta.mensagem) {
            roteador.push(
              alvo.nivel === "pagina" ? urlDaNota(resposta.mensagem) : urlDaSecao(resposta.mensagem),
            );
          } else {
            roteador.refresh();
          }
          return null;
        }}
      />

      <DialogoIcone
        aberto={acao?.tipo === "icone"}
        icones={ICONES_DISPONIVEIS}
        iconeAtual={cadernoDoAlvo?.icone ?? ""}
        aoFechar={fechar}
        aoEscolher={async (icone) => {
          if (!alvo) return null;
          const resposta = await acaoDefinirIconeCaderno(alvo.caminho, icone);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoCor
        aberto={acao?.tipo === "cor"}
        cores={CORES_CADERNO}
        corAtual={cadernoDoAlvo?.cor ?? ""}
        aoFechar={fechar}
        aoEscolher={async (cor) => {
          if (!alvo) return null;
          const resposta = await acaoDefinirCorCaderno(alvo.caminho, cor);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />

      <DialogoConfirmarComTexto
        aberto={acao?.tipo === "excluir" && alvo?.nivel === "caderno"}
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
          invalidar();
          abas.remover(alvo.caminho);
          // Ficar no caderno recém-excluído mostraria uma tela fantasma.
          if (estaDentroDe(alvo.caminho)) roteador.push("/");
          else roteador.refresh();
          return null;
        }}
      />

      <DialogoConfirmar
        aberto={acao?.tipo === "excluir" && alvo?.nivel !== "caderno"}
        titulo={`Excluir ${alvo?.nome ?? ""}?`}
        descricao={
          alvo?.nivel === "secao"
            ? "A seção e tudo que está dentro vão para a lixeira. Dá para restaurar depois."
            : "A página vai para a lixeira, com etiquetas e favorito preservados."
        }
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo) return null;
          const destino =
            alvo.nivel === "pagina"
              ? await acaoDestinoAposExcluir(alvo.caminho)
              : urlDaSecao(alvo.caminho.slice(0, alvo.caminho.lastIndexOf("/")));
          const resposta = await acaoExcluir(alvo.caminho);
          if (!resposta.ok) return resposta.erro;
          invalidar();
          abas.remover(alvo.caminho);
          if (estaDentroDe(alvo.caminho)) roteador.push(destino);
          else roteador.refresh();
          return null;
        }}
      />

      <DialogoModeloDePagina
        aberto={acao?.tipo === "modelo"}
        pasta={alvo?.caminho ?? ""}
        nomeDaPasta={alvo?.nome ?? ""}
        modelos={modelos}
        aoFechar={fechar}
      />
    </>
  );
}

// ------------------------------------------------------------------ linhas

/** A seta que abre e fecha um ramo. Fica fora do link para clicar nela não navegar. */
function Seta({ aberto, rotulo, onClick }: { aberto: boolean; rotulo: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={rotulo}
      aria-expanded={aberto}
      className="flex size-4 shrink-0 items-center justify-center rounded text-tinta-3 hover:bg-realce-medio hover:text-tinta"
    >
      <ChevronRight size={12} className={clsx("transition-transform", aberto && "rotate-90")} />
    </button>
  );
}

/** A linha de encaixe entre irmãos, desenhada quando algo é arrastado para perto. */
function LinhaDeEncaixe({ antes }: { antes: boolean }) {
  return (
    <span
      className="pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full"
      style={{ background: "var(--realce)", [antes ? "top" : "bottom"]: 0 }}
      aria-hidden
    />
  );
}

function LinhaCaderno({
  caderno,
  aberto,
  ativo,
  sobrevoo,
  aoAlternar,
  aoAgir,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltarCaderno,
  aoSoltarSecao,
}: {
  caderno: Caderno;
  aberto: boolean;
  ativo: boolean;
  sobrevoo: Sobrevoo;
  aoAlternar: () => void;
  aoAgir: (acao: Acao) => void;
  aoPassarPorCima: (antes: boolean, modo: "encaixe" | "dentro") => void;
  aoSairDeCima: () => void;
  aoSoltarCaderno: (origem: string, antes: boolean) => void;
  aoSoltarSecao: (origem: string) => void;
}) {
  const roteador = useRouter();
  const alvo: Alvo = { nivel: "caderno", caminho: caderno.caminho, nome: caderno.nome };
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
          aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2, "encaixe");
          return;
        }
        if (!trazSecao(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        aoPassarPorCima(false, "dentro");
      }}
      onDragLeave={aoSairDeCima}
      onDrop={(evento) => {
        if (trazCaderno(evento)) {
          evento.preventDefault();
          const retangulo = evento.currentTarget.getBoundingClientRect();
          aoSoltarCaderno(
            lerNomeDeCaderno(evento),
            evento.clientY < retangulo.top + retangulo.height / 2,
          );
          return;
        }
        if (!trazSecao(evento)) return;
        evento.preventDefault();
        aoSoltarSecao(lerCaminhoDeSecao(evento));
      }}
      className={clsx(
        "group relative flex cursor-grab items-center gap-0.5 rounded-lg pr-1 transition-colors active:cursor-grabbing",
        sobrevoo?.modo === "dentro" ? "bg-realce-medio" : ativo ? "bg-realce-fraco" : "hover:bg-realce-fraco",
      )}
    >
      {sobrevoo?.modo === "encaixe" ? <LinhaDeEncaixe antes={sobrevoo.antes} /> : null}

      <span className="pl-1">
        <Seta aberto={aberto} rotulo={`${aberto ? "Fechar" : "Abrir"} ${caderno.nome}`} onClick={aoAlternar} />
      </span>

      <Link
        href={endereco}
        onClick={() => !aberto && aoAlternar()}
        className="linha-nav flex min-w-0 flex-1 items-center gap-1.5"
      >
        <span className="text-[13px] leading-none" aria-hidden>
          {caderno.icone}
        </span>
        <span className={clsx("truncate text-[12.5px]", ativo ? "font-semibold text-tinta" : "text-tinta-2")}>
          {caderno.nome}
        </span>
      </Link>

      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <BotaoIcone
          rotulo={`Nova seção em ${caderno.nome}`}
          onClick={() => aoAgir({ tipo: "nova-secao", alvo })}
          className="size-6"
        >
          <Plus size={13} />
        </BotaoIcone>
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
                icone={<FilePlus2 size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "nova-secao", alvo });
                }}
              >
                Nova seção
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
                icone={<Download size={14} />}
                onClick={async () => {
                  fechar();
                  await baixarPasta(caderno.caminho);
                }}
              >
                Exportar em markdown
              </ItemMenu>
              <SeparadorMenu />
              <ItemMenu
                icone={<Smile size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "icone", alvo });
                }}
              >
                Ícone do caderno
              </ItemMenu>
              <ItemMenu
                icone={<Palette size={14} />}
                onClick={() => {
                  fechar();
                  aoAgir({ tipo: "cor", alvo });
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

/** Uma seção com as páginas dela embaixo, quando aberta. */
function RamoSecao({
  caderno,
  secao,
  aberta,
  trilhaSecao,
  caminhoAtual,
  paginas,
  temModelos,
  sobrevoo,
  aoAlternar,
  aoAgir,
  aoCriarPagina,
  aoCriarPaginaFlutuante,
  aoFavoritar,
  aoFixar,
  aoConverter,
  aoReordenarItem,
  definirSobrevoo,
  aoSoltarSecao,
  aoSoltarPaginaDentro,
  aoSoltarPagina,
  aoAbrirAoLado,
}: {
  caderno: Caderno;
  secao: Secao;
  aberta: boolean;
  trilhaSecao: string | null;
  caminhoAtual: string;
  paginas: ResumoNota[] | undefined;
  temModelos: boolean;
  sobrevoo: Sobrevoo;
  aoAlternar: () => void;
  aoAgir: (acao: Acao) => void;
  aoCriarPagina: (secao: string) => void;
  aoCriarPaginaFlutuante: (secao: string) => void;
  aoFavoritar: (nota: ResumoNota) => void;
  aoFixar: (nota: ResumoNota) => void;
  aoConverter: (nota: ResumoNota) => void;
  aoReordenarItem: (caminho: string, direcao: -1 | 1, tipo: "nota" | "pasta") => void;
  definirSobrevoo: (sobrevoo: Sobrevoo) => void;
  aoSoltarSecao: (origem: string, antes: boolean) => void;
  aoSoltarPaginaDentro: (origem: string) => void;
  aoSoltarPagina: (origem: string, alvoCaminho: string, antes: boolean) => void;
  aoAbrirAoLado: (caminho: string, titulo: string) => void;
}) {
  const ativa = trilhaSecao === secao.caminho;
  const alvo: Alvo = { nivel: "secao", caminho: secao.caminho, nome: secao.nome };
  const meu = sobrevoo?.caminho === secao.caminho ? sobrevoo : null;

  return (
    <>
      <div
        draggable
        onDragStart={(evento) => iniciarArrastoDeSecao(evento, secao.caminho)}
        onDragOver={(evento) => {
          if (trazSecao(evento)) {
            evento.preventDefault();
            evento.dataTransfer.dropEffect = "move";
            const retangulo = evento.currentTarget.getBoundingClientRect();
            definirSobrevoo({
              caminho: secao.caminho,
              antes: evento.clientY < retangulo.top + retangulo.height / 2,
              modo: "encaixe",
            });
            return;
          }
          if (!trazPagina(evento)) return;
          evento.preventDefault();
          evento.dataTransfer.dropEffect = "move";
          definirSobrevoo({ caminho: secao.caminho, antes: false, modo: "dentro" });
        }}
        onDragLeave={() => definirSobrevoo(null)}
        onDrop={(evento) => {
          if (trazSecao(evento)) {
            evento.preventDefault();
            const retangulo = evento.currentTarget.getBoundingClientRect();
            aoSoltarSecao(
              lerCaminhoDeSecao(evento),
              evento.clientY < retangulo.top + retangulo.height / 2,
            );
            return;
          }
          if (!trazPagina(evento)) return;
          evento.preventDefault();
          aoSoltarPaginaDentro(lerCaminhoDePagina(evento));
        }}
        className={clsx(
          "group relative flex cursor-grab items-center gap-0.5 rounded-md pr-1 transition-colors active:cursor-grabbing",
          meu?.modo === "dentro" ? "bg-realce-medio" : "hover:bg-realce-fraco",
        )}
      >
        {meu?.modo === "encaixe" ? <LinhaDeEncaixe antes={meu.antes} /> : null}

        <span className="pl-5">
          <Seta aberto={aberta} rotulo={`${aberta ? "Fechar" : "Abrir"} ${secao.nome}`} onClick={aoAlternar} />
        </span>

        <Link
          href={urlDaSecao(secao.caminho)}
          onClick={() => !aberta && aoAlternar()}
          className="linha-nav flex min-w-0 flex-1 items-center gap-1.5"
        >
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
            onClick={() => aoCriarPagina(secao.caminho)}
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
                    aoCriarPagina(secao.caminho);
                  }}
                >
                  Nova página
                </ItemMenu>
                {temModelos ? (
                  <ItemMenu
                    icone={<LayoutTemplate size={14} />}
                    onClick={() => {
                      fechar();
                      aoAgir({ tipo: "modelo", alvo });
                    }}
                  >
                    Começar de um modelo…
                  </ItemMenu>
                ) : null}
                <ItemMenu
                  icone={<AppWindow size={14} />}
                  onClick={() => {
                    fechar();
                    aoCriarPaginaFlutuante(secao.caminho);
                  }}
                >
                  Nova página em janela flutuante
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
                    await baixarPasta(secao.caminho);
                  }}
                >
                  Exportar em markdown
                </ItemMenu>
                <SeparadorMenu />
                <ItemMenu
                  icone={<ArrowUp size={14} />}
                  onClick={() => {
                    fechar();
                    aoReordenarItem(secao.caminho, -1, "pasta");
                  }}
                >
                  Subir
                </ItemMenu>
                <ItemMenu
                  icone={<ArrowDown size={14} />}
                  onClick={() => {
                    fechar();
                    aoReordenarItem(secao.caminho, 1, "pasta");
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

      {aberta ? (
        paginas === undefined ? (
          <p className="py-1 pr-2 pl-11 text-[11.5px] text-tinta-3">carregando…</p>
        ) : paginas.length === 0 ? (
          <p className="py-1 pr-2 pl-11 text-[11.5px] leading-relaxed text-tinta-3">
            Seção vazia. O “+” cria a primeira página já aberta para escrever.
          </p>
        ) : (
          paginas.map((nota) => (
            <LinhaPagina
              key={nota.caminho}
              nota={nota}
              ativa={decodeURIComponent(caminhoAtual) === `/nota/${nota.caminho}`}
              corDoCaderno={caderno.cor}
              sobrevoo={sobrevoo?.caminho === nota.caminho ? sobrevoo : null}
              aoAgir={aoAgir}
              aoFavoritar={() => aoFavoritar(nota)}
              aoFixar={() => aoFixar(nota)}
              aoConverter={() => aoConverter(nota)}
              aoReordenarItem={aoReordenarItem}
              aoPassarPorCima={(antes) =>
                definirSobrevoo({ caminho: nota.caminho, antes, modo: "encaixe" })
              }
              aoSairDeCima={() => definirSobrevoo(null)}
              aoSoltar={(origem, antes) => aoSoltarPagina(origem, nota.caminho, antes)}
              aoAbrirAoLado={() => aoAbrirAoLado(nota.caminho, nota.titulo)}
            />
          ))
        )
      ) : null}
    </>
  );
}

/**
 * Uma página: uma linha só. Era um cartão com título, duas linhas de prévia,
 * etiquetas e rodapé — bonito, mas cabiam cinco por tela. A prévia continua
 * acessível no `title` da linha, e as etiquetas moram no cabeçalho da nota.
 */
function LinhaPagina({
  nota,
  ativa,
  corDoCaderno,
  sobrevoo,
  aoAgir,
  aoFavoritar,
  aoFixar,
  aoConverter,
  aoReordenarItem,
  aoPassarPorCima,
  aoSairDeCima,
  aoSoltar,
  aoAbrirAoLado,
}: {
  nota: ResumoNota;
  ativa: boolean;
  corDoCaderno: string;
  sobrevoo: Sobrevoo;
  aoAgir: (acao: Acao) => void;
  aoFavoritar: () => void;
  aoFixar: () => void;
  aoConverter: () => void;
  aoReordenarItem: (caminho: string, direcao: -1 | 1, tipo: "nota" | "pasta") => void;
  aoPassarPorCima: (antes: boolean) => void;
  aoSairDeCima: () => void;
  aoSoltar: (origem: string, antes: boolean) => void;
  aoAbrirAoLado: () => void;
}) {
  const alvo: Alvo = { nivel: "pagina", caminho: nota.caminho, nome: nota.titulo };

  return (
    <div
      draggable
      onDragStart={(evento) => iniciarArrastoDePagina(evento, nota.caminho)}
      onDragOver={(evento) => {
        if (!trazPagina(evento)) return;
        evento.preventDefault();
        evento.dataTransfer.dropEffect = "move";
        const retangulo = evento.currentTarget.getBoundingClientRect();
        aoPassarPorCima(evento.clientY < retangulo.top + retangulo.height / 2);
      }}
      onDragLeave={aoSairDeCima}
      onDrop={(evento) => {
        if (!trazPagina(evento)) return;
        evento.preventDefault();
        // Recalcula na hora em vez de confiar no estado do último `dragover`:
        // um drop rápido pode chegar antes daquele estado virar renderização.
        const retangulo = evento.currentTarget.getBoundingClientRect();
        aoSoltar(lerCaminhoDePagina(evento), evento.clientY < retangulo.top + retangulo.height / 2);
      }}
      className={clsx(
        "group relative flex cursor-grab items-center gap-0.5 rounded-md pr-1 transition-colors active:cursor-grabbing",
        ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
    >
      {ativa ? (
        <span
          className="barra-ativa absolute top-1 bottom-1 left-0 w-[2.5px] rounded-full"
          style={{ background: corDoCaderno }}
          aria-hidden
        />
      ) : null}
      {sobrevoo ? <LinhaDeEncaixe antes={sobrevoo.antes} /> : null}

      <Link
        href={urlDaNota(nota.caminho)}
        title={nota.trecho || "página em branco"}
        // Ctrl+clique e botão do meio: aba nova sem sair da atual, como num
        // navegador. Tirados do navegador de propósito — abrir a mesma nota
        // numa aba do Chrome não é o que se quer aqui.
        onClick={(evento) => {
          if (evento.ctrlKey || evento.metaKey) {
            evento.preventDefault();
            aoAbrirAoLado();
          }
        }}
        onAuxClick={(evento) => {
          if (evento.button === 1) {
            evento.preventDefault();
            aoAbrirAoLado();
          }
        }}
        className="linha-nav flex min-w-0 flex-1 items-center gap-1.5 pl-11"
      >
        {nota.fixada ? <Pin size={10} className="shrink-0 text-tinta-3" aria-label="Fixada no topo" /> : null}
        {nota.favorita ? <Star size={10} className="shrink-0 fill-current text-[#c69214]" /> : null}
        <span
          className={clsx("min-w-0 flex-1 truncate text-[12.5px]", ativa ? "font-medium text-tinta" : "text-tinta-2")}
        >
          {nota.titulo}
        </span>
        <span className="shrink-0 pl-1 text-[10px] text-tinta-3 tabular-nums transition-opacity group-hover:opacity-0">
          {formatarDataCurta(nota.atualizadoEm)}
        </span>
      </Link>

      <div className="absolute right-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        <Menu
          gatilho={(abrir) => (
            <BotaoIcone rotulo={`Opções de ${nota.titulo}`} onClick={abrir} className="size-6 bg-superficie">
              <MoreHorizontal size={13} />
            </BotaoIcone>
          )}
        >
          {(fechar) => (
            <>
              <ItemMenu
                icone={<Star size={14} />}
                onClick={() => {
                  fechar();
                  aoFavoritar();
                }}
              >
                {nota.favorita ? "Tirar dos favoritos" : "Marcar como favorita"}
              </ItemMenu>
              <ItemMenu
                icone={<Pin size={14} />}
                onClick={() => {
                  fechar();
                  aoFixar();
                }}
              >
                {nota.fixada ? "Desafixar do topo" : "Fixar no topo da seção"}
              </ItemMenu>
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
              {/* Só o caminho de volta: o app não cria mais .txt, mas quem já
                  tem um pode passá-lo para markdown. */}
              {nota.formato === "txt" ? (
                <ItemMenu
                  icone={<ArrowLeftRight size={14} />}
                  onClick={() => {
                    fechar();
                    aoConverter();
                  }}
                >
                  Converter para markdown
                </ItemMenu>
              ) : null}
              <SeparadorMenu />
              <ItemMenu
                icone={<ArrowUp size={14} />}
                onClick={() => {
                  fechar();
                  aoReordenarItem(nota.caminho, -1, "nota");
                }}
              >
                Subir
              </ItemMenu>
              <ItemMenu
                icone={<ArrowDown size={14} />}
                onClick={() => {
                  fechar();
                  aoReordenarItem(nota.caminho, 1, "nota");
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
