import type { Design } from "../design/schema";
import type { PrintEstimate } from "./estimate";

/**
 * « Où fabriquer » : uniquement des liens de RECHERCHE génériques (jamais de lien vers un produit précis)
 * et des prix marqués comme estimés.
 */

export interface SourcingLink {
  label: string;
  description: string;
  url: string;
}

export interface ShoppingItem {
  item: string;
  quantity: string;
  /** Prix approximatif, toujours présenté comme une estimation (null si inconnu). */
  estimate: string | null;
  url: string;
}

export const searchUrl = (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`;
export const mapsUrl = (query: string) => `https://www.google.com/maps/search/${encodeURIComponent(query)}`;

const euros = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: n < 20 ? 2 : 0 });

export function fabricationLinks(design: Design, materialLabel: string): SourcingLink[] {
  const main = design.materiaux_conseilles[0];
  const printed = !main || main.aspect === "plastic" || main.aspect === "rubber";
  const links: SourcingLink[] = [
    {
      label: "Services d'impression 3D en ligne",
      description: "Envoyez le fichier STL et recevez la pièce imprimée : comparez plusieurs devis.",
      url: searchUrl(`service impression 3D en ligne devis STL ${materialLabel}`),
    },
    {
      label: "Fablabs et imprimeurs près de chez vous",
      description: "Ateliers partagés et professionnels qui impriment à la demande.",
      url: mapsUrl("impression 3D fablab"),
    },
    {
      label: `Fournisseurs de ${materialLabel}`,
      description: "Pour imprimer vous-même : bobines de filament (ou résine).",
      url: searchUrl(`acheter ${materialLabel} ${/résine/i.test(materialLabel) ? "résine imprimante 3D" : "filament 1,75 mm 1 kg"}`),
    },
  ];
  if (!printed && main) {
    links.push({
      label: `Fabrication en ${main.nom}`,
      description: `Artisans et services de ${main.procede || "fabrication"} pour cette matière.`,
      url: searchUrl(`${main.procede || "fabrication sur mesure"} ${main.nom} sur mesure`),
    });
  }
  links.push({
    label: "Découpe laser et usinage à la demande",
    description: "Pour les plaques de bois, d'acrylique ou de métal.",
    url: searchUrl("découpe laser usinage à la demande en ligne devis"),
  });
  return links;
}

/** Liste d'achats : matière à imprimer (estimée) + éléments listés par la conception (visserie, accessoires…). */
export function shoppingList(design: Design, estimate: PrintEstimate | null): ShoppingItem[] {
  const items: ShoppingItem[] = [];
  if (estimate) {
    items.push({
      item: `${estimate.material.label} (${estimate.material.resin ? "résine" : "filament"})`,
      quantity: `≈ ${Math.max(1, Math.round(estimate.massGrams))} g`,
      estimate: `≈ ${euros(estimate.cost.min)} – ${euros(estimate.cost.max)}`,
      url: searchUrl(`${estimate.material.label} ${estimate.material.resin ? "résine" : "filament 1,75 mm"} 1 kg`),
    });
  }
  const costItems = design.cost.items;
  for (const material of design.materials) {
    const name = material.name.trim();
    if (!name) continue;
    // Matière principale déjà comptée via l'estimation d'impression.
    if (estimate && new RegExp(`\\b${estimate.material.id}\\b`, "i").test(name)) continue;
    const words = name.toLowerCase().split(/[^a-zàâäéèêëîïôöùûüç0-9]+/i).filter((w) => w.length > 3);
    const match = costItems.find((c) => words.some((w) => c.label.toLowerCase().includes(w)));
    items.push({
      item: name,
      quantity: material.quantity || "—",
      estimate: match && match.amount > 0 ? `≈ ${euros(match.amount)}` : null,
      url: searchUrl(`${name} ${material.quantity}`.trim()),
    });
  }
  return items.slice(0, 12);
}
