"use client";

/**
 * Posição de cada nó do grafo — um layout de forças escrito à mão (nós se
 * repelem, arestas puxam), pra não trazer uma biblioteca de grafo só por
 * causa de uma tela. Funciona bem até algumas centenas de notas, que é a
 * escala de um vault pessoal; não tenta ser genérico além disso.
 */

export type Posicao = { x: number; y: number };

export function calcularLayout(
  caminhos: string[],
  arestas: { de: string; para: string }[],
  largura: number,
  altura: number,
  iteracoes = 260,
): Map<string, Posicao> {
  const posicoes = new Map<string, Posicao>();
  const cx = largura / 2;
  const cy = altura / 2;
  const raioInicial = Math.min(largura, altura) / 2.5;

  caminhos.forEach((caminho, indice) => {
    const angulo = (indice / Math.max(caminhos.length, 1)) * Math.PI * 2;
    posicoes.set(caminho, {
      x: cx + Math.cos(angulo) * raioInicial,
      y: cy + Math.sin(angulo) * raioInicial,
    });
  });

  if (caminhos.length <= 1) return posicoes;

  const areaPorNo = (largura * altura) / caminhos.length;
  const distanciaIdeal = Math.sqrt(areaPorNo) * 0.9;

  for (let iteracao = 0; iteracao < iteracoes; iteracao += 1) {
    const forcas = new Map<string, Posicao>(caminhos.map((c) => [c, { x: 0, y: 0 }]));

    // Repulsão: todo par de nós se afasta, pra não empilhar um em cima do outro.
    for (let i = 0; i < caminhos.length; i += 1) {
      for (let j = i + 1; j < caminhos.length; j += 1) {
        const a = caminhos[i];
        const b = caminhos[j];
        const pa = posicoes.get(a) as Posicao;
        const pb = posicoes.get(b) as Posicao;
        const dx = pa.x - pb.x;
        const dy = pa.y - pb.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        const forca = (distanciaIdeal * distanciaIdeal) / dist;
        const fx = (dx / dist) * forca;
        const fy = (dy / dist) * forca;
        (forcas.get(a) as Posicao).x += fx;
        (forcas.get(a) as Posicao).y += fy;
        (forcas.get(b) as Posicao).x -= fx;
        (forcas.get(b) as Posicao).y -= fy;
      }
    }

    // Atração: quem tem link entre si é puxado pra mais perto.
    for (const aresta of arestas) {
      const pa = posicoes.get(aresta.de);
      const pb = posicoes.get(aresta.para);
      if (!pa || !pb) continue;
      const dx = pa.x - pb.x;
      const dy = pa.y - pb.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const forca = (dist * dist) / distanciaIdeal;
      const fx = (dx / dist) * forca;
      const fy = (dy / dist) * forca;
      (forcas.get(aresta.de) as Posicao).x -= fx;
      (forcas.get(aresta.de) as Posicao).y -= fy;
      (forcas.get(aresta.para) as Posicao).x += fx;
      (forcas.get(aresta.para) as Posicao).y += fy;
    }

    // Puxão de leve pro centro (senão o conjunto deriva pra fora da tela) e
    // esfriamento (os passos ficam menores com o tempo, até assentar).
    const esfriamento = 1 - iteracao / iteracoes;
    for (const caminho of caminhos) {
      const p = posicoes.get(caminho) as Posicao;
      const f = forcas.get(caminho) as Posicao;
      f.x += (cx - p.x) * 0.01;
      f.y += (cy - p.y) * 0.01;
      p.x += f.x * 0.1 * esfriamento;
      p.y += f.y * 0.1 * esfriamento;
      p.x = Math.max(24, Math.min(largura - 24, p.x));
      p.y = Math.max(24, Math.min(altura - 24, p.y));
    }
  }

  return posicoes;
}
