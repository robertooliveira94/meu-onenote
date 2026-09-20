import type { EventoSaude, StatusEventoSaude, TipoEventoSaude } from "./tipos";

/** Rótulos e ordenações de Saúde que a tela usa — sem disco, importável do cliente. */

export const TIPOS_EVENTO: TipoEventoSaude[] = ["consulta", "exame", "procedimento", "vacina"];

export const ROTULO_TIPO: Record<TipoEventoSaude, string> = {
  consulta: "Consulta",
  exame: "Exame",
  procedimento: "Procedimento",
  vacina: "Vacina",
};

export const STATUS_EVENTO: StatusEventoSaude[] = ["solicitado", "agendado", "aguardando-resultado", "realizado", "cancelado"];

export const ROTULO_STATUS: Record<StatusEventoSaude, string> = {
  solicitado: "Solicitado",
  agendado: "Agendado",
  "aguardando-resultado": "Aguardando resultado",
  realizado: "Realizado",
  cancelado: "Cancelado",
};

/** "Aguardando resultado" só faz sentido pra exame — os outros tipos não têm laudo pra esperar. */
export function statusDisponiveis(tipo: TipoEventoSaude): StatusEventoSaude[] {
  return tipo === "exame" ? STATUS_EVENTO : STATUS_EVENTO.filter((status) => status !== "aguardando-resultado");
}

/** Sem data no fim? Não — no começo: o que ainda está por marcar precisa aparecer, não sumir no rodapé. */
export function ordenarEventos(eventos: EventoSaude[]): EventoSaude[] {
  return [...eventos].sort((a, b) => {
    if (a.data === null && b.data === null) return b.criadoEm.localeCompare(a.criadoEm);
    if (a.data === null) return -1;
    if (b.data === null) return 1;
    const porData = b.data.localeCompare(a.data);
    if (porData !== 0) return porData;
    return (b.hora ?? "").localeCompare(a.hora ?? "");
  });
}

export function formatarDataSaude(iso: string | null): string {
  if (!iso) return "sem data";
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hojeIso(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
