import { NextResponse } from "next/server";
import { z } from "zod";
import { isSameOrigin, jsonError } from "@/lib/http";
import { ipHash } from "@/lib/request-ip";
import { getServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";

const BodySchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/),
  pseudo: z
    .string()
    .transform((s) => s.replace(/\s+/g, " ").trim())
    .pipe(z.string().min(1).max(40)),
  body: z.string().trim().min(1).max(1000),
});

/** Commentaire avec pseudo sur un projet partagé (lien actif et commentaires autorisés), limité par adresse. */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return jsonError(403, "Origine refusée.", "forbidden");
  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "Commentaire invalide (pseudo 1 à 40 caractères, texte 1 à 1 000).", "invalid");
  const supabase = await getServerSupabase();
  if (!supabase) return jsonError(503, "Partage indisponible.", "unavailable");
  const { data, error } = await supabase.rpc("add_share_comment", {
    p_token: parsed.data.token,
    p_pseudo: parsed.data.pseudo,
    p_body: parsed.data.body,
    p_ip_hash: ipHash(request),
  });
  if (error) return jsonError(503, "Commentaire impossible.", "unavailable");
  if (data !== true) return jsonError(429, "Commentaire refusé.", "refused");
  return NextResponse.json({ ok: true });
}
