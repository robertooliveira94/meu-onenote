/**
 * Arrastar para reordenar e mover — seções entre si (e para outro caderno) e
 * páginas entre si (e para outra seção). Drag and drop nativo do navegador,
 * sem biblioteca nenhuma: o "tipo" do item carregado (`FORMATO_*`) viaja no
 * próprio `dataTransfer`, então cada alvo de soltura (uma linha de seção, um
 * chip de caderno, uma linha de página) decide sozinho se aceita aquilo,
 * sem precisar de nenhum estado React compartilhado entre as colunas.
 *
 * `types` (usado em `traz*`) é legível durante o arraste inteiro — é o que
 * deixa destacar um alvo válido enquanto passa por cima. `getData` (usado em
 * `ler*`) só é legível no momento da soltura; é assim que o navegador
 * protege o conteúdo sendo arrastado de outras páginas espiando no meio do
 * gesto.
 */

export const FORMATO_SECAO = "application/x-meu-onenote-secao";
export const FORMATO_PAGINA = "application/x-meu-onenote-pagina";

export function iniciarArrastoDeSecao(evento: React.DragEvent, caminho: string): void {
  evento.dataTransfer.setData(FORMATO_SECAO, caminho);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDePagina(evento: React.DragEvent, caminho: string): void {
  evento.dataTransfer.setData(FORMATO_PAGINA, caminho);
  evento.dataTransfer.effectAllowed = "move";
}

export function trazSecao(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_SECAO);
}

export function trazPagina(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_PAGINA);
}

export function lerCaminhoDeSecao(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_SECAO);
}

export function lerCaminhoDePagina(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_PAGINA);
}

/** Tira um item de uma posição e insere em outra, sem mexer no resto da ordem. */
export function moverNaLista<T>(lista: T[], deIndice: number, paraIndice: number): T[] {
  const copia = [...lista];
  const [item] = copia.splice(deIndice, 1);
  copia.splice(paraIndice, 0, item);
  return copia;
}

/**
 * Calcula a nova ordem de caminhos depois de soltar `origem` perto de
 * `alvo` (antes ou depois dele, conforme onde o cursor estava na linha).
 * Devolve `null` quando não há mudança de verdade a fazer (soltou em cima
 * de si mesmo, ou o item arrastado não é desta lista).
 */
export function calcularNovaOrdem(
  ordemAtual: string[],
  origem: string,
  alvo: string,
  antes: boolean,
): string[] | null {
  const indiceOrigem = ordemAtual.indexOf(origem);
  if (indiceOrigem === -1 || origem === alvo) return null;

  const semOrigem = [...ordemAtual];
  semOrigem.splice(indiceOrigem, 1);
  let indiceDestino = semOrigem.indexOf(alvo);
  if (indiceDestino === -1) return null;
  if (!antes) indiceDestino += 1;
  semOrigem.splice(indiceDestino, 0, origem);
  return semOrigem;
}
