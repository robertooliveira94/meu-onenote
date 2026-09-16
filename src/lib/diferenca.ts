/**
 * Diferença linha a linha entre dois textos — o que o painel de histórico
 * mostra antes de restaurar uma versão, para a troca não ser um salto no
 * escuro.
 *
 * Sem dependência: é o algoritmo clássico da maior subsequência comum
 * (LCS) sobre linhas, depois de tirar o começo e o fim iguais (que é a
 * maior parte de qualquer versão de uma nota). Uma nota de mil linhas
 * inteiramente reescrita ainda cabe (um milhão de células); acima disso,
 * o miolo vira "tudo saiu, tudo entrou" em vez de travar a tela.
 */
export type LinhaDiferenca = { tipo: "igual" | "saiu" | "entrou"; texto: string };

const LIMITE_DE_CELULAS = 4_000_000;

export function diferencaDeLinhas(antes: string, depois: string): LinhaDiferenca[] {
  // Texto vazio é zero linhas, não uma linha vazia — senão a primeira versão
  // de uma nota apareceria como "saiu uma linha em branco".
  const a = antes === "" ? [] : antes.split(/\r?\n/);
  const b = depois === "" ? [] : depois.split(/\r?\n/);

  let inicio = 0;
  while (inicio < a.length && inicio < b.length && a[inicio] === b[inicio]) inicio++;
  let fimA = a.length;
  let fimB = b.length;
  while (fimA > inicio && fimB > inicio && a[fimA - 1] === b[fimB - 1]) {
    fimA--;
    fimB--;
  }

  const meioA = a.slice(inicio, fimA);
  const meioB = b.slice(inicio, fimB);
  const resultado: LinhaDiferenca[] = a.slice(0, inicio).map((texto) => ({ tipo: "igual", texto }));

  if (meioA.length * meioB.length > LIMITE_DE_CELULAS) {
    for (const texto of meioA) resultado.push({ tipo: "saiu", texto });
    for (const texto of meioB) resultado.push({ tipo: "entrou", texto });
  } else {
    resultado.push(...diferencaPorLcs(meioA, meioB));
  }

  for (const texto of a.slice(fimA)) resultado.push({ tipo: "igual", texto });
  return resultado;
}

function diferencaPorLcs(a: string[], b: string[]): LinhaDiferenca[] {
  // tabela[i][j] = tamanho da LCS de a[i..] com b[j..]
  const tabela: Uint32Array[] = [];
  for (let i = 0; i <= a.length; i++) tabela.push(new Uint32Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      tabela[i][j] = a[i] === b[j] ? tabela[i + 1][j + 1] + 1 : Math.max(tabela[i + 1][j], tabela[i][j + 1]);
    }
  }

  const saida: LinhaDiferenca[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      saida.push({ tipo: "igual", texto: a[i] });
      i++;
      j++;
    } else if (tabela[i + 1][j] >= tabela[i][j + 1]) {
      saida.push({ tipo: "saiu", texto: a[i] });
      i++;
    } else {
      saida.push({ tipo: "entrou", texto: b[j] });
      j++;
    }
  }
  while (i < a.length) saida.push({ tipo: "saiu", texto: a[i++] });
  while (j < b.length) saida.push({ tipo: "entrou", texto: b[j++] });
  return saida;
}

/** Quantas linhas saíram e entraram — para o resumo "−3 +5" do painel. */
export function resumoDaDiferenca(linhas: LinhaDiferenca[]): { sairam: number; entraram: number } {
  let sairam = 0;
  let entraram = 0;
  for (const linha of linhas) {
    if (linha.tipo === "saiu") sairam++;
    else if (linha.tipo === "entrou") entraram++;
  }
  return { sairam, entraram };
}
