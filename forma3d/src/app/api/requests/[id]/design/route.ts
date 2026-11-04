import { NextResponse } from "next/server";
import { z } from "zod";
import { validateDesign } from "@/lib/design/schema";
import { isSameOrigin, jsonError } from "@/lib/http";
import { getSession } from "@/lib/supabase/server";

export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BodySchema = z.object({ design: z.unknown() });

/**
 * Sauvegarde automatique de l'éditeur : la conception modifiée est entièrement revalidée ici
 * (formes, bornes en millimètres, nombre de pièces) avant d'être enregistrée par la fonction SQL
 * save_design_edit (propriétaire uniquement, quotas par heure).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.");
  const { id } = await params;
  if (!UUID.test(id)) return jsonError(400, "Identifiant invalide.");
  const session = await getSession();
  if (!session) return jsonError(401, "Connectez-vous.");
  const raw = await request.text();
  if (raw.length > 700_000) return jsonError(413, "Conception trop volumineuse.");
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    return jsonError(400, "Requête invalide.");
  }
  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) return jsonError(400, "Requête invalide.");
  const validated = validateDesign(parsed.data.design);
  if (!validated.ok) return jsonError(400, "Conception invalide.", "invalid_design");

  const { data, error } = await session.supabase.rpc("save_design_edit", { p_id: id, p_design: validated.design });
  if (error) {
    const message = error.message ?? "";
    // Script SQL de la phase 2 pas encore exécuté : l'éditeur garde les modifications sur l'appareil, sans erreur.
    if (error.code === "PGRST202" || message.includes("save_design_edit")) return jsonError(503, "Sauvegarde en ligne indisponible.", "edit_unavailable");
    if (message.includes("EDIT_QUOTA")) return jsonError(429, "Trop de sauvegardes en une heure.", "edit_quota");
    if (message.includes("NOT_FOUND")) return jsonError(404, "Projet introuvable.");
    return jsonError(500, "Sauvegarde impossible.");
  }
  return NextResponse.json({ savedAt: data, design: validated.design });
}
