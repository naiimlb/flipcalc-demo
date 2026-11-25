export const CATEGORIES = ["Caisse", "Salle", "Stock", "Hygiène", "Autre"] as const;
export type Category = (typeof CATEGORIES)[number];

export const REMINDERS = [0, 5, 15] as const;
export type Reminder = (typeof REMINDERS)[number];

export type Task = {
  id: string;
  title: string;
  category: Category;
  /** Heure de la tâche, "HH:MM" (service de 19h à 3h). */
  time: string;
  /** Jours de SERVICE concernés, 0 = lundi … 6 = dimanche. Un service démarre à 19h ce jour-là. */
  days: number[];
  /** Tâche ponctuelle : date du service concerné ("YYYY-MM-DD"). Sans elle, la tâche suit `days`. */
  date?: string;
  /** Minutes d'avance du rappel. */
  remind: Reminder;
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
