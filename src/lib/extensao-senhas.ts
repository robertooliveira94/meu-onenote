import type { EntradaSenha, GrupoSenhas } from "./tipos";
import * as senhas from "./senhas";

export type EntradaSenhaExtensao = Pick<
  EntradaSenha,
  "id" | "titulo" | "usuario" | "senha" | "url" | "temFavicon"
>;

export type GrupoSenhaExtensao = {
  id: string;
  nome: string;
  grupos: GrupoSenhaExtensao[];
  entradas: EntradaSenhaExtensao[];
};

function origemDaExtensao(requisicao: Request): string | null {
  const origem = requisicao.headers.get("origin");
  return origem?.startsWith("chrome-extension://") || origem?.startsWith("moz-extension://") ? origem : null;
}

function tokenDaRequisicao(requisicao: Request): string | null {
  const cabecalho = requisicao.headers.get("authorization") ?? "";
  return cabecalho.startsWith("Bearer ") ? cabecalho.slice(7).trim() || null : null;
}

/** Autoriza somente a extensão que acabou de provar conhecer a senha mestra, nesta abertura do cofre. */
export function emitirAutorizacao(requisicao: Request, minutos: number): string {
  const origem = origemDaExtensao(requisicao);
  if (!origem || !senhas.estaDestrancado()) throw new Error("Não foi possível autorizar esta extensão.");
  return senhas.emitirAutorizacaoDaExtensao(minutos);
}

function minutosDaRequisicao(requisicao: Request): number {
  const token = tokenDaRequisicao(requisicao);
  if (!token) return 0;
  return senhas.minutosDaAutorizacaoDaExtensao(token);
}

export function estaAutorizada(requisicao: Request): boolean {
  return minutosDaRequisicao(requisicao) > 0;
}

export function minutosRestantes(requisicao: Request): number {
  return minutosDaRequisicao(requisicao);
}

export function paraExtensao(grupo: GrupoSenhas): GrupoSenhaExtensao {
  return {
    id: grupo.id,
    nome: grupo.nome,
    grupos: grupo.grupos.map(paraExtensao),
    entradas: grupo.entradas.map(({ id, titulo, usuario, senha, url, temFavicon }) => ({
      id,
      titulo,
      usuario,
      senha,
      url,
      temFavicon,
    })),
  };
}
