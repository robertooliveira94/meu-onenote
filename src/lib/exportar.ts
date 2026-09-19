import type { Dirent } from "node:fs";
import fs from "node:fs/promises";

import JSZip from "jszip";

import { formatarDataHora } from "./rotas";
import { listarNotas } from "./arquivos";
import {
  PASTA_SISTEMA,
  RAIZ,
  ehArquivoDeNota,
  ehPastaInterna,
  juntar,
  nomeDe,
  resolverCaminho,
} from "./caminhos";

/**
 * Junta uma seção inteira (com suas subseções) num único arquivo markdown.
 *
 * A ideia é ter uma cópia que se lê em qualquer lugar — outro computador, um
 * celular, um anexo de e-mail — sem depender deste aplicativo.
 */

/** Nível do cabeçalho pela profundidade, para a hierarquia sobreviver no arquivo. */
function cabecalho(nivel: number, texto: string): string {
  return `${"#".repeat(Math.min(nivel, 6))} ${texto}`;
}

/**
 * Rebaixa os títulos de dentro da nota para caberem abaixo do título dela.
 *
 * Sem isso, um "## Prioridades" escrito na página apareceria no mesmo nível das
 * seções do caderno e o sumário do arquivo exportado ficaria embaralhado.
 * Blocos de código são preservados: lá dentro "#" é conteúdo, não título.
 */
function rebaixarTitulos(conteudo: string, deslocamento: number): string {
  if (deslocamento <= 0) return conteudo;
  let dentroDeCodigo = false;

  return conteudo
    .split("\n")
    .map((linha) => {
      if (/^\s{0,3}(```|~~~)/.test(linha)) {
        dentroDeCodigo = !dentroDeCodigo;
        return linha;
      }
      if (dentroDeCodigo) return linha;

      const titulo = linha.match(/^(\s{0,3})(#{1,6})(\s+.*)$/);
      if (!titulo) return linha;

      const novoNivel = Math.min(titulo[2].length + deslocamento, 6);
      return `${titulo[1]}${"#".repeat(novoNivel)}${titulo[3]}`;
    })
    .join("\n");
}

async function juntarPasta(caminho: string, nivel: number, partes: string[]): Promise<void> {
  partes.push(cabecalho(nivel, nomeDe(caminho)));

  const nivelDaNota = Math.min(nivel + 1, 6);
  for (const nota of await listarNotas(caminho)) {
    partes.push(cabecalho(nivelDaNota, nota.titulo));
    const conteudo = (await fs.readFile(resolverCaminho(nota.caminho), "utf8")).trim();
    if (!conteudo) {
      partes.push("_(página em branco)_");
    } else if (nota.formato === "md") {
      partes.push(rebaixarTitulos(conteudo, nivelDaNota));
    } else {
      // Texto puro não tem marcação: entra como bloco, sem virar markdown por acidente.
      partes.push(conteudo);
    }
  }

  let entradas;
  try {
    entradas = await fs.readdir(resolverCaminho(caminho), { withFileTypes: true });
  } catch {
    return;
  }
  const subpastas = entradas
    .filter((entrada) => entrada.isDirectory() && !ehPastaInterna(entrada.name))
    .map((entrada) => entrada.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  for (const subpasta of subpastas) {
    await juntarPasta(juntar(caminho, subpasta), nivel + 1, partes);
  }
}

export async function exportarSecao(
  caminho: string,
): Promise<{ nome: string; conteudo: string }> {
  if (caminho.startsWith(PASTA_SISTEMA)) throw new Error("Essa pasta é interna");

  const partes: string[] = [];
  await juntarPasta(caminho, 1, partes);
  partes.push("---", `_Exportado de Meu bloco de anotações em ${formatarDataHora(new Date().toISOString())}._`);

  return {
    nome: `${nomeDe(caminho)}.md`,
    conteudo: partes.join("\n\n").replace(/\n{3,}/g, "\n\n"),
  };
}

/**
 * Copia uma pasta (caderno ou seção) inteira para dentro do zip, arquivo por
 * arquivo, na mesma estrutura de `dados/` — pasta vira pasta, `.md`/`.txt`
 * vira arquivo próprio, sem juntar nada. `zip.folder` entra mesmo em pastas
 * vazias, pra uma seção sem página nenhuma ainda aparecer no zip.
 */
async function copiarPastaParaZip(zip: JSZip, caminho: string): Promise<void> {
  let entradas: Dirent[];
  try {
    entradas = await fs.readdir(resolverCaminho(caminho), { withFileTypes: true });
  } catch {
    return;
  }

  for (const entrada of entradas) {
    if (entrada.isFile() && ehArquivoDeNota(entrada.name)) {
      const conteudo = await fs.readFile(resolverCaminho(juntar(caminho, entrada.name)), "utf8");
      zip.file(entrada.name, conteudo);
    } else if (entrada.isDirectory() && !ehPastaInterna(entrada.name)) {
      await copiarPastaParaZip(zip.folder(entrada.name)!, juntar(caminho, entrada.name));
    }
  }
}

/**
 * O vault inteiro — todo caderno, seção e página — num `.zip`, cada página
 * como arquivo `.md`/`.txt` próprio, exatamente na mesma árvore de pastas
 * de `dados/`. Diferente de `exportarSecao` (que junta tudo num arquivo
 * só): aqui a ideia é uma cópia de verdade da estrutura, não uma leitura
 * corrida.
 */
export async function exportarTudoZip(): Promise<Uint8Array> {
  const zip = new JSZip();

  let entradas: Dirent[];
  try {
    entradas = await fs.readdir(RAIZ, { withFileTypes: true });
  } catch {
    entradas = [];
  }
  const cadernos = entradas
    .filter((entrada) => entrada.isDirectory() && !ehPastaInterna(entrada.name))
    .map((entrada) => entrada.name)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));

  for (const caderno of cadernos) {
    await copiarPastaParaZip(zip.folder(caderno)!, caderno);
  }

  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

/** Exporta uma única página, preservando o formato original. */
export async function exportarNota(caminho: string): Promise<{ nome: string; conteudo: string }> {
  if (!ehArquivoDeNota(nomeDe(caminho))) throw new Error("Isso não é uma página");
  return {
    nome: nomeDe(caminho),
    conteudo: await fs.readFile(resolverCaminho(caminho), "utf8"),
  };
}
