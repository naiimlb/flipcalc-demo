"use client";

import { useEffect, useState } from "react";
import { intlLocale } from "@/lib/i18n";
import { usePreferences } from "./Preferences";

export const CREDITS_EVENT = "forma3d:credits";

export interface CreditsSnapshot {
  total: number;
  free: number;
  bonus: number;
  renewsAt: string;
  unlimited: boolean;
}

/** Solde de crédits toujours visible dans l'en-tête (mis à jour après chaque conception). */
export function CreditsBadge({ initial }: { initial: CreditsSnapshot }) {
  const { t, locale } = usePreferences();
  const [credits, setCredits] = useState(initial);
  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<CreditsSnapshot | null>).detail;
      if (detail) setCredits(detail);
    };
    window.addEventListener(CREDITS_EVENT, onUpdate);
    return () => window.removeEventListener(CREDITS_EVENT, onUpdate);
  }, []);

  const date = credits.renewsAt ? new Date(credits.renewsAt).toLocaleDateString(intlLocale(locale), { day: "numeric", month: "long" }) : "";
  const title = credits.unlimited ? t("credits.unlimited") : t("credits.detail", { free: credits.free, bonus: credits.bonus, date });
  const empty = !credits.unlimited && credits.total <= 0;
  return (
    <span
      title={title}
      aria-label={title}
      className={`chip shrink-0 ${empty ? "bg-rose-500 text-white" : "bg-fg/10 text-fg ring-1 ring-inset ring-fg/10"}`}
      role="status"
    >
      ⚡ {credits.unlimited ? "∞" : t("credits.badge", { n: credits.total })}
    </span>
  );
}
