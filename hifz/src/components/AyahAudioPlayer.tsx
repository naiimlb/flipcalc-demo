"use client";

import { Icon } from "@/components/icons";
import { useSettings } from "@/components/providers/SettingsProvider";
import { Segmented, Stepper } from "@/components/Stepper";
import { useAyahAudio } from "@/lib/audio/useAyahAudio";
import { getReciter } from "@/lib/quran/catalog";
import { REPEAT } from "@/lib/storage/settings";

const SPEEDS = [
  { value: 0.75, label: "0,75×" },
  { value: 1, label: "1×" },
  { value: 1.25, label: "1,25×" },
] as const;

export function AyahAudioPlayer({ surah, ayah }: { surah: number; ayah: number }) {
  const { settings, update } = useSettings();
  const reciter = getReciter(settings.reciter);
  const audio = useAyahAudio({
    surah,
    ayah,
    reciter: reciter.id,
    repeat: settings.repeatCount,
    rate: settings.playbackRate,
    keepOffline: settings.cacheAudio,
  });
  const playing = audio.status === "playing" || audio.status === "loading";
  const speed = SPEEDS.some((s) => s.value === settings.playbackRate) ? settings.playbackRate : 1;

  return (
    <div className="rounded-3xl border border-line bg-elevated/60 p-4">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={playing ? audio.pause : audio.play}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-accent text-on-accent shadow-sm active:scale-95"
          aria-label={playing ? "Mettre en pause" : "Écouter le verset"}
        >
          <Icon name={playing ? "pause" : "play"} width={26} height={26} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{reciter.name}</p>
          <p className="text-sm text-muted" aria-live="polite">
            {audio.status === "loading"
              ? "Chargement…"
              : playing
                ? `Écoute ${audio.round + 1} sur ${settings.repeatCount}`
                : audio.offline
                  ? "Disponible hors ligne"
                  : `${settings.repeatCount} écoute${settings.repeatCount > 1 ? "s" : ""} enchaînée${settings.repeatCount > 1 ? "s" : ""}`}
          </p>
        </div>
      </div>
      {audio.error ? (
        <p role="alert" className="mt-3 text-sm text-again">
          {audio.error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon name="repeat" className="text-muted" width={20} height={20} />
          <Stepper
            label="Répétitions"
            value={settings.repeatCount}
            min={REPEAT.min}
            max={REPEAT.max}
            onChange={(v) => void update({ repeatCount: v })}
            format={(v) => `${v}×`}
          />
        </div>
        <div className="min-w-44 flex-1">
          <Segmented label="Vitesse" options={SPEEDS} value={speed} onChange={(v) => void update({ playbackRate: v })} />
        </div>
      </div>
    </div>
  );
}
