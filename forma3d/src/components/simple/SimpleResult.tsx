"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/schema";
import { applyVariantLocally, type VariantId } from "@/lib/design/variants";
import { DEFAULT_PRINT_SETTINGS, defaultPrintMaterial, estimatePrint } from "@/lib/fabrication/estimate";
import { checkPrintability } from "@/lib/fabrication/printability";
import { findPrinterPreset, DEFAULT_PRINTER } from "@/lib/fabrication/printer";
import { downloadBlob, exportStl, fileBaseName } from "@/lib/three/export";
import { DEFAULT_VIEWER_SETTINGS } from "../viewer/settings";
import { Tip, useTips } from "./tips";
import { Slider, useToast } from "./ui";
import { IconAlert, IconArrowLeft, IconCheck, IconDownload, IconSliders, Spinner } from "../icons";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-ink-mute">
      <Spinner size={20} />
    </div>
  ),
});

type Stretch = { x: number; y: number; z: number };

const fmtMm = (n: number) => `${Math.round(n)} mm`;
const fmtDuration = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")}`);

/** Curseur de dimension : 50 % à 150 % de la valeur d'origine, au millimètre près. */
function DimensionSlider({ label, base, factor, onChange }: { label: string; base: number; factor: number; onChange(f: number): void }) {
  return (
    <Slider
      label={label}
      value={Math.round(base * factor)}
      min={Math.max(1, Math.round(base * 0.5))}
      max={Math.round(base * 1.5)}
      onChange={(v) => onChange(v / base)}
    />
  );
}

/**
 * Résultat du parcours Simple : le modèle en grand, ce que c'est en 3 lignes, un seul bouton principal
 * (« Télécharger pour imprimer »), des curseurs de dimensions et des ajustements en langage courant.
 * Le reste (analyse, étapes, coût…) est replié sous « Voir le détail ».
 */
