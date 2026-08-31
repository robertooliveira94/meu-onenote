/**
 * Montagem de endereços. Fica separado do resto porque roda nos dois lados:
 * no servidor, para redirecionar depois de uma ação; no navegador, para os
 * links da árvore e da lista de páginas.
 */

function codificar(caminho: string): string {
  return caminho.split("/").filter(Boolean).map(encodeURIComponent).join("/");
}

export function urlDaNota(caminho: string): string {
  return `/nota/${codificar(caminho)}`;
}

export function urlDaSecao(caminho: string): string {
  return `/secao/${codificar(caminho)}`;
}

export function urlDaEtiqueta(id: string): string {
  return `/etiquetas/${encodeURIComponent(id)}`;
}

/** Onde uma imagem colada numa nota fica servível — ver src/app/midia. */
export function urlDaMidia(caminho: string): string {
  return `/midia/${codificar(caminho)}`;
}

/**
 * Remonta o caminho a partir dos segmentos da URL.
 *
 * O Next entrega os segmentos como estão no endereço, ainda codificados — sem
 * este decode, uma seção chamada "Metas 2026" chegaria como "Metas%202026" e
 * não seria encontrada no disco.
 */
export function caminhoDaUrl(segmentos: string[] | undefined): string {
  return (segmentos ?? [])
    .map((segmento) => {
      try {
        return decodeURIComponent(segmento);
      } catch {
        // Endereço malformado: usa o texto cru e deixa a validação recusar.
        return segmento;
      }
    })
    .join("/");
}

/** "12/08/2026, 21:14" — data curta e legível, no fuso da máquina. */
export function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "hoje", "ontem", "12 de ago" — usado nas listas. */
export function formatarDataCurta(iso: string): string {
  const data = new Date(iso);
  const hoje = new Date();
  const mesmoDia = (a: Date, b: Date) => a.toDateString() === b.toDateString();

  if (mesmoDia(data, hoje)) {
    return data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  }
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);
  if (mesmoDia(data, ontem)) return "ontem";

  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: data.getFullYear() === hoje.getFullYear() ? undefined : "numeric",
  });
}
