import webpush from "web-push";
import { authorizeManager, noStore } from "@/server/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Item = { title: string; body: string; url: string; tag?: string };
const MAX_ITEMS = 20;

/**
 * Envoie des notifications de TEST. Réservé au responsable (vérifié ici ET dans la base).
 * Destinataires possibles : mes propres appareils (« self ») ou ceux du compte de test désigné (« test ») — la liste des
 * abonnements vient de la fonction SQL test_target_subs, qui ne renvoie jamais les appareils d'un autre collègue.
 */
export async function POST(request: Request) {
  const auth = await authorizeManager(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status, headers: noStore });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return Response.json({ error: "clés VAPID manquantes" }, { status: 503, headers: noStore });

  let body: { target?: string; items?: Item[] };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "requête illisible" }, { status: 400, headers: noStore });
  }
  const target = body.target === "test" ? "test" : "self";
  const items = (body.items ?? []).slice(0, MAX_ITEMS).filter((i) => typeof i?.title === "string" && typeof i?.url === "string" && i.url.startsWith("/") && !i.url.startsWith("//"));
  if (items.length === 0) return Response.json({ error: "rien à envoyer" }, { status: 400, headers: noStore });

  const { data, error } = await auth.sb.rpc("test_target_subs", { p_target: target });
  if (error) return Response.json({ error: error.message }, { status: error.code === "42501" ? 403 : 400, headers: noStore });
  const subs = (data as { endpoint: string; p256dh: string; auth_key: string }[]) ?? [];
  if (subs.length === 0) {
    return Response.json({ ok: false, error: target === "self" ? "Aucun appareil abonné : active les notifications dans Réglages." : "Le compte de test n'a aucun appareil abonné.", results: [] }, { headers: noStore });
  }

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "https://hb-rappels.vercel.app", publicKey, privateKey);
  const results: { device: number; item: number; result: "ok" | "gone" | "error"; status?: number }[] = [];
  for (const [i, it] of items.entries()) {
    const payload = JSON.stringify({ title: it.title.startsWith("🧪") ? it.title : `🧪 ${it.title}`, body: it.body, url: it.url, tag: it.tag ?? `test:${i}` });
    for (const [d, sub] of subs.entries()) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } }, payload, { TTL: 120, urgency: "high" });
        results.push({ device: d, item: i, result: "ok" });
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        results.push({ device: d, item: i, result: status === 404 || status === 410 ? "gone" : "error", status });
        // jamais de suppression d'abonnement ici : le responsable relance un test pour voir si ça revient
        await auth.sb.rpc("test_log", { p_kind: status === 404 || status === 410 ? "abonnement_expire" : "echec_envoi", p_detail: `test : envoi refusé (HTTP ${status ?? "?"})`, p_is_test: true });
      }
    }
  }
  const ok = results.filter((r) => r.result === "ok").length;
  return Response.json({ ok: ok > 0, sent: ok, failed: results.length - ok, devices: subs.length, results }, { headers: noStore });
}
