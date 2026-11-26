"use client";

import { useState } from "react";
import { useInstallState } from "@/lib/install";

const KEY = "hb-install-hint-dismissed";

/**
 * Sur iPhone, dans Safari : la session de Safari n'est PAS partagée avec l'app installée sur l'écran d'accueil.
 * Il faut donc ajouter l'app puis se connecter depuis l'icône pour rester connecté durablement.
 */
export function InstallHint({ dismissible = false }: { dismissible?: boolean }) {
  const install = useInstallState();
  const [hidden, setHidden] = useState(() => {
    if (!dismissible) return false;
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!install || !install.ios || install.standalone || hidden) return null;
  return (
    <section role="note" className="mb-5 rounded-3xl border-2 border-pink bg-white p-4 shadow-card">
      <p className="text-[15px] font-extrabold">📲 Pour rester connecté</p>
      <p className="mt-1 text-sm leading-snug text-ink/80">
        Ajoute l&apos;app à ton écran d&apos;accueil (<b>Partager</b> puis <b>Sur l&apos;écran d&apos;accueil</b>), puis connecte-toi depuis l&apos;app pour rester connecté.
      </p>
      {dismissible && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              /* ignoré */
            }
            setHidden(true);
          }}
          className="mt-2 min-h-11 rounded-full border-2 border-pink px-4 text-sm font-extrabold text-pink-deep"
        >
          J&apos;ai compris
        </button>
      )}
    </section>
  );
}
