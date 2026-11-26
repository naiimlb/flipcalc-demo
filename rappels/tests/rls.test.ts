// Teste le VRAI schéma SQL (supabase/schema.sql) dans un Postgres embarqué (PGlite) :
// on simule Supabase (schéma auth, auth.uid(), rôles anon/authenticated) puis on vérifie
// que chaque utilisateur ne voit et ne modifie que ses propres données.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const SCHEMA = process.env.SCHEMA_PATH ?? join(__dirname, "../supabase/schema.sql");

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema vault;
  create table vault.decrypted_secrets (name text, decrypted_secret text); -- simule le coffre-fort Supabase
  insert into vault.decrypted_secrets values ('hb_cron_secret', 'secret-de-test');
  create role anon nologin;
  create role authenticated nologin;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
`;

let db: PGlite;
const ids = { lea: "", tom: "", boss: "" };

/** Exécute `fn` comme un utilisateur connecté (rôle `authenticated`, auth.uid() = id). */
async function as<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${userId ?? ""}', false); set role ${userId ? "authenticated" : "anon"};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}
const q = (sql: string, params?: unknown[]) => db.query<Record<string, unknown>>(sql, params);
const fails = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
    return false;
  } catch {
    return true;
  }
};

async function newUser(email: string, prenom: string): Promise<string> {
  const r = await q("insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id", [email, JSON.stringify({ prenom })]);
  return r.rows[0]!.id as string;
}
const insertTask = (userId: string, title: string, extra = "") =>
  q(`insert into public.tasks (user_id, title, category, at_time, days ${extra ? ", " + extra.split("=")[0] : ""}) values ($1, $2, 'Caisse', '19:00', '{0,1}' ${extra ? ", " + extra.split("=")[1] : ""})`, [userId, title]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(readFileSync(SCHEMA, "utf8"));
  await db.exec(readFileSync(SCHEMA, "utf8")); // idempotent : 2e passage sans erreur
  ids.lea = await newUser("lea@hb.fr", "Léa");
  ids.tom = await newUser("tom@hb.fr", "Tom");
  ids.boss = await newUser("boss@hb.fr", "Sam");
  await q("update public.profiles set role = 'responsable' where id = $1", [ids.boss]); // fait à la main dans Supabase
});

describe("création de compte (trigger)", () => {
  it("crée le profil (rôle caissier) et les réglages", async () => {
    const p = await q("select prenom, role, email from public.profiles where id = $1", [ids.lea]);
    expect(p.rows[0]).toMatchObject({ prenom: "Léa", role: "caissier", email: "lea@hb.fr" });
    expect((await q("select tva, default_remind, notify from public.settings where user_id = $1", [ids.lea])).rows[0]).toMatchObject({ default_remind: 5, notify: true });
  });

  it("ignore un rôle glissé dans les métadonnées", async () => {
    const r = await q("insert into auth.users (email, raw_user_meta_data) values ('x@hb.fr', '{\"prenom\":\"X\",\"role\":\"responsable\"}') returning id");
    expect((await q("select role from public.profiles where id = $1", [r.rows[0]!.id])).rows[0]!.role).toBe("caissier");
  });
});

describe("un caissier ne voit que ses données", () => {
  beforeAll(async () => {
    await insertTask(ids.lea, "Tâche de Léa");
    await insertTask(ids.tom, "Tâche de Tom");
  });

  it("tâches : chacun voit uniquement les siennes", async () => {
    const lea = await as(ids.lea, () => q("select title from public.tasks"));
    expect(lea.rows.map((r) => r.title)).toEqual(["Tâche de Léa"]);
    const tom = await as(ids.tom, () => q("select title from public.tasks"));
    expect(tom.rows.map((r) => r.title)).toEqual(["Tâche de Tom"]);
  });

  it("profils : un caissier ne voit que le sien (pas la liste des collègues)", async () => {
    const r = await as(ids.lea, () => q("select prenom from public.profiles"));
    expect(r.rows).toEqual([{ prenom: "Léa" }]);
  });

  it("il ne peut ni modifier, ni supprimer, ni créer une tâche pour un autre", async () => {
    const tomTask = (await q("select id from public.tasks where user_id = $1", [ids.tom])).rows[0]!.id;
    await as(ids.lea, async () => {
      expect((await q("update public.tasks set title = 'piraté' where id = $1 returning id", [tomTask])).rows).toHaveLength(0);
      expect((await q("delete from public.tasks where id = $1 returning id", [tomTask])).rows).toHaveLength(0);
      expect(await fails(() => insertTask(ids.tom, "Faux pour Tom"))).toBe(true);
    });
    expect((await q("select title from public.tasks where id = $1", [tomTask])).rows[0]!.title).toBe("Tâche de Tom");
  });

  it("il ne peut pas se donner le rôle responsable ni changer user_id / assigned_by", async () => {
    await as(ids.lea, async () => {
      expect(await fails(() => q("update public.profiles set role = 'responsable' where id = $1", [ids.lea]))).toBe(true);
      expect(await fails(() => q("update public.tasks set user_id = $1", [ids.tom]))).toBe(true);
      expect(await fails(() => q("update public.tasks set assigned_by = $1", [ids.boss]))).toBe(true);
      expect(await fails(() => insertTask(ids.lea, "Fausse assignation", `assigned_by=$$${ids.boss}$$`))).toBe(true);
    });
    expect((await q("select role from public.profiles where id = $1", [ids.lea])).rows[0]!.role).toBe("caissier");
  });

  it("il peut modifier son prénom", async () => {
    await as(ids.lea, () => q("update public.profiles set prenom = 'Léa B.' where id = $1", [ids.lea]));
    expect((await q("select prenom from public.profiles where id = $1", [ids.lea])).rows[0]!.prenom).toBe("Léa B.");
  });

  it("réglages et tâches faites : seulement les siens", async () => {
    const tomTask = (await q("select id from public.tasks where user_id = $1", [ids.tom])).rows[0]!.id;
    const leaTask = (await q("select id from public.tasks where user_id = $1", [ids.lea])).rows[0]!.id;
    await as(ids.lea, async () => {
      expect((await q("update public.settings set notify = false where user_id = $1 returning user_id", [ids.tom])).rows).toHaveLength(0);
      expect(await fails(() => q("insert into public.task_done (task_id, service_date, user_id) values ($1, '2026-11-23', $2)", [tomTask, ids.lea]))).toBe(true); // tâche d'un autre
      await q("insert into public.task_done (task_id, service_date, user_id) values ($1, '2026-11-23', $2)", [leaTask, ids.lea]);
    });
    expect((await as(ids.tom, () => q("select * from public.task_done"))).rows).toHaveLength(0);
    expect((await as(ids.lea, () => q("select * from public.task_done"))).rows).toHaveLength(1);
  });

  it("abonnements push : seulement les siens", async () => {
    await as(ids.lea, () => q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/lea', 'k', 'a')", [ids.lea]));
    expect(await as(ids.lea, () => fails(() => q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/x', 'k', 'a')", [ids.tom])))).toBe(true);
    expect((await as(ids.tom, () => q("select * from public.push_subscriptions"))).rows).toHaveLength(0);
  });

  it("sans connexion (anon) : aucun accès", async () => {
    for (const t of ["tasks", "profiles", "settings", "task_done", "push_subscriptions"]) {
      expect(await as(null, () => fails(() => q(`select * from public.${t}`)))).toBe(true);
    }
  });
});

describe("le responsable", () => {
  it("voit la liste des caissiers (mais pas les autres responsables)", async () => {
    const r = await as(ids.boss, () => q("select prenom, role from public.profiles order by prenom"));
    expect(r.rows.map((x) => x.prenom)).toEqual(expect.arrayContaining(["Léa B.", "Tom", "Sam"]));
    expect(r.rows.filter((x) => x.role === "responsable")).toEqual([{ prenom: "Sam", role: "responsable" }]); // lui seul
  });

  it("assigne une tâche à un caissier précis, qui la voit marquée « assignée »", async () => {
    await as(ids.boss, () =>
      q("insert into public.tasks (user_id, assigned_by, title, category, at_time, days) values ($1, $2, 'Nettoyer la friteuse', 'Hygiène', '23:30', '{4}')", [ids.tom, ids.boss]),
    );
    const tom = await as(ids.tom, () => q("select title, assigned_by from public.tasks where title = 'Nettoyer la friteuse'"));
    expect(tom.rows).toEqual([{ title: "Nettoyer la friteuse", assigned_by: ids.boss }]);
    const lea = await as(ids.lea, () => q("select title from public.tasks where title = 'Nettoyer la friteuse'"));
    expect(lea.rows).toHaveLength(0);
  });

  it("ne peut RIEN lire d'autre : ni tâches, ni tâches faites, ni réglages d'un caissier", async () => {
    await as(ids.boss, async () => {
      expect((await q("select * from public.tasks where user_id = $1", [ids.tom])).rows).toHaveLength(0);
      expect((await q("select * from public.task_done")).rows).toHaveLength(0);
      expect((await q("select * from public.settings where user_id <> $1", [ids.boss])).rows).toHaveLength(0);
      expect((await q("select * from public.push_subscriptions")).rows).toHaveLength(0);
    });
  });

  it("ne peut pas modifier ni supprimer les tâches d'un caissier, ni changer un rôle", async () => {
    await as(ids.boss, async () => {
      expect((await q("update public.tasks set title = 'x' where user_id = $1 returning id", [ids.tom])).rows).toHaveLength(0);
      expect((await q("delete from public.tasks where user_id = $1 returning id", [ids.tom])).rows).toHaveLength(0);
      expect(await fails(() => q("update public.profiles set role = 'responsable' where id = $1", [ids.tom]))).toBe(true);
      expect((await q("update public.profiles set prenom = 'Piraté' where id = $1 returning id", [ids.tom])).rows).toHaveLength(0);
    });
  });

  it("ne peut assigner qu'à un caissier, et en son propre nom", async () => {
    await as(ids.boss, async () => {
      const ins = (user: string, by: string | null) =>
        q("insert into public.tasks (user_id, assigned_by, title, category, at_time, days) values ($1, $2, 'T', 'Autre', '20:00', '{0}')", [user, by]);
      expect(await fails(() => ins(ids.tom, ids.lea))).toBe(true); // faux « assigné par »
      expect(await fails(() => ins(ids.tom, null))).toBe(true); // pas d'assignation anonyme pour un autre
    });
    // vers un autre responsable : refusé
    const boss2 = await newUser("boss2@hb.fr", "Bob");
    await q("update public.profiles set role = 'responsable' where id = $1", [boss2]);
    expect(
      await as(ids.boss, () =>
        fails(() => q("insert into public.tasks (user_id, assigned_by, title, category, at_time, days) values ($1, $2, 'T', 'Autre', '20:00', '{0}')", [boss2, ids.boss])),
      ),
    ).toBe(true);
  });
});

describe("équipes, relève et planning", () => {
  it("les tâches existantes restent visibles pour les deux équipes (défaut « both »)", async () => {
    const r = await q("select team from public.tasks where user_id = $1 limit 1", [ids.lea]);
    expect(r.rows[0]!.team).toBe("both");
  });

  it("refuse une équipe, une relève ou un planning invalide ; accepte les bons", async () => {
    await as(ids.lea, async () => {
      const task = (team: string) => fails(() => q("insert into public.tasks (user_id, title, category, at_time, days, team) values ($1, 'x', 'Caisse', '12:00', '{0}', $2)", [ids.lea, team]));
      expect(await task("nuit")).toBe(true);
      expect(await task("jour")).toBe(false);
      expect(await task("soir")).toBe(false);
      const set = (col: string, v: string | number) => fails(() => q(`update public.settings set ${col} = $1 where user_id = $2`, [v, ids.lea]));
      expect(await set("handover_min", 1000)).toBe(true);
      expect(await set("handover_min", 1080)).toBe(false);
      expect(await set("handover_min", 1110)).toBe(false);
      expect(await set("schedule", "JSRJSR")).toBe(true); // 6 lettres
      expect(await set("schedule", "JSXJSRJ")).toBe(true);
      expect(await set("schedule", "JSRJSR-")).toBe(false);
    });
  });

  it("le planning et la relève d'un caissier sont invisibles pour les autres", async () => {
    await as(ids.lea, () => q("update public.settings set schedule = 'JJJJJJJ' where user_id = $1", [ids.lea]));
    expect((await as(ids.tom, () => q("select schedule from public.settings"))).rows).toEqual([{ schedule: null }]); // seulement le sien
    expect((await as(ids.boss, () => q("select * from public.settings where user_id = $1", [ids.lea]))).rows).toHaveLength(0);
  });
});

describe("tâches libres, fréquence des rappels, pause", () => {
  const ins = (cols: string, vals: string) =>
    q(`insert into public.tasks (user_id, title, category, at_time, days, ${cols}) values ($1, 'x', 'Autre', '12:00', '{0}', ${vals})`, [ids.lea]);

  it("accepte une répétition avec fenêtre, refuse les valeurs invalides", async () => {
    await as(ids.lea, async () => {
      await ins("repeat_every, end_time, until_done", "30, '18:00', true");
      expect(await fails(() => ins("repeat_every", "30"))).toBe(true); // répétition sans heure de fin
      expect(await fails(() => ins("repeat_every, end_time", "2, '18:00'"))).toBe(true); // trop fréquent (min 5)
      expect(await fails(() => ins("repeat_every, end_time", "1000, '18:00'"))).toBe(true);
      expect(await fails(() => ins("repeat_every, end_time", "30, '25:00'"))).toBe(true);
    });
  });

  it("par défaut : une seule fois, jusqu'à ce que ce soit coché, pas en pause", async () => {
    const r = await q("select repeat_every, until_done, paused from public.tasks where user_id = $1 and title = 'Tâche de Léa'", [ids.lea]);
    expect(r.rows[0]).toEqual({ repeat_every: null, until_done: true, paused: false });
  });

  it("on peut mettre en pause SA tâche, pas celle d'un autre", async () => {
    const tomTask = (await q("select id from public.tasks where user_id = $1 limit 1", [ids.tom])).rows[0]!.id;
    await as(ids.lea, async () => {
      expect((await q("update public.tasks set paused = true where title = 'Tâche de Léa' returning id")).rows).toHaveLength(1);
      expect((await q("update public.tasks set paused = true where id = $1 returning id", [tomTask])).rows).toHaveLength(0);
    });
    await q("update public.tasks set paused = false where user_id = $1", [ids.lea]);
  });

  it("push_sent (anti-doublon) est inaccessible aux utilisateurs, même le responsable", async () => {
    for (const who of [ids.lea, ids.boss, null]) {
      expect(await as(who, () => fails(() => q("select * from public.push_sent")))).toBe(true);
      expect(await as(who, () => fails(() => q("insert into public.push_sent (user_id, task_id, service_date, slot_at) values (gen_random_uuid(), gen_random_uuid(), '2026-11-26', now())")))).toBe(true);
    }
  });

  it("push_sent : un même créneau ne peut être enregistré qu'une fois (rôle serveur)", async () => {
    const task = (await q("select id from public.tasks where user_id = $1 limit 1", [ids.lea])).rows[0]!.id;
    const ins2 = () => q("insert into public.push_sent (user_id, task_id, service_date, slot_at) values ($1, $2, '2026-11-26', '2026-11-26T10:00:00Z')", [ids.lea, task]);
    await ins2();
    expect(await fails(ins2)).toBe(true);
    expect((await q("insert into public.push_sent (user_id, task_id, service_date, slot_at) values ($1, $2, '2026-11-26', '2026-11-26T10:30:00Z') returning 1", [ids.lea, task])).rows).toHaveLength(1);
  });

  it("abonnements push : on peut renouveler sa clé, mais pas l'abonnement d'un autre", async () => {
    await as(ids.lea, async () => {
      expect((await q("update public.push_subscriptions set p256dh = 'k2' where endpoint = 'https://push/lea' returning id")).rows).toHaveLength(1);
    });
    await as(ids.tom, async () => {
      expect((await q("update public.push_subscriptions set p256dh = 'pirate' where endpoint = 'https://push/lea' returning id")).rows).toHaveLength(0);
    });
  });
});

describe("fonctions du planificateur (push_*), protégées par un secret", () => {
  const SECRET = "secret-de-test";
  const call = (who: string | null, sql: string, params: unknown[]) => as(who, () => q(sql, params));

  it("refusent tout sans le bon secret, pour tout le monde (anon, caissier, responsable)", async () => {
    for (const who of [null, ids.lea, ids.boss]) {
      for (const secret of ["mauvais", "", null]) {
        expect(await fails(() => call(who, "select public.push_tick_data($1, '{2026-11-26}')", [secret]))).toBe(true);
        expect(await fails(() => call(who, "select public.push_claim($1, gen_random_uuid(), gen_random_uuid(), '2026-11-26', now())", [secret]))).toBe(true);
        expect(await fails(() => call(who, "select public.push_remove_sub($1, 'x')", [secret]))).toBe(true);
        expect(await fails(() => call(who, "select public.push_purge($1)", [secret]))).toBe(true);
      }
    }
  });

  it("push_assert n'est pas appelable directement (pas d'oracle pour deviner le secret)", async () => {
    for (const who of [null, ids.lea]) expect(await fails(() => call(who, "select public.push_assert($1)", [SECRET]))).toBe(true);
  });

  it("renvoient abonnements, réglages, tâches (sans pause) et tâches faites avec le bon secret (rôle anon)", async () => {
    await q("update public.tasks set paused = true where user_id = $1 and title = 'Tâche de Léa'", [ids.lea]);
    const r = await call(null, "select public.push_tick_data($1, '{2026-11-23}') as d", [SECRET]);
    const d = r.rows[0]!.d as { subs: { user_id: string }[]; tasks: { title: string; user_id: string }[]; done: unknown[]; settings: unknown[] };
    expect(d.subs.map((x) => x.user_id)).toContain(ids.lea);
    expect(d.tasks.some((t) => t.title === "Tâche de Léa")).toBe(false); // en pause
    expect(d.tasks.every((t) => t.user_id === ids.lea)).toBe(true); // seulement les utilisateurs abonnés
    expect(d.done.length).toBeGreaterThan(0);
    expect(d.settings.length).toBeGreaterThan(0);
    await q("update public.tasks set paused = false where user_id = $1", [ids.lea]);
    const none = await call(null, "select public.push_tick_data($1, '{2030-01-01}') as d", [SECRET]);
    expect((none.rows[0]!.d as { done: unknown[] }).done).toHaveLength(0); // aucune tâche faite à cette date
  });

  it("push_claim : vrai la première fois, faux ensuite (anti-doublon)", async () => {
    const task = (await q("select id from public.tasks where user_id = $1 limit 1", [ids.lea])).rows[0]!.id;
    const claim = () => call(null, "select public.push_claim($1, $2, $3, '2026-11-27', '2026-11-27T09:00:00Z') as ok", [SECRET, ids.lea, task]);
    expect((await claim()).rows[0]!.ok).toBe(true);
    expect((await claim()).rows[0]!.ok).toBe(false);
    expect((await claim()).rows[0]!.ok).toBe(false);
  });

  it("push_remove_sub supprime l'abonnement ; push_purge supprime les vieux créneaux", async () => {
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/expire', 'k', 'a')", [ids.lea]);
    await call(null, "select public.push_remove_sub($1, 'https://push/expire')", [SECRET]);
    expect((await q("select 1 from public.push_subscriptions where endpoint = 'https://push/expire'")).rows).toHaveLength(0);
    await q("update public.push_sent set sent_at = now() - interval '5 days' where slot_at = '2026-11-26T10:00:00Z'");
    await call(null, "select public.push_purge($1)", [SECRET]);
    expect((await q("select 1 from public.push_sent where slot_at = '2026-11-26T10:00:00Z'")).rows).toHaveLength(0);
  });
});

describe("contraintes de données", () => {
  it("refuse une heure, une catégorie ou un rappel invalide", async () => {
    await as(ids.lea, async () => {
      const bad = (cols: string) =>
        fails(() => q(`insert into public.tasks (user_id, title, category, at_time, days, remind) values ($1, 'x', ${cols})`, [ids.lea]));
      expect(await bad("'Caisse', '25:00', '{0}', 5")).toBe(true);
      expect(await bad("'Piscine', '20:00', '{0}', 5")).toBe(true);
      expect(await bad("'Caisse', '20:00', '{9}', 5")).toBe(true);
      expect(await bad("'Caisse', '20:00', '{0}', 300")).toBe(true); // rappel max 240 min
      expect(await bad("'Caisse', '20:00', '{0}', 7")).toBe(false); // rappel libre (7 min avant)
      expect(await bad("'Caisse', '20:00', '{0}', 5")).toBe(false);
    });
  });
});
