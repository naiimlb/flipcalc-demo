/**
 * Lecture tolérante d'un JSON encore en cours d'écriture (réponse de l'IA diffusée en continu).
 * Ferme les chaînes, tableaux et objets ouverts, et retire le dernier fragment incomplet.
 * Ne sert qu'à l'AFFICHAGE progressif : le résultat final est toujours validé par Zod côté serveur.
 */

/** Complète les structures ouvertes ; renvoie null si le texte n'est pas exploitable. */
function closeOpenStructures(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === "{") stack.push("}");
    else if (c === "[") stack.push("]");
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = text;
  if (inString) {
    if (escaped) out = out.slice(0, -1); // antislash final : séquence d'échappement incomplète
    // Séquence \uXXXX tronquée : on retire le fragment.
    out = out.replace(/\\u[0-9a-fA-F]{0,3}$/, "");
    out += '"';
  }
  return out + stack.reverse().join("");
}

/**
 * Renvoie la valeur JSON la plus complète possible, ou undefined s'il n'y a encore rien d'exploitable.
 * Le texte peut commencer par du bruit (balises Markdown) : on part de la première accolade.
 */
export function parsePartialJson(input: string): unknown {
  const start = input.indexOf("{");
  if (start < 0) return undefined;
  let text = input.slice(start);
  for (let attempt = 0; attempt < 80 && text.length > 0; attempt++) {
    try {
      return JSON.parse(closeOpenStructures(text));
    } catch {
      // Fragment final incomplet (clé sans valeur, nombre ou littéral tronqué, virgule pendante) : on rogne.
      text = text.slice(0, -1);
    }
  }
  return undefined;
}

/* ------------------------- Avancement affiché à l'écran ------------------------- */

/** Rubriques de la conception, dans l'ordre où l'IA les écrit (voir DESIGN_JSON_SCHEMA). */
export const DESIGN_SECTIONS = [
  { key: "analysis", label: "Analyse" },
  { key: "solution", label: "Solution" },
  { key: "dimensions", label: "Dimensions" },
  { key: "materials", label: "Matériaux" },
  { key: "fabrication", label: "Fabrication" },
  { key: "cost", label: "Coût" },
  { key: "model", label: "Modèle 3D" },
] as const;

export interface StreamProgress {
  stage: "checking" | "thinking" | "writing" | "saving";
  title?: string;
  category?: string;
  analysis?: { summary?: string; needs?: string[]; constraints?: string[] };
  /** Rubriques terminées (celles qui précèdent la rubrique en cours d'écriture). */
  done: string[];
}

const asString = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
const asStrings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.length > 0) : undefined);

/** Extrait de la réponse partielle ce qu'on peut montrer : titre, analyse en direct, rubriques terminées. */
export function progressFromText(text: string): StreamProgress | null {
  const partial = parsePartialJson(text);
  if (!partial || typeof partial !== "object" || Array.isArray(partial)) return null;
  const obj = partial as Record<string, unknown>;
  const keys = Object.keys(obj);
  const analysis = obj.analysis && typeof obj.analysis === "object" && !Array.isArray(obj.analysis) ? (obj.analysis as Record<string, unknown>) : null;
  return {
    stage: "writing",
    title: asString(obj.title),
    category: asString(obj.category),
    analysis: analysis
      ? { summary: asString(analysis.summary), needs: asStrings(analysis.needs), constraints: asStrings(analysis.constraints) }
      : undefined,
    // La dernière clé est encore en cours d'écriture, sauf si l'objet est fermé.
    done: closed(text) ? keys : keys.slice(0, -1),
  };
}

/** Vrai si l'objet racine est complet (accolade finale reçue). */
function closed(text: string): boolean {
  const start = text.indexOf("{");
  if (start < 0) return false;
  try {
    JSON.parse(text.slice(start).trim());
    return true;
  } catch {
    return false;
  }
}

/** Compare deux avancements : vrai s'il y a quelque chose de nouveau à afficher. */
export function progressChanged(a: StreamProgress | null, b: StreamProgress): boolean {
  if (!a) return true;
  return (
    a.stage !== b.stage ||
    a.title !== b.title ||
    a.done.length !== b.done.length ||
    a.analysis?.summary !== b.analysis?.summary ||
    (a.analysis?.needs?.length ?? 0) !== (b.analysis?.needs?.length ?? 0) ||
    (a.analysis?.constraints?.length ?? 0) !== (b.analysis?.constraints?.length ?? 0)
  );
}
