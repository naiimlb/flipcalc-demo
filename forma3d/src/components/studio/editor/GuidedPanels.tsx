"use client";

import { useState } from "react";
import { VARIANT_IDS, type VariantId, type VariantIntensity } from "@/lib/design/variants";
import { IconSparkles, Spinner } from "../../icons";
import { useT } from "../../app/Preferences";

/** « Modifie la pièce » : une consigne en une phrase, appliquée par l'IA sur la scène (annulable). */
export function AiEditBox({ partName, cost, busy, onSubmit }: { partName: string | null; cost: number | null; busy: boolean; onSubmit(instruction: string): Promise<boolean> }) {
  const t = useT();
  const [text, setText] = useState("");
  const submit = async () => {
    if (text.trim().length < 3 || busy) return;
    if (await onSubmit(text.trim())) setText("");
  };
  return (
    <section className="panel space-y-2 p-3" aria-label={t("ai.title")}>
      <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-ink">
        <IconSparkles size={14} className="text-neon-blue" /> {t("ai.title")}
      </p>
      <p className="text-[11px] text-ink-mute">{partName ? t("ai.onPart", { name: partName }) : t("ai.onModel")}</p>
      <div className="flex gap-1.5">
        <input
          className="input !py-2 !text-[12.5px]"
          value={text}
          maxLength={300}
          placeholder={t("ai.placeholder")}
          aria-label={t("ai.title")}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") void submit();
          }}
        />
        <button type="button" className="btn-neon tap shrink-0 !rounded-xl !px-3 !text-xs" disabled={busy || text.trim().length < 3} onClick={submit}>
          {busy ? <Spinner size={13} /> : t("ai.apply")}
        </button>
      </div>
      {cost !== null && <p className="text-[10.5px] text-ink-mute">{cost === 0 ? t("meshy.free") : t("ai.cost", { n: cost })}</p>}
    </section>
  );
}

/** Personnalisation guidée : un curseur d'intensité par objectif, puis une nouvelle version (l'ancienne est gardée). */
export function GuidedSliders({ disabled, onRun }: { disabled: boolean; onRun(variant: VariantId, intensity: VariantIntensity): void }) {
  const t = useT();
  const [levels, setLevels] = useState<Record<VariantId, VariantIntensity>>({ smaller: 2, stronger: 2, cheaper: 2, prettier: 2 });
  return (
    <section className="panel space-y-2.5 p-3" aria-label={t("guided.title")}>
      <p className="text-[12.5px] font-semibold text-ink">{t("guided.title")}</p>
      {VARIANT_IDS.map((id) => (
        <div key={id} className="flex items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="flex justify-between text-[11.5px] font-semibold text-ink-soft">
              {t(`variant.${id}`)}
              <span className="font-medium text-ink-mute">{t(`guided.level${levels[id]}`)}</span>
            </span>
            <input
              type="range"
              min={1}
              max={3}
              step={1}
              value={levels[id]}
              onChange={(e) => setLevels((l) => ({ ...l, [id]: Number(e.target.value) as VariantIntensity }))}
              className="h-8 w-full accent-[rgb(var(--neon-blue))]"
              aria-valuetext={t(`guided.level${levels[id]}`)}
            />
          </label>
          <button type="button" className="btn-ghost tap shrink-0 !rounded-xl !px-2.5 !py-1.5 !text-[11px]" disabled={disabled} onClick={() => onRun(id, levels[id])}>
            {t("guided.run")}
          </button>
        </div>
      ))}
      <p className="text-[10.5px] text-ink-mute">{t("guided.hint")}</p>
    </section>
  );
}
