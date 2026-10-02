import fs from "node:fs/promises";
import path from "node:path";

/**
 * Grava um arquivo sem nunca deixá-lo pela metade: escreve num arquivo
 * temporário ao lado e só então o renomeia por cima do destino. `rename`
 * no mesmo volume é atômico — ou o arquivo antigo continua inteiro, ou o
 * novo já está inteiro; nunca uma mistura dos dois.
 *
 * Isso importa porque vários arquivos aqui são a única cópia de algo que
 * não se reconstrói do disco (`indice.json` com prazos e subtarefas do
 * Kanban, `saude.json`, o próprio `cofre.kdbx`): um `fs.writeFile` direto,
 * interrompido por queda de energia ou por um lock do OneDrive, deixava um
 * arquivo truncado que a leitura seguinte tratava como "vazio".
 *
 * `manterCopia` guarda a versão anterior como `<nome>.bak` antes de
 * substituir — usado no cofre, onde perder o arquivo é perder todas as
 * senhas.
 */
export async function gravarAtomico(
  destino: string,
  dados: string | Uint8Array,
  opcoes: { manterCopia?: boolean } = {},
): Promise<void> {
  await fs.mkdir(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    await fs.writeFile(temporario, dados);
    if (opcoes.manterCopia) {
      try {
        await fs.copyFile(destino, `${destino}.bak`);
      } catch {
        // Primeira gravação: ainda não há o que copiar.
      }
    }
    await renomearComRepeticao(temporario, destino);
  } catch (erro) {
    await fs.rm(temporario, { force: true }).catch(() => undefined);
    throw erro;
  }
}

/**
 * No Windows, um arquivo aberto por outro processo (o OneDrive sincronizando,
 * um antivírus lendo) faz o `rename` falhar com EPERM/EBUSY por um instante.
 * Algumas tentativas com pequenas esperas resolvem quase sempre; se ainda
 * assim falhar, o erro sobe e o arquivo antigo continua intacto.
 */
async function renomearComRepeticao(de: string, para: string): Promise<void> {
  const esperas = [0, 50, 150, 400, 1000];
  let ultimoErro: unknown;
  for (const espera of esperas) {
    if (espera) await new Promise((resolve) => setTimeout(resolve, espera));
    try {
      await fs.rename(de, para);
      return;
    } catch (erro) {
      ultimoErro = erro;
      const codigo = (erro as NodeJS.ErrnoException).code;
      if (codigo !== "EPERM" && codigo !== "EBUSY" && codigo !== "EACCES") throw erro;
    }
  }
  throw ultimoErro;
}

/** Atalho para o caso mais comum: um objeto virando JSON legível. */
export async function gravarJson(destino: string, valor: unknown, compacto = false): Promise<void> {
  await gravarAtomico(destino, compacto ? JSON.stringify(valor) : JSON.stringify(valor, null, 2));
}
