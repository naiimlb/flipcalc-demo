// Les tests du MODE TEST qui parlent à la base (suite-db.ts) sont exécutés ici contre le VRAI schéma SQL (PGlite),
// connecté comme le responsable : on vérifie que les tests eux-mêmes sont justes (ils doivent passer sur un système sain)
// et qu'ils détectent une panne (ils doivent passer au rouge si on casse le comportement).
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { testBilan, testDetailPage, testPostpone, testRelance, testSharing, testTransfer } from "@/lib/testmode/suite-db";
import type { Ctx, PushItem } from "@/lib/testmode/types";

const STUB = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text);
  insert into vault.decrypted_secrets values ('hb_cron_secret', 'secret-de-test');
  create role anon nologin; create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;
const SET_RETURNING = new Set(["colleagues", "shared_with_me", "my_outcomes", "task_history", "next_team_members", "transfers_overview", "test_anomalies", "test_target_subs", "share_overview", "claims_overview"]);

let db: PGlite;
const ids = { boss: "", lea: "", tester: "" };
const pushed: PushItem[] = [];

async function asUser<T>(uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid}', false); set role authenticated;`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

/** Un faux client Supabase branché sur PGlite, connecté comme `uid` (même contrat que le vrai : { data, error }). */
function fakeSupabase(uid: string) {
  return {
    rpc: async (fn: string, args: Record<string, unknown> = {}) => {
      const names = Object.keys(args);
      const call = `public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(", ")})`;
      try {
        const r = await asUser(uid, () => db.query<Record<string, unknown>>(SET_RETURNING.has(fn) ? `select * from ${call}` : `select ${call} as r`, names.map((n) => args[n])));
        return { data: SET_RETURNING.has(fn) ? r.rows : (r.rows[0] as { r: unknown }).r, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message, code: (e as { code?: string }).code } };
      }
    },
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        const cols = Object.keys(row);
        try {
          await asUser(uid, () => db.query(`insert into public.${table} (${cols.join(", ")}) values (${cols.map((_, i) => `$${i + 1}`).join(", ")})`, cols.map((c) => row[c])));
          return { error: null };
        } catch (e) {
          return { error: { message: (e as Error).message } };
        }
      },
    }),
  };
}

const q = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
const makeCtx = (extra: Partial<Ctx> = {}): Ctx => ({
  sb: fakeSupabase(ids.boss) as unknown as Ctx["sb"],
  uid: ids.boss,
  prenom: "Sam",
  now: () => new Date("2026-11-26T12:00:00Z"),
  accelSeconds: 30,
  stepSeconds: 20,
  pushToDevice: false,
  testUser: { id: ids.tester, prenom: "Testeur" },
  push: async (_t, items) => (pushed.push(...items), { ok: true, sent: items.length, devices: 1 }),
  say: () => undefined,
  ...extra,
});
const failing = (o: { checks?: { ok: boolean; label: string; expected: string; got: string }[]; detail: string }) =>
  (o.checks ?? []).filter((c) => !c.ok).map((c) => `${c.label} → attendu ${c.expected}, obtenu ${c.got}`).concat(o.checks?.length ? [] : [o.detail]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  await db.exec(readFileSync(join(__dirname, "../supabase/schema.sql"), "utf8"));
  const mk = async (email: string, prenom: string) => (await q("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ prenom })])).rows[0]!.id as string;
  ids.boss = await mk("sam@hb.fr", "Sam");
  ids.lea = await mk("lea@hb.fr", "Léa");
  ids.tester = await mk("testeur@hb.fr", "Testeur");
  await q("update public.profiles set role = 'responsable' where id = $1", [ids.boss]);
  await q("update public.settings set schedule = 'JJJJJJJ' where user_id = $1", [ids.tester]); // équipe Jour tous les jours
  await q("update public.test_config set test_user = $1 where id", [ids.tester]);
  await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/boss', 'k', 'a')", [ids.boss]);
});

describe("mode test : les tests qui utilisent la base passent sur un système sain", () => {
  it("3. page détail : Fait, Plus tard, Refuser", async () => {
    const r = await testDetailPage(makeCtx());
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
  });
  it("4. relance automatique accélérée", async () => {
    const r = await testRelance(makeCtx({ pushToDevice: true }));
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
    expect(pushed.filter((p) => p.title.includes("Rappel")).length).toBe(3); // 3 relances envoyées à l'appareil
  });
  it("6. rappel plus tard : 10 / 15 / 30 / 60 min", async () => {
    const r = await testPostpone(makeCtx());
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
  });
  it("7. partage vers le compte de test (2 modes) et refus d'un vrai collègue", async () => {
    const r = await testSharing(makeCtx());
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
    expect(r.checks!.some((c) => c.label.includes("vrai collègue") && c.ok)).toBe(true);
  });
  it("8. bilan de fin de service, transmission et laisser tomber (groupés)", async () => {
    const r = await testBilan(makeCtx({ pushToDevice: true }));
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
    expect(pushed.some((p) => p.url.startsWith("/bilan?j=2026-11-26&e=soir"))).toBe(true);
  });
  it("9. transmission : arrivée, acceptation, refus, sans réponse, toute l'équipe", async () => {
    const r = await testTransfer(makeCtx());
    expect(failing(r)).toEqual([]);
    expect(r.status).toBe("ok");
    expect(r.checks!.some((c) => c.label.startsWith("toute l'équipe : seul le compte de test") && c.ok)).toBe(true);
  });
  it("7 et 9 sans compte de test : « non testé » avec une explication", async () => {
    expect((await testSharing(makeCtx({ testUser: null }))).status).toBe("skip");
    expect((await testTransfer(makeCtx({ testUser: null }))).status).toBe("skip");
  });
  it("aucune tâche de test n'est visible par un vrai collègue ; le nettoyage supprime tout", async () => {
    const lea = await asUser(ids.lea, () => q("select id from public.tasks where is_test"));
    expect(lea.rows).toHaveLength(0);
    expect((await q("select count(*)::int as n from public.tasks where is_test")).rows[0]!.n).toBeGreaterThan(20);
    await asUser(ids.boss, () => q("select public.test_cleanup()"));
    expect((await q("select count(*)::int as n from public.tasks where is_test")).rows[0]!.n).toBe(0);
    expect((await q("select count(*)::int as n from public.task_events")).rows[0]!.n).toBe(0);
  });
});

describe("mode test : les tests détectent une vraie panne (ils ne sont pas complaisants)", () => {
  it("si « Refuser » ne changeait pas le statut, le test 3 passe au rouge avec attendu / obtenu", async () => {
    await db.exec("create or replace function public.my_status(p_task uuid, p_date date) returns jsonb language sql as $$ select '{\"status\":\"todo\"}'::jsonb $$;");
    const r = await testDetailPage(makeCtx());
    expect(r.status).toBe("ko");
    const bad = r.checks!.find((c) => !c.ok)!;
    expect(bad.expected).not.toBe(bad.got);
    expect(r.detail).toContain("attendu");
  });
});
