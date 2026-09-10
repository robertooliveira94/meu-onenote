"use server";

import * as senhas from "@/lib/senhas";
import type { GrupoSenhas } from "@/lib/tipos";

/**
 * Ações do cofre de senhas. Ao contrário do resto do app, praticamente nada
 * aqui revalida a casca — o cofre não aparece em nenhuma lista fora da
 * própria tela de Senhas, então não há nada para atualizar por fora.
 */

export type RespostaSenhas = { ok: true; arvore: GrupoSenhas } | { ok: false; erro: string };
type Resposta = { ok: true; mensagem?: string } | { ok: false; erro: string };

export async function acaoStatusCofre(): Promise<{ existe: boolean; destrancado: boolean; minutosRestantes: number }> {
  const [existe, destrancado] = await Promise.all([senhas.cofreExiste(), Promise.resolve(senhas.estaDestrancado())]);
  return { existe, destrancado, minutosRestantes: senhas.minutosRestantes() };
}

export async function acaoCriarCofre(senhaMestra: string): Promise<RespostaSenhas> {
  if (senhaMestra.length < 8) return { ok: false, erro: "Use pelo menos 8 caracteres na senha mestra." };
  if (await senhas.cofreExiste()) return { ok: false, erro: "Já existe um cofre — destranque em vez de criar outro." };
  await senhas.criarCofre(senhaMestra);
  return { ok: true, arvore: senhas.obterArvore() };
}

export async function acaoDestrancar(senhaMestra: string): Promise<RespostaSenhas> {
  const certo = await senhas.destrancar(senhaMestra);
  if (!certo) return { ok: false, erro: "Senha mestra incorreta." };
  return { ok: true, arvore: senhas.obterArvore() };
}

export async function acaoTrancar(): Promise<void> {
  senhas.trancar();
}

export async function acaoObterArvore(): Promise<RespostaSenhas> {
  try {
    return { ok: true, arvore: senhas.obterArvore() };
  } catch {
    return { ok: false, erro: "O cofre está trancado." };
  }
}

function comTratamento(func: () => Promise<GrupoSenhas>): Promise<RespostaSenhas> {
  return func()
    .then((arvore) => ({ ok: true as const, arvore }))
    .catch((erro: unknown) => ({ ok: false as const, erro: erro instanceof Error ? erro.message : "Não deu certo." }));
}

export async function acaoCriarGrupo(idPai: string, nome: string): Promise<RespostaSenhas> {
  const limpo = nome.trim();
  if (!limpo) return { ok: false, erro: "Dê um nome ao grupo." };
  return comTratamento(() => senhas.criarGrupo(idPai, limpo));
}

export async function acaoRenomearGrupo(id: string, nome: string): Promise<RespostaSenhas> {
  const limpo = nome.trim();
  if (!limpo) return { ok: false, erro: "O nome não pode ficar em branco." };
  return comTratamento(() => senhas.renomearGrupo(id, limpo));
}

export async function acaoMoverGrupo(id: string, idNovoPai: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.moverGrupo(id, idNovoPai));
}

export async function acaoExcluirGrupo(id: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.excluirGrupo(id));
}

type CamposEntrada = { titulo: string; usuario: string; senha: string; url: string; notas: string };

export async function acaoCriarEntrada(idGrupo: string, campos: CamposEntrada): Promise<RespostaSenhas> {
  if (!campos.titulo.trim()) return { ok: false, erro: "Dê um nome a esta senha." };
  return comTratamento(() => senhas.criarEntrada(idGrupo, campos));
}

export async function acaoAtualizarEntrada(id: string, campos: CamposEntrada): Promise<RespostaSenhas> {
  if (!campos.titulo.trim()) return { ok: false, erro: "Dê um nome a esta senha." };
  return comTratamento(() => senhas.atualizarEntrada(id, campos));
}

export async function acaoMoverEntrada(id: string, idNovoGrupo: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.moverEntrada(id, idNovoGrupo));
}

export async function acaoExcluirEntrada(id: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.excluirEntrada(id));
}

export async function acaoExportarCsv(): Promise<Resposta> {
  try {
    return { ok: true, mensagem: senhas.exportarCsv() };
  } catch {
    return { ok: false, erro: "O cofre está trancado." };
  }
}

/** Bytes do `.kdbx` em base64 — assim dá pra mandar pro navegador virar download. */
export async function acaoBaixarCofre(): Promise<Resposta> {
  try {
    const bytes = await senhas.obterBytesDoCofre();
    return { ok: true, mensagem: bytes.toString("base64") };
  } catch {
    return { ok: false, erro: "O cofre está trancado." };
  }
}
