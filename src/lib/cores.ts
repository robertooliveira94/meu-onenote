/**
 * Paletas do aplicativo. Módulo sem dependência de Node de propósito: a
 * interface no navegador também precisa dessas cores para os seletores.
 *
 * Cores cheias, de painel moderno: saturadas o suficiente para marcar presença
 * no branco e ainda legíveis no tema escuro.
 */

/** Cor de cada caderno, distribuída na ordem de criação. */
export const CORES_CADERNO = [
  "#0EA47C", // verde-água
  "#2D7FF9", // azul
  "#7C5CFC", // violeta
  "#E93D82", // rosa
  "#F5822C", // laranja
  "#E5484D", // vermelho
];

/** Cores oferecidas no cadastro de etiquetas. */
export const CORES_ETIQUETA = [...CORES_CADERNO, "#F5B921", "#46A758"];

/** Cor de cada nível de prioridade de tarefa do Kanban, do mais calmo ao mais aceso. */
export const CORES_PRIORIDADE: Record<"baixa" | "media" | "alta" | "urgente", string> = {
  baixa: "#7C93A8",
  media: "#F5B921",
  alta: "#F5822C",
  urgente: "#E5484D",
};

/** Ícone inicial de cada caderno, na ordem de criação. */
export const ICONES_CADERNO = ["📓", "📗", "📘", "📙", "📕", "📔"];

/** Opções do seletor de ícone — coisas que costumam virar caderno. */
export const ICONES_DISPONIVEIS = [
  "📓", "📗", "📘", "📙", "📕", "📔", "📚", "🗂️",
  "🏡", "💼", "💰", "🧾", "🎯", "🌱", "🍳", "🛒",
  "✈️", "🚗", "🏋️", "💊", "🎬", "🎸", "📸", "🐾",
  "💡", "🔧", "🧠", "❤️", "⭐", "🎓", "📅", "✏️",
];
