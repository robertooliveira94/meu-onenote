import fs from "node:fs/promises";
import path from "node:path";

import { RAIZ } from "./caminhos";
import { CORES_CADERNO, ICONES_CADERNO } from "./cores";
import { STATUS_EVENTO, TIPOS_EVENTO } from "./saude-comum";
import type {
  DadosSaude,
  EspecialidadeSaude,
  EventoSaude,
  LocalSaude,
  ProfissionalSaude,
  StatusEventoSaude,
  TipoEventoSaude,
} from "./tipos";

/**
 * A app de Saúde: especialidades → eventos (consulta, exame, procedimento,
 * vacina), mais os cadastros de apoio (locais, profissionais). Um JSON só
 * (`_saude/saude.json`), como Links e Compras; os anexos — laudos,
 * receitas, exames em PDF — são arquivos reais em
 * `_saude/anexos/<evento>/`, abríveis fora do app, sem cifra (decisão de
 * produto: a fricção de destrancar um cofre pra olhar um exame de rotina
 * mata o uso; quem quer esconder algo específico anexa no cofre de Senhas).
 */
const PASTA_SAUDE = "_saude";
const ARQUIVO_DADOS = path.join(RAIZ, PASTA_SAUDE, "saude.json");
const ARQUIVO_LIXEIRA = path.join(RAIZ, PASTA_SAUDE, "lixeira.json");
const PASTA_ANEXOS = path.join(RAIZ, PASTA_SAUDE, "anexos");

export const LIMITE_ANEXO_BYTES = 25 * 1024 * 1024;

/** Só o que faz sentido como laudo/receita/foto — SVG fica de fora (pode carregar script na origem do app). */
export const EXTENSOES_ANEXO = ["pdf", "png", "jpg", "jpeg", "gif", "webp", "heic", "txt", "docx", "xlsx"] as const;

function gerarId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function lerDados(): Promise<DadosSaude> {
  try {
    const dados = JSON.parse(await fs.readFile(ARQUIVO_DADOS, "utf8")) as Partial<DadosSaude>;
    return {
      especialidades: dados.especialidades ?? [],
      locais: dados.locais ?? [],
      profissionais: dados.profissionais ?? [],
      eventos: dados.eventos ?? [],
    };
  } catch {
    return { especialidades: [], locais: [], profissionais: [], eventos: [] };
  }
}

async function gravarDados(dados: DadosSaude): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_DADOS), { recursive: true });
  await fs.writeFile(ARQUIVO_DADOS, JSON.stringify(dados, null, 2), "utf8");
}

let fila: Promise<unknown> = Promise.resolve();

async function alterar<T>(mudanca: (dados: DadosSaude) => T | Promise<T>): Promise<T> {
  const proxima = fila.then(async () => {
    const dados = await lerDados();
    const resultado = await mudanca(dados);
    await gravarDados(dados);
    return resultado;
  });
  fila = proxima.catch(() => undefined);
  return proxima;
}

export async function obterDados(): Promise<DadosSaude> {
  return lerDados();
}

function exigirEspecialidade(dados: DadosSaude, id: string): EspecialidadeSaude {
  const achada = dados.especialidades.find((item) => item.id === id);
  if (!achada) throw new Error("Especialidade não encontrada.");
  return achada;
}

function exigirEvento(dados: DadosSaude, id: string): EventoSaude {
  const achado = dados.eventos.find((item) => item.id === id);
  if (!achado) throw new Error("Evento não encontrado.");
  return achado;
}

function nomeLimpo(nome: string, campo: string, maximo = 80): string {
  const limpo = nome.trim().slice(0, maximo);
  if (!limpo) throw new Error(`Dê um nome para ${campo}.`);
  return limpo;
}

// --------------------------------------------------------- especialidades

