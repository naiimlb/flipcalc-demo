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
  /** Minutes d'avance du rappel. */
  remind: Reminder;
  note?: string;
};

export type AppState = {
  v: 1;
  tasks: Task[];
  /** "<taskId>@<date du service>" → fait. */
  done: Record<string, true>;
  /** Rappels déjà envoyés, même clé que `done`. */
  notified: Record<string, true>;
  role: string;
};

export const CATEGORY_EMOJI: Record<Category, string> = {
  Caisse: "💶",
  Salle: "🪑",
  Stock: "📦",
  Hygiène: "🧼",
  Autre: "⭐",
};
