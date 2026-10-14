"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_MS = 15_000;
export const MIN_MS = 3_000;

export type RecorderError = "unsupported" | "insecure" | "denied" | "no-mic" | "busy" | "unknown";

export type Recording = { blob: Blob; mimeType: string; durationMs: number };

/** Formats par ordre de préférence. Safari (iOS) ne propose que audio/mp4. */
const MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || !MediaRecorder.isTypeSupported) return undefined;
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
}

type Session = {
  stream: MediaStream;
  context: AudioContext;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  timer: ReturnType<typeof setTimeout>;
  cancelled: boolean;
};

type Options = {
  onComplete: (recording: Recording) => void;
  onError: (error: RecorderError) => void;
};

export function useRecorder({ onComplete, onError }: Options) {
  const session = useRef<Session | null>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [stopQueued, setStopQueued] = useState(false);
  const callbacks = useRef({ onComplete, onError });
  useEffect(() => {
    callbacks.current = { onComplete, onError };
  }, [onComplete, onError]);

  const teardown = useCallback(() => {
    const s = session.current;
    if (!s) return;
    clearTimeout(s.timer);
    s.stream.getTracks().forEach((t) => t.stop());
    s.context.close().catch(() => {});
    session.current = null;
    setAnalyser(null);
    setStartedAt(null);
    setStopQueued(false);
  }, []);

  const finish = useCallback(() => {
    const s = session.current;
    if (s && s.recorder.state !== "inactive") s.recorder.stop();
  }, []);

  /** Doit être appelé directement dans le gestionnaire du geste (exigence iOS). */
  const start = useCallback(async () => {
    if (session.current) return;
    if (!window.isSecureContext) return callbacks.current.onError("insecure");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      return callbacks.current.onError("unsupported");
    }

    // L'AudioContext est créé pendant le geste, avant tout await (sinon iOS le suspend).
    const Ctx: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new Ctx();

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (err) {
      context.close().catch(() => {});
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") return callbacks.current.onError("denied");
      if (name === "NotFoundError" || name === "OverconstrainedError") return callbacks.current.onError("no-mic");
      if (name === "NotReadableError" || name === "AbortError") return callbacks.current.onError("busy");
      return callbacks.current.onError("unknown");
    }

    try {
      await context.resume();
      const node = context.createAnalyser();
      node.fftSize = 1024;
      node.smoothingTimeConstant = 0.6;
      context.createMediaStreamSource(stream).connect(node);

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType, audioBitsPerSecond: 64_000 } : undefined,
      );
      const chunks: Blob[] = [];
      const begun = performance.now();
      const s: Session = {
        stream,
        context,
        recorder,
        chunks,
        startedAt: begun,
        timer: setTimeout(finish, MAX_MS),
        cancelled: false,
      };
      session.current = s;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      recorder.onstop = () => {
        const durationMs = performance.now() - begun;
        const type = recorder.mimeType || mimeType || "audio/mp4";
        const cancelled = s.cancelled;
        teardown();
        if (!cancelled) callbacks.current.onComplete({ blob: new Blob(chunks, { type }), mimeType: type, durationMs });
      };
      // Sans timeslice : Safari produit alors un fichier mp4 unique et valide.
      recorder.start();
      setAnalyser(node);
      setStartedAt(Date.now());
    } catch {
      stream.getTracks().forEach((t) => t.stop());
      context.close().catch(() => {});
      session.current = null;
      callbacks.current.onError("unsupported");
    }
  }, [finish, teardown]);

  /** Arrête l'écoute ; avant 3 s, l'arrêt est différé jusqu'au minimum. */
  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    const elapsed = performance.now() - s.startedAt;
    if (elapsed >= MIN_MS) return finish();
    clearTimeout(s.timer);
    s.timer = setTimeout(finish, MIN_MS - elapsed);
    setStopQueued(true);
  }, [finish]);

  const cancel = useCallback(() => {
    const s = session.current;
    if (!s) return;
    s.cancelled = true;
    if (s.recorder.state !== "inactive") s.recorder.stop();
    else teardown();
  }, [teardown]);

  // Libère le micro si l'écran est quitté pendant l'écoute.
  useEffect(() => {
    const current = session;
    return () => {
      const s = current.current;
      if (!s) return;
      s.cancelled = true;
      if (s.recorder.state !== "inactive") s.recorder.stop();
      s.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return { start, stop, cancel, analyser, startedAt, stopQueued };
}
