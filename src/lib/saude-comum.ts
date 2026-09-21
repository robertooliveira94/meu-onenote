import type { DadosSaude, EspecialidadeSaude, EventoSaude, PessoaSaude, StatusEventoSaude, TipoEventoSaude } from "./tipos";

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

/** Diferença em meses inteiros entre duas datas ISO (`ate` − `de`). */
export function mesesEntre(de: string, ate: string): number {
  const [anoDe, mesDe, diaDe] = de.split("-").map(Number);
  const [anoAte, mesAte, diaAte] = ate.split("-").map(Number);
  let meses = (anoAte - anoDe) * 12 + (mesAte - mesDe);
  if (diaAte < diaDe) meses -= 1;
  return meses;
}

export type AlertaSaude = {
  especialidade: EspecialidadeSaude;
  pessoa: PessoaSaude;
  /** Data da última consulta realizada, ou `null` se nunca houve. */
  ultimaConsulta: string | null;
  mesesDesde: number | null;
};

/**
 * "Está na hora", por pessoa: cada pessoa × especialidade com alerta em
 * que a pessoa tem algum registro, cuja última consulta realizada passou
 * do prazo (ou nunca aconteceu), e sem consulta agendada pra frente —
 * agendou, o alerta se cala. Um alerta que se calasse porque *outra*
 * pessoa foi ao dentista não serviria pra nada.
 */
export function alertasDeSaude(dados: DadosSaude, pessoaId: string | null = null, hoje = hojeIso()): AlertaSaude[] {
  const alertas: AlertaSaude[] = [];
  const pessoas = pessoaId ? dados.pessoas.filter((pessoa) => pessoa.id === pessoaId) : dados.pessoas;
  for (const pessoa of pessoas) {
    for (const especialidade of dados.especialidades) {
      if (especialidade.mesesAlerta === null) continue;
      const registros = dados.eventos.filter((evento) => evento.especialidadeId === especialidade.id && evento.pessoaId === pessoa.id);
      // Especialidade em que a pessoa nunca teve nada não é "dela" — o filho não está atrasado no cardiologista.
      if (registros.length === 0) continue;
      const consultas = registros.filter((evento) => evento.tipo === "consulta");
      const agendadaAdiante = consultas.some((evento) => evento.status === "agendado" && evento.data !== null && evento.data >= hoje);
      if (agendadaAdiante) continue;
      const realizadas = consultas.filter((evento) => evento.status === "realizado" && evento.data !== null).map((evento) => evento.data!);
      const ultima = realizadas.length ? realizadas.sort().at(-1)! : null;
      const mesesDesde = ultima ? mesesEntre(ultima, hoje) : null;
      if (ultima && mesesDesde !== null && mesesDesde < especialidade.mesesAlerta) continue;
      alertas.push({ especialidade, pessoa, ultimaConsulta: ultima, mesesDesde });
    }
  }
  return alertas;
}

/** Idade em anos a partir do nascimento ISO, ou `null`. */
export function idadeEmAnos(nascimento: string | null, hoje = hojeIso()): number | null {
  if (!nascimento) return null;
  return Math.max(0, Math.floor(mesesEntre(nascimento, hoje) / 12));
}

/** Cabeçalho de mês da linha do tempo: "setembro de 2026". */
export function rotuloDoMes(iso: string): string {
  const [ano, mes] = iso.split("-").map(Number);
  return new Date(ano, mes - 1, 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
