"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { Design } from "@/lib/design/schema";
import { defaultPrintMaterial, estimatePrint, findPrintMaterial } from "@/lib/fabrication/estimate";
import { checkPrintability } from "@/lib/fabrication/printability";
import type { RequestItem } from "@/lib/requests";
import { DEFAULT_VIEWER_SETTINGS } from "../viewer/settings";
import { IconX, Spinner } from "../icons";
import { Portal } from "../Portal";
import { formatDuration, formatLength, formatMoney, formatWeight, type LengthUnit } from "./format";
import type { StudioPrefs } from "./types";
import { useT } from "../app/Preferences";
import type { Translator } from "@/lib/i18n";

const ModelViewer = dynamic(() => import("../viewer/ModelViewer"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-ink-mute">
      <Spinner size={18} />
    </div>
  ),
});

const VIEWER = { ...DEFAULT_VIEWER_SETTINGS, mode: "real" as const, showGrid: false };

interface Facts {
  design: Design;
  dims: string;
  volume: number;
  weight: number;
  parts: number;
  material: string;
  costMin: number;
  costMax: number;
  currency: string;
  printGrams: number | null;
  printMinutes: number | null;
  verdict: string;
}

function facts(design: Design, prefs: StudioPrefs, unit: LengthUnit, t: Translator): Facts {
  let printGrams: number | null = null;
  let printMinutes: number | null = null;
  let verdict = "—";
  try {
    const report = checkPrintability(design, prefs.printer);
    verdict = t(report.verdict === "ok" ? "fab.ok" : report.verdict === "warning" ? "fab.warn" : "fab.error");
    const e = estimatePrint(
      design,
      { material: prefs.print.material ?? defaultPrintMaterial(design), infill: prefs.print.infill, layerHeight: prefs.print.layerHeight },
      { supportsNeeded: report.supportsNeeded, height: report.size.height },
    );
    printGrams = e.massGrams;
    printMinutes = e.minutes;
  } catch {
    // calcul impossible : laissé vide
  }
  const d = design.dimensions;
  return {
    design,
    dims: `${formatLength(d.width, unit)} × ${formatLength(d.depth, unit)} × ${formatLength(d.height, unit)}`,
    volume: d.width * d.depth * d.height,
    weight: d.weightGrams,
    parts: design.model.parts.length,
    material: design.materiaux_conseilles[0]?.nom ?? design.materials[0]?.name ?? "—",
    costMin: design.cost.min,
    costMax: design.cost.max,
    currency: design.cost.currency || "EUR",
    printGrams,
    printMinutes,
    verdict,
  };
}

/** Écart de B par rapport à A, en % (vert si plus bas quand « plus bas = mieux »). */
function Delta({ a, b, lowerIsBetter = true }: { a: number | null; b: number | null; lowerIsBetter?: boolean }) {
  if (a === null || b === null || a <= 0) return null;
  const pct = Math.round(((b - a) / a) * 100);
  if (pct === 0) return <span className="ms-1 text-[10.5px] text-ink-mute">=</span>;
  const good = lowerIsBetter ? pct < 0 : pct > 0;
  return (
    <span className={`ms-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${good ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-600"}`}>
      {pct > 0 ? "+" : ""}
      {pct} %
    </span>
  );
}

