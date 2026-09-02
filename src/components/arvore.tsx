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
import type { Caderno, Modelo, Secao } from "@/lib/tipos";

import { DialogoConfirmar, DialogoCor, DialogoIcone, DialogoMover, DialogoNome } from "./dialogos";
import { DialogoNovaPagina } from "./dialogo-nova-pagina";
import { BotaoIcone, ItemMenu, Menu, RotuloMenu, SeparadorMenu } from "./ui";

/**
 * O que uma ação mexe — caderno ou seção, ambos representados do mesmo jeito
 * aqui (só o caderno carrega cor/ícone). Existe separado de `Caderno`/`Secao`
 * porque os diálogos abaixo não precisam saber a diferença.
 */
type Alvo = {
  caminho: string;
  nome: string;
  ehCaderno: boolean;
  cor?: string;
  icone?: string;
};

type Acao = {
  tipo: "nova-secao" | "nova-pagina" | "renomear" | "mover" | "cor" | "icone" | "excluir";
  alvo: Alvo;
} | null;

const CHAVE_RECOLHIDOS = "cadernos-recolhidos";

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
 * A árvore é a espinha do aplicativo: caderno e suas seções — exatamente as
 * pastas que existem no disco, na mesma ordem. Hierarquia fixa de 2 níveis
 * de pasta (a página, 3º nível, é sempre um arquivo, nunca aparece aqui como
 * nó expansível) — nada de seção dentro de seção.
 */
export function Arvore({ cadernos, modelos }: { cadernos: Caderno[]; modelos: Modelo[] }) {
  const caminhoAtual = usePathname();
  const roteador = useRouter();
  const [recolhidos, definirRecolhidos] = useState<Set<string>>(new Set());
  const [acao, definirAcao] = useState<Acao>(null);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem(CHAVE_RECOLHIDOS);
      if (salvo) definirRecolhidos(new Set(JSON.parse(salvo) as string[]));
    } catch {
      // Preferência de exibição não vale um erro na tela.
    }
  }, []);

  function alternar(caminho: string) {
    definirRecolhidos((atual) => {
      const proximo = new Set(atual);
      if (proximo.has(caminho)) proximo.delete(caminho);
      else proximo.add(caminho);
      try {
        localStorage.setItem(CHAVE_RECOLHIDOS, JSON.stringify([...proximo]));
      } catch {
        // Sem espaço no navegador: segue sem lembrar.
      }
      return proximo;
    });
  }

  const fechar = () => definirAcao(null);
  const alvo = acao?.alvo ?? null;

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
            <LinhaCaderno
              key={caderno.caminho}
              caderno={caderno}
              aberto={!recolhidos.has(caderno.caminho)}
              aoAlternar={() => alternar(caderno.caminho)}
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
        tipo="secao"
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
        descricao={
          alvo?.ehCaderno
            ? "O caderno e tudo que está dentro (seções e páginas) vão para a lixeira. Dá para restaurar depois."
            : "A seção e tudo que está dentro vão para a lixeira. Dá para restaurar depois."
        }
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

function LinhaCaderno({
  caderno,
  aberto,
  aoAlternar,
  caminhoAtual,
  aoAgir,
}: {
  caderno: Caderno;
  aberto: boolean;
  aoAlternar: () => void;
  caminhoAtual: string;
  aoAgir: (acao: Acao) => void;
}) {
  const roteador = useRouter();
  const temSecoes = caderno.secoes.length > 0;
  const endereco = urlDaSecao(caderno.caminho);
  // Vale tanto para o caderno aberto quanto para uma nota dentro dele.
  const ativa =
    caminhoAtual === endereco ||
    decodeURIComponent(caminhoAtual).startsWith(`/nota/${caderno.caminho}/`);
  const totalDePaginas = caderno.secoes.reduce((soma, secao) => soma + secao.quantidadePaginas, 0);
  const alvo: Alvo = {
    caminho: caderno.caminho,
    nome: caderno.nome,
    ehCaderno: true,
    cor: caderno.cor,
    icone: caderno.icone,
  };

  return (
    <div>
      <div
        className={clsx(
          "group relative flex items-center gap-0.5 rounded-md pr-1 transition-colors",
          ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
        )}
      >
        {/* Barra na cor do caderno marca onde você está sem precisar de negrito. */}
        {ativa ? (
          <span
            className="barra-ativa absolute top-1 bottom-1 left-0 w-[2.5px] rounded-full"
            style={{ background: caderno.cor }}
            aria-hidden
          />
        ) : null}

        <button
          type="button"
          onClick={aoAlternar}
          aria-label={aberto ? `Recolher ${caderno.nome}` : `Expandir ${caderno.nome}`}
          aria-expanded={aberto}
          className={clsx(
            "flex size-5 shrink-0 items-center justify-center rounded text-tinta-3 transition-colors hover:text-tinta",
            !temSecoes && "invisible",
          )}
        >
          {aberto ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        </button>

        <Link href={endereco} className="flex min-w-0 flex-1 items-center gap-2 py-[5px]">
          <span className="shrink-0 text-[14px] leading-none" aria-hidden>
            {caderno.icone}
          </span>
          <span
            className={clsx("truncate text-[12.5px]", ativa ? "font-medium text-tinta" : "text-tinta")}
          >
            {caderno.nome}
          </span>
          {/* A contagem some no hover para dar lugar aos botões de ação. */}
          {totalDePaginas > 0 ? (
            <span className="ml-auto shrink-0 pl-1 text-[10.5px] text-tinta-3 tabular-nums transition-opacity group-hover:opacity-0">
              {totalDePaginas}
            </span>
          ) : null}
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
                  icone={<FolderPlus size={14} />}
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
                    await baixarSecao(caderno.caminho);
                  }}
                >
                  Exportar em markdown
                </ItemMenu>
                <SeparadorMenu />
                <RotuloMenu>Aparência</RotuloMenu>
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

      {aberto && temSecoes ? (
        <div>
          {caderno.secoes.map((secao) => (
            <LinhaSecao
              key={secao.caminho}
              caderno={caderno}
              secao={secao}
              caminhoAtual={caminhoAtual}
              aoAgir={aoAgir}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Uma seção — sempre folha: nunca tem outra pasta dentro, só páginas. */
function LinhaSecao({
  caderno,
  secao,
  caminhoAtual,
  aoAgir,
}: {
  caderno: Caderno;
  secao: Secao;
  caminhoAtual: string;
  aoAgir: (acao: Acao) => void;
}) {
  const roteador = useRouter();
  const endereco = urlDaSecao(secao.caminho);
  const ativa =
    caminhoAtual === endereco ||
    decodeURIComponent(caminhoAtual).startsWith(`/nota/${secao.caminho}/`);
  const alvo: Alvo = { caminho: secao.caminho, nome: secao.nome, ehCaderno: false };

  return (
    <div
      className={clsx(
        "group relative flex items-center gap-0.5 rounded-md pr-1 transition-colors",
        ativa ? "bg-realce-medio" : "hover:bg-realce-fraco",
      )}
      style={{ paddingLeft: "13px" }}
    >
      {ativa ? (
        <span
          className="barra-ativa absolute top-1 bottom-1 left-0 w-[2.5px] rounded-full"
          style={{ background: caderno.cor }}
          aria-hidden
        />
      ) : null}

      {/* Sem seta de expandir — uma seção nunca tem outra pasta dentro. O
          espaço fica reservado vazio só para o texto continuar alinhado com
          o do caderno acima. */}
      <span className="size-5 shrink-0" aria-hidden />

      <Link href={endereco} className="flex min-w-0 flex-1 items-center gap-2 py-[5px]">
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
