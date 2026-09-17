import fs from "node:fs/promises";
import path from "node:path";

import argon2 from "argon2";
import * as kdbxweb from "kdbxweb";

import { RAIZ } from "./caminhos";
import type {
  AnexoSenha,
  CampoExtraSenha,
  CamposEntrada,
  ConfigSenhas,
  EntradaSenha,
  GrupoSenhas,
  ItemLixeiraSenha,
  VersaoSenha,
} from "./tipos";

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
const CAMINHO_CONFIG = path.join(RAIZ, PASTA_SENHAS, "config.json");
const NOME_COFRE = "Senhas";

/** Preferências de quando ninguém nunca mexeu em `config.json` ainda. */
const CONFIG_PADRAO: ConfigSenhas = { minutosTrava: 15, trancarAoFechar: false };

/** Lê `_senhas/config.json` — nunca é segredo, então fica fora do `.kdbx`, em texto puro. */
export async function obterConfig(): Promise<ConfigSenhas> {
  try {
    const bruto = JSON.parse(await fs.readFile(CAMINHO_CONFIG, "utf8"));
    return {
      minutosTrava: bruto.minutosTrava === null ? null : Number(bruto.minutosTrava) || CONFIG_PADRAO.minutosTrava,
      trancarAoFechar: !!bruto.trancarAoFechar,
    };
  } catch {
    return CONFIG_PADRAO;
  }
}

/** Grava a config e, se o cofre já estiver destrancado, aplica a trava nova na hora — sem esperar destrancar de novo. */
export async function definirConfig(mudanca: Partial<ConfigSenhas>): Promise<ConfigSenhas> {
  const atual = await obterConfig();
  const nova: ConfigSenhas = { ...atual, ...mudanca };
  await fs.mkdir(path.dirname(CAMINHO_CONFIG), { recursive: true });
  await fs.writeFile(CAMINHO_CONFIG, JSON.stringify(nova, null, 2));
  const sessao = guardaGlobal.__cofreSessao;
  if (sessao) {
    sessao.esperaTravamentoMs = nova.minutosTrava === null ? null : nova.minutosTrava * 60_000;
    tocarSessao(sessao);
  }
  return nova;
}

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
  /** `null` = trava por inatividade desligada ("nunca") — fica na sessão porque mudar a config não deve exigir destrancar de novo. */
  esperaTravamentoMs: number | null;
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

/** Começa uma sessão nova (criar / importar / destrancar) — a trava usa a preferência salva em `config.json`. */
async function abrirSessao(db: kdbxweb.Kdbx): Promise<void> {
  const config = await obterConfig();
  const esperaTravamentoMs = config.minutosTrava === null ? null : config.minutosTrava * 60_000;
  guardaGlobal.__cofreSessao = {
    db,
    expiraEm: esperaTravamentoMs === null ? Infinity : Date.now() + esperaTravamentoMs,
    esperaTravamentoMs,
    sujo: false,
    timerSalvar: null,
    salvando: null,
  };
}

/** Adia o relógio da trava por inatividade — chamado a cada uso. */
function tocarSessao(sessao: Sessao): void {
  sessao.expiraEm = sessao.esperaTravamentoMs === null ? Infinity : Date.now() + sessao.esperaTravamentoMs;
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
  await abrirSessao(db);
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
  await abrirSessao(db);
  return true;
}

