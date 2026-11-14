import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Découvrir Forma3D" };

/** Présentation du site (l'ancien accueil) : ce que fait Forma3D, aperçu de l'éditeur, exemples. */
export default function DecouvrirPage() {
  return <Landing />;
}
