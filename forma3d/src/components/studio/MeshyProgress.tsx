"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion, useReducedMotion } from "framer-motion";
import type { PublicAsset } from "@/lib/requests";
import { MESHY_STAGE_KEYS, clampProgress, meshyStageIndex } from "@/lib/meshy-stages";
import { useT } from "../app/Preferences";
import { IconCheck, Spinner } from "../icons";

const KINDS = ["preview", "refine", "retexture", "remesh", "resize", "repair", "analyze"] as const;
type Kind = (typeof KINDS)[number];
const asKind = (k: string | undefined): Kind => ((KINDS as readonly string[]).includes(k ?? "") ? (k as Kind) : "preview");

/**
 * Écran de génération Meshy, posé sur la vue 3D sans la masquer : Analyse → Génération → Texturage → Prêt,
 * barre d'avancement et nom de l'action. Reste affiché « Prêt » quelques secondes quand la tâche réussit.
 * (Un échec n'est pas affiché ici : le panneau Meshy donne le message, avec « aucun crédit débité ».)
 */
export function MeshyProgress({ asset }: { asset: PublicAsset | null | undefined }) {
  const t = useT();
  const reduce = useReducedMotion();
  const active = asset?.status === "pending" || asset?.status === "running";
  const [ready, setReady] = useState(false);
  const wasActive = useRef(false);

  useEffect(() => {
    if (active) {
      wasActive.current = true;
      setReady(false);
      return;
    }
    const finished = wasActive.current && asset?.status === "succeeded";
    wasActive.current = false;
    if (!finished) return;
    setReady(true);
    const timer = setTimeout(() => setReady(false), 4000);
    return () => clearTimeout(timer);
  }, [active, asset?.status]);

  const show = Boolean(asset) && (active || ready);
  const stage = asset ? (ready ? 3 : meshyStageIndex(asset.kind, asset.status, asset.progress)) : 0;
  const progress = ready ? 100 : clampProgress(asset?.progress ?? 0);
  const action = t(`meshy.kind.${asKind(asset?.kind)}`);
  const name = t(MESHY_STAGE_KEYS[stage]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="meshy-progress"
          role="status"
          aria-live="polite"
          aria-label={t("meshy.work.step", { n: stage + 1, name })}
          initial={{ opacity: 0, y: reduce ? 0 : -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="pointer-events-none absolute inset-x-3 top-14 z-20 mx-auto w-auto max-w-[26rem] rounded-2xl bg-night/80 p-3.5 text-white shadow-float ring-1 ring-white/15 backdrop-blur-md"
        >
          <p className="flex items-center gap-2 text-[12.5px] font-semibold">
            {ready ? <IconCheck size={14} strokeWidth={2.6} /> : <Spinner size={13} />}
            {ready ? t("meshy.work.ready") : t("meshy.work.title")}
          </p>
          <ol className="mt-2.5 flex items-center gap-1" aria-hidden>
            {MESHY_STAGE_KEYS.map((key, i) => (
              <li key={key} className="flex min-w-0 flex-1 flex-col gap-1">
                <span className={`h-1 rounded-full transition-colors duration-500 ${i < stage || (ready && i <= stage) ? "bg-neon-blue" : i === stage ? "bg-neon-blue/55" : "bg-white/20"}`} />
                <span className={`truncate text-[10px] font-semibold ${i === stage ? "text-white" : i < stage ? "text-white/80" : "text-white/50"}`}>
                  {i < stage ? "✓ " : ""}
                  {t(key)}
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label={action} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
            <div className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-violet transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1.5 flex justify-between gap-2 text-[10.5px] text-white/70">
            <span className="truncate">{action}</span>
            <span className="shrink-0 tabular-nums">{progress} %</span>
          </p>
          {!ready && <p className="mt-1.5 text-[10.5px] leading-snug text-white/60">{t("meshy.work.hint")}</p>}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