export async function criarEspecialidade(nome: string, icone?: string, cor?: string): Promise<DadosSaude> {
  return alterar((dados) => {
    const limpo = nomeLimpo(nome, "a especialidade");
    if (dados.especialidades.some((item) => item.nome.toLowerCase() === limpo.toLowerCase())) {
      throw new Error("Já existe uma especialidade com esse nome.");
    }
    const posicao = dados.especialidades.length;
    dados.especialidades.push({
      id: gerarId(),
      nome: limpo,
      icone: icone || ICONES_CADERNO[posicao % ICONES_CADERNO.length],
      cor: cor || CORES_CADERNO[posicao % CORES_CADERNO.length],
      mesesAlerta: null,
    });
    return dados;
  });
}

export async function atualizarEspecialidade(
  id: string,
  campos: Partial<Pick<EspecialidadeSaude, "nome" | "icone" | "cor" | "mesesAlerta">>,
): Promise<DadosSaude> {
  return alterar((dados) => {
    const especialidade = exigirEspecialidade(dados, id);
    if (campos.nome !== undefined) especialidade.nome = nomeLimpo(campos.nome, "a especialidade");
    if (campos.icone !== undefined) especialidade.icone = campos.icone;
    if (campos.cor !== undefined) especialidade.cor = campos.cor;
    if (campos.mesesAlerta !== undefined) {
      especialidade.mesesAlerta =
        campos.mesesAlerta === null ? null : Math.max(1, Math.min(120, Math.round(campos.mesesAlerta)));
    }
    return dados;
  });
}

/** Os registros dela vão pra lixeira (anexos ficam no disco até apagar de vez); a especialidade em si some. */
export async function excluirEspecialidade(id: string): Promise<DadosSaude> {
  return alterar(async (dados) => {
    const especialidade = exigirEspecialidade(dados, id);
    const seus = dados.eventos.filter((evento) => evento.especialidadeId === id);
    if (seus.length) await enviarParaLixeira(seus, especialidade.nome);
    dados.eventos = dados.eventos.filter((evento) => evento.especialidadeId !== id);
    dados.especialidades = dados.especialidades.filter((item) => item.id !== id);
    for (const profissional of dados.profissionais) if (profissional.especialidadeId === id) profissional.especialidadeId = null;
    return dados;
  });
}

export async function reordenarEspecialidades(ordemIds: string[]): Promise<DadosSaude> {
  return alterar((dados) => {
    const porId = new Map(dados.especialidades.map((item) => [item.id, item]));
    const reordenadas = ordemIds.map((id) => porId.get(id)).filter((e): e is EspecialidadeSaude => !!e);
    for (const item of dados.especialidades) if (!ordemIds.includes(item.id)) reordenadas.push(item);
    dados.especialidades = reordenadas;
    return dados;
  });
}

// ------------------------------------------------------------------ locais

export type CamposLocal = Omit<LocalSaude, "id">;

function limparLocal(campos: CamposLocal): CamposLocal {
  return {
    nome: nomeLimpo(campos.nome, "o local"),
    endereco: campos.endereco.trim().slice(0, 300),
    telefone: campos.telefone.trim().slice(0, 60),
    observacoes: campos.observacoes.trim().slice(0, 2000),
  };
}

export async function criarLocal(campos: CamposLocal): Promise<DadosSaude> {
  return alterar((dados) => {
    dados.locais.push({ id: gerarId(), ...limparLocal(campos) });
    dados.locais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return dados;
  });
}

export async function atualizarLocal(id: string, campos: CamposLocal): Promise<DadosSaude> {
  return alterar((dados) => {
    const local = dados.locais.find((item) => item.id === id);
    if (!local) throw new Error("Local não encontrado.");
    Object.assign(local, limparLocal(campos));
    dados.locais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return dados;
  });
}

/** Eventos e profissionais que apontavam pra ele ficam "sem local" — nada some. */
export async function excluirLocal(id: string): Promise<DadosSaude> {
  return alterar((dados) => {
    dados.locais = dados.locais.filter((item) => item.id !== id);
    for (const evento of dados.eventos) if (evento.localId === id) evento.localId = null;
    for (const profissional of dados.profissionais) if (profissional.localId === id) profissional.localId = null;
    return dados;
  });
}

