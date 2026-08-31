"use client";

import clsx from "clsx";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acaoCriarEtiqueta, acaoEditarEtiqueta, acaoExcluirEtiqueta } from "@/app/acoes";
import { CORES_ETIQUETA } from "@/lib/cores";
import { urlDaEtiqueta } from "@/lib/rotas";
import type { Etiqueta } from "@/lib/tipos";

import { DialogoConfirmar } from "./dialogos";
import { Aviso, Botao, BotaoIcone, Campo, Rotulo } from "./ui";

/** Cadastro de etiquetas: criar, editar cor e nome, excluir. */
export function GerenciadorEtiquetas({
  etiquetas,
  usos,
}: {
  etiquetas: Etiqueta[];
  usos: Record<string, number>;
}) {
  const roteador = useRouter();
  const [nome, definirNome] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [cor, definirCor] = useState(CORES_ETIQUETA[0]);
  const [erro, definirErro] = useState<string | null>(null);
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [paraExcluir, definirParaExcluir] = useState<Etiqueta | null>(null);

  async function criar() {
    const resposta = await acaoCriarEtiqueta(nome, cor, descricao);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirNome("");
    definirDescricao("");
    definirErro(null);
    roteador.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Etiquetas</h1>
        <p className="mt-1 text-[13px] text-tinta-2">
          Uma etiqueta atravessa cadernos: serve para juntar o que a estrutura de pastas separou.
        </p>

        <form
          className="mt-6 rounded-xl border border-linha bg-superficie p-4"
          onSubmit={(evento) => {
            evento.preventDefault();
            criar();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr]">
            <label className="block">
              <Rotulo>Nome</Rotulo>
              <Campo
                value={nome}
                placeholder="finanças"
                maxLength={40}
                onChange={(evento) => definirNome(evento.target.value)}
              />
            </label>
            <label className="block">
              <Rotulo>Descrição (opcional)</Rotulo>
              <Campo
                value={descricao}
                placeholder="o que entra nesta etiqueta"
                maxLength={140}
                onChange={(evento) => definirDescricao(evento.target.value)}
              />
            </label>
          </div>

          <div className="mt-3">
            <Rotulo>Cor</Rotulo>
            <div className="flex flex-wrap items-center gap-2">
              {CORES_ETIQUETA.map((opcao) => (
                <button
                  key={opcao}
                  type="button"
                  aria-label={`Usar a cor ${opcao}`}
                  aria-pressed={cor === opcao}
                  onClick={() => definirCor(opcao)}
                  className={clsx(
                    "flex size-7 items-center justify-center rounded-md border-2 transition-transform hover:scale-105",
                    cor === opcao ? "border-tinta" : "border-transparent",
                  )}
                  style={{ background: opcao }}
                >
                  {cor === opcao ? <Check size={13} className="text-white" /> : null}
                </button>
              ))}
              <Botao type="submit" variante="primario" className="ml-auto">
                <Plus size={13} />
                Criar etiqueta
              </Botao>
            </div>
          </div>
          <Aviso>{erro}</Aviso>
        </form>

        <section className="mt-7">
          {etiquetas.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-tinta-3">
              Nenhuma etiqueta ainda. Comece por uma bem larga, tipo “casa” ou “trabalho”.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--linha)] overflow-hidden rounded-xl border border-linha bg-superficie">
              {etiquetas.map((etiqueta) =>
                emEdicao === etiqueta.id ? (
                  <li key={etiqueta.id} className="p-3">
                    <FormularioEdicao
                      etiqueta={etiqueta}
                      aoFechar={() => definirEmEdicao(null)}
                    />
                  </li>
                ) : (
                  <li key={etiqueta.id} className="flex items-center gap-3 p-3">
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{ background: etiqueta.cor }}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={urlDaEtiqueta(etiqueta.id)}
                        className="text-[13px] font-medium hover:underline underline-offset-2"
                      >
                        {etiqueta.nome}
                      </Link>
                      {etiqueta.descricao ? (
                        <p className="truncate text-[12px] text-tinta-2">{etiqueta.descricao}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11.5px] text-tinta-3">
                      {usos[etiqueta.id] ?? 0} {usos[etiqueta.id] === 1 ? "nota" : "notas"}
                    </span>
                    <BotaoIcone rotulo="Editar" onClick={() => definirEmEdicao(etiqueta.id)}>
                      <Pencil size={14} />
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir" onClick={() => definirParaExcluir(etiqueta)}>
                      <Trash2 size={14} />
                    </BotaoIcone>
                  </li>
                ),
              )}
            </ul>
          )}
        </section>
      </div>

      <DialogoConfirmar
        aberto={paraExcluir !== null}
        titulo={`Excluir a etiqueta ${paraExcluir?.nome ?? ""}?`}
        descricao={`Ela sai de ${usos[paraExcluir?.id ?? ""] ?? 0} nota(s). As notas em si continuam onde estão.`}
        textoBotao="Excluir etiqueta"
        aoFechar={() => definirParaExcluir(null)}
        aoConfirmar={async () => {
          if (!paraExcluir) return null;
          const resposta = await acaoExcluirEtiqueta(paraExcluir.id);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />
    </div>
  );
}

function FormularioEdicao({
  etiqueta,
  aoFechar,
}: {
  etiqueta: Etiqueta;
  aoFechar: () => void;
}) {
  const roteador = useRouter();
  const [nome, definirNome] = useState(etiqueta.nome);
  const [descricao, definirDescricao] = useState(etiqueta.descricao);
  const [cor, definirCor] = useState(etiqueta.cor);
  const [erro, definirErro] = useState<string | null>(null);

  async function salvar() {
    const resposta = await acaoEditarEtiqueta(etiqueta.id, nome, cor, descricao);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    roteador.refresh();
    aoFechar();
  }

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
        <Campo value={nome} maxLength={40} onChange={(evento) => definirNome(evento.target.value)} />
        <Campo
          value={descricao}
          maxLength={140}
          placeholder="descrição"
          onChange={(evento) => definirDescricao(evento.target.value)}
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {CORES_ETIQUETA.map((opcao) => (
          <button
            key={opcao}
            type="button"
            aria-label={`Usar a cor ${opcao}`}
            onClick={() => definirCor(opcao)}
            className={clsx(
              "size-6 rounded-md border-2",
              cor === opcao ? "border-tinta" : "border-transparent",
            )}
            style={{ background: opcao }}
          />
        ))}
        <div className="ml-auto flex gap-2">
          <Botao variante="sutil" onClick={aoFechar}>
            Cancelar
          </Botao>
          <Botao variante="primario" onClick={salvar}>
            Salvar
          </Botao>
        </div>
      </div>
      <Aviso>{erro}</Aviso>
    </div>
  );
}
