import Dexie, { type EntityTable } from "dexie";
import type { SurahData } from "@/lib/quran/types";
import type { DayKey, Grade, SrsCard } from "@/lib/srs";
import type { Settings } from "./settings";

/** Plage de versets choisie pour la mémorisation. */
export interface Program {
  id: string;
  surah: number;
  from: number;
  to: number;
  /** Ordre de création : détermine l'ordre d'introduction des nouveaux versets. */
  seq: number;
  createdAt: string;
}

/** Journal des révisions (une ligne par auto-évaluation). */
export interface ReviewLog {
  id?: number;
  key: string;
  day: DayKey;
  grade: Grade;
  at: string;
}

export interface SettingsRow extends Settings {
  id: "app";
}

export interface CachedSurah {
  number: number;
  sha256: string;
  data: SurahData;
  savedAt: string;
}

export type HifzDB = Dexie & {
  cards: EntityTable<SrsCard, "key">;
  reviews: EntityTable<ReviewLog, "id">;
  programs: EntityTable<Program, "id">;
  settings: EntityTable<SettingsRow, "id">;
  surahs: EntityTable<CachedSurah, "number">;
};

/**
 * Base IndexedDB de l'app. Chaque futur module ajoute ses tables dans une nouvelle version
 * (`db.version(2).stores({ ... })`) sans toucher aux tables existantes.
 */
export function createDb(name = "hifz"): HifzDB {
  const db = new Dexie(name) as HifzDB;
  db.version(1).stores({
    cards: "key, state, due, surah, rank, introduced",
    reviews: "++id, day, key",
    programs: "id, seq",
    settings: "id",
    surahs: "number",
  });
  return db;
}
