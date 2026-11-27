import type { SupabaseClient } from "@supabase/supabase-js";
import type { PushItem, PushResponse } from "./types";

// Appels aux routes serveur réservées au responsable (/api/test/*). Le jeton de session part dans l'en-tête :
// c'est le SERVEUR qui vérifie le rôle (le bouton caché ne protège rien).
async function headers(sb: SupabaseClient): Promise<Record<string, string>> {
  const { data } = await sb.auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
}

export async function pushTest(sb: SupabaseClient, target: "self" | "test", items: PushItem[]): Promise<PushResponse> {
  try {
    const res = await fetch("/api/test/push", { method: "POST", headers: await headers(sb), body: JSON.stringify({ target, items }) });
    const body = (await res.json().catch(() => ({}))) as PushResponse & { error?: string };
    if (!res.ok) return { ok: false, error: res.status === 403 ? "Refusé : réservé au responsable." : (body.error ?? `Erreur HTTP ${res.status}`) };
    return body;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? `Réseau : ${e.message}` : "Réseau indisponible" };
  }
}

export type ServerStatus = { serverTime: string; vapid: boolean; cronSecret: boolean; supabase: boolean; region: string | null; commit: string | null };

export async function serverStatus(sb: SupabaseClient): Promise<{ ok: true; status: ServerStatus } | { ok: false; code: number; error: string }> {
  try {
    const res = await fetch("/api/test/status", { headers: await headers(sb), cache: "no-store" });
    const body = (await res.json().catch(() => ({}))) as ServerStatus & { error?: string };
    if (!res.ok) return { ok: false, code: res.status, error: body.error ?? `HTTP ${res.status}` };
    return { ok: true, status: body };
  } catch (e) {
    return { ok: false, code: 0, error: e instanceof Error ? e.message : "réseau indisponible" };
  }
}
