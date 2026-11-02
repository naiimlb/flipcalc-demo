"use client";

import { useEffect, useMemo, useState } from "react";
import type { Design } from "@/lib/design/schema";
import type { VariantId } from "@/lib/design/variants";
import { canvasToPdfBlob, canvasToPngBlob, renderPlanSheet, renderSnapshot } from "@/lib/fabrication/drawing";
import { PRINT_MATERIALS, defaultPrintMaterial, estimatePrint } from "@/lib/fabrication/estimate";
import { checkPrintability, type PrintabilityReport } from "@/lib/fabrication/printability";
import { fabricationLinks, shoppingList } from "@/lib/fabrication/sourcing";
import type { RequestItem } from "@/lib/requests";
import { downloadBlob, exportGlb, exportStl, fileBaseName } from "@/lib/three/export";
import { IconAlert, IconCheck, IconCube, IconDownload, IconExternal, IconHistory, IconRuler, IconSteps, Spinner } from "../icons";
import { formatDuration, formatMoney, formatRelative, formatWeight } from "./format";
import type { StudioFeatures, StudioPrefs } from "./types";
import { VariantButtons } from "./VariantButtons";

interface Props {
  item: RequestItem | null;
  items: RequestItem[];
  prefs: StudioPrefs;
  onPrefs(patch: Partial<StudioPrefs>): void;
  features: StudioFeatures;
  busy: boolean;
  onAdjust(variant: VariantId): void;
  onCompare(): void;
  onSelect(id: string): void;
  onToast(message: string): void;
}

function Card({ icon, title, aside, children, className = "" }: { icon: React.ReactNode; title: string; aside?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`panel flex flex-col p-4 ${className}`}>
      <header className="mb-3 flex items-center gap-2.5">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">{icon}</span>
        <h3 className="flex-1 text-[13.5px] font-semibold text-ink">{title}</h3>
        {aside}
      </header>
      {children}
    </section>
  );
}

const VERDICT = {
  ok: { label: "Imprimable", cls: "bg-emerald-500 text-white" },
  warning: { label: "À vérifier", cls: "bg-amber-400 text-ink" },
  error: { label: "À corriger", cls: "bg-rose-500 text-white" },
} as const;

const LEVEL = {
  error: "border-rose-200 bg-rose-50 text-rose-700",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-line bg-paper text-ink-soft",
} as const;

