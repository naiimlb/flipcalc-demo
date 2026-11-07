"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ayahAudioUrl } from "@/lib/quran/audio";
import { resolveAudioSource, type AudioSource } from "./cache";

export type AudioStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface Options {
  surah: number;
  ayah: number;
  reciter: string;
  /** Nombre total d'écoutes enchaînées. */
  repeat: number;
  rate: number;
  keepOffline: boolean;
}

/**
 * Lecture d'un verset avec répétition et vitesse réglables.
 * La source est préparée à l'avance pour que `play()` reste synchrone au toucher (exigence d'iOS).
 */
export function useAyahAudio({ surah, ayah, reciter, repeat, rate, keepOffline }: Options) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sourceRef = useRef<AudioSource | null>(null);
  const playsRef = useRef(0);
  const repeatRef = useRef(repeat);
  const rateRef = useRef(rate);
  const [status, setStatus] = useState<AudioStatus>("idle");
  const [round, setRound] = useState(0);
  const [offline, setOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const url = ayahAudioUrl(reciter, surah, ayah);

  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  useEffect(() => {
    rateRef.current = rate;
    const a = audioRef.current;
    if (a) {
      a.defaultPlaybackRate = rate;
      a.playbackRate = rate;
    }
  }, [rate]);

  // Un seul élément audio pour toute la durée de vie du composant.
  useEffect(() => {
    const a = new Audio();
    a.preload = "none";
    audioRef.current = a;
    const onEnded = () => {
      playsRef.current += 1;
      if (playsRef.current < repeatRef.current) {
        setRound(playsRef.current);
        a.currentTime = 0;
        void a.play().catch(() => setStatus("paused"));
      } else {
        playsRef.current = 0;
        setRound(0);
        setStatus("idle");
      }
    };
    const onPlaying = () => setStatus("playing");
    const onWaiting = () => setStatus("loading");
    const onError = () => {
      if (!a.getAttribute("src")) return;
      setStatus("error");
      setError(
        navigator.onLine === false
          ? "Audio indisponible hors ligne : ce verset n'a pas encore été écouté sur cet appareil."
          : "Impossible de lire l'audio de ce verset pour le moment.",
      );
    };
    a.addEventListener("ended", onEnded);
    a.addEventListener("playing", onPlaying);
    a.addEventListener("waiting", onWaiting);
    a.addEventListener("error", onError);
    return () => {
      a.pause();
      a.removeEventListener("ended", onEnded);
      a.removeEventListener("playing", onPlaying);
      a.removeEventListener("waiting", onWaiting);
      a.removeEventListener("error", onError);
      a.removeAttribute("src");
      a.load();
      audioRef.current = null;
    };
  }, []);

  // Nouveau verset ou récitateur : on arrête et on prépare la source (fichier en cache si possible).
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    let cancelled = false;
    a.pause();
    a.removeAttribute("src");
    playsRef.current = 0;
    void resolveAudioSource(url, keepOffline).then((source) => {
      if (cancelled) {
        source.release();
        return;
      }
      sourceRef.current = source;
      setOffline(source.offline);
      setStatus("idle");
      setRound(0);
      setError(null);
      // Ne pas interrompre une lecture déjà lancée sur l'URL distante.
      if (!a.getAttribute("src")) {
        // Fichier local : préchargé ; distant : rien n'est téléchargé avant l'appui sur lecture.
        a.preload = source.offline ? "auto" : "none";
        a.src = source.src;
      }
    });
    return () => {
      cancelled = true;
      sourceRef.current?.release();
      sourceRef.current = null;
    };
  }, [url, keepOffline]);

  const play = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    // Source pas encore prête : lecture directe depuis le réseau (reste synchrone au toucher).
    if (!a.getAttribute("src")) a.src = url;
    a.defaultPlaybackRate = rateRef.current;
    a.playbackRate = rateRef.current;
    setError(null);
    setStatus("loading");
    void a.play().catch((e: unknown) => {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setStatus("error");
      setError(
        navigator.onLine === false
          ? "Audio indisponible hors ligne : ce verset n'a pas encore été écouté sur cet appareil."
          : "La lecture a été bloquée. Touchez à nouveau le bouton de lecture.",
      );
    });
  }, [url]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
    setStatus("paused");
  }, []);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.pause();
    a.currentTime = 0;
    playsRef.current = 0;
    setRound(0);
    setStatus("idle");
  }, []);

  return { status, round, offline, error, play, pause, stop };
}
