"use client";

import { createSurahLoader } from "@/lib/quran/loader";
import { createDb, type HifzDB } from "./db";
import { surahCache } from "./repository";

let db: HifzDB | null = null;
let loader: ReturnType<typeof createSurahLoader> | null = null;

/** Base locale du navigateur (créée à la première utilisation, jamais côté serveur). */
export function getDb(): HifzDB {
  if (typeof indexedDB === "undefined") throw new Error("Stockage local indisponible sur ce navigateur.");
  db ??= createDb();
  return db;
}

export function getSurahLoader() {
  loader ??= createSurahLoader({ cache: surahCache(getDb()) });
  return loader;
}

/** Demande au navigateur de ne pas effacer les données (iOS peut sinon les purger). */
export async function requestPersistentStorage(): Promise<boolean | null> {
  if (!navigator.storage?.persist) return null;
  try {
    return (await navigator.storage.persisted()) || (await navigator.storage.persist());
  } catch {
    return null;
  }
}
