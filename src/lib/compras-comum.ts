import type { LojaProduto, PrioridadeProduto, Produto } from "./tipos";

/**
 * O que a tela de Compras e o popup da extensão compartilham, sem tocar em
 * disco — importável de componentes de cliente (`compras-app.ts` não é,
 * por causa do `node:fs`).
 */

export const ROTULO_PRIORIDADE: Record<PrioridadeProduto, string> = {
  muito: "Quero muito",
  quero: "Quero",
  talvez: "Talvez um dia",
};

/** Versão curta, pro seletor de três botões caber numa linha. */
export const ROTULO_CURTO_PRIORIDADE: Record<PrioridadeProduto, string> = {
  muito: "Muito",
  quero: "Quero",
  talvez: "Talvez",
};

export const PRIORIDADES: PrioridadeProduto[] = ["muito", "quero", "talvez"];

const PESO_PRIORIDADE: Record<PrioridadeProduto, number> = { muito: 0, quero: 1, talvez: 2 };

/** Prioridade primeiro, depois o mais recente — a ordem dentro de cada categoria. */
export function ordenarProdutos(produtos: Produto[]): Produto[] {
  return [...produtos].sort((a, b) => {
    const porPrioridade = PESO_PRIORIDADE[a.prioridade] - PESO_PRIORIDADE[b.prioridade];
    return porPrioridade !== 0 ? porPrioridade : b.criadoEm.localeCompare(a.criadoEm);
  });
}

/** A loja mais barata entre as que têm preço anotado, ou `null`. */
export function menorPreco(lojas: LojaProduto[]): LojaProduto | null {
  let melhor: LojaProduto | null = null;
  for (const loja of lojas) {
    if (loja.preco === null) continue;
    if (!melhor || loja.preco < (melhor.preco ?? Infinity)) melhor = loja;
  }
  return melhor;
}

const formatador = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatarPreco(valor: number | null): string {
  return valor === null ? "" : formatador.format(valor);
}

/** O número como texto de campo editável — "1.299,90", sem o "R$"; `interpretarPreco` lê de volta. */
export function precoParaTexto(valor: number | null): string {
  return valor === null ? "" : valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "1.234,56", "1234.56", "R$ 99" — tudo vira número; texto sem dígito vira `null`. */
export function interpretarPreco(texto: string): number | null {
  const limpo = texto.replace(/[^\d.,]/g, "");
  if (!limpo) return null;
  // Com vírgula e ponto, o último separador é o decimal; só ponto ou só vírgula, idem.
  const ultimaVirgula = limpo.lastIndexOf(",");
  const ultimoPonto = limpo.lastIndexOf(".");
  const decimal = Math.max(ultimaVirgula, ultimoPonto);
  const inteiro = decimal >= 0 ? limpo.slice(0, decimal).replace(/[.,]/g, "") : limpo;
  const fracao = decimal >= 0 ? limpo.slice(decimal + 1).replace(/[.,]/g, "") : "";
  // "1.234" sem casas decimais de verdade (3 dígitos após o ponto) é milhar, não centavos.
  if (fracao.length === 3 && ultimaVirgula < 0) return Number(inteiro + fracao);
  const numero = Number(`${inteiro || "0"}.${fracao || "0"}`);
  return Number.isFinite(numero) ? numero : null;
}

/** Nome da loja a partir do endereço — "www.amazon.com.br" vira "amazon.com.br". */
export function lojaDaUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}
