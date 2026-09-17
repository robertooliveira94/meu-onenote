/**
 * Tipos compartilhados entre o servidor (acesso ao disco) e a interface.
 *
 * Convenção de caminhos: todo caminho trafegado pela aplicação é *relativo* à
 * pasta `dados/` e usa barra normal como separador, mesmo no Windows.
 * Exemplo: "Pessoal/Financeiro/orcamento.md".
 */

export type Formato = "md" | "txt";

/**
 * Hierarquia fixa de 3 níveis, igual ao OneNote: caderno → seção → página.
 * Nada de aninhamento livre — uma seção nunca tem outra seção dentro, e uma
 * página sempre mora dentro de uma seção (nunca solta direto no caderno).
 */
export type Secao = {
  nome: string;
  caminho: string;
  quantidadePaginas: number;
};

/** Só o caderno tem cor e ícone — a seção herda visualmente do caderno-pai. */
export type Caderno = {
  nome: string;
  caminho: string;
  cor: string;
  icone: string;
  secoes: Secao[];
};

/** Dados de uma nota suficientes para montar a lista de páginas. */
export type ResumoNota = {
  caminho: string;
  titulo: string;
  formato: Formato;
  /** Primeiras linhas do conteúdo, já sem marcação, para a prévia na lista. */
  trecho: string;
  criadoEm: string;
  atualizadoEm: string;
  favorita: boolean;
  /** Fica no topo da lista da própria seção — diferente de favorita, que é global. */
  fixada: boolean;
  etiquetas: string[];
};

export type Nota = ResumoNota & {
  conteudo: string;
};

export type Etiqueta = {
  id: string;
  nome: string;
  cor: string;
  descricao: string;
};

/** Um modelo de página — só para markdown; texto simples não tem o que herdar. */
export type Modelo = {
  id: string;
  nome: string;
  descricao: string;
  conteudo: string;
};

/** Metadados de uma nota guardados no índice (fora do arquivo). */
export type EntradaNota = {
  etiquetas: string[];
  favorita: boolean;
  /** Fixada no topo da seção (ver `ResumoNota.fixada`). */
  fixada?: boolean;
  criadoEm: string;
  atualizadoEm: string;
  ordem: number;
  /**
   * Só usado por tarefas do Kanban — registro à parte de `etiquetas`
   * (etiqueta de nota e etiqueta de tarefa nunca se misturam, mesmo que os
   * dois campos morem no mesmo índice). `?` porque nenhuma nota "de
   * verdade" jamais preenche isto.
   */
  etiquetasKanban?: string[];
  /**
   * Só usado por tarefas do Kanban: caminhos de outras tarefas que
   * bloqueiam esta — ela não pode entrar na coluna de conclusão enquanto
   * alguma dependência aqui não estiver ela mesma lá.
   */
  dependeDe?: string[];
  /** Só usado por tarefas do Kanban. */
  prioridadeKanban?: Prioridade;
  /** Só usado por tarefas do Kanban — data no formato "AAAA-MM-DD". */
  prazoKanban?: string;
  /** Só usado por tarefas do Kanban: id de uma entrada em sprints-kanban.json. */
  sprintKanban?: string;
  /** Só usado por tarefas do Kanban: lista de subtarefas da tarefa. */
  subtarefasKanban?: Subtarefa[];
  /** Só usado por tarefas do Kanban: mural de recados, mais recente por último. */
  comentariosKanban?: Comentario[];
  /**
   * Só usado por tarefas do Kanban: motivo do impedimento. Presente (mesmo
   * vazio) significa "esta tarefa está travada"; ausente, que está solta.
   */
  impedimentoKanban?: string;
  /**
   * Só usado por tarefas do Kanban: número sequencial dentro do quadro, que
   * vira o identificador curto do cartão ("TRB-14"). Atribuído na criação;
   * tarefas de antes ganham o seu na primeira listagem do quadro.
   */
  numeroKanban?: number;
  /** Só usado por tarefas do Kanban: quando entrou na coluna atual — é o que mede o "envelhecimento". */
  movidoEm?: string;
  /** Só usado por tarefas do Kanban: cor própria do cartão (faixa no topo), uma das seis da paleta. */
  corKanban?: string;
  /** Só usado por tarefas do Kanban: tamanho estimado. */
  estimativaKanban?: Estimativa;
  /** Só usado por tarefas do Kanban: ao concluir, nasce uma cópia com o próximo prazo. */
  recorrenciaKanban?: Recorrencia;
  /** Só usado por tarefas do Kanban: quando foi arquivada (está em `_arquivo/`). */
  arquivadoEmKanban?: string;
};

