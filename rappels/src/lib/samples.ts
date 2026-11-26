import { minutesToTime, type Handover, type TeamPref } from "./service";
import type { Category, Task } from "./types";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function t(title: string, category: Category, time: string, team: TeamPref, remind: number, note?: string): Task {
  return { id: crypto.randomUUID(), title, category, time, days: ALL_DAYS, team, remind, untilDone: true, paused: false, ...(note ? { note } : {}) };
}

/**
 * Tâches d'exemple, avec de nouveaux identifiants (prêtes à être enregistrées dans le compte).
 * Les heures de transmission et de vérification dépendent de l'heure de relève choisie (18h00 ou 18h30).
 */
export function sampleTasks(handover: Handover): Task[] {
  return [
    // Équipe jour
    t("Ouvrir la caisse + fond de caisse", "Caisse", "10:50", "jour", 5, "Compte les billets et les pièces, note le total."),
    t("Mise en place comptoir", "Salle", "11:00", "jour", 0),
    t("Réappro sauces et gobelets", "Stock", "14:00", "jour", 5),
    t("Nettoyage comptoir", "Hygiène", "16:30", "jour", 0),
    t("Transmission à l'équipe du soir", "Caisse", minutesToTime(handover - 15), "jour", 5, "Passe les consignes et le point caisse."),
    // Équipe soir
    t("Vérifier le fond de caisse après relève", "Caisse", minutesToTime(handover + 5), "soir", 0),
    t("Réappro sauces et gobelets", "Stock", "20:30", "soir", 5),
    t("Nettoyage comptoir", "Hygiène", "22:30", "soir", 0),
    t("Vérif frigo boissons", "Stock", "00:30", "soir", 5, "Réassortir canettes et bouteilles, vérifier les dates."),
    t("Clôture caisse", "Caisse", "01:30", "soir", 15, "Ticket Z, comptage, mise en coffre."),
  ];
}
