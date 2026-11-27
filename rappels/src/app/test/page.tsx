"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { IntInput } from "@/components/NumInput";
import { getSupabase } from "@/lib/supabase";
import { useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { pushTest } from "@/lib/testmode/api";
import { msToParisLocal, parisLocalToMs, readSimulated, setSimulated, testNow } from "@/lib/testmode/clock";
import { loadDiagnostics, type Diag, type Status } from "@/lib/testmode/diagnostics";
import { buildReport, runAll, runOne, TESTS } from "@/lib/testmode/runner";
import type { Ctx, TestResult } from "@/lib/testmode/types";

type Anomaly = { id: number; at: string; prenom: string | null; kind: string; detail: string | null; is_test: boolean };
type Settings = { accel: number; step: number; push: boolean };
const SETTINGS_KEY = "hb-test-settings";
const card = "mb-4 rounded-3xl bg-white p-4 shadow-card";
const h2 = "mb-2 text-sm font-extrabold uppercase tracking-wide";
const btn = "min-h-12 rounded-full px-4 text-[15px] font-extrabold disabled:opacity-50";
const primary = `${btn} bg-pink text-white shadow-pop active:scale-[0.98]`;
const secondary = `${btn} border-2 border-line bg-white`;
const DOT = { ok: "bg-[#22c55e]", warn: "bg-[#f59e0b]", ko: "bg-[#ef4444]" } as const;

function loadSettings(): Settings {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null") as Partial<Settings> | null;
    return { accel: Math.min(600, Math.max(1, s?.accel ?? 30)), step: Math.min(120, Math.max(5, s?.step ?? 20)), push: s?.push === true };
  } catch {
    return { accel: 30, step: 20, push: false };
  }
}

export default function TestPage() {
  const state = useAppState();
  if (!state) return <Skeleton />;
  if (state.profile.role !== "responsable") {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Accès refusé 🔒</p>
        <p className="mt-2 text-sm text-mute">Le mode test est réservé au responsable.</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Retour</Link>
      </div>
    );
  }
  return <TestMode uid={state.profile.id} prenom={state.profile.prenom} />;
}