export const ESTIMATIVAS = ["P", "M", "G"] as const;
export type Estimativa = (typeof ESTIMATIVAS)[number];
/** Peso de cada estimativa, para a soma no cabeçalho da coluna e na sprint. */
export const PONTOS_ESTIMATIVA: Record<Estimativa, number> = { P: 1, M: 2, G: 3 };

export const RECORRENCIAS = ["diaria", "semanal", "mensal"] as const;
export type Recorrencia = (typeof RECORRENCIAS)[number];
export const RUBRICA_RECORRENCIA: Record<Recorrencia, string> = {
  diaria: "Todo dia",
  semanal: "Toda semana",
  mensal: "Todo mês",
};

/** Um item da checklist de uma tarefa do Kanban. */
export type Subtarefa = {
  id: string;
  texto: string;
  feita: boolean;
};

/**
 * Um recado escrito à mão no mural de uma tarefa do Kanban — diferente da
 * descrição (que é o texto principal da tarefa): aqui é um histórico
 * cronológico de anotações, tipo "liguei pro fornecedor, ainda sem resposta".
 */
export type Comentario = {
  id: string;
  texto: string;
  criadoEm: string;
};

/** Metadados de uma pasta guardados no índice. */
export type EntradaPasta = {
  cor: string;
  icone: string;
  ordem: number;
  recolhida: boolean;
};

export type Indice = {
  versao: number;
  notas: Record<string, EntradaNota>;
  pastas: Record<string, EntradaPasta>;
};

export type VersaoHistorico = {
  id: string;
  salvaEm: string;
  tamanho: number;
};

export type ItemLixeira = {
  id: string;
  nome: string;
  caminhoOriginal: string;
  tipo: "nota" | "pasta";
  excluidoEm: string;
};

/** Um nó do grafo de notas — página + cor herdada do caderno. */
export type NoGrafo = {
  caminho: string;
  titulo: string;
  cor: string;
};

export type ResultadoBusca = {
  caminho: string;
  titulo: string;
  formato: Formato;
  /** Trecho ao redor da primeira ocorrência, recortado em volta da palavra encontrada. */
  trecho: string;
  /** Verdadeiro quando o termo apareceu no título e não no corpo. */
  achadoNoTitulo: boolean;
  etiquetas: string[];
  atualizadoEm: string;
};

/**
 * Um quadro do Kanban: uma pasta em `_kanban/<Nome>/`, com vida própria —
 * não é o mesmo objeto que um caderno de anotações. Excluir um quadro não
 * mexe no caderno de mesmo nome, e vice-versa: as duas aplicações do app
 * têm listas independentes.
 */
export type ResumoQuadro = {
  nome: string;
  /** "_kanban/<Nome>" */
  caminho: string;
  cor: string;
  icone: string;
  quantidadeTarefas: number;
};

/**
 * Colunas de um quadro ("categorias" como Backlog, Fazendo, Feito) são
 * configuráveis por quadro: todo quadro novo nasce com estas quatro, mas dá
 * pra criar, renomear, reordenar e excluir (só coluna vazia).
 */
export const COLUNAS_KANBAN_PADRAO = ["Backlog", "Fazendo", "Impedido", "Feito"];
export type ColunaKanban = string;

/**
 * Uma etiqueta do Kanban — mesma forma da etiqueta de nota, cadastro à parte.
 * `quadro` ausente = etiqueta geral (aparece em todos os quadros); com nome
 * de quadro = só aparece naquele quadro.
 */
