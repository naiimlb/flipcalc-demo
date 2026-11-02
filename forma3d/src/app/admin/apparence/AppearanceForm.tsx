"use client";

import { useRef, useState } from "react";
import { IconCube, LogoMark } from "@/components/icons";
import { DEFAULT_SITE, type SiteSettings } from "@/lib/settings";
import { saveSiteSettings } from "../actions";
import { ResultMessage, useSave } from "../useSave";

async function logoToDataUrl(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    if (file.size > 100_000) throw new Error("SVG trop lourd (100 Ko max).");
    const text = await file.text();
    return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
  }
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

const TEXT_FIELDS: { key: keyof SiteSettings; label: string; max: number; long?: boolean }[] = [
  { key: "siteName", label: "Nom du site", max: 40 },
  { key: "heroPill", label: "Mot dans la pastille noire", max: 24 },
  { key: "heroTitle", label: "Suite du titre (ligne 1)", max: 60 },
  { key: "heroTitleLine2", label: "Titre (ligne 2)", max: 60 },
  { key: "heroSubtitle", label: "Sous-titre", max: 260, long: true },
  { key: "footerText", label: "Pied de page", max: 160 },
];

const COLOR_FIELDS: { key: "colorFrom" | "colorTo" | "accent"; label: string }[] = [
  { key: "colorFrom", label: "Dégradé : début" },
  { key: "colorTo", label: "Dégradé : fin" },
  { key: "accent", label: "Couleur d'accent" },
];

export function AppearanceForm({ initial }: { initial: SiteSettings }) {
  const [site, setSite] = useState<SiteSettings>(initial);
  const { pending, result, run, setResult } = useSave();
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) => setSite((s) => ({ ...s, [key]: value }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form
        className="panel space-y-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSiteSettings(site));
        }}
      >
        {TEXT_FIELDS.map((f) => (
          <div key={f.key}>
            <label className="label" htmlFor={f.key}>
              {f.label}
            </label>
            {f.long ? (
              <textarea
                id={f.key}
                rows={3}
                maxLength={f.max}
                value={site[f.key] as string}
                onChange={(e) => set(f.key, e.target.value as never)}
                className="input resize-none"
              />
            ) : (
              <input id={f.key} maxLength={f.max} value={site[f.key] as string} onChange={(e) => set(f.key, e.target.value as never)} className="input" />
            )}
          </div>
        ))}

        <div className="grid grid-cols-3 gap-3">
          {COLOR_FIELDS.map((c) => (
            <div key={c.key}>
              <label className="label" htmlFor={c.key}>
                {c.label}
              </label>
              <div className="flex items-center gap-2 rounded-xl border border-line bg-surface p-1.5">
                <input id={c.key} type="color" value={site[c.key]} onChange={(e) => set(c.key, e.target.value)} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent" />
                <span className="font-mono text-xs">{site[c.key]}</span>
              </div>
            </div>
          ))}
        </div>

        <div>
          <p className="label">Logo</p>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface ring-1 ring-line">
              {site.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={site.logoDataUrl} alt="Logo" className="h-9 w-9 object-contain" />
              ) : (
                <LogoMark size={30} />
              )}
            </span>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  set("logoDataUrl", await logoToDataUrl(file));
                } catch (err) {
                  setResult({ ok: false, message: err instanceof Error ? err.message : "Logo illisible." });
                }
              }}
            />
            <button type="button" className="btn-ghost !text-xs" onClick={() => fileInput.current?.click()}>
              Choisir une image
            </button>
            {site.logoDataUrl && (
              <button type="button" className="btn !text-xs text-rose-600" onClick={() => set("logoDataUrl", null)}>
                Retirer
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button type="submit" disabled={pending} className="btn-dark">
            {pending ? "Enregistrement…" : "Enregistrer et publier"}
          </button>
          <button type="button" className="btn-ghost" onClick={() => setSite(DEFAULT_SITE)}>
            Valeurs par défaut
          </button>
          <ResultMessage result={result} />
        </div>
      </form>

      {/* Aperçu en direct */}
      <div className="xl:sticky xl:top-6 xl:self-start">
        <p className="label">Aperçu en direct</p>
        <div className="overflow-hidden rounded-3xl p-5" style={{ background: `linear-gradient(135deg, ${site.colorFrom}, ${site.colorTo})` }}>
          <div className="rounded-[24px] bg-paper p-6 text-center shadow-card">
            <div className="flex items-center gap-2 text-left text-sm font-semibold">
              {site.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={site.logoDataUrl} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <LogoMark size={20} />
              )}
              {site.siteName}
            </div>
            <p className="mt-6 text-[1.9rem] font-semibold leading-[1.08] tracking-[-0.03em]">
              {site.heroPill && (
                <span className="mr-2 inline-flex items-center gap-1.5 rounded-full bg-night px-3 py-0.5 text-white">
                  {site.heroPill}
                  <IconCube size={22} strokeWidth={1.5} />
                </span>
              )}
              {site.heroTitle}
              <span className="block">{site.heroTitleLine2}</span>
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-mute">{site.heroSubtitle}</p>
            <span className="btn mt-4 text-white" style={{ background: site.accent }}>
              Nouvelle demande
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
