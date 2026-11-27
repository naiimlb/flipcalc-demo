import type { SupabaseClient } from "@supabase/supabase-js";
import { serverStatus } from "./api";

// Diagnostic en direct : pastilles vert / orange / rouge.
export type Level = "ok" | "warn" | "ko";
export type Diag = { id: string; label: string; level: Level; detail: string };

export type Status = {
  server_now: string;
  planner: { last_run_at: string | null; last_ok_at: string | null; last_error: string | null; runs: number; sent_total: number; failed_total: number } | null;
  pending: { outbox: number; postponed_due: number; relances_due: number; transfers: number };
  subs: { mine: number; test: number };
  test_user: { id: string; prenom: string } | null;
  test_tasks: number;
  anomalies: number;
};

/** Retard du planificateur : vert < 90 s, orange < 5 min, rouge au-delà (ou jamais passé). */
export function plannerLevel(lastRunAt: string | null, nowMs: number): { level: Level; detail: string } {
  if (!lastRunAt) return { level: "ko", detail: "Jamais passé. Vérifie le cron Supabase (docs/NOTIFICATIONS.md)." };
  const late = Math.round((nowMs - new Date(lastRunAt).getTime()) / 1000);
  const when = new Date(lastRunAt).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" });
  const age = late < 90 ? `il y a ${late} s` : `il y a ${Math.round(late / 60)} min`;
  if (late < 90) return { level: "ok", detail: `Dernier passage à ${when} (${age}).` };
  if (late < 300) return { level: "warn", detail: `Dernier passage à ${when} (${age}) : en retard.` };
  return { level: "ko", detail: `Dernier passage à ${when} (${age}) : le planificateur ne tourne plus.` };
}

/** Écart d'horloge téléphone ↔ serveur : vert < 5 s, orange < 60 s, rouge au-delà. */
export function clockLevel(offsetMs: number): { level: Level; detail: string } {
  const s = Math.abs(Math.round(offsetMs / 1000));
  const dir = offsetMs > 0 ? "en retard" : "en avance";
  if (s < 5) return { level: "ok", detail: `Écart de ${s} s avec le serveur.` };
  if (s < 60) return { level: "warn", detail: `Le téléphone est ${dir} de ${s} s sur le serveur.` };
  return { level: "ko", detail: `Le téléphone est ${dir} de ${Math.round(s / 60)} min sur le serveur : les rappels locaux seront décalés.` };
}

export async function loadDiagnostics(sb: SupabaseClient): Promise<{ items: Diag[]; status: Status | null }> {
  const items: Diag[] = [];
  const push = (d: Diag) => items.push(d);

  // Supabase + horloge
  const t0 = Date.now();
  const { data, error } = await sb.rpc("test_status");
  const t1 = Date.now();
  const status = error ? null : (data as Status);
  if (!status) push({ id: "supabase", label: "Connexion à Supabase", level: "ko", detail: error ? error.message : "aucune réponse" });
  else push({ id: "supabase", label: "Connexion à Supabase", level: t1 - t0 > 2500 ? "warn" : "ok", detail: `Réponse en ${t1 - t0} ms.` });

  // Notifications (appareil)
  const perm = typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  push({
    id: "permission",
    label: "Notifications : permission",
    level: perm === "granted" ? "ok" : perm === "default" ? "warn" : "ko",
    detail: perm === "granted" ? "Accordée." : perm === "default" ? "Pas encore demandée (Réglages → Activer les notifications)." : perm === "denied" ? "Refusée dans les réglages du téléphone." : "Non supportées par ce navigateur.",
  });
  let reg: ServiceWorkerRegistration | undefined;
  try {
    reg = await navigator.serviceWorker?.getRegistration();
  } catch {
    reg = undefined;
  }
  let sub: PushSubscription | null = null;
  try {
    sub = (await reg?.pushManager?.getSubscription()) ?? null;
  } catch {
    sub = null;
  }
  const serverSubs = status?.subs.mine ?? 0;
  push({
    id: "push",
    label: "Abonnement push actif",
    level: sub && serverSubs > 0 ? "ok" : sub || serverSubs > 0 ? "warn" : "ko",
    detail: sub && serverSubs > 0 ? `Appareil abonné (${serverSubs} enregistré${serverSubs > 1 ? "s" : ""} côté serveur).` : sub ? "Abonné sur l'appareil mais absent du serveur : réactive dans Réglages." : serverSubs > 0 ? "Enregistré côté serveur mais pas sur cet appareil." : "Aucun abonnement : active les notifications dans Réglages.",
  });
  const api = await serverStatus(sb);
  const publicKey = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY);
  if (api.ok) {
    push({ id: "vapid", label: "Clés VAPID configurées", level: api.status.vapid && publicKey ? "ok" : "ko", detail: api.status.vapid ? (publicKey ? "Clé publique et clé privée présentes." : "Clé publique absente de l'app.") : "Clé privée ou publique manquante sur le serveur." });
  } else {
    push({ id: "vapid", label: "Clés VAPID configurées", level: "ko", detail: `Serveur : ${api.error}${api.code ? ` (${api.code})` : ""}.` });
  }
  push({ id: "sw", label: "Service worker actif", level: reg?.active ? "ok" : "ko", detail: reg?.active ? "Actif." : "Non installé : recharge l'app." });
  const standalone = typeof window !== "undefined" && (window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
  push({ id: "standalone", label: "App installée (écran d'accueil)", level: standalone ? "ok" : "warn", detail: standalone ? "Mode standalone." : "Ouverte dans le navigateur : sur iPhone, les notifications exigent l'app installée." });

  // Planificateur
  const pl = status?.planner;
  const lvl = plannerLevel(pl?.last_run_at ?? null, Date.now());
  push({ id: "planner", label: "Planificateur (chaque minute)", level: status ? lvl.level : "ko", detail: status ? lvl.detail + (pl?.last_error ? ` Dernière erreur : ${pl.last_error}.` : "") : "État inconnu." });

  // Fuseau + écart d'horloge
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offset = status ? new Date(status.server_now).getTime() - (t0 + t1) / 2 : 0;
  const cl = clockLevel(offset);
  push({ id: "clock", label: "Fuseau Europe/Paris et horloge", level: status ? (tz === "Europe/Paris" ? cl.level : cl.level === "ko" ? "ko" : "warn") : "warn", detail: `Fuseau du téléphone : ${tz}${tz === "Europe/Paris" ? "" : " (l'app calcule toujours à l'heure de Paris)"}. ${status ? cl.detail : ""}` });

  // File d'envoi
  if (status) {
    const pend = status.pending.outbox + status.pending.postponed_due + status.pending.relances_due;
    const failed = status.planner?.failed_total ?? 0;
    push({
      id: "queue",
      label: "Notifications : en attente / envoyées / en échec",
      level: failed > 0 ? "warn" : pend > 5 ? "warn" : "ok",
      detail: `En attente : ${pend} · envoyées (total) : ${status.planner?.sent_total ?? 0} · en échec : ${failed}.`,
    });
  }
  return { items, status };
}
