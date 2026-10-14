"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useReducer, useState } from "react";
import type { RecognizeResponse } from "@/app/api/recognize/route";
import { MAX_MS, MIN_MS, useRecorder, type RecorderError, type Recording } from "@/hooks/useRecorder";
import { MicButton } from "./MicButton";
import { ResultCard, ResultSkeleton } from "./ResultCard";
import { Sheet } from "./Sheet";
import { Waveform } from "./Waveform";
import { Button } from "./ui";

/** repos → écoute → analyse → résultat (ou erreur). */
type State =
  | { phase: "idle" }
  | { phase: "requesting" }
  | { phase: "listening" }
  | { phase: "analyzing" }
  | { phase: "result"; data: RecognizeResponse }
  | { phase: "error"; title: string; message: string; retry: boolean };

type Action =
  | { type: "request" }
  | { type: "listen" }
  | { type: "analyze" }
  | { type: "result"; data: RecognizeResponse }
  | { type: "error"; title: string; message: string; retry?: boolean }
  | { type: "reset" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "request":
      return state.phase === "idle" || state.phase === "result" || state.phase === "error"
        ? { phase: "requesting" }
        : state;
    case "listen":
      return state.phase === "requesting" ? { phase: "listening" } : state;
    case "analyze":
      return state.phase === "listening" ? { phase: "analyzing" } : state;
    case "result":
      return { phase: "result", data: action.data };
    case "error":
      return { phase: "error", title: action.title, message: action.message, retry: action.retry ?? true };
    case "reset":
      return { phase: "idle" };
  }
}

const MIC_ERRORS: Record<RecorderError, { title: string; message: string }> = {
  denied: {
    title: "Accès au micro refusé",
    message:
      "Grat'Coran a besoin du micro pour écouter la récitation. Sur iPhone : Réglages › Safari › Micro › Autoriser, ou touche « aA » dans la barre d'adresse › Réglages du site web › Micro. Dans l'app installée, réessaie et accepte la demande.",
  },
  "no-mic": { title: "Aucun micro détecté", message: "Branche ou active un micro, puis réessaie." },
  busy: {
    title: "Micro indisponible",
    message: "Le micro est utilisé par une autre app (appel, mémo vocal…). Ferme-la puis réessaie.",
  },
  insecure: {
    title: "Connexion non sécurisée",
    message: "Le micro n'est disponible qu'en HTTPS. Ouvre l'app depuis son adresse https://.",
  },
  unsupported: {
    title: "Enregistrement non pris en charge",
    message: "Ce navigateur ne permet pas d'enregistrer. Sur iPhone, utilise Safari (iOS 14.3 ou plus récent).",
  },
  unknown: { title: "Micro inaccessible", message: "Impossible de démarrer l'enregistrement. Réessaie." },
};

