import type { Backup } from "@/lib/storage/backup";
import { cardSchema, programSchema } from "@/lib/storage/backup";
import type { HifzDB, OutboxOp, SyncMeta, SyncTable } from "@/lib/storage/db";
import { normalizeSettings } from "@/lib/storage/settings";
import { reviewSchema } from "@/lib/storage/backup";
import type { PushRow, RemoteRow, RemoteStore, SyncResult } from "./types";

const TABLES: SyncTable[] = ["programs", "cards", "settings", "reviews"];
/** Les écritures serveur concurrentes peuvent se valider dans le désordre : on relit un peu en arrière. */
const OVERLAP_MS = 5_000;
const BATCH = 400;

const newer = (a: string, b: string) => a > b;

type Parsed = { key: string; row: Record<string, unknown> } | null;

/** Valide une ligne distante : une donnée corrompue est ignorée, jamais appliquée. */
function parseRemote(table: SyncTable, r: RemoteRow): Parsed {
  if (!r.data || typeof r.data !== "object") return null;
  const updatedAt = typeof r.data.updatedAt === "string" ? r.data.updatedAt : null;
  if (table === "cards") {
    const ok = updatedAt && cardSchema.safeParse(r.data);
    return ok && ok.success && ok.data.key === r.key ? { key: r.key, row: { ...ok.data, updatedAt } } : null;
  }
  if (table === "programs") {
    const ok = updatedAt && programSchema.safeParse(r.data);
    return ok && ok.success && ok.data.id === r.key ? { key: r.key, row: { ...ok.data, updatedAt } } : null;
  }
  if (table === "settings") {
    return updatedAt ? { key: "app", row: { id: "app", ...normalizeSettings(r.data), updatedAt } } : null;
  }
  const ok = reviewSchema.safeParse(r.data);
  return ok.success ? { key: r.key, row: { rid: r.key, ...ok.data } } : null;
}

function tombstoneTime(r: RemoteRow): string | null {
  return r.data && typeof r.data.updatedAt === "string" ? r.data.updatedAt : null;
}

/** Applique à la base locale les lignes lues sur le serveur. Les opérations en attente locales restent prioritaires si plus récentes. */
async function applyPulled(db: HifzDB, table: SyncTable, rows: RemoteRow[]): Promise<{ applied: number; skipped: number }> {
  let applied = 0;
  let skipped = 0;
  await db.transaction("rw", [db.cards, db.programs, db.settings, db.reviews, db.outbox], async () => {
    const pending = new Map<string, OutboxOp>();
    for (const op of await db.outbox.where("table").equals(table).toArray()) pending.set(op.key, op);

    for (const r of rows) {
      if (table === "reviews") {
        if (r.deleted) continue;
        const parsed = parseRemote(table, r);
        if (!parsed) {
          skipped++;
          continue;
        }
        if (!(await db.reviews.where("rid").equals(r.key).first())) {
          await db.reviews.add(parsed.row as never);
          applied++;
        }
        continue;
      }

      const store = table === "cards" ? db.cards : table === "programs" ? db.programs : db.settings;
      const localKey = table === "settings" ? "app" : r.key;
      const local = (await store.get(localKey as never)) as { updatedAt: string } | undefined;
      const op = pending.get(localKey);
      // Écho d'une suppression déjà appliquée : rien à faire.
      if (r.deleted && !local && !op) continue;

      let remoteAt: string | null;
      let parsed: Parsed = null;
      if (r.deleted) {
        remoteAt = tombstoneTime(r);
        if (!remoteAt) {
          skipped++;
          continue;
        }
      } else {
        parsed = parseRemote(table, r);
        if (!parsed) {
          skipped++;
          continue;
        }
        remoteAt = parsed.row.updatedAt as string;
      }

      // Comparaison avec l'état local : une suppression locale en attente date de op.at.
      const localAt = op ? op.at : (local?.updatedAt ?? null);
      if (localAt !== null && !newer(remoteAt, localAt)) continue;

      if (r.deleted) {
        if (local) await store.delete(localKey as never);
        if (op) await db.outbox.delete(op.id!);
      } else if (parsed) {
        await store.put(parsed.row as never);
        if (op) await db.outbox.delete(op.id!);
      }
      applied++;
    }
  });
  return { applied, skipped };
}

