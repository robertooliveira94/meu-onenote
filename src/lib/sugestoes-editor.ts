import type { Selecao } from "./formatacao";
import { TABELA_EXEMPLO } from "./formatacao";
import type { Etiqueta, Modelo } from "./tipos";

/**
 * As sugestões que abrem enquanto se digita no editor: `[[` oferece páginas
 * para linkar, `#` etiquetas para aplicar, `/` comandos que inserem
 * markdown pronto. Aqui é a parte sem DOM — achar o gatilho atrás do
 * cursor, montar a lista, aplicar a escolha —; a caixinha em si é
 * `sugestoes-editor.tsx`.
 */

export type TipoDeGatilho = "wikilink" | "etiqueta" | "comando";

export type Gatilho = {
  tipo: TipoDeGatilho;
  /** Onde o gatilho começa no texto (o primeiro `[`, o `#`, a `/`). */
  inicio: number;
  /** O que já foi digitado depois dele. */
  termo: string;
};

export type Sugestao = {
  id: string;
  rotulo: string;
  detalhe?: string;
};

export type TituloParaLink = { titulo: string; caminho: string; trilha: string };

/** Sem acento e sem caixa, comparando palavra por palavra — mesma régua da paleta. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function casa(candidato: string, termo: string): boolean {
  const alvo = normalizar(termo).trim();
  if (!alvo) return true;
  const base = normalizar(candidato);
  return alvo.split(/\s+/).every((palavra) => base.includes(palavra));
}

/**
 * O gatilho ativo logo antes do cursor, se houver. Olha só a linha atual,
 * para trás, e para na primeira coisa que não pode fazer parte do termo.
 */
