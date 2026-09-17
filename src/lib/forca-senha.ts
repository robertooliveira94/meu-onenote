/**
 * Gerador e medidor de força de senha. Módulo sem dependência de Node de
 * propósito: roda no navegador (o gerador, a barra de força enquanto se
 * digita) e no servidor (o relatório de saúde do cofre).
 *
 * A força é uma estimativa de entropia em bits — tamanho do alfabeto usado
 * elevado ao comprimento — com descontos para o que torna a senha fácil de
 * chutar mesmo sendo "longa": repetições, sequências (abc, 123, qwerty),
 * palavras muito comuns. Não é o zxcvbn; é o bastante para separar "123456"
 * de "correct horse battery staple" e para não chamar de forte uma senha
 * que é só uma palavra do dicionário.
 */

export type OpcoesGerador = {
  tamanho: number;
  minusculas: boolean;
  maiusculas: boolean;
  numeros: boolean;
  simbolos: boolean;
  /** Tira l, I, 1, O, 0, | — os que se confundem quando lidos/digitados. */
  evitarAmbiguos: boolean;
};

export const OPCOES_PADRAO: OpcoesGerador = {
  tamanho: 20,
  minusculas: true,
  maiusculas: true,
  numeros: true,
  simbolos: true,
  evitarAmbiguos: false,
};

const MINUSCULAS = "abcdefghijklmnopqrstuvwxyz";
const MAIUSCULAS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const NUMEROS = "0123456789";
const SIMBOLOS = "!@#$%&*()-_=+[]{};:,.?/";
const AMBIGUOS = "lI1O0|";

function sortearIndice(limite: number): number {
  // Rejeição para não enviesar o resto da divisão — `% limite` direto favoreceria os primeiros.
  const maximo = Math.floor(0x1_0000_0000 / limite) * limite;
  const buffer = new Uint32Array(1);
  let valor: number;
  do {
    crypto.getRandomValues(buffer);
    valor = buffer[0];
  } while (valor >= maximo);
  return valor % limite;
}

