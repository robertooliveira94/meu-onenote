import { linksFavoritos, linksRecentes } from "@/lib/links-app";

import { PopupLinks } from "@/components/popup-links";

export const dynamic = "force-dynamic";

/**
 * Janelinha compacta pra abrir um favorito sem entrar no app inteiro —
 * destino do bookmarklet "Abrir meus links" (ver `atalho-links.tsx`) e do
 * atalho da extensão de navegador. Fora do grupo `(app)` de propósito, sem
 * a moldura do hub, igual a `/salvar-link` e `/nota-flutuante`: nasceu pra
 * abrir numa janela pequena por cima do que a pessoa estava vendo, não pra
 * navegar o hub. Não reaproveita a rota `/links` (dentro do grupo) porque
 * ali a mesma pasta física já define outra árvore de páginas — precisa de
 * um nome de segmento diferente, como `nota-flutuante` fez com `nota`.
 */
export default async function PaginaLinksPopup() {
  const [favoritos, recentes] = await Promise.all([linksFavoritos(), linksRecentes(12)]);
  return <PopupLinks favoritos={favoritos} recentes={recentes} />;
}
