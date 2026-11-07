import type { AppModule } from "@/modules/types";

/** Module prévu : compagnon du quotidien et du Ramadan. Pas encore d'écran. */
export const quotidienModule: AppModule = {
  id: "quotidien",
  title: "Compagnon du quotidien",
  summary: "Invocations, rappels et suivi du Ramadan.",
  status: "planned",
  basePath: "/quotidien",
  tabs: [],
};
