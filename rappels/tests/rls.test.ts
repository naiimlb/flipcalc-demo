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

// =============================================================================================
//  PARTAGE ENTRE COLLÈGUES, RELANCES AUTOMATIQUES
// =============================================================================================
describe("partage de tâches entre collègues", () => {
  let ines = "";
  let shared = ""; // tâche de Léa partagée
  let other = ""; // autre tâche de Léa, jamais partagée
  const D = "2026-11-26";
  const call = (who: string | null, sql: string, params: unknown[] = []) => as(who, () => q(sql, params));
  const json = async (who: string | null, sql: string, params: unknown[]) => (await call(who, sql, params)).rows[0]!.r as Record<string, unknown>;
  const newTask = async (owner: string, title: string) =>
    (await q("insert into public.tasks (user_id, title, category, at_time, days) values ($1, $2, 'Autre', '12:00', '{0,1,2,3,4,5,6}') returning id", [owner, title])).rows[0]!.id as string;

  beforeAll(async () => {
    ines = await newUser("ines@hb.fr", "Inès");
    shared = await newTask(ids.lea, "Tâche partagée");
    other = await newTask(ids.lea, "Tâche privée de Léa");
  });

  it("la liste des collègues ne montre que des prénoms (jamais l'email), sans moi ni les responsables", async () => {
    const r = await call(ids.tom, "select * from public.colleagues()");
    expect(Object.keys(r.rows[0]!).sort()).toEqual(["id", "prenom"]); // aucune autre colonne
    const prenoms = r.rows.map((x) => x.prenom);
    expect(prenoms).toEqual(expect.arrayContaining(["Inès", "Léa B."]));
    expect(prenoms).not.toContain("Tom");
    expect(prenoms).not.toContain("Sam"); // responsable
    expect(JSON.stringify(r.rows)).not.toMatch(/@hb\.fr/);
    expect(await call(null, "select * from public.colleagues()").then(() => false, () => true)).toBe(true); // pas pour les anonymes
  });

  it("seul le propriétaire partage ; pas avec soi-même, un responsable ou un inconnu", async () => {
    const share = (who: string, recips: string[]) => fails(() => call(who, "select public.share_task($1, $2::uuid[], 'each')", [shared, recips]));
    expect(await share(ids.tom, [ines])).toBe(true); // pas son propriétaire
    expect(await share(ids.lea, [ids.lea])).toBe(true); // soi-même
    expect(await share(ids.lea, [ids.boss])).toBe(true); // responsable
    expect(await share(ids.lea, ["00000000-0000-0000-0000-000000000099"])).toBe(true); // inconnu
    expect(await fails(() => call(ids.lea, "select public.share_task($1, $2::uuid[], 'tous')", [shared, [ids.tom]]))).toBe(true); // mode invalide
    expect((await q("select count(*)::int as n from public.task_shares")).rows[0]!.n).toBe(0);
  });

  it("partager : le collègue lit CETTE tâche et aucune autre ; il ne peut ni la modifier ni la supprimer", async () => {
    await call(ids.lea, "select public.share_task($1, $2::uuid[], 'one')", [shared, [ids.tom, ines]]);
    expect((await q("select share_mode from public.tasks where id = $1", [shared])).rows[0]!.share_mode).toBe("one");
    for (const who of [ids.tom, ines]) {
      const titles = (await call(who, "select title from public.tasks where user_id = $1", [ids.lea])).rows.map((r) => r.title);
      expect(titles).toEqual(["Tâche partagée"]); // pas « Tâche privée de Léa »
      expect((await call(who, "update public.tasks set title = 'piraté' where id = $1 returning id", [shared])).rows).toHaveLength(0);
      expect((await call(who, "delete from public.tasks where id = $1 returning id", [shared])).rows).toHaveLength(0);
    }
    expect((await call(ids.boss, "select * from public.tasks where id = $1", [shared])).rows).toHaveLength(0); // le responsable non plus
    expect((await call(ids.boss, "select * from public.task_shares")).rows).toHaveLength(0);
  });

  it("chacun ne voit que ses propres lignes de partage, et seul le destinataire peut répondre", async () => {
    expect((await call(ids.tom, "select * from public.task_shares")).rows).toHaveLength(1);
    expect((await call(ines, "select * from public.task_shares")).rows).toHaveLength(1);
    expect((await call(ids.lea, "select * from public.task_shares")).rows).toHaveLength(2); // le créateur voit tout
    expect(await call(ids.tom, "insert into public.task_shares (task_id, recipient_id) values ($1, $2)", [shared, ids.boss]).then(() => false, () => true)).toBe(true);
    expect(await fails(() => call(ids.tom, "delete from public.task_shares"))).toBe(true); // aucun droit de suppression
    expect(await fails(() => call(ines, "select public.respond_share($1, true)", [other]))).toBe(true); // pas partagée avec elle
    const forTom = await q("select task_id from public.task_shares where recipient_id = $1", [ids.tom]);
    expect(forTom.rows).toHaveLength(1);
  });

  it("shared_with_me montre le prénom du créateur, sans rien d'autre", async () => {
    const r = await call(ids.tom, "select * from public.shared_with_me()");
    expect(r.rows).toEqual([{ task_id: shared, owner_prenom: "Léa B.", status: "pending", mode: "one" }]);
  });

  it("cocher : impossible tant que le partage n'est pas accepté, puis chacun coche de son côté", async () => {
    const done = (who: string) => call(who, "insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3)", [shared, D, who]);
    expect(await fails(() => done(ids.tom))).toBe(true); // en attente
    await call(ids.tom, "select public.respond_share($1, true)", [shared]);
    await call(ines, "select public.respond_share($1, true)", [shared]);
    await done(ids.tom);
    await done(ines);
    expect(await fails(() => done(ids.boss))).toBe(true); // étranger
    expect((await call(ids.tom, "select user_id from public.task_done where task_id = $1", [shared])).rows).toEqual([{ user_id: ids.tom }]); // seulement les siennes
    await q("delete from public.task_done where task_id = $1", [shared]);
  });

  it("qui est concerné et où il en est : visible des participants, refusé aux étrangers", async () => {
    const r = await call(ids.tom, "select * from public.share_overview($1, $2)", [shared, D]);
    expect(r.rows.map((x) => [x.prenom, x.is_owner, x.share_status, x.progress])).toEqual([
      ["Léa B.", true, "accepted", "sent"],
      ["Inès", false, "accepted", "sent"],
      ["Tom", false, "accepted", "sent"],
    ]);
    expect(await fails(() => call(ids.boss, "select * from public.share_overview($1, $2)", [shared, D]))).toBe(true);
    expect(Object.keys(r.rows[0]!).sort()).toEqual(["is_owner", "prenom", "progress", "share_status", "user_id"]); // pas d'email
  });

  it("« un seul s'en occupe » : le premier gagne, les autres sont informés et abandonnent", async () => {
    for (const u of [ids.lea, ids.tom, ines]) await q("insert into public.task_occurrences (task_id, user_id, slot_at, service_date) values ($1, $2, '2026-11-26T11:00:00Z', $3)", [shared, u, D]);
    const first = await json(ids.tom, "select public.occ_act($1, $2, 'taken') as r", [shared, D]);
    expect(first).toEqual({ ok: true });
    expect(await json(ines, "select public.occ_act($1, $2, 'taken') as r", [shared, D])).toEqual({ ok: false, taken_by: "Tom" });
    expect(await json(ids.lea, "select public.occ_act($1, $2, 'done') as r", [shared, D])).toEqual({ ok: false, taken_by: "Tom" }); // même le créateur
    expect(await json(ids.tom, "select public.occ_act($1, $2, 'taken') as r", [shared, D])).toEqual({ ok: true }); // idempotent
    const st = Object.fromEntries((await q("select user_id, status, reason from public.task_occurrences where task_id = $1", [shared])).rows.map((r) => [r.user_id, [r.status, r.reason]]));
    expect(st[ids.tom]).toEqual(["taken", null]);
    expect(st[ines]).toEqual(["dropped", "taken_by_other"]);
    expect(st[ids.lea]).toEqual(["dropped", "taken_by_other"]);
    const c = await call(ines, "select task_id, service_date::text as service_date, user_id, prenom from public.claims_overview($1::date[])", [[D]]);
    expect(c.rows).toEqual([{ task_id: shared, service_date: D, user_id: ids.tom, prenom: "Tom" }]);
    expect((await call(ids.boss, "select * from public.claims_overview($1::date[])", [[D]])).rows).toHaveLength(0);
    const ov = (await call(ines, "select prenom, progress from public.share_overview($1, $2)", [shared, D])).rows;
    expect(ov.find((x) => x.prenom === "Tom")!.progress).toBe("taken");
    expect(await fails(() => call(ids.boss, "select public.occ_act($1, $2, 'seen')", [shared, D]))).toBe(true); // étranger
  });

  it("« chacun la fait » : tout le monde peut prendre et cocher, sans conflit", async () => {
    const t = await newTask(ids.lea, "Tâche pour tous");
    await call(ids.lea, "select public.share_task($1, $2::uuid[], 'each')", [t, [ids.tom, ines]]);
    for (const u of [ids.tom, ines]) await call(u, "select public.respond_share($1, true)", [t]);
    expect(await json(ids.tom, "select public.occ_act($1, $2, 'taken') as r", [t, D])).toEqual({ ok: true });
    expect(await json(ines, "select public.occ_act($1, $2, 'done') as r", [t, D])).toEqual({ ok: true });
    expect((await q("select count(*)::int as n from public.task_claims where task_id = $1", [t])).rows[0]!.n).toBe(0);
    expect((await q("select user_id from public.task_done where task_id = $1", [t])).rows).toEqual([{ user_id: ines }]);
  });

  it("arrêter le partage : le collègue ne voit plus la tâche ; vide = tâche non partagée", async () => {
    await call(ids.lea, "select public.share_task($1, $2::uuid[], 'one')", [shared, [ids.tom]]);
    expect((await call(ines, "select * from public.tasks where id = $1", [shared])).rows).toHaveLength(0);
    expect((await call(ids.tom, "select * from public.tasks where id = $1", [shared])).rows).toHaveLength(1);
    await call(ids.lea, "select public.share_task($1, '{}'::uuid[], 'one')", [shared]);
    expect((await call(ids.tom, "select * from public.tasks where id = $1", [shared])).rows).toHaveLength(0);
    expect((await q("select share_mode from public.tasks where id = $1", [shared])).rows[0]!.share_mode).toBeNull();
  });

  it("refuser (masquer) : le partage est conservé, avec le statut « refusé »", async () => {
    await call(ids.lea, "select public.share_task($1, $2::uuid[], 'each')", [other, [ids.tom]]);
    await call(ids.tom, "select public.respond_share($1, false)", [other]);
    expect((await call(ids.tom, "select task_id, status from public.shared_with_me() where task_id = $1", [other])).rows).toEqual([{ task_id: other, status: "declined" }]);
    expect(await fails(() => call(ids.tom, "insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3)", [other, D, ids.tom]))).toBe(true);
  });
});

