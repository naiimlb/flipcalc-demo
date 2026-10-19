"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PreviousAttempt, TajweedResponse } from "@/app/api/tajweed/route";
import { useRecorder, MIN_MS, type RecorderError, type Recording } from "@/hooks/useRecorder";
import { MIC_ERRORS } from "@/lib/mic-errors";
import { compareAttempts, MAX_RECORDING_MS, type PassageRef, type PassageWord } from "@/lib/tajweed/analyze";
import type { RuleId } from "@/lib/tajweed/rules";
import type { SurahInfo, VerseInfo } from "@/lib/quran/present";
import { MicButton } from "../MicButton";
import { Waveform } from "../Waveform";
import { Button } from "../ui";
import { Confetti } from "./Confetti";
import { NoticeBanner } from "./NoticeBanner";
import { AttentionPoints, ColoredText, ComparisonCard, ErrorCard, Legend, Reminder, ScoreRing } from "./ResultView";
import { RulePills } from "./RulePills";

export type PracticeProps = {
  passageRef: PassageRef;
  surah: SurahInfo;
  verses: VerseInfo[];
  words: PassageWord[];
  rules: RuleId[];
  segmentLabel: string | null;
  previous: PreviousAttempt | null;
  nextHref: string | null;
};

type Phase =
  | { name: "prepare" }
  | { name: "requesting" }
  | { name: "recording" }
  | { name: "analyzing" }
  | { name: "result"; data: TajweedResponse; previous: PreviousAttempt | null }
  | { name: "error"; title: string; message: string };

const STEPS = ["Prépare-toi", "Récite", "Analyse", "Résultat"] as const;
const stepOf = (p: Phase["name"]) =>
  p === "prepare" ? 0 : p === "requesting" || p === "recording" ? 1 : p === "analyzing" ? 2 : 3;

