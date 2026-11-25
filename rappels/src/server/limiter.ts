// Limiteur simple en mémoire (par adresse IP) pour freiner les essais de code d'équipe.
// ⚠️ Compteur propre à chaque instance serverless : limite « approximative », suffisante pour une v1.
const hits = new Map<string, number[]>();

/** Renvoie true si l'essai est autorisé (et l'enregistre), false si la limite est atteinte. */
export function allow(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  return true;
}

export const clientIp = (request: Request) => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
