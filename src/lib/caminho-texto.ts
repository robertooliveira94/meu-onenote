import type { Formato } from "./tipos";

/**
 * Manipulação de caminhos relativos (`"Pessoal/Financeiro/orçamento.md"`)
 * como texto puro — nada de `node:fs`/`node:path` aqui, de propósito: este
 * módulo também é importado por componentes de cliente (ex.: para montar o
 * caminho de uma imagem colada), e um `import "node:path"` nesse contexto
 * quebra o build do navegador. Quem precisa tocar o disco de verdade usa
 * `caminhos.ts`, que reexporta tudo daqui e acrescenta a parte de servidor.
 */

/** Caracteres que o Windows não aceita em nome de arquivo. */
const CARACTERES_INVALIDOS = ["<", ">", ":", '"', "|", "?", "*", "/", "\\"];
/** Nomes reservados do Windows (CON, PRN, COM1...). */
const NOMES_RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export class CaminhoInvalido extends Error {}

function temCaractereProibido(nome: string): boolean {
  if (CARACTERES_INVALIDOS.some((caractere) => nome.includes(caractere))) return true;
  for (let i = 0; i < nome.length; i += 1) {
    if (nome.charCodeAt(i) < 32) return true;
  }
  return false;
}

/** Um nome de pasta ou arquivo é aceitável? */
export function nomeValido(nome: string): boolean {
  if (!nome || nome !== nome.trim()) return false;
  if (nome === "." || nome === "..") return false;
  if (nome.length > 120) return false;
  if (temCaractereProibido(nome)) return false;
  if (nome.endsWith(".")) return false;
  const semExtensao = nome.replace(/\.[^.]*$/, "");
  if (NOMES_RESERVADOS.test(semExtensao)) return false;
  return true;
}

/** Troca por espaço o que o sistema de arquivos não aceita, para sugerir um nome. */
export function limparNome(nome: string): string {
  let limpo = "";
  for (const caractere of nome) {
    const proibido = CARACTERES_INVALIDOS.includes(caractere) || caractere.charCodeAt(0) < 32;
    limpo += proibido ? " " : caractere;
  }
  return limpo.replace(/\s+/g, " ").replace(/\.+$/, "").trim().slice(0, 120);
}

/** Quebra um caminho relativo em segmentos, validando cada um. */
export function segmentos(relativo: string): string[] {
  const partes = relativo.split("/").filter((parte) => parte.length > 0);
  for (const parte of partes) {
    if (!nomeValido(parte)) {
      throw new CaminhoInvalido(`Nome inválido no caminho: "${parte}"`);
    }
  }
  return partes;
}

export function juntar(...partes: string[]): string {
  return partes.filter((parte) => parte.length > 0).join("/");
}

/**
 * Quantos níveis de pasta o caminho tem. Cadernos ficam na raiz (1 nível);
 * seções moram dentro de um caderno (2 níveis). A hierarquia é fixa nesses
 * dois — nunca existe uma pasta de 3 níveis (isso seria uma seção dentro de
 * outra seção, que este app não permite).
 */
export function profundidade(relativo: string): number {
  return segmentos(relativo).length;
}

export function pastaDe(relativo: string): string {
  const partes = relativo.split("/");
  partes.pop();
  return partes.join("/");
}

export function nomeDe(relativo: string): string {
  return relativo.split("/").pop() ?? "";
}

export function extensaoDe(relativo: string): string {
  const nome = nomeDe(relativo);
  const ponto = nome.lastIndexOf(".");
  return ponto <= 0 ? "" : nome.slice(ponto + 1).toLowerCase();
}

export function formatoDe(relativo: string): Formato {
  return extensaoDe(relativo) === "md" ? "md" : "txt";
}

/** "Pessoal/Financeiro/orcamento.md" → "orcamento" */
export function tituloDe(relativo: string): string {
  const nome = nomeDe(relativo);
  const ponto = nome.lastIndexOf(".");
  return ponto <= 0 ? nome : nome.slice(0, ponto);
}

/** Pastas iniciadas por "_" são internas e não aparecem na árvore. */
export function ehPastaInterna(nome: string): boolean {
  return nome.startsWith("_");
}

/** Só entram na aplicação arquivos de texto. */
export function ehArquivoDeNota(nome: string): boolean {
  const extensao = nome.slice(nome.lastIndexOf(".") + 1).toLowerCase();
  return extensao === "md" || extensao === "txt";
}
