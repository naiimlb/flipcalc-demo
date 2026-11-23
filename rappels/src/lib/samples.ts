import type { AppState, Task } from "./types";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

export const SAMPLE_TASKS: Task[] = [
  { id: "ex-ouverture", title: "Ouvrir la caisse", category: "Caisse", time: "19:00", days: ALL_DAYS, remind: 5 },
  { id: "ex-fond", title: "Vérifier le fond de caisse", category: "Caisse", time: "19:05", days: ALL_DAYS, remind: 0, note: "Compte les billets et les pièces, note le total." },
  { id: "ex-reappro", title: "Réappro sauces et gobelets", category: "Stock", time: "21:00", days: ALL_DAYS, remind: 5 },
  { id: "ex-comptoir", title: "Nettoyer le comptoir", category: "Hygiène", time: "23:00", days: ALL_DAYS, remind: 0 },
  { id: "ex-frigo", title: "Vérif frigo boissons", category: "Stock", time: "00:30", days: ALL_DAYS, remind: 5, note: "Réassortir canettes et bouteilles, vérifier les dates." },
  { id: "ex-cloture", title: "Clôture caisse", category: "Caisse", time: "02:30", days: ALL_DAYS, remind: 15, note: "Ticket Z, comptage, mise en coffre." },
];

export function defaultState(): AppState {
  return { v: 1, tasks: SAMPLE_TASKS, done: {}, notified: {}, role: "Caissier" };
}