export function detectarGatilho(texto: string, cursor: number): Gatilho | null {
  const inicioDaLinha = texto.lastIndexOf("\n", cursor - 1) + 1;
  const linha = texto.slice(inicioDaLinha, cursor);

  // [[ aberto e ainda não fechado — pode ter espaço no termo (títulos têm).
  const abertura = linha.lastIndexOf("[[");
  if (abertura !== -1 && !linha.slice(abertura).includes("]]")) {
    return { tipo: "wikilink", inicio: inicioDaLinha + abertura, termo: linha.slice(abertura + 2) };
  }

  // # no começo de uma palavra, mas não no começo da linha: ali é título.
  // O gatilho é o último caractere antes do termo, então a posição dele é
  // o fim da linha menos o termo menos um.
  const etiqueta = linha.match(/\s(#)([^\s#]*)$/);
  if (etiqueta) {
    const termo = etiqueta[2];
    return { tipo: "etiqueta", inicio: inicioDaLinha + linha.length - termo.length - 1, termo };
  }

  // / no começo da linha ou depois de espaço, seguido só de letras.
  const comando = linha.match(/(?:^|\s)\/([a-zA-Zçãõáéíóúâêô]*)$/);
  if (comando) {
    const termo = comando[1];
    return { tipo: "comando", inicio: inicioDaLinha + linha.length - termo.length - 1, termo };
  }

  return null;
}

// --------------------------------------------------------------- comandos

type Comando = Sugestao & { aplicar: (selecao: Selecao, modelos: Modelo[]) => Selecao };

function dataDeHoje(): string {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, "0");
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  return `${dia}/${mes}/${agora.getFullYear()}`;
}

function horaDeAgora(): string {
  const agora = new Date();
  return `${String(agora.getHours()).padStart(2, "0")}:${String(agora.getMinutes()).padStart(2, "0")}`;
}

/**
 * `/datadehoje`, `/horaagora` e `/titulo` escritos dentro do texto salvo de
 * um modelo viram data, hora e título reais — uma vez só, no momento em que
 * uma página nasce daquele modelo. Depois disso é texto comum: não
 * recalcula de novo cada vez que a página é aberta (a data não muda
 * sozinha semanas depois, e o título não segue um `/titulo` que renomeie a
 * página no futuro).
 */
export function aplicarPlaceholdersDeModelo(texto: string, titulo: string): string {
  return texto.replaceAll("/datadehoje", dataDeHoje()).replaceAll("/horaagora", horaDeAgora()).replaceAll("/titulo", titulo);
}

/** Os comandos de placeholder reconhecidos dentro de um modelo, com uma explicação curta — mostrado na tela de cadastro. */
export const PLACEHOLDERS_DE_MODELO = [
  { comando: "/datadehoje", descricao: "vira a data em que a página nasce" },
  { comando: "/horaagora", descricao: "vira a hora em que a página nasce" },
  { comando: "/titulo", descricao: "vira o título da página" },
] as const;

/** Insere texto no cursor, com o cursor no fim do inserido (ou onde `cursorEm` mandar). */
function inserir(selecao: Selecao, trecho: string, cursorEm = trecho.length): Selecao {
  const { texto, inicio } = selecao;
  return {
    texto: texto.slice(0, inicio) + trecho + texto.slice(selecao.fim),
    inicio: inicio + cursorEm,
    fim: inicio + cursorEm,
  };
}

/** Garante que o inserido começa numa linha própria — para blocos (tabela, código). */
function inserirEmLinhaPropria(selecao: Selecao, bloco: string, cursorEm?: number): Selecao {
  const { texto, inicio } = selecao;
  const inicioDaLinha = texto.lastIndexOf("\n", inicio - 1) + 1;
  const linhaVazia = texto.slice(inicioDaLinha, inicio).trim() === "";
  const prefixo = linhaVazia ? "" : "\n\n";
  return inserir(selecao, prefixo + bloco, prefixo.length + (cursorEm ?? bloco.length));
}

const COMANDOS: Comando[] = [
  {
    id: "tarefa",
    rotulo: "Tarefa",
    detalhe: "- [ ] caixinha",
    aplicar: (selecao) => inserir(selecao, "- [ ] "),
  },
  {
    id: "tabela",
    rotulo: "Tabela",
    detalhe: "3 colunas × 2 linhas",
    aplicar: (selecao) => inserirEmLinhaPropria(selecao, TABELA_EXEMPLO),
  },
  {
    id: "data",
    rotulo: "Data de hoje",
    detalhe: dataDeHoje(),
    aplicar: (selecao) => inserir(selecao, dataDeHoje()),
  },
  {
    id: "hora",
    rotulo: "Hora de agora",
    detalhe: horaDeAgora(),
    aplicar: (selecao) => inserir(selecao, horaDeAgora()),
  },
  {
    id: "separador",
    rotulo: "Separador",
    detalhe: "linha horizontal",
    aplicar: (selecao) => inserirEmLinhaPropria(selecao, "---\n\n"),
  },
  {
    id: "citacao",
    rotulo: "Citação",
    detalhe: "> bloco",
    aplicar: (selecao) => inserir(selecao, "> "),
  },
  {
    id: "codigo",
    rotulo: "Bloco de código",
    detalhe: "```",
    // Cursor na linha do meio, pronto para colar o código.
    aplicar: (selecao) => inserirEmLinhaPropria(selecao, "```\n\n```", 4),
  },
  { id: "titulo1", rotulo: "Título 1", detalhe: "# ", aplicar: (selecao) => inserir(selecao, "# ") },
  { id: "titulo2", rotulo: "Título 2", detalhe: "## ", aplicar: (selecao) => inserir(selecao, "## ") },
  { id: "titulo3", rotulo: "Título 3", detalhe: "### ", aplicar: (selecao) => inserir(selecao, "### ") },
  {
    id: "imagem",
    rotulo: "Imagem ou arquivo…",
    detalhe: "escolher do computador",
    // Quem abre o seletor de arquivo é o editor; aqui só limpa o `/imagem`.
    aplicar: (selecao) => selecao,
  },
];

const PREFIXO_MODELO = "modelo:";

/** Os comandos que casam com o termo, mais um por modelo cadastrado. */
export function sugestoesDeComando(termo: string, modelos: Modelo[]): Sugestao[] {
  const fixos = COMANDOS.filter((comando) => casa(comando.rotulo, termo) || casa(comando.id, termo));
  const deModelo = modelos
    .filter((modelo) => casa(`modelo ${modelo.nome}`, termo))
    .map((modelo) => ({
      id: `${PREFIXO_MODELO}${modelo.id}`,
      rotulo: `Modelo: ${modelo.nome}`,
      detalhe: modelo.descricao || "cola o modelo aqui",
    }));
  return [...fixos, ...deModelo].slice(0, 12);
}

export function sugestoesDeLink(termo: string, titulos: TituloParaLink[]): Sugestao[] {
  return titulos
    .filter((item) => casa(item.titulo, termo))
    .slice(0, 8)
    .map((item) => ({ id: item.caminho, rotulo: item.titulo, detalhe: item.trilha }));
}

export function sugestoesDeEtiqueta(termo: string, etiquetas: Etiqueta[], jaAplicadas: string[]): Sugestao[] {
  return etiquetas
    .filter((etiqueta) => !jaAplicadas.includes(etiqueta.id) && casa(etiqueta.nome, termo))
    .slice(0, 8)
    .map((etiqueta) => ({ id: etiqueta.id, rotulo: etiqueta.nome }));
}

// --------------------------------------------------------------- aplicar

/** Tira do texto o gatilho e o termo digitado, deixando o cursor no lugar deles. */
export function limparGatilho(selecao: Selecao, gatilho: Gatilho): Selecao {
  const { texto } = selecao;
  return {
    texto: texto.slice(0, gatilho.inicio) + texto.slice(selecao.inicio),
    inicio: gatilho.inicio,
    fim: gatilho.inicio,
  };
}

/** `[[` + escolha → `[[Título]]`, pulando um `]]` que já esteja digitado na frente. */
export function aplicarLink(selecao: Selecao, gatilho: Gatilho, titulo: string): Selecao {
  const limpo = limparGatilho(selecao, gatilho);
  const depois = limpo.texto.slice(limpo.inicio);
  const jaFechado = depois.startsWith("]]");
  const trecho = `[[${titulo}]]`;
  const resto = jaFechado ? depois.slice(2) : depois;
  return {
    texto: limpo.texto.slice(0, limpo.inicio) + trecho + resto,
    inicio: limpo.inicio + trecho.length,
    fim: limpo.inicio + trecho.length,
  };
}

/** `/` + escolha → o markdown do comando no lugar do gatilho. Modelos colam o conteúdo inteiro. */
export function aplicarComando(selecao: Selecao, gatilho: Gatilho, id: string, modelos: Modelo[]): Selecao {
  const limpo = limparGatilho(selecao, gatilho);
  if (id.startsWith(PREFIXO_MODELO)) {
    const modelo = modelos.find((item) => item.id === id.slice(PREFIXO_MODELO.length));
    return modelo ? inserir(limpo, modelo.conteudo) : limpo;
  }
  const comando = COMANDOS.find((item) => item.id === id);
  return comando ? comando.aplicar(limpo, modelos) : limpo;
}

export const COMANDO_IMAGEM = "imagem";