describe("relances automatiques et notifications de partage", () => {
  const SECRET = "secret-de-test";
  const D = "2026-11-26";
  let tom = "";
  let t = ""; // tâche de Tom
  const fu = async () => (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { relances: { n: number; user_id: string; title: string; subs: unknown[] }[]; postponed: { title: string }[] };
  const occ = async (slot = "2026-11-26T11:00:00Z") => (await q("select status, reminders, reason from public.task_occurrences where task_id = $1 and slot_at = $2", [t, slot])).rows[0]!;
  const age = (minutes: number, slot = "2026-11-26T11:00:00Z") => q("update public.task_occurrences set last_sent_at = now() - make_interval(mins => $1) where task_id = $2 and slot_at = $3", [minutes, t, slot]);
  const claim = (slot = "2026-11-26T11:00:00Z") => as(null, () => q("select public.push_claim($1, $2, $3, $4, $5) as ok", [SECRET, tom, t, D, slot]));

  beforeAll(async () => {
    tom = ids.tom;
    t = (await q("insert into public.tasks (user_id, title, category, at_time, days) values ($1, 'Vérifier la friteuse', 'Autre', '12:00', '{0,1,2,3,4,5,6}') returning id", [tom])).rows[0]!.id as string;
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/tom', 'k', 'a') on conflict do nothing", [tom]);
  });

  it("une occurrence enregistrée est « envoyée » et n'est pas relancée avant le délai (5 min)", async () => {
    expect((await claim()).rows[0]!.ok).toBe(true);
    expect(await occ()).toEqual({ status: "sent", reminders: 0, reason: null });
    expect((await fu()).relances).toHaveLength(0);
    await age(4);
    expect((await fu()).relances).toHaveLength(0);
  });

  it("après 5 minutes sans signe : une relance, une seule (verrou), puis toutes les 5 minutes", async () => {
    await age(6);
    const r1 = await fu();
    expect(r1.relances).toHaveLength(1);
    expect(r1.relances[0]).toMatchObject({ n: 1, user_id: tom, title: "Vérifier la friteuse" });
    expect(r1.relances[0]!.subs).toHaveLength(1);
    expect((await fu()).relances).toHaveLength(0); // même minute : déjà partie, pas de doublon
    await age(6);
    expect((await fu()).relances[0]!.n).toBe(2);
    expect((await occ()).reminders).toBe(2);
  });

  it("maximum 6 relances, puis abandon (réglable)", async () => {
    for (let n = 3; n <= 6; n++) {
      await age(6);
      expect((await fu()).relances[0]!.n).toBe(n);
    }
    await age(6);
    expect((await fu()).relances).toHaveLength(0);
    expect(await occ()).toEqual({ status: "dropped", reminders: 6, reason: "max" });
  });

  it("le délai et le maximum se règlent dans app_config, sans toucher au code", async () => {
    await claim("2026-11-26T12:00:00Z");
    await q("update public.app_config set value = 10 where key = 'relance_delay_min'");
    await age(6, "2026-11-26T12:00:00Z");
    expect((await fu()).relances).toHaveLength(0); // 6 min < 10 min
    await age(11, "2026-11-26T12:00:00Z");
    expect((await fu()).relances).toHaveLength(1);
    await q("update public.app_config set value = 5 where key = 'relance_delay_min'");
    await q("update public.app_config set value = 1 where key = 'relance_max'");
    await age(6, "2026-11-26T12:00:00Z");
    expect((await fu()).relances).toHaveLength(0); // plafond de 1 atteint
    expect((await occ("2026-11-26T12:00:00Z")).status).toBe("dropped");
    await q("update public.app_config set value = 6 where key = 'relance_max'");
  });

  it("jamais de relance pour une occurrence vue, prise, faite ou reportée", async () => {
    const act = (action: string, extra = "") => as(tom, () => q(`select public.occ_act($1, $2, '${action}'${extra})`, [t, D]));
    for (const [action, slot, status] of [["seen", "2026-11-26T13:00:00Z", "seen"], ["taken", "2026-11-26T14:00:00Z", "taken"], ["postpone", "2026-11-26T15:00:00Z", "postponed"]] as const) {
      await claim(slot);
      await age(6, slot);
      await act(action);
      expect((await occ(slot)).status).toBe(status);
      await q("update public.task_occurrences set status = $1 where task_id = $2 and slot_at = $3", ["sent", t, slot]); // remise à « envoyée » pour tester chaque action seule
      await q("update public.task_occurrences set status = $1 where task_id = $2 and slot_at = $3", [status, t, slot]);
    }
    await age(6, "2026-11-26T13:00:00Z");
    await age(6, "2026-11-26T14:00:00Z");
    expect((await fu()).relances).toHaveLength(0);
    // faite (cochée directement, sans passer par le bouton) : la relance s'arrête aussi
    await claim("2026-11-26T16:00:00Z");
    await age(6, "2026-11-26T16:00:00Z");
    await q("insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3) on conflict do nothing", [t, D, tom]);
    expect((await fu()).relances).toHaveLength(0);
    expect((await occ("2026-11-26T16:00:00Z")).status).toBe("done");
    await q("delete from public.task_done where task_id = $1", [t]);
  });

  it("« Reporter de 10 min » : le rappel repart à l'échéance, avec un compteur remis à zéro", async () => {
    await claim("2026-11-26T17:00:00Z");
    await as(tom, () => q("select public.occ_act($1, $2, 'postpone', 10)", [t, D]));
    expect((await occ("2026-11-26T17:00:00Z")).status).toBe("postponed");
    expect((await fu()).postponed).toHaveLength(0); // pas encore l'heure
    await q("update public.task_occurrences set postponed_until = now() - interval '1 minute' where task_id = $1 and slot_at = '2026-11-26T17:00:00Z'", [t]);
    const r = await fu();
    expect(r.postponed).toEqual([expect.objectContaining({ title: "Vérifier la friteuse" })]);
    expect(await occ("2026-11-26T17:00:00Z")).toEqual({ status: "sent", reminders: 0, reason: null });
    expect((await fu()).postponed).toHaveLength(0); // une seule fois
  });

  it("reporter depuis la page (sans rappel en cours) crée une occurrence reportée", async () => {
    await as(tom, () => q("select public.occ_act($1, '2026-11-27', 'postpone', 15)", [t]));
    const r = await q("select status, service_date::text as d from public.task_occurrences where task_id = $1 and service_date = '2026-11-27'", [t]);
    expect(r.rows).toEqual([{ status: "postponed", d: "2026-11-27" }]);
  });

  it("pas de relance si la tâche est en pause, si les notifications sont coupées, ou sans abonnement", async () => {
    await claim("2026-11-26T18:00:00Z");
    await age(6, "2026-11-26T18:00:00Z");
    await q("update public.tasks set paused = true where id = $1", [t]);
    expect((await fu()).relances).toHaveLength(0);
    await q("update public.tasks set paused = false where id = $1", [t]);
    await q("update public.settings set notify = false where user_id = $1", [tom]);
    expect((await fu()).relances).toHaveLength(0);
    await q("update public.settings set notify = true where user_id = $1", [tom]);
    const subs = await q("delete from public.push_subscriptions where user_id = $1 returning *", [tom]);
    expect((await fu()).relances).toHaveLength(0);
    for (const s of subs.rows) await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, $2, 'k', 'a')", [s.user_id, s.endpoint]);
    expect((await fu()).relances).toHaveLength(1); // tout est rétabli : la relance repart
  });

  it("une occurrence prise par un collègue n'est pas relancée (mode « un seul »)", async () => {
    const t2 = (await q("insert into public.tasks (user_id, title, category, at_time, days, share_mode) values ($1, 'Sortir les poubelles', 'Autre', '12:00', '{0,1,2,3,4,5,6}', 'one') returning id", [ids.lea])).rows[0]!.id as string;
    await q("insert into public.task_shares (task_id, recipient_id, status, notified_at) values ($1, $2, 'accepted', now())", [t2, tom]);
    await as(null, () => q("select public.push_claim($1, $2, $3, $4, '2026-11-26T19:00:00Z')", [SECRET, tom, t2, D]));
    await q("update public.task_occurrences set last_sent_at = now() - interval '6 minutes' where task_id = $1", [t2]);
    await q("insert into public.task_claims (task_id, service_date, user_id, notified_at) values ($1, $2, $3, now())", [t2, D, ids.lea]); // Léa l'a prise
    const r = await fu();
    expect(r.relances.some((x) => x.title === "Sortir les poubelles")).toBe(false);
    expect((await q("select status, reason from public.task_occurrences where task_id = $1", [t2])).rows[0]).toEqual({ status: "dropped", reason: "taken_by_other" });
  });

  it("notifications de partage : « t'a partagé » une seule fois ; « s'en occupe » aux autres participants", async () => {
    const t3 = (await q("insert into public.tasks (user_id, title, category, at_time, days, share_mode) values ($1, 'Nettoyer la vitrine', 'Autre', '12:00', '{0,1,2,3,4,5,6}', 'one') returning id", [ids.lea])).rows[0]!.id as string;
    await q("insert into public.task_shares (task_id, recipient_id, status) values ($1, $2, 'pending')", [t3, tom]);
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/lea', 'k', 'a') on conflict do nothing", [ids.lea]);
    const n = async () => (await as(null, () => q("select public.push_notices($1) as r", [SECRET]))).rows[0]!.r as { shares: Record<string, unknown>[]; claims: Record<string, unknown>[] };
    const a = await n();
    expect(a.shares.find((x) => x.title === "Nettoyer la vitrine")).toMatchObject({ user_id: tom, owner_prenom: "Léa B." });
    expect((await n()).shares.some((x) => x.title === "Nettoyer la vitrine")).toBe(false); // une seule fois
    await q("update public.task_shares set status = 'accepted' where task_id = $1", [t3]);
    await as(tom, () => q("select public.occ_act($1, $2, 'taken')", [t3, D]));
    const c = await n();
    const mine = c.claims.filter((x) => x.title === "Nettoyer la vitrine");
    expect(mine.map((x) => x.user_id)).toEqual([ids.lea]); // le créateur est informé, pas Tom lui-même
    expect(mine[0]).toMatchObject({ claimer_prenom: "Tom" });
    expect((await n()).claims.some((x) => x.title === "Nettoyer la vitrine")).toBe(false);
  });

  it("le planificateur reçoit aussi les tâches partagées acceptées et qui s'en occupe", async () => {
    const d = (await as(null, () => q("select public.push_tick_data($1, $2::date[]) as d", [SECRET, [D]]))).rows[0]!.d as { tasks: { title: string; for_user: string; shared: boolean }[]; claims: unknown[] };
    const forTom = d.tasks.filter((x) => x.for_user === tom);
    expect(forTom.some((x) => x.title === "Nettoyer la vitrine" && x.shared)).toBe(true);
    expect(forTom.some((x) => x.title === "Vérifier la friteuse" && !x.shared)).toBe(true);
    expect(d.claims.length).toBeGreaterThan(0);
  });

  it("toutes ces fonctions refusent un mauvais secret", async () => {
    for (const sql of ["select public.push_followups($1)", "select public.push_notices($1)"]) {
      expect(await as(null, () => fails(() => q(sql, ["mauvais"])))).toBe(true);
    }
  });
});

