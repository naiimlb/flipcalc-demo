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
