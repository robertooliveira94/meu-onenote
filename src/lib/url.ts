/**
 * "www.google.com" colado sem esquema virava um link relativo ("/links/www.google.com")
 * que dava erro ao abrir e nunca achava favicon. Sem `algo:` no começo,
 * ganha `https://`; o resto passa como veio.
 */
export function normalizarUrl(bruta: string): string {
  const url = bruta.trim();
  if (!url) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url.replace(/^\/+/, "")}`;
}
