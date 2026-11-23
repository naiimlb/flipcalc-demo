// Outils (function calling) de l'assistant. Le modèle ne calcule JAMAIS : il appelle ces fonctions,
// qui travaillent en centimes (src/lib/money.ts) et renvoient des textes déjà formatés à recopier.
import type { AssistantContext, ProposedTask } from "@/lib/assistant-types";
import {
  change,
  computeGap,
  countCash,
  DENOMINATIONS,
  formatDenomination,
  formatEuro,
  percent,
  percentOf,
  split,
  toCents,
  vat,
} from "@/lib/money";
import { isAfterMidnight, SERVICE_END, SERVICE_START, sortKey, toMinutes } from "@/lib/service";
import { CATEGORIES, type Category, type Reminder } from "@/lib/types";
import type { ToolSpec } from "./provider";

export type ToolOutput = { result: Record<string, unknown>; proposal?: ProposedTask };
type Args = Record<string, unknown>;

const err = (message: string): ToolOutput => ({ result: { erreur: message } });
const isObj = (v: unknown): v is Args => typeof v === "object" && v !== null && !Array.isArray(v);

function intIn(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

const pctText = (n: number) => `${n.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;

// ---------------------------------------------------------------- calculs d'argent

function compterCaisse(args: Args): ToolOutput {
  if (!Array.isArray(args.lignes) || args.lignes.length === 0) return err("Il faut au moins une ligne {valeur, quantite}.");
  const lines: { denomination: number; quantity: number }[] = [];
  for (const raw of args.lignes.slice(0, 40)) {
    if (!isObj(raw)) return err("Ligne invalide.");
    const denomination = toCents(raw.valeur);
    const quantity = intIn(raw.quantite, 0, 100_000);
    if (denomination === null || !DENOMINATIONS.includes(denomination))
      return err(`Coupure inconnue : ${String(raw.valeur)}. Valeurs possibles : ${DENOMINATIONS.map(formatDenomination).join(", ")}.`);
    if (quantity === null) return err(`Quantité invalide pour ${String(raw.valeur)} (entier attendu).`);
    lines.push({ denomination, quantity });
  }
  const { rows, total, pieces } = countCash(lines);
  const result: Record<string, unknown> = {
    lignes: rows.map((r) => r.label),
    total: formatEuro(total),
    nombre_de_billets_et_pieces: pieces,
  };
  if (args.montant_attendu !== undefined && args.montant_attendu !== null) {
    const expected = toCents(args.montant_attendu);
    if (expected === null) return err("montant_attendu invalide.");
    result.montant_attendu = formatEuro(expected);
    result.ecart = computeGap(total, expected).text;
  }
  return { result };
}

function calculerEcart(args: Args): ToolOutput {
  const counted = toCents(args.montant_compte);
  const z = toCents(args.ticket_z_especes);
  const fond = args.fond_de_caisse === undefined || args.fond_de_caisse === null ? 0 : toCents(args.fond_de_caisse);
  if (counted === null || z === null || fond === null) return err("Il faut montant_compte et ticket_z_especes (nombres en euros).");
  const expected = z + fond;
  const gap = computeGap(counted, expected);
  return {
    result: {
      detail: [
        `Compté : ${formatEuro(counted)}`,
        `Ticket Z (espèces) : ${formatEuro(z)}`,
        ...(fond ? [`Fond de caisse : ${formatEuro(fond)}`] : []),
        `Attendu : ${formatEuro(expected)}`,
      ],
      ecart: gap.text,
      type: gap.kind === "exact" ? "aucun écart" : gap.kind === "surplus" ? "excédent" : "manque",
    },
  };
}

function calculerTva(args: Args, ctx: AssistantContext): ToolOutput {
  const amount = toCents(args.montant);
  const from = args.type === "HT" || args.type === "TTC" ? args.type : null;
  const rate = args.taux === undefined || args.taux === null ? ctx.tva : Number(args.taux);
  if (amount === null || amount < 0 || !from) return err("Il faut montant (≥ 0) et type : \"HT\" ou \"TTC\".");
  if (!Number.isFinite(rate) || rate < 0 || rate > 30) return err("Taux de TVA invalide (en %, entre 0 et 30).");
  const r = vat(amount, from, rate);
  return {
    result: {
      taux: pctText(rate),
      montant_de_depart: `${formatEuro(amount)} ${from}`,
      ht: formatEuro(r.ht),
      tva: formatEuro(r.tva),
      ttc: formatEuro(r.ttc),
    },
  };
}

function rendreMonnaie(args: Args): ToolOutput {
  const due = toCents(args.montant_du);
  const given = toCents(args.montant_donne);
  if (due === null || given === null || due < 0 || given < 0) return err("Il faut montant_du et montant_donne (euros).");
  const r = change(due, given);
  if (!r.ok) return { result: { du: formatEuro(due), donne: formatEuro(given), erreur: `Il manque ${formatEuro(r.missing)} : le client n'a pas donné assez.` } };
  return {
    result: {
      du: formatEuro(due),
      donne: formatEuro(given),
      a_rendre: formatEuro(r.back),
      en_billets_et_pieces: r.parts.length ? r.parts.map((p) => p.label) : ["Rien à rendre"],
    },
  };
}

