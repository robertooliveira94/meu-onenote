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
/**
 * Gravar o `.kdbx` refaz o KDF (Argon2id) inteiro a cada `save()` — o
 * kdbxweb troca o sal a cada gravação. Fazer isso a cada clique (criar
 * grupo, renomear, arrastar, editar senha) deixava tudo lento. Então as
 * mudanças são aplicadas na hora à cópia em memória (que é a fonte da
 * verdade enquanto o cofre está aberto) e a gravação em disco é adiada
 * ~1s depois da última mudança. Trancar (na mão ou por inatividade)
 * força a gravação antes de descartar a chave.
 */
const ESPERA_SALVAR_MS = 900;

type Sessao = {
  db: kdbxweb.Kdbx;
  expiraEm: number;
  sujo: boolean;
  timerSalvar: ReturnType<typeof setTimeout> | null;
  salvando: Promise<void> | null;
};
const guardaGlobal = globalThis as unknown as { __cofreSessao?: Sessao };

function sessaoAtiva(): Sessao | null {
  const sessao = guardaGlobal.__cofreSessao;
  if (!sessao) return null;
  if (Date.now() > sessao.expiraEm) {
    guardaGlobal.__cofreSessao = undefined;
    // Grava o que estava pendente antes de largar a chave (o processo
    // segue vivo, então a gravação completa mesmo sem ninguém esperando).
    void descarregar(sessao);
    return null;
  }
  return sessao;
}

/** Começa uma sessão nova (criar / importar / destrancar). */
function abrirSessao(db: kdbxweb.Kdbx): void {
  guardaGlobal.__cofreSessao = {
    db,
    expiraEm: Date.now() + ESPERA_TRAVAMENTO_MS,
    sujo: false,
    timerSalvar: null,
    salvando: null,
  };
}

/** Adia o relógio da trava por inatividade — chamado a cada uso. */
function tocarSessao(sessao: Sessao): void {
  sessao.expiraEm = Date.now() + ESPERA_TRAVAMENTO_MS;
}

/** Marca a sessão como tendo mudança não gravada e (re)agenda a gravação. */
function marcarSujo(sessao: Sessao): void {
  sessao.sujo = true;
  if (sessao.timerSalvar) clearTimeout(sessao.timerSalvar);
  sessao.timerSalvar = setTimeout(() => void descarregar(sessao), ESPERA_SALVAR_MS);
}

/** Grava a sessão em disco agora, se houver algo pendente. */
async function descarregar(sessao: Sessao): Promise<void> {
  if (sessao.timerSalvar) {
    clearTimeout(sessao.timerSalvar);
    sessao.timerSalvar = null;
  }
  if (sessao.salvando) await sessao.salvando;
  if (!sessao.sujo) return;
  sessao.sujo = false;
  sessao.salvando = salvarNoDisco(sessao.db).finally(() => {
    sessao.salvando = null;
  });
  await sessao.salvando;
}

/** Descarta a chave em memória — só reabre digitando a senha mestra de novo. */
export async function trancar(): Promise<void> {
  const sessao = guardaGlobal.__cofreSessao;
  guardaGlobal.__cofreSessao = undefined;
  if (sessao) {
    try {
      await descarregar(sessao);
    } catch {
      // Falha ao gravar na hora de trancar: nada a fazer aqui além de não
      // travar a interface. O conteúdo em disco fica na versão anterior.
    }
  }
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
  const sessao = guardaGlobal.__cofreSessao;
  if (sessao?.timerSalvar) clearTimeout(sessao.timerSalvar);
  guardaGlobal.__cofreSessao = undefined;
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
  abrirSessao(db);
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
  abrirSessao(db);
  return true;
}

/** `true` se a senha estava certa (e o cofre já fica destrancado); `false` senão. */
export async function destrancar(senhaMestra: string): Promise<boolean> {
  const bytes = await fs.readFile(CAMINHO_COFRE);
  const credenciais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaMestra));
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const db = await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciais);
    abrirSessao(db);
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
  const sessao = sessaoEmUso();
  const bytes = await fs.readFile(CAMINHO_COFRE);
  const credenciaisAtuais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaAtual));
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciaisAtuais);
  } catch {
    return "senha-atual-incorreta";
  }
  await sessao.db.credentials.setPassword(kdbxweb.ProtectedValue.fromString(senhaNova));
  // Grava agora (não adia): a senha nova precisa estar no disco já, e este
  // save leva junto qualquer mudança de conteúdo que estivesse pendente.
  if (sessao.timerSalvar) clearTimeout(sessao.timerSalvar);
  sessao.timerSalvar = null;
  sessao.sujo = false;
  await salvarNoDisco(sessao.db);
  tocarSessao(sessao);
  return "ok";
}

class CofreTrancado extends Error {
  constructor() {
    super("O cofre está trancado.");
  }
}

