import { authorizeManager, noStore } from "@/server/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Configuration côté serveur (booléens seulement, jamais les valeurs) — réservé au responsable (403 sinon). */
export async function GET(request: Request) {
  const auth = await authorizeManager(request);
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status, headers: noStore });
  return Response.json(
    {
      serverTime: new Date().toISOString(),
      vapid: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY),
      cronSecret: Boolean(process.env.CRON_SECRET),
      supabase: true,
      region: process.env.VERCEL_REGION ?? null,
      commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || null,
    },
    { headers: noStore },
  );
}
