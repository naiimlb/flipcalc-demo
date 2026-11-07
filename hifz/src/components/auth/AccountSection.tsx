"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { useAuth, useSyncStatus } from "@/components/providers/auth-context";
import { Button, Card, SectionTitle } from "@/components/ui";
import { getDb } from "@/lib/storage/client";

function formatTime(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat("fr-FR", sameDay ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(d);
}

/** Compte connecté : e-mail, état de la synchronisation, déconnexion. Absent en mode local. */
export function AccountSection() {
  const { state, sync, signOut } = useAuth();
  const status = useSyncStatus();
  const pending = useLiveQuery(() => getDb().outbox.count(), [], 0);
  const [busy, setBusy] = useState(false);

  if (state.status !== "signedIn") return null;

  const label =
    status.state === "syncing"
      ? "Synchronisation…"
      : status.state === "offline"
        ? "Hors ligne"
        : status.state === "auth"
          ? "Session expirée"
          : status.state === "error"
            ? "Erreur de synchronisation"
            : pending > 0
              ? "En attente d'envoi"
              : status.lastSyncAt
                ? `Synchronisé à ${formatTime(status.lastSyncAt)}`
                : "Pas encore synchronisé";

  async function logout() {
    const warning =
      pending > 0
        ? `${pending} modification${pending > 1 ? "s" : ""} n'${pending > 1 ? "ont" : "a"} pas encore été envoyée${pending > 1 ? "s" : ""} au serveur.\n\nElles restent sur cet appareil et seront envoyées à votre prochaine connexion avec ce compte. Se déconnecter ?`
        : "Se déconnecter ? Vos données restent enregistrées sur votre compte et sur cet appareil.";
    if (!window.confirm(warning)) return;
    setBusy(true);
    try {
      await signOut();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <SectionTitle>Compte</SectionTitle>
      <Card className="space-y-3">
        <div>
          <p className="text-sm text-muted">Connecté en tant que</p>
          <p className="break-all font-medium">{state.user.email}</p>
        </div>
        <p className="text-sm text-muted" aria-live="polite">
          {label}
          {pending > 0 && status.state !== "syncing" ? ` · ${pending} modification${pending > 1 ? "s" : ""} à envoyer` : null}
        </p>
        {status.message && status.state !== "idle" ? (
          <p role="status" className="text-sm text-muted">
            {status.message}
          </p>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" className="whitespace-nowrap px-3 text-[15px]" onClick={() => void sync?.syncNow()} disabled={status.state === "syncing"}>
            Synchroniser
          </Button>
          <Button variant="danger" className="whitespace-nowrap px-3 text-[15px]" onClick={logout} disabled={busy}>
            Se déconnecter
          </Button>
        </div>
      </Card>
    </>
  );
}
