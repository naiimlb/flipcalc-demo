import type { AssistantContext, ChatTurn } from "./assistant-types";
import type { ChatMessage } from "./chat-store";
import { formatServiceDate, isServiceLive, planForService, serviceDate } from "./service";
import type { AppState } from "./types";

/** Résumé de la liste du jour envoyé avec chaque message (rien d'autre ne quitte l'appareil). */
export function buildContext(state: AppState, now: Date): AssistantContext {
  const sDate = serviceDate(now);
  const live = isServiceLive(now);
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return {
    maintenant: `${hh}:${mm}`,
    phase: live ? "service" : "hors_service",
    service_du: formatServiceDate(sDate),
    tva: state.tva,
    taches: planForService(state.tasks, sDate).map((p) => {
      const faite = !!state.done[p.key];
      return {
        titre: p.task.title,
        heure: p.task.time,
        categorie: p.task.category,
        faite,
        en_retard: live && !faite && p.at.getTime() < now.getTime(),
        apres_minuit: p.afterMidnight,
      };
    }),
  };
}

/** Historique envoyé à l'API : texte seul, tours consécutifs du même rôle fusionnés. */
export function toTurns(messages: ChatMessage[]): ChatTurn[] {
  const turns: ChatTurn[] = [];
  for (const m of messages) {
    if (m.error) continue;
    let content = m.text.trim();
    if (m.role === "assistant" && m.proposals?.length) {
      content += `\n[Tâches proposées à l'utilisateur : ${m.proposals.map((p) => `${p.task.title} à ${p.task.time}`).join(", ")}]`;
    }
    if (!content) continue;
    const last = turns[turns.length - 1];
    if (last && last.role === m.role) last.content += `\n${content}`;
    else turns.push({ role: m.role, content });
  }
  return turns;
}
