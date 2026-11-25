"use client";

import { useState } from "react";
import { dismissImport, importLocalTasks, isImportDismissed, readLocalTasks } from "@/lib/local-import";
import { showToast } from "@/lib/toast";

/** Propose d'importer dans le compte les tâches trouvées sur ce téléphone (anciennes données locales). */
export function ImportLocalCard({ userId, always = false }: { userId: string; always?: boolean }) {
  const [count, setCount] = useState(() => readLocalTasks().length);
  const [hidden, setHidden] = useState(() => !always && isImportDismissed(userId));
  const [busy, setBusy] = useState(false);

  if (count === 0 || hidden) return null;

  async function run() {
    setBusy(true);
    const n = await importLocalTasks();
    setBusy(false);
    if (n < 0) return showToast("⚠️ Import impossible", "Vérifie ta connexion puis réessaie. Tes tâches sont toujours sur ce téléphone.");
    showToast("✅ Tâches importées", `${n} tâche${n > 1 ? "s" : ""} ajoutée${n > 1 ? "s" : ""} à ton compte.`);
    setCount(0);
  }

  return (
    <section className="mb-5 rounded-3xl border-2 border-pink bg-white p-4 shadow-card">
      <p className="text-lg font-extrabold">J&apos;ai trouvé {count} tâche{count > 1 ? "s" : ""} sur ce téléphone 📲</p>
      <p className="mt-1 text-sm text-mute">Importe-les dans ton compte pour les retrouver partout.</p>
      <button type="button" onClick={run} disabled={busy} className="mt-3 min-h-12 w-full rounded-full bg-pink text-base font-extrabold text-white shadow-pop active:scale-[0.98] disabled:opacity-60">
        {busy ? "Import…" : "Importer mes tâches"}
      </button>
      {!always && (
        <button
          type="button"
          onClick={() => {
            dismissImport(userId);
            setHidden(true);
          }}
          className="mt-2 min-h-11 w-full rounded-full text-sm font-bold text-mute"
        >
          Non merci
        </button>
      )}
    </section>
  );
}
