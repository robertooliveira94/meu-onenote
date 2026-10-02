import fs from "node:fs/promises";
import path from "node:path";

import { PASTA_SISTEMA, RAIZ } from "./caminhos";
import { gravarJson } from "./gravacao";

/**
 * Preferências do app que não cabem no índice nem numa nota — hoje só o
 * destino do Web Clipper. Fica em `dados/_sistema/config.json`, à parte do
 * `indice.json` (que se reconstrói sozinho a partir do disco); isto aqui é
 * escolha da pessoa e não se recupera de lugar nenhum.
 */
const ARQUIVO = path.join(RAIZ, PASTA_SISTEMA, "config.json");

export type Config = {
  /** Seção (caminho de profundidade 2) onde o Web Clipper cria as notas recortadas. */
  destinoRecorte?: string;
  /** Última pasta de Links usada no atalho "salvar link" — só a pré-seleção, sempre trocável a cada clique. */
  destinoLink?: string;
  /** Última seção usada pela captura rápida — aparece pré-selecionada e pode ser trocada na própria janela. */
  destinoNotaRapida?: string;
};

export async function lerConfig(): Promise<Config> {
  try {
    return JSON.parse(await fs.readFile(ARQUIVO, "utf8")) as Config;
  } catch {
    return {};
  }
}

export async function gravarConfig(mudanca: Partial<Config>): Promise<void> {
  const atual = await lerConfig();
  await gravarJson(ARQUIVO, { ...atual, ...mudanca });
}
