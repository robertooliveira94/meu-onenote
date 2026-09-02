import fs from "node:fs/promises";
import path from "node:path";

import {
  PASTA_ENTRADA,
  PASTA_GERAL,
  PASTA_SISTEMA,
  RAIZ,
  ehArquivoDeNota,
  ehPastaInterna,
  extensaoDe,
  formatoDe,
  garantirForaDoSistema,
  juntar,
  limparNome,
  nomeDe,
  pastaDe,
  profundidade,
  resolverCaminho,
  tituloDe,
} from "./caminhos";
import { moverHistorico, registrarVersao } from "./historico";
import {
  CORES_CADERNO,
  ICONES_CADERNO,
  atualizarIndice,
  entradaDaNota,
  entradaDaPasta,
  lerIndice,
  reapontar,
} from "./indice";
import type { Caderno, Formato, Indice, Nota, ResultadoBusca, ResumoNota, Secao } from "./tipos";

/**
 * Acesso ao conteúdo em `dados/`. A hierarquia do aplicativo é a hierarquia de
 * pastas do Windows: caderno é pasta de 1º nível, seção é subpasta, página é
 * arquivo .md ou .txt. Nada de banco de dados — o que está no disco manda.
 */

export async function garantirEstrutura(): Promise<void> {
  await fs.mkdir(path.join(RAIZ, PASTA_SISTEMA), { recursive: true });
  // Uma página nunca fica solta direto no caderno — por isso já nasce com a
  // seção "Geral" pronta, que é para onde a captura rápida e a nota do dia
  // escrevem.
  await fs.mkdir(path.join(RAIZ, PASTA_ENTRADA, PASTA_GERAL), { recursive: true });
}

async function existe(absoluto: string): Promise<boolean> {
  try {
    await fs.access(absoluto);
    return true;
  } catch {
    return false;
  }
}

/** Percorre a árvore inteira recolhendo notas e pastas visíveis. */
async function percorrer(relativo: string, notas: string[], pastas: string[]): Promise<void> {
  let entradas;
  try {
    entradas = await fs.readdir(resolverCaminho(relativo), { withFileTypes: true });
  } catch {
    return;
  }
  for (const entrada of entradas) {
    const filho = juntar(relativo, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name === PASTA_SISTEMA) continue;
      // A caixa de entrada guarda notas, mas não aparece como caderno.
      if (!ehPastaInterna(entrada.name)) pastas.push(filho);
      await percorrer(filho, notas, pastas);
    } else if (entrada.isFile() && ehArquivoDeNota(entrada.name)) {
      notas.push(filho);
    }
  }
}

/**
 * Uma página solta direto num caderno (de uma versão anterior do app, ou
 * copiada ali por fora) não é permitida na hierarquia fixa de 3 níveis —
 * vai para dentro de uma seção "Geral", criada na hora se não existir.
 * Se o caderno também tiver uma pasta `_anexos` solta na raiz, ela viaja
 * junto para dentro de "Geral" antes das páginas, para as imagens coladas
 * (`![](_anexos/arquivo.png)`, caminho relativo à página) continuarem
 * resolvendo depois da mudança.
 */
