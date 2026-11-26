import type { Handover, TeamPref } from "./service";

export const CATEGORIES = ["Caisse", "Salle", "Stock", "Hygiène", "Autre"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REMINDERS = [0, 5, 15] as const;
export type Reminder = (typeof REMINDERS)[number];

export type Task = {
  id: string;
  title: string;
  category: Category;
  /** Heure de la tâche, "HH:MM" (journée de service de 11h à 2h). */
  time: string;
  /** Jours de SERVICE concernés, 0 = lundi … 6 = dimanche. La journée démarre à 11h ce jour-là et finit à 2h du matin. */
  days: number[];
  /** Tâche ponctuelle : date du service concerné ("YYYY-MM-DD"). Sans elle, la tâche suit `days`. */
  date?: string;
  /** Pour quelle équipe : jour, soir ou les deux. */
  team: TeamPref;
  /** Rappel X minutes avant l'heure de la tâche (0 = à l'heure). */
  remind: number;
  /** Répéter le rappel toutes les X minutes (absent = une seule fois). */
  repeatEvery?: number;
  /** Fin de la fenêtre de répétition, "HH:MM" (obligatoire avec `repeatEvery`). */
  endTime?: string;
  /** Les rappels s'arrêtent dès que la tâche est cochée. */
  untilDone: boolean;
  /** Tâche en pause : ni affichée, ni rappelée. */
  paused: boolean;
  note?: string;
  /** Tâche assignée par un responsable. */
  assigned?: boolean;
};

export type Role = "caissier" | "responsable";

export type Profile = { id: string; email: string; prenom: string; role: Role };

export type Settings = {
  /** Rappel proposé par défaut pour les nouvelles tâches. */
  defaultRemind: Reminder;
  /** Recevoir les rappels (dans l'app, et en notification si autorisée). */
  notify: boolean;
  /** Heure de relève entre l'équipe jour et l'équipe soir, en minutes depuis minuit (18h00 ou 18h30). */
  handover: Handover;
  /** Mon planning : 7 lettres lundi → dimanche (J = jour, S = soir, R = repos, - = pas indiqué), ou null. */
  schedule: string | null;
};

export type AppState = {
  tasks: Task[];
  /** "<taskId>@<date du service>" → fait. */
  done: Record<string, true>;
  /** Rappels déjà envoyés sur CET appareil (non synchronisé), même clé que `done`. */
  notified: Record<string, true>;
  settings: Settings;
  profile: Profile;
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  Caisse: "💶",
  Salle: "🪑",
  Stock: "📦",
  Hygiène: "🧼",
  Autre: "⭐",
};
