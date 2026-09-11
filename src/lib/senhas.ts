import fs from "node:fs/promises";
import path from "node:path";

import argon2 from "argon2";
import * as kdbxweb from "kdbxweb";

import { RAIZ } from "./caminhos";
import type { EntradaSenha, GrupoSenhas } from "./tipos";

/**
 * O cofre de senhas: um arquivo `.kdbx` de verdade (o mesmo formato do
 * KeePass), guardado ao lado das outras pastas de dados — mas, ao contrário
 * de uma nota ou um quadro, o conteúdo dele nunca fica legível em disco. É a
 * própria natureza de um gerenciador de senhas: o arquivo é opaco sem a
 * senha mestra, em qualquer editor que se abra ele.
 *
 * Como é `.kdbx` de verdade (Argon2id + AES-256), esse mesmo arquivo abre
 * direto no KeePassXC, KeePassDX, Strongbox e companhia — não existe
 * "exportar para outra plataforma", existe copiar o arquivo.
 */
const PASTA_SENHAS = "_senhas";
const CAMINHO_COFRE = path.join(RAIZ, PASTA_SENHAS, "cofre.kdbx");
const NOME_COFRE = "Senhas";

/** Tempo de inatividade até o cofre trancar sozinho. */
const ESPERA_TRAVAMENTO_MS = 15 * 60 * 1000;

/**
 * Custo do Argon2id — de propósito caro de calcular (ver o botão "Como
 * funciona" na tela do cofre): 64 MiB de memória, 3 repetições, 4 threads em
 * paralelo. Valores nessa faixa são o que a documentação do próprio Argon2
 * recomenda para uso interativo (não tão pesado a ponto da tela travar por
 * segundos ao destrancar, pesado o bastante para tornar força bruta caro).
 */
const ARGON2_MEMORIA_KIB = 64 * 1024;
const ARGON2_ITERACOES = 3;
const ARGON2_PARALELISMO = 4;

let argon2Ligado = false;
function ligarArgon2(): void {
  if (argon2Ligado) return;
  argon2Ligado = true;
  kdbxweb.CryptoEngine.setArgon2Impl(async (senha, sal, memoriaKib, iteracoes, tamanho, paralelismo, tipo, versao) => {
    const hash = await argon2.hash(Buffer.from(senha), {
      raw: true,
      salt: Buffer.from(sal),
      type: tipo,
      memoryCost: memoriaKib,
      timeCost: iteracoes,
      parallelism: paralelismo,
      hashLength: tamanho,
      version: versao,
    });
    return Uint8Array.from(hash).buffer;
  });
}
ligarArgon2();

/**
 * A chave do cofre destrancado mora só na memória do processo — nunca no
 * disco, nunca na sessão do navegador. Guardada em `globalThis` (e não numa
 * variável de módulo comum) só para sobreviver ao hot-reload do modo de
 * desenvolvimento, que troca o módulo mas não o processo Node.
 */
type Sessao = { db: kdbxweb.Kdbx; expiraEm: number };
const guardaGlobal = globalThis as unknown as { __cofreSessao?: Sessao };

function sessaoAtiva(): Sessao | null {
  const sessao = guardaGlobal.__cofreSessao;
  if (!sessao) return null;
  if (Date.now() > sessao.expiraEm) {
    guardaGlobal.__cofreSessao = undefined;
    return null;
  }
  return sessao;
}

function renovarSessao(db: kdbxweb.Kdbx): void {
  guardaGlobal.__cofreSessao = { db, expiraEm: Date.now() + ESPERA_TRAVAMENTO_MS };
}

/** Descarta a chave em memória — só reabre digitando a senha mestra de novo. */
export function trancar(): void {
  guardaGlobal.__cofreSessao = undefined;
}

export function estaDestrancado(): boolean {
  return sessaoAtiva() !== null;
}

export function minutosRestantes(): number {
  const sessao = sessaoAtiva();
  return sessao ? Math.max(0, Math.round((sessao.expiraEm - Date.now()) / 60000)) : 0;
}

export async function cofreExiste(): Promise<boolean> {
  try {
    await fs.access(CAMINHO_COFRE);
    return true;
  } catch {
    return false;
  }
}

/**
 * Apaga o cofre inteiro — sem lixeira, sem "desfazer": o `.kdbx` some do
 * disco de verdade. É por isso que a tela exige digitar uma palavra de
 * confirmação antes de chamar isto, em vez de só um clique.
 */
export async function excluirCofre(): Promise<void> {
  trancar();
  await fs.rm(CAMINHO_COFRE, { force: true });
}

async function salvarNoDisco(db: kdbxweb.Kdbx): Promise<void> {
  const bytes = await db.save();
  await fs.mkdir(path.dirname(CAMINHO_COFRE), { recursive: true });
  await fs.writeFile(CAMINHO_COFRE, Buffer.from(bytes));
}

