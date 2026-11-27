import { clickTest, guarded, testBilan, testDetailPage, testNotification, testPostpone, testRelance, testSession, testSharing, testTransfer } from "./suite-db";
import { testCalculator, testClock, testRepeated, testServiceDay } from "./suite-pure";
import { skip, type Ctx, type TestDef, type TestResult } from "./types";

// Les 13 tests, dans l'ordre. Les tests « manuels » (toucher une notification) ne sont pas lancés par « Lancer tous les tests ».
export const TESTS: TestDef[] = [
  { id: "notif", n: 1, title: "Notification de test", hint: "Envoie une notification à cet appareil.", run: (c) => guarded(() => testNotification(c)) },
  { id: "click-closed", n: 2, title: "Ouverture au clic : app fermée", hint: "Envoie la notification d'une tâche de test ; appuie dessus app fermée.", manual: true, run: (c) => guarded(() => clickTest("closed")(c)) },
  { id: "click-background", n: 2, title: "Ouverture au clic : arrière-plan", hint: "Idem, app en arrière-plan.", manual: true, run: (c) => guarded(() => clickTest("background")(c)) },
  { id: "click-open", n: 2, title: "Ouverture au clic : app ouverte", hint: "Idem, app ouverte à l'écran.", manual: true, run: (c) => guarded(() => clickTest("open")(c)) },
  { id: "detail", n: 3, title: "Page détail : Fait, Plus tard, Refuser", hint: "Crée une tâche de test et vérifie les statuts en base.", run: (c) => guarded(() => testDetailPage(c)) },
  { id: "relance", n: 4, title: "Relance automatique (accélérée)", hint: "Relances sans attendre 5 min ; arrêt dès que j'agis.", run: (c) => guarded(() => testRelance(c)) },
  { id: "repeat", n: 5, title: "Rappel répété (sans doublon ni oubli)", hint: "Série « toutes les 30 min » rejouée par le planificateur.", run: (c) => guarded(() => testRepeated(c)) },
  { id: "postpone", n: 6, title: "Rappel plus tard : 10 / 15 / 30 / 60 min", hint: "Report accéléré, relance suspendue pendant le délai.", run: (c) => guarded(() => testPostpone(c)) },
  { id: "share", n: 7, title: "Partage (2 modes) vers le compte de test", hint: "Chacun la fait / Un seul s'en occupe.", needsTestUser: true, run: (c) => guarded(() => testSharing(c)) },
  { id: "bilan", n: 8, title: "Bilan de fin de service", hint: "Bilan immédiat, transmettre, laisser tomber (groupé).", run: (c) => guarded(() => testBilan(c)) },
  { id: "transfer", n: 9, title: "Transmission au prochain caissier", hint: "Arrivée, acceptation, refus, sans réponse.", needsTestUser: true, run: (c) => guarded(() => testTransfer(c)) },
  { id: "calc", n: 10, title: "Calculette de caisse", hint: "Quantités connues, totaux calculés en centimes.", run: () => guarded(testCalculator) },
  { id: "service", n: 11, title: "Journée de service 11h–2h", hint: "Minuit, relèves, heure d'été et d'hiver.", run: (c) => guarded(() => testServiceDay(c)) },
  { id: "session", n: 12, title: "Session persistante", hint: "Session valide, refresh du jeton, expiration.", run: (c) => guarded(() => testSession(c)) },
  { id: "clock", n: 13, title: "Simulateur d'horloge", hint: "Déclenche une fin de service à l'heure simulée.", run: (c) => guarded(() => testClock(c)) },
];

export type RunState = Record<string, TestResult | "running">;

/** Lance un test et mesure sa durée. */
export async function runOne(def: TestDef, ctx: Ctx): Promise<TestResult> {
  if (def.needsTestUser && !ctx.testUser) return { id: def.id, ms: 0, ...skip("Désigne d'abord un compte de test.") };
  const t0 = Date.now();
  const out = await def.run(ctx);
  return { id: def.id, ms: Date.now() - t0, ...out };
}

/** « Lancer tous les tests » : dans l'ordre, les tests automatisables ; les manuels restent « non testé ». */
export async function runAll(ctx: Ctx, onUpdate: (id: string, r: TestResult | "running") => void): Promise<TestResult[]> {
  const results: TestResult[] = [];
  for (const def of TESTS) {
    if (def.manual) {
      const r: TestResult = { id: def.id, ms: 0, ...skip("Test manuel : lance-le avec son bouton (il faut toucher la notification).") };
      results.push(r);
      onUpdate(def.id, r);
      continue;
    }
    onUpdate(def.id, "running");
    const r = await runOne(def, ctx);
    results.push(r);
    onUpdate(def.id, r);
  }
  return results;
}

const LABEL = { ok: "OK", ko: "KO", skip: "NON TESTÉ" } as const;

/** Rapport texte à copier-coller pour corriger les anomalies. */
export function buildReport(args: {
  who: string;
  nowIso: string;
  commit?: string | null;
  diagnostics: { label: string; level: string; detail: string }[];
  results: TestResult[];
  anomalies: { at: string; prenom: string | null; kind: string; detail: string | null; is_test: boolean }[];
  clock: string | null;
}): string {
  const lines: string[] = [];
  const nOk = args.results.filter((r) => r.status === "ok").length;
  const nKo = args.results.filter((r) => r.status === "ko").length;
  const nSkip = args.results.filter((r) => r.status === "skip").length;
  lines.push(`RAPPORT DE TEST — HB Rappels${args.commit ? ` (${args.commit})` : ""}`);
  lines.push(`Date : ${new Date(args.nowIso).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (Paris) · par ${args.who}`);
  if (args.clock) lines.push(`Horloge simulée : ${args.clock}`);
  lines.push(`Bilan : ${nOk} OK · ${nKo} KO · ${nSkip} non testés`);
  lines.push("");
  lines.push("DIAGNOSTIC");
  for (const d of args.diagnostics) lines.push(`- [${d.level === "ok" ? "vert" : d.level === "warn" ? "orange" : "rouge"}] ${d.label} : ${d.detail}`);
  lines.push("");
  lines.push("TESTS");
  for (const r of args.results) {
    const def = TESTS.find((t) => t.id === r.id);
    lines.push(`[${LABEL[r.status]}] ${def?.n ?? "?"}. ${def?.title ?? r.id} — ${r.ms} ms`);
    if (r.status !== "ok") lines.push(`    ${r.detail}`);
    if (r.status === "ko") for (const c of (r.checks ?? []).filter((x) => !x.ok)) lines.push(`    ✗ ${c.label} | attendu : ${c.expected} | obtenu : ${c.got}`);
  }
  lines.push("");
  lines.push(`ANOMALIES (${args.anomalies.length})`);
  if (args.anomalies.length === 0) lines.push("- aucune");
  for (const a of args.anomalies.slice(0, 30)) lines.push(`- ${new Date(a.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · ${a.prenom ?? "—"} · ${a.kind}${a.is_test ? " (test)" : ""} · ${a.detail ?? ""}`);
  return lines.join("\n");
}