async function migrarPaginasSoltas(): Promise<void> {
  let entradasRaiz;
  try {
    entradasRaiz = await fs.readdir(RAIZ, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entradaCaderno of entradasRaiz) {
    if (!entradaCaderno.isDirectory() || ehPastaInterna(entradaCaderno.name)) continue;
    const caderno = entradaCaderno.name;

    let entradasCaderno;
    try {
      entradasCaderno = await fs.readdir(resolverCaminho(caderno), { withFileTypes: true });
    } catch {
      continue;
    }
    const soltas = entradasCaderno.filter(
      (entrada) => entrada.isFile() && ehArquivoDeNota(entrada.name),
    );
    if (soltas.length === 0) continue;

    const pastaGeral = juntar(caderno, PASTA_GERAL);
    await fs.mkdir(resolverCaminho(pastaGeral), { recursive: true });

    const anexosSoltos = juntar(caderno, "_anexos");
    if (await existe(resolverCaminho(anexosSoltos))) {
      const anexosNoDestino = juntar(pastaGeral, "_anexos");
      if (!(await existe(resolverCaminho(anexosNoDestino)))) {
        await fs.rename(resolverCaminho(anexosSoltos), resolverCaminho(anexosNoDestino));
      }
    }

    for (const solta of soltas) {
      try {
        await moverItem(juntar(caderno, solta.name), pastaGeral);
      } catch {
        // Já existe um arquivo com esse nome dentro de "Geral": deixa essa
        // página onde está por ora, em vez de travar a migração inteira
        // por causa de uma única colisão de nome.
      }
    }
  }
}

/**
 * Reconcilia o índice com o disco: adota arquivos que apareceram por fora
 * (você copiou um .txt para a pasta pelo Explorador) e descarta metadados de
 * quem sumiu. Roda a cada leitura da árvore, então mexer nos arquivos na mão
 * nunca deixa o aplicativo inconsistente.
 */
export async function sincronizarIndice(): Promise<void> {
  await garantirEstrutura();
  await migrarPaginasSoltas();
  const notas: string[] = [];
  const pastas: string[] = [];
  await percorrer("", notas, pastas);

  const notasNoDisco = new Set(notas);
  const pastasNoDisco = new Set(pastas);

  await atualizarIndice(async (indice) => {
    let mudou = false;

    for (const caminho of notas) {
      if (indice.notas[caminho]) continue;
      const info = await fs.stat(resolverCaminho(caminho));
      indice.notas[caminho] = {
        etiquetas: [],
        favorita: false,
        criadoEm: info.birthtime.toISOString(),
        atualizadoEm: info.mtime.toISOString(),
        ordem: Date.now(),
      };
      mudou = true;
    }

    for (const caminho of pastas) {
      if (indice.pastas[caminho]) continue;
      const ehCaderno = !caminho.includes("/");
      const quantidadeCadernos = Object.keys(indice.pastas).filter(
        (chave) => !chave.includes("/"),
      ).length;
      indice.pastas[caminho] = {
        cor: ehCaderno ? CORES_CADERNO[quantidadeCadernos % CORES_CADERNO.length] : "",
        icone: ehCaderno ? ICONES_CADERNO[quantidadeCadernos % ICONES_CADERNO.length] : "",
        ordem: Object.keys(indice.pastas).length,
        recolhida: false,
      };
      mudou = true;
    }

    // Cadernos criados com a paleta antiga recebem a cor e o ícone novos.
    // Sem isso, quem já tinha cadernos ficaria com o acento da versão anterior.
    const cadernos = Object.keys(indice.pastas)
      .filter((chave) => !chave.includes("/"))
      .sort((a, b) => (indice.pastas[a].ordem ?? 0) - (indice.pastas[b].ordem ?? 0));

    cadernos.forEach((caminho, posicao) => {
      const entrada = indice.pastas[caminho];
      if (!CORES_CADERNO.includes(entrada.cor)) {
        entrada.cor = CORES_CADERNO[posicao % CORES_CADERNO.length];
        mudou = true;
      }
      if (!entrada.icone) {
        entrada.icone = ICONES_CADERNO[posicao % ICONES_CADERNO.length];
        mudou = true;
      }
    });

    for (const caminho of Object.keys(indice.notas)) {
      if (notasNoDisco.has(caminho)) continue;
      delete indice.notas[caminho];
      mudou = true;
    }
    for (const caminho of Object.keys(indice.pastas)) {
      if (pastasNoDisco.has(caminho)) continue;
      delete indice.pastas[caminho];
      mudou = true;
    }

    // Sem mudança, não reescreve o arquivo à toa.
    return mudou ? true : false;
  });
}

/** Tira a marcação do markdown para a prévia da lista de páginas. */
export function resumirConteudo(conteudo: string, limite = 120): string {
  const limpo = conteudo
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}>\s?/gm, "")
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // Linha separadora de tabela (|---|---|) não diz nada na prévia.
    .replace(/^\s*\|?[-:\s|]+\|[-:\s|]*$/gm, " ")
    .replace(/\|/g, " · ")
    .replace(/[*_`~]/g, "")
    .replace(/\s+/g, " ")
    // Colunas viram "célula · célula"; separadores repetidos ou nas pontas saem.
    .replace(/(?:·\s*)+/g, "· ")
    .replace(/^\s*·\s*/, "")
    .replace(/\s*·\s*$/, "")
    .trim();
  return limpo.length > limite ? `${limpo.slice(0, limite).trimEnd()}…` : limpo;
}

async function montarResumo(
  caminho: string,
  indice: Indice,
  conteudo?: string,
): Promise<ResumoNota> {
  const entrada = indice.notas[caminho];
  const texto = conteudo ?? (await fs.readFile(resolverCaminho(caminho), "utf8"));
  return {
    caminho,
    titulo: tituloDe(caminho),
    formato: formatoDe(caminho),
    trecho: resumirConteudo(texto),
    criadoEm: entrada?.criadoEm ?? new Date().toISOString(),
    atualizadoEm: entrada?.atualizadoEm ?? new Date().toISOString(),
    favorita: entrada?.favorita ?? false,
    etiquetas: entrada?.etiquetas ?? [],
  };
}

async function montarSecao(relativo: string): Promise<Secao> {
  const entradas = await fs.readdir(resolverCaminho(relativo), { withFileTypes: true });
  const quantidadePaginas = entradas.filter(
    (entrada) => entrada.isFile() && ehArquivoDeNota(entrada.name),
  ).length;
  return { nome: nomeDe(relativo), caminho: relativo, quantidadePaginas };
}

async function montarCaderno(
  relativo: string,
  indice: Indice,
  cor: string,
  icone: string,
): Promise<Caderno> {
  const entradas = await fs.readdir(resolverCaminho(relativo), { withFileTypes: true });
  const secoes: Secao[] = [];

  for (const entrada of entradas) {
    // Uma página nunca fica solta direto no caderno — `migrarPaginasSoltas`
    // (chamada por `sincronizarIndice`, sempre antes disto) já garante que
    // só sobram subpastas aqui, nunca arquivo de nota.
    if (!entrada.isDirectory() || ehPastaInterna(entrada.name)) continue;
    secoes.push(await montarSecao(juntar(relativo, entrada.name)));
  }

  secoes.sort(
    (a, b) =>
      (indice.pastas[a.caminho]?.ordem ?? 0) - (indice.pastas[b.caminho]?.ordem ?? 0) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );

  return { nome: nomeDe(relativo), caminho: relativo, cor, icone, secoes };
}

/** Todos os cadernos, com as seções de cada um (nunca mais fundo que isso). */
export async function lerArvore(): Promise<Caderno[]> {
  await sincronizarIndice();
  const indice = await lerIndice();
  const entradas = await fs.readdir(RAIZ, { withFileTypes: true });

  const cadernos: Caderno[] = [];
  for (const entrada of entradas) {
    if (!entrada.isDirectory() || ehPastaInterna(entrada.name)) continue;
    const cor = indice.pastas[entrada.name]?.cor || CORES_CADERNO[0];
    const icone = indice.pastas[entrada.name]?.icone || ICONES_CADERNO[0];
    cadernos.push(await montarCaderno(entrada.name, indice, cor, icone));
  }

  cadernos.sort(
    (a, b) =>
      (indice.pastas[a.caminho]?.ordem ?? 0) - (indice.pastas[b.caminho]?.ordem ?? 0) ||
      a.nome.localeCompare(b.nome, "pt-BR"),
  );
  return cadernos;
}

/** Páginas de uma seção, na ordem manual definida pelo usuário. */
export async function listarNotas(pasta: string): Promise<ResumoNota[]> {
  const indice = await lerIndice();
  let entradas;
  try {
    entradas = await fs.readdir(resolverCaminho(pasta), { withFileTypes: true });
  } catch {
    return [];
  }

  const notas: ResumoNota[] = [];
  for (const entrada of entradas) {
    if (!entrada.isFile() || !ehArquivoDeNota(entrada.name)) continue;
    notas.push(await montarResumo(juntar(pasta, entrada.name), indice));
  }

  notas.sort(
    (a, b) =>
      (indice.notas[a.caminho]?.ordem ?? 0) - (indice.notas[b.caminho]?.ordem ?? 0) ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );
  return notas;
}

export async function lerNota(caminho: string): Promise<Nota | null> {
  const absoluto = resolverCaminho(caminho);
  if (!(await existe(absoluto))) return null;
  const conteudo = await fs.readFile(absoluto, "utf8");
  const indice = await lerIndice();
  return { ...(await montarResumo(caminho, indice, conteudo)), conteudo };
}

/**
 * Salva uma imagem colada direto no editor, numa subpasta `_anexos` ao lado
 * da nota — assim `![](_anexos/arquivo.png)` no markdown é um caminho
 * relativo de verdade, que resolve certo até fora deste app (VS Code,
 * Obsidian, qualquer visualizador que entenda markdown+imagem lado a lado).
 * `_anexos` começa com "_" de propósito: mesma convenção de `_sistema` e
 * `_Entrada`, então não aparece na árvore como se fosse uma seção.
 */
export async function salvarAnexo(
  caminhoDaNota: string,
  extensao: string,
  bytes: Buffer,
): Promise<string> {
  const pastaDaNota = pastaDe(caminhoDaNota);
  const pastaAnexos = juntar(pastaDaNota, "_anexos");
  await fs.mkdir(resolverCaminho(pastaAnexos), { recursive: true });

  const nome = await nomeDisponivel(pastaAnexos, String(Date.now()), extensao);
  const caminho = juntar(pastaAnexos, nome);
  await fs.writeFile(resolverCaminho(caminho), bytes);

  // Relativo à pasta da nota, não à raiz — é assim que o markdown referencia.
  return caminho.slice(pastaDaNota.length ? pastaDaNota.length + 1 : 0);
}

/** Grava a nota, guardando a versão anterior no histórico. */
export async function escreverNota(caminho: string, conteudo: string): Promise<void> {
  garantirForaDoSistema(caminho);
  const absoluto = resolverCaminho(caminho);
  if (!(await existe(absoluto))) throw new Error("Nota não encontrada");

  const anterior = await fs.readFile(absoluto, "utf8");
  if (anterior === conteudo) return;
  await registrarVersao(caminho, anterior);
  await fs.writeFile(absoluto, conteudo, "utf8");

  await atualizarIndice((indice) => {
    entradaDaNota(indice, caminho).atualizadoEm = new Date().toISOString();
  });
}

/** Acha um nome livre acrescentando " 2", " 3"... quando já existe. */
async function nomeDisponivel(pasta: string, base: string, extensao: string): Promise<string> {
  const sufixo = extensao ? `.${extensao}` : "";
  let tentativa = `${base}${sufixo}`;
  let contador = 2;
  while (await existe(resolverCaminho(juntar(pasta, tentativa)))) {
    tentativa = `${base} ${contador}${sufixo}`;
    contador += 1;
  }
  return tentativa;
}

export async function criarNota(
  pasta: string,
  titulo: string,
  formato: Formato,
  // Vazio por padrão: o título já aparece no alto da página, repetir como
  // cabeçalho no corpo só daria trabalho de apagar. Só um modelo escolhido
  // na criação preenche isto.
  conteudoInicial = "",
): Promise<string> {
  garantirForaDoSistema(juntar(pasta, "x"));
  // Página sempre dentro de uma seção — nunca solta direto num caderno, nem
  // na raiz. A hierarquia é fixa: caderno → seção → página.
  if (profundidade(pasta) !== 2) {
    throw new Error("Uma página só pode ser criada dentro de uma seção");
  }
  const base = limparNome(titulo) || "Sem título";
  const nome = await nomeDisponivel(pasta, base, formato);
  const caminho = juntar(pasta, nome);

  await fs.mkdir(resolverCaminho(pasta), { recursive: true });
  await fs.writeFile(resolverCaminho(caminho), conteudoInicial, "utf8");

  await atualizarIndice((indice) => {
    const agora = new Date().toISOString();
    indice.notas[caminho] = {
      etiquetas: [],
      favorita: false,
      criadoEm: agora,
      atualizadoEm: agora,
      ordem: Date.now(),
    };
  });
  return caminho;
}

export async function criarPasta(pai: string, nome: string): Promise<string> {
  // pai === "" cria um caderno (1º nível); pai sendo um caderno cria uma
  // seção dentro dele (2º nível). Uma seção nunca ganha outra seção dentro.
  if (profundidade(pai) >= 2) {
    throw new Error("Uma seção não pode ter outra seção dentro");
  }
  const limpo = limparNome(nome) || "Nova seção";
  garantirForaDoSistema(juntar(pai, limpo));
  const disponivel = await nomeDisponivel(pai, limpo, "");
  const caminho = juntar(pai, disponivel);
  await fs.mkdir(resolverCaminho(caminho), { recursive: true });
  await atualizarIndice((indice) => {
    entradaDaPasta(indice, caminho);
  });
  return caminho;
}

/** Notas dentro de uma pasta, em qualquer profundidade. */
async function notasDentroDe(pasta: string): Promise<string[]> {
  const notas: string[] = [];
  const pastas: string[] = [];
  await percorrer(pasta, notas, pastas);
  return notas;
}

/** Move os históricos junto quando um caminho muda de lugar. */
async function acompanharHistoricos(
  de: string,
  para: string,
  ehPasta: boolean,
  notasAntes: string[],
): Promise<void> {
  if (!ehPasta) {
    await moverHistorico(de, para);
    return;
  }
  for (const nota of notasAntes) {
    await moverHistorico(nota, para + nota.slice(de.length));
  }
}

export async function renomearItem(caminho: string, novoNome: string): Promise<string> {
  garantirForaDoSistema(caminho);
  const absoluto = resolverCaminho(caminho);
  const info = await fs.stat(absoluto);
  const ehPasta = info.isDirectory();

  const limpo = limparNome(novoNome);
  if (!limpo) throw new Error("Informe um nome");

  const extensao = ehPasta ? "" : extensaoDe(caminho);
  const pai = pastaDe(caminho);
  const alvo = juntar(pai, extensao ? `${limpo}.${extensao}` : limpo);
  if (alvo === caminho) return caminho;
  if (await existe(resolverCaminho(alvo))) throw new Error("Já existe um item com esse nome aqui");

  const notasAntes = ehPasta ? await notasDentroDe(caminho) : [];
  await fs.rename(absoluto, resolverCaminho(alvo));
  await acompanharHistoricos(caminho, alvo, ehPasta, notasAntes);
  await atualizarIndice((indice) => reapontar(indice, caminho, alvo));
  return alvo;
}

export async function moverItem(caminho: string, novaPasta: string): Promise<string> {
  garantirForaDoSistema(caminho);
  if (novaPasta === caminho || novaPasta.startsWith(`${caminho}/`)) {
    throw new Error("Não dá para mover um item para dentro dele mesmo");
  }
  const absoluto = resolverCaminho(caminho);
  const info = await fs.stat(absoluto);
  const ehPasta = info.isDirectory();

  // Hierarquia fixa: só uma seção pode ser movida (nunca um caderno, que já
  // está no topo), e só para dentro de outro caderno. Só uma página pode
  // trocar de seção — nunca ir direto para um caderno.
  if (ehPasta) {
    if (profundidade(caminho) !== 2) throw new Error("Um caderno não tem para onde se mover");
    if (profundidade(novaPasta) !== 1) throw new Error("Uma seção só pode ir para dentro de um caderno");
  } else if (profundidade(novaPasta) !== 2) {
    throw new Error("Uma página só pode ir para dentro de uma seção");
  }

  const alvo = juntar(novaPasta, nomeDe(caminho));
  if (alvo === caminho) return caminho;
  if (await existe(resolverCaminho(alvo))) {
    throw new Error("Já existe um item com esse nome no destino");
  }

  const notasAntes = ehPasta ? await notasDentroDe(caminho) : [];
  await fs.mkdir(resolverCaminho(novaPasta), { recursive: true });
  await fs.rename(absoluto, resolverCaminho(alvo));
  await acompanharHistoricos(caminho, alvo, ehPasta, notasAntes);
  await atualizarIndice((indice) => reapontar(indice, caminho, alvo));
  return alvo;
}

/** Troca a extensão da nota, preservando o conteúdo e os metadados. */
export async function converterFormato(caminho: string, formato: Formato): Promise<string> {
  if (formatoDe(caminho) === formato) return caminho;
  const alvo = juntar(pastaDe(caminho), `${tituloDe(caminho)}.${formato}`);
  if (await existe(resolverCaminho(alvo))) {
    throw new Error("Já existe um arquivo com esse nome no outro formato");
  }
  await fs.rename(resolverCaminho(caminho), resolverCaminho(alvo));
  await moverHistorico(caminho, alvo);
  await atualizarIndice((indice) => reapontar(indice, caminho, alvo));
  return alvo;
}

/** Reordena uma nota dentro da seção, uma posição para cima ou para baixo. */
export async function reordenarNota(caminho: string, direcao: -1 | 1): Promise<void> {
  const irmas = await listarNotas(pastaDe(caminho));
  const atual = irmas.findIndex((nota) => nota.caminho === caminho);
  const destino = atual + direcao;
  if (atual < 0 || destino < 0 || destino >= irmas.length) return;

  const ordenadas = [...irmas];
  const [movida] = ordenadas.splice(atual, 1);
  ordenadas.splice(destino, 0, movida);

  await atualizarIndice((indice) => {
    ordenadas.forEach((nota, posicao) => {
      entradaDaNota(indice, nota.caminho).ordem = posicao;
    });
  });
}

/** Reordena uma pasta entre suas irmãs. */
export async function reordenarPasta(caminho: string, direcao: -1 | 1): Promise<void> {
  const indice = await lerIndice();
  const pai = pastaDe(caminho);
  const irmas = Object.keys(indice.pastas)
    .filter((chave) => pastaDe(chave) === pai)
    .sort((a, b) => (indice.pastas[a].ordem ?? 0) - (indice.pastas[b].ordem ?? 0));

  const atual = irmas.indexOf(caminho);
  const destino = atual + direcao;
  if (atual < 0 || destino < 0 || destino >= irmas.length) return;

  const ordenadas = [...irmas];
  const [movida] = ordenadas.splice(atual, 1);
  ordenadas.splice(destino, 0, movida);

  await atualizarIndice((atualizado) => {
    ordenadas.forEach((pasta, posicao) => {
      entradaDaPasta(atualizado, pasta).ordem = posicao;
    });
  });
}

export async function notasRecentes(limite = 8): Promise<ResumoNota[]> {
  await sincronizarIndice();
  const indice = await lerIndice();
  const caminhos = Object.keys(indice.notas)
    .sort((a, b) => indice.notas[b].atualizadoEm.localeCompare(indice.notas[a].atualizadoEm))
    .slice(0, limite);
  return Promise.all(caminhos.map((caminho) => montarResumo(caminho, indice)));
}

export async function notasFavoritas(): Promise<ResumoNota[]> {
  await sincronizarIndice();
  const indice = await lerIndice();
  const caminhos = Object.keys(indice.notas).filter((caminho) => indice.notas[caminho].favorita);
  const resumos = await Promise.all(caminhos.map((caminho) => montarResumo(caminho, indice)));
  return resumos.sort((a, b) => a.titulo.localeCompare(b.titulo, "pt-BR"));
}

export async function notasComEtiqueta(etiqueta: string): Promise<ResumoNota[]> {
  await sincronizarIndice();
  const indice = await lerIndice();
  const caminhos = Object.keys(indice.notas).filter((caminho) =>
    indice.notas[caminho].etiquetas.includes(etiqueta),
  );
  const resumos = await Promise.all(caminhos.map((caminho) => montarResumo(caminho, indice)));
  return resumos.sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm));
}

/** Tira acentos e caixa para comparar do jeito que a pessoa espera. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Busca no título e no corpo de todas as notas. */
export async function buscar(termo: string, etiqueta?: string): Promise<ResultadoBusca[]> {
  const procurado = normalizar(termo.trim());
  if (procurado.length < 2) return [];

  await sincronizarIndice();
  const indice = await lerIndice();
  const resultados: ResultadoBusca[] = [];

  for (const caminho of Object.keys(indice.notas)) {
    const entrada = indice.notas[caminho];
    if (etiqueta && !entrada.etiquetas.includes(etiqueta)) continue;

    const titulo = tituloDe(caminho);
    const achadoNoTitulo = normalizar(titulo).includes(procurado);

    let conteudo = "";
    try {
      conteudo = await fs.readFile(resolverCaminho(caminho), "utf8");
    } catch {
      continue;
    }
    const posicao = normalizar(conteudo).indexOf(procurado);
    if (!achadoNoTitulo && posicao < 0) continue;

    let trecho = resumirConteudo(conteudo, 110);
    if (posicao >= 0) {
      const inicio = Math.max(0, posicao - 40);
      trecho = resumirConteudo(conteudo.slice(inicio, posicao + 110), 130);
      if (inicio > 0) trecho = `…${trecho}`;
    }

    resultados.push({
      caminho,
      titulo,
      formato: formatoDe(caminho),
      trecho,
      achadoNoTitulo,
      etiquetas: entrada.etiquetas,
      atualizadoEm: entrada.atualizadoEm,
    });
  }

  // Acerto no título vale mais que acerto no corpo; depois, o mais recente.
  return resultados
    .sort(
      (a, b) =>
        Number(b.achadoNoTitulo) - Number(a.achadoNoTitulo) ||
        b.atualizadoEm.localeCompare(a.atualizadoEm),
    )
    .slice(0, 40);
}
