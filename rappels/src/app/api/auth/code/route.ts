import { allow, clientIp } from "@/server/limiter";
import { checkTeamCode } from "@/server/team-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, message: string) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

/** Étape 1 de l'inscription : vérifie le code d'équipe (sans rien créer). */
export async function POST(request: Request) {
  if (!allow(`code:${clientIp(request)}`, 10, 15 * 60_000)) return json(429, "Trop d'essais. Réessaie dans quelques minutes.");
  let body: { code?: unknown } = {};
  try {
    body = (await request.json()) as { code?: unknown };
  } catch {
    return json(400, "Requête invalide.");
  }
  const check = checkTeamCode(body.code);
  if (check === "unset") return json(503, "Les inscriptions sont fermées pour le moment.");
  if (check === "bad") return json(403, "Code d'équipe invalide.");
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