export default function CompareDialog({
  items,
  initialA,
  initialB,
  prefs,
  onClose,
}: {
  items: RequestItem[];
  initialA: string;
  initialB: string;
  prefs: StudioPrefs;
  onClose(): void;
}) {
  const t = useT();
  const ready = items.filter((i) => i.design && i.status === "ready");
  const [aId, setAId] = useState(initialA);
  const [bId, setBId] = useState(initialB);
  const a = ready.find((i) => i.id === aId) ?? ready[0];
  const b = ready.find((i) => i.id === bId) ?? ready[1] ?? ready[0];
  const fa = useMemo(() => (a?.design ? facts(a.design, prefs, prefs.unit, t) : null), [a, prefs, t]);
  const fb = useMemo(() => (b?.design ? facts(b.design, prefs, prefs.unit, t) : null), [b, prefs, t]);

  const label = (i: RequestItem) => `${i.title ?? i.prompt}${i.design?.variante ? ` · ${t(`variant.${i.design.variante.objectif}`)}` : ""}`;
  const material = findPrintMaterial(prefs.print.material ?? (a?.design ? defaultPrintMaterial(a.design) : "pla")).label;

  const rows: { label: string; a: React.ReactNode; b: React.ReactNode }[] =
    fa && fb
      ? [
          { label: t("compare.dims"), a: fa.dims, b: <>{fb.dims}<Delta a={fa.volume} b={fb.volume} /></> },
          { label: t("compare.mass"), a: formatWeight(fa.weight), b: <>{formatWeight(fb.weight)}<Delta a={fa.weight} b={fb.weight} /></> },
          { label: t("compare.parts"), a: fa.parts, b: fb.parts },
          { label: t("compare.material"), a: fa.material, b: fb.material },
          {
            label: t("compare.cost"),
            a: `${formatMoney(fa.costMin, fa.currency)} – ${formatMoney(fa.costMax, fa.currency)}`,
            b: (
              <>
                {formatMoney(fb.costMin, fb.currency)} – {formatMoney(fb.costMax, fb.currency)}
                <Delta a={fa.costMax} b={fb.costMax} />
              </>
            ),
          },
          {
            label: t("compare.print", { material }),
            a: fa.printGrams !== null ? `${formatWeight(fa.printGrams)} · ${formatDuration(fa.printMinutes ?? 0)}` : "—",
            b: (
              <>
                {fb.printGrams !== null ? `${formatWeight(fb.printGrams)} · ${formatDuration(fb.printMinutes ?? 0)}` : "—"}
                <Delta a={fa.printGrams} b={fb.printGrams} />
              </>
            ),
          },
          { label: t("compare.printability"), a: fa.verdict, b: fb.verdict },
        ]
      : [];

  return (
    <Portal>
      <div className="fixed inset-0 z-[60] flex items-stretch justify-center bg-night/55 p-2 backdrop-blur-sm sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="compare-title"
          className="flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-[24px] bg-surface shadow-float"
        >
          <header className="flex items-center gap-3 border-b border-line px-4 py-3">
            <h2 id="compare-title" className="flex-1 text-[15px] font-semibold">
              {t("compare.title")}
            </h2>
            <button type="button" onClick={onClose} className="icon-btn" aria-label={t("menu.close")}>
              <IconX size={15} />
            </button>
          </header>
          <div className="overflow-y-auto p-3 sm:p-4">
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {(
                [
                  ["A", a, setAId],
                  ["B", b, setBId],
                ] as const
              ).map(([key, current, set]) => (
                <div key={key} className="min-w-0">
                  <label className="label !mb-1" htmlFor={`compare-${key}`}>
                    {t("compare.version", { v: key })}
                  </label>
                  <select
                    id={`compare-${key}`}
                    value={current?.id ?? ""}
                    onChange={(e) => set(e.target.value)}
                    className="input !px-2.5 !py-2 !text-xs"
                  >
                    {ready.map((i) => (
                      <option key={i.id} value={i.id}>
                        {label(i)}
                      </option>
                    ))}
                  </select>
                  <div
                    className="relative mt-2 h-44 overflow-hidden rounded-2xl sm:h-64"
                    style={{ background: "radial-gradient(120% 90% at 25% 10%, #f6f7ff 0%, #e2e4f8 55%, #d3d6f2 100%)" }}
                  >
                    {current?.design && (
                      <ModelViewer design={current.design} settings={VIEWER} focusId={null} onFocusChange={() => {}} />
                    )}
                  </div>
                </div>
              ))}
            </div>
            <table className="mt-4 w-full table-fixed border-collapse text-start text-[12px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-wide text-ink-mute">
                  <th className="w-[30%] pb-2 font-semibold"> </th>
                  <th className="pb-2 font-semibold">{t("compare.version", { v: "A" })}</th>
                  <th className="pb-2 font-semibold">{t("compare.version", { v: "B" })}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line/70 align-top">
                    <th scope="row" className="py-2 pr-2 font-medium text-ink-mute">
                      {r.label}
                    </th>
                    <td className="py-2 pr-2 text-ink">{r.a}</td>
                    <td className="py-2 text-ink">{r.b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] text-ink-mute">{t("compare.note")}</p>
          </div>
        </div>
      </div>
    </Portal>
  );
}