// ----------------------------------------------------------- profissionais

export type CamposProfissional = Omit<ProfissionalSaude, "id">;

function limparProfissional(dados: DadosSaude, campos: CamposProfissional): CamposProfissional {
  if (campos.especialidadeId && !dados.especialidades.some((item) => item.id === campos.especialidadeId)) {
    throw new Error("Especialidade não encontrada.");
  }
  if (campos.localId && !dados.locais.some((item) => item.id === campos.localId)) throw new Error("Local não encontrado.");
  return {
    nome: nomeLimpo(campos.nome, "o profissional"),
    especialidadeId: campos.especialidadeId,
    localId: campos.localId,
    contato: campos.contato.trim().slice(0, 200),
  };
}

export async function criarProfissional(campos: CamposProfissional): Promise<DadosSaude> {
  return alterar((dados) => {
    dados.profissionais.push({ id: gerarId(), ...limparProfissional(dados, campos) });
    dados.profissionais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return dados;
  });
}

export async function atualizarProfissional(id: string, campos: CamposProfissional): Promise<DadosSaude> {
  return alterar((dados) => {
    const profissional = dados.profissionais.find((item) => item.id === id);
    if (!profissional) throw new Error("Profissional não encontrado.");
    Object.assign(profissional, limparProfissional(dados, campos));
    dados.profissionais.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
    return dados;
  });
}

export async function excluirProfissional(id: string): Promise<DadosSaude> {
  return alterar((dados) => {
    dados.profissionais = dados.profissionais.filter((item) => item.id !== id);
    for (const evento of dados.eventos) if (evento.profissionalId === id) evento.profissionalId = null;
    return dados;
  });
}

// ----------------------------------------------------------------- eventos

export type CamposEvento = {
  tipo: TipoEventoSaude;
  especialidadeId: string;
  titulo: string;
  data: string | null;
  hora: string | null;
  profissionalId: string | null;
  localId: string | null;
  status: StatusEventoSaude;
  observacoes: string;
};

/** O que só existe no formulário: viram eventos novos ligados a este, sem ficar guardados nele. */
export type ExtrasEvento = {
  /** Data do retorno — cria uma consulta agendada (ou solicitada, sem data) na mesma especialidade. */
  retornoEm?: string | null;
  /** Um pedido por linha — cada um vira um exame "solicitado", com `pedidoPorId` apontando pra consulta. */
  pedidos?: string[];
};

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

function limparEvento(dados: DadosSaude, campos: CamposEvento): CamposEvento {
  if (!TIPOS_EVENTO.includes(campos.tipo)) throw new Error("Tipo inválido.");
  if (!STATUS_EVENTO.includes(campos.status)) throw new Error("Status inválido.");
  if (campos.status === "aguardando-resultado" && campos.tipo !== "exame") throw new Error("Só exame aguarda resultado.");
  exigirEspecialidade(dados, campos.especialidadeId);
  if (campos.profissionalId && !dados.profissionais.some((item) => item.id === campos.profissionalId)) {
    throw new Error("Profissional não encontrado.");
  }
  if (campos.localId && !dados.locais.some((item) => item.id === campos.localId)) throw new Error("Local não encontrado.");
  const data = campos.data && DATA_ISO.test(campos.data) ? campos.data : null;
  const hora = data && campos.hora && HORA.test(campos.hora) ? campos.hora : null;
  return {
    tipo: campos.tipo,
    especialidadeId: campos.especialidadeId,
    titulo: nomeLimpo(campos.titulo, "o evento", 120),
    data,
    hora,
    profissionalId: campos.profissionalId,
    localId: campos.localId,
    status: campos.status,
    observacoes: campos.observacoes.trim().slice(0, 20_000),
  };
}