async function getMeta(db: HifzDB): Promise<SyncMeta> {
  return (await db.meta.get("sync")) ?? { id: "sync", cursors: {}, lastSyncAt: null };
}

async function pullAll(db: HifzDB, remote: RemoteStore): Promise<{ pulled: number; skipped: number }> {
  const meta = await getMeta(db);
  let pulled = 0;
  let skipped = 0;
  for (const table of TABLES) {
    const cursor = meta.cursors[table];
    const since = cursor ? new Date(Date.parse(cursor) - OVERLAP_MS).toISOString() : null;
    const rows = await remote.pull(table, since);
    const { applied, skipped: bad } = await applyPulled(db, table, rows);
    pulled += applied;
    skipped += bad;
    const last = rows.reduce<string | null>((m, r) => (m === null || r.serverUpdatedAt > m ? r.serverUpdatedAt : m), cursor ?? null);
    if (last) meta.cursors[table] = last;
  }
  await db.meta.put(meta);
  return { pulled, skipped };
}

async function toPushRow(db: HifzDB, op: OutboxOp): Promise<PushRow | null> {
  if (op.op === "delete") return { key: op.key, data: { updatedAt: op.at }, deleted: true };
  if (op.table === "reviews") {
    const r = await db.reviews.where("rid").equals(op.key).first();
    return r ? { key: r.rid, data: { key: r.key, day: r.day, grade: r.grade, at: r.at }, deleted: false } : null;
  }
  if (op.table === "settings") {
    const s = await db.settings.get("app");
    if (!s) return null;
    const data: Record<string, unknown> = { ...s };
    delete data.id;
    return { key: "app", data, deleted: false };
  }
  const row = op.table === "cards" ? await db.cards.get(op.key) : await db.programs.get(op.key);
  return row ? { key: op.key, data: { ...row }, deleted: false } : null;
}

async function pushAll(db: HifzDB, remote: RemoteStore): Promise<number> {
  const ops = await db.outbox.orderBy("id").toArray();
  let pushed = 0;
  for (const table of TABLES) {
    const mine = ops.filter((o) => o.table === table);
    for (let i = 0; i < mine.length; i += BATCH) {
      const slice = mine.slice(i, i + BATCH);
      const rows: PushRow[] = [];
      const sent: OutboxOp[] = [];
      for (const op of slice) {
        const row = await toPushRow(db, op);
        if (row) {
          rows.push(row);
          sent.push(op);
        } else {
          // Ligne disparue entre-temps : rien à envoyer, on clôt l'opération.
          await db.outbox.delete(op.id!);
        }
      }
      if (rows.length === 0) continue;
      await remote.push(table, rows);
      // On ne supprime que les opérations envoyées, sauf si une modification plus récente les a remplacées.
      await db.transaction("rw", db.outbox, async () => {
        for (const op of sent) {
          const current = await db.outbox.get(op.id!);
          if (current && current.at === op.at) await db.outbox.delete(op.id!);
        }
      });
      pushed += rows.length;
    }
  }
  return pushed;
}

/**
 * Synchronise la base locale avec le serveur : lecture des changements distants, puis envoi des
 * changements locaux. En cas d'échec, rien n'est perdu : la file d'envoi reste en place.
 */
export async function syncOnce(db: HifzDB, remote: RemoteStore, now: Date = new Date()): Promise<SyncResult> {
  const { pulled, skipped } = await pullAll(db, remote);
  const pushed = await pushAll(db, remote);
  const meta = await getMeta(db);
  await db.meta.put({ ...meta, lastSyncAt: now.toISOString() });
  return { pulled, pushed, skipped };
}

/** Aucune donnée locale : sert à décider s'il faut proposer de rattacher des données d'un appareil. */
export async function isLocalEmpty(db: HifzDB): Promise<boolean> {
  const [cards, programs] = await Promise.all([db.cards.count(), db.programs.count()]);
  return cards === 0 && programs === 0;
}

export type { Backup };