export type EtiquetaKanban = Etiqueta & { quadro?: string };

/** Uma sprint — só um nome pra agrupar tarefas; sem datas, sem burndown. */
export type SprintKanban = {
  id: string;
  nome: string;
  criadoEm: string;
  /** Datas opcionais ("AAAA-MM-DD"): só para saber quando começa e termina — sem burndown. */
  inicio?: string;
  fim?: string;
  /** Sprint fechada: some dos seletores; o que sobrou nela foi movido ou solto ao fechar. */
  fechadaEm?: string;
};

/** O que a adição rápida ("Revisar !alta #financeiro @sexta ~sprint3") já preenche ao criar. */
export type ExtrasDaTarefa = {
  prioridade?: Prioridade | null;
  etiquetas?: string[];
  prazo?: string | null;
  sprintId?: string | null;
  estimativa?: Estimativa | null;
};

export const PRIORIDADES = ["baixa", "media", "alta", "urgente"] as const;
export type Prioridade = (typeof PRIORIDADES)[number];
export const RUBRICA_PRIORIDADE: Record<Prioridade, string> = {
  baixa: "Baixa",
  media: "Média",
  alta: "Alta",
  urgente: "Urgente",
};

/** Uma tarefa — arquivo `.md` de verdade, com corpo livre (checklist, descrição). */
export type TarefaKanban = {
  caminho: string;
  titulo: string;
  coluna: ColunaKanban;
  criadoEm: string;
  atualizadoEm: string;
  etiquetas: string[];
  favorita: boolean;
  /** Caminhos de outras tarefas que bloqueiam esta. */
  dependeDe: string[];
  prioridade: Prioridade | null;
  /** Data no formato "AAAA-MM-DD", ou `null` sem prazo definido. */
  prazo: string | null;
  /** Id de uma sprint (sprints-kanban.json), ou `null` fora de qualquer sprint. */
  sprintId: string | null;
  subtarefas: Subtarefa[];
  /** Mural de recados, mais recente por último. */
  comentarios: Comentario[];
  /** Motivo do impedimento, ou `null` quando a tarefa não está travada. */
  impedimento: string | null;
  /** Número sequencial no quadro — o "14" de "TRB-14". */
  numero: number;
  /** Quando entrou na coluna atual. */
  movidoEm: string;
  /** Cor própria do cartão, ou `null` para seguir só a cor da coluna. */
  cor: string | null;
  estimativa: Estimativa | null;
  recorrencia: Recorrencia | null;
};

/** Configuração do quadro de um caderno: quais colunas existem e em que ordem. */
export type ConfigQuadro = {
  colunas: string[];
  /** Limite de tarefas em andamento por coluna (WIP) — o cabeçalho avisa ao passar. Ausente = sem limite. */
  wip?: Record<string, number>;
  /** Dias na coluna de conclusão até a tarefa ser arquivada sozinha. Ausente = 30; 0 = nunca. */
  arquivarApos?: number;
  /** Qual coluna conta como "concluída" pro bloqueio de dependências. */
  colunaConcluida: string;
};

/** Um quadro inteiro: a configuração de colunas + as tarefas de cada uma, já na ordem manual. */
export type Quadro = {
  config: ConfigQuadro;
  tarefas: Record<string, TarefaKanban[]>;
  /** Quantas tarefas estão no arquivo do quadro (fora das colunas). */
  arquivadas: number;
};

/** Uma tarefa arquivada, para a tela do arquivo. */
export type TarefaArquivada = TarefaKanban & { arquivadoEm: string };

/**
 * Uma senha guardada no cofre. `id` é o UUID da entrada dentro do arquivo
 * `.kdbx` — só existe enquanto o cofre está destrancado, nunca é persistido
 * fora dele.
 */
/** Um campo além dos cinco padrão do KeePass — "PIN", "pergunta secreta", "chave de recuperação"… */
export type CampoExtraSenha = {
  nome: string;
  valor: string;
  /** Protegido = cifrado em memória e escondido na tela, como a senha. */
  protegido: boolean;
};

