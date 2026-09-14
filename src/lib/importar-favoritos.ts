/**
 * Parser do arquivo de favoritos que os navegadores exportam (Netscape
 * Bookmark File Format — não é XML de verdade, então nada de DOM parser:
 * um scanner simples sobre as tags que interessam já basta). Puro, sem
 * tocar disco nem rede — quem grava é `importarArvore` em `links-app.ts`.
 */

export type NoImportado =
  | { tipo: "pasta"; nome: string; filhos: NoImportado[] }
  | { tipo: "link"; titulo: string; url: string };

const ENTIDADES_HTML: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
  nbsp: " ",
};

function decodificarEntidades(texto: string): string {
  return texto.replace(/&(#?\w+);/g, (bruto, nome: string) => ENTIDADES_HTML[nome.toLowerCase()] ?? bruto);
}

/**
 * `<DT><H3>Nome</H3><DL><p>...filhos...</DL><p>` é uma pasta; `<DT><A
 * HREF="...">Texto</A>` é um link. O `<DL>` mais de fora (antes de
 * qualquer `<H3>`) não é pasta nenhuma — é só o começo do arquivo — por
 * isso ele empilha a MESMA lista corrente em vez de criar um nó "pasta"
 * sem nome; só um `<DL>` que veio logo depois de um `<H3>` vira pasta de
 * verdade.
 */
export function analisarBookmarksHtml(html: string): NoImportado[] {
  const regexToken = /<H3[^>]*>([^<]*)<\/H3>|<A\s+([^>]*)>([^<]*)<\/A>|<DL>|<\/DL>/gi;
  const raiz: NoImportado[] = [];
  const pilha: NoImportado[][] = [raiz];
  let nomePastaPendente: string | null = null;
  let m: RegExpExecArray | null;

  while ((m = regexToken.exec(html))) {
    const token = m[0];
    const topo = pilha[pilha.length - 1];

    if (/^<H3/i.test(token)) {
      nomePastaPendente = decodificarEntidades((m[1] ?? "").trim()).slice(0, 60) || "Sem nome";
    } else if (/^<A/i.test(token)) {
      const href = (m[2] ?? "").match(/HREF\s*=\s*"([^"]*)"/i)?.[1];
      if (href) {
        const titulo = decodificarEntidades((m[3] ?? "").trim()).slice(0, 200) || href;
        topo.push({ tipo: "link", titulo, url: href });
      }
    } else if (token === "<DL>") {
      if (nomePastaPendente !== null) {
        const filhos: NoImportado[] = [];
        topo.push({ tipo: "pasta", nome: nomePastaPendente, filhos });
        pilha.push(filhos);
        nomePastaPendente = null;
      } else {
        // DL "solto" (o de fora do arquivo inteiro, tipicamente) — mesma
        // lista corrente, só pra manter `<DL>`/`</DL>` balanceados.
        pilha.push(topo);
      }
    } else if (token === "</DL>") {
      if (pilha.length > 1) pilha.pop();
    }
  }

  return raiz;
}
