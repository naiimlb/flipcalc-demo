// Validation et nettoyage des données envoyées par le navigateur (on ne leur fait jamais confiance),
// et masquage des données personnelles : l'assistant ne doit traiter que des tâches et des montants.
import type { AssistantContext, AssistantRequest, ChatTurn, ContextTask } from "@/lib/assistant-types";
import { CATEGORIES, type Category } from "@/lib/types";

const MAX_MESSAGES = 16; // historique envoyé au modèle
const MAX_USER_CHARS = 600;
const MAX_ASSISTANT_CHARS = 1500;

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
// Téléphones FR/intl : 06 12 34 56 78, 06.12.34.56.78, +33 6 12 34 56 78, 0033…
const PHONE = /(?:(?:\+|00)\d{1,3}[\s.-]?|\b0)\d(?:[\s.-]?\d{2}){4}\b/g;
// Numéros de carte : 13 à 19 chiffres, avec espaces ou tirets.
const CARD = /\b(?:\d[ -]?){13,19}\b/g;

export function maskPersonalData(text: string): string {
  return text.replace(EMAIL, "[masqué]").replace(PHONE, "[masqué]").replace(CARD, "[masqué]");
}

const time = (v: unknown) => (typeof v === "string" && /^\d{2}:\d{2}$/.test(v) ? v : "00:00");
const short = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : "");

function parseContext(raw: unknown): AssistantContext {
  const c = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const tva = typeof c.tva === "number" && c.tva >= 0 && c.tva <= 30 ? c.tva : 10;
  const taches: ContextTask[] = (Array.isArray(c.taches) ? c.taches : []).slice(0, 60).map((t) => {
    const o = (typeof t === "object" && t !== null ? t : {}) as Record<string, unknown>;
    return {
      titre: maskPersonalData(short(o.titre, 60)),
      heure: time(o.heure),
      categorie: (CATEGORIES as readonly string[]).includes(String(o.categorie)) ? (o.categorie as Category) : "Autre",
      faite: o.faite === true,
      en_retard: o.en_retard === true,
      apres_minuit: o.apres_minuit === true,
    };
  });
  return {
    maintenant: time(c.maintenant),
    phase: c.phase === "service" ? "service" : "hors_service",
    service_du: short(c.service_du, 40),
    tva,
    taches,
  };
}

/** Renvoie la requête nettoyée, ou null si elle est inutilisable. */
export function parseRequest(body: unknown): AssistantRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.messages)) return null;

  const messages: ChatTurn[] = [];
  for (const m of b.messages.slice(-MAX_MESSAGES)) {
    if (typeof m !== "object" || m === null) return null;
    const { role, content } = m as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const text = role === "user" ? maskPersonalData(content).slice(0, MAX_USER_CHARS) : content.slice(0, MAX_ASSISTANT_CHARS);
    if (text.trim()) messages.push({ role, content: text });
  }
  // Une conversation valide commence par un message utilisateur et finit par un message utilisateur.
  while (messages[0]?.role === "assistant") messages.shift();
  if (messages.length === 0 || messages[messages.length - 1]?.role !== "user") return null;

  return { messages, context: parseContext(b.context) };
}
