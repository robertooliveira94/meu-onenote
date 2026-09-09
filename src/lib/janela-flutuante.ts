const TAMANHO_PADRAO = { largura: 460, altura: 560 };
const MARGEM = 24;

/**
 * Abre uma nota numa janela de verdade do navegador — fora da área da
 * aplicação, e não mais uma `div` flutuando por cima dela. `popup=yes` é o
 * que faz o navegador desenhar uma janela enxuta (sem abas, sem barra de
 * endereço) em vez de mais uma aba; sem ele, o `window.open` abriria a nota
 * dentro da própria janela do app.
 *
 * Nasce no canto superior direito da tela, com um tamanho que cabe
 * confortavelmente ao lado da janela principal — depois disso, arrastar e
 * redimensionar é o próprio sistema operacional quem cuida (é uma janela de
 * verdade, não algo que este app precise controlar).
 */
export function abrirJanelaFlutuante(url: string): void {
  const largura = Math.min(TAMANHO_PADRAO.largura, screen.availWidth - 2 * MARGEM);
  const altura = Math.min(TAMANHO_PADRAO.altura, screen.availHeight - 2 * MARGEM);
  const x = screen.availWidth - largura - MARGEM;
  const y = MARGEM;

  const recursos = `popup=yes,width=${Math.round(largura)},height=${Math.round(altura)},left=${Math.round(x)},top=${Math.round(y)}`;
  // Uma janela por nota: reabrir a mesma nota reaproveita a janela já
  // aberta em vez de empilhar outra — o nome do popup é o próprio endereço.
  const janela = window.open(url, url, recursos);
  janela?.focus();
}
