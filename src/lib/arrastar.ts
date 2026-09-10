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
/** Uma tarefa do Kanban, arrastada entre colunas (Backlog, Fazendo...). */
export const FORMATO_TAREFA = "application/x-meu-onenote-tarefa";
/** Um caderno, arrastado na lista da aplicação Anotações para reordenar. */
export const FORMATO_CADERNO = "application/x-meu-onenote-caderno";
/** Um quadro, arrastado na lista da aplicação Kanban para reordenar. */
export const FORMATO_QUADRO = "application/x-meu-onenote-quadro";
/** Uma subtarefa, arrastada dentro da checklist de uma tarefa para reordenar. */
export const FORMATO_SUBTAREFA = "application/x-meu-onenote-subtarefa";
/** Um grupo do cofre de senhas, arrastado para dentro de outro grupo. */
export const FORMATO_GRUPO_SENHA = "application/x-meu-onenote-grupo-senha";
/** Uma senha, arrastada para dentro de outro grupo do cofre. */
export const FORMATO_ENTRADA_SENHA = "application/x-meu-onenote-entrada-senha";

export function iniciarArrastoDeSecao(evento: React.DragEvent, caminho: string): void {
  evento.dataTransfer.setData(FORMATO_SECAO, caminho);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDePagina(evento: React.DragEvent, caminho: string): void {
  evento.dataTransfer.setData(FORMATO_PAGINA, caminho);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeTarefa(evento: React.DragEvent, caminho: string): void {
  evento.dataTransfer.setData(FORMATO_TAREFA, caminho);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeCaderno(evento: React.DragEvent, nome: string): void {
  evento.dataTransfer.setData(FORMATO_CADERNO, nome);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeQuadro(evento: React.DragEvent, nome: string): void {
  evento.dataTransfer.setData(FORMATO_QUADRO, nome);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeSubtarefa(evento: React.DragEvent, id: string): void {
  evento.dataTransfer.setData(FORMATO_SUBTAREFA, id);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeGrupoSenha(evento: React.DragEvent, id: string): void {
  evento.dataTransfer.setData(FORMATO_GRUPO_SENHA, id);
  evento.dataTransfer.effectAllowed = "move";
}

export function iniciarArrastoDeEntradaSenha(evento: React.DragEvent, id: string): void {
  evento.dataTransfer.setData(FORMATO_ENTRADA_SENHA, id);
  evento.dataTransfer.effectAllowed = "move";
}

export function trazSecao(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_SECAO);
}

export function trazPagina(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_PAGINA);
}

export function trazTarefa(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_TAREFA);
}

export function trazCaderno(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_CADERNO);
}

export function trazQuadro(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_QUADRO);
}

export function trazSubtarefa(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_SUBTAREFA);
}

export function trazGrupoSenha(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_GRUPO_SENHA);
}

export function trazEntradaSenha(evento: React.DragEvent): boolean {
  return evento.dataTransfer.types.includes(FORMATO_ENTRADA_SENHA);
}

export function lerCaminhoDeSecao(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_SECAO);
}

export function lerCaminhoDePagina(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_PAGINA);
}

export function lerCaminhoDeTarefa(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_TAREFA);
}

export function lerNomeDeCaderno(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_CADERNO);
}

export function lerNomeDeQuadro(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_QUADRO);
}

export function lerIdDeSubtarefa(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_SUBTAREFA);
}

export function lerIdDeGrupoSenha(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_GRUPO_SENHA);
}

export function lerIdDeEntradaSenha(evento: React.DragEvent): string {
  return evento.dataTransfer.getData(FORMATO_ENTRADA_SENHA);
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