export default function FabricationTab({ item, items, prefs, onPrefs, features, busy, onAdjust, onCompare, onSelect, onToast }: Props) {
  const design = item?.design ?? null;
  const materialId = prefs.print.material ?? defaultPrintMaterial(design);

  const report = useMemo<PrintabilityReport | null>(() => {
    if (!design) return null;
    try {
      return checkPrintability(design, prefs.printer);
    } catch (err) {
      console.error(err);
      return null;
    }
  }, [design, prefs.printer]);

  const estimate = useMemo(() => {
    if (!design) return null;
    try {
      return estimatePrint(
        design,
        { material: materialId, infill: prefs.print.infill, layerHeight: prefs.print.layerHeight },
        { supportsNeeded: report?.supportsNeeded, height: report?.size.height },
      );
    } catch {
      return null;
    }
  }, [design, materialId, prefs.print.infill, prefs.print.layerHeight, report]);

  const versions = useMemo(
    () =>
      item
        ? items
            .filter((i) => i.prompt === item.prompt && i.design && i.status === "ready")
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        : [],
    [item, items],
  );
  const comparable = items.filter((i) => i.design && i.status === "ready").length >= 2;

  if (!design || !item) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <p className="text-sm font-semibold">Aucune conception sélectionnée</p>
        <p className="mt-1 text-xs text-ink-mute">Décrivez un problème dans la barre du haut, ou ouvrez un projet de l&apos;historique.</p>
      </div>
    );
  }

  const setPrinter = (axis: "x" | "y" | "z", value: string) => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return;
    onPrefs({ printer: { ...prefs.printer, [axis]: Math.min(3000, Math.max(30, n)) } });
  };
  const material = PRINT_MATERIALS.find((m) => m.id === materialId) ?? PRINT_MATERIALS[0];

  return (
    <div className="grid h-full gap-3 overflow-y-auto pb-1 scrollbar-thin md:grid-cols-2 xl:grid-cols-3">
      {/* Imprimabilité */}
      <Card
        icon={<IconCheck size={15} />}
        title="Contrôle d'imprimabilité"
        aside={report && <span className={`chip ${VERDICT[report.verdict].cls}`}>{VERDICT[report.verdict].label}</span>}
      >
        <p className="label !mb-1">Volume d&apos;impression (mm)</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="text-[10.5px] font-medium text-ink-mute">
              {axis === "x" ? "Largeur" : axis === "y" ? "Profondeur" : "Hauteur"}
              <input
                type="number"
                inputMode="numeric"
                min={30}
                max={3000}
                defaultValue={prefs.printer[axis]}
                key={`${axis}-${prefs.printer[axis]}`}
                onBlur={(e) => setPrinter(axis, e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setPrinter(axis, (e.target as HTMLInputElement).value)}
                className="input mt-0.5 !px-2.5 !py-1.5 !text-xs"
                aria-label={`Volume d'impression : ${axis === "x" ? "largeur" : axis === "y" ? "profondeur" : "hauteur"} en mm`}
              />
            </label>
          ))}
        </div>
        {report ? (
          <>
            <p className="mt-3 text-[11.5px] text-ink-soft">
              Objet : {Math.round(report.size.width)} × {Math.round(report.size.depth)} × {Math.round(report.size.height)} mm ·{" "}
              {report.supportsNeeded ? "supports nécessaires" : "sans support"}
            </p>
            {report.issues.length === 0 ? (
              <p className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-[12px] text-emerald-800">
                Aucun problème détecté : taille, parois et porte-à-faux sont compatibles avec votre imprimante.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {report.issues.map((issue, i) => (
                  <li key={i} className={`rounded-xl border p-2.5 ${LEVEL[issue.level]}`}>
                    <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                      {issue.level === "info" ? <IconCube size={13} /> : <IconAlert size={13} />}
                      {issue.title}
                    </p>
                    <p className="mt-0.5 text-[11.5px] leading-snug">{issue.detail}</p>
                    <p className="mt-1 text-[11.5px] font-medium leading-snug">→ {issue.fix}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[10.5px] text-ink-mute">
              Vérifications géométriques simples (parois de {">"} 1,2 mm, porte-à-faux de plus de 45°) : le trancheur reste la référence.
            </p>
          </>
        ) : (
          <p className="mt-3 text-xs text-ink-mute">Analyse impossible pour cette conception.</p>
        )}
      </Card>

      {/* Estimation */}
      <Card icon={<IconSteps size={15} />} title="Estimation d'impression">
        <div className="grid grid-cols-3 gap-1.5">
          <label className="text-[10.5px] font-medium text-ink-mute">
            Matière
            <select
              value={materialId}
              onChange={(e) => onPrefs({ print: { ...prefs.print, material: e.target.value } })}
              className="input mt-0.5 !px-2 !py-1.5 !text-xs"
            >
              {PRINT_MATERIALS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10.5px] font-medium text-ink-mute">
            Remplissage
            <select
              value={prefs.print.infill}
              onChange={(e) => onPrefs({ print: { ...prefs.print, infill: Number(e.target.value) } })}
              className="input mt-0.5 !px-2 !py-1.5 !text-xs"
            >
              {[0.1, 0.15, 0.2, 0.3, 0.4, 0.6, 1].map((v) => (
                <option key={v} value={v}>
                  {Math.round(v * 100)} %
                </option>
              ))}
            </select>
          </label>
          <label className="text-[10.5px] font-medium text-ink-mute">
            Couche
            <select
              value={prefs.print.layerHeight}
              onChange={(e) => onPrefs({ print: { ...prefs.print, layerHeight: Number(e.target.value) } })}
              className="input mt-0.5 !px-2 !py-1.5 !text-xs"
            >
              {[0.12, 0.16, 0.2, 0.28].map((v) => (
                <option key={v} value={v}>
                  {v.toLocaleString("fr-FR")} mm
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-ink-mute">{material.note}</p>
        {estimate ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-center">
            {[
              ["Matière", `≈ ${formatWeight(estimate.massGrams)}`],
              ["Durée", `≈ ${formatDuration(estimate.minutes)}`],
              ["Coût", `≈ ${formatMoney(estimate.cost.min)} – ${formatMoney(estimate.cost.max)}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-paper px-1.5 py-2.5">
                <p className="text-[10.5px] font-medium text-brand-accent">{label}</p>
                <p className="mt-0.5 text-[12.5px] font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-ink-mute">Estimation impossible pour cette conception.</p>
        )}
        <p className="mt-2 rounded-xl bg-amber-50 p-2.5 text-[11px] leading-snug text-amber-800">
          Estimations indicatives (coque + remplissage, débit moyen d&apos;une imprimante grand public, matière et électricité
          {estimate?.supportsIncluded ? ", supports compris" : ""}). Le trancheur donnera les valeurs exactes.
        </p>
      </Card>

      {/* Versions */}
      <Card icon={<IconHistory size={15} />} title="Ajuster et comparer">
        <VariantButtons onAdjust={onAdjust} onCompare={onCompare} disabled={busy} canCompare={comparable} />
        <p className="mt-2 text-[11px] text-ink-mute">Chaque ajustement crée une nouvelle version : la précédente est conservée.</p>
        {versions.length > 1 && (
          <ul className="mt-3 space-y-1">
            {versions.map((v) => (
              <li key={v.id}>
                <button
                  type="button"
                  onClick={() => onSelect(v.id)}
                  className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[12px] transition ${v.id === item.id ? "bg-brand-accent/10 text-brand-accent" : "hover:bg-paper"}`}
                >
                  <span className="min-w-0 flex-1 truncate font-medium">{v.title ?? v.prompt}</span>
                  {v.design?.variante && <span className="chip bg-paper text-ink-soft">{v.design.variante.libelle}</span>}
                  <span className="shrink-0 text-[10.5px] text-ink-mute">{formatRelative(v.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Plans cotés */}
      <PlanCard design={design} allowed={features.exportPng} onToast={onToast} />

      {/* Exports */}
      <Card icon={<IconDownload size={15} />} title="Exports 3D">
        <ExportButtons design={design} features={features} onToast={onToast} />
      </Card>

      {/* Où fabriquer */}
      <Card icon={<IconExternal size={15} />} title="Où fabriquer" className="md:col-span-2 xl:col-span-1">
        <ul className="space-y-1.5">
          {fabricationLinks(design, material.label).map((l) => (
            <li key={l.url}>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="block rounded-xl border border-line p-2.5 transition hover:border-brand-accent/50">
                <span className="flex items-center gap-1.5 text-[12px] font-semibold text-brand-accent">
                  {l.label} <IconExternal size={11} />
                </span>
                <span className="text-[11px] text-ink-mute">{l.description}</span>
              </a>
            </li>
          ))}
        </ul>
        <p className="label !mb-1 mt-4">Liste d&apos;achats</p>
        <ul className="divide-y divide-line/70 rounded-xl border border-line">
          {shoppingList(design, estimate).map((s, i) => (
            <li key={i} className="flex items-center gap-2 px-2.5 py-2 text-[11.5px]">
              <span className="min-w-0 flex-1">
                <span className="font-medium text-ink">{s.item}</span>
                <span className="block text-ink-mute">{s.quantity}</span>
              </span>
              <span className="shrink-0 text-right tabular-nums text-ink-soft">{s.estimate ?? "prix à vérifier"}</span>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="icon-btn !h-7 !w-7 shrink-0" aria-label={`Rechercher « ${s.item} »`}>
                <IconExternal size={12} />
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[10.5px] text-ink-mute">Liens de recherche génériques ; prix estimés, à vérifier chez le vendeur.</p>
      </Card>
    </div>
  );
}

function PlanCard({ design, allowed, onToast }: { design: Design; allowed: boolean; onToast(m: string): void }) {
  const [sheet, setSheet] = useState<{ canvas: HTMLCanvasElement; url: string } | null>(null);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSheet(null);
    setError(false);
    const timer = setTimeout(() => {
      try {
        const canvas = renderPlanSheet(design);
        if (!cancelled) setSheet({ canvas, url: canvas.toDataURL("image/png") });
      } catch (err) {
        console.error(err);
        if (!cancelled) setError(true);
      }
    }, 60);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [design]);

  const download = async (kind: "pdf" | "png") => {
    if (!sheet) return;
    setBusy(true);
    try {
      const name = `${fileBaseName(design)}-plan`;
      if (kind === "png") {
        const blob = await canvasToPngBlob(sheet.canvas);
        if (!blob) throw new Error("PNG vide");
        downloadBlob(blob, `${name}.png`);
      } else {
        downloadBlob(await canvasToPdfBlob(sheet.canvas, design.title), `${name}.pdf`);
      }
    } catch (err) {
      console.error(err);
      onToast("Export du plan impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card icon={<IconRuler size={15} />} title="Plans cotés" className="md:col-span-2 xl:col-span-2">
      <div className="flex min-h-[180px] items-center justify-center overflow-hidden rounded-xl border border-line bg-white">
        {sheet ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sheet.url} alt={`Plan coté : vues de face, de droite et de dessus de « ${design.title} »`} className="h-auto w-full" />
        ) : error ? (
          <p className="p-4 text-xs text-ink-mute">Le plan n&apos;a pas pu être dessiné sur cet appareil (WebGL indisponible).</p>
        ) : (
          <Spinner size={20} />
        )}
      </div>
      {allowed && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={!sheet || busy} onClick={() => download("pdf")} className="btn-accent !py-2 !text-xs">
            <IconDownload size={14} /> Plan PDF (A4)
          </button>
          <button type="button" disabled={!sheet || busy} onClick={() => download("png")} className="btn-ghost !py-2 !text-xs">
            <IconDownload size={14} /> Plan PNG
          </button>
        </div>
      )}
      <p className="mt-2 text-[10.5px] text-ink-mute">Vues de face, de droite et de dessus à échelle normalisée, cotes hors-tout en millimètres.</p>
    </Card>
  );
}

function ExportButtons({ design, features, onToast }: { design: Design; features: StudioFeatures; onToast(m: string): void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (err) {
      console.error(err);
      onToast(`${label} impossible.`);
    } finally {
      setBusy(null);
    }
  };
  const base = fileBaseName(design);
  const buttons = [
    features.exportStl && {
      label: "STL",
      hint: "Impression 3D (mm)",
      run: () => run("Export STL", async () => downloadBlob(new Blob([exportStl(design)], { type: "model/stl" }), `${base}.stl`)),
    },
    features.exportGlb && {
      label: "GLB",
      hint: "3D en couleurs",
      run: () => run("Export GLB", async () => downloadBlob(new Blob([await exportGlb(design)], { type: "model/gltf-binary" }), `${base}.glb`)),
    },
    features.exportPng && {
      label: "PNG",
      hint: "Image 3D",
      run: () =>
        run("Capture PNG", async () => {
          const blob = await canvasToPngBlob(renderSnapshot(design));
          if (!blob) throw new Error("PNG vide");
          downloadBlob(blob, `${base}.png`);
        }),
    },
  ].filter(Boolean) as { label: string; hint: string; run(): void }[];

  if (!buttons.length) return <p className="text-xs text-ink-mute">Les exports sont désactivés par l&apos;administrateur.</p>;
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          onClick={b.run}
          disabled={busy !== null}
          className="flex flex-col items-center rounded-xl border border-line bg-white px-2 py-3 transition hover:border-brand-accent/50 disabled:opacity-50"
        >
          <span className="text-[13px] font-bold text-brand-accent">{busy?.includes(b.label) ? <Spinner size={14} /> : b.label}</span>
          <span className="mt-0.5 text-[10.5px] text-ink-mute">{b.hint}</span>
        </button>
      ))}
    </div>
  );
}
