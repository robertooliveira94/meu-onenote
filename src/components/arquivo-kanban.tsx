"use client";

import { ArchiveRestore, ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { acaoDesarquivarTarefa } from "@/app/acoes-kanban";
import { formatarDataCurta, formatarDataHora, urlDoQuadro } from "@/lib/rotas";
import { siglaDoQuadro } from "@/lib/sigla";
import type { ResumoQuadro, TarefaArquivada } from "@/lib/tipos";

import { Botao, Campo, Vazio } from "./ui";

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * O arquivo de um quadro: as tarefas concluídas que saíram das colunas.
 * Não é lixeira — é histórico: dá para procurar pelo título e trazer de
 * volta para a coluna de conclusão.
 */
export function ArquivoKanban({ quadro, tarefas }: { quadro: ResumoQuadro; tarefas: TarefaArquivada[] }) {
  const roteador = useRouter();
  const [termo, definirTermo] = useState("");
  const [ocupada, definirOcupada] = useState<string | null>(null);
  const sigla = siglaDoQuadro(quadro.nome);

  const visiveis = useMemo(() => {
    const alvo = normalizar(termo.trim());
    if (!alvo) return tarefas;
    return tarefas.filter((tarefa) => normalizar(`${sigla}-${tarefa.numero} ${tarefa.titulo}`).includes(alvo));
  }, [tarefas, termo, sigla]);

  async function desarquivar(caminho: string) {
    definirOcupada(caminho);
    const resposta = await acaoDesarquivarTarefa(caminho);
    definirOcupada(null);
    if (resposta.ok) roteador.refresh();
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-papel">
      <header className="flex shrink-0 items-center gap-3 border-b border-linha bg-superficie px-6 py-3">
        <Link
          href={urlDoQuadro(quadro.nome)}
          className="flex items-center gap-1 text-[12px] text-tinta-2 hover:text-tinta"
        >
          <ArrowLeft size={13} />
          {quadro.nome}
        </Link>
        <span className="text-tinta-3">/</span>
        <div className="min-w-0">
          <h1 className="truncate text-[16px] font-extrabold tracking-[-0.02em]">Arquivo</h1>
          <p className="text-[11.5px] text-tinta-2">
            {tarefas.length === 0
              ? "Nada arquivado ainda."
              : `${tarefas.length} ${tarefas.length === 1 ? "tarefa concluída" : "tarefas concluídas"} fora do quadro — em _arquivo/`}
          </p>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-5">
        <div className="mx-auto w-full max-w-3xl">
          {tarefas.length > 0 ? (
            <label className="mb-4 flex items-center gap-2">
              <Search size={14} className="shrink-0 text-tinta-3" />
              <Campo
                value={termo}
                onChange={(evento) => definirTermo(evento.target.value)}
                placeholder="Procurar no arquivo"
                autoFocus
              />
            </label>
          ) : null}

          {tarefas.length === 0 ? (
            <Vazio
              icone={<ArchiveRestore size={20} />}
              titulo="O arquivo está vazio"
              descricao="Tarefas concluídas vêm parar aqui pelo menu do cartão, pelo “Arquivar tudo” da coluna de conclusão, ou sozinhas depois de um tempo lá."
            />
          ) : visiveis.length === 0 ? (
            <p className="py-6 text-center text-[12.5px] text-tinta-3">Nada com esse nome no arquivo.</p>
          ) : (
            <ul className="lista-cartoes">
              {visiveis.map((tarefa) => (
                <li key={tarefa.caminho} className="cartao flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] tracking-wide text-tinta-3">
                      {sigla}-{tarefa.numero}
                    </p>
                    <p className="truncate text-[13px] font-medium text-tinta">{tarefa.titulo}</p>
                    <p className="text-[10.5px] text-tinta-3" title={`Arquivada em ${formatarDataHora(tarefa.arquivadoEm)}`}>
                      arquivada {formatarDataCurta(tarefa.arquivadoEm)}
                      {tarefa.prazo ? ` · prazo ${tarefa.prazo.split("-").reverse().join("/")}` : ""}
                    </p>
                  </div>
                  <Botao
                    variante="sutil"
                    disabled={ocupada === tarefa.caminho}
                    onClick={() => desarquivar(tarefa.caminho)}
                  >
                    <ArchiveRestore size={13} />
                    Desarquivar
                  </Botao>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