export function RecognizeScreen() {
  const router = useRouter();
  const [state, dispatch] = useReducer(reducer, { phase: "idle" });
  const [seconds, setSeconds] = useState(0);

  const send = useCallback(
    async ({ blob, mimeType }: Recording) => {
      dispatch({ type: "analyze" });
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const body = new FormData();
      body.append("audio", blob, `recitation.${ext}`);
      try {
        const res = await fetch("/api/recognize", { method: "POST", body });
        const json = await res.json().catch(() => null);
        if (res.status === 401) {
          router.replace("/login");
          return;
        }
        if (!res.ok || !json) {
          dispatch({
            type: "error",
            title: res.status === 429 ? "Un instant…" : "Analyse impossible",
            message: json?.error ?? "Le serveur n'a pas répondu correctement. Réessaie.",
          });
          return;
        }
        dispatch({ type: "result", data: json as RecognizeResponse });
        if ((json as RecognizeResponse).saved) router.prefetch("/historique");
      } catch {
        dispatch({
          type: "error",
          title: "Hors connexion",
          message: "Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.",
        });
      }
    },
    [router],
  );

  const onRecorderError = useCallback((err: RecorderError) => {
    dispatch({ type: "error", ...MIC_ERRORS[err] });
  }, []);

  const recorder = useRecorder({ onComplete: send, onError: onRecorderError });

  useEffect(() => {
    if (recorder.startedAt && state.phase === "requesting") dispatch({ type: "listen" });
  }, [recorder.startedAt, state.phase]);

  // Compteur affiché (le décompte visuel est l'anneau autour du bouton).
  useEffect(() => {
    if (!recorder.startedAt) {
      setSeconds(0);
      return;
    }
    const begin = recorder.startedAt;
    const id = setInterval(() => setSeconds(Math.min(MAX_MS, Date.now() - begin) / 1000), 100);
    return () => clearInterval(id);
  }, [recorder.startedAt]);

  const onPress = () => {
    if (state.phase === "listening") return recorder.stop();
    if (state.phase === "idle" || state.phase === "result" || state.phase === "error") {
      dispatch({ type: "request" });
      void recorder.start();
    }
  };

  const retry = () => {
    dispatch({ type: "reset" });
  };

  const micPhase =
    state.phase === "listening" || state.phase === "analyzing" || state.phase === "requesting"
      ? state.phase
      : "idle";

  const sheetOpen = state.phase === "analyzing" || state.phase === "result" || state.phase === "error";

  return (
    <main className="pb-tabbar flex min-h-[100dvh] flex-col items-center px-6">
      <header className="flex w-full max-w-md items-center justify-center pt-4">
        <span className="bg-brand bg-clip-text text-lg font-bold tracking-tight text-transparent">
          Grat&apos;Coran
        </span>
      </header>

      <div className="flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6">
        <StatusText phase={state.phase} stopQueued={recorder.stopQueued} seconds={seconds} />
        <MicButton phase={micPhase} maxSeconds={MAX_MS / 1000} onPress={onPress} />
        <Waveform analyser={recorder.analyser} active={state.phase === "listening"} />
      </div>

      <Sheet
        open={sheetOpen}
        onClose={retry}
        label={state.phase === "result" ? "Résultat de la reconnaissance" : "Analyse"}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={state.phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {state.phase === "analyzing" && <ResultSkeleton />}
            {state.phase === "result" && (
              <ResultCard
                recognition={state.data.recognition}
                transcript={state.data.transcript}
                saved={state.data.saved}
                onRetry={retry}
              />
            )}
            {state.phase === "error" && (
              <div className="space-y-4">
                <h2 className="text-xl font-bold tracking-tight">{state.title}</h2>
                <p className="text-[15px] leading-relaxed text-muted">{state.message}</p>
                <Button onClick={retry}>{state.retry ? "Réessayer" : "OK"}</Button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </Sheet>
    </main>
  );
}

function StatusText({
  phase,
  stopQueued,
  seconds,
}: {
  phase: State["phase"];
  stopQueued: boolean;
  seconds: number;
}) {
  const content = (() => {
    switch (phase) {
      case "requesting":
        return { title: "Accès au micro…", sub: "Autorise le micro si ton iPhone le demande." };
      case "listening":
        return stopQueued
          ? { title: "Encore un instant…", sub: `Minimum ${MIN_MS / 1000} secondes d'écoute.` }
          : { title: "J'écoute…", sub: "Touche à nouveau pour arrêter." };
      case "analyzing":
        return { title: "Analyse…", sub: "Recherche du passage." };
      default:
        return { title: "Touche pour écouter", sub: "Approche ton téléphone de la récitation." };
    }
  })();

  return (
    <div className="flex h-[100px] flex-col items-center justify-end text-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={content.title}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <h1 className="text-2xl font-bold tracking-tight">{content.title}</h1>
          <p className="mt-1 text-[15px] text-muted">{content.sub}</p>
        </motion.div>
      </AnimatePresence>
      <p className="mt-1 h-5 text-sm font-medium tabular-nums text-muted">
        {phase === "listening" ? `${Math.floor(seconds)} s / ${MAX_MS / 1000} s` : ""}
      </p>
    </div>
  );
}
