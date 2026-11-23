// Types partagés entre l'interface (navigateur) et la route API (serveur).
import type { Category, Reminder } from "./types";

/** Photo de la liste du jour envoyée avec chaque message : l'IA n'a aucun autre accès aux données. */
export type ContextTask = {
  titre: string;
  heure: string; // "HH:MM"
  categorie: Category;
  faite: boolean;
  en_retard: boolean;
  apres_minuit: boolean;
};

export type AssistantContext = {
  maintenant: string; // "HH:MM", heure locale du caissier
  phase: "service" | "hors_service"; // service = 19h → 3h
  service_du: string; // ex. "lundi 23 novembre"
  tva: number; // taux par défaut, en %
  taches: ContextTask[];
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

export type AssistantRequest = { messages: ChatTurn[]; context: AssistantContext };

/** Tâche que l'assistant propose : elle n'est ajoutée qu'après un clic de l'utilisateur. */
export type ProposedTask = {
  title: string;
  category: Category;
  time: string; // "HH:MM", dans la fenêtre 19:00 → 02:55
  remind: Reminder;
  note?: string;
};

export type ErrorCode = "rate_limit" | "quota" | "auth" | "unavailable" | "unknown";

/** Événements renvoyés par /api/assistant, une ligne JSON chacun (NDJSON). */
export type StreamEvent =
  | { type: "text"; text: string }
  | { type: "proposal"; task: ProposedTask }
  | { type: "error"; code: ErrorCode; message: string }
  | { type: "done" };

export const MESSAGES_PER_HOUR = 30;
