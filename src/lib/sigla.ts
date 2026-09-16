/**
 * "Trabalho" → "TRB", "Claude Code" → "CLC", "Tiktok shop" → "TKS": a sigla
 * que abre o identificador curto de cada tarefa ("TRB-14"). Primeira letra
 * do nome mais as duas consoantes seguintes — é como o Linear e o Jira
 * abreviam, e é o que faz um número virar referência falável ("o TRB-14").
 * Sem consoante suficiente, completa com o que houver.
 */
export function siglaDoQuadro(nome: string): string {
  const letras = nome
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  if (!letras) return "TAR";
  const primeira = letras[0];
  const consoantes = letras.slice(1).replace(/[AEIOU]/g, "");
  const resto = (consoantes + letras.slice(1)).slice(0, 2);
  return (primeira + resto).padEnd(3, "X").slice(0, 3);
}