function novoEvento(campos: CamposEvento, pedidoPorId: string | null): EventoSaude {
  const agora = new Date().toISOString();
  return { id: gerarId(), ...campos, anexos: [], pedidoPorId, criadoEm: agora, atualizadoEm: agora };
}

/** Os eventos derivados de "retorno em" e "pedidos" — mesma especialidade, profissional e local do original. */
function criarDerivados(dados: DadosSaude, origem: EventoSaude, extras: ExtrasEvento): void {
  if (extras.retornoEm !== undefined && extras.retornoEm !== null && extras.retornoEm !== "") {
    const data = DATA_ISO.test(extras.retornoEm) ? extras.retornoEm : null;
    dados.eventos.push(
      novoEvento(
        {
          tipo: "consulta",
          especialidadeId: origem.especialidadeId,
          titulo: "Retorno",
          data,
          hora: null,
          profissionalId: origem.profissionalId,
          localId: origem.localId,
          status: data ? "agendado" : "solicitado",
          observacoes: "",
        },
        origem.id,
      ),
    );
  }
  for (const pedido of extras.pedidos ?? []) {
    const titulo = pedido.trim().slice(0, 120);
    if (!titulo) continue;
    dados.eventos.push(
      novoEvento(
        {
          tipo: "exame",
          especialidadeId: origem.especialidadeId,
          titulo,
          data: null,
          hora: null,
          profissionalId: origem.profissionalId,
          localId: null,
          status: "solicitado",
          observacoes: "",
        },
        origem.id,
      ),
    );
  }
}

export async function criarEvento(campos: CamposEvento, extras: ExtrasEvento = {}): Promise<{ dados: DadosSaude; id: string }> {
  return alterar((dados) => {
    const evento = novoEvento(limparEvento(dados, campos), null);
    dados.eventos.push(evento);
    criarDerivados(dados, evento, extras);
    return { dados, id: evento.id };
  });
}

export async function atualizarEvento(id: string, campos: CamposEvento, extras: ExtrasEvento = {}): Promise<DadosSaude> {
  return alterar((dados) => {
    const evento = exigirEvento(dados, id);
    Object.assign(evento, limparEvento(dados, campos));
    evento.atualizadoEm = new Date().toISOString();
    criarDerivados(dados, evento, extras);
    return dados;
  });
}

export async function mudarStatusEvento(id: string, status: StatusEventoSaude): Promise<DadosSaude> {
  return alterar((dados) => {
    const evento = exigirEvento(dados, id);
    if (!STATUS_EVENTO.includes(status)) throw new Error("Status inválido.");
    if (status === "aguardando-resultado" && evento.tipo !== "exame") throw new Error("Só exame aguarda resultado.");
    evento.status = status;
    evento.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

export async function moverEvento(id: string, especialidadeId: string): Promise<DadosSaude> {
  return alterar((dados) => {
    const evento = exigirEvento(dados, id);
    exigirEspecialidade(dados, especialidadeId);
    evento.especialidadeId = especialidadeId;
    evento.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

/** Manda pra lixeira. Os anexos continuam no disco — só somem ao apagar de vez ou esvaziar. */
export async function excluirEvento(id: string): Promise<DadosSaude> {
  return alterar(async (dados) => {
    const evento = exigirEvento(dados, id);
    const especialidade = dados.especialidades.find((item) => item.id === evento.especialidadeId);
    await enviarParaLixeira([evento], especialidade?.nome ?? "");
    dados.eventos = dados.eventos.filter((item) => item.id !== id);
    return dados;
  });
}

// ----------------------------------------------------------------- lixeira

/**
 * Lixeira própria, como a de Links: o registro sai do JSON vivo e fica
 * aqui até ser restaurado ou apagado de vez. Guarda o nome da
 * especialidade porque ela pode ter sido excluída junto — na hora de
 * restaurar, se não existir mais, a pessoa precisa criar uma antes.
 */
type RegistroLixeiraSaude = {
  evento: EventoSaude;
  especialidadeNome: string;
  excluidoEm: string;
};

export type ItemLixeiraSaude = {
  id: string;
  titulo: string;
  tipo: TipoEventoSaude;
  data: string | null;
  especialidadeNome: string;
  anexos: number;
  excluidoEm: string;
};

async function lerLixeira(): Promise<RegistroLixeiraSaude[]> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO_LIXEIRA, "utf8")) as RegistroLixeiraSaude[];
  } catch {
    return [];
  }
}

async function gravarLixeira(itens: RegistroLixeiraSaude[]): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_LIXEIRA), { recursive: true });
  await fs.writeFile(ARQUIVO_LIXEIRA, JSON.stringify(itens, null, 2), "utf8");
}