/** Cria um cofre novo — nasce já com um grupo "Geral" para as primeiras senhas. */
export async function criarCofre(senhaMestra: string): Promise<void> {
  const credenciais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaMestra));
  const db = kdbxweb.Kdbx.create(credenciais, NOME_COFRE);
  db.setKdf(kdbxweb.Consts.KdfId.Argon2id);
  const parametros = db.header.kdfParameters;
  if (parametros) {
    parametros.set("M", kdbxweb.VarDictionary.ValueType.UInt64, new kdbxweb.Int64(ARGON2_MEMORIA_KIB * 1024));
    parametros.set("I", kdbxweb.VarDictionary.ValueType.UInt64, new kdbxweb.Int64(ARGON2_ITERACOES));
    parametros.set("P", kdbxweb.VarDictionary.ValueType.UInt32, ARGON2_PARALELISMO);
  }
  db.createGroup(db.getDefaultGroup(), "Geral");
  await salvarNoDisco(db);
  renovarSessao(db);
}

/**
 * Adota um `.kdbx` que a pessoa já tem (de um KeePass, de uma cópia baixada
 * daqui...). Confirma que a senha mestra abre o arquivo antes de gravar —
 * assim não fica um cofre em disco que ninguém consegue destrancar.
 */
export async function importarCofre(bytes: Buffer, senhaMestra: string): Promise<boolean> {
  const credenciais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaMestra));
  let db: kdbxweb.Kdbx;
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    db = await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciais);
  } catch {
    return false;
  }
  await fs.mkdir(path.dirname(CAMINHO_COFRE), { recursive: true });
  await fs.writeFile(CAMINHO_COFRE, bytes);
  renovarSessao(db);
  return true;
}

/** `true` se a senha estava certa (e o cofre já fica destrancado); `false` senão. */
export async function destrancar(senhaMestra: string): Promise<boolean> {
  const bytes = await fs.readFile(CAMINHO_COFRE);
  const credenciais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaMestra));
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const db = await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciais);
    renovarSessao(db);
    return true;
  } catch {
    return false;
  }
}

export type ResultadoTroca = "ok" | "senha-atual-incorreta";

/**
 * Troca a senha mestra preservando todo o conteúdo — recifra o cofre com a
 * nova senha, sem passar pela criação de um cofre novo. Confere a senha
 * atual de novo antes de trocar (recarregando o arquivo do zero com ela),
 * mesmo já estando destrancado: sem essa conferência, quem achasse a sessão
 * aberta e sem vigilância poderia trocar a senha mestra sozinho.
 */
export async function trocarSenhaMestra(senhaAtual: string, senhaNova: string): Promise<ResultadoTroca> {
  const db = usarSessao();
  const bytes = await fs.readFile(CAMINHO_COFRE);
  const credenciaisAtuais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaAtual));
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciaisAtuais);
  } catch {
    return "senha-atual-incorreta";
  }
  await db.credentials.setPassword(kdbxweb.ProtectedValue.fromString(senhaNova));
  await salvarNoDisco(db);
  renovarSessao(db);
  return "ok";
}

class CofreTrancado extends Error {
  constructor() {
    super("O cofre está trancado.");
  }
}

/** Toda operação sobre o conteúdo passa por aqui — garante a trava e renova o tempo de sessão a cada uso. */
function usarSessao(): kdbxweb.Kdbx {
  const sessao = sessaoAtiva();
  if (!sessao) throw new CofreTrancado();
  renovarSessao(sessao.db);
  return sessao.db;
}

function textoDoCampo(valor: string | kdbxweb.ProtectedValue | undefined): string {
  if (valor === undefined) return "";
  return typeof valor === "string" ? valor : valor.getText();
}

function serializarEntrada(entrada: kdbxweb.KdbxEntry): EntradaSenha {
  return {
    id: entrada.uuid.id,
    titulo: textoDoCampo(entrada.fields.get("Title")),
    usuario: textoDoCampo(entrada.fields.get("UserName")),
    senha: textoDoCampo(entrada.fields.get("Password")),
    url: textoDoCampo(entrada.fields.get("URL")),
    notas: textoDoCampo(entrada.fields.get("Notes")),
    atualizadoEm: (entrada.times.lastModTime ?? new Date()).toISOString(),
  };
}

function serializarGrupo(grupo: kdbxweb.KdbxGroup, idLixeira: string | undefined): GrupoSenhas {
  return {
    id: grupo.uuid.id,
    nome: grupo.name ?? "",
    grupos: grupo.groups
      .filter((sub) => sub.uuid.id !== idLixeira)
      .map((sub) => serializarGrupo(sub, idLixeira)),
    entradas: grupo.entries.map(serializarEntrada),
  };
}

