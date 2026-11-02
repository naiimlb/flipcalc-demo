import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/http";
import { ipHash } from "@/lib/request-ip";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1).max(300),
});

/** Signalement d'une publication de la galerie (visiteur ou connecté), limité par adresse. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.", "forbidden");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Requête invalide.", "invalid");
  const supabase = await getServerSupabase();
  if (!supabase) return jsonError(503, "Galerie indisponible.", "unavailable");
  const { data, error } = await supabase.rpc("report_gallery_item", {
    p_id: parsed.data.id,
    p_reason: parsed.data.reason,
    p_ip_hash: ipHash(request),
  });
  if (error) return jsonError(503, "Signalement impossible.", "unavailable");
  if (data !== true) return jsonError(429, "Signalement refusé (limite atteinte ou publication introuvable).", "refused");
  return NextResponse.json({ ok: true });
}
