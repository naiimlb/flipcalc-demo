// Limite anti-abus : 30 messages / heure et par appareil (identifiant anonyme tiré au hasard dans le navigateur),
// plus un plafond large par adresse IP (tout le resto partage souvent le même wifi).
// ⚠️ Compteur en mémoire : sur Vercel, chaque instance serverless a le sien, donc la limite est « approximative ».
// Suffisant pour une v1. Pour une limite stricte, passer à Upstash Redis / Vercel KV (même interface).
import { MESSAGES_PER_HOUR } from "@/lib/assistant-types";

const WINDOW_MS = 60 * 60 * 1000;
const IP_LIMIT = 300;
const hits = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) hits.set(key, list);
  else hits.delete(key);
  return list;
}

export type RateResult = { ok: true } | { ok: false; retryAfterSec: number };

export function checkRateLimit(clientId: string | null, ip: string): RateResult {
  const now = Date.now();
  if (hits.size > 5000) for (const k of [...hits.keys()]) recent(k, now); // nettoyage occasionnel

  const checks: [string, number][] = clientId ? [[`c:${clientId}`, MESSAGES_PER_HOUR], [`ip:${ip}`, IP_LIMIT]] : [[`ip:${ip}`, MESSAGES_PER_HOUR]];
  for (const [key, limit] of checks) {
    const list = recent(key, now);
    if (list.length >= limit) return { ok: false, retryAfterSec: Math.ceil(((list[0] ?? now) + WINDOW_MS - now) / 1000) };
  }
  for (const [key] of checks) hits.set(key, [...(hits.get(key) ?? []), now]);
  return { ok: true };
}
