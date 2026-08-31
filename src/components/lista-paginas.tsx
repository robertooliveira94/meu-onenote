"use client";

import clsx from "clsx";
import {
  ArrowDown,
  ArrowLeftRight,
  ArrowUp,
  MoreHorizontal,
  MoveRight,
  Pencil,
  Plus,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  acaoAlternarFavorita,
  acaoConverterFormato,
  acaoDestinoAposExcluir,
  acaoExcluir,
  acaoMover,
  acaoRenomear,
  acaoReordenar,
} from "@/app/acoes";
import { useColunas } from "@/lib/colunas";
import { useLarguraRedimensionavel } from "@/lib/redimensionar";
import { formatarDataCurta, urlDaNota } from "@/lib/rotas";
import type { Etiqueta, Modelo, NoArvore, ResumoNota } from "@/lib/tipos";

import { DialogoConfirmar, DialogoMover, DialogoNome } from "./dialogos";
import { DialogoNovaPagina } from "./dialogo-nova-pagina";
import { AlcaRedimensionar, BotaoIcone, ItemMenu, Menu, SeparadorMenu } from "./ui";

type Acao =
  | { tipo: "nova" }
  | { tipo: "renomear" | "mover" | "excluir"; nota: ResumoNota }
  | null;

/** Coluna do meio: as páginas da seção aberta. */
export function ListaPaginas({
  pasta,
  nomeDaPasta,
  notas,
  etiquetas,
  cadernos,
  modelos,
  caminhoAtivo,
}: {
  pasta: string;
  nomeDaPasta: string;
  notas: ResumoNota[];
  etiquetas: Etiqueta[];
  cadernos: NoArvore[];
  modelos: Modelo[];
  caminhoAtivo?: string;
}) {
  const roteador = useRouter();
  const [acao, definirAcao] = useState<Acao>(null);
  const fechar = () => definirAcao(null);
  const alvo = acao && "nota" in acao ? acao.nota : null;
  const listaDePaginas = useLarguraRedimensionavel("largura-lista-paginas", {
    padrao: 292,
    minima: 220,
    maxima: 520,
  });
  const colunas = useColunas();

  return (
    <div
      className="relative flex shrink-0 flex-col overflow-hidden border-r border-linha bg-papel"
      style={{ width: colunas.recolhidas ? 0 : listaDePaginas.largura }}
      aria-hidden={colunas.recolhidas}
      inert={colunas.recolhidas}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2.5">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold tracking-[-0.02em]">{nomeDaPasta}</p>
          <p className="text-[11px] text-tinta-3">
            {notas.length === 0
              ? "nenhuma página"
              : `${notas.length} ${notas.length === 1 ? "página" : "páginas"}`}
          </p>
        </div>
        <BotaoIcone rotulo="Nova página" onClick={() => definirAcao({ tipo: "nova" })}>
          <Plus size={15} />
        </BotaoIcone>
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto px-3 pb-3">
        {notas.length === 0 ? (
          <p className="px-2 py-4 text-[12px] leading-relaxed text-tinta-3">
            Seção vazia. Crie a primeira página no “+” — você escolhe entre markdown e texto
            simples.
          </p>
        ) : null}

        {notas.map((nota) => {
          const ativa = nota.caminho === caminhoAtivo;
          const etiquetasDaNota = nota.etiquetas
            .map((id) => etiquetas.find((etiqueta) => etiqueta.id === id))
            .filter((etiqueta): etiqueta is Etiqueta => Boolean(etiqueta));

          return (
            <div
              key={nota.caminho}
              className={clsx("cartao group relative", ativa && "shadow-[var(--sombra-cartao-alta)]")}
              style={
                ativa
                  ? {
                      borderColor: "color-mix(in srgb, var(--realce) 55%, transparent)",
                      // Faixa na cor do caderno no topo do cartão aberto.
                      boxShadow: "inset 0 3px 0 var(--realce), var(--sombra-cartao-alta)",
                    }
                  : undefined
              }
            >
              <Link href={urlDaNota(nota.caminho)} className={clsx("block px-3.5", ativa ? "pt-3.5 pb-3" : "py-3")}>
                <div className="flex items-center gap-1.5">
                  {nota.favorita ? (
                    <Star size={11} className="shrink-0 fill-current text-[#c69214]" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate pr-6 text-[13px] font-medium text-tinta">
                    {nota.titulo}
                  </span>
                </div>

                {nota.trecho ? (
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-tinta-2">
                    {nota.trecho}
                  </p>
                ) : (
                  <p className="mt-1 text-[11.5px] text-tinta-3 italic">página em branco</p>
                )}

                {etiquetasDaNota.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {etiquetasDaNota.slice(0, 3).map((etiqueta) => (
                      <span
                        key={etiqueta.id}
                        className="pastilha"
                        style={{
                          color: `color-mix(in srgb, ${etiqueta.cor} 82%, var(--tinta))`,
                          background: `color-mix(in srgb, ${etiqueta.cor} 14%, transparent)`,
                        }}
                      >
                        {etiqueta.nome}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-2 flex items-center gap-1.5">
                  <span className="text-[10.5px] text-tinta-3">
                    {formatarDataCurta(nota.atualizadoEm)}
                  </span>
                  <span className="ml-auto font-mono text-[9.5px] tracking-wide text-tinta-3 uppercase">
                    {nota.formato}
                  </span>
                </div>
              </Link>

              <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Menu
                  gatilho={(abrir) => (
                    <BotaoIcone
                      rotulo={`Opções de ${nota.titulo}`}
                      onClick={abrir}
                      className="size-6 bg-superficie-alta shadow-[var(--sombra-cartao)]"
                    >
                      <MoreHorizontal size={13} />
                    </BotaoIcone>
                  )}
                >
                  {(fecharMenu) => (
                    <>
                      <ItemMenu
                        icone={<Star size={14} />}
                        onClick={async () => {
                          fecharMenu();
                          await acaoAlternarFavorita(nota.caminho);
                          roteador.refresh();
                        }}
                      >
                        {nota.favorita ? "Tirar dos favoritos" : "Marcar como favorita"}
                      </ItemMenu>
                      <ItemMenu
                        icone={<Pencil size={14} />}
                        onClick={() => {
                          fecharMenu();
                          definirAcao({ tipo: "renomear", nota });
                        }}
                      >
                        Renomear
                      </ItemMenu>
                      <ItemMenu
                        icone={<MoveRight size={14} />}
                        onClick={() => {
                          fecharMenu();
                          definirAcao({ tipo: "mover", nota });
                        }}
                      >
                        Mover para…
                      </ItemMenu>
                      <ItemMenu
                        icone={<ArrowLeftRight size={14} />}
                        onClick={async () => {
                          fecharMenu();
                          const destino = nota.formato === "md" ? "txt" : "md";
                          const resposta = await acaoConverterFormato(nota.caminho, destino);
                          if (resposta.ok && resposta.mensagem) {
                            roteador.push(urlDaNota(resposta.mensagem));
                          }
                        }}
                      >
                        {nota.formato === "md" ? "Converter para texto" : "Converter para markdown"}
                      </ItemMenu>
                      <SeparadorMenu />
                      <ItemMenu
                        icone={<ArrowUp size={14} />}
                        onClick={async () => {
                          fecharMenu();
                          await acaoReordenar(nota.caminho, -1, "nota");
                          roteador.refresh();
                        }}
                      >
                        Subir
                      </ItemMenu>
                      <ItemMenu
                        icone={<ArrowDown size={14} />}
                        onClick={async () => {
                          fecharMenu();
                          await acaoReordenar(nota.caminho, 1, "nota");
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
                          fecharMenu();
                          definirAcao({ tipo: "excluir", nota });
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
        })}
      </div>

      <DialogoNovaPagina
        aberto={acao?.tipo === "nova"}
        pasta={pasta}
        nomeDaPasta={nomeDaPasta}
        modelos={modelos}
        aoFechar={fechar}
      />

      <DialogoNome
        aberto={acao?.tipo === "renomear"}
        titulo="Renomear página"
        descricao="O arquivo é renomeado no disco, mantendo a extensão."
        rotulo="Novo título"
        valorInicial={alvo?.titulo ?? ""}
        textoBotao="Renomear"
        aoFechar={fechar}
        aoConfirmar={async (nome) => {
          if (!alvo) return null;
          const resposta = await acaoRenomear(alvo.caminho, nome);
          if (!resposta.ok) return resposta.erro;
          if (resposta.mensagem) roteador.push(urlDaNota(resposta.mensagem));
          return null;
        }}
      />

      <DialogoMover
        aberto={acao?.tipo === "mover"}
        cadernos={cadernos}
        caminhoAtual={alvo?.caminho ?? ""}
        aoFechar={fechar}
        aoConfirmar={async (destino) => {
          if (!alvo) return null;
          const resposta = await acaoMover(alvo.caminho, destino);
          if (!resposta.ok) return resposta.erro;
          if (resposta.mensagem) roteador.push(urlDaNota(resposta.mensagem));
          return null;
        }}
      />

      <DialogoConfirmar
        aberto={acao?.tipo === "excluir"}
        titulo={`Excluir ${alvo?.titulo ?? ""}?`}
        descricao="A página vai para a lixeira, com etiquetas e favorito preservados."
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo) return null;
          const destino = await acaoDestinoAposExcluir(alvo.caminho);
          const resposta = await acaoExcluir(alvo.caminho);
          if (!resposta.ok) return resposta.erro;
          if (alvo.caminho === caminhoAtivo) roteador.push(destino);
          else roteador.refresh();
          return null;
        }}
      />

      {colunas.recolhidas ? null : (
        <AlcaRedimensionar
          aoArrastar={listaDePaginas.iniciarArraste}
          aoRestaurar={listaDePaginas.restaurarPadrao}
          rotulo="Redimensionar a lista de páginas"
        />
      )}
    </div>
  );
}
