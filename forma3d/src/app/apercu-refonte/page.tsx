import type { Metadata } from "next";
import { Preview } from "./Preview";

export const metadata: Metadata = { title: "Aperçu de la refonte", robots: { index: false, follow: false } };

/**
 * Page interne de la refonte (lot 1.1) : les deux directions visuelles proposées, sur l'accueil et le résultat,
 * avec une conception d'exemple réelle. Elle n'est liée nulle part ; elle sert aux captures et au choix.
 */
export default async function ApercuRefonte({ searchParams }: { searchParams: Promise<{ direction?: string; ecran?: string }> }) {
  const params = await searchParams;
  const direction = params.direction === "colore" ? "colore" : "neutre";
  const ecran = params.ecran === "resultat" ? "resultat" : "accueil";
  return <Preview direction={direction} ecran={ecran} />;
}
