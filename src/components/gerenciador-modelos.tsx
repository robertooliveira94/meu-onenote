"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { acaoCriarModelo, acaoEditarModelo, acaoExcluirModelo } from "@/app/acoes";
import type { Modelo } from "@/lib/tipos";

import { DialogoConfirmar } from "./dialogos";
import { Aviso, Botao, BotaoIcone, Campo, Rotulo } from "./ui";

/** Cadastro de modelos: criar, editar e excluir pontos de partida para páginas novas. */
export function GerenciadorModelos({ modelos }: { modelos: Modelo[] }) {
  const roteador = useRouter();
  const [nome, definirNome] = useState("");
  const [descricao, definirDescricao] = useState("");
  const [conteudo, definirConteudo] = useState("");
  const [erro, definirErro] = useState<string | null>(null);
  const [emEdicao, definirEmEdicao] = useState<string | null>(null);
  const [paraExcluir, definirParaExcluir] = useState<Modelo | null>(null);

  async function criar() {
    const resposta = await acaoCriarModelo(nome, descricao, conteudo);
    if (!resposta.ok) {
      definirErro(resposta.erro);
      return;
    }
    definirNome("");
    definirDescricao("");
    definirConteudo("");
    definirErro(null);
    roteador.refresh();
  }

  return (
    <div className="flex-1 overflow-y-auto px-8 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-[25px] leading-tight font-extrabold tracking-[-0.03em]">Modelos</h1>
        <p className="mt-1 text-[13px] text-tinta-2">
          Um ponto de partida pronto (reunião, diário, receita) — aparece na hora de criar uma
          página em markdown, opcional.
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
                placeholder="Reunião"
                maxLength={60}
                onChange={(evento) => definirNome(evento.target.value)}
              />
            </label>
            <label className="block">
              <Rotulo>Descrição (opcional)</Rotulo>
              <Campo
                value={descricao}
                placeholder="pauta, decisões, próximos passos"
                maxLength={140}
                onChange={(evento) => definirDescricao(evento.target.value)}
              />
            </label>
          </div>

          <label className="mt-3 block">
            <Rotulo>Conteúdo (markdown)</Rotulo>
            <textarea
              value={conteudo}
              onChange={(evento) => definirConteudo(evento.target.value)}
              placeholder={"# Reunião\n\n**Data:** \n**Participantes:** \n\n## Pauta\n\n## Decisões"}
              rows={8}
              className="editor-texto w-full resize-y rounded-lg border border-linha bg-superficie-alta px-3 py-2.5 text-tinta placeholder:text-tinta-3 focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
            />
          </label>

          <div className="mt-3 flex justify-end">
            <Botao type="submit" variante="primario">
              <Plus size={13} />
              Criar modelo
            </Botao>
          </div>
          <Aviso>{erro}</Aviso>
        </form>

        <section className="mt-7">
          {modelos.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-tinta-3">
              Nenhum modelo ainda. Cadastre um acima — vira uma opção na hora de criar uma página
              nova.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--linha)] overflow-hidden rounded-xl border border-linha bg-superficie">
              {modelos.map((modelo) =>
                emEdicao === modelo.id ? (
                  <li key={modelo.id} className="p-3">
                    <FormularioEdicao modelo={modelo} aoFechar={() => definirEmEdicao(null)} />
                  </li>
                ) : (
                  <li key={modelo.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium">{modelo.nome}</p>
                      {modelo.descricao ? (
                        <p className="truncate text-[12px] text-tinta-2">{modelo.descricao}</p>
                      ) : null}
                    </div>
                    <BotaoIcone rotulo="Editar" onClick={() => definirEmEdicao(modelo.id)}>
                      <Pencil size={14} />
                    </BotaoIcone>
                    <BotaoIcone rotulo="Excluir" onClick={() => definirParaExcluir(modelo)}>
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
        titulo={`Excluir o modelo ${paraExcluir?.nome ?? ""}?`}
        descricao="Páginas já criadas a partir dele não mudam — só some da lista na hora de criar uma nova."
        textoBotao="Excluir modelo"
        aoFechar={() => definirParaExcluir(null)}
        aoConfirmar={async () => {
          if (!paraExcluir) return null;
          const resposta = await acaoExcluirModelo(paraExcluir.id);
          if (resposta.ok) roteador.refresh();
          return resposta.ok ? null : resposta.erro;
        }}
      />
    </div>
  );
}

function FormularioEdicao({ modelo, aoFechar }: { modelo: Modelo; aoFechar: () => void }) {
  const roteador = useRouter();
  const [nome, definirNome] = useState(modelo.nome);
  const [descricao, definirDescricao] = useState(modelo.descricao);
  const [conteudo, definirConteudo] = useState(modelo.conteudo);
  const [erro, definirErro] = useState<string | null>(null);

  async function salvar() {
    const resposta = await acaoEditarModelo(modelo.id, nome, descricao, conteudo);
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
        <Campo value={nome} maxLength={60} onChange={(evento) => definirNome(evento.target.value)} />
        <Campo
          value={descricao}
          maxLength={140}
          placeholder="descrição"
          onChange={(evento) => definirDescricao(evento.target.value)}
        />
      </div>
      <textarea
        value={conteudo}
        onChange={(evento) => definirConteudo(evento.target.value)}
        rows={8}
        className="editor-texto mt-2 w-full resize-y rounded-lg border border-linha bg-superficie-alta px-3 py-2.5 text-tinta focus:border-[var(--realce)] focus:shadow-[0_0_0_3px_var(--realce-medio)] focus:outline-none"
      />
      <div className="mt-2 flex justify-end gap-2">
        <Botao variante="sutil" onClick={aoFechar}>
          Cancelar
        </Botao>
        <Botao variante="primario" onClick={salvar}>
          Salvar
        </Botao>
      </div>
      <Aviso>{erro}</Aviso>
    </div>
  );
}
