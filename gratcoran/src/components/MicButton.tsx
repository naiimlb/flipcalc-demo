"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Spinner } from "./ui";

export type MicPhase = "idle" | "requesting" | "listening" | "analyzing";

const SIZE = 216;
const RING_R = 102;

type Props = {
  phase: MicPhase;
  maxSeconds: number;
  onPress: () => void;
};

export function MicButton({ phase, maxSeconds, onPress }: Props) {
  const listening = phase === "listening";
  const busy = phase === "analyzing" || phase === "requesting";

  return (
    <div className="relative grid place-items-center" style={{ width: SIZE, height: SIZE }}>
      {/* Halo respirant au repos, ondes concentriques pendant l'écoute. */}
      <AnimatePresence>
        {listening &&
          [0, 1, 2].map((i) => (
            <motion.span
              key={`wave-${i}`}
              className="absolute inset-6 rounded-full bg-brand"
              initial={{ scale: 1, opacity: 0.35 }}
              animate={{ scale: 1.55, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.73, ease: "easeOut" }}
            />
          ))}
      </AnimatePresence>
      {!listening && (
        // Dégradé radial plutôt qu'un filtre flou animé : WebKit le compose mal sous les cartes en verre.
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: "radial-gradient(circle, rgba(16,185,129,0.55) 0%, rgba(37,99,235,0.28) 45%, transparent 70%)" }}
          animate={{ opacity: busy ? 0.45 : [0.6, 1, 0.6], scale: [1, 1.06, 1] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Anneau de décompte (15 s). */}
      <svg className="absolute inset-0 -rotate-90" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RING_R} fill="none" strokeWidth="6" className="stroke-line" />
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#10b981" />
            <stop offset="1" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        {listening && (
          <motion.circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RING_R}
            fill="none"
            stroke="url(#ring)"
            strokeWidth="6"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: maxSeconds, ease: "linear" }}
          />
        )}
      </svg>

      <motion.button
        type="button"
        onClick={onPress}
        disabled={busy}
        aria-label={listening ? "Arrêter l'écoute" : "Lancer l'écoute"}
        whileTap={{ scale: 0.93 }}
        animate={{ scale: listening ? 0.94 : 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 24 }}
        className="relative grid h-40 w-40 place-items-center rounded-full bg-brand text-white shadow-[0_18px_50px_-12px_rgba(13,159,154,0.7)] outline-none focus-visible:ring-4 focus-visible:ring-emerald/40 disabled:cursor-default"
      >
        <span className="absolute inset-0 rounded-full bg-gradient-to-b from-white/25 to-transparent" />
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={busy ? "busy" : listening ? "stop" : "mic"}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="relative"
          >
            {busy ? (
              <Spinner className="h-10 w-10 border-[3px]" />
            ) : listening ? (
              <span className="block h-11 w-11 rounded-xl bg-white" />
            ) : (
              <svg viewBox="0 0 24 24" className="h-16 w-16" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" aria-hidden>
                <rect x="9" y="2.5" width="6" height="12" rx="3" fill="currentColor" />
                <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21.5" />
              </svg>
            )}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
