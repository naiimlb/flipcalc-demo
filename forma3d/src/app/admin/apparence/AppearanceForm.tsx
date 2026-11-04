"use client";

import { useRef, useState } from "react";
import { LogoMark } from "@/components/icons";
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

        {/* Les couleurs ne se règlent plus ici : le système de design fixe un accent unique et des surfaces neutres (voir /design-system). */}
        <p className="text-xs text-ink-mute">
          Couleurs : fixées par le système de design (accent unique, surfaces neutres, contraste vérifié).{" "}
          <a href="/design-system" className="text-accent underline-offset-2 hover:underline">
            Voir /design-system
          </a>
        </p>

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
              <button type="button" className="btn !text-xs text-danger" onClick={() => set("logoDataUrl", null)}>
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
        <div className="overflow-hidden rounded-lg border border-line bg-canvas p-5">
          <div className="rounded-lg bg-paper p-6 text-center border border-line">
            <div className="flex items-center gap-2 text-left text-sm font-semibold">
              {site.logoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={site.logoDataUrl} alt="" className="h-6 w-6 object-contain" />
              ) : (
                <LogoMark size={20} />
              )}
              {site.siteName}
            </div>
            <p className="mt-6 text-3xl font-semibold leading-[1.08] tracking-tight">
              {site.heroPill} {site.heroTitle} {site.heroTitleLine2}
            </p>
            <p className="mx-auto mt-3 max-w-sm text-sm text-ink-mute">{site.heroSubtitle}</p>
            <span className="btn-primary mt-4">
              Nouvelle demande
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
