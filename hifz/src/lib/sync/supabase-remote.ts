import type { SupabaseClient } from "@supabase/supabase-js";
import type { SyncTable } from "@/lib/storage/db";
import { SyncError, type PushRow, type RemoteRow, type RemoteStore } from "./types";

const PAGE = 1000;

const TABLE_NAME: Record<SyncTable, string> = {
  cards: "hifz_cards",
  programs: "hifz_programs",
  reviews: "hifz_reviews",
  settings: "hifz_settings",
};

interface DbError {
  message: string;
  code?: string;
  status?: number;
}

function toSyncError(error: DbError): SyncError {
  if (error.status === 401 || error.status === 403 || error.code === "PGRST301" || /jwt/i.test(error.message)) {
    return new SyncError("auth", "Session expirée : reconnectez-vous.");
  }
  if (/fetch|network|failed|timeout/i.test(error.message) || error.status === 0) {
    return new SyncError("offline", "Réseau indisponible.");
  }
  return new SyncError("server", "Le serveur n'a pas pu enregistrer vos données.");
}

/** Implémentation de RemoteStore sur les tables `hifz_*` de Supabase (sécurité par utilisateur côté base). */
export function createSupabaseRemote(client: SupabaseClient, userId: string): RemoteStore {
  return {
    async pull(table, since) {
      const name = TABLE_NAME[table];
      const rows: RemoteRow[] = [];
      for (let from = 0; ; from += PAGE) {
        let query = client.from(name).select("*");
        if (since) query = query.gte("updated_at", since);
        const orderKey = table === "settings" ? "user_id" : table === "reviews" ? "id" : table === "cards" ? "key" : "id";
        const { data, error } = await query
          .order("updated_at", { ascending: true })
          .order(orderKey, { ascending: true })
          .range(from, from + PAGE - 1);
        if (error) throw toSyncError(error);
        for (const r of data ?? []) rows.push(fromDb(table, r as Record<string, unknown>));
        if (!data || data.length < PAGE) break;
      }
      return rows;
    },

    async push(table, rows) {
      if (rows.length === 0) return;
      const name = TABLE_NAME[table];
      const payload = rows.map((r) => toDb(table, userId, r));
      const options =
        table === "reviews"
          ? { onConflict: "user_id,id", ignoreDuplicates: true }
          : { onConflict: table === "settings" ? "user_id" : table === "cards" ? "user_id,key" : "user_id,id" };
      const { error } = await client.from(name).upsert(payload, options);
      if (error) throw toSyncError(error);
    },
  };
}

function fromDb(table: SyncTable, r: Record<string, unknown>): RemoteRow {
  const serverUpdatedAt = new Date(String(r.updated_at)).toISOString();
  if (table === "reviews") {
    return {
      key: String(r.id),
      data: { key: r.key, day: r.day, grade: r.grade, at: new Date(String(r.at)).toISOString() },
      deleted: false,
      serverUpdatedAt,
    };
  }
  return {
    key: table === "settings" ? "app" : String(table === "cards" ? r.key : r.id),
    data: (r.data as Record<string, unknown> | null) ?? null,
    deleted: table === "settings" ? false : r.deleted === true,
    serverUpdatedAt,
  };
}

function toDb(table: SyncTable, userId: string, row: PushRow): Record<string, unknown> {
  if (table === "reviews") {
    const d = row.data as { key: string; day: string; grade: string; at: string };
    return { user_id: userId, id: row.key, key: d.key, day: d.day, grade: d.grade, at: d.at };
  }
  if (table === "settings") return { user_id: userId, data: row.data };
  if (table === "cards") return { user_id: userId, key: row.key, data: row.data, deleted: row.deleted };
  return { user_id: userId, id: row.key, data: row.data, deleted: row.deleted };
}
