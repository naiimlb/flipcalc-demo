"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { LOCALES, LOCALE_NAMES } from "@/lib/i18n";
import type { ThemeChoice } from "@/lib/theme";
import { usePreferences } from "./Preferences";

const THEMES: ThemeChoice[] = ["auto", "light", "dark"];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange(v: T): void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-paper p-1">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold transition ${value === o.id ? "bg-brand-accent text-white" : "text-ink-soft hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Choix du thème (auto / clair / sombre) et de la langue. */
export function PreferenceControls() {
  const { t, theme, setTheme, locale, setLocale } = usePreferences();
  return (
    <div className="space-y-3">
      <div>
        <p className="label">{t("pref.theme")}</p>
        <Segmented
          value={theme}
          onChange={setTheme}
          label={t("pref.theme")}
          options={THEMES.map((id) => ({ id, label: t(`theme.${id}`) }))}
        />
      </div>
      <div>
        <p className="label">{t("pref.language")}</p>
        <Segmented value={locale} onChange={setLocale} label={t("pref.language")} options={LOCALES.map((id) => ({ id, label: LOCALE_NAMES[id] }))} />
      </div>
    </div>
  );
}

/** Bouton compact de l'en-tête (soleil / lune) qui ouvre les préférences. */
export function PreferenceMenuButton() {
  const { t, dark, locale } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${t("pref.theme")} · ${t("pref.language")} · ${locale}`}
        title={`${t("pref.theme")} · ${t("pref.language")}`}
        className="tap flex h-9 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-bold uppercase text-fg/80 hover:bg-fg/10 hover:text-fg"
      >
        <span aria-hidden>{dark ? "☾" : "☀"}</span>
        <span>{locale}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute end-0 top-10 z-40 w-64 rounded-2xl border border-line bg-surface p-3 text-ink shadow-float"
          >
            <PreferenceControls />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
