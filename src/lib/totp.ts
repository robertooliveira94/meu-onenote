/**
 * TOTP (RFC 6238) — o código de 6 dígitos que troca a cada 30 segundos.
 * Módulo sem dependência de Node de propósito: o segredo já chega ao
 * navegador dentro da entrada (do mesmo jeito que a senha), então o código
 * é calculado ali mesmo, sem ida e volta ao servidor a cada troca.
 *
 * Aceita colar tanto o segredo em Base32 puro (o que a maioria dos sites
 * mostra ao ligar o 2FA) quanto a URI `otpauth://` inteira (o que dá para
 * copiar de um QR code lido por outro app) — guardado como está no campo
 * `otp` da entrada, convenção que o KeePassXC e o KeeWeb também usam.
 */

export type ConfigTotp = {
  segredo: string;
  digitos: number;
  periodo: number;
  algoritmo: "SHA-1" | "SHA-256" | "SHA-512";
  emissor: string | null;
  conta: string | null;
};

const ALFABETO_BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function decodificarBase32(texto: string): Uint8Array | null {
  const limpo = texto.replace(/\s|=/g, "").toUpperCase();
  if (!limpo || !/^[A-Z2-7]+$/.test(limpo)) return null;
  const bytes: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const caractere of limpo) {
    buffer = (buffer << 5) | ALFABETO_BASE32.indexOf(caractere);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      bytes.push((buffer >> bits) & 0xff);
    }
  }
  return new Uint8Array(bytes);
}

/** Aceita a URI `otpauth://totp/...` colada de um QR code. */
function interpretarUri(uri: string): ConfigTotp | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return null;
  }
  if (url.protocol !== "otpauth:" || url.hostname !== "totp") return null;
  const segredo = url.searchParams.get("secret");
  if (!segredo) return null;
  const rotulo = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  const [rotuloEmissor, rotuloConta] = rotulo.includes(":") ? rotulo.split(":", 2) : [null, rotulo];
  const algoritmoBruto = (url.searchParams.get("algorithm") ?? "SHA1").toUpperCase();
  const algoritmo: ConfigTotp["algoritmo"] =
    algoritmoBruto === "SHA256" ? "SHA-256" : algoritmoBruto === "SHA512" ? "SHA-512" : "SHA-1";
  return {
    segredo,
    digitos: Number(url.searchParams.get("digits")) || 6,
    periodo: Number(url.searchParams.get("period")) || 30,
    algoritmo,
    emissor: url.searchParams.get("issuer") ?? rotuloEmissor ?? null,
    conta: rotuloConta || null,
  };
}

/** O que foi colado no campo TOTP: uma URI `otpauth://` ou o segredo Base32 puro. Devolve `null` se não reconhece nada. */
export function interpretarOtp(texto: string): ConfigTotp | null {
  const valor = texto.trim();
  if (!valor) return null;
  if (valor.toLowerCase().startsWith("otpauth://")) return interpretarUri(valor);
  return decodificarBase32(valor)
    ? { segredo: valor, digitos: 6, periodo: 30, algoritmo: "SHA-1", emissor: null, conta: null }
    : null;
}

function paraBytesGrandes(numero: number): ArrayBuffer {
  // Contador de 8 bytes, big-endian — `numero` cabe em 32 bits até o ano 5138, então os 4 primeiros ficam zerados.
  const buffer = new ArrayBuffer(8);
  const bytes = new Uint8Array(buffer);
  let valor = numero;
  for (let i = 7; i >= 4; i--) {
    bytes[i] = valor & 0xff;
    valor = Math.floor(valor / 256);
  }
  return buffer;
}

/** O código de 6 (ou N) dígitos válido agora, com zeros à esquerda. */
export async function gerarCodigoTotp(config: ConfigTotp, agora: number = Date.now()): Promise<string> {
  const chaveBytes = decodificarBase32(config.segredo);
  if (!chaveBytes) throw new Error("Segredo TOTP inválido.");
  const contador = Math.floor(agora / 1000 / config.periodo);
  const chave = await crypto.subtle.importKey(
    "raw",
    chaveBytes.buffer.slice(chaveBytes.byteOffset, chaveBytes.byteOffset + chaveBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: config.algoritmo },
    false,
    ["sign"],
  );
  const hmac = new Uint8Array(await crypto.subtle.sign("HMAC", chave, paraBytesGrandes(contador)));
  const deslocamento = hmac[hmac.length - 1] & 0xf;
  const binario =
    ((hmac[deslocamento] & 0x7f) << 24) |
    ((hmac[deslocamento + 1] & 0xff) << 16) |
    ((hmac[deslocamento + 2] & 0xff) << 8) |
    (hmac[deslocamento + 3] & 0xff);
  const modulo = 10 ** config.digitos;
  return String(binario % modulo).padStart(config.digitos, "0");
}

/** Segundos restantes até o código atual expirar — para a barrinha de tempo. */
export function segundosRestantesTotp(periodo: number, agora: number = Date.now()): number {
  return periodo - (Math.floor(agora / 1000) % periodo);
}