function TestMode({ uid, prenom }: { uid: string; prenom: string }) {
  const sb = useMemo(() => getSupabase(), []);
  const [diag, setDiag] = useState<Diag[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [results, setResults] = useState<Record<string, TestResult | "running">>({});
  const [says, setSays] = useState<Record<string, string>>({});
  // Cette page n'est jamais rendue côté serveur (elle attend la session) : on peut lire le stockage local tout de suite.
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [clock, setClockState] = useState<number | null>(readSimulated);
  const [clockInput, setClockInput] = useState(() => msToParisLocal(readSimulated() ?? Date.now()));
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [report, setReport] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignoré */
    }
  }, [settings]);

  const refresh = useCallback(
    () =>
      Promise.all([loadDiagnostics(sb), sb.rpc("test_anomalies", { p_limit: 100 })]).then(([d, a]) => {
        setDiag(d.items);
        setStatus(d.status);
        setAnomalies((a.data as Anomaly[]) ?? []);
      }),
    [sb],
  );

  useEffect(() => {
    void refresh();
    const t = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(t);
  }, [refresh]);

  const makeCtx = (id: string): Ctx => ({
    sb,
    uid,
    prenom,
    now: testNow,
    accelSeconds: settings.accel,
    stepSeconds: settings.step,
    pushToDevice: settings.push,
    testUser: status?.test_user ?? null,
    push: (target, items) => pushTest(sb, target, items),
    say: (text) => setSays((s) => ({ ...s, [id]: text })),
  });

  async function runTest(id: string) {
    const def = TESTS.find((t) => t.id === id)!;
    setResults((r) => ({ ...r, [id]: "running" }));
    setSays((s) => ({ ...s, [id]: "" }));
    const r = await runOne(def, makeCtx(id));
    setResults((x) => ({ ...x, [id]: r }));
    void refresh();
  }

  async function runEverything() {
    setRunning(true);
    setReport("");
    setResults({});
    const all = await runAll(makeCtx("all"), (id, r) => setResults((x) => ({ ...x, [id]: r })));
    await refresh();
    const { data } = await sb.rpc("test_anomalies", { p_limit: 100 });
    setRunning(false);
    setReport(
      buildReport({
        who: prenom,
        nowIso: new Date().toISOString(),
        diagnostics: diag ?? [],
        results: all,
        anomalies: (data as Anomaly[]) ?? [],
        clock: clock ? msToParisLocal(clock).replace("T", " ") : null,
      }),
    );
  }

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("📋 Copié", `${what} est dans le presse-papiers.`);
    } catch {
      showToast("⚠️ Copie impossible", "Sélectionne le texte et copie-le à la main.");
    }
  }

  async function designate(clear = false) {
    if (!clear && !window.confirm("Ce compte recevra les notifications de TEST et pourra voir les tâches de test. Tu confirmes que c'est bien ton compte de test ?")) return;
    setBusy(true);
    const { error } = await sb.rpc("test_set_account", { p_email: clear ? null : email.trim() });
    setBusy(false);
    if (error) return showToast("⚠️ Compte non désigné", error.message);
    setEmail("");
    showToast(clear ? "Compte de test retiré" : "✅ Compte de test désigné", clear ? "Plus aucun compte de test." : "Il peut maintenant recevoir les tâches de test.");
    void refresh();
  }

  async function cleanup() {
    if (!window.confirm("Supprimer toutes les tâches de test et leurs données (partages, historique, transmissions) ? Les vraies données ne sont pas touchées.")) return;
    setBusy(true);
    const { data, error } = await sb.rpc("test_cleanup");
    setBusy(false);
    if (error) return showToast("⚠️ Nettoyage impossible", error.message);
    const r = data as { tasks: number; anomalies: number };
    showToast("🧹 Données de test supprimées", `${r.tasks} tâche${r.tasks > 1 ? "s" : ""} et ${r.anomalies} anomalie${r.anomalies > 1 ? "s" : ""} de test.`);
    setResults({});
    void refresh();
  }

  async function scan() {
    const { data, error } = await sb.rpc("test_scan");
    if (error) return showToast("⚠️ Recherche impossible", error.message);
    const found = (data as unknown[]) ?? [];
    showToast(found.length ? `⚠️ ${found.length} incohérence${found.length > 1 ? "s" : ""}` : "✅ Rien d'anormal", found.length ? "Elles sont dans le journal." : "Aucune incohérence dans les données.");
    void refresh();
  }

  async function clearJournal() {
    if (!window.confirm("Effacer tout le journal d'anomalies ?")) return;
    await sb.rpc("test_clear_anomalies");
    void refresh();
  }

  const applyClock = () => {
    const ms = parisLocalToMs(clockInput);
    if (ms === null) return showToast("Heure invalide", "Choisis une date et une heure.");
    setSimulated(ms);
    setClockState(ms);
  };
  const resetClock = () => {
    setSimulated(null);
    setClockState(null);
    setClockInput(msToParisLocal(Date.now()));
  };

  const journalText = anomalies.map((a) => `${new Date(a.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · ${a.prenom ?? "—"} · ${a.kind}${a.is_test ? " (test)" : ""} · ${a.detail ?? ""}`).join("\n");
  const done = Object.values(results).filter((r): r is TestResult => r !== "running");
  const counts = { ok: done.filter((r) => r.status === "ok").length, ko: done.filter((r) => r.status === "ko").length, skip: done.filter((r) => r.status === "skip").length };

  return (
    <>
      <Header title="Mode test 🧪" />
      <p className="-mt-3 mb-4 text-sm font-semibold text-mute">Réservé au responsable. Les tests n&apos;envoient rien à tes collègues : seulement à tes appareils ou au compte de test.</p>

      {clock !== null && (
        <p role="status" className="mb-4 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">⏱️ Horloge simulée : {msToParisLocal(clock).replace("T", " ")} (Paris). Les tests l&apos;utilisent ; l&apos;app garde l&apos;heure réelle.</p>
      )}

      <section className={card} aria-label="Diagnostic en direct">
        <div className="flex items-center justify-between gap-2">
          <h2 className={h2}>Diagnostic en direct</h2>
          <button type="button" onClick={() => void refresh()} className="min-h-11 rounded-full border-2 border-line px-3 text-xs font-bold">↻ Actualiser</button>
        </div>
        {diag === null ? (
          <p className="text-sm text-mute">Chargement…</p>
        ) : (
          <ul className="space-y-2">
            {diag.map((d) => (
              <li key={d.id} className="flex items-start gap-3">
                <span aria-label={d.level === "ok" ? "vert" : d.level === "warn" ? "orange" : "rouge"} className={`mt-1.5 size-3.5 shrink-0 rounded-full ${DOT[d.level]}`} />
                <span className="min-w-0 text-[14px] leading-snug">
                  <span className="font-bold">{d.label}</span>
                  <span className="block text-mute">{d.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card} aria-label="Lancer tous les tests">
        <h2 className={h2}>Lancer tous les tests</h2>
        <button type="button" disabled={running || busy} onClick={runEverything} className={`${primary} w-full`}>{running ? "Tests en cours…" : "▶️ Lancer tous les tests"}</button>
        {done.length > 0 && (
          <p className="mt-3 text-[15px] font-extrabold" aria-live="polite">
            <span className="text-[#16a34a]">{counts.ok} OK</span> · <span className="text-[#dc2626]">{counts.ko} KO</span> · <span className="text-mute">{counts.skip} non testés</span>
          </p>
        )}
        {report && (
          <div className="mt-3">
            <button type="button" onClick={() => void copy(report, "Le rapport")} className={`${secondary} w-full`}>📋 Copier le rapport</button>
            <textarea readOnly value={report} rows={8} aria-label="Rapport de test" className="mt-2 w-full rounded-2xl border-2 border-line bg-canvas p-3 font-mono text-[12px]" />
          </div>
        )}
      </section>

      <section className={card} aria-label="Réglages des tests">
        <h2 className={h2}>Réglages des tests</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="accel" className="text-[15px] font-semibold">Délai de relance accéléré (s)</label>
            <IntInput id="accel" value={settings.accel} max={600} onChange={(n) => setSettings((s) => ({ ...s, accel: Math.max(1, n) }))} className="h-12 w-24 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="step" className="text-[15px] font-semibold">Pas du planificateur simulé (s)</label>
            <IntInput id="step" value={settings.step} max={120} onChange={(n) => setSettings((s) => ({ ...s, step: Math.max(5, n) }))} className="h-12 w-24 rounded-2xl border-2 border-line bg-white text-center text-[17px] font-extrabold focus:border-pink" />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-[15px] font-semibold">
            <input type="checkbox" checked={settings.push} onChange={(e) => setSettings((s) => ({ ...s, push: e.target.checked }))} className="size-6 accent-[#ff1f6e]" />
            Envoyer aussi les notifications des tests sur mon appareil
          </label>
        </div>

        <h3 className="mb-2 mt-5 text-sm font-extrabold">Simulateur d&apos;horloge</h3>
        <p className="mb-2 text-[13px] text-mute">Faire comme s&apos;il était… (tests uniquement)</p>
        <input type="datetime-local" value={clockInput} onChange={(e) => setClockInput(e.target.value)} aria-label="Date et heure simulées (Paris)" className="h-12 w-full rounded-2xl border-2 border-line bg-white px-3 text-[17px] font-semibold focus:border-pink" />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" onClick={applyClock} className={primary}>Appliquer</button>
          <button type="button" onClick={resetClock} className={secondary}>Heure réelle</button>
        </div>
      </section>

      <section className={card} aria-label="Compte de test">
        <h2 className={h2}>Compte de test</h2>
        {status?.test_user ? (
          <>
            <p className="text-[15px]">
              Désigné : <span className="font-extrabold">{status.test_user.prenom}</span> · {status.subs.test > 0 ? `${status.subs.test} appareil abonné` : "aucun appareil abonné aux notifications"}
            </p>
            <button type="button" disabled={busy} onClick={() => void designate(true)} className={`${secondary} mt-3 w-full`}>Retirer le compte de test</button>
          </>
        ) : (
          <p className="text-[13px] text-mute">Aucun. Crée un 2ᵉ compte caissier (ou prends le tien sur un autre téléphone), puis désigne-le par son email : c&apos;est le seul compte qui recevra les tâches et notifications de test.</p>
        )}
        {!status?.test_user && (
          <div className="mt-3 flex gap-2">
            <input type="email" inputMode="email" autoCapitalize="none" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email du compte de test" aria-label="Email du compte de test" className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-[17px] font-semibold focus:border-pink" />
            <button type="button" disabled={busy || !email.includes("@")} onClick={() => void designate()} className={primary}>Désigner</button>
          </div>
        )}
      </section>

      <section aria-label="Les tests" className="mb-4">
        <h2 className={`${h2} px-1`}>Les 13 tests</h2>
        <ul className="space-y-3">
          {TESTS.map((t) => {
            const r = results[t.id];
            const res = r && r !== "running" ? r : null;
            return (
              <li key={t.id} className="rounded-3xl bg-white p-4 shadow-card">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[16px] font-extrabold leading-snug"><span className="text-pink-deep">{t.n}.</span> {t.title}</p>
                    <p className="text-[13px] text-mute">{t.hint}{t.needsTestUser ? " · compte de test requis" : ""}{t.manual ? " · manuel" : ""}</p>
                  </div>
                  <span data-result={res?.status ?? (r === "running" ? "running" : "idle")} className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-extrabold ${res?.status === "ok" ? "bg-[#22c55e] text-white" : res?.status === "ko" ? "bg-[#ef4444] text-white" : res?.status === "skip" ? "bg-line text-mute" : r === "running" ? "bg-pink-soft text-pink-deep" : "border border-line text-mute"}`}>
                    {res?.status === "ok" ? "OK" : res?.status === "ko" ? "KO" : res?.status === "skip" ? "Non testé" : r === "running" ? "En cours…" : "—"}
                  </span>
                </div>
                {r === "running" && says[t.id] && <p role="status" className="mt-2 rounded-2xl bg-pink-soft px-3 py-2 text-[14px] font-bold text-pink-deep">{says[t.id]}</p>}
                {res && (
                  <>
                    <p className="mt-2 text-[14px] leading-snug">{res.detail} <span className="text-mute">({res.ms} ms)</span></p>
                    {res.checks && res.checks.length > 0 && (
                      <details className="mt-2">
                        <summary className="min-h-11 cursor-pointer text-sm font-bold text-pink-deep">Voir les {res.checks.length} vérifications</summary>
                        <ul className="mt-1 space-y-1.5">
                          {res.checks.map((c, i) => (
                            <li key={i} className={`rounded-xl px-3 py-2 text-[12.5px] leading-snug ${c.ok ? "bg-canvas" : "bg-[#fee2e2]"}`}>
                              <span className="font-bold">{c.ok ? "✓" : "✗"} {c.label}</span>
                              {!c.ok && <span className="block">attendu : {c.expected} · obtenu : {c.got}</span>}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </>
                )}
                <button type="button" disabled={running || r === "running"} onClick={() => void runTest(t.id)} className={`${secondary} mt-3 w-full`}>{r === "running" ? "En cours…" : t.manual ? "Envoyer la notification" : "Lancer ce test"}</button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={card} aria-label="Journal d'anomalies">
        <div className="flex items-center justify-between gap-2">
          <h2 className={h2}>Journal d&apos;anomalies ({anomalies.length})</h2>
          <button type="button" onClick={() => void scan()} className="min-h-11 rounded-full border-2 border-line px-3 text-xs font-bold">🔎 Chercher</button>
        </div>
        {anomalies.length === 0 ? (
          <p className="text-sm text-mute">Aucune anomalie récente.</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {anomalies.map((a) => (
              <li key={a.id} className="rounded-xl bg-canvas px-3 py-2 text-[13px] leading-snug">
                <span className="font-bold tabular-nums text-pink-deep">{new Date(a.at).toLocaleString("fr-FR", { timeZone: "Europe/Paris", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>{" "}
                <span className="font-bold">{a.prenom ?? "—"}</span> · {a.kind}{a.is_test ? " 🧪" : ""}
                {a.detail && <span className="block text-mute">{a.detail}</span>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 grid grid-cols-2 gap-3">
          <button type="button" disabled={anomalies.length === 0} onClick={() => void copy(journalText, "Le journal")} className={secondary}>📋 Copier</button>
          <button type="button" disabled={anomalies.length === 0} onClick={() => void clearJournal()} className={secondary}>🗑️ Effacer</button>
        </div>
      </section>

      <section className={card} aria-label="Nettoyage">
        <h2 className={h2}>Données de test</h2>
        <p className="mb-3 text-[13px] text-mute">{status ? `${status.test_tasks} tâche${status.test_tasks > 1 ? "s" : ""} de test en base.` : ""} Elles sont marquées is_test et invisibles des autres utilisateurs.</p>
        <button type="button" disabled={busy || running} onClick={() => void cleanup()} className={`${btn} w-full border-2 border-pink bg-white text-pink-deep`}>🧹 Nettoyer les données de test</button>
      </section>
    </>
  );
}
