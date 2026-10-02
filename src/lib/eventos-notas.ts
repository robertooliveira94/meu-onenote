/** Eventos pequenos entre a janela principal e as janelas de captura rápida. */
export const CANAL_MUDANCAS_NOTAS = "meu-bloco:mudancas-notas";
export const CANAL_NOTA_RAPIDA = "meu-bloco:nota-rapida";
const CHAVE_MUDANCAS_NOTAS = "meu-bloco:mudancas-notas:evento";

export type MudancaNasNotas = { tipo: "mudanca"; caminho?: string; instante: number };

export function publicarMudancaNasNotas(caminho?: string): void {
  const evento: MudancaNasNotas = { tipo: "mudanca", caminho, instante: Date.now() };
  try {
    const canal = new BroadcastChannel(CANAL_MUDANCAS_NOTAS);
    canal.postMessage(evento);
    canal.close();
  } catch {
    // `storage` logo abaixo cobre navegadores sem BroadcastChannel.
  }
  try {
    localStorage.setItem(CHAVE_MUDANCAS_NOTAS, JSON.stringify(evento));
  } catch {
    // Sem armazenamento, a janela atual ainda se atualiza pela navegação.
  }
}

export function ouvirMudancasNasNotas(aoMudar: (evento: MudancaNasNotas) => void): () => void {
  let canal: BroadcastChannel | null = null;
  try {
    canal = new BroadcastChannel(CANAL_MUDANCAS_NOTAS);
    canal.onmessage = (evento: MessageEvent<MudancaNasNotas>) => aoMudar(evento.data);
  } catch {
    canal = null;
  }

  const aoArmazenar = (evento: StorageEvent) => {
    if (evento.key !== CHAVE_MUDANCAS_NOTAS || !evento.newValue) return;
    try {
      aoMudar(JSON.parse(evento.newValue) as MudancaNasNotas);
    } catch {
      // Evento incompleto de uma versão antiga: ignora.
    }
  };
  window.addEventListener("storage", aoArmazenar);
  return () => {
    canal?.close();
    window.removeEventListener("storage", aoArmazenar);
  };
}
