"use client";

import { useState } from "react";
import type { GlyphShape } from "@/lib/design/ops";
import { TEXT_FONTS, loadTextFont, textGlyphs, type TextFontId } from "@/lib/three/text";
import { Spinner } from "../../icons";
import { useT } from "../../app/Preferences";
import { Choice, NumInput, Sheet } from "./Sheet";

/**
 * Texte en relief (lettres posées sur la pièce sélectionnée, ou au sol) ou gravé (creusé dans un pavé sélectionné).
 * La police est chargée seulement à ce moment-là.
 */
export function TextDialog({
  supportName,
  supportIsBox,
  onClose,
  onSubmit,
}: {
  supportName: string | null;
  supportIsBox: boolean;
  onClose(): void;
  onSubmit(input: { glyphs: GlyphShape[]; mode: "relief" | "engrave"; depth: number; text: string }): string | null;
}) {
  const t = useT();
  const [text, setText] = useState("Forma3D");
  const [font, setFont] = useState<TextFontId>("helvetiker-bold");
  const [size, setSize] = useState(12);
  const [depth, setDepth] = useState(2);
  const [mode, setMode] = useState<"relief" | "engrave">("relief");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const f = await loadTextFont(font);
      const glyphs = textGlyphs(f, text.trim(), Math.max(2, Math.min(200, size)));
      if (!glyphs.length) throw new Error("empty");
      const problem = onSubmit({ glyphs, mode, depth: Math.max(0.4, Math.min(50, depth)), text: text.trim() });
      if (problem) setError(problem);
      else onClose();
    } catch {
      setError(t("text.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title={t("add.textTitle")} onClose={onClose}>
      <div className="space-y-3">
        <label className="block">
          <span className="label !mb-1">{t("text.content")}</span>
          <input className="input" value={text} maxLength={40} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} />
        </label>
        <label className="block">
          <span className="label !mb-1">{t("text.font")}</span>
          <select className="input" value={font} onChange={(e) => setFont(e.target.value as TextFontId)}>
            {(Object.keys(TEXT_FONTS) as TextFontId[]).map((id) => (
              <option key={id} value={id}>
                {TEXT_FONTS[id].label}
              </option>
            ))}
          </select>
        </label>
        <Choice
          label={t("text.mode")}
          value={mode}
          onChange={setMode}
          options={[
            { id: "relief", label: t("text.relief") },
            { id: "engrave", label: t("text.engrave") },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumInput label={t("text.size")} value={size} onChange={setSize} unit="mm" min={2} max={200} />
          <NumInput label={mode === "engrave" ? t("text.engraveDepth") : t("text.height")} value={depth} onChange={setDepth} unit="mm" min={0.4} max={50} step={0.2} />
        </div>
        <p className="text-[11.5px] leading-snug text-ink-mute">
          {mode === "engrave"
            ? supportIsBox
              ? t("text.engraveOn", { name: supportName ?? "" })
              : t("text.engraveNeedsBox")
            : supportName
              ? t("text.reliefOn", { name: supportName })
              : t("text.reliefGround")}
        </p>
        <p className="text-[11px] text-ink-mute">{t("text.latinOnly")}</p>
        {error && <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-500">{error}</p>}
        <button type="button" onClick={submit} disabled={busy || (mode === "engrave" && !supportIsBox)} className="btn-neon w-full !py-2.5">
          {busy && <Spinner size={14} />} {t("text.add")}
        </button>
      </div>
    </Sheet>
  );
}
