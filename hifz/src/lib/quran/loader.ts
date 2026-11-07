import { getSurahMeta } from "./catalog";
import { surahDataSchema } from "./schema";
import type { SurahData } from "./types";

export type QuranErrorKind = "offline" | "http" | "integrity" | "unknown-surah";

export class QuranDataError extends Error {
  constructor(
    readonly kind: QuranErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "QuranDataError";
  }
}

/** Cache persistant des sourates déjà chargées (implémenté par lib/storage avec IndexedDB). */
export interface SurahCache {
  /** Ne renvoie la sourate que si elle a été enregistrée avec cette empreinte. */
  get(number: number, sha256: string): Promise<SurahData | undefined>;
  put(data: SurahData, sha256: string): Promise<void>;
}

export interface SurahLoaderOptions {
  cache: SurahCache;
  fetch?: typeof fetch;
  baseUrl?: string;
  isOnline?: () => boolean;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Charge une sourate : d'abord depuis le cache local (hors ligne), sinon depuis
 * `/quran/surah/NNN.json`, en vérifiant l'empreinte SHA-256 de l'index avant de l'enregistrer.
 */
export function createSurahLoader({ cache, fetch: fetchImpl, baseUrl = "/quran/surah", isOnline }: SurahLoaderOptions) {
  const doFetch = fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  const inflight = new Map<number, Promise<SurahData>>();

  async function loadFromNetwork(number: number): Promise<SurahData> {
    const meta = getSurahMeta(number);
    if (!meta) throw new QuranDataError("unknown-surah", `Sourate ${number} inconnue.`);
    if (isOnline && !isOnline()) {
      throw new QuranDataError("offline", "Hors ligne : cette sourate n'a pas encore été téléchargée sur cet appareil.");
    }
    let res: Response;
    try {
      res = await doFetch(`${baseUrl}/${String(number).padStart(3, "0")}.json`);
    } catch {
      throw new QuranDataError("offline", "Connexion impossible : vérifiez le réseau puis réessayez.");
    }
    if (!res.ok) throw new QuranDataError("http", `Le serveur a répondu ${res.status} pour la sourate ${number}.`);
    const text = await res.text();
    if ((await sha256Hex(text)) !== meta.sha256) {
      throw new QuranDataError("integrity", `Les données de la sourate ${number} ne correspondent pas à l'empreinte attendue.`);
    }
    let parsed: SurahData;
    try {
      parsed = surahDataSchema.parse(JSON.parse(text));
    } catch {
      throw new QuranDataError("integrity", `Données illisibles pour la sourate ${number}.`);
    }
    if (parsed.number !== number || parsed.ayahs.length !== meta.ayahCount) {
      throw new QuranDataError("integrity", `Données incohérentes pour la sourate ${number}.`);
    }
    await cache.put(parsed, meta.sha256);
    return parsed;
  }

  return {
    async load(number: number): Promise<SurahData> {
      const meta = getSurahMeta(number);
      if (!meta) throw new QuranDataError("unknown-surah", `Sourate ${number} inconnue.`);
      const cached = await cache.get(number, meta.sha256);
      if (cached) return cached;
      const pending = inflight.get(number);
      if (pending) return pending;
      const p = loadFromNetwork(number).finally(() => inflight.delete(number));
      inflight.set(number, p);
      return p;
    },
  };
}
