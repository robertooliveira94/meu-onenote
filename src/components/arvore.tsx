"use client";

import clsx from "clsx";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Download,
  FilePlus2,
  FolderPlus,
  MoreHorizontal,
  MoveRight,
  Palette,
  Pencil,
  Plus,
  Smile,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  acaoCriarSecao,
  acaoDefinirCorCaderno,
  acaoDefinirIconeCaderno,
  acaoExcluir,
  acaoExportarSecao,
  acaoMover,
  acaoRenomear,
  acaoReordenar,
} from "@/app/acoes";
import { CORES_CADERNO, ICONES_DISPONIVEIS } from "@/lib/cores";
import { urlDaSecao } from "@/lib/rotas";
import type { Modelo, NoArvore } from "@/lib/tipos";

import { DialogoConfirmar, DialogoCor, DialogoIcone, DialogoMover, DialogoNome } from "./dialogos";
import { DialogoNovaPagina } from "./dialogo-nova-pagina";
import { BotaoIcone, ItemMenu, Menu, RotuloMenu, SeparadorMenu } from "./ui";

type Acao = {
  tipo: "nova-secao" | "nova-pagina" | "renomear" | "mover" | "cor" | "icone" | "excluir";
  no: NoArvore;
} | null;

const CHAVE_RECOLHIDAS = "secoes-recolhidas";

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

/**
 * A árvore é a espinha do aplicativo: caderno, seção, subseção — exatamente as
 * pastas que existem no disco, na mesma ordem.
 */
