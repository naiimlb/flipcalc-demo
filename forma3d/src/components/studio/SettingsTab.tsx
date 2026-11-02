"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/actions";
import { IconLogout, IconShield } from "../icons";
import {
  getInstallPrompt,
  isAppleTouchDevice,
  isInstalledApp,
  onInstallPromptChange,
} from "@/lib/install-prompt";
import type { LengthUnit } from "./format";
import type { StudioPrefs, StudioViewer } from "./types";
import { Toggle } from "./ui";
import { PreferenceControls } from "../app/PreferencePicker";
import { useT } from "../app/Preferences";

const UNITS: { id: LengthUnit; label: "settings.mm" | "settings.cm" | "settings.in" }[] = [
  { id: "mm", label: "settings.mm" },
  { id: "cm", label: "settings.cm" },
  { id: "in", label: "settings.in" },
];

export function SettingsTab({
  prefs,
  onPrefs,
  viewer,
  demoMode,
}: {
  prefs: StudioPrefs;
  onPrefs(patch: Partial<StudioPrefs>): void;
  viewer: StudioViewer | null;
  demoMode: boolean;
}) {
  const t = useT();
  return (
    <div className="grid gap-3 overflow-y-auto pb-1 scrollbar-thin md:grid-cols-2 lg:h-full">
      <section className="panel p-4">
        <h3 className="text-sm font-semibold">{t("settings.appearance")}</h3>
        <p className="mt-0.5 text-xs text-ink-mute">{t("settings.appearanceHint")}</p>
        <div className="mt-4">
          <PreferenceControls />
        </div>
      </section>

      <section className="panel p-4">
        <h3 className="text-sm font-semibold">{t("settings.display")}</h3>
        <p className="mt-0.5 text-xs text-ink-mute">{t("settings.local")}</p>
        <div className="mt-4 space-y-4">
          <div>
            <p className="label">{t("settings.render")}</p>
            <div className="flex gap-1 rounded-full bg-paper p-1">
              {(
                [
                  ["neon", t("mode.neon")],
                  ["real", t("mode.real")],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onPrefs({ mode: id })}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${prefs.mode === id ? "bg-brand-accent text-white" : "text-ink-soft"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="label">{t("settings.units")}</p>
            <div className="flex gap-1 rounded-full bg-paper p-1">
              {UNITS.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onPrefs({ unit: u.id })}
                  className={`flex-1 rounded-full px-3 py-1.5 text-xs font-semibold ${prefs.unit === u.id ? "bg-brand-accent text-white" : "text-ink-soft"}`}
                >
                  {t(u.label)}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("settings.autoRotate")}
            <Toggle checked={prefs.autoRotate} onChange={(v) => onPrefs({ autoRotate: v })} label={t("settings.autoRotate")} />
          </label>
          <label className="flex items-center justify-between gap-3 text-sm">
            {t("settings.grid")}
            <Toggle checked={prefs.showGrid} onChange={(v) => onPrefs({ showGrid: v })} label={t("settings.grid")} />
          </label>
        </div>
      </section>

      <InstallApp />

      <section className="panel p-4">
        <h3 className="text-sm font-semibold">{t("settings.account")}</h3>
        {viewer ? (
          <>
            <p className="mt-3 text-sm">{viewer.displayName ?? viewer.email}</p>
            <p className="text-xs text-ink-mute">{viewer.email}</p>
            <p className="mt-2">
              <span className={`chip ${viewer.role === "admin" ? "bg-night text-white" : "bg-paper text-ink-soft"}`}>
                {viewer.role === "admin" ? t("menu.administrator") : t("settings.user")}
              </span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/espace" className="btn-accent !text-xs">
                {t("nav.space")}
              </Link>
              {viewer.role === "admin" && (
                <Link href="/admin" className="btn-dark !text-xs">
                  <IconShield size={14} /> {t("menu.administration")}
                </Link>
              )}
              <form action={signOut}>
                <button type="submit" className="btn-ghost !text-xs">
                  <IconLogout size={14} /> {t("menu.logout")}
                </button>
              </form>
            </div>
          </>
        ) : demoMode ? (
          <p className="mt-3 text-sm text-ink-soft">{t("settings.demo")}</p>
        ) : (
          <div className="mt-3">
            <p className="text-sm text-ink-soft">{t("settings.loginHint")}</p>
            <Link href="/connexion" className="btn-dark mt-3 !text-xs">
              {t("settings.loginCta")}
            </Link>
          </div>
        )}
        <div className="mt-6 rounded-xl bg-paper p-3 text-xs leading-relaxed text-ink-soft">
          {t("settings.disclaimer")}
        </div>
      </section>
    </div>
  );
}

/** Installation sur l'écran d'accueil : bouton si le navigateur le permet, sinon le mode d'emploi (Safari). */
function InstallApp() {
  const t = useT();
  const [, refresh] = useState(0);
  const [info, setInfo] = useState<{ installed: boolean; apple: boolean } | null>(null);
  useEffect(() => {
    setInfo({ installed: isInstalledApp(), apple: isAppleTouchDevice() });
    return onInstallPromptChange(() => refresh((n) => n + 1));
  }, []);
  if (!info || info.installed) return null;
  const prompt = getInstallPrompt();

  return (
    <section className="panel p-4">
      <h3 className="text-sm font-semibold">{t("settings.app")}</h3>
      <p className="mt-0.5 text-xs text-ink-mute">{t("settings.appHint")}</p>
      {prompt ? (
        <button
          type="button"
          className="btn-accent mt-3 !text-xs"
          onClick={async () => {
            await prompt.prompt();
            await prompt.userChoice.catch(() => null);
            refresh((n) => n + 1);
          }}
        >
          {t("settings.install")}
        </button>
      ) : info.apple ? (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">{t("settings.installIos")}</p>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-ink-soft">{t("settings.installOther")}</p>
      )}
    </section>
  );
}
