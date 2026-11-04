"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Spinner } from "@/components/icons";
import { DEFAULT_VIEWER_SETTINGS, viewerBackgroundCss } from "@/components/viewer/settings";
import type { Design } from "@/lib/design/schema";
import { CLAUDE_MODELS, DEFAULT_AI, EFFORTS, PROVIDERS_3D, type AiSettings } from "@/lib/settings";
import { saveAiSettings } from "../actions";
import { ResultMessage, useSave } from "../useSave";

const ModelViewer = dynamic(() => import("@/components/viewer/ModelViewer"), { ssr: false });

interface TestOutcome {
  ok: boolean;
  design: Design | null;
  provider: string;
  model: string | null;
  error: string | null;
  detail: string | null;
  raw: string | null;
  stopReason: string | null;
  usage: { input_tokens: number; output_tokens: number } | null;
  validationErrors: string[] | null;
  durationMs: number;
}

const EFFORT_LABELS: Record<string, string> = { low: "Faible (rapide)", medium: "Moyen (recommandé)", high: "Élevé (plus précis)" };
const PROVIDER_LABELS: Record<string, string> = { primitives: "Primitives Claude (intégré)", meshy: "Meshy text-to-3D (expérimental)" };

export function AiForm({ initial, samplePrompt }: { initial: AiSettings; samplePrompt: string }) {
  const [ai, setAi] = useState<AiSettings>(initial);
  const { pending, result, run } = useSave();
  const [testPrompt, setTestPrompt] = useState(samplePrompt);
  const [testing, setTesting] = useState(false);
  const [test, setTest] = useState<TestOutcome | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTest(null);
    setTestError(null);
    try {
      const res = await fetch("/api/admin/test-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: testPrompt, systemPrompt: ai.systemPrompt, model: ai.model, effort: ai.effort }),
      });
      const body = await res.json();
      if (!res.ok) setTestError(body.error ?? "Test impossible.");
      else setTest(body as TestOutcome);
    } catch {
      setTestError("Connexion interrompue.");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <form
        className="panel space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveAiSettings(ai));
        }}
      >
        <div>
          <div className="flex items-end justify-between gap-2">
            <label htmlFor="systemPrompt" className="label">
              Prompt système envoyé à Claude
            </label>
            <span className="mb-1.5 text-xs text-ink-mute">{ai.systemPrompt.length.toLocaleString("fr-FR")} / 20 000</span>
          </div>
          <textarea
            id="systemPrompt"
            rows={18}
            maxLength={20000}
            value={ai.systemPrompt}
            onChange={(e) => setAi({ ...ai, systemPrompt: e.target.value })}
            className="input font-mono !text-sm leading-relaxed"
          />
          <p className="mt-1 text-xs text-ink-mute">
            Le format de sortie (schéma JSON) est imposé par l&apos;API : le prompt règle le style, le niveau de détail et les règles métier.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="model">
              Modèle
            </label>
            <select id="model" value={ai.model} onChange={(e) => setAi({ ...ai, model: e.target.value })} className="input">
              {CLAUDE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="effort">
              Effort de réflexion
            </label>
            <select id="effort" value={ai.effort} onChange={(e) => setAi({ ...ai, effort: e.target.value as AiSettings["effort"] })} className="input">
              {EFFORTS.map((x) => (
                <option key={x} value={x}>
                  {EFFORT_LABELS[x]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="maxTokens">
              Jetons max (sortie)
            </label>
            <input
              id="maxTokens"
              type="number"
              min={4000}
              max={64000}
              step={1000}
              value={ai.maxTokens}
              onChange={(e) => setAi({ ...ai, maxTokens: Number(e.target.value) })}
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="provider3d">
              Fournisseur 3D
            </label>
            <select id="provider3d" value={ai.provider3d} onChange={(e) => setAi({ ...ai, provider3d: e.target.value as AiSettings["provider3d"] })} className="input">
              {PROVIDERS_3D.map((p) => (
                <option key={p} value={p}>
                  {PROVIDER_LABELS[p]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button type="submit" disabled={pending} className="btn-dark">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setAi({ ...ai, systemPrompt: DEFAULT_AI.systemPrompt })}>
            Prompt par défaut
          </button>
          <ResultMessage result={result} />
        </div>
      </form>

      <section className="panel p-5">
        <h2 className="text-sm font-semibold">Tester le prompt (brouillon, non enregistré)</h2>
        <p className="text-xs text-ink-mute">Appelle réellement l&apos;API avec les réglages ci-dessus. Rien n&apos;est sauvegardé.</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input value={testPrompt} onChange={(e) => setTestPrompt(e.target.value)} maxLength={1500} className="input" aria-label="Demande de test" />
          <button type="button" onClick={runTest} disabled={testing || testPrompt.trim().length < 3} className="btn-accent shrink-0">
            {testing && <Spinner />} Tester
          </button>
        </div>
        {testError && <p className="mt-3 text-sm text-danger">{testError}</p>}
        {test && (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className={`text-sm font-semibold ${test.ok ? "text-success" : "text-danger"}`}>
                {test.ok ? `OK · ${test.design?.title}` : `Erreur · ${test.error}`}
              </p>
              <p className="mt-1 text-xs text-ink-mute">
                {test.model ?? "—"} · {(test.durationMs / 1000).toFixed(1)} s
                {test.usage && ` · ${test.usage.input_tokens} + ${test.usage.output_tokens} jetons`}
                {test.stopReason && ` · ${test.stopReason}`}
              </p>
              {test.detail && <p className="mt-1 text-xs text-danger">{test.detail}</p>}
              {test.validationErrors && (
                <ul className="mt-2 list-disc pl-5 text-xs text-danger">
                  {test.validationErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              )}
              <pre className="mt-3 max-h-80 overflow-auto rounded-xl bg-[#0f1020] p-3 font-mono text-xs text-success scrollbar-thin">
                {test.raw ?? "(pas de réponse)"}
              </pre>
            </div>
            {test.design && (
              <div className="h-80 overflow-hidden rounded-2xl" style={{ background: viewerBackgroundCss("neon") }}>
                <ModelViewer design={test.design} settings={DEFAULT_VIEWER_SETTINGS} focusId={null} onFocusChange={() => {}} />
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
