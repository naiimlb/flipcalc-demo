"use client";

import { useState } from "react";
import type { PublicAsset } from "@/lib/requests";
import { IconCheck, IconCoin, IconX, Spinner } from "../../icons";
import { useT } from "../../app/Preferences";
import { Sheet } from "./Sheet";

export type MeshyKind = "preview" | "refine" | "retexture" | "remesh" | "resize" | "repair" | "analyze";

export interface MeshyStatus {
  available: boolean;
  costs?: Record<MeshyKind, number>;
  /** Crédits Forma3D disponibles (null = illimité). */
  balance?: number | null;
  unlimited?: boolean;
}

export interface MeshyRun {
  kind: MeshyKind;
  texturePrompt?: string;
  polycount?: number;
}

/** Confirmation avant toute action Meshy : coût en crédits, solde avant / après, refus si le solde ne suffit pas. */
export function CostConfirm({ label, cost, balance, onConfirm, onClose }: { label: string; cost: number; balance: number | null | undefined; onConfirm(): Promise<void>; onClose(): void }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const enough = balance === null || balance === undefined || balance >= cost;
  return (
    <Sheet title={label} onClose={onClose}>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-paper p-3">
          <dt className="text-xs font-semibold text-ink-mute">{t("meshy.cost")}</dt>
          <dd className="text-lg font-bold">{cost === 0 ? t("meshy.free") : t("credits.badge", { n: cost })}</dd>
        </div>
        <div className="rounded-xl bg-paper p-3">
          <dt className="text-xs font-semibold text-ink-mute">{t("meshy.after")}</dt>
          <dd className="text-lg font-bold">{balance === null || balance === undefined ? "∞" : t("credits.badge", { n: Math.max(0, balance - cost) })}</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-snug text-ink-mute">{t("meshy.chargeOnSuccess")}</p>
      {!enough && <p className="mt-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-semibold text-danger">{t("meshy.notEnough")}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" className="btn-ghost flex-1" onClick={onClose}>
          {t("meshy.cancel")}
        </button>
        <button
          type="button"
          className="btn-neon flex-1"
          disabled={!enough || busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy && <Spinner size={13} />} {t("meshy.confirm")}
        </button>
      </div>
    </Sheet>
  );
}

function CostButton({ label, cost, onClick, disabled }: { label: string; cost: number | undefined; onClick(): void; disabled?: boolean }) {
  const t = useT();
  return (
    <button type="button" className="btn-ghost tap w-full justify-between !rounded-xl !px-3 !py-2 !text-xs" onClick={onClick} disabled={disabled}>
      <span>{label}</span>
      <span className="chip gap-1 border border-line font-mono text-ink-soft">{cost === 0 ? t("meshy.free") : <><IconCoin size={16} className="h-3.5 w-3.5" />{cost ?? "?"}</>}</span>
    </button>
  );
}

const KINDS: MeshyKind[] = ["preview", "refine", "retexture", "remesh", "resize", "repair", "analyze"];
const asKind = (k: string | undefined): MeshyKind => (KINDS as string[]).includes(k ?? "") ? (k as MeshyKind) : "preview";
type Health = "healthy" | "warning" | "error" | "unknown";
const asHealth = (s: string): Health => (["healthy", "warning", "error"].includes(s) ? (s as Health) : "unknown");

function progressLabel(t: ReturnType<typeof useT>, asset: PublicAsset | null) {
  if (!asset || !asset.key) return null;
  if (asset.status === "pending" || asset.status === "running") return t("meshy.running", { action: t(`meshy.kind.${asKind(asset.kind)}`), n: asset.progress });
  if (asset.status === "failed") return asset.error ?? t("meshy.failedShort");
  return null;
}

/**
 * Onglet Matière : modèle 3D détaillé Meshy (générer, texturer, régénérer une variante, simplifier, mettre à l'échelle réelle),
 * retexturage par description, et versions Meshy du projet. Chaque bouton affiche son coût.
 */
export function MeshyModelPanel({
  status,
  asset,
  busy,
  onRun,
  showMesh,
  onShowMesh,
  meshKey,
  onMeshKey,
}: {
  status: MeshyStatus;
  asset: PublicAsset | null;
  busy: boolean;
  onRun(run: MeshyRun): void;
  showMesh: boolean;
  onShowMesh(v: boolean): void;
  meshKey: string | null;
  onMeshKey(key: string | null): void;
}) {
  const t = useT();
  const [texture, setTexture] = useState("");
  const [poly, setPoly] = useState(15_000);
  const costs = status.costs;
  const hasMesh = Boolean(asset?.key && asset.status === "succeeded");
  const running = asset?.status === "pending" || asset?.status === "running";
  const info = progressLabel(t, asset);
  return (
    <section className="panel space-y-2.5 p-3" aria-label={t("meshy.title")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-ink">{t("meshy.title")}</p>
        {hasMesh && (
          <label className="flex items-center gap-1.5 text-xs text-ink-soft">
            <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--neon-blue))]" checked={showMesh} onChange={(e) => onShowMesh(e.target.checked)} />
            {t("meshy.showMesh")}
          </label>
        )}
      </div>
      {info && (
        <p className="flex items-center gap-2 rounded-xl bg-paper px-3 py-2 text-xs text-ink-soft" aria-live="polite">
          {running && <Spinner size={12} />} {info}
        </p>
      )}
      <div className="space-y-1.5">
        <CostButton label={hasMesh ? t("meshy.variant") : t("meshy.generate")} cost={costs?.preview} onClick={() => onRun({ kind: "preview" })} disabled={busy || running} />
        {hasMesh && asset?.kind === "preview" && <CostButton label={t("meshy.texture")} cost={costs?.refine} onClick={() => onRun({ kind: "refine" })} disabled={busy || running} />}
        {hasMesh && (
          <>
            <div className="flex items-center gap-1.5">
              <select className="input !w-auto !py-1.5 !text-xs" value={poly} onChange={(e) => setPoly(Number(e.target.value))} aria-label={t("meshy.polycount")}>
                {[5_000, 15_000, 30_000, 100_000].map((n) => (
                  <option key={n} value={n}>
                    {n.toLocaleString()} {t("meshy.faces")}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1">
                <CostButton label={t("meshy.remesh")} cost={costs?.remesh} onClick={() => onRun({ kind: "remesh", polycount: poly })} disabled={busy || running} />
              </div>
            </div>
            <CostButton label={t("meshy.resize")} cost={costs?.resize} onClick={() => onRun({ kind: "resize" })} disabled={busy || running} />
          </>
        )}
      </div>
      <div className="space-y-1.5 border-t border-line pt-2.5">
        <label className="block">
          <span className="label !mb-1">{t("meshy.describeTexture")}</span>
          <textarea
            className="input min-h-[64px] !py-2 !text-xs"
            maxLength={600}
            value={texture}
            placeholder={t("meshy.texturePlaceholder")}
            onChange={(e) => setTexture(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
          />
        </label>
        <CostButton label={t("meshy.retexture")} cost={costs?.retexture} onClick={() => onRun({ kind: "retexture", texturePrompt: texture })} disabled={busy || running || texture.trim().length < 3} />
      </div>
      {asset?.history && asset.history.length > 0 && (
        <div className="border-t border-line pt-2.5">
          <p className="mb-1 text-xs font-semibold text-ink-mute">{t("meshy.versions")}</p>
          <div className="flex flex-wrap gap-1">
            {[{ key: asset.key ?? "", kind: asset.kind ?? "preview", current: true }, ...asset.history.map((h) => ({ ...h, current: false }))].map((v, i) => (
              <button
                key={v.key || i}
                type="button"
                onClick={() => {
                  onMeshKey(v.current ? null : v.key);
                  onShowMesh(true);
                }}
                className={`tap rounded-lg px-2 py-1 text-xs font-semibold ${(meshKey ?? asset.key) === v.key ? "bg-neon-blue-strong text-white" : "bg-paper text-ink-soft"}`}
              >
                {t(`meshy.kind.${asKind(v.kind)}`)}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/** Onglet Fabrication : analyse d'imprimabilité (gratuite) et réparation pour l'impression par Meshy. */
export function MeshyPrintPanel({ status, asset, busy, onRun }: { status: MeshyStatus; asset: PublicAsset | null; busy: boolean; onRun(run: MeshyRun): void }) {
  const t = useT();
  const analysis = asset?.analysis ?? null;
  const running = analysis?.status === "pending" || analysis?.status === "running";
  const meshRunning = asset?.status === "pending" || asset?.status === "running";
  const result = analysis?.result ?? null;
  const tone = result?.status === "healthy" ? "text-success" : result?.status === "error" ? "text-danger" : "text-warning";
  return (
    <section className="panel space-y-2.5 p-3" aria-label={t("meshy.printTitle")}>
      <p className="text-sm font-semibold text-ink">{t("meshy.printTitle")}</p>
      <CostButton label={t("meshy.analyze")} cost={status.costs?.analyze} onClick={() => onRun({ kind: "analyze" })} disabled={busy || running} />
      {running && (
        <p className="flex items-center gap-2 text-xs text-ink-soft">
          <Spinner size={12} /> {t("meshy.analyzing", { n: analysis?.progress ?? 0 })}
        </p>
      )}
      {result && (
        <div className="rounded-xl bg-paper p-2.5 text-xs">
          <p className={`font-bold ${tone}`}>{t(`meshy.health.${asHealth(result.status)}`)}</p>
          <p className="mt-0.5 text-ink-soft">{t("meshy.issues", { e: result.errorCount, w: result.warningCount })}</p>
          <ul className="mt-1 space-y-0.5 text-ink-mute">
            {Object.entries(result.metrics).map(([k, v]) => (
              <li key={k} className="flex justify-between gap-2">
                <span>{k.replace(/_/g, " ")}</span>
                <span className="font-mono">{v === true ? <IconCheck size={16} className="h-3.5 w-3.5 text-success" /> : v === false ? <IconX size={16} className="h-3.5 w-3.5 text-danger" /> : v ?? "—"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {analysis?.status === "failed" && <p className="text-xs text-danger">{analysis.error ?? t("meshy.failedShort")}</p>}
      <CostButton label={t("meshy.repair")} cost={status.costs?.repair} onClick={() => onRun({ kind: "repair" })} disabled={busy || meshRunning} />
      <p className="text-xs leading-snug text-ink-mute">{t("meshy.repairHint")}</p>
    </section>
  );
}