/** Toda leitura do conteúdo passa por aqui — garante a trava e renova o tempo de sessão a cada uso. */
function usarSessao(): kdbxweb.Kdbx {
  return sessaoEmUso().db;
}

function sessaoEmUso(): Sessao {
  const sessao = sessaoAtiva();
  if (!sessao) throw new CofreTrancado();
  tocarSessao(sessao);
  return sessao;
}

function textoDoCampo(valor: string | kdbxweb.ProtectedValue | undefined): string {
  if (valor === undefined) return "";
  return typeof valor === "string" ? valor : valor.getText();
}

/** A tag que marca uma entrada como favorita — legível também no KeePassXC. */
const TAG_FAVORITA = "Favorito";

function serializarEntrada(entrada: kdbxweb.KdbxEntry): EntradaSenha {
  const grupo = entrada.parentGroup;
  return {
    id: entrada.uuid.id,
    titulo: textoDoCampo(entrada.fields.get("Title")),
    usuario: textoDoCampo(entrada.fields.get("UserName")),
    senha: textoDoCampo(entrada.fields.get("Password")),
    url: textoDoCampo(entrada.fields.get("URL")),
    notas: textoDoCampo(entrada.fields.get("Notes")),
    criadoEm: (entrada.times.creationTime ?? entrada.times.lastModTime ?? new Date()).toISOString(),
    atualizadoEm: (entrada.times.lastModTime ?? new Date()).toISOString(),
    // O kdbxweb preenche lastAccessTime na criação; só conta como "uso" o
    // que passou por `registrarAcesso` (usageCount > 0).
    acessadoEm:
      entrada.times.usageCount && entrada.times.lastAccessTime ? entrada.times.lastAccessTime.toISOString() : null,
    favorita: entrada.tags.some((tag) => tag.toLowerCase() === TAG_FAVORITA.toLowerCase()),
    grupoId: grupo?.uuid.id ?? "",
    grupoNome: grupo?.name ?? "",
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
  const sessao = sessaoEmUso();
  sessao.db.createGroup(encontrarGrupo(sessao.db, idPai), nome);
  marcarSujo(sessao);
  return obterArvore();
}

export async function renomearGrupo(id: string, nome: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  encontrarGrupo(sessao.db, id).name = nome;
  marcarSujo(sessao);
  return obterArvore();
}

export async function moverGrupo(id: string, idNovoPai: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  sessao.db.move(encontrarGrupo(sessao.db, id), encontrarGrupo(sessao.db, idNovoPai));
  marcarSujo(sessao);
  return obterArvore();
}

/** Move para a lixeira interna do `.kdbx` — some da lista, mas não é apagado de vez. */
export async function excluirGrupo(id: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  sessao.db.remove(encontrarGrupo(sessao.db, id));
  marcarSujo(sessao);
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
  const sessao = sessaoEmUso();
  const entrada = sessao.db.createEntry(encontrarGrupo(sessao.db, idGrupo));
  aplicarCampos(entrada, campos);
  marcarSujo(sessao);
  return obterArvore();
}

/** Guarda a versão anterior no histórico do próprio `.kdbx` antes de sobrescrever. */
export async function atualizarEntrada(id: string, campos: CamposEntrada): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  entrada.pushHistory();
  aplicarCampos(entrada, campos);
  entrada.times.lastModTime = new Date();
  sessao.db.cleanup({ historyRules: true });
  marcarSujo(sessao);
  return obterArvore();
}

export async function moverEntrada(id: string, idNovoGrupo: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  sessao.db.move(encontrarEntrada(sessao.db, id), encontrarGrupo(sessao.db, idNovoGrupo));
  marcarSujo(sessao);
  return obterArvore();
}

/** Liga/desliga a tag de favorita. */
export async function favoritarEntrada(id: string, favorita: boolean): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  entrada.tags = entrada.tags.filter((tag) => tag.toLowerCase() !== TAG_FAVORITA.toLowerCase());
  if (favorita) entrada.tags.push(TAG_FAVORITA);
  marcarSujo(sessao);
  return obterArvore();
}

/**
 * Um uso de verdade da entrada (copiou a senha, abriu o site): registra o
 * momento nos tempos padrão do `.kdbx`, que é o que alimenta "Recentes".
 * Não mexe em `lastModTime` — usar não é editar.
 */
export async function registrarAcesso(id: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  entrada.times.lastAccessTime = new Date();
  entrada.times.usageCount = (entrada.times.usageCount ?? 0) + 1;
  marcarSujo(sessao);
  return obterArvore();
}

export async function excluirEntrada(id: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  sessao.db.remove(encontrarEntrada(sessao.db, id));
  marcarSujo(sessao);
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
  const sessao = sessaoEmUso();
  // Grava o que estiver pendente antes de ler — a cópia baixada tem que
  // bater com o que está na tela, não com uma versão de 1s atrás.
  await descarregar(sessao);
  return fs.readFile(CAMINHO_COFRE);
}
