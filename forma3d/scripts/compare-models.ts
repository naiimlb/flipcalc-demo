// Comparatif Opus / Sonnet / Haiku 5.5 sur 10 demandes types (refonte, phase 2).
// Mesure : réussite, temps, jetons, coût réel, vérifications automatiques, cotes demandées, paramètres nommés.
// Plafond de dépense strict (BUDGET_USD, 3 $ par défaut) : le script s'arrête avant de le dépasser.
// Usage : ANTHROPIC_API_KEY=… npx tsx --conditions=react-server scripts/compare-models.ts <dossier>
// La clé est lue dans l'environnement uniquement ; elle n'est jamais écrite ni affichée.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateDesignWithClaude } from "../src/lib/ai/claude";
import { DEFAULT_SYSTEM_PROMPT } from "../src/lib/design/prompt";
import { verifyDesign } from "../src/lib/fabrication/verify";

const PROMPTS = [
  "Un support pour mon téléphone sur le bureau, qui laisse passer le câble de charge",
  "Un range-câbles pour 5 chargeurs posés sur mon bureau",
  "Un cache pour un trou de 35 mm dans mon bureau",
  "Un pied de meuble pour caler une table bancale de 8 mm",
  "Un organiseur de tiroir pour les couverts, tiroir de 300 × 400 mm",
  "Un clip pour fermer un sachet de café de 12 cm de large",
  "Un crochet mural pour suspendre un casque audio",
  "Un porte-brosse à dents pour 2 brosses, à poser près du lavabo",
  "Une cale de porte pour l'empêcher de claquer",
  "Un support mural pour une perceuse sans fil",
];

// Tarifs par million de jetons (entrée, sortie, lecture de cache, écriture de cache 5 min), en dollars.
const MODELS = [
  { id: "claude-opus-5-5", price: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } },
  { id: "claude-sonnet-5-5", price: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 } },
  { id: "claude-haiku-5-5", price: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 } },
];
// Pire cas prudent par appel, pour ne jamais dépasser le plafond (32 000 jetons de sortie au maximum).
const worstCase = (m: (typeof MODELS)[number]) => (12_000 * m.price.input + 32_000 * m.price.output) / 1e6;

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const budget = Number(process.env.BUDGET_USD ?? "3");
  const effort = (process.env.EFFORT ?? "medium") as "low" | "medium" | "high";
  const out = process.argv[2] ?? "comparatif";
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY absente : comparatif non lancé (aucun appel, aucun coût).");
    process.exit(2);
    return;
  }
  mkdirSync(out, { recursive: true });

  type Row = {
    model: string;
    prompt: string;
    ok: boolean;
    seconds: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    confidence: string | null;
    requested: string | null;
    parts: number;
    parameters: number;
    error: string | null;
  };
  const rows: Row[] = [];
  let spent = 0;

  outer: for (const prompt of PROMPTS) {
    for (const model of MODELS) {
      if (spent + worstCase(model) > budget) {
        console.log(`Plafond de ${budget} $ atteint (dépensé ≈ ${spent.toFixed(2)} $) : arrêt avant ${model.id}.`);
        break outer;
      }
      const started = Date.now();
      const result = await generateDesignWithClaude({ apiKey, systemPrompt: DEFAULT_SYSTEM_PROMPT, model: model.id, effort, maxTokens: 32000, prompt });
      const seconds = Math.round((Date.now() - started) / 100) / 10;
      const u = result.usage;
      const cost = u
        ? (u.input_tokens * model.price.input + u.output_tokens * model.price.output + (u.cache_read_input_tokens ?? 0) * model.price.cacheRead + (u.cache_creation_input_tokens ?? 0) * model.price.cacheWrite) / 1e6
        : 0;
      spent += cost;
      const report = result.ok ? verifyDesign(result.design, { request: prompt }) : null;
      const row: Row = {
        model: model.id,
        prompt,
        ok: result.ok,
        seconds,
        inputTokens: u?.input_tokens ?? 0,
        outputTokens: u?.output_tokens ?? 0,
        costUsd: Math.round(cost * 10000) / 10000,
        confidence: report?.confidence ?? null,
        requested: report?.checks.find((c) => c.id === "requested")?.status ?? null,
        parts: result.ok ? result.design.model.parts.length : 0,
        parameters: result.ok ? result.design.parametres.length : 0,
        error: result.ok ? null : result.error,
      };
      rows.push(row);
      console.log(`${model.id} | ${seconds} s | ${row.ok ? "ok" : "échec"} | confiance ${row.confidence ?? "—"} | ${row.costUsd} $ | « ${prompt.slice(0, 40)}… »`);
      if (result.ok) writeFileSync(join(out, `${model.id}-${PROMPTS.indexOf(prompt) + 1}.json`), JSON.stringify(result.design, null, 2));
    }
  }

  const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)} %` : "—");
  const quantile = (values: number[], q: number) => {
    if (!values.length) return 0;
    const s = [...values].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  };
  const lines = [
    `Comparatif (${rows.length} générations, effort ${effort}, dépense totale ≈ ${spent.toFixed(2)} $)`,
    "",
    "| Modèle | Réussite | Temps médian | Temps 80 % | < 30 s | Coût moyen | Confiance élevée | Cotes respectées | Paramètres (moy.) |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const m of MODELS) {
    const r = rows.filter((x) => x.model === m.id);
    const ok = r.filter((x) => x.ok);
    const times = r.map((x) => x.seconds);
    const asked = ok.filter((x) => x.requested);
    lines.push(
      `| ${m.id} | ${pct(ok.length, r.length)} | ${quantile(times, 0.5)} s | ${quantile(times, 0.8)} s | ${pct(times.filter((t) => t < 30).length, r.length)} | ${
        r.length ? (r.reduce((n, x) => n + x.costUsd, 0) / r.length).toFixed(3) : "—"
      } $ | ${pct(ok.filter((x) => x.confidence === "high").length, ok.length)} | ${pct(asked.filter((x) => x.requested === "ok").length, asked.length)} | ${
        ok.length ? (ok.reduce((n, x) => n + x.parameters, 0) / ok.length).toFixed(1) : "—"
      } |`,
    );
  }
  writeFileSync(join(out, "comparatif.json"), JSON.stringify({ effort, spent, rows }, null, 2) + "\n");
  writeFileSync(join(out, "comparatif.md"), lines.join("\n") + "\n");
  console.log(lines.join("\n"));
}

void main();