function embaralhar<T>(lista: T[]): T[] {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = sortearIndice(i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

/** Senha aleatória com pelo menos um caractere de cada classe ligada. */
export function gerarSenha(opcoes: OpcoesGerador): string {
  const classes: string[] = [];
  if (opcoes.minusculas) classes.push(MINUSCULAS);
  if (opcoes.maiusculas) classes.push(MAIUSCULAS);
  if (opcoes.numeros) classes.push(NUMEROS);
  if (opcoes.simbolos) classes.push(SIMBOLOS);
  if (classes.length === 0) classes.push(MINUSCULAS);
  const limpar = (alfabeto: string) =>
    opcoes.evitarAmbiguos ? [...alfabeto].filter((c) => !AMBIGUOS.includes(c)).join("") : alfabeto;
  const alfabetos = classes.map(limpar);
  const tudo = alfabetos.join("");
  const tamanho = Math.max(alfabetos.length, Math.min(128, Math.round(opcoes.tamanho)));

  // Um de cada classe primeiro (garante a mistura), o resto do alfabeto inteiro, e embaralha.
  const caracteres = alfabetos.map((alfabeto) => alfabeto[sortearIndice(alfabeto.length)]);
  while (caracteres.length < tamanho) caracteres.push(tudo[sortearIndice(tudo.length)]);
  return embaralhar(caracteres).join("");
}

/**
 * Palavras curtas e comuns do português, sem acento (para digitar em
 * qualquer teclado). Uma frase de 5 palavras daqui dá ~44 bits — mais que
 * uma senha aleatória de 8 caracteres, e dá para lembrar.
 */
export const PALAVRAS_FRASE = (
  "abelha abril acaso acucar agua aldeia alface algodao alho amigo anel anjo ano arco areia arroz arvore asa " +
  "atalho aviao azul bala balao banco banho barco barro batata beijo bicho bola bolo bosque brasa brisa cabo " +
  "cacau cadeira cafe caixa calor cama campo caneta canto capa carta casa cavalo cebola cedro cerca ceu chave " +
  "chuva cidade cinema circo clima cobre coelho colar colina copo coral corda cores couro cozinha cristal " +
  "cubo dado dama dente deserto dia dobra doce domingo dourado duna eco elefante escada escola espada espelho " +
  "estrada estrela faca farol feijao feira ferro festa figo filme fita flauta flor floresta fogo folha fonte " +
  "forno fruta fumaca galho garfo gato gelo girassol globo gota grama grao gruta guarda harpa hora horta ilha " +
  "inverno jacare janela jardim jarro jogo jornal lago lama lampada lanterna lapis laranja leao leite lenha " +
  "limao linha livro lobo lua luva maca madeira manga manha mapa mar marfim martelo mel mesa milho moeda " +
  "moinho montanha morango musica nave navio neve ninho noite nome nuvem oceano oliva onda orquidea osso " +
  "ouro ovelha palco palha pao papel parque pato pedra peixe pena pera pinheiro pipa piano planeta poeira " +
  "ponte porta porto prado prata praia quadro queijo quintal rabo raio ramo rede rei relogio remo rio rocha " +
  "roda rosa roupa rua sabao sal sala salsa sapato selva semente serra sino sol sombra sopa tapete tarde " +
  "teia telhado tempo terra tigre tinta tomate torre trem trigo trilha tulipa uva vaca vale vela vento verao " +
  "vidro vila vinho violao vulcao xale xicara zebra"
).split(" ");

/** Frase-senha: N palavras da lista, separadas por um caractere. */
export function gerarFrase(palavras: number, separador = "-"): string {
  const quantidade = Math.max(3, Math.min(10, Math.round(palavras)));
  const escolhidas: string[] = [];
  for (let i = 0; i < quantidade; i++) escolhidas.push(PALAVRAS_FRASE[sortearIndice(PALAVRAS_FRASE.length)]);
  return escolhidas.join(separador);
}

export type NivelForca = 0 | 1 | 2 | 3;

export const ROTULO_FORCA: Record<NivelForca, string> = {
  0: "Fraca",
  1: "Razoável",
  2: "Boa",
  3: "Forte",
};

export type Forca = { nivel: NivelForca; bits: number };

const SEQUENCIAS = ["abcdefghijklmnopqrstuvwxyz", "0123456789", "qwertyuiop", "asdfghjkl", "zxcvbnm"];

/** As senhas mais usadas do mundo (e do Brasil) — qualquer uma delas é "Fraca", não importa o resto. */
const MUITO_COMUNS = new Set([
  "123456", "12345678", "123456789", "1234567890", "password", "senha", "senha123", "qwerty", "abc123", "111111",
  "123123", "admin", "letmein", "welcome", "iloveyou", "brasil", "mudar123", "1q2w3e4r", "000000", "654321",
]);

/** Quantos caracteres da senha fazem parte de uma sequência (abc, 321, qwe…) de 3+ — não contam entropia. */
function tamanhoEmSequencias(senha: string): number {
  const minuscula = senha.toLowerCase();
  let total = 0;
  let i = 0;
  while (i < minuscula.length) {
    let melhor = 1;
    for (const sequencia of SEQUENCIAS) {
      const invertida = [...sequencia].reverse().join("");
      for (const alfabeto of [sequencia, invertida]) {
        const posicao = alfabeto.indexOf(minuscula[i]);
        if (posicao === -1) continue;
        let tamanho = 1;
        while (
          i + tamanho < minuscula.length &&
          posicao + tamanho < alfabeto.length &&
          alfabeto[posicao + tamanho] === minuscula[i + tamanho]
        ) {
          tamanho++;
        }
        if (tamanho > melhor) melhor = tamanho;
      }
    }
    if (melhor >= 3) {
      total += melhor;
      i += melhor;
    } else {
      i++;
    }
  }
  return total;
}

export function medirForca(senha: string): Forca {
  if (!senha) return { nivel: 0, bits: 0 };
  const minuscula = senha.toLowerCase();
  if (MUITO_COMUNS.has(minuscula) || MUITO_COMUNS.has(minuscula.replace(/[^a-z0-9]/g, ""))) {
    return { nivel: 0, bits: 4 };
  }

  // Frase-senha (palavras separadas): cada palavra vale ~11 bits (lista de
  // ~2 000 palavras que alguém escolheria), independente do tamanho dela.
  const palavras = senha.split(/[\s\-_.]+/).filter((parte) => parte.length >= 3);
  const pareceFrase = palavras.length >= 3 && /^[\p{L}\s\-_.]+$/u.test(senha);

  let bits: number;
  if (pareceFrase) {
    bits = palavras.length * 11;
  } else {
    let alfabeto = 0;
    if (/[a-z]/.test(senha)) alfabeto += 26;
    if (/[A-Z]/.test(senha)) alfabeto += 26;
    if (/[0-9]/.test(senha)) alfabeto += 10;
    if (/[^a-zA-Z0-9]/.test(senha)) alfabeto += 33;
    const emSequencia = tamanhoEmSequencias(senha);
    const distintos = new Set(senha).size;
    // Caracteres repetidos além dos distintos valem pouco ("aaaaaaaa" não é forte).
    const efetivo = Math.max(1, senha.length - emSequencia * 0.75 - Math.max(0, senha.length - distintos * 2) * 0.5);
    bits = efetivo * Math.log2(alfabeto || 1);
    // Só letras minúsculas e curta: provavelmente uma palavra — desconta.
    if (/^[a-z]+$/.test(senha) && senha.length <= 10) bits *= 0.6;
  }

  const nivel: NivelForca = bits < 40 ? 0 : bits < 55 ? 1 : bits < 75 ? 2 : 3;
  return { nivel, bits: Math.round(bits) };
}
