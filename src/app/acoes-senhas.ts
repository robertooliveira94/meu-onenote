"use server";

import * as senhas from "@/lib/senhas";
import type { CamposEntrada, ConfigSenhas, GrupoSenhas, ItemLixeiraSenha, VersaoSenha } from "@/lib/tipos";
import type { FaviconEntrada } from "@/lib/senhas";

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

/** Recebe um `.kdbx` em base64 e a senha mestra dele; só quando ainda não há cofre. */
export async function acaoImportarCofre(bytesBase64: string, senhaMestra: string): Promise<RespostaSenhas> {
  if (await senhas.cofreExiste()) return { ok: false, erro: "Já existe um cofre — destranque em vez de importar." };
  let bytes: Buffer;
  try {
    bytes = Buffer.from(bytesBase64, "base64");
  } catch {
    return { ok: false, erro: "Não deu para ler o arquivo." };
  }
  if (bytes.length === 0 || bytes.length > 25 * 1024 * 1024) {
    return { ok: false, erro: "Arquivo vazio ou grande demais para ser um cofre." };
  }
  const certo = await senhas.importarCofre(bytes, senhaMestra);
  if (!certo) return { ok: false, erro: "A senha não abre esse arquivo (ou não é um .kdbx válido)." };
  return { ok: true, arvore: senhas.obterArvore() };
}

export async function acaoDestrancar(senhaMestra: string): Promise<RespostaSenhas> {
  const certo = await senhas.destrancar(senhaMestra);
  if (!certo) return { ok: false, erro: "Senha mestra incorreta." };
  return { ok: true, arvore: senhas.obterArvore() };
}

/** "Manter aberto por…" no cabeçalho — só nesta sessão; `null` volta ao valor da config. */
export async function acaoDefinirTravaDaSessao(minutos: number | null): Promise<{ ok: true; minutos: number | null } | { ok: false; erro: string }> {
  try {
    return { ok: true, minutos: await senhas.definirTravaDaSessao(minutos) };
  } catch {
    return { ok: false, erro: "O cofre está trancado." };
  }
}

export async function acaoTrancar(): Promise<void> {
  await senhas.trancar();
}

export async function acaoObterConfig(): Promise<ConfigSenhas> {
  return senhas.obterConfig();
}

export async function acaoDefinirConfig(mudanca: Partial<ConfigSenhas>): Promise<ConfigSenhas> {
  return senhas.definirConfig(mudanca);
}

export async function acaoExcluirCofre(): Promise<Resposta> {
  await senhas.excluirCofre();
  return { ok: true };
}

export async function acaoTrocarSenhaMestra(senhaAtual: string, senhaNova: string): Promise<Resposta> {
  if (senhaNova.length < 8) return { ok: false, erro: "Use pelo menos 8 caracteres na nova senha." };
  try {
    const resultado = await senhas.trocarSenhaMestra(senhaAtual, senhaNova);
    if (resultado === "senha-atual-incorreta") return { ok: false, erro: "Senha atual incorreta." };
    return { ok: true };
  } catch {
    return { ok: false, erro: "O cofre está trancado." };
  }
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

export async function acaoCriarEntrada(
  idGrupo: string,
  campos: CamposEntrada,
  favicon?: FaviconEntrada,
): Promise<RespostaSenhas> {
  if (!campos.titulo.trim()) return { ok: false, erro: "Dê um nome a esta senha." };
  return comTratamento(() => senhas.criarEntrada(idGrupo, campos, favicon));
}

export async function acaoAtualizarEntrada(
  id: string,
  campos: CamposEntrada,
  favicon?: FaviconEntrada,
): Promise<RespostaSenhas> {
  if (!campos.titulo.trim()) return { ok: false, erro: "Dê um nome a esta senha." };
  return comTratamento(() => senhas.atualizarEntrada(id, campos, favicon));
}

export async function acaoObterHistorico(id: string): Promise<{ ok: true; versoes: VersaoSenha[] } | { ok: false; erro: string }> {
  try {
    return { ok: true, versoes: senhas.obterHistorico(id) };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para ler o histórico." };
  }
}

export async function acaoRestaurarVersao(id: string, indice: number): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.restaurarVersao(id, indice));
}

export async function acaoObterLixeira(): Promise<{ ok: true; itens: ItemLixeiraSenha[] } | { ok: false; erro: string }> {
  try {
    return { ok: true, itens: senhas.obterLixeira() };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para ler a lixeira." };
  }
}

export async function acaoRestaurarDaLixeira(id: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.restaurarDaLixeira(id));
}

export async function acaoExcluirDaLixeiraDeVez(id: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.excluirDaLixeiraDeVez(id));
}

export async function acaoEsvaziarLixeira(): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.esvaziarLixeira());
}

export async function acaoMoverEntrada(id: string, idNovoGrupo: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.moverEntrada(id, idNovoGrupo));
}

export async function acaoAdicionarAnexo(id: string, nome: string, bytesBase64: string): Promise<RespostaSenhas> {
  const nomeLimpo = nome.trim().slice(0, 200);
  if (!nomeLimpo) return { ok: false, erro: "O arquivo precisa de um nome." };
  const bytes = Buffer.from(bytesBase64, "base64");
  if (bytes.length === 0) return { ok: false, erro: "Arquivo vazio." };
  if (bytes.length > senhas.TAMANHO_MAXIMO_ANEXO) return { ok: false, erro: "Anexo grande demais (máximo 5 MB)." };
  return comTratamento(() => senhas.adicionarAnexo(id, nomeLimpo, bytes));
}

export async function acaoRemoverAnexo(id: string, nome: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.removerAnexo(id, nome));
}

/** Os bytes de um anexo, em base64, para baixar. */
export async function acaoBaixarAnexo(id: string, nome: string): Promise<Resposta> {
  try {
    return { ok: true, mensagem: Buffer.from(senhas.obterAnexo(id, nome)).toString("base64") };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu para ler o anexo." };
  }
}

export async function acaoFavoritarEntrada(id: string, favorita: boolean): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.favoritarEntrada(id, favorita));
}

export async function acaoRegistrarAcesso(id: string): Promise<RespostaSenhas> {
  return comTratamento(() => senhas.registrarAcesso(id));
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
