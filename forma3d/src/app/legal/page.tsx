import { redirect } from "next/navigation";

/** Point d'entrée unique des informations légales (lien en pied de l'accueil). */
export default function LegalIndex() {
  redirect("/mentions-legales");
}
