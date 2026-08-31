import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { CORES_CADERNO, ICONES_CADERNO } from "./cores";
import type { EntradaNota, EntradaPasta, Indice } from "./tipos";

export { CORES_CADERNO, ICONES_CADERNO };

/**
 * O índice guarda o que não cabe dentro do arquivo: etiquetas, favoritos,
 * datas, ordem manual e a cor de cada caderno.
 *
 * Ele mora em `dados/_sistema/indice.json` justamente para que as notas em si
 * continuem sendo arquivos limpos, abríveis no Bloco de Notas do Windows.
 * O disco é a fonte da verdade; o índice é um acessório que se reconstrói
 * sozinho (ver `sincronizarIndice` em arquivos.ts).
 */
const ARQUIVO_INDICE = path.join(RAIZ, PASTA_SISTEMA, "indice.json");

const INDICE_VAZIO: Indice = { versao: 1, notas: {}, pastas: {} };

/**
 * Fila para que duas escritas simultâneas não se atropelem. É uma proteção
 * parcial: o Next.js em modo desenvolvimento instancia este módulo mais de
 * uma vez (uma para as Server Actions, outra para a renderização das
 * páginas), então esta fila só serializa chamadas dentro da MESMA instância.
 * Ainda assim ajuda a evitar perder escrita quando duas ações do mesmo tipo
 * de chamada acontecem em sequência rápida.
 */
let fila: Promise<unknown> = Promise.resolve();

export function entradaNotaPadrao(agora = new Date().toISOString()): EntradaNota {
  return { etiquetas: [], favorita: false, criadoEm: agora, atualizadoEm: agora, ordem: 0 };
}

export function entradaPastaPadrao(indice: number): EntradaPasta {
  return {
    cor: CORES_CADERNO[indice % CORES_CADERNO.length],
    icone: ICONES_CADERNO[indice % ICONES_CADERNO.length],
    ordem: indice,
    recolhida: false,
  };
}

/**
 * Sempre lê do disco, sem guardar em memória entre chamadas.
 *
 * Existiu uma versão com cache aqui, e ela escondia um bug sério: o Next.js
 * em modo desenvolvimento compila este arquivo em mais de uma vez — uma
 * instância para as Server Actions (que escrevem) e outra para a
 * renderização das páginas (que leem). Cada instância tinha sua própria
 * variável de módulo, então uma escrita numa nunca aparecia na outra —
 * ícone, cor e nome pareciam "não mudar" até o Next recarregar aquele
 * módulo por acaso. O arquivo é pequeno (poucos KB), então ler do disco a
 * cada chamada não pesa, e elimina a causa do problema de uma vez.
 */
async function carregar(): Promise<Indice> {
  try {
    const bruto = await fs.readFile(ARQUIVO_INDICE, "utf8");
    const lido = JSON.parse(bruto) as Partial<Indice>;
    return {
      versao: lido.versao ?? 1,
      notas: lido.notas ?? {},
      pastas: lido.pastas ?? {},
    };
  } catch {
    // Primeira execução, ou arquivo corrompido: recomeça vazio.
    // Nada se perde — o conteúdo real está nos arquivos de texto.
    return structuredClone(INDICE_VAZIO);
  }
}

export async function lerIndice(): Promise<Indice> {
  return carregar();
}

async function gravar(indice: Indice): Promise<void> {
  await fs.mkdir(path.dirname(ARQUIVO_INDICE), { recursive: true });
  await fs.writeFile(ARQUIVO_INDICE, JSON.stringify(indice, null, 2), "utf8");
}

/**
 * Lê, altera e grava o índice numa operação só. A função recebe o índice para
 * modificar à vontade; devolver `false` cancela a gravação.
 */
export async function atualizarIndice<T>(
  alterar: (indice: Indice) => T | Promise<T>,
): Promise<T> {
  const proxima = fila.then(async () => {
    const indice = await carregar();
    const resultado = await alterar(indice);
    if (resultado !== false) await gravar(indice);
    return resultado;
  });
  // A fila não pode quebrar por causa de um erro numa operação isolada.
  fila = proxima.catch(() => undefined);
  return proxima;
}

/** Metadados de uma nota, criando a entrada na hora se ela ainda não existir. */
export function entradaDaNota(indice: Indice, caminho: string): EntradaNota {
  if (!indice.notas[caminho]) indice.notas[caminho] = entradaNotaPadrao();
  return indice.notas[caminho];
}

/** Metadados de uma pasta, criando a entrada na hora se ela ainda não existir. */
export function entradaDaPasta(indice: Indice, caminho: string): EntradaPasta {
  if (!indice.pastas[caminho]) {
    const quantidade = Object.keys(indice.pastas).length;
    indice.pastas[caminho] = entradaPastaPadrao(quantidade);
  }
  return indice.pastas[caminho];
}

/**
 * Reaponta metadados quando algo é renomeado ou movido, incluindo tudo que
 * estava dentro da pasta.
 */
export function reapontar(indice: Indice, de: string, para: string): void {
  const mover = <T>(mapa: Record<string, T>) => {
    for (const chave of Object.keys(mapa)) {
      if (chave !== de && !chave.startsWith(`${de}/`)) continue;
      mapa[para + chave.slice(de.length)] = mapa[chave];
      delete mapa[chave];
    }
  };
  mover(indice.notas);
  mover(indice.pastas);
}

/** Remove metadados de um item e de tudo que estava dentro dele. */
export function esquecer(indice: Indice, caminho: string): void {
  const limpar = <T>(mapa: Record<string, T>) => {
    for (const chave of Object.keys(mapa)) {
      if (chave === caminho || chave.startsWith(`${caminho}/`)) delete mapa[chave];
    }
  };
  limpar(indice.notas);
  limpar(indice.pastas);
}