function calculerTotalCommande(args: Args): ToolOutput {
  if (!Array.isArray(args.articles) || args.articles.length === 0) return err("Il faut au moins un article {prix_unitaire, quantite}.");
  const lines: string[] = [];
  let total = 0;
  let i = 0;
  for (const raw of args.articles.slice(0, 50)) {
    i++;
    if (!isObj(raw)) return err("Article invalide.");
    const price = toCents(raw.prix_unitaire);
    const qty = intIn(raw.quantite ?? 1, 1, 1000);
    if (price === null || price < 0 || qty === null) return err(`Article ${i} : prix_unitaire (euros) et quantite (entier) requis.`);
    const name = typeof raw.nom === "string" && raw.nom.trim() ? raw.nom.trim().slice(0, 40) : `Article ${i}`;
    total += price * qty;
    lines.push(`${qty} × ${name} (${formatEuro(price)}) = ${formatEuro(price * qty)}`);
  }
  return { result: { lignes: lines, total: formatEuro(total) } };
}

function calculerPourcentage(args: Args): ToolOutput {
  const amount = toCents(args.montant);
  const op = args.operation;
  if (amount === null) return err("montant invalide.");
  if (op === "taux") {
    const total = toCents(args.sur);
    if (total === null) return err("Pour operation \"taux\", donne aussi `sur` (le total).");
    const p = percentOf(amount, total);
    if (p === null) return err("Impossible de diviser par 0.");
    return { result: { calcul: `${formatEuro(amount)} sur ${formatEuro(total)}`, resultat: pctText(p) } };
  }
  const pct = Number(args.pourcentage);
  if ((op !== "part" && op !== "ajouter" && op !== "retirer") || !Number.isFinite(pct) || pct < 0 || pct > 1000)
    return err("operation : part, ajouter, retirer ou taux ; pourcentage : nombre entre 0 et 1000.");
  const part = percent("part", amount, pct);
  const out = percent(op, amount, pct);
  return {
    result: {
      montant: formatEuro(amount),
      pourcentage: pctText(pct),
      valeur_du_pourcentage: formatEuro(part),
      ...(op !== "part" ? { resultat: formatEuro(out), operation: op === "ajouter" ? "montant + pourcentage" : "montant − pourcentage" } : {}),
    },
  };
}

function partagerMontant(args: Args): ToolOutput {
  const amount = toCents(args.montant);
  const n = intIn(args.parts, 2, 50);
  if (amount === null || amount < 0 || n === null) return err("Il faut montant (≥ 0) et parts (entier entre 2 et 50).");
  const shares = split(amount, n);
  return {
    result: {
      montant: formatEuro(amount),
      parts: shares.map((s, i) => `Part ${i + 1} : ${formatEuro(s)}`),
      verification_total: formatEuro(shares.reduce((a, b) => a + b, 0)),
      note: shares[0] !== shares[n - 1] ? "Les centimes restants sont donnés aux premières parts." : "Parts égales.",
    },
  };
}

// ---------------------------------------------------------------- tâches

function lireTachesDuJour(_args: Args, ctx: AssistantContext): ToolOutput {
  const sorted = [...ctx.taches].sort((a, b) => sortKey(a.heure) - sortKey(b.heure));
  const done = sorted.filter((t) => t.faite).length;
  const late = sorted.filter((t) => t.en_retard && !t.faite);
  const next = sorted.find((t) => !t.faite && !t.en_retard);
  const lineOf = (t: (typeof sorted)[number]) =>
    `${t.heure} · ${t.titre} (${t.categorie})${t.apres_minuit ? " 🌙" : ""} — ${t.faite ? "faite" : t.en_retard ? "EN RETARD" : "à venir"}`;
  return {
    result: {
      maintenant: ctx.maintenant,
      service_du: ctx.service_du,
      phase: ctx.phase === "service" ? "service en cours (19h → 3h)" : "hors service (le service commence à 19h)",
      total: sorted.length,
      faites: done,
      restantes: sorted.length - done,
      en_retard: late.length,
      prochaine_tache: next ? `${next.heure} · ${next.titre}` : "aucune",
      taches: sorted.map(lineOf),
    },
  };
}

