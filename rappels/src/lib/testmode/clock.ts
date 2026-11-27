// Simulateur d'horloge : « faire comme s'il était [date/heure] ». Appliqué UNIQUEMENT aux tests : l'app, les rappels et
// le vrai planificateur gardent l'heure réelle.
const KEY = "hb-test-clock";

/** Instant simulé (ms) ou null (heure réelle). */
export function readSimulated(): number | null {
  try {
    const v = Number(localStorage.getItem(KEY));
    return Number.isFinite(v) && v > 0 ? v : null;
  } catch {
    return null;
  }
}

export function setSimulated(ms: number | null) {
  try {
    if (ms === null) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(ms));
  } catch {
    /* ignoré */
  }
}

/** L'heure « du test » : l'heure simulée si elle est réglée, sinon l'heure réelle. */
export const testNow = (): Date => new Date(readSimulated() ?? Date.now());

/** Une heure de Paris saisie dans un champ « datetime-local » ("2026-11-23T18:15") → instant (ms). */
export function parisLocalToMs(local: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  // même calcul que parisInstant (service.ts), sans l'importer ici
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  const off = (t: number) => {
    const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(t));
    const g: Record<string, number> = {};
    for (const x of p) if (x.type !== "literal") g[x.type] = Number(x.value);
    return Date.UTC(g.year!, g.month! - 1, g.day!, g.hour!, g.minute!) - Math.floor(t / 60_000) * 60_000;
  };
  return guess - off(guess - off(guess));
}

/** Instant → texte pour un champ « datetime-local », à l'heure de Paris. */
export function msToParisLocal(ms: number): string {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(ms));
  return p.replace(" ", "T");
}