/** `true` se a senha estava certa (e o cofre já fica destrancado); `false` senão. */
export async function destrancar(senhaMestra: string): Promise<boolean> {
  const bytes = await fs.readFile(CAMINHO_COFRE);
  const credenciais = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(senhaMestra));
  try {
    const dados = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    const db = await kdbxweb.Kdbx.load(dados as ArrayBuffer, credenciais);
    await abrirSessao(db);
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

/** Os campos que têm lugar próprio na tela; qualquer outro é "campo extra". */
const CAMPOS_PADRAO = new Set(["Title", "UserName", "Password", "URL", "Notes", "otp"]);

/** Um favicon já buscado (bytes + tipo MIME) — o mesmo formato que `buscarMetadadosUrl` (em `links-app.ts`) devolve. */
export type FaviconEntrada = { base64: string; tipo: string } | null | undefined;

/** Tamanho máximo de um anexo — o cofre inteiro é lido para a memória a cada abertura. */
export const TAMANHO_MAXIMO_ANEXO = 5 * 1024 * 1024;

function dataCurta(data: Date | undefined): string | null {
  if (!data) return null;
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function camposExtrasDe(entrada: kdbxweb.KdbxEntry): CampoExtraSenha[] {
  const extras: CampoExtraSenha[] = [];
  for (const [nome, valor] of entrada.fields) {
    if (CAMPOS_PADRAO.has(nome)) continue;
    extras.push({ nome, valor: textoDoCampo(valor), protegido: valor instanceof kdbxweb.ProtectedValue });
  }
  return extras;
}

function bytesDoBinario(valor: kdbxweb.KdbxBinary | kdbxweb.KdbxBinaryWithHash): Uint8Array {
  const dado = "hash" in valor ? valor.value : valor;
  return dado instanceof kdbxweb.ProtectedValue ? dado.getBinary() : new Uint8Array(dado);
}

function anexosDe(entrada: kdbxweb.KdbxEntry): AnexoSenha[] {
  const anexos: AnexoSenha[] = [];
  for (const [nome, valor] of entrada.binaries) {
    anexos.push({ nome, tamanho: bytesDoBinario(valor).byteLength });
  }
  return anexos;
}

function serializarEntrada(entrada: kdbxweb.KdbxEntry): EntradaSenha {
  const grupo = entrada.parentGroup;
  return {
    id: entrada.uuid.id,
    titulo: textoDoCampo(entrada.fields.get("Title")),
    usuario: textoDoCampo(entrada.fields.get("UserName")),
    senha: textoDoCampo(entrada.fields.get("Password")),
    url: textoDoCampo(entrada.fields.get("URL")),
    notas: textoDoCampo(entrada.fields.get("Notes")),
    expiraEm: entrada.times.expires ? dataCurta(entrada.times.expiryTime) : null,
    otp: textoDoCampo(entrada.fields.get("otp")) || null,
    camposExtras: camposExtrasDe(entrada),
    anexos: anexosDe(entrada),
    temFavicon: !!entrada.customIcon,
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

function aplicarCampos(entrada: kdbxweb.KdbxEntry, campos: CamposEntrada): void {
  entrada.fields.set("Title", campos.titulo);
  entrada.fields.set("UserName", campos.usuario);
  entrada.fields.set("Password", kdbxweb.ProtectedValue.fromString(campos.senha));
  entrada.fields.set("URL", campos.url);
  entrada.fields.set("Notes", campos.notas);
  if (campos.otp) entrada.fields.set("otp", campos.otp);
  else entrada.fields.delete("otp");
  // Campos extras: o que não veio, some; o que veio, entra (protegido ou não).
  for (const nome of [...entrada.fields.keys()]) {
    if (!CAMPOS_PADRAO.has(nome)) entrada.fields.delete(nome);
  }
  for (const extra of campos.camposExtras) {
    const nome = extra.nome.trim();
    if (!nome || CAMPOS_PADRAO.has(nome)) continue;
    entrada.fields.set(nome, extra.protegido ? kdbxweb.ProtectedValue.fromString(extra.valor) : extra.valor);
  }
  if (campos.expiraEm) {
    entrada.times.expires = true;
    // Vale até o fim do dia, no fuso da máquina.
    entrada.times.expiryTime = new Date(`${campos.expiraEm}T23:59:59`);
  } else {
    entrada.times.expires = false;
    entrada.times.expiryTime = undefined;
  }
}

/** Guarda um arquivo dentro da entrada — mesmo nome substitui. */
export async function adicionarAnexo(id: string, nome: string, bytes: Uint8Array): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  const binario = await sessao.db.createBinary(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
  entrada.binaries.set(nome, binario);
  entrada.times.lastModTime = new Date();
  marcarSujo(sessao);
  return obterArvore();
}

export async function removerAnexo(id: string, nome: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  entrada.binaries.delete(nome);
  entrada.times.lastModTime = new Date();
  // Solta o binário do arquivo se mais ninguém (nem o histórico) usa ele.
  sessao.db.cleanup({ binaries: true });
  marcarSujo(sessao);
  return obterArvore();
}

export function obterAnexo(id: string, nome: string): Uint8Array {
  const db = usarSessao();
  const valor = encontrarEntrada(db, id).binaries.get(nome);
  if (!valor) throw new Error("Anexo não encontrado.");
  return bytesDoBinario(valor);
}

/** Aplica (ou tira) o ícone da entrada; `undefined` = não mexeu no favicon. */
function aplicarFavicon(db: kdbxweb.Kdbx, entrada: kdbxweb.KdbxEntry, favicon: FaviconEntrada): void {
  if (favicon === undefined) return;
  if (entrada.customIcon) db.meta.customIcons.delete(entrada.customIcon.id);
  if (favicon === null) {
    entrada.customIcon = undefined;
    return;
  }
  const uuid = kdbxweb.KdbxUuid.random();
  const bytes = Buffer.from(favicon.base64, "base64");
  db.meta.customIcons.set(uuid.id, {
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
    name: favicon.tipo,
    lastModified: new Date(),
  });
  entrada.customIcon = uuid;
}

export async function criarEntrada(idGrupo: string, campos: CamposEntrada, favicon?: FaviconEntrada): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = sessao.db.createEntry(encontrarGrupo(sessao.db, idGrupo));
  aplicarCampos(entrada, campos);
  aplicarFavicon(sessao.db, entrada, favicon);
  marcarSujo(sessao);
  return obterArvore();
}

/** Guarda a versão anterior no histórico do próprio `.kdbx` antes de sobrescrever. */
export async function atualizarEntrada(id: string, campos: CamposEntrada, favicon?: FaviconEntrada): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  entrada.pushHistory();
  aplicarCampos(entrada, campos);
  aplicarFavicon(sessao.db, entrada, favicon);
  entrada.times.lastModTime = new Date();
  sessao.db.cleanup({ historyRules: true, customIcons: true });
  marcarSujo(sessao);
  return obterArvore();
}

/** Os bytes do ícone da entrada (para a rota que serve `<img src>`), ou `null` se não tem um. */
export function obterFavicon(id: string): { bytes: Uint8Array; tipo: string } | null {
  const db = usarSessao();
  const entrada = encontrarEntrada(db, id);
  if (!entrada.customIcon) return null;
  const icone = db.meta.customIcons.get(entrada.customIcon.id);
  if (!icone) return null;
  return { bytes: new Uint8Array(icone.data), tipo: icone.name || "image/png" };
}

/** As versões anteriores da entrada, mais recente primeiro. */
export function obterHistorico(id: string): VersaoSenha[] {
  const db = usarSessao();
  const entrada = encontrarEntrada(db, id);
  return entrada.history
    .map((versao, indice) => ({
      indice,
      quando: (versao.times.lastModTime ?? new Date(0)).toISOString(),
      titulo: textoDoCampo(versao.fields.get("Title")),
      usuario: textoDoCampo(versao.fields.get("UserName")),
      senha: textoDoCampo(versao.fields.get("Password")),
      url: textoDoCampo(versao.fields.get("URL")),
      notas: textoDoCampo(versao.fields.get("Notes")),
    }))
    .reverse();
}

/**
 * Volta a entrada para como ela estava numa versão do histórico — a versão
 * atual (antes da troca) vira uma entrada de histórico também, então dá
 * para desfazer a restauração restaurando de novo.
 */
export async function restaurarVersao(id: string, indice: number): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const entrada = encontrarEntrada(sessao.db, id);
  const versao = entrada.history[indice];
  if (!versao) throw new Error("Versão não encontrada.");
  entrada.pushHistory();
  entrada.copyFrom(versao);
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

/** Garante que a lixeira interna do `.kdbx` existe e devolve o grupo dela. */
function grupoLixeira(db: kdbxweb.Kdbx): kdbxweb.KdbxGroup {
  db.createRecycleBin();
  const lixeira = db.getGroup(db.meta.recycleBinUuid!);
  if (!lixeira) throw new Error("Não deu para preparar a lixeira do cofre.");
  return lixeira;
}

function contarItensDentro(grupo: kdbxweb.KdbxGroup): number {
  let total = grupo.entries.length;
  for (const sub of grupo.groups) total += 1 + contarItensDentro(sub);
  return total;
}

/** O que está na lixeira agora — só os itens excluídos diretamente (o que veio junto com um grupo fica dentro dele). */
export function obterLixeira(): ItemLixeiraSenha[] {
  const db = usarSessao();
  const lixeira = grupoLixeira(db);
  const itens: ItemLixeiraSenha[] = [
    ...lixeira.groups.map((grupo) => ({
      id: grupo.uuid.id,
      tipo: "grupo" as const,
      titulo: grupo.name || "Sem nome",
      excluidoEm: grupo.times.locationChanged?.toISOString() ?? null,
      itensDentro: contarItensDentro(grupo),
    })),
    ...lixeira.entries.map((entrada) => ({
      id: entrada.uuid.id,
      tipo: "entrada" as const,
      titulo: textoDoCampo(entrada.fields.get("Title")) || "Sem título",
      excluidoEm: entrada.times.locationChanged?.toISOString() ?? null,
      itensDentro: 0,
    })),
  ];
  return itens.sort((a, b) => (b.excluidoEm ?? "").localeCompare(a.excluidoEm ?? ""));
}

function encontrarNaLixeira(db: kdbxweb.Kdbx, id: string): kdbxweb.KdbxEntry | kdbxweb.KdbxGroup | null {
  const lixeira = grupoLixeira(db);
  return lixeira.entries.find((entrada) => entrada.uuid.id === id) ?? lixeira.groups.find((grupo) => grupo.uuid.id === id) ?? null;
}

/** Volta um item da lixeira para onde ele estava antes de ser excluído (ou para a raiz, se aquele grupo também sumiu). */
export async function restaurarDaLixeira(id: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const achado = encontrarNaLixeira(sessao.db, id);
  if (!achado) throw new Error("Item não encontrado na lixeira.");
  const alvo = (achado.previousParentGroup && sessao.db.getGroup(achado.previousParentGroup)) || sessao.db.getDefaultGroup();
  sessao.db.move(achado, alvo);
  marcarSujo(sessao);
  return obterArvore();
}

/** Tombstone recursivo — para o item (e tudo dentro dele, se for um grupo) não voltar num merge futuro. */
function tombstonarRecursivo(db: kdbxweb.Kdbx, item: kdbxweb.KdbxEntry | kdbxweb.KdbxGroup, agora: Date): void {
  if (item instanceof kdbxweb.KdbxGroup) {
    for (const sub of item.groups) tombstonarRecursivo(db, sub, agora);
    for (const entrada of item.entries) tombstonarRecursivo(db, entrada, agora);
  }
  db.addDeletedObject(item.uuid, agora);
}

/** Apaga um item da lixeira para sempre — sem outra lixeira depois desta. */
export async function excluirDaLixeiraDeVez(id: string): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const lixeira = grupoLixeira(sessao.db);
  const achado = encontrarNaLixeira(sessao.db, id);
  if (!achado) throw new Error("Item não encontrado na lixeira.");
  tombstonarRecursivo(sessao.db, achado, new Date());
  if (achado instanceof kdbxweb.KdbxGroup) lixeira.groups = lixeira.groups.filter((grupo) => grupo !== achado);
  else lixeira.entries = lixeira.entries.filter((entrada) => entrada !== achado);
  sessao.db.cleanup({ binaries: true, customIcons: true, historyRules: true });
  marcarSujo(sessao);
  return obterArvore();
}

/** Esvazia a lixeira inteira de uma vez — para sempre, sem confirmação extra além da já pedida na tela. */
export async function esvaziarLixeira(): Promise<GrupoSenhas> {
  const sessao = sessaoEmUso();
  const lixeira = grupoLixeira(sessao.db);
  const agora = new Date();
  for (const grupo of lixeira.groups) tombstonarRecursivo(sessao.db, grupo, agora);
  for (const entrada of lixeira.entries) tombstonarRecursivo(sessao.db, entrada, agora);
  lixeira.groups = [];
  lixeira.entries = [];
  sessao.db.cleanup({ binaries: true, customIcons: true, historyRules: true });
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