function normalizeTime(input: unknown, ctx: AssistantContext, now: boolean): string | { error: string } {
  let minutes: number;
  if (now) {
    const m = toMinutes(ctx.maintenant);
    minutes = Math.ceil(m / 5) * 5; // prochain multiple de 5 min
    if (minutes >= 24 * 60) minutes -= 24 * 60;
    if (ctx.phase !== "service") minutes = SERVICE_START;
    else if (minutes >= SERVICE_END && minutes < SERVICE_START) minutes = SERVICE_START;
  } else {
    const match = typeof input === "string" ? /^\s*(\d{1,2})\s*[:hH]\s*(\d{2})?\s*$/.exec(input) : null;
    if (!match) return { error: "heure invalide : attendu \"HH:MM\" (ex. \"23:30\"), ou maintenant=true." };
    minutes = Number(match[1]) * 60 + Math.round(Number(match[2] ?? 0) / 5) * 5;
  }
  const m = minutes % (24 * 60);
  const inWindow = m >= SERVICE_START || m < SERVICE_END;
  if (!inWindow) return { error: "L'heure doit être pendant le service : entre 19:00 et 02:55." };
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function proposerTache(args: Args, ctx: AssistantContext): ToolOutput {
  const title = typeof args.titre === "string" ? args.titre.trim().slice(0, 60) : "";
  if (!title) return err("titre requis (court, ex. « Vider les poubelles »).");
  if (ctx.taches.some((t) => t.titre.trim().toLowerCase() === title.toLowerCase()))
    return { result: { deja_dans_la_liste: true, message: "Cette tâche est déjà dans la liste du jour. Ne la propose pas." } };

  const category = (CATEGORIES as readonly string[]).includes(String(args.categorie)) ? (args.categorie as Category) : "Autre";
  const now = args.maintenant === true;
  const time = normalizeTime(args.heure, ctx, now);
  if (typeof time !== "string") return err(time.error);
  const remindRaw = args.rappel_min === undefined ? (now ? 0 : 5) : Number(args.rappel_min);
  const remind = ([0, 5, 15] as const).includes(remindRaw as Reminder) ? (remindRaw as Reminder) : 5;
  const note = typeof args.note === "string" && args.note.trim() ? args.note.trim().slice(0, 200) : undefined;

  const task: ProposedTask = { title, category, time, remind, ...(note ? { note } : {}) };
  return {
    proposal: task,
    result: {
      statut: "proposition affichée à l'utilisateur avec un bouton « Ajouter à mes tâches » (rien n'est encore ajouté)",
      titre: title,
      heure: time.replace(":", "h"),
      apres_minuit: isAfterMidnight(time),
    },
  };
}

// ---------------------------------------------------------------- registre

type Handler = (args: Args, ctx: AssistantContext) => ToolOutput;

const euroProp = (description: string) => ({ type: "number", description });

export const TOOLS: (ToolSpec & { run: Handler })[] = [
  {
    name: "compter_caisse",
    description: "Compte la caisse : total à partir de la quantité de billets/pièces par coupure. Compare à un montant attendu si fourni.",
    parameters: {
      type: "object",
      required: ["lignes"],
      properties: {
        lignes: {
          type: "array",
          description: "Une ligne par coupure comptée.",
          items: {
            type: "object",
            required: ["valeur", "quantite"],
            properties: {
              valeur: euroProp("Valeur de la coupure en euros : 500, 200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02 ou 0.01"),
              quantite: { type: "integer", description: "Nombre de billets/pièces de cette valeur" },
            },
          },
        },
        montant_attendu: euroProp("Optionnel : montant attendu en euros pour calculer l'écart"),
      },
    },
    run: compterCaisse,
  },
  {
    name: "calculer_ecart",
    description: "Écart de caisse = argent compté − (espèces du ticket Z + fond de caisse). Dit s'il y a un excédent, un manque ou rien.",
    parameters: {
      type: "object",
      required: ["montant_compte", "ticket_z_especes"],
      properties: {
        montant_compte: euroProp("Total d'espèces compté dans la caisse, en euros"),
        ticket_z_especes: euroProp("Montant des ventes en espèces sur le ticket Z, en euros"),
        fond_de_caisse: euroProp("Optionnel : fond de caisse de départ en euros, à ajouter à l'attendu"),
      },
    },
    run: calculerEcart,
  },
  {
    name: "calculer_tva",
    description: "Calcule HT, TVA et TTC à partir d'un montant HT ou TTC. Le taux par défaut est celui du contexte.",
    parameters: {
      type: "object",
      required: ["montant", "type"],
      properties: {
        montant: euroProp("Montant en euros"),
        type: { type: "string", enum: ["HT", "TTC"], description: "Le montant donné est-il HT ou TTC ?" },
        taux: euroProp("Optionnel : taux de TVA en % (sinon taux par défaut)"),
      },
    },
    run: calculerTva,
  },
  {
    name: "rendre_monnaie",
    description: "Calcule la monnaie à rendre et le détail en billets/pièces.",
    parameters: {
      type: "object",
      required: ["montant_du", "montant_donne"],
      properties: {
        montant_du: euroProp("Montant à payer, en euros"),
        montant_donne: euroProp("Montant donné par le client, en euros"),
      },
    },
    run: rendreMonnaie,
  },
  {
    name: "calculer_total_commande",
    description: "Total d'une commande à partir des prix unitaires donnés par le caissier (ne jamais inventer un prix).",
    parameters: {
      type: "object",
      required: ["articles"],
      properties: {
        articles: {
          type: "array",
          items: {
            type: "object",
            required: ["prix_unitaire", "quantite"],
            properties: {
              nom: { type: "string", description: "Nom de l'article (optionnel)" },
              prix_unitaire: euroProp("Prix unitaire TTC en euros"),
              quantite: { type: "integer" },
            },
          },
        },
      },
    },
    run: calculerTotalCommande,
  },
  {
    name: "calculer_pourcentage",
    description: "Pourcentage : x % d'un montant (part), montant + x % (ajouter), montant − x % (retirer), ou quel % représente un montant sur un total (taux).",
    parameters: {
      type: "object",
      required: ["montant", "operation"],
      properties: {
        montant: euroProp("Montant de départ en euros (pour taux : la partie)"),
        operation: { type: "string", enum: ["part", "ajouter", "retirer", "taux"] },
        pourcentage: euroProp("Le pourcentage (ex. 15 pour 15 %), sauf pour operation=taux"),
        sur: euroProp("Pour operation=taux : le total de référence en euros"),
      },
    },
    run: calculerPourcentage,
  },
  {
    name: "partager_montant",
    description: "Partage un montant en plusieurs parts égales (les centimes restants vont aux premières parts).",
    parameters: {
      type: "object",
      required: ["montant", "parts"],
      properties: { montant: euroProp("Montant à partager en euros"), parts: { type: "integer", description: "Nombre de parts (2 à 50)" } },
    },
    run: partagerMontant,
  },
  {
    name: "lire_taches_du_jour",
    description: "Lit la liste des tâches du service en cours : heure, catégorie, faite / en retard / à venir, compteurs.",
    parameters: { type: "object", properties: {} },
    run: lireTachesDuJour,
  },
  {
    name: "proposer_tache",
    description:
      "Propose une tâche au caissier. N'ajoute rien : affiche un bouton « Ajouter à mes tâches ». Pour une tâche immédiate, mets maintenant=true. Sinon donne une heure entre 19:00 et 02:55.",
    parameters: {
      type: "object",
      required: ["titre"],
      properties: {
        titre: { type: "string", description: "Titre court, ex. « Vider les poubelles »" },
        categorie: { type: "string", enum: [...CATEGORIES] },
        heure: { type: "string", description: "Heure \"HH:MM\" entre 19:00 et 02:55 (ignorée si maintenant=true)" },
        maintenant: { type: "boolean", description: "true = à faire tout de suite (le code règle l'heure)" },
        rappel_min: { type: "integer", enum: [0, 5, 15], description: "Rappel : à l'heure (0), 5 ou 15 min avant" },
        note: { type: "string", description: "Optionnel, une courte consigne" },
      },
    },
    run: proposerTache,
  },
];

export const TOOL_SPECS: ToolSpec[] = TOOLS.map(({ name, description, parameters }) => ({ name, description, parameters }));

export function executeTool(name: string, rawArguments: string, ctx: AssistantContext): ToolOutput {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return err(`Outil inconnu : ${name}.`);
  let args: unknown = {};
  try {
    args = rawArguments ? JSON.parse(rawArguments) : {};
  } catch {
    return err("Arguments illisibles (JSON invalide).");
  }
  if (!isObj(args)) return err("Arguments invalides.");
  try {
    return tool.run(args, ctx);
  } catch {
    return err("Erreur interne dans l'outil.");
  }
}