/** Chamado de dentro de `alterar` — a fila dos dados já serializa, não precisa de outra. */
async function enviarParaLixeira(eventos: EventoSaude[], especialidadeNome: string): Promise<void> {
  const itens = await lerLixeira();
  const agora = new Date().toISOString();
  for (const evento of eventos) itens.push({ evento, especialidadeNome, excluidoEm: agora });
  await gravarLixeira(itens);
}

export async function listarLixeira(): Promise<ItemLixeiraSaude[]> {
  const itens = await lerLixeira();
  return itens
    .map(({ evento, especialidadeNome, excluidoEm }) => ({
      id: evento.id,
      titulo: evento.titulo,
      tipo: evento.tipo,
      data: evento.data,
      especialidadeNome,
      anexos: evento.anexos.length,
      excluidoEm,
    }))
    .sort((a, b) => b.excluidoEm.localeCompare(a.excluidoEm));
}

/** Volta pra especialidade de origem; se ela foi excluída, tenta pelo nome; sem nenhuma, avisa. */
export async function restaurarDaLixeira(id: string): Promise<DadosSaude> {
  return alterar(async (dados) => {
    const itens = await lerLixeira();
    const posicao = itens.findIndex((item) => item.evento.id === id);
    if (posicao === -1) throw new Error("Registro não encontrado na lixeira.");
    const { evento, especialidadeNome } = itens[posicao];
    const destino =
      dados.especialidades.find((item) => item.id === evento.especialidadeId) ??
      dados.especialidades.find((item) => item.nome.toLowerCase() === especialidadeNome.toLowerCase());
    if (!destino) {
      throw new Error(`A especialidade "${especialidadeNome}" não existe mais — crie uma com esse nome e restaure de novo.`);
    }
    evento.especialidadeId = destino.id;
    if (evento.profissionalId && !dados.profissionais.some((item) => item.id === evento.profissionalId)) evento.profissionalId = null;
    if (evento.localId && !dados.locais.some((item) => item.id === evento.localId)) evento.localId = null;
    if (evento.pedidoPorId && !dados.eventos.some((item) => item.id === evento.pedidoPorId)) evento.pedidoPorId = null;
    dados.eventos.push(evento);
    itens.splice(posicao, 1);
    await gravarLixeira(itens);
    return dados;
  });
}

export async function apagarDeVezDaLixeira(id: string): Promise<void> {
  const itens = await lerLixeira();
  const restantes = itens.filter((item) => item.evento.id !== id);
  if (restantes.length === itens.length) return;
  await apagarAnexosDoEvento(id);
  await gravarLixeira(restantes);
}

export async function esvaziarLixeira(): Promise<void> {
  const itens = await lerLixeira();
  for (const item of itens) await apagarAnexosDoEvento(item.evento.id);
  await gravarLixeira([]);
}

// ------------------------------------------------------------------ anexos

function pastaDoEvento(idEvento: string): string {
  if (!/^[a-z0-9]+$/i.test(idEvento)) throw new Error("Evento inválido.");
  return path.join(PASTA_ANEXOS, idEvento);
}

async function apagarAnexosDoEvento(idEvento: string): Promise<void> {
  await fs.rm(pastaDoEvento(idEvento), { recursive: true, force: true });
}

