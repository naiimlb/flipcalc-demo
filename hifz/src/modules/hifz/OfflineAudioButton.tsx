"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icons";
import { useSettings } from "@/components/providers/SettingsProvider";
import { cacheAudio, isAudioCached } from "@/lib/audio/cache";
import { ayahAudioUrl } from "@/lib/quran/audio";

type State = { kind: "checking" } | { kind: "idle"; cached: number } | { kind: "running"; done: number } | { kind: "done"; failed: number };

/** Télécharge l'audio d'une plage de versets pour l'écouter sans réseau. */
export function OfflineAudioButton({ surah, from, to }: { surah: number; from: number; to: number }) {
  const { settings } = useSettings();
  const total = to - from + 1;
  const [state, setState] = useState<State>({ kind: "checking" });
  const abortRef = useRef<AbortController | null>(null);
  const urls = Array.from({ length: total }, (_, i) => ayahAudioUrl(settings.reciter, surah, from + i));
  const urlsKey = urls.join("|");

  useEffect(() => {
    let alive = true;
    void Promise.all(urlsKey.split("|").map(isAudioCached)).then((hits) => {
      if (!alive) return;
      const cached = hits.filter(Boolean).length;
      setState(cached === hits.length ? { kind: "done", failed: 0 } : { kind: "idle", cached });
    });
    return () => {
      alive = false;
      abortRef.current?.abort();
    };
  }, [urlsKey]);

  async function download() {
    const controller = new AbortController();
    abortRef.current = controller;
    let done = 0;
    let failed = 0;
    setState({ kind: "running", done });
    const queue = [...urls];
    const worker = async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        if (controller.signal.aborted) return;
        if (!(await cacheAudio(url, controller.signal))) failed++;
        done++;
        setState({ kind: "running", done });
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (!controller.signal.aborted) setState(failed ? { kind: "idle", cached: total - failed } : { kind: "done", failed: 0 });
  }

  if (state.kind === "checking") return null;
  if (state.kind === "done") {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted">
        <Icon name="check" width={18} height={18} className="text-good" /> Audio disponible hors ligne
      </p>
    );
  }
  if (state.kind === "running") {
    return (
      <p className="text-sm text-muted" aria-live="polite">
        Téléchargement de l&apos;audio… {state.done}/{total}
      </p>
    );
  }
  return (
    <button type="button" onClick={download} className="flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent">
      <Icon name="download" width={18} height={18} />
      Garder l&apos;audio hors ligne{state.cached > 0 ? ` (${state.cached}/${total} déjà gardés)` : ` (${total} versets)`}
    </button>
  );
}
