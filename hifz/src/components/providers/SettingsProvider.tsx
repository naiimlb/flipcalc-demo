"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from "react";
import { getDb, requestPersistentStorage } from "@/lib/storage/client";
import { getSettings, updateSettings } from "@/lib/storage/repository";
import { DEFAULT_SETTINGS, type Settings } from "@/lib/storage/settings";
import { applyTheme } from "@/lib/theme";

interface SettingsContextValue {
  settings: Settings;
  loaded: boolean;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  loaded: false,
  update: async () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => getSettings(getDb()), []);
  const settings = stored ?? DEFAULT_SETTINGS;

  const update = useCallback(async (patch: Partial<Settings>) => {
    await updateSettings(getDb(), patch);
  }, []);

  // Thème : appliqué à chaque changement, et suivi du système si « Système ».
  useEffect(() => {
    if (!stored) return;
    applyTheme(stored.theme);
    if (stored.theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [stored]);

  useEffect(() => {
    document.documentElement.style.setProperty("--quran-size", `${settings.arabicSize}px`);
  }, [settings.arabicSize]);

  useEffect(() => {
    void requestPersistentStorage();
  }, []);

  const value = useMemo(() => ({ settings, loaded: stored !== undefined, update }), [settings, stored, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  return useContext(SettingsContext);
}