// =============================================================================================
//  PAGE DÉTAIL (Fait / Plus tard / Refuser), TRANSMISSION, BILAN DE FIN DE SERVICE
// =============================================================================================
describe("page détail : vu, plus tard, refuser, reprendre", () => {
  const SECRET = "secret-de-test";
  const D = "2026-11-26";
  let mine = ""; // tâche de Léa, jamais partagée
  let assigned = ""; // tâche de Tom assignée par le responsable
  let shared = ""; // tâche de Léa partagée avec Tom
  const act = async (who: string, task: string, action: string, extra = "") => (await as(who, () => q(`select public.occ_act($1, $2, '${action}'${extra}) as r`, [task, D]))).rows[0]!.r as Record<string, unknown>;
  const status = async (who: string, task: string) => (await as(who, () => q("select public.my_status($1, $2) as r", [task, D]))).rows[0]!.r as Record<string, unknown>;
  const outbox = async () => (await q("select user_id, kind, who, detail from public.push_outbox order by id")).rows;
  const newT = async (owner: string, title: string, extra = "") => (await q(`insert into public.tasks (user_id, title, category, at_time, days ${extra ? ", assigned_by" : ""}) values ($1, $2, 'Autre', '12:00', '{0,1,2,3,4,5,6}' ${extra ? ", $3" : ""}) returning id`, extra ? [owner, title, extra] : [owner, title])).rows[0]!.id as string;

  beforeAll(async () => {
    mine = await newT(ids.lea, "Compter le fond");
    assigned = await newT(ids.tom, "Nettoyer la machine", ids.boss);
    shared = await newT(ids.lea, "Vider les bacs");
    await q("insert into public.task_shares (task_id, recipient_id, status, notified_at) values ($1, $2, 'accepted', now())", [shared, ids.tom]);
    await q("delete from public.push_outbox");
  });

  it("ouvrir la page = « vue » (une seule ligne d'historique), et le statut le dit", async () => {
    expect((await status(ids.lea, mine)).status).toBe("todo");
    await act(ids.lea, mine, "seen");
    await act(ids.lea, mine, "seen");
    expect((await status(ids.lea, mine)).status).toBe("seen");
    expect((await q("select count(*)::int as n from public.task_events where task_id = $1 and action = 'seen'", [mine])).rows[0]!.n).toBe(1);
  });

  it("« Rappelle-moi plus tard » : durée libre (bornée), statut « reportée », jamais relancée pendant le délai", async () => {
    await as(null, () => q("select public.push_claim($1, $2, $3, $4, '2026-11-26T11:00:00Z')", [SECRET, ids.lea, mine, D]));
    await q("update public.task_occurrences set last_sent_at = now() - interval '10 minutes' where task_id = $1", [mine]);
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/lea', 'k', 'a') on conflict do nothing", [ids.lea]);
    await act(ids.lea, mine, "postpone", ", 45");
    const st = await status(ids.lea, mine);
    expect(st.status).toBe("postponed");
    const mins = (await q("select extract(epoch from (postponed_until - now()))/60 as m from public.task_occurrences where task_id = $1 and status = 'postponed'", [mine])).rows[0]!.m as number;
    expect(Math.round(mins)).toBe(45);
    const fu = (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { relances: unknown[]; postponed: unknown[] };
    expect(fu.relances).toHaveLength(0); // la relance des 5 min est suspendue
    expect(fu.postponed).toHaveLength(0); // et le rappel reporté n'est pas encore dû
    await act(ids.lea, mine, "postpone", ", 5000"); // borne : 720 min au plus
    expect(Math.round((await q("select extract(epoch from (max(postponed_until) - now()))/60 as m from public.task_occurrences where task_id = $1", [mine])).rows[0]!.m as number)).toBe(720);
    await act(ids.lea, mine, "postpone", ", 10");
    await q("update public.task_occurrences set postponed_until = now() - interval '1 minute' where task_id = $1 and status = 'postponed'", [mine]);
    const due = (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { postponed: { title: string; why: unknown }[] };
    expect(due.postponed.map((x) => x.title)).toContain("Compter le fond"); // revient à l'heure choisie
  });

  it("« Refuser » ma propre tâche : annulée pour aujourd'hui, personne n'est notifié, plus de relance", async () => {
    await act(ids.lea, mine, "decline", ", 10, 'pas aujourd''hui'");
    expect((await status(ids.lea, mine))).toMatchObject({ status: "declined", reason: "pas aujourd'hui" });
    expect((await outbox()).filter((o) => o.kind === "declined")).toHaveLength(0);
    await q("update public.task_occurrences set status = 'sent', last_sent_at = now() - interval '10 minutes' where task_id = $1", [mine]);
    const fu = (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { relances: unknown[] };
    expect(fu.relances).toHaveLength(0); // une tâche refusée n'est jamais relancée
    // un autre jour n'est pas touché
    expect((await as(ids.lea, () => q("select public.my_status($1, '2026-11-27') as r", [mine]))).rows[0]!.r).toMatchObject({ status: "todo" });
  });

  it("« Refuser » une tâche assignée : le responsable est notifié ; partagée : le créateur est notifié", async () => {
    await act(ids.tom, assigned, "decline", ", 10, 'en panne'");
    await act(ids.tom, shared, "decline");
    const o = await outbox();
    expect(o.find((x) => x.user_id === ids.boss)).toMatchObject({ kind: "declined", who: "Tom", detail: "en panne" });
    expect(o.find((x) => x.user_id === ids.lea)).toMatchObject({ kind: "declined", who: "Tom", detail: null });
  });

  it("le motif est limité à une ligne (140 caractères)", async () => {
    const t = await newT(ids.lea, "Tâche motif");
    await act(ids.lea, t, "decline", `, 10, '${"x".repeat(300)}'`);
    expect(((await status(ids.lea, t)).reason as string).length).toBe(140);
  });

  it("« Fait » après un refus : la tâche redevient faite ; « Reprendre » annule le refus ; « Laisser tomber » est gardé", async () => {
    await act(ids.tom, assigned, "done");
    expect((await status(ids.tom, assigned)).status).toBe("done");
    expect((await q("select count(*)::int as n from public.task_outcomes where task_id = $1", [assigned])).rows[0]!.n).toBe(0);
    await act(ids.tom, shared, "reopen");
    expect((await status(ids.tom, shared)).status).toBe("todo");
    await act(ids.tom, shared, "abandon");
    expect((await status(ids.tom, shared)).status).toBe("abandoned");
    expect((await q("select count(*)::int as n from public.tasks where id = $1", [shared])).rows[0]!.n).toBe(1); // pas supprimée
  });

  it("historique : qui, quand, quoi — visible par ceux qui voient la tâche, refusé aux autres", async () => {
    const h = await as(ids.lea, () => q("select prenom, action, detail from public.task_history($1, $2)", [shared, D]));
    expect(h.rows.map((r) => [r.prenom, r.action])).toEqual(expect.arrayContaining([["Tom", "declined"], ["Tom", "reopened"], ["Tom", "abandoned"]]));
    expect((await as(ids.tom, () => q("select * from public.task_history($1, $2)", [shared, D]))).rows.length).toBeGreaterThan(0);
    expect(await fails(() => as(ids.boss, () => q("select * from public.task_history($1, $2)", [shared, D])))).toBe(true);
    expect(await fails(() => as(ids.boss, () => q("select public.my_status($1, $2)", [mine, D])))).toBe(true);
  });

  it("« fait » est écrit dans l'historique (même coché sans passer par la page)", async () => {
    const t = await newT(ids.lea, "Cochée à la main");
    await as(ids.lea, () => q("insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3)", [t, D, ids.lea]));
    expect((await q("select action, actor_id from public.task_events where task_id = $1", [t])).rows).toEqual([{ action: "done", actor_id: ids.lea }]);
  });

  it("mes issues : chacun ne lit que les siennes ; un étranger ne peut pas agir", async () => {
    expect((await as(ids.tom, () => q("select task_id from public.my_outcomes('2026-11-01')"))).rows.map((r) => r.task_id)).toEqual([shared]);
    expect((await as(ids.boss, () => q("select * from public.my_outcomes('2026-11-01')"))).rows).toHaveLength(0);
    expect(await fails(() => act(ids.boss, mine, "decline"))).toBe(true);
    expect(await fails(() => act(ids.lea, mine, "supprimer"))).toBe(true);
    expect(await as(ids.lea, () => q("select * from public.task_outcomes").then(() => false, () => true))).toBe(true); // table fermée
  });
});

describe("transmission à la prochaine équipe", () => {
  const SECRET = "secret-de-test";
  const D = "2026-11-26"; // jeudi
  const N = "2026-11-27"; // vendredi
  let zoe = "";
  let max = "";
  let jade = "";
  let t1 = "";
  const outbox = async (kind?: string) => (await q("select user_id, kind, who, detail, sent_at from public.push_outbox where ($1::text is null or kind = $1) order by id", [kind ?? null])).rows;
  const newT = async (title: string, owner = ids.lea) => (await q("insert into public.tasks (user_id, title, category, at_time, days) values ($1, $2, 'Autre', '15:00', '{0,1,2,3,4,5,6}') returning id", [owner, title])).rows[0]!.id as string;
  const send = async (who: string, task: string, to: string[] | null, extra = { date: D, target: D, team: "soir", msg: null as string | null }) =>
    (await as(who, () => q("select public.transfer_send($1, $2, $3::uuid[], $4, $5, $6) as r", [task, extra.date, to, extra.target, extra.team, extra.msg]))).rows[0]!.r as Record<string, unknown>;
  const respond = async (who: string, id: string, accept: boolean) => (await as(who, () => q("select public.transfer_respond($1, $2) as r", [id, accept]))).rows[0]!.r as Record<string, unknown>;
  const rows = async (task: string) => (await q("select id, to_user, status, group_id from public.task_transfers where task_id = $1 order by created_at, id", [task])).rows;
  const notices = async () => (await as(null, () => q("select public.push_notices($1) as r", [SECRET]))).rows[0]!.r as { outbox: { kind: string; user_id: string; who: string | null; title: string; detail: string | null }[] };

  beforeAll(async () => {
    zoe = await newUser("zoe@hb.fr", "Zoé");
    max = await newUser("max@hb.fr", "Max");
    jade = await newUser("jade@hb.fr", "Jade");
    // planning lun → dim : jeudi = 4e lettre
    await q("update public.settings set schedule = '---S---' where user_id in ($1, $2)", [zoe, max]); // Soir le jeudi
    await q("update public.settings set schedule = '---J---' where user_id = $1", [jade]); // Jour le jeudi
    await q("update public.settings set schedule = '----J--' where user_id = $1", [zoe]); // …puis Zoé : Jour le vendredi
    await q("update public.settings set schedule = '---SJ--' where user_id = $1", [zoe]);
    await q("update public.settings set schedule = '---S---' where user_id = $1", [ids.lea]);
    t1 = await newT("Faire la clôture");
    await q("delete from public.push_outbox");
  });

  it("la prochaine équipe = les collègues dont le planning indique cette équipe ce jour-là (prénoms seulement)", async () => {
    const soir = await as(ids.lea, () => q("select * from public.next_team_members($1, 'soir')", [D]));
    expect(soir.rows.map((r) => r.prenom).sort()).toEqual(["Max", "Zoé"]);
    expect(Object.keys(soir.rows[0]!).sort()).toEqual(["id", "prenom"]);
    expect((await as(ids.lea, () => q("select prenom from public.next_team_members($1, 'jour')", [D]))).rows.map((r) => r.prenom)).toEqual(["Jade"]);
    expect((await as(ids.lea, () => q("select prenom from public.next_team_members($1, 'jour')", [N]))).rows.map((r) => r.prenom)).toEqual(["Zoé"]); // Soir → équipe Jour du lendemain
    expect(await as(null, () => q("select * from public.next_team_members($1, 'soir')", [D]).then(() => false, () => true))).toBe(true); // refusé aux anonymes
  });

  it("transmettre à toute l'équipe : une demande par membre, notification « Prénom t'a transmis », la tâche est marquée transmise", async () => {
    const r = await send(ids.lea, t1, null, { date: D, target: D, team: "soir", msg: "Il manque 20 € de monnaie" });
    expect(r).toMatchObject({ ok: true, count: 2, whole_team: true });
    const rs = await rows(t1);
    expect(rs).toHaveLength(2);
    expect(new Set(rs.map((x) => x.group_id)).size).toBe(1);
    expect((await outbox("transfer")).map((o) => [o.user_id, o.who, o.detail]).sort()).toEqual([[zoe, "Léa B.", "Il manque 20 € de monnaie"], [max, "Léa B.", "Il manque 20 € de monnaie"]].sort());
    expect((await as(ids.lea, () => q("select public.my_status($1, $2) as r", [t1, D]))).rows[0]!.r).toMatchObject({ status: "handed", handed_to: "toute la prochaine équipe" });
  });

  it("interdits : retransmettre, tâche déjà faite, mauvaise date/équipe, collègue invalide, équipe vide, étranger", async () => {
    expect(await fails(() => send(ids.lea, t1, null))).toBe(true); // déjà transmise
    const done = await newT("Déjà faite");
    await q("insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3)", [done, D, ids.lea]);
    expect(await fails(() => send(ids.lea, done, [zoe]))).toBe(true);
    const t = await newT("Autre tâche");
    expect(await fails(() => send(ids.lea, t, [zoe], { date: D, target: "2026-11-29", team: "soir", msg: null }))).toBe(true); // trop loin
    expect(await fails(() => send(ids.lea, t, [zoe], { date: D, target: D, team: "nuit", msg: null }))).toBe(true);
    expect(await fails(() => send(ids.lea, t, [ids.boss]))).toBe(true); // un responsable n'est pas un caissier
    expect(await fails(() => send(ids.lea, t, [ids.lea]))).toBe(true); // soi-même
    expect(await fails(() => send(ids.lea, t, null, { date: D, target: N, team: "soir", msg: null }))).toBe(true); // personne en équipe Soir vendredi
    expect(await fails(() => send(ids.tom, t, [zoe]))).toBe(true); // Tom n'a aucun droit sur cette tâche
    expect((await rows(t))).toHaveLength(0);
  });

  it("le destinataire voit la tâche (et elle seule), ne peut ni la modifier ni agir tant qu'il n'a pas accepté", async () => {
    for (const u of [zoe, max]) {
      expect((await as(u, () => q("select title from public.tasks"))).rows.map((r) => r.title)).toContain("Faire la clôture");
      expect((await as(u, () => q("update public.tasks set title = 'x' where id = $1 returning id", [t1]))).rows).toHaveLength(0);
      expect(await fails(() => as(u, () => q("select public.occ_act($1, $2, 'seen')", [t1, D])))).toBe(true); // pas encore accepté
    }
    expect((await as(jade, () => q("select title from public.tasks"))).rows.map((r) => r.title)).not.toContain("Faire la clôture"); // l'équipe Jour ne la voit pas
    const mineOnly = await as(zoe, () => q("select to_prenom, from_prenom, status from public.transfers_overview('2026-11-01')"));
    expect(mineOnly.rows).toEqual([{ to_prenom: "Zoé", from_prenom: "Léa B.", status: "pending" }]); // elle ne voit pas la ligne de Max
    expect((await as(ids.lea, () => q("select * from public.transfers_overview('2026-11-01')"))).rows).toHaveLength(2); // l'expéditeur voit tout
    expect((await as(jade, () => q("select * from public.transfers_overview('2026-11-01')"))).rows).toHaveLength(0);
  });

  it("toute l'équipe : le premier qui accepte la prend, l'autre voit « Zoé la prend » ; un rappel est prévu au début de l'équipe", async () => {
    const [rz, rm] = [(await rows(t1)).find((x) => x.to_user === zoe)!, (await rows(t1)).find((x) => x.to_user === max)!];
    expect(await respond(zoe, rz.id as string, true)).toEqual({ ok: true });
    expect(await respond(max, rm.id as string, true)).toEqual({ ok: false, taken_by: "Zoé" });
    expect((await rows(t1)).map((x) => x.status).sort()).toEqual(["accepted", "closed"]);
    expect(await respond(max, rm.id as string, true)).toMatchObject({ ok: false, taken_by: "Zoé" }); // réponse déjà donnée
    const occ = (await q("select status, reason, service_date::text as d, postponed_until from public.task_occurrences where task_id = $1 and user_id = $2", [t1, zoe])).rows[0]!;
    expect(occ).toMatchObject({ status: "postponed", reason: "transfer", d: D });
    expect(await fails(() => respond(max, rz.id as string, true))).toBe(true); // ce n'est pas sa demande
    // Zoé peut maintenant agir ; Max et Jade non
    await as(zoe, () => q("select public.occ_act($1, $2, 'done')", [t1, D]));
    expect(await fails(() => as(max, () => q("insert into public.task_done (task_id, service_date, user_id) values ($1, $2, $3)", [t1, D, max])))).toBe(true);
    expect(await fails(() => as(jade, () => q("select public.occ_act($1, $2, 'done')", [t1, D])))).toBe(true);
    expect((await as(max, () => q("select public.my_status($1, $2) as r", [t1, D]))).rows[0]!.r).toMatchObject({ status: "todo" });
  });

  it("le rappel d'une tâche transmise part au début de l'équipe : « Prénom t'a transmis », avec le prénom de l'expéditeur", async () => {
    const t = await newT("À reprendre au début du service");
    await send(ids.lea, t, [zoe], { date: "2027-03-10", target: "2027-03-10", team: "soir", msg: null });
    await respond(zoe, (await rows(t))[0]!.id as string, true);
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/zoe', 'k', 'a') on conflict do nothing", [zoe]);
    const fu = async () => (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { postponed: { title: string; why: string; who: string; user_id: string }[] };
    expect((await fu()).postponed.some((x) => x.title === "À reprendre au début du service")).toBe(false); // l'équipe n'a pas commencé
    await q("update public.task_occurrences set postponed_until = now() - interval '1 minute' where task_id = $1", [t]);
    expect((await fu()).postponed.find((x) => x.title === "À reprendre au début du service")).toMatchObject({ why: "transfer", who: "Léa B.", user_id: zoe });
    expect((await fu()).postponed.some((x) => x.title === "À reprendre au début du service")).toBe(false); // une seule fois
  });

  it("heure de début de l'équipe Soir = relève du collègue, à l'heure de Paris (heure d'hiver : 18h30 = 17h30 UTC)", async () => {
    const t = await newT("Test heure");
    await send(ids.lea, t, [zoe], { date: "2027-02-10", target: "2027-02-10", team: "soir", msg: null });
    const rz = (await rows(t))[0]!;
    await respond(zoe, rz.id as string, true);
    const at = (await q("select to_char(postponed_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as u from public.task_occurrences where task_id = $1", [t])).rows[0]!.u;
    expect(at).toBe("2027-02-10 17:30"); // 18h30 à Paris en hiver
    const t2 = await newT("Test heure été");
    await send(ids.lea, t2, [zoe], { date: "2027-07-10", target: "2027-07-10", team: "soir", msg: null });
    await respond(zoe, (await rows(t2))[0]!.id as string, true);
    expect((await q("select to_char(postponed_until at time zone 'UTC', 'YYYY-MM-DD HH24:MI') as u from public.task_occurrences where task_id = $1", [t2])).rows[0]!.u).toBe("2027-07-10 16:30"); // 18h30 à Paris en été
  });

  it("refus : l'expéditeur est prévenu « Zoé a refusé », la tâche lui revient et il peut la retransmettre", async () => {
    const t = await newT("Ranger la réserve");
    await send(ids.lea, t, [zoe]);
    await q("delete from public.push_outbox");
    const r = (await rows(t))[0]!;
    expect(await respond(zoe, r.id as string, false)).toEqual({ ok: true });
    expect((await outbox("transfer_declined"))).toEqual([expect.objectContaining({ user_id: ids.lea, who: "Zoé" })]);
    expect((await as(ids.lea, () => q("select public.my_status($1, $2) as r", [t, D]))).rows[0]!.r).toMatchObject({ status: "todo" });
    expect(await respond(zoe, r.id as string, true)).toMatchObject({ ok: false, state: "declined" });
    expect(await send(ids.lea, t, [max])).toMatchObject({ ok: true }); // retransmettre à quelqu'un d'autre
  });

  it("toute l'équipe : un seul message à l'expéditeur, quand le DERNIER a refusé", async () => {
    const t = await newT("Nettoyer la vitrine");
    await send(ids.lea, t, null);
    await q("delete from public.push_outbox");
    const [a, b] = await rows(t);
    await respond(a!.to_user as string, a!.id as string, false);
    expect(await outbox("transfer_declined")).toHaveLength(0); // l'autre peut encore accepter
    await respond(b!.to_user as string, b!.id as string, false);
    expect(await outbox("transfer_declined")).toEqual([expect.objectContaining({ user_id: ids.lea, who: null })]); // « la prochaine équipe a refusé »
  });

  it("pas de réponse dans le délai (réglable) : clôturée, l'expéditeur est prévenu UNE fois", async () => {
    const t = await newT("Sans réponse");
    await send(ids.lea, t, [zoe]);
    await notices(); // vide la boîte (message « t'a transmis »)
    expect((await rows(t))[0]!.status).toBe("pending");
    const cfg = (await q("select value from public.app_config where key = 'transfer_timeout_min'")).rows[0]!.value;
    expect(cfg).toBe(60);
    await q("update public.task_transfers set expires_at = now() + interval '5 minutes' where task_id = $1", [t]);
    expect((await notices()).outbox.filter((o) => o.kind === "transfer_expired")).toHaveLength(0); // pas encore
    await q("update public.task_transfers set expires_at = now() - interval '1 minute' where task_id = $1", [t]);
    const n = await notices();
    expect(n.outbox.filter((o) => o.kind === "transfer_expired")).toEqual([expect.objectContaining({ user_id: ids.lea, who: "Zoé", title: "Sans réponse" })]);
    expect((await notices()).outbox.filter((o) => o.kind === "transfer_expired")).toHaveLength(0); // une seule fois
    expect((await rows(t))[0]!.status).toBe("expired");
    expect((await as(ids.lea, () => q("select public.my_status($1, $2) as r", [t, D]))).rows[0]!.r).toMatchObject({ status: "todo" });
    expect(await respond(zoe, (await rows(t))[0]!.id as string, true)).toMatchObject({ ok: false, state: "expired" });
  });

  it("la boîte d'envoi ne renvoie jamais deux fois la même notification", async () => {
    const t = await newT("Une seule notif");
    await send(ids.lea, t, [zoe]);
    const a = (await notices()).outbox.filter((o) => o.title === "Une seule notif");
    expect(a).toEqual([expect.objectContaining({ kind: "transfer", user_id: zoe, who: "Léa B." })]);
    expect((await notices()).outbox.filter((o) => o.title === "Une seule notif")).toHaveLength(0);
  });

  it("accepter puis refuser : la tâche retourne à l'expéditeur, prévenu ; « fait » côté expéditeur ferme une demande en attente", async () => {
    const t = await newT("Accepter puis refuser");
    await send(ids.lea, t, [zoe]);
    await respond(zoe, (await rows(t))[0]!.id as string, true);
    await q("delete from public.push_outbox");
    await as(zoe, () => q("select public.occ_act($1, $2, 'decline')", [t, D]));
    expect((await rows(t))[0]!.status).toBe("declined");
    expect(await outbox("declined")).toHaveLength(0); // pas de double message
    expect(await outbox("transfer_declined")).toEqual([expect.objectContaining({ user_id: ids.lea, who: "Zoé" })]);
    const t2 = await newT("Faite par moi finalement");
    await send(ids.lea, t2, [max]);
    await as(ids.lea, () => q("select public.occ_act($1, $2, 'done')", [t2, D]));
    expect((await rows(t2))[0]!.status).toBe("closed");
    expect((await as(ids.lea, () => q("select public.my_status($1, $2) as r", [t2, D]))).rows[0]!.r).toMatchObject({ status: "done" });
  });

  it("le planificateur reçoit les tâches acceptées (transfers_in), les issues, et les réglages du bilan", async () => {
    const t = await newT("Pour le planificateur");
    await send(ids.lea, t, [zoe]);
    await respond(zoe, (await rows(t))[0]!.id as string, true);
    const d = (await as(null, () => q("select public.push_tick_data($1, $2::date[]) as d", [SECRET, [D]]))).rows[0]!.d as { transfers_in: { title: string; for_user: string; target_date: string }[]; outcomes: { status: string }[]; settings: { user_id: string; handover_min: number; bilan_lead_min: number }[] };
    expect(d.transfers_in.find((x) => x.title === "Pour le planificateur")).toMatchObject({ for_user: zoe, target_date: D });
    expect(d.outcomes.some((o) => o.status === "handed")).toBe(true);
    expect(d.settings.find((s) => s.user_id === zoe)).toMatchObject({ handover_min: 1110, bilan_lead_min: 15 });
  });
});

describe("bilan de fin de service", () => {
  const SECRET = "secret-de-test";
  const D = "2026-11-26";
  const claim = async (user: string, team = "soir", remaining = 3) => (await as(null, () => q("select public.push_bilan_claim($1, $2, $3, $4, $5) as ok", [SECRET, user, D, team, remaining]))).rows[0]!.ok;
  const reminders = async () => (await as(null, () => q("select public.push_bilan_reminders($1) as r", [SECRET]))).rows[0]!.r as { user_id: string; team: string }[];

  it("verrou : un seul bilan par personne, journée et équipe", async () => {
    expect(await claim(ids.tom)).toBe(true);
    expect(await claim(ids.tom)).toBe(false);
    expect(await claim(ids.tom, "jour")).toBe(true); // une autre équipe, un autre bilan
    expect(await claim(ids.lea)).toBe(true);
  });

  it("second rappel : 10 minutes plus tard seulement, une seule fois, jamais si le bilan a été ouvert", async () => {
    expect(await reminders()).toHaveLength(0); // trop tôt
    await q("update public.service_reports set sent_at = now() - interval '11 minutes'");
    await as(ids.lea, () => q("select public.bilan_open($1)", [D])); // Léa ouvre son bilan
    const r = await reminders();
    expect(r.map((x) => x.user_id).sort()).toEqual([ids.tom, ids.tom].sort()); // Tom (soir et jour), pas Léa
    expect(await reminders()).toHaveLength(0); // jamais un troisième message
  });

  it("on ne peut ouvrir que son propre bilan", async () => {
    await claim(ids.boss, "soir");
    await as(ids.lea, () => q("select public.bilan_open($1)", [D]));
    expect((await q("select opened_at from public.service_reports where user_id = $1", [ids.boss])).rows[0]!.opened_at).toBeNull();
  });

  it("réglage « bilan X minutes avant la fin » : 15 par défaut, entre 0 et 120", async () => {
    expect((await q("select bilan_lead_min from public.settings where user_id = $1", [ids.lea])).rows[0]!.bilan_lead_min).toBe(15);
    await as(ids.lea, () => q("update public.settings set bilan_lead_min = 30 where user_id = $1", [ids.lea]));
    expect((await q("select bilan_lead_min from public.settings where user_id = $1", [ids.lea])).rows[0]!.bilan_lead_min).toBe(30);
    expect(await fails(() => as(ids.lea, () => q("update public.settings set bilan_lead_min = 500 where user_id = $1", [ids.lea])))).toBe(true);
  });

  it("les fonctions du planificateur refusent un mauvais secret ; les tables sont fermées", async () => {
    expect(await fails(() => as(null, () => q("select public.push_bilan_reminders('mauvais')")))).toBe(true);
    expect(await fails(() => as(null, () => q("select public.push_bilan_claim('mauvais', $1, $2, 'soir', 1)", [ids.lea, D])))).toBe(true);
    for (const t of ["service_reports", "task_transfers", "push_outbox", "task_events", "task_outcomes"]) {
      expect(await fails(() => as(ids.lea, () => q(`select * from public.${t}`)))).toBe(true);
    }
  });
});

// =============================================================================================
//  MODE TEST (responsable seulement)
// =============================================================================================
describe("mode test : accès, isolation des données de test, garde-fous", () => {
  const SECRET = "secret-de-test";
  const D = "2026-11-26";
  let tester = ""; // compte de test désigné
  let tt = ""; // tâche de test du responsable
  const call = (who: string | null, sql: string, params: unknown[] = []) => as(who, () => q(sql, params));
  const json = async (who: string, sql: string, params: unknown[] = []) => (await call(who, sql, params)).rows[0]!.r as Record<string, unknown>;
  const mkTest = async (title: string, owner = ids.boss) => (await q("insert into public.tasks (user_id, title, category, at_time, days, is_test) values ($1, $2, 'Autre', '12:00', '{0,1,2,3,4,5,6}', true) returning id", [owner, title])).rows[0]!.id as string;

  beforeAll(async () => {
    tester = await newUser("testeur@hb.fr", "Testeur");
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/boss', 'k', 'a'), ($2, 'https://push/testeur', 'k', 'a') on conflict do nothing", [ids.boss, tester]);
    tt = await mkTest("Tâche de test");
  });

  it("un caissier (ou un anonyme) ne peut appeler AUCUNE fonction de test : refus côté base", async () => {
    const calls = [
      "select public.test_status()", "select * from public.test_target_subs('self')", "select public.test_cleanup()", "select public.test_clear_anomalies()", "select public.test_scan()",
      "select public.test_notices()", "select public.test_followups(30)", "select public.test_as('tasks')", "select public.test_set_account('tom@hb.fr')",
      "select * from public.test_anomalies(10)", "select public.test_log('x', 'y')",
    ];
    for (const sql of calls) {
      expect(await fails(() => call(ids.lea, sql)), `caissier : ${sql}`).toBe(true);
      expect(await fails(() => call(null, sql)), `anonyme : ${sql}`).toBe(true);
    }
    expect(await fails(() => call(ids.lea, "select public.test_inspect($1)", [tt]))).toBe(true);
    expect(await fails(() => call(ids.lea, "select public.test_age($1, 10)", [tt]))).toBe(true);
    expect(await fails(() => call(ids.lea, "select public.test_sim_occurrence($1, $2, $3)", [tt, ids.lea, D]))).toBe(true);
    // une erreur « réservé au responsable » et pas autre chose
    await call(ids.lea, "select public.test_status()").catch((e: { code?: string; message: string }) => expect(e.message).toMatch(/réservé au responsable|permission/));
  });

  it("le responsable y a accès", async () => {
    const st = await json(ids.boss, "select public.test_status() as r");
    expect(st).toMatchObject({ test_user: null, test_tasks: 1 });
    expect(Object.keys(st).sort()).toEqual(["anomalies", "pending", "planner", "server_now", "subs", "test_tasks", "test_user"]);
  });

  it("les tables du mode test sont fermées à tous (même au responsable) : on passe par les fonctions", async () => {
    for (const t of ["test_config", "planner_state", "anomalies"]) {
      expect(await fails(() => call(ids.boss, `select * from public.${t}`)), t).toBe(true);
      expect(await fails(() => call(ids.lea, `select * from public.${t}`)), t).toBe(true);
    }
  });

  it("seul un responsable peut créer une tâche de test ; is_test n'est pas modifiable ensuite", async () => {
    expect(await fails(() => call(ids.lea, "insert into public.tasks (user_id, title, category, at_time, days, is_test) values ($1, 'Piratage', 'Autre', '12:00', '{0}', true)", [ids.lea]))).toBe(true);
    await call(ids.boss, "insert into public.tasks (user_id, title, category, at_time, days, is_test) values ($1, 'Test du responsable', 'Autre', '12:00', '{0}', true)", [ids.boss]);
    expect(await fails(() => call(ids.boss, "update public.tasks set is_test = false where id = $1", [tt]))).toBe(true);
    expect(await fails(() => call(ids.lea, "update public.tasks set is_test = true where user_id = $1", [ids.lea]))).toBe(true);
  });

  it("désigner le compte de test : caissier existant seulement, jamais soi-même ni un inconnu ; retirable", async () => {
    expect(await fails(() => call(ids.boss, "select public.test_set_account('inconnu@hb.fr')"))).toBe(true);
    expect(await fails(() => call(ids.boss, "select public.test_set_account('boss@hb.fr')"))).toBe(true); // soi-même (et responsable)
    expect(await fails(() => call(ids.boss, "select * from public.test_target_subs('test')"))).toBe(true); // personne de désigné
    const r = await json(ids.boss, "select public.test_set_account('testeur@hb.fr') as r");
    expect(r).toMatchObject({ ok: true, test_user: { prenom: "Testeur" } });
    expect((await json(ids.boss, "select public.test_status() as r")).test_user).toMatchObject({ prenom: "Testeur" });
  });

  it("les notifications de test ne peuvent partir que vers MES appareils ou ceux du compte de test", async () => {
    expect((await call(ids.boss, "select endpoint from public.test_target_subs('self')")).rows).toEqual([{ endpoint: "https://push/boss" }]);
    expect((await call(ids.boss, "select endpoint from public.test_target_subs('test')")).rows).toEqual([{ endpoint: "https://push/testeur" }]);
    expect(await fails(() => call(ids.boss, "select * from public.test_target_subs('lea')"))).toBe(true);
    expect(await fails(() => call(ids.boss, "select * from public.test_target_subs($1)", [ids.lea]))).toBe(true);
  });

  it("une tâche de test ne se partage / transmet qu'au compte de test : jamais un vrai collègue", async () => {
    expect(await fails(() => call(ids.boss, "select public.share_task($1, $2::uuid[], 'each')", [tt, [ids.lea]]))).toBe(true); // Léa est un vrai caissier
    expect(await fails(() => call(ids.boss, "select public.share_task($1, $2::uuid[], 'each')", [tt, [ids.lea, tester]]))).toBe(true);
    await call(ids.boss, "select public.share_task($1, $2::uuid[], 'each')", [tt, [tester]]); // OK
    expect(await fails(() => call(ids.boss, "select public.transfer_send($1, $2, $3::uuid[], $4, 'soir', null)", [tt, D, [ids.lea], D]))).toBe(true);
    await q("update public.settings set schedule = '---S---' where user_id in ($1, $2)", [tester, ids.lea]); // Léa ET le testeur sont Soir le jeudi
    const r = await json(ids.boss, "select public.transfer_send($1, $2, null, $3, 'soir', 'test') as r", [tt, D, D]); // toute l'équipe → seulement le testeur
    expect(r).toMatchObject({ ok: true, count: 1, whole_team: true });
    expect((await q("select to_user from public.task_transfers where task_id = $1", [tt])).rows).toEqual([{ to_user: tester }]);
  });

  it("visibilité : le compte de test voit la tâche partagée ; aucun autre caissier ne la voit, même si une ligne de partage existait", async () => {
    expect((await call(tester, "select title from public.tasks where id = $1", [tt])).rows).toHaveLength(1);
    expect((await call(ids.lea, "select title from public.tasks where id = $1", [tt])).rows).toHaveLength(0);
    await q("insert into public.task_shares (task_id, recipient_id, status) values ($1, $2, 'accepted')", [tt, ids.lea]); // contournement direct de la base
    expect((await call(ids.lea, "select title from public.tasks where id = $1", [tt])).rows).toHaveLength(0); // la règle RLS bloque quand même
    expect(await call(ids.lea, "select * from public.shared_with_me()").then((r) => r.rows.filter((x) => x.task_id === tt).length)).toBe(1); // (la liste des partages existe, la tâche reste illisible)
    await q("delete from public.task_shares where recipient_id = $1 and task_id = $2", [ids.lea, tt]);
    expect(await fails(() => call(ids.lea, "select public.my_status($1, $2)", [tt, D]))).toBe(true); // et aucune fonction ne lui en révèle le contenu
  });

  it("le VRAI planificateur ignore toute donnée de test (tâches, relances, notifications)", async () => {
    const d = (await as(null, () => q("select public.push_tick_data($1, $2::date[]) as d", [SECRET, [D]]))).rows[0]!.d as { tasks: { id: string }[]; transfers_in: { id: string }[] };
    expect(d.tasks.some((t) => t.id === tt)).toBe(false);
    expect(d.transfers_in.some((t) => t.id === tt)).toBe(false);
    await as(null, () => q("select public.push_notices($1)", [SECRET])); // le vrai planificateur vide SA boîte
    const test = await json(ids.boss, "select public.test_notices() as r");
    const out = test.outbox as { kind: string; user_id: string; title: string }[];
    expect(out.some((o) => o.kind === "transfer" && o.user_id === tester && o.title === "Tâche de test")).toBe(true); // …et les notifications de test sont restées pour le test
    expect((await json(ids.boss, "select public.test_notices() as r")).outbox).toEqual([]); // une seule fois
    expect((await q("select is_test from public.push_outbox where task_id = $1", [tt])).rows.every((r) => r.is_test === true)).toBe(true); // marquées test
  });

  it("relance accélérée (30 s) sur les tâches de test seulement ; la vraie relance (5 min) n'y touche pas", async () => {
    const t = await mkTest("Relance test");
    const real = (await q("insert into public.tasks (user_id, title, category, at_time, days) values ($1, 'Vraie tâche', 'Autre', '12:00', '{0,1,2,3,4,5,6}') returning id", [ids.lea])).rows[0]!.id as string;
    await q("insert into public.push_subscriptions (user_id, endpoint, p256dh, auth_key) values ($1, 'https://push/lea', 'k', 'a') on conflict do nothing", [ids.lea]);
    await json(ids.boss, "select public.test_sim_occurrence($1, $2, $3) as r", [t, ids.boss, D]);
    await as(null, () => q("select public.push_claim($1, $2, $3, $4, '2026-11-26T11:00:00Z')", [SECRET, ids.lea, real, D]));
    const fu = (delay: number) => json(ids.boss, "select public.test_followups($1) as r", [delay]);
    expect(((await fu(30)).relances as unknown[]).length).toBe(0); // pas encore 30 s
    await call(ids.boss, "select public.test_age($1, 31)", [t]);
    await q("update public.task_occurrences set last_sent_at = now() - interval '10 minutes' where task_id = $1", [real]);
    const r1 = (await fu(30)).relances as { n: number; title: string }[];
    expect(r1).toEqual([expect.objectContaining({ n: 1, title: "Relance test" })]); // la vraie tâche de Léa n'est PAS touchée
    expect((await q("select reminders from public.task_occurrences where task_id = $1", [real])).rows[0]!.reminders).toBe(0);
    await call(ids.boss, "select public.test_age($1, 31)", [t]);
    expect(((await fu(30)).relances as { n: number }[])[0]!.n).toBe(2);
    await call(ids.boss, "select public.occ_act($1, $2, 'seen')", [t, D]); // je réagis : la relance s'arrête
    await call(ids.boss, "select public.test_age($1, 31)", [t]);
    expect(((await fu(30)).relances as unknown[]).length).toBe(0);
    const real1 = (await as(null, () => q("select public.push_followups($1) as r", [SECRET]))).rows[0]!.r as { relances: { title: string }[] };
    expect(real1.relances.map((x) => x.title)).toEqual(["Vraie tâche"]); // le vrai planificateur ne relance que le vrai
  });

  it("verrou anti-doublon : le même créneau réservé deux fois est refusé", async () => {
    const t = await mkTest("Verrou");
    const claim = async () => (await json(ids.boss, "select public.test_claim($1, $2, $3, '2026-11-26T12:00:00Z') as r", [t, ids.boss, D])) as unknown as boolean;
    expect(await claim()).toBe(true);
    expect(await claim()).toBe(false);
    expect(await fails(() => call(ids.boss, "select public.test_claim($1, $2, $3, now())", [t, ids.lea, D]))).toBe(true); // jamais pour un vrai collègue
  });

  it("agir comme le compte de test : seulement lui, seulement sur des tâches de test, et l'identité est restituée", async () => {
    const t = await mkTest("Pour le testeur");
    await call(ids.boss, "select public.share_task($1, $2::uuid[], 'one')", [t, [tester]]);
    const tasks = (await json(ids.boss, "select public.test_as('tasks') as r")) as unknown as { id: string }[];
    expect(tasks.map((x) => x.id)).toContain(t);
    const leaTask = (await q("select id from public.tasks where user_id = $1 limit 1", [ids.lea])).rows[0]!.id as string;
    expect(tasks.map((x) => x.id)).not.toContain(leaTask); // le testeur ne voit pas les tâches des autres
    await call(ids.boss, "select public.test_as('respond_share', $1::jsonb)", [JSON.stringify({ task: t, accept: true })]);
    expect((await q("select status from public.task_shares where task_id = $1 and recipient_id = $2", [t, tester])).rows[0]!.status).toBe("accepted");
    const taken = await json(ids.boss, "select public.test_as('occ_act', $1::jsonb) as r", [JSON.stringify({ task: t, date: D, action: "taken" })]);
    expect(taken).toEqual({ ok: true });
    expect(await json(ids.boss, "select public.occ_act($1, $2, 'taken') as r", [t, D])).toEqual({ ok: false, taken_by: "Testeur" }); // le responsable arrive deuxième
    expect((await call(ids.boss, "select auth.uid() as u")).rows[0]!.u).toBe(ids.boss); // identité restituée
    // garde-fous
    const realTask = (await q("select id from public.tasks where not is_test limit 1")).rows[0]!.id as string;
    expect(await fails(() => call(ids.boss, "select public.test_as('occ_act', $1::jsonb)", [JSON.stringify({ task: realTask, date: D, action: "done" })]))).toBe(true);
    expect(await fails(() => call(ids.boss, "select public.test_as('delete_everything')"))).toBe(true);
    expect(await fails(() => call(ids.boss, "select public.test_as('occ_act', $1::jsonb)", [JSON.stringify({ task: t, date: D, action: "supprimer" })]))).toBe(true);
  });

  it("inspection d'une tâche de test uniquement", async () => {
    const info = await json(ids.boss, "select public.test_inspect($1) as r", [tt]);
    expect(Object.keys(info).sort()).toEqual(["claims", "done", "events", "occurrences", "outbox", "outcomes", "shares", "transfers"]);
    const realTask = (await q("select id from public.tasks where not is_test limit 1")).rows[0]!.id as string;
    expect(await fails(() => call(ids.boss, "select public.test_inspect($1)", [realTask]))).toBe(true);
  });

  it("anomalies : le planificateur les écrit (avec le secret), le responsable les lit, copie et efface", async () => {
    await as(null, () => q("select public.push_log_anomaly($1, 'push_error', $2, 'envoi échoué (HTTP 500)')", [SECRET, ids.lea]));
    expect(await fails(() => as(null, () => q("select public.push_log_anomaly('mauvais', 'x', null, 'y')")))).toBe(true);
    await call(ids.boss, "select public.test_log('doublon', 'rappel envoyé deux fois')");
    const list = (await call(ids.boss, "select prenom, kind, detail, is_test from public.test_anomalies(10)")).rows;
    expect(list.find((x) => x.kind === "push_error")).toMatchObject({ prenom: "Léa B.", detail: "envoi échoué (HTTP 500)", is_test: false });
    expect(list.find((x) => x.kind === "doublon")).toMatchObject({ prenom: "Sam", is_test: true });
    expect(await fails(() => call(ids.lea, "select * from public.test_anomalies(10)"))).toBe(true);
    expect(await call(ids.boss, "select public.test_clear_anomalies() as n").then((r) => r.rows[0]!.n)).toBeGreaterThanOrEqual(2);
    expect((await call(ids.boss, "select * from public.test_anomalies(10)")).rows).toHaveLength(0);
  });

  it("état du planificateur : passage, résultat, compteurs ; refusé sans le secret", async () => {
    await as(null, () => q("select public.push_heartbeat($1, '{\"sent\":3}'::jsonb, null, 3, 1)", [SECRET]));
    await as(null, () => q("select public.push_heartbeat($1, null, 'échec réseau', 0, 2)", [SECRET]));
    expect(await fails(() => as(null, () => q("select public.push_heartbeat('mauvais', null, null, 1, 1)")))).toBe(true);
    const p = (await json(ids.boss, "select public.test_status() as r")).planner as Record<string, unknown>;
    expect(p).toMatchObject({ runs: 2, sent_total: 3, failed_total: 3, last_error: "échec réseau" });
    expect(p.last_run_at).toBeTruthy();
    expect(p.last_ok_at).toBeTruthy();
  });

  it("détection d'incohérences : transmission sans statut, notification bloquée… (sans doublon sur 1 h)", async () => {
    const t = (await q("insert into public.tasks (user_id, title, category, at_time, days) values ($1, 'Incohérente', 'Autre', '12:00', '{0}') returning id", [ids.lea])).rows[0]!.id as string;
    await q("insert into public.task_outcomes (task_id, user_id, service_date, status) values ($1, $2, $3, 'handed')", [t, ids.lea, D]);
    await q("insert into public.push_outbox (user_id, kind, task_id, service_date, created_at) values ($1, 'declined', $2, $3, now() - interval '30 minutes')", [ids.lea, t, D]);
    const found = (await json(ids.boss, "select public.test_scan() as r")) as unknown as { kind: string }[];
    expect(found.map((f) => f.kind).sort()).toEqual(expect.arrayContaining(["notification_bloquee", "transmission_sans_statut"]));
    const n1 = (await call(ids.boss, "select count(*)::int as n from public.test_anomalies(100)")).rows[0]!.n as number;
    await call(ids.boss, "select public.test_scan()");
    expect((await call(ids.boss, "select count(*)::int as n from public.test_anomalies(100)")).rows[0]!.n).toBe(n1); // pas de doublon
    expect(await fails(() => call(ids.lea, "select public.test_scan()"))).toBe(true);
  });

  it("« Nettoyer les données de test » : supprime les tâches de test et ce qui en dépend, jamais les vraies", async () => {
    const before = (await q("select count(*)::int as n from public.tasks where not is_test")).rows[0]!.n as number;
    expect((await q("select count(*)::int as n from public.task_events e join public.tasks t on t.id = e.task_id where t.is_test")).rows[0]!.n).toBeGreaterThan(0);
    const r = await json(ids.boss, "select public.test_cleanup() as r");
    expect((r as { tasks: number }).tasks).toBeGreaterThanOrEqual(5);
    expect((await q("select count(*)::int as n from public.tasks where is_test")).rows[0]!.n).toBe(0);
    expect((await q("select count(*)::int as n from public.tasks where not is_test")).rows[0]!.n).toBe(before);
    for (const t of ["task_shares", "task_transfers", "task_occurrences", "task_events"]) {
      expect((await q(`select count(*)::int as n from public.${t} x where not exists (select 1 from public.tasks t where t.id = x.task_id)`)).rows[0]!.n, t).toBe(0);
    }
    expect(await fails(() => call(ids.lea, "select public.test_cleanup()"))).toBe(true);
  });
});
