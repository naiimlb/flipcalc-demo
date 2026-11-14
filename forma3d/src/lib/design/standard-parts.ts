/**
 * Bibliothèque de pièces normalisées (refonte, phase 3) : cotes usuelles pour l'impression 3D (buse 0,4 mm, PLA/PETG).
 * Valeurs de conception courantes (jeux inclus) : à confirmer par une impression d'essai, chaque imprimante diffère.
 */

/** Vis métriques : diamètre nominal, trou de passage, tête cylindrique (ISO 4762) et trou pour insert à chaud. */
export const SCREWS = {
  M2: { nominal: 2, passage: 2.4, head: 3.8, insert: 3.2, nutFlats: 4 },
  M2_5: { nominal: 2.5, passage: 2.9, head: 4.5, insert: 3.6, nutFlats: 5 },
  M3: { nominal: 3, passage: 3.4, head: 5.5, insert: 4.0, nutFlats: 5.5 },
  M4: { nominal: 4, passage: 4.5, head: 7, insert: 5.6, nutFlats: 7 },
  M5: { nominal: 5, passage: 5.5, head: 8.5, insert: 6.4, nutFlats: 8 },
  M6: { nominal: 6, passage: 6.6, head: 10, insert: 8.0, nutFlats: 10 },
  M8: { nominal: 8, passage: 9, head: 13, insert: 10, nutFlats: 13 },
} as const;

/** Roulements à billes courants : alésage × diamètre extérieur × largeur (mm). */
export const BEARINGS = {
  "623": [3, 10, 4],
  "625": [5, 16, 5],
  "608": [8, 22, 7],
  "6001": [12, 28, 8],
  "6200": [10, 30, 9],
} as const;

/** Jeux conseillés pour les logements imprimés. */
export const CLEARANCE = { magnet: 0.2, bearing: 0.1, nut: 0.3, sliding: 0.3, press: 0.1 } as const;

export interface StandardRequirement {
  label: string;
  /** Cotes acceptables dans la pièce (au moins une doit s'y retrouver, à 0,3 mm près). */
  acceptable: number[];
}

const num = (s: string) => Number(s.replace(",", "."));

/** Pièces normalisées citées dans la demande, avec les cotes de logement attendues. */
export function standardRequirements(text: string): StandardRequirement[] {
  const out: StandardRequirement[] = [];
  for (const m of text.matchAll(/\b(?:vis|écrous?|ecrous?|boulons?|inserts?|filetage)?\s*M(2|2[.,]5|3|4|5|6|8)\b/gi)) {
    const key = `M${m[1].replace(/[.,]/, "_")}` as keyof typeof SCREWS;
    const s = SCREWS[key];
    if (!s || out.some((r) => r.label.includes(`${key.replace("_", ",")} `))) continue;
    const isNut = /écrou|ecrou/i.test(m[0]);
    const isInsert = /insert/i.test(m[0]);
    out.push({
      label: `${isNut ? "écrou" : isInsert ? "insert" : "vis"} ${key.replace("_", ",")} `.trim(),
      acceptable: isNut ? [s.nutFlats + CLEARANCE.nut, s.nutFlats] : isInsert ? [s.insert] : [s.passage, s.nominal, s.insert, s.head],
    });
  }
  for (const m of text.matchAll(/\baimants?\b[^0-9]{0,20}(\d+(?:[.,]\d+)?)\s?[x×]\s?(\d+(?:[.,]\d+)?)/gi)) {
    const d = num(m[1]);
    out.push({ label: `aimant ${m[1]} × ${m[2]} mm`, acceptable: [d + CLEARANCE.magnet, d] });
  }
  for (const m of text.matchAll(/\broulements?\b[^0-9]{0,15}(623|625|608|6001|6200)\b/gi)) {
    const [, outer] = BEARINGS[m[1] as keyof typeof BEARINGS];
    out.push({ label: `roulement ${m[1]}`, acceptable: [outer + CLEARANCE.bearing, outer] });
  }
  return out;
}

/** Consigne ajoutée à la demande quand elle cite des pièces normalisées (rien sinon : le prompt reste court). */
export function standardPartsHint(text: string): string {
  const req = standardRequirements(text);
  if (!req.length) return "";
  const lines = [
    "Cotes de référence pour les pièces normalisées citées (impression 3D, jeux inclus) :",
    ...Object.entries(SCREWS)
      .filter(([k]) => req.some((r) => r.label.toUpperCase().includes(k.replace("_", ","))))
      .map(([k, s]) => `- ${k.replace("_", ",")} : trou de passage Ø ${s.passage} mm, tête Ø ${s.head} mm, insert à chaud Ø ${s.insert} mm, écrou ${s.nutFlats} mm sur plats (logement +${CLEARANCE.nut} mm).`),
    ...(req.some((r) => r.label.startsWith("aimant")) ? [`- Aimant : logement = diamètre de l'aimant + ${CLEARANCE.magnet} mm, profondeur = épaisseur + 0,2 mm.`] : []),
    ...Object.entries(BEARINGS)
      .filter(([k]) => req.some((r) => r.label === `roulement ${k}`))
      .map(([k, [bore, outer, width]]) => `- Roulement ${k} : ${bore} × ${outer} × ${width} mm, logement Ø ${outer + CLEARANCE.bearing} mm.`),
    "Modélise ces logements (trous d'extrusion ou tubes) avec ces cotes exactes.",
  ];
  return `\n\n${lines.join("\n")}`;
}
