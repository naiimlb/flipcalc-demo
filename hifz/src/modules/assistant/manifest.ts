import type { AppModule } from "@/modules/types";

/** Module prévu : questions-réponses sur l'islam, avec sources. Pas encore d'écran. */
export const assistantModule: AppModule = {
  id: "assistant",
  title: "Assistant",
  summary: "Poser une question sur l'islam et obtenir une réponse sourcée.",
  status: "planned",
  basePath: "/assistant",
  tabs: [],
};
