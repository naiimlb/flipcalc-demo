import Dexie, { type EntityTable } from "dexie";
import type { SurahData } from "@/lib/quran/types";
import type { DayKey, Grade, SrsCard } from "@/lib/srs";
import type { Settings } from "./settings";

/** Horodatage des lignes créées avant la synchronisation : plus ancien que toute modification. */
export const EPOCH = "1970-01-01T00:00:00.000Z";

/** Plage de versets choisie pour la mémorisation. */
export interface Program {
  id: string;
  surah: number;
  from: number;
  to: number;
  /** Ordre de création : détermine l'ordre d'introduction des nouveaux versets. */
  seq: number;
  createdAt: string;
  /** Dernière modification (horloge de l'appareil), sert à départager deux appareils. */
  updatedAt: string;
}

/** Fiche de répétition espacée telle que stockée : la fiche SRS plus sa date de modification. */
export type StoredCard = SrsCard & { updatedAt: string };

/** Journal des révisions (une ligne par auto-évaluation). */
export interface ReviewLog {
  id?: number;
  /** Identifiant global, commun à tous les appareils. */
  rid: string;
  key: string;
  day: DayKey;
  grade: Grade;
  at: string;
}

export type SettingsRow = Settings & { id: "app"; updatedAt: string };

export interface CachedSurah {
  number: number;
  sha256: string;
  data: SurahData;
  savedAt: string;
}

export type SyncTable = "cards" | "programs" | "reviews" | "settings";

/** Modification locale pas encore envoyée au serveur. */
export interface OutboxOp {
  id?: number;
  table: SyncTable;
  /** Clé de la ligne (clé du verset, id du programme, rid de la révision, « app »). */
  key: string;
  op: "put" | "delete";
  at: string;
}

export interface SyncMeta {
  id: "sync";
  /** Dernier horodatage serveur vu, par table. */
  cursors: Partial<Record<SyncTable, string>>;
  lastSyncAt: string | null;
}

export type HifzDB = Dexie & {
  cards: EntityTable<StoredCard, "key">;
  reviews: EntityTable<ReviewLog, "id">;
  programs: EntityTable<Program, "id">;
  settings: EntityTable<SettingsRow, "id">;
  surahs: EntityTable<CachedSurah, "number">;
  outbox: EntityTable<OutboxOp, "id">;
  meta: EntityTable<SyncMeta, "id">;
  /** Si vrai, chaque modification est aussi inscrite dans la file d'envoi (compte connecté). */
  trackChanges: boolean;
};

/**
 * Base IndexedDB de l'app. Chaque futur module ajoute ses tables dans une nouvelle version
 * (`db.version(3).stores({ ... })`) sans toucher aux tables existantes.
 */
export function createDb(name = "hifz", options: { trackChanges?: boolean } = {}): HifzDB {
  const db = new Dexie(name) as HifzDB;
  db.version(1).stores({
    cards: "key, state, due, surah, rank, introduced",
    reviews: "++id, day, key",
    programs: "id, seq",
    settings: "id",
    surahs: "number",
  });
  db.version(2)
    .stores({
      reviews: "++id, day, key, &rid",
      outbox: "++id, [table+key]",
      meta: "id",
    })
    .upgrade(async (tx) => {
      await tx.table("cards").toCollection().modify((c: Partial<StoredCard>) => void (c.updatedAt ??= EPOCH));
      await tx.table("programs").toCollection().modify((p: Partial<Program>) => void (p.updatedAt ??= EPOCH));
      await tx.table("settings").toCollection().modify((s: Partial<SettingsRow>) => void (s.updatedAt ??= EPOCH));
      await tx.table("reviews").toCollection().modify((r: Partial<ReviewLog>) => void (r.rid ??= crypto.randomUUID()));
    });
  db.trackChanges = options.trackChanges ?? false;
  return db;
}
