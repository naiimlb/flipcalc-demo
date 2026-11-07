"use client";

import Dexie from "dexie";
import { useEffect, useState } from "react";
import { useSyncStatus } from "@/components/providers/auth-context";
import { Button } from "@/components/ui";
import { exportBackup, importBackup } from "@/lib/storage/backup";
import { createDb, type HifzDB } from "@/lib/storage/db";
import type { SyncController } from "@/lib/sync/controller";
import { isLocalEmpty } from "@/lib/sync/engine";

/** Nom de la base utilisée avant l'arrivée des comptes. */
const LEGACY_DB = "hifz";
const HANDLED_KEY = "hifz-legacy-handled";

function isHandled(): boolean {
  try {
    return localStorage.getItem(HANDLED_KEY) === "1";
  } catch {
    return true; // stockage indisponible : on ne propose rien
  }
}

function markHandled() {
  try {
    localStorage.setItem(HANDLED_KEY, "1");
  } catch {
    // sans effet
  }
}

/**
 * À la première connexion sur un appareil qui avait déjà de la progression (avant les comptes),
 * propose de la rattacher au compte. Seulement si le compte est vide après la première synchronisation.
 */
export function LegacyClaim({ db, ctl }: { db: HifzDB; ctl: SyncController }) {
  const status = useSyncStatus();
  const [offer, setOffer] = useState<{ cards: number; programs: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const synced = status.state === "idle" && status.lastSyncAt !== null;

  useEffect(() => {
    if (!synced || isHandled()) return;
    let alive = true;
    (async () => {
      if (!(await Dexie.exists(LEGACY_DB)) || !(await isLocalEmpty(db))) return;
      const legacy = createDb(LEGACY_DB);
      try {
        const [cards, programs] = await Promise.all([legacy.cards.count(), legacy.programs.count()]);
        if (alive && (cards > 0 || programs > 0)) setOffer({ cards, programs });
      } finally {
        legacy.close();
      }
    })().catch(() => {});
    return () => {
      alive = false;
    };
  }, [synced, db]);

  if (!offer) return null;

  async function claim() {
    setBusy(true);
    setError(null);
    const legacy = createDb(LEGACY_DB);
    try {
      await importBackup(db, await exportBackup(legacy));
      markHandled();
      setOffer(null);
      void ctl.syncNow();
    } catch {
      setError("Le rattachement a échoué. Vos données sur cet appareil n'ont pas été modifiées.");
    } finally {
      legacy.close();
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/40 p-4 sm:place-items-center" role="dialog" aria-modal="true" aria-labelledby="claim-title">
      <div className="pb-safe w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-xl">
        <h2 id="claim-title" className="text-xl font-bold">
          Rattacher votre progression ?
        </h2>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          Cet appareil contient déjà {offer.cards} verset{offer.cards > 1 ? "s" : ""} suivi{offer.cards > 1 ? "s" : ""} dans{" "}
          {offer.programs} programme{offer.programs > 1 ? "s" : ""}, enregistrés avant la création des comptes. Voulez-vous les
          ajouter à votre compte pour les retrouver sur tous vos appareils ?
        </p>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-again">
            {error}
          </p>
        ) : null}
        <Button className="mt-5 w-full" onClick={claim} disabled={busy}>
          {busy ? "Rattachement…" : "Rattacher à mon compte"}
        </Button>
        <Button
          variant="ghost"
          className="mt-2 w-full"
          disabled={busy}
          onClick={() => {
            markHandled();
            setOffer(null);
          }}
        >
          Non merci
        </Button>
      </div>
    </div>
  );
}