export function Arvore({ cadernos, modelos }: { cadernos: NoArvore[]; modelos: Modelo[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [recolhidas, definirRecolhidas] = useState<Set<string>>(new Set());
  const [acao, definirAcao] = useState<Acao>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_RECOLHIDAS);
      if (salvo) definirRecolhidas(new Set(JSON.parse(salvo) as string[]));
    } catch {
      // Preferência de exibição não vale um erro na tela.
    }
  }, []);

  function alternar(caminho: string) {
    definirRecolhidas((atual) => {
      const proxima = new Set(atual);
      if (proxima.has(caminho)) proxima.delete(caminho);
      else proxima.add(caminho);
      try {
        localStorage.setItem(CHAVE_RECOLHIDAS, JSON.stringify([...proxima]));
      } catch {
        // Sem espaço no navegador: segue sem lembrar.
      }
      return proxima;
    });
  }

  const fechar = () => definirAcao(null);
  const alvo = acao?.no ?? null;

  /**
   * A revalidação do servidor às vezes chega depois da próxima ação do
   * usuário (mais ainda em modo desenvolvimento, com a recompilação lenta).
   * Chamar isso depois de cada ação bem-sucedida garante que ícone, cor,
   * nome e afins apareçam na hora, em vez de só quando alguma outra ação
   * acontecer depois.
   */
  function atualizar(): void {
    roteador.refresh();
  }

  /** A página aberta está dentro da pasta que está prestes a ser excluída? */
  function estaDentroDoQueSeraExcluido(caminhoExcluido: string): boolean {
    const semPrefixo = decodeURIComponent(caminhoAtual).replace(/^\/(secao|nota)\//, "");
    if (semPrefixo === caminhoAtual) return false;
    return semPrefixo === caminhoExcluido || semPrefixo.startsWith(`${caminhoExcluido}/`);
  }

  /** Sobe um nível a partir de um caminho; "" quando já é o nível principal. */
  function pastaPaiDe(caminho: string): string {
    const partes = caminho.split("/");
    partes.pop();
    return partes.join("/");
  }

  return (
    <>
      <div className="px-3.5 pt-1 pb-1.5">
        <span className="text-[10.5px] font-bold tracking-[0.08em] text-tinta-3 uppercase">
          Cadernos
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-3" aria-label="Cadernos e seções">
        {cadernos.length === 0 ? (
          <p className="px-2 py-3 text-[12px] leading-relaxed text-tinta-3">
            Nenhum caderno ainda. Use “Novo caderno” acima — ele vira uma pasta dentro de{" "}
            <span className="font-mono">dados/</span>.
          </p>
        ) : (
          cadernos.map((caderno) => (
            <Ramo
              key={caderno.caminho}
              no={caderno}
              nivel={0}
              recolhidas={recolhidas}
              aoAlternar={alternar}
              caminhoAtual={caminhoAtual}
              aoAgir={definirAcao}
            />
          ))
        )}
      </nav>

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
        titulo="Renomear"
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
        cadernos={cadernos}
        caminhoAtual={alvo?.caminho ?? ""}
        aoFechar={fechar}
        aoConfirmar={async (destino) => {
          if (!alvo) return null;
          const resposta = await acaoMover(alvo.caminho, destino);
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
        descricao="A seção e tudo que está dentro vão para a lixeira. Dá para restaurar depois."
        textoBotao="Mandar para a lixeira"
        aoFechar={fechar}
        aoConfirmar={async () => {
          if (!alvo) return null;
          const resposta = await acaoExcluir(alvo.caminho);
          if (!resposta.ok) return resposta.erro;
          // Se a página aberta estava dentro do que acabou de ser excluído,
          // ficar nela mostraria uma "seção fantasma" — parece que não apagou.
          if (estaDentroDoQueSeraExcluido(alvo.caminho)) {
            const pai = pastaPaiDe(alvo.caminho);
            roteador.push(pai ? urlDaSecao(pai) : "/");
          }
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
    </>
  );
}

function Ramo({
  no,
  nivel,
  recolhidas,
  aoAlternar,
  caminhoAtual,
  aoAgir,
}: {
  no: NoArvore;
  nivel: number;
  recolhidas: Set<string>;
  aoAlternar: (caminho: string) => void;
  caminhoAtual: string;
  aoAgir: (acao: Acao) => void;
}) {
  const roteador = useRouter();
  const aberta = !recolhidas.has(no.caminho);
  const temFilhos = no.filhos.length > 0;
  const endereco = urlDaSecao(no.caminho);
  const ehCaderno = nivel === 0;
  // Vale tanto para a seção aberta quanto para uma nota dentro dela.
  const ativa =
    caminhoAtual === endereco ||
    decodeURIComponent(caminhoAtual).startsWith(`/nota/${no.caminho}/`);

  return (
    <div>
      <div
        className={clsx(
          "group relative flex items-center gap-0.5 rounded-md pr-1 transition-colors",
          ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
        )}
        style={{ paddingLeft: `${nivel * 13}px` }}
      >
        {/* Barra na cor do caderno marca onde você está sem precisar de negrito. */}
        {ativa ? (
          <span
            className="barra-ativa absolute top-1 bottom-1 left-0 w-[2.5px] rounded-full"
            style={{ background: no.cor }}
            aria-hidden
          />
        ) : null}

        <button
          type="button"
          onClick={() => aoAlternar(no.caminho)}
          aria-label={aberta ? `Recolher ${no.nome}` : `Expandir ${no.nome}`}
          aria-expanded={aberta}
          className={clsx(
            "flex size-5 shrink-0 items-center justify-center rounded text-tinta-3 transition-colors hover:text-tinta",
            !temFilhos && "invisible",
          )}
        >
          {aberta ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <Link href={endereco} className="flex min-w-0 flex-1 items-center gap-2 py-[5px]">
          {ehCaderno ? (
            <span className="shrink-0 text-[14px] leading-none" aria-hidden>
              {no.icone}
            </span>
          ) : (
            <span
              className="size-1.5 shrink-0 rounded-full opacity-60"
              style={{ background: no.cor }}
              aria-hidden
            />
          )}
          <span
            className={clsx(
              "truncate text-[12.5px]",
              ativa ? "font-medium text-tinta" : ehCaderno ? "text-tinta" : "text-tinta-2",
            )}
          >
            {no.nome}
          </span>
          {/* A contagem some no hover para dar lugar aos botões de ação. */}
          {no.quantidadePaginas > 0 ? (
            <span className="ml-auto shrink-0 pl-1 text-[10.5px] text-tinta-3 tabular-nums transition-opacity group-hover:opacity-0">
              {no.quantidadePaginas}
            </span>
          ) : null}
        </Link>

        <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <BotaoIcone
            rotulo={`Nova página em ${no.nome}`}
            onClick={() => aoAgir({ tipo: "nova-pagina", no })}
            className="size-6"
          >
            <Plus size={13} />
          </BotaoIcone>

          <Menu
            gatilho={(abrir) => (
              <BotaoIcone rotulo={`Opções de ${no.nome}`} onClick={abrir} className="size-6">
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
                    aoAgir({ tipo: "nova-pagina", no });
                  }}
                >
                  Nova página
                </ItemMenu>
                <ItemMenu
                  icone={<FolderPlus size={14} />}
                  onClick={() => {
                    fechar();
                    aoAgir({ tipo: "nova-secao", no });
                  }}
                >
                  Nova seção dentro
                </ItemMenu>
                <SeparadorMenu />
                <ItemMenu
                  icone={<Pencil size={14} />}
                  onClick={() => {
                    fechar();
                    aoAgir({ tipo: "renomear", no });
                  }}
                >
                  Renomear
                </ItemMenu>
                <ItemMenu
                  icone={<MoveRight size={14} />}
                  onClick={() => {
                    fechar();
                    aoAgir({ tipo: "mover", no });
                  }}
                >
                  Mover para…
                </ItemMenu>
                <ItemMenu
                  icone={<Download size={14} />}
                  onClick={async () => {
                    fechar();
                    await baixarSecao(no.caminho);
                  }}
                >
                  Exportar em markdown
                </ItemMenu>
                {ehCaderno ? (
                  <>
                    <SeparadorMenu />
                    <RotuloMenu>Aparência</RotuloMenu>
                    <ItemMenu
                      icone={<Smile size={14} />}
                      onClick={() => {
                        fechar();
                        aoAgir({ tipo: "icone", no });
                      }}
                    >
                      Ícone do caderno
                    </ItemMenu>
                    <ItemMenu
                      icone={<Palette size={14} />}
                      onClick={() => {
                        fechar();
                        aoAgir({ tipo: "cor", no });
                      }}
                    >
                      Cor do caderno
                    </ItemMenu>
                  </>
                ) : null}
                <SeparadorMenu />
                <ItemMenu
                  icone={<ArrowUp size={14} />}
                  onClick={async () => {
                    fechar();
                    await acaoReordenar(no.caminho, -1, "pasta");
                    roteador.refresh();
                  }}
                >
                  Subir
                </ItemMenu>
                <ItemMenu
                  icone={<ArrowDown size={14} />}
                  onClick={async () => {
                    fechar();
                    await acaoReordenar(no.caminho, 1, "pasta");
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
                    aoAgir({ tipo: "excluir", no });
                  }}
                >
                  Excluir
                </ItemMenu>
              </>
            )}
          </Menu>
        </div>
      </div>

      {aberta && temFilhos ? (
        <div>
          {no.filhos.map((filho) => (
            <Ramo
              key={filho.caminho}
              no={filho}
              nivel={nivel + 1}
              recolhidas={recolhidas}
              aoAlternar={aoAlternar}
              caminhoAtual={caminhoAtual}
              aoAgir={aoAgir}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
