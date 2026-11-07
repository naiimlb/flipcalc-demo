"use client";

import { createSurahLoader } from "@/lib/quran/loader";
import { createDb, type HifzDB } from "./db";
import { surahCache } from "./repository";

let active: HifzDB | null = null;
let loader: ReturnType<typeof createSurahLoader> | null = null;

/** Définit la base de la session en cours (une par compte ; `null` à la déconnexion). */
export function setActiveDb(db: HifzDB | null): void {
  active = db;
  loader = null;
}

/** Base locale de l'utilisateur connecté (ou de l'appareil si les comptes sont désactivés). */
export function getDb(): HifzDB {
  if (!active) throw new Error("Stockage local indisponible : aucune session ouverte.");
  return active;
}

/** Ouvre la base IndexedDB d'un compte. Échoue si le navigateur bloque le stockage local. */
export function openDb(name: string, trackChanges: boolean): HifzDB {
  if (typeof indexedDB === "undefined") throw new Error("Stockage local indisponible sur ce navigateur.");
  return createDb(name, { trackChanges });
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
