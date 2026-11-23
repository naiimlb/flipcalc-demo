// Boucle « modèle → outils → modèle » de l'assistant. Indépendante du fournisseur (voir provider.ts).
import type { AssistantContext, ChatTurn, ProposedTask } from "@/lib/assistant-types";
import { streamChat, type ProviderMessage } from "./provider";
import { SYSTEM_PROMPT } from "./system-prompt";
import { executeTool, TOOL_SPECS } from "./tools";

const MAX_ROUNDS = 4; // allers-retours modèle ↔ outils maximum pour un message
const MAX_CALLS_PER_ROUND = 6;

export type AssistantEvent = { type: "text"; text: string } | { type: "proposal"; task: ProposedTask };

function contextBlock(ctx: AssistantContext): string {
  const lines = ctx.taches.map(
    (t) => `- ${t.heure} ${t.titre} (${t.categorie}) : ${t.faite ? "faite" : t.en_retard ? "EN RETARD" : "à venir"}`,
  );
  return [
    "# CONTEXTE DU MOMENT (fourni par l'application)",
    `Heure : ${ctx.maintenant} · ${ctx.phase === "service" ? "service en cours" : "hors service (le service commence à 19h)"} · service du ${ctx.service_du}`,
    `Taux de TVA par défaut : ${ctx.tva} %`,
    `Tâches du jour (${ctx.taches.length}) :`,
    ...(lines.length ? lines : ["- aucune"]),
  ].join("\n");
}

export async function* runAssistant(history: ChatTurn[], ctx: AssistantContext): AsyncGenerator<AssistantEvent> {
  const messages: ProviderMessage[] = [{ role: "system", content: `${SYSTEM_PROMPT}\n\n${contextBlock(ctx)}` }, ...history];
  let emitted = false; // du texte a déjà été envoyé à l'utilisateur

  for (let round = 0; round < MAX_ROUNDS; round++) {
    let text = "";
    let calls: { id: string; name: string; arguments: string }[] = [];

    for await (const ev of streamChat({ messages, tools: TOOL_SPECS })) {
      if (ev.type === "text") {
        // Sépare proprement le texte d'avant et d'après un appel d'outil.
        const chunk = emitted && text === "" && round > 0 ? `\n\n${ev.text}` : ev.text;
        text += ev.text;
        emitted = true;
        yield { type: "text", text: chunk };
      } else calls = ev.calls.slice(0, MAX_CALLS_PER_ROUND);
    }

    if (calls.length === 0) return;

    messages.push({ role: "assistant", content: text, toolCalls: calls });
    for (const call of calls) {
      const out = executeTool(call.name, call.arguments, ctx);
      if (out.proposal) yield { type: "proposal", task: out.proposal };
      messages.push({ role: "tool", name: call.name, toolCallId: call.id, content: JSON.stringify(out.result) });
    }
  }

  yield { type: "text", text: "\n\nJe tourne en rond là. Reformule ta demande en une phrase 🙏" };
}
