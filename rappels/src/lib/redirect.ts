// Redirection après connexion : quand on ouvre un lien (notification) sans être connecté, on passe par l'écran de
// connexion puis on revient exactement là où on voulait aller.
const PUBLIC = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser"];

/** Chemin interne sûr (jamais un autre site, jamais un écran de connexion), sinon null. */
export function safeNext(raw: string | null | undefined): string | null {
  if (!raw || raw.length > 300 || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return null;
  const path = raw.split(/[?#]/)[0]!;
  if (PUBLIC.some((p) => path === p || path.startsWith(`${p}/`))) return null;
  return raw;
}

/** Adresse de l'écran de connexion qui ramènera ensuite vers `target`. */
export function loginUrl(target: string): string {
  const next = target === "/" ? null : safeNext(target);
  return next ? `/connexion?suite=${encodeURIComponent(next)}` : "/connexion";
}

/** Lit `?suite=` dans une chaîne de requête (« ?suite=%2Ftaches%2Fabc »). */
export function nextFromSearch(search: string): string | null {
  return safeNext(new URLSearchParams(search).get("suite"));
}