/** Um arquivo guardado dentro da entrada (binário do `.kdbx`). */
export type AnexoSenha = {
  nome: string;
  tamanho: number;
};

export type EntradaSenha = {
  id: string;
  titulo: string;
  usuario: string;
  senha: string;
  url: string;
  notas: string;
  /** "AAAA-MM-DD" quando a senha tem validade; a lista avisa quando vence ou já venceu. */
  expiraEm: string | null;
  /** O que foi colado no campo TOTP: uma URI `otpauth://` ou o segredo Base32 puro — cru, sem interpretar. */
  otp: string | null;
  camposExtras: CampoExtraSenha[];
  anexos: AnexoSenha[];
  criadoEm: string;
  atualizadoEm: string;
  /** Último uso de verdade (copiar a senha, abrir o site) — é o que ordena "Recentes". */
  acessadoEm: string | null;
  /** Tag `Favorito` no `.kdbx` — o KeePassXC mostra a mesma tag. */
  favorita: boolean;
  /** Grupo onde mora (id e nome), para as listas que juntam entradas de vários grupos. */
  grupoId: string;
  grupoNome: string;
  /** Tem um ícone próprio guardado dentro do cofre — buscar em `/senhas/favicon/<id>`. */
  temFavicon: boolean;
};

/** Uma versão antiga de uma entrada, guardada no histórico do próprio `.kdbx`. */
export type VersaoSenha = {
  indice: number;
  quando: string;
  titulo: string;
  usuario: string;
  senha: string;
  url: string;
  notas: string;
};

/** Uma entrada ou grupo dentro da lixeira do cofre — a lixeira interna do `.kdbx`. */
export type ItemLixeiraSenha = {
  id: string;
  tipo: "entrada" | "grupo";
  titulo: string;
  excluidoEm: string | null;
  /** Só para grupos: quantos itens (entradas + subgrupos) foram junto. */
  itensDentro: number;
};

/**
 * Preferências do cofre — fora do `.kdbx` de propósito (em `_senhas/config.json`,
 * texto puro): não são segredo, e a tela de senha mestra nem chega a
 * destrancar nada para saber quanto tempo esperar antes de trancar sozinho.
 */
export type ConfigSenhas = {
  /** Minutos de inatividade até trancar sozinho; `null` = nunca. */
  minutosTrava: number | null;
  /** Tranca ao fechar a aba (ou navegar para fora do app), além do timeout. */
  trancarAoFechar: boolean;
};

/** O que o formulário de uma senha envia — o resto (favorita, anexos, tempos) tem ação própria. */
export type CamposEntrada = {
  titulo: string;
  usuario: string;
  senha: string;
  url: string;
  notas: string;
  expiraEm: string | null;
  otp: string | null;
  camposExtras: CampoExtraSenha[];
};

/**
 * Um grupo do cofre de senhas — o equivalente a uma pasta dentro do
 * `.kdbx`, podendo aninhar outros grupos à vontade (sem profundidade fixa,
 * diferente do caderno → seção → página das Anotações).
 */
export type GrupoSenhas = {
  id: string;
  nome: string;
  grupos: GrupoSenhas[];
  entradas: EntradaSenha[];
};

/** Um link salvo — a app de Links guarda só metadados, nunca o conteúdo da página. */
export type Link = {
  id: string;
  titulo: string;
  url: string;
  /** Caminho do favicon salvo em `_links/favicons/`, ou `null` (ícone genérico). */
  favicon: string | null;
  nota: string;
  favorito: boolean;
  criadoEm: string;
  atualizadoEm: string;
};

/**
 * Uma pasta de links — mesma forma recursiva do `GrupoSenhas` (aninha à
 * vontade, sem profundidade fixa), mas sem criptografia: é um JSON simples.
 * A pasta raiz (id fixo, nunca excluível) sempre existe, como o grupo
 * padrão do cofre.
 */
export type PastaLink = {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  pastas: PastaLink[];
  links: Link[];
};

export type ItemLixeiraLinks = {
  id: string;
  nome: string;
  tipo: "link" | "pasta-link";
  excluidoEm: string;
};