export function Practice(props: PracticeProps) {
  const { passageRef, surah, verses, words, rules, segmentLabel, nextHref } = props;
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "prepare" });
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const previousRef = useRef<PreviousAttempt | null>(props.previous);
  const topRef = useRef<HTMLDivElement>(null);

  const wordsByRule = useMemo(() => {
    const map: Partial<Record<RuleId, string[]>> = {};
    for (const w of words) for (const r of w.rules) (map[r] ??= []).push(w.text);
    return map;
  }, [words]);

  // L'enregistrement n'existe qu'en mémoire, le temps de la réécoute.
  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, [audioUrl]);

  const send = useCallback(
    async ({ blob, mimeType }: Recording) => {
      setPhase({ name: "analyzing" });
      setAudioUrl(URL.createObjectURL(blob));
      const ext = mimeType.includes("mp4") ? "mp4" : mimeType.includes("ogg") ? "ogg" : "webm";
      const body = new FormData();
      body.append("audio", blob, `recitation.${ext}`);
      body.append("surah", String(passageRef.surah));
      body.append("verseStart", String(passageRef.verseStart));
      body.append("verseEnd", String(passageRef.verseEnd));
      if (passageRef.wordStart != null) body.append("wordStart", String(passageRef.wordStart));
      if (passageRef.wordEnd != null) body.append("wordEnd", String(passageRef.wordEnd));
      try {
        const res = await fetch("/api/tajweed", { method: "POST", body });
        const json = await res.json().catch(() => null);
        if (res.status === 401) return router.replace("/login");
        if (!res.ok || !json) {
          setPhase({
            name: "error",
            title: res.status === 429 ? "Un instant…" : "Analyse impossible",
            message: json?.error ?? "Le serveur n'a pas répondu correctement. Réessaie.",
          });
          return;
        }
        const data = json as TajweedResponse;
        const previous = previousRef.current;
        if (data.analysis.status === "ok") {
          previousRef.current = {
            attempt: data.attempt ?? (previous?.attempt ?? 0) + 1,
            correct: data.analysis.correct,
            total: data.analysis.total,
            errors: data.analysis.errors,
          };
          router.refresh();
        }
        setPhase({ name: "result", data, previous });
        topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        setPhase({
          name: "error",
          title: "Hors connexion",
          message: "Impossible de joindre le serveur. Vérifie ta connexion internet puis réessaie.",
        });
      }
    },
    [passageRef, router],
  );

  const onRecorderError = useCallback((err: RecorderError) => {
    setPhase({ name: "error", ...MIC_ERRORS[err] });
  }, []);

  const recorder = useRecorder({ onComplete: send, onError: onRecorderError, maxMs: MAX_RECORDING_MS });

  useEffect(() => {
    if (recorder.startedAt && phase.name === "requesting") setPhase({ name: "recording" });
  }, [recorder.startedAt, phase.name]);

  useEffect(() => {
    if (!recorder.startedAt) {
      setSeconds(0);
      return;
    }
    const begin = recorder.startedAt;
    const id = setInterval(() => setSeconds(Math.min(MAX_RECORDING_MS, Date.now() - begin) / 1000), 200);
    return () => clearInterval(id);
  }, [recorder.startedAt]);

  const onMic = () => {
    if (phase.name === "recording") return recorder.stop();
    if (phase.name === "prepare" || phase.name === "result" || phase.name === "error") {
      setPhase({ name: "requesting" });
      void recorder.start();
    }
  };

  const retry = () => setPhase({ name: "prepare" });

  const step = stepOf(phase.name);
  const result = phase.name === "result" ? phase.data : null;
  const ok = result?.analysis.status === "ok" ? result.analysis : null;
  const comparison = ok && phase.name === "result" && phase.previous ? compareAttempts(phase.previous.errors, ok.errors) : null;
  const perfect = ok ? ok.correct === ok.total && !ok.errors.length : false;
  const range = passageRef.verseStart === passageRef.verseEnd ? `Verset ${passageRef.verseStart}` : `Versets ${passageRef.verseStart} à ${passageRef.verseEnd}`;

  return (
    <main className="pb-tabbar mx-auto max-w-md px-5 pt-4">
      <div ref={topRef} className="flex items-center justify-between">
        <Link href="/tajweed" className="pressable inline-flex min-h-[44px] items-center text-[15px] font-semibold text-emerald-deep dark:text-emerald">
          ‹ Tajweed
        </Link>
        <Link href="/tajweed" className="pressable inline-flex min-h-[44px] items-center rounded-full bg-surface/70 px-4 text-[14px] font-semibold">
          Changer de passage
        </Link>
      </div>

      <header className="mt-1">
        <h1 className="text-[26px] font-bold tracking-tight">{surah.transliteration}</h1>
        <p className="text-[15px] text-muted">
          Sourate {surah.number} · {range}
          {segmentLabel ? ` · ${segmentLabel}` : ""}
        </p>
      </header>

      <div className="mt-3">
        <NoticeBanner />
      </div>

      <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Étapes">
        {STEPS.map((label, i) => (
          <li key={label} className="text-center">
            <div className={`h-1.5 rounded-full transition-colors duration-500 ${i <= step ? "bg-brand" : "bg-line"}`} />
            <p className={`mt-1 text-[11px] font-semibold ${i === step ? "text-ink" : "text-muted"}`} aria-current={i === step ? "step" : undefined}>
              {label}
            </p>
          </li>
        ))}
      </ol>

      {/* Texte du passage : toujours visible, même pendant la récitation. */}
      <section className="glass mt-4 rounded-[28px] p-5" aria-label="Texte du passage">
        {ok ? (
          <ColoredText words={words} results={ok.words} errors={ok.errors} corrected={comparison?.corrected} />
        ) : (
          <p lang="ar" dir="rtl" className="quran flex flex-wrap gap-x-1.5 text-[28px] leading-[2.2]">
            {words.map((w, i) => (
              <motion.span
                key={w.index}
                className="rounded-lg px-1"
                animate={phase.name === "analyzing" ? { opacity: [1, 0.35, 1] } : { opacity: 1 }}
                transition={phase.name === "analyzing" ? { duration: 1.6, repeat: Infinity, delay: i * 0.08 } : { duration: 0.2 }}
              >
                {w.text}
              </motion.span>
            ))}
          </p>
        )}
        {ok && (
          <div className="mt-3">
            <Legend />
          </div>
        )}
        <button
          type="button"
          onClick={() => setShowTranslation((v) => !v)}
          className="mt-3 min-h-[44px] text-[14px] font-semibold text-emerald-deep dark:text-emerald"
          aria-expanded={showTranslation}
        >
          {showTranslation ? "Masquer la traduction" : "Afficher la traduction"}
        </button>
        <AnimatePresence initial={false}>
          {showTranslation && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              {verses.map((v) => (
                <p key={v.number} className="mb-2 text-[15px] leading-relaxed text-muted">
                  <span className="font-semibold text-ink">{v.number}. </span>
                  {v.translation}
                </p>
              ))}
              {segmentLabel && <p className="text-[13px] text-muted">Traduction du verset complet.</p>}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {phase.name === "prepare" && rules.length > 0 && (
        <section className="mt-4 animate-rise" aria-labelledby="rules-title">
          <h2 id="rules-title" className="mb-2 text-[15px] font-bold">
            Règles de tajweed dans ce passage
          </h2>
          <RulePills rules={rules} wordsByRule={wordsByRule} />
          <p className="mt-2 text-[13px] text-muted">Touche une pastille pour une mini-leçon.</p>
        </section>
      )}

      <AnimatePresence mode="wait" initial={false}>
        {(phase.name === "prepare" || phase.name === "requesting" || phase.name === "recording") && (
          <motion.section key="record" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-6 flex flex-col items-center gap-3">
            <p className="text-center text-[15px] font-semibold">
              {phase.name === "recording"
                ? recorder.stopQueued
                  ? `Encore un instant… (minimum ${MIN_MS / 1000} s)`
                  : "Récite le passage, puis touche pour arrêter."
                : phase.name === "requesting"
                  ? "Accès au micro…"
                  : "Quand tu es prêt, touche le micro et récite."}
            </p>
            <div className="scale-90">
              <MicButton
                phase={phase.name === "recording" ? "listening" : phase.name === "requesting" ? "requesting" : "idle"}
                maxSeconds={MAX_RECORDING_MS / 1000}
                onPress={onMic}
              />
            </div>
            <Waveform analyser={recorder.analyser} active={phase.name === "recording"} />
            <p className="h-5 text-sm font-medium tabular-nums text-muted">
              {phase.name === "recording" ? `${Math.floor(seconds)} s / ${MAX_RECORDING_MS / 1000} s` : ""}
            </p>
          </motion.section>
        )}

        {phase.name === "analyzing" && (
          <motion.section key="analyzing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 flex flex-col items-center gap-4" aria-busy="true">
            <div className="flex h-12 items-end gap-1.5" aria-hidden>
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <motion.span
                  key={i}
                  className="w-2 rounded-full bg-brand"
                  animate={{ height: [10, 40, 16, 30, 10] }}
                  transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" }}
                />
              ))}
            </div>
            <p className="text-[16px] font-semibold">J&apos;écoute attentivement chaque mot…</p>
            <p className="text-[14px] text-muted">Comparaison avec le texte du mushaf.</p>
          </motion.section>
        )}

        {phase.name === "error" && (
          <motion.section key="error" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-6 space-y-3 rounded-3xl p-5">
            <h2 className="text-xl font-bold">{phase.title}</h2>
            <p className="text-[15px] leading-relaxed text-muted">{phase.message}</p>
            <Button onClick={retry}>Réessayer</Button>
          </motion.section>
        )}

        {result && result.analysis.status !== "ok" && (
          <motion.section key="unclear" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass mt-6 space-y-4 rounded-3xl p-5">
            <h2 className="text-xl font-bold tracking-tight">
              {result.analysis.status === "unclear" ? "Je n'ai pas bien entendu" : "Ce n'est pas le bon passage ?"}
            </h2>
            <p className="text-[15px] leading-relaxed text-muted">{result.analysis.message}</p>
            <ul className="space-y-2 rounded-2xl bg-bg/70 p-4 text-[15px]">
              {result.analysis.tips.map((t) => (
                <li key={t} className="flex gap-2.5">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald" aria-hidden />
                  {t}
                </li>
              ))}
            </ul>
            <Button onClick={retry}>Réessayer</Button>
          </motion.section>
        )}

        {ok && result && (
          <motion.section key="result" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
            {perfect && <Confetti />}
            <div className="glass flex items-center gap-4 rounded-3xl p-4">
              <ScoreRing correct={ok.correct} total={ok.total} />
              <div className="min-w-0">
                <p className="text-[18px] font-bold leading-snug">{perfect ? "Félicitations !" : ok.message}</p>
                <p className="mt-1 text-[14px] text-muted">
                  {perfect
                    ? ok.message
                    : `${ok.errors.length} point${ok.errors.length > 1 ? "s" : ""} à revoir${ok.approx ? `, dont ${ok.approx} approximatif${ok.approx > 1 ? "s" : ""}` : ""}.`}
                </p>
                {!result.saved && <p className="mt-1 text-[12px] text-muted">Essai non enregistré dans ton parcours.</p>}
              </div>
            </div>

            {comparison && <ComparisonCard comparison={comparison} attempt={result.attempt} words={words} />}

            {audioUrl && <Replay url={audioUrl} />}

            {ok.errors.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[17px] font-bold">À revoir</h2>
                {ok.errors.map((e, k) => (
                  <ErrorCard key={`${e.index}-${e.type}-${k}`} error={e} index={k} />
                ))}
              </div>
            )}

            <AttentionPoints analysis={ok} words={words} />
            <Reminder />

            <div className="grid gap-3">
              {perfect && nextHref ? (
                <>
                  <Link href={nextHref} className="pressable flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white shadow-lg shadow-emerald/20">
                    Passer à la suite
                  </Link>
                  <Button variant="secondary" onClick={retry}>
                    Réciter encore une fois
                  </Button>
                </>
              ) : (
                <Button onClick={retry}>Réessayer</Button>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

/** Réécoute locale de l'enregistrement (jamais envoyé ailleurs qu'à l'analyse, jamais stocké). */
function Replay({ url }: { url: string }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="glass flex items-center gap-3 rounded-3xl p-3">
      <button
        type="button"
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused) void a.play();
          else a.pause();
        }}
        className="pressable grid h-12 w-12 shrink-0 place-items-center rounded-full bg-brand text-white"
        aria-label={playing ? "Mettre en pause" : "Réécouter ma récitation"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor" aria-hidden><path d="M7 5v14l12-7z" /></svg>
        )}
      </button>
      <div>
        <p className="text-[15px] font-semibold">Réécouter ma récitation</p>
        <p className="text-[12px] text-muted">Lecture sur ton téléphone uniquement, rien n&apos;est conservé.</p>
      </div>
      <audio ref={audio} src={url} preload="auto" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
    </div>
  );
}
