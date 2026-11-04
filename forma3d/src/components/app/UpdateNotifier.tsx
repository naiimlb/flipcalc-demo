"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, m as motion } from "framer-motion";
import { IconRefresh } from "../icons";

const BUSY_EVENT = "forma3d:busy";
const CHECK_EVERY_MS = 60_000;

async function fetchVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { version?: string }).version ?? null;
  } catch {
    return null;
  }
}

/**
 * Détecte un nouveau déploiement : identifiant mémorisé au chargement, revérifié
 * toutes les 60 s et au retour sur l'onglet. Le brouillon de demande est déjà
 * sauvegardé en continu (localStorage) ; si une génération est en cours, la mise à
 * jour attend sa fin.
 */
export function UpdateNotifier() {
  const initial = useRef<string | null>(null);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      const version = await fetchVersion();
      if (stopped || !version) return;
      if (initial.current === null) initial.current = version;
      else if (version !== initial.current) setAvailable(true);
    };
    void check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => {
    const onBusy = (e: Event) => setBusy(Boolean((e as CustomEvent<boolean>).detail));
    window.addEventListener(BUSY_EVENT, onBusy);
    return () => window.removeEventListener(BUSY_EVENT, onBusy);
  }, []);

  // Mise à jour demandée pendant une génération : rechargement dès qu'elle se termine.
  useEffect(() => {
    if (waiting && !busy) window.location.reload();
  }, [waiting, busy]);

  const update = () => {
    // Le brouillon (texte + photo) est enregistré à chaque frappe ; on signale aussi l'intention.
    window.dispatchEvent(new Event("forma3d:before-update"));
    if (busy) setWaiting(true);
    else window.location.reload();
  };

  return (
    <AnimatePresence>
      {available && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed inset-x-0 top-3 z-[60] flex justify-center px-3"
          role="status"
        >
          <div className="flex items-center gap-3 rounded-md border border-line bg-surface py-1.5 pl-4 pr-1.5 text-sm text-ink shadow-float">
            <span className="hidden sm:inline">{waiting ? "Mise à jour à la fin de la génération…" : "Nouvelle version disponible"}</span>
            <button type="button" onClick={update} disabled={waiting} className="btn-accent !py-1.5 !text-xs">
              <IconRefresh size={14} /> {waiting ? "En attente" : "Mettre à jour"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