export function SimpleResult({
  design: initial,
  demo,
  printerId,
  onBack,
  onAdvanced,
}: {
  design: Design;
  demo: boolean;
  printerId?: string;
  onBack(): void;
  onAdvanced(): void;
}) {
  const toast = useToast();
  const tips = useTips(["result-adjust", "result-advanced"]);
  const [design, setDesign] = useState(initial);
  const [stretch, setStretch] = useState<Stretch>({ x: 1, y: 1, z: 1 });
  const [adjusting, setAdjusting] = useState<VariantId | null>(null);
  const printer = findPrinterPreset(printerId);
  const volume = printer?.volume ?? DEFAULT_PRINTER;

  const dims = design.dimensions;
  const size = { width: dims.width * stretch.x, depth: dims.depth * stretch.z, height: dims.height * stretch.y };
  const report = useMemo(() => checkPrintability(design, volume), [design, volume]);
  // Estimation avec la matière conseillée par l'analyse (et non une matière par défaut).
  const estimate = useMemo(
    () => estimatePrint(design, { ...DEFAULT_PRINT_SETTINGS, material: defaultPrintMaterial(design) }, { supportsNeeded: report.supportsNeeded }),
    [design, report.supportsNeeded],
  );
  // Les curseurs étirent la pièce : matière et durée suivent le volume (estimation).
  const k = stretch.x * stretch.y * stretch.z;
  const minutes = Math.max(5, Math.round(estimate.minutes * k));
  const grams = Math.max(1, Math.round(estimate.massGrams * k));
  const material = design.materiaux_conseilles[0]?.nom ?? design.materials[0]?.name ?? estimate.material.label;
  const fits = size.width <= volume.x && size.depth <= volume.y && size.height <= volume.z;
  const verdictOk = report.verdict !== "error" && fits;
  const modelColor = "#969daa";
  const viewerBg = "#eeece8";

  const adjust = (id: VariantId) => {
    setAdjusting(id);
    // Calcul local, sans appel à l'IA : la pièce est recalculée tout de suite.
    setDesign((d) => applyVariantLocally(d, id, 2));
    setStretch({ x: 1, y: 1, z: 1 });
    setTimeout(() => setAdjusting(null), 300);
  };
  const download = () => {
    const stl = exportStl(design, stretch);
    const name = `${fileBaseName(design)}.stl`;
    downloadBlob(new Blob([stl], { type: "model/stl" }), name);
    toast(`Fichier prêt : ${name}`);
  };

  return (
    <div className="flex min-h-dvh flex-col lg:h-dvh">
      <header className="flex h-16 shrink-0 items-center gap-2 px-3 sm:px-6">
        <button type="button" onClick={onBack} className="tap flex min-h-11 items-center gap-2 rounded-lg px-3 text-body text-ink-soft hover:bg-paper hover:text-ink">
          <IconArrowLeft size={20} /> Nouvelle demande
        </button>
        <button type="button" onClick={onAdvanced} className="tap ms-auto flex min-h-11 items-center gap-2 rounded-lg px-3 text-body text-ink-soft hover:bg-paper hover:text-ink">
          <IconSliders size={20} /> Mode avancé
        </button>
      </header>

      <main className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[minmax(0,65fr)_minmax(360px,35fr)]">
        {/* Le modèle, en vedette */}
        <section aria-label="Aperçu 3D de la pièce" className="relative h-[52dvh] min-h-[300px] md:h-[56dvh] lg:h-auto" style={{ background: viewerBg }}>
          <ModelViewer
            design={design}
            settings={{ ...DEFAULT_VIEWER_SETTINGS, mode: "real", autoRotate: false, showGrid: true, colorOverride: modelColor, background: "light" }}
            backgroundStops={[viewerBg, viewerBg, viewerBg]}
            focusId={null}
            onFocusChange={() => {}}
            stretch={stretch}
          />
          {demo && (
            <span className="absolute start-3 top-3 rounded-full border border-line bg-surface/95 px-3 py-1 text-body text-ink-soft">Exemple de démonstration</span>
          )}
          <p className="pointer-events-none absolute bottom-3 start-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-surface/90 px-3 py-1 text-body text-ink-mute rtl:translate-x-1/2">
            <span className="sm:hidden">Glissez pour tourner</span>
            <span className="hidden sm:inline">Glissez pour tourner · pincez pour zoomer</span>
          </p>
        </section>

        {/* Ce qu'il faut savoir, et une seule action principale */}
        <section aria-label="Votre pièce" className="flex min-h-0 flex-col gap-6 overflow-y-auto bg-surface px-5 py-6 pb-28 sm:px-8 lg:pb-8">
          <div>
            <h1 className="text-title font-semibold text-ink">{design.title}</h1>
            <ul className="mt-3 space-y-1 text-lead text-ink-soft">
              <li>{design.solution.concept}</li>
              <li>
                <span className="tabular-nums">
                  {fmtMm(size.width)} × {fmtMm(size.depth)} × {fmtMm(size.height)}
                </span>
              </li>
              <li>Matière conseillée : {material}</li>
            </ul>
          </div>

          {tips.id === "result-adjust" && <Tip onDismiss={tips.dismiss}>Ajustez la largeur, la profondeur et la hauteur avec les curseurs : le fichier téléchargé suit vos réglages.</Tip>}
          {tips.id === "result-advanced" && <Tip onDismiss={tips.dismiss}>Besoin de plus de contrôle ? « Mode avancé » (en haut à droite) ouvre l&apos;éditeur complet.</Tip>}

          <p className={`flex items-start gap-2 rounded-xl px-4 py-3 text-body ${verdictOk ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
            {verdictOk ? <IconCheck size={20} /> : <IconAlert size={20} />}
            <span>
              {verdictOk ? (report.supportsNeeded ? "Imprimable avec supports" : "Imprimable sans supports") : fits ? "À vérifier avant d'imprimer" : `Trop grande pour la ${printer?.name ?? "plaque d'impression"}`}
              {" · "}≈ {fmtDuration(minutes)} · ≈ {grams} g de {estimate.material.label}
            </span>
          </p>

          <button type="button" onClick={download} className="hidden min-h-12 items-center justify-center gap-2 rounded-xl bg-accent-strong px-5 text-lead font-medium text-white transition-colors hover:bg-accent-strong/90 lg:flex">
            <IconDownload size={20} /> Télécharger pour imprimer
          </button>

          <div className="space-y-4">
            <h2 className="text-lead font-semibold text-ink">Ajuster les dimensions</h2>
            <DimensionSlider label="Largeur" base={dims.width} factor={stretch.x} onChange={(x) => setStretch((s) => ({ ...s, x }))} />
            <DimensionSlider label="Profondeur" base={dims.depth} factor={stretch.z} onChange={(z) => setStretch((s) => ({ ...s, z }))} />
            <DimensionSlider label="Hauteur" base={dims.height} factor={stretch.y} onChange={(y) => setStretch((s) => ({ ...s, y }))} />
          </div>

          <div>
            <h2 className="text-lead font-semibold text-ink">Ou laisser Forma3D ajuster</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  ["smaller", "Plus petit"],
                  ["stronger", "Plus solide"],
                  ["cheaper", "Moins cher"],
                ] as [VariantId, string][]
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => adjust(id)}
                  className="tap flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-body text-ink-soft transition-colors hover:border-accent/40 hover:text-ink"
                >
                  {adjusting === id && <Spinner size={16} />} {label}
                </button>
              ))}
            </div>
          </div>

          <details className="group rounded-xl border border-line">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-4 text-body font-medium text-ink">
              Voir le détail
              <span aria-hidden className="text-ink-mute transition-transform group-open:rotate-90">›</span>
            </summary>
            <div className="space-y-4 px-4 pb-4 text-body text-ink-soft">
              <p>{design.analysis.summary}</p>
              {design.solution.howItWorks && <p>{design.solution.howItWorks}</p>}
              {design.fabrication.length > 0 && (
                <ol className="list-decimal space-y-1 ps-5">
                  {design.fabrication.map((s) => (
                    <li key={s.title}>{s.title}</li>
                  ))}
                </ol>
              )}
              {report.issues.length > 0 && (
                <ul className="space-y-1">
                  {report.issues.map((i) => (
                    <li key={i.code + i.title}>
                      {i.title} : {i.fix}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </details>
        </section>
      </main>

      {/* iPhone / iPad portrait : l'action principale reste à portée du pouce */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 lg:hidden">
        <button type="button" onClick={download} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent-strong text-lead font-medium text-white">
          <IconDownload size={20} /> Télécharger pour imprimer
        </button>
      </div>
    </div>
  );
}
