import type { Estimativa, EtiquetaKanban, ExtrasDaTarefa, Prioridade, SprintKanban } from "./tipos";

/**
 * Adição rápida de tarefa: "Revisar orçamento !alta #financeiro @sexta
 * ~sprint3 =M" vira título + prioridade + etiqueta + prazo + sprint +
 * estimativa, sem abrir o editor. Cada pastilha é reconhecida na hora e
 * mostrada embaixo do campo antes de confirmar; o que não casa com nada
 * fica no título como texto.
 *
 * Sintaxe:
 * - `!baixa` `!media` `!alta` `!urgente` (ou `!1`…`!4`) — prioridade
 * - `#nome` — etiqueta cadastrada (sem acento, sem caixa)
 * - `@hoje` `@amanha` `@seg`…`@dom` `@20/09` `@20/09/2026` `@2026-09-20` — prazo
 * - `~nome` — sprint cadastrada
 * - `=P` `=M` `=G` — estimativa
 */

export type Reconhecido = {
  tipo: "prioridade" | "etiqueta" | "prazo" | "sprint" | "estimativa";
  /** O texto que apareceu no campo (para a pastilha). */
  original: string;
  /** Como a pastilha descreve o que entendeu ("Alta", "sexta 19/09"). */
  rotulo: string;
};

export type Interpretacao = {
  titulo: string;
  extras: ExtrasDaTarefa;
  reconhecidos: Reconhecido[];
};

const PRIORIDADE_POR_TOKEN: Record<string, Prioridade> = {
  baixa: "baixa",
  "1": "baixa",
  media: "media",
  média: "media",
  "2": "media",
  alta: "alta",
  "3": "alta",
  urgente: "urgente",
  "4": "urgente",
};

const RUBRICA: Record<Prioridade, string> = { baixa: "Baixa", media: "Média", alta: "Alta", urgente: "Urgente" };

/** Nomes aceitos por dia da semana, na ordem do `Date.getDay()`. */
const DIAS: string[][] = [
  ["dom", "domingo"],
  ["seg", "segunda", "segunda-feira"],
  ["ter", "terca", "terca-feira"],
  ["qua", "quarta", "quarta-feira"],
  ["qui", "quinta", "quinta-feira"],
  ["sex", "sexta", "sexta-feira"],
  ["sab", "sabado"],
];

function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function iso(data: Date): string {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

/** "@sexta", "@amanha", "@20/09"… → "AAAA-MM-DD", ou null se não entendeu. */
export function interpretarData(token: string, hoje: Date): string | null {
  const t = normalizar(token);
  const base = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  if (t === "hoje") return iso(base);
  if (t === "amanha") {
    base.setDate(base.getDate() + 1);
    return iso(base);
  }
  // Próximo dia da semana com esse nome (nunca hoje: "@sexta" numa sexta é a próxima).
  const dia = DIAS.findIndex((nomes) => nomes.some((nome) => nome === t || (t.length >= 3 && nome.startsWith(t))));
  if (dia !== -1) {
    let salto = (dia - base.getDay() + 7) % 7;
    if (salto === 0) salto = 7;
    base.setDate(base.getDate() + salto);
    return iso(base);
  }
  let m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (m) {
    const ano = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : hoje.getFullYear();
    const data = new Date(ano, Number(m[2]) - 1, Number(m[1]));
    if (data.getMonth() !== Number(m[2]) - 1) return null;
    return iso(data);
  }
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return t;
  return null;
}

export function interpretarAdicaoRapida(
  texto: string,
  etiquetas: EtiquetaKanban[],
  sprints: SprintKanban[],
  hoje = new Date(),
): Interpretacao {
  const extras: ExtrasDaTarefa = {};
  const reconhecidos: Reconhecido[] = [];
  const sobras: string[] = [];

  for (const palavra of texto.split(/\s+/)) {
    if (!palavra) continue;
    const marca = palavra[0];
    const corpo = palavra.slice(1);

    if (marca === "!" && corpo && PRIORIDADE_POR_TOKEN[normalizar(corpo)]) {
      extras.prioridade = PRIORIDADE_POR_TOKEN[normalizar(corpo)];
      reconhecidos.push({ tipo: "prioridade", original: palavra, rotulo: RUBRICA[extras.prioridade] });
      continue;
    }
    if (marca === "#" && corpo) {
      const etiqueta = etiquetas.find((item) => normalizar(item.nome) === normalizar(corpo));
      if (etiqueta) {
        extras.etiquetas = [...(extras.etiquetas ?? []), etiqueta.id];
        reconhecidos.push({ tipo: "etiqueta", original: palavra, rotulo: etiqueta.nome });
        continue;
      }
    }
    if (marca === "@" && corpo) {
      const data = interpretarData(corpo, hoje);
      if (data) {
        extras.prazo = data;
        const [ano, mes, dia] = data.split("-");
        reconhecidos.push({ tipo: "prazo", original: palavra, rotulo: `${dia}/${mes}/${ano.slice(2)}` });
        continue;
      }
    }
    if (marca === "~" && corpo) {
      const sprint = sprints.find((item) => !item.fechadaEm && normalizar(item.nome).replace(/\s+/g, "") === normalizar(corpo));
      if (sprint) {
        extras.sprintId = sprint.id;
        reconhecidos.push({ tipo: "sprint", original: palavra, rotulo: sprint.nome });
        continue;
      }
    }
    if (marca === "=" && /^[pmg]$/i.test(corpo)) {
      extras.estimativa = corpo.toUpperCase() as Estimativa;
      reconhecidos.push({ tipo: "estimativa", original: palavra, rotulo: `Estimativa ${extras.estimativa}` });
      continue;
    }
    sobras.push(palavra);
  }

  return { titulo: sobras.join(" ").trim(), extras, reconhecidos };
}
