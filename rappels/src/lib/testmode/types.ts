import type { SupabaseClient } from "@supabase/supabase-js";

// Mode test (réservé au responsable) : types communs.
export type Check = { label: string; expected: string; got: string; ok: boolean };
export type Outcome = { status: "ok" | "ko" | "skip"; detail: string; checks?: Check[] };
export type TestResult = Outcome & { id: string; ms: number };
export type PushItem = { title: string; body: string; url: string; tag?: string };
export type PushResponse = { ok: boolean; sent?: number; failed?: number; devices?: number; error?: string };

export type Ctx = {
  /** Client Supabase du responsable connecté. */
  sb: SupabaseClient;
  uid: string;
  prenom: string;
  /** Horloge SIMULÉE (tests seulement) : l'heure réelle tant qu'aucune heure n'est choisie. */
  now: () => Date;
  /** Délai accéléré des relances, en secondes (30 par défaut au lieu de 5 minutes). */
  accelSeconds: number;
  /** Pas du planificateur simulé, en secondes (le vrai passe chaque minute). */
  stepSeconds: number;
  /** Envoyer aussi les notifications produites par les tests sur MES appareils. */
  pushToDevice: boolean;
  /** Compte de test désigné (null : aucun). */
  testUser: { id: string; prenom: string } | null;
  push: (target: "self" | "test", items: PushItem[]) => Promise<PushResponse>;
  /** Progression d'un test interactif (texte affiché sous le bouton). */
  say: (text: string) => void;
};

export type TestDef = {
  id: string;
  n: number;
  title: string;
  hint: string;
  /** Nécessite une action humaine (toucher une notification) : « non testé » dans « Lancer tous les tests ». */
  manual?: boolean;
  needsTestUser?: boolean;
  run: (ctx: Ctx) => Promise<Outcome>;
};

export const check = (label: string, expected: unknown, got: unknown, ok?: boolean): Check => {
  const e = typeof expected === "string" ? expected : JSON.stringify(expected);
  const g = typeof got === "string" ? got : JSON.stringify(got);
  return { label, expected: e, got: g, ok: ok ?? e === g };
};

/** Résultat d'après une liste de vérifications : KO si une seule échoue, avec la première en détail. */
export function verdict(checks: Check[], okText: string): Outcome {
  const bad = checks.filter((c) => !c.ok);
  if (bad.length === 0) return { status: "ok", detail: okText, checks };
  return { status: "ko", detail: `${bad.length} vérification${bad.length > 1 ? "s" : ""} en échec : ${bad[0]!.label} (attendu ${bad[0]!.expected}, obtenu ${bad[0]!.got})`, checks };
}

export const skip = (detail: string): Outcome => ({ status: "skip", detail });
export const ko = (detail: string, checks?: Check[]): Outcome => ({ status: "ko", detail, checks });

/** Message lisible d'une erreur inconnue. */
export const errText = (e: unknown): string => (e instanceof Error ? e.message : typeof e === "object" && e && "message" in e ? String((e as { message: unknown }).message) : String(e));
