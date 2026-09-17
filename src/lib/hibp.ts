/**
 * Confere se uma senha já apareceu num vazamento conhecido, via a API
 * pública do Have I Been Pwned — por k-anonimato: só os 5 primeiros
 * caracteres do hash SHA-1 da senha saem da máquina, nunca a senha (nem o
 * hash inteiro). O servidor devolve todos os hashes que começam com esse
 * prefixo (algumas centenas) e a comparação com o resto acontece aqui.
 * Roda só quando a pessoa pede (botão "Verificar vazamentos" no relatório
 * de saúde) — o app não manda nada para fora sozinho.
 */

async function sha1Hex(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const hash = await crypto.subtle.digest("SHA-1", bytes);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
}

/** Quantas vezes essa senha já apareceu em vazamentos conhecidos — 0 se nenhuma (ou se a consulta falhar). */
export async function contarVazamentos(senha: string): Promise<number> {
  if (!senha) return 0;
  const hash = await sha1Hex(senha);
  const prefixo = hash.slice(0, 5);
  const sufixo = hash.slice(5);
  const resposta = await fetch(`https://api.pwnedpasswords.com/range/${prefixo}`, {
    headers: { "Add-Padding": "true" },
  });
  if (!resposta.ok) throw new Error("Não deu para consultar agora.");
  const texto = await resposta.text();
  for (const linha of texto.split("\n")) {
    const [sufixoLinha, contagem] = linha.trim().split(":");
    if (sufixoLinha === sufixo) return Number(contagem) || 0;
  }
  return 0;
}
