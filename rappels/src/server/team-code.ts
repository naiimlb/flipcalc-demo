import { createHash, timingSafeEqual } from "node:crypto";

// Le code d'équipe vit UNIQUEMENT dans la variable d'environnement TEAM_CODE (serveur).
// Pour le changer : modifier la variable sur Vercel puis redéployer.
export type CodeCheck = "ok" | "bad" | "unset";

const digest = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest();

export function checkTeamCode(input: unknown): CodeCheck {
  const expected = process.env.TEAM_CODE?.trim();
  if (!expected) return "unset";
  if (typeof input !== "string" || input.length === 0 || input.length > 100) return "bad";
  return timingSafeEqual(digest(input), digest(expected)) ? "ok" : "bad"; // comparaison à temps constant
}
