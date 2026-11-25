import { cleanPrenom, isEmail, isPassword, isPrenom, normalizeEmail } from "@/lib/validate";
import { allow, clientIp } from "@/server/limiter";
import { getAdminClient } from "@/server/supabase-admin";
import { checkTeamCode } from "@/server/team-code";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (status: number, message: string) => Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Création de compte : seule porte d'entrée possible. Le code d'équipe est revérifié ici,
 * puis le compte est créé avec la clé service_role (jamais exposée au navigateur).
 * (Dans Supabase, « Allow new users to sign up » doit être désactivé : voir docs/COMPTES.md.)
 */
export async function POST(request: Request) {
  if (!allow(`signup:${clientIp(request)}`, 10, 15 * 60_000)) return json(429, "Trop d'essais. Réessaie dans quelques minutes.");

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json(400, "Requête invalide.");
  }

  const check = checkTeamCode(body.code);
  if (check === "unset") return json(503, "Les inscriptions sont fermées pour le moment.");
  if (check === "bad") return json(403, "Code d'équipe invalide.");

  const prenom = typeof body.prenom === "string" ? cleanPrenom(body.prenom) : "";
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!isPrenom(prenom)) return json(400, "Ton prénom doit faire entre 1 et 30 caractères.");
  if (!isEmail(email)) return json(400, "Cet email n'a pas l'air valide.");
  if (!isPassword(password)) return json(400, "Mot de passe trop court : 8 caractères minimum.");

  const admin = getAdminClient();
  if (!admin) return json(503, "Les inscriptions ne sont pas encore configurées.");

  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true, // pas de mail de confirmation : le code d'équipe fait office de filtre
    user_metadata: { prenom }, // le rôle n'est JAMAIS lu ici : tout le monde démarre « caissier »
  });
  if (error) {
    const msg = error.message.toLowerCase();
    if (error.code === "email_exists" || msg.includes("already") || msg.includes("registered")) return json(409, "Cet email a déjà un compte. Connecte-toi.");
    if (error.code === "weak_password") return json(400, "Mot de passe trop faible : choisis-en un plus long.");
    console.error("[inscription]", error.code ?? error.status ?? "erreur"); // jamais l'email ni le mot de passe
    return json(500, "Impossible de créer le compte. Réessaie dans un instant.");
  }
  return Response.json({ ok: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