/** Toda a árvore do cofre (menos a lixeira interna do KDBX, que este app não expõe). */
export function obterArvore(): GrupoSenhas {
  const db = usarSessao();
  return serializarGrupo(db.getDefaultGroup(), db.meta.recycleBinUuid?.id);
}

function encontrarGrupo(db: kdbxweb.Kdbx, id: string): kdbxweb.KdbxGroup {
  const grupo = db.getGroup(id);
  if (!grupo) throw new Error("Grupo não encontrado.");
  return grupo;
}

function encontrarEntrada(db: kdbxweb.Kdbx, id: string): kdbxweb.KdbxEntry {
  for (const entrada of db.getDefaultGroup().allEntries()) {
    if (entrada.uuid.id === id) return entrada;
  }
  throw new Error("Senha não encontrada.");
}

export async function criarGrupo(idPai: string, nome: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  db.createGroup(encontrarGrupo(db, idPai), nome);
  await salvarNoDisco(db);
  return obterArvore();
}

export async function renomearGrupo(id: string, nome: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  encontrarGrupo(db, id).name = nome;
  await salvarNoDisco(db);
  return obterArvore();
}

export async function moverGrupo(id: string, idNovoPai: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  db.move(encontrarGrupo(db, id), encontrarGrupo(db, idNovoPai));
  await salvarNoDisco(db);
  return obterArvore();
}

/** Move para a lixeira interna do `.kdbx` — some da lista, mas não é apagado de vez. */
export async function excluirGrupo(id: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  db.remove(encontrarGrupo(db, id));
  await salvarNoDisco(db);
  return obterArvore();
}

type CamposEntrada = { titulo: string; usuario: string; senha: string; url: string; notas: string };

function aplicarCampos(entrada: kdbxweb.KdbxEntry, campos: CamposEntrada): void {
  entrada.fields.set("Title", campos.titulo);
  entrada.fields.set("UserName", campos.usuario);
  entrada.fields.set("Password", kdbxweb.ProtectedValue.fromString(campos.senha));
  entrada.fields.set("URL", campos.url);
  entrada.fields.set("Notes", campos.notas);
}

export async function criarEntrada(idGrupo: string, campos: CamposEntrada): Promise<GrupoSenhas> {
  const db = usarSessao();
  const entrada = db.createEntry(encontrarGrupo(db, idGrupo));
  aplicarCampos(entrada, campos);
  await salvarNoDisco(db);
  return obterArvore();
}

/** Guarda a versão anterior no histórico do próprio `.kdbx` antes de sobrescrever. */
export async function atualizarEntrada(id: string, campos: CamposEntrada): Promise<GrupoSenhas> {
  const db = usarSessao();
  const entrada = encontrarEntrada(db, id);
  entrada.pushHistory();
  aplicarCampos(entrada, campos);
  entrada.times.lastModTime = new Date();
  db.cleanup({ historyRules: true });
  await salvarNoDisco(db);
  return obterArvore();
}

export async function moverEntrada(id: string, idNovoGrupo: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  db.move(encontrarEntrada(db, id), encontrarGrupo(db, idNovoGrupo));
  await salvarNoDisco(db);
  return obterArvore();
}

export async function excluirEntrada(id: string): Promise<GrupoSenhas> {
  const db = usarSessao();
  db.remove(encontrarEntrada(db, id));
  await salvarNoDisco(db);
  return obterArvore();
}

function linhaCsv(campos: string[]): string {
  return campos
    .map((campo) => (/[",\n]/.test(campo) ? `"${campo.replace(/"/g, '""')}"` : campo))
    .join(",");
}

/**
 * Plano B de exportação, em texto puro — pensado só para o caso extremo de
 * migrar para um app que nem leia `.kdbx`. Cabeçalhos em inglês minúsculo
 * porque é o que o importador do Chrome reconhece sem precisar mapear coluna
 * nenhuma na mão; os demais (Bitwarden, 1Password...) deixam mapear.
 */
export function exportarCsv(): string {
  const db = usarSessao();
  const linhas = ["name,url,username,password,note,folder"];
  function percorrer(grupo: kdbxweb.KdbxGroup, caminho: string): void {
    if (grupo.uuid.id === db.meta.recycleBinUuid?.id) return;
    for (const entrada of grupo.entries) {
      const dados = serializarEntrada(entrada);
      linhas.push(linhaCsv([dados.titulo, dados.url, dados.usuario, dados.senha, dados.notas, caminho]));
    }
    for (const sub of grupo.groups) {
      percorrer(sub, caminho ? `${caminho}/${sub.name ?? ""}` : (sub.name ?? ""));
    }
  }
  percorrer(db.getDefaultGroup(), "");
  return linhas.join("\r\n");
}

/** Os bytes crus do `.kdbx` — a forma segura de exportar: o arquivo continua cifrado. */
export async function obterBytesDoCofre(): Promise<Buffer> {
  usarSessao();
  return fs.readFile(CAMINHO_COFRE);
}
