"use server";

import { revalidatePath } from "next/cache";

import * as saudeApp from "@/lib/saude-app";
import type { CamposEvento, CamposLocal, CamposPessoa, CamposProfissional, EventoAchado, ExtrasEvento, ItemLixeiraSaude } from "@/lib/saude-app";
import type { DadosSaude, EspecialidadeSaude, StatusEventoSaude } from "@/lib/tipos";

/** Ações da app de Saúde — tudo devolve os dados inteiros, como Links e Compras. Os dados só aparecem em `/saude`. */

export type RespostaSaude = { ok: true; dados: DadosSaude } | { ok: false; erro: string };

function comTratamento(func: () => Promise<DadosSaude>): Promise<RespostaSaude> {
  return func()
    .then((dados) => {
      revalidatePath("/saude", "layout");
      return { ok: true as const, dados };
    })
    .catch((erro: unknown) => ({ ok: false as const, erro: erro instanceof Error ? erro.message : "Não deu certo." }));
}

export async function acaoObterSaude(): Promise<DadosSaude> {
  return saudeApp.obterDados();
}

// especialidades
export async function acaoCriarEspecialidade(nome: string, icone?: string, cor?: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.criarEspecialidade(nome, icone, cor));
}

export async function acaoAtualizarEspecialidade(
  id: string,
  campos: Partial<Pick<EspecialidadeSaude, "nome" | "icone" | "cor" | "mesesAlerta">>,
): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.atualizarEspecialidade(id, campos));
}

export async function acaoExcluirEspecialidade(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirEspecialidade(id));
}

export async function acaoReordenarEspecialidades(ordemIds: string[]): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.reordenarEspecialidades(ordemIds));
}

// locais
export async function acaoCriarLocal(campos: CamposLocal): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.criarLocal(campos));
}

export async function acaoAtualizarLocal(id: string, campos: CamposLocal): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.atualizarLocal(id, campos));
}

export async function acaoExcluirLocal(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirLocal(id));
}

// profissionais
export async function acaoCriarProfissional(campos: CamposProfissional): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.criarProfissional(campos));
}

export async function acaoAtualizarProfissional(id: string, campos: CamposProfissional): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.atualizarProfissional(id, campos));
}

export async function acaoExcluirProfissional(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirProfissional(id));
}

// eventos
export async function acaoCriarEvento(
  campos: CamposEvento,
  extras?: ExtrasEvento,
): Promise<{ ok: true; dados: DadosSaude; id: string } | { ok: false; erro: string }> {
  try {
    const { dados, id } = await saudeApp.criarEvento(campos, extras);
    revalidatePath("/saude", "layout");
    return { ok: true, dados, id };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." };
  }
}

export async function acaoAtualizarEvento(id: string, campos: CamposEvento, extras?: ExtrasEvento): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.atualizarEvento(id, campos, extras));
}

export async function acaoMudarStatusEvento(id: string, status: StatusEventoSaude): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.mudarStatusEvento(id, status));
}

export async function acaoMoverEvento(id: string, especialidadeId: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.moverEvento(id, especialidadeId));
}

export async function acaoExcluirEvento(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirEvento(id));
}

/** Subir anexo é rota própria (`/saude/anexo`, multipart) — Server Action tem limite de 1 MB no corpo, e laudo em PDF passa disso fácil. */
export async function acaoRemoverAnexo(idEvento: string, idAnexo: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.removerAnexo(idEvento, idAnexo));
}

export async function acaoBuscarEventosSaude(termo: string): Promise<EventoAchado[]> {
  return saudeApp.buscarEventos(termo);
}

// lixeira
export async function acaoListarLixeiraSaude(): Promise<ItemLixeiraSaude[]> {
  return saudeApp.listarLixeira();
}

export async function acaoRestaurarDaLixeiraSaude(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.restaurarDaLixeira(id));
}

export async function acaoApagarDeVezDaLixeiraSaude(id: string): Promise<{ ok: true }> {
  await saudeApp.apagarDeVezDaLixeira(id);
  return { ok: true };
}

export async function acaoEsvaziarLixeiraSaude(): Promise<{ ok: true }> {
  await saudeApp.esvaziarLixeira();
  return { ok: true };
}

// pessoas
export async function acaoCriarPessoa(campos: CamposPessoa): Promise<{ ok: true; dados: DadosSaude; id: string } | { ok: false; erro: string }> {
  try {
    const { dados, id } = await saudeApp.criarPessoa(campos);
    revalidatePath("/saude", "layout");
    return { ok: true, dados, id };
  } catch (erro) {
    return { ok: false, erro: erro instanceof Error ? erro.message : "Não deu certo." };
  }
}

export async function acaoAtualizarPessoa(id: string, campos: CamposPessoa): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.atualizarPessoa(id, campos));
}

export async function acaoExcluirPessoa(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirPessoa(id));
}

// planos
export async function acaoCriarPlano(nome: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.criarPlano(nome));
}

export async function acaoRenomearPlano(id: string, nome: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.renomearPlano(id, nome));
}

export async function acaoExcluirPlano(id: string): Promise<RespostaSaude> {
  return comTratamento(() => saudeApp.excluirPlano(id));
}
