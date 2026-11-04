"use client";

import { useState } from "react";
import { FINISH_PRESETS } from "@/lib/design/finishes";
import { FINISHES, type Finish, type Part } from "@/lib/design/schema";
import type { LightingPreset, ViewerBackground, ViewerSettings } from "../../viewer/settings";
import { IconCamera, IconVideo, Spinner } from "../../icons";
import { useT } from "../../app/Preferences";
import { Choice } from "./Sheet";

/** Bibliothèque de matières (PLA, PETG, ABS, résine, bois, métal, verre, caoutchouc), appliquée à la pièce ou au modèle. */
export function MaterialLibrary({ part, editable, onApply }: { part: Part | null; editable: boolean; onApply(finish: Finish, withColor: boolean): void }) {
  const t = useT();
  const [withColor, setWithColor] = useState(true);
  return (
    <section className="panel space-y-2.5 p-3" aria-label={t("lib.title")}>
      <p className="text-sm font-semibold text-ink">{part ? t("lib.forPart", { name: part.name }) : t("lib.forModel")}</p>
      <div className="grid grid-cols-4 gap-1.5">
        {FINISHES.map((id) => {
          const preset = FINISH_PRESETS[id];
          const active = part?.finish === id;
          return (
            <button
              key={id}
              type="button"
              disabled={!editable}
              aria-pressed={active}
              onClick={() => onApply(id, withColor)}
              className={`tap flex flex-col items-center gap-1 rounded-xl p-1.5 text-xs font-semibold transition disabled:opacity-50 ${active ? "bg-neon-blue/15 text-ink ring-1 ring-neon-blue/50" : "text-ink-soft hover:bg-paper"}`}
            >
              <span
                aria-hidden
                className="h-8 w-8 rounded-full ring-1 ring-black/10"
                style={{
                  background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,${0.75 - preset.roughness * 0.6}), transparent 45%), ${preset.color}`,
                  opacity: Math.max(0.55, preset.opacity),
                }}
              />
              {t(`finish.${id}`)}
            </button>
          );
        })}
      </div>
      <label className="flex items-center justify-between gap-2 text-xs text-ink-soft">
        {t("lib.withColor")}
        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--neon-blue))]" checked={withColor} onChange={(e) => setWithColor(e.target.checked)} />
      </label>
    </section>
  );
}

/** Éclairage, fond, ombres, capture haute qualité et vidéo de rotation à 360°. */
export function RenderPanel({
  settings,
  onSettings,
  onCapture,
  onVideo,
  canVideo,
}: {
  settings: ViewerSettings;
  onSettings(patch: Partial<ViewerSettings>): void;
  onCapture(): Promise<void>;
  onVideo(seconds: number): Promise<void>;
  canVideo: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState<"capture" | "video" | null>(null);
  const run = async (kind: "capture" | "video", task: () => Promise<void>) => {
    setBusy(kind);
    try {
      await task();
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="panel space-y-2.5 p-3" aria-label={t("render.title")}>
      <p className="text-sm font-semibold text-ink">{t("render.title")}</p>
      <p className="text-xs font-semibold text-ink-mute">{t("render.lighting")}</p>
      <Choice<LightingPreset>
        label={t("render.lighting")}
        value={settings.mode === "real" ? settings.lighting ?? "studio" : "studio"}
        onChange={(lighting) => onSettings({ lighting, mode: "real" })}
        options={[
          { id: "studio", label: t("render.studio") },
          { id: "neon", label: t("render.neon") },
          { id: "day", label: t("render.day") },
        ]}
      />
      <p className="text-xs font-semibold text-ink-mute">{t("render.background")}</p>
      <Choice<ViewerBackground>
        label={t("render.background")}
        value={settings.background ?? "auto"}
        onChange={(background) => onSettings({ background })}
        options={[
          { id: "auto", label: t("render.bgAuto") },
          { id: "night", label: t("render.bgNight") },
          { id: "light", label: t("render.bgLight") },
          { id: "neon", label: t("render.bgNeon") },
        ]}
      />
      <label className="flex items-center justify-between gap-2 text-xs text-ink-soft">
        {t("render.shadows")}
        <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--neon-blue))]" checked={settings.shadows !== false} onChange={(e) => onSettings({ shadows: e.target.checked, mode: "real" })} />
      </label>
      <div className="grid grid-cols-2 gap-1.5 pt-1">
        <button type="button" className="btn-ghost tap !px-2 !py-2 !text-xs" disabled={busy !== null} onClick={() => run("capture", onCapture)}>
          {busy === "capture" ? <Spinner size={12} /> : <IconCamera size={13} />} {t("render.capture")}
        </button>
        {canVideo && (
          <button type="button" className="btn-ghost tap !px-2 !py-2 !text-xs" disabled={busy !== null} onClick={() => run("video", () => onVideo(8))}>
            {busy === "video" ? <Spinner size={12} /> : <IconVideo />} {busy === "video" ? t("render.recording") : t("render.video")}
          </button>
        )}
      </div>
    </section>
  );
}
