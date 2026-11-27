import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import { runTick, type Sender } from "@/server/push-tick";
import { createTickDb, purgeOldClaims, recordHeartbeat } from "@/server/tick-db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const digest = (v: string) => createHash("sha256").update(v).digest();
const json = (status: number, body: unknown) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/**
 * Appelée CHAQUE MINUTE par le planificateur (pg_cron de Supabase ou cron-job.org), avec l'en-tête
 * `Authorization: Bearer <CRON_SECRET>`. Envoie les rappels dus par Web Push. Voir docs/NOTIFICATIONS.md.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return json(503, { error: "CRON_SECRET manquant" });
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!given || !timingSafeEqual(digest(given), digest(secret))) return json(401, { error: "non autorisé" });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!publicKey || !privateKey) return json(503, { error: "clés VAPID manquantes" });
  if (!url || !anon) return json(503, { error: "Supabase non configuré" });
  // Clé publique « anon » : les fonctions SQL push_* exigent en plus le secret partagé.
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://hb-rappels.vercel.app", publicKey, privateKey);

  const send: Sender = async (sub, payload) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 300, urgency: "high" });
      return "ok";
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone";
      console.error("[push] envoi échoué", status ?? "erreur"); // jamais le contenu ni l'adresse de l'appareil
      return "error";
    }
  };

  try {
    const result = await runTick(new Date(), createTickDb(sb, secret), send);
    if (new Date().getUTCMinutes() === 0) await purgeOldClaims(sb, secret); // une fois par heure
    await recordHeartbeat(sb, secret, result, null, result.delivered, result.failed);
    return json(200, result);
  } catch (err) {
    console.error("[push] tick échoué", err instanceof Error ? err.message.slice(0, 200) : "");
    await recordHeartbeat(sb, secret, null, err instanceof Error ? err.message.slice(0, 200) : "erreur", 0, 0);
    await sb.rpc("push_log_anomaly", { p_secret: secret, p_kind: "echec_planificateur", p_user: null, p_detail: err instanceof Error ? err.message.slice(0, 200) : "erreur" });
    return json(500, { error: "échec du planificateur" });
  }
}

export const POST = handle;
export const GET = handle; // cron-job.org et pg_net peuvent appeler en GET ou en POST
