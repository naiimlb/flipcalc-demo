import type { RecorderError } from "@/hooks/useRecorder";

/** Messages bienveillants pour chaque problème de micro (iOS en priorité). */
export const MIC_ERRORS: Record<RecorderError, { title: string; message: string }> = {
  denied: {
    title: "Accès au micro refusé",
    message:
      "Grat'Coran a besoin du micro pour écouter la récitation. Sur iPhone : Réglages › Safari › Micro › Autoriser, ou touche « aA » dans la barre d'adresse › Réglages du site web › Micro. Dans l'app installée, réessaie et accepte la demande.",
  },
  "no-mic": { title: "Aucun micro détecté", message: "Branche ou active un micro, puis réessaie." },
  busy: {
    title: "Micro indisponible",
    message: "Le micro est utilisé par une autre app (appel, mémo vocal…). Ferme-la puis réessaie.",
  },
  insecure: {
    title: "Connexion non sécurisée",
    message: "Le micro n'est disponible qu'en HTTPS. Ouvre l'app depuis son adresse https://.",
  },
  unsupported: {
    title: "Enregistrement non pris en charge",
    message: "Ce navigateur ne permet pas d'enregistrer. Sur iPhone, utilise Safari (iOS 14.3 ou plus récent).",
  },
  unknown: { title: "Micro inaccessible", message: "Impossible de démarrer l'enregistrement. Réessaie." },
};