/** Nome em disco: id + extensão original. O nome que a pessoa vê fica no JSON. */
export async function adicionarAnexo(idEvento: string, nomeOriginal: string, bytes: Buffer): Promise<DadosSaude> {
  const nome = nomeOriginal.trim().slice(0, 200) || "anexo";
  const ponto = nome.lastIndexOf(".");
  const extensao = ponto === -1 ? "" : nome.slice(ponto + 1).toLowerCase();
  if (!(EXTENSOES_ANEXO as readonly string[]).includes(extensao)) throw new Error("Esse tipo de arquivo não é aceito como anexo.");
  if (bytes.byteLength === 0) throw new Error("Arquivo vazio.");
  if (bytes.byteLength > LIMITE_ANEXO_BYTES) throw new Error("Arquivo grande demais (máximo 25 MB).");
  return alterar(async (dados) => {
    const evento = exigirEvento(dados, idEvento);
    const id = gerarId();
    const arquivo = `${id}.${extensao}`;
    const pasta = pastaDoEvento(idEvento);
    await fs.mkdir(pasta, { recursive: true });
    await fs.writeFile(path.join(pasta, arquivo), bytes);
    evento.anexos.push({ id, nome, arquivo, tamanho: bytes.byteLength, adicionadoEm: new Date().toISOString() });
    evento.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

export async function removerAnexo(idEvento: string, idAnexo: string): Promise<DadosSaude> {
  return alterar(async (dados) => {
    const evento = exigirEvento(dados, idEvento);
    const anexo = evento.anexos.find((item) => item.id === idAnexo);
    if (!anexo) throw new Error("Anexo não encontrado.");
    await fs.rm(path.join(pastaDoEvento(idEvento), anexo.arquivo), { force: true });
    evento.anexos = evento.anexos.filter((item) => item.id !== idAnexo);
    evento.atualizadoEm = new Date().toISOString();
    return dados;
  });
}

/** Caminho em disco de um anexo, pra rota que serve o arquivo — `null` se não existir no registro. */
export async function caminhoDoAnexo(idEvento: string, arquivo: string): Promise<{ caminho: string; nome: string } | null> {
  const dados = await lerDados();
  const evento = dados.eventos.find((item) => item.id === idEvento);
  const anexo = evento?.anexos.find((item) => item.arquivo === arquivo);
  if (!evento || !anexo) return null;
  return { caminho: path.join(pastaDoEvento(idEvento), anexo.arquivo), nome: anexo.nome };
}

// ------------------------------------------------------------------- busca

export type EventoAchado = Pick<EventoSaude, "id" | "tipo" | "titulo" | "data" | "status"> & {
  especialidade: string;
  profissional: string | null;
};

export async function buscarEventos(termo: string): Promise<EventoAchado[]> {
  const alvo = termo.trim().toLowerCase();
  if (!alvo) return [];
  const dados = await lerDados();
  const especialidades = new Map(dados.especialidades.map((item) => [item.id, item.nome]));
  const profissionais = new Map(dados.profissionais.map((item) => [item.id, item.nome]));
  return dados.eventos
    .filter((evento) => {
      const profissional = evento.profissionalId ? (profissionais.get(evento.profissionalId) ?? "") : "";
      const especialidade = especialidades.get(evento.especialidadeId) ?? "";
      return [evento.titulo, evento.observacoes, profissional, especialidade].some((texto) => texto.toLowerCase().includes(alvo));
    })
    .sort((a, b) => (b.data ?? "9999").localeCompare(a.data ?? "9999"))
    .slice(0, 8)
    .map((evento) => ({
      id: evento.id,
      tipo: evento.tipo,
      titulo: evento.titulo,
      data: evento.data,
      status: evento.status,
      especialidade: especialidades.get(evento.especialidadeId) ?? "",
      profissional: evento.profissionalId ? (profissionais.get(evento.profissionalId) ?? null) : null,
    }));
}
