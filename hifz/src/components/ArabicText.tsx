"use client";

import { useSettings } from "@/components/providers/SettingsProvider";

/** Texte coranique affiché tel quel (RTL, police et taille des réglages). */
export function ArabicText({ text, className = "", size }: { text: string; className?: string; size?: "sm" }) {
  const { settings } = useSettings();
  return (
    <p
      dir="rtl"
      lang="ar"
      data-font={settings.arabicFont}
      className={`quran-text ${className}`}
      style={size === "sm" ? { fontSize: "calc(var(--quran-size) * 0.72)" } : undefined}
    >
      {text}
    </p>
  );
}
