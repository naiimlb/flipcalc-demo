"use client";

import { doneKey } from "./db-map";
import { occAct } from "./sharing";
import { refreshStore, updateState } from "./store";
import { showToast } from "./toast";
import type { Task } from "./types";

/**
 * Coche ou décoche une tâche pour une journée de service. Une tâche partagée passe d'abord par la base (qui garantit
 * qu'une seule personne la prend en mode « un seul s'en occupe ») et arrête aussi les relances.
 * Renvoie false si un collègue s'en occupe déjà.
 */
export async function setTaskDone(task: Task, date: string, makeDone: boolean): Promise<boolean> {
  const key = doneKey(task.id, date);
  const shared = task.shareMode !== undefined || task.shareStatus !== undefined || task.transferOnly === true;
  if (makeDone && shared) {
    const r = await occAct(task.id, date, "done");
    if (!r.ok) {
      if ("takenBy" in r) showToast(`🙌 ${r.takenBy} s'en occupe déjà`, "Tu n'as plus rien à faire pour cette tâche.");
      else showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
      void refreshStore(true);
      return false;
    }
  }
  await updateState((s) => {
    const done = { ...s.done };
    if (makeDone) done[key] = true;
    else delete done[key];
    return { ...s, done };
  });
  return true;
}

/** « Refuser » : je ne ferai pas cette tâche aujourd'hui (motif facultatif). Notifie qui me l'a envoyée. */
export async function declineTask(task: Task, date: string, reason: string): Promise<boolean> {
  const r = await occAct(task.id, date, "decline", 10, reason);
  if (!r.ok) {
    showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    return false;
  }
  await refreshStore(true);
  return true;
}

/** « Laisser tomber » : la tâche est abandonnée pour cette journée (gardée dans l'historique). */
export async function abandonTask(task: Task, date: string): Promise<boolean> {
  const r = await occAct(task.id, date, "abandon");
  if (!r.ok) {
    showToast("⚠️ Pas enregistré", "Vérifie ta connexion et réessaie.");
    return false;
  }
  return true;
}
