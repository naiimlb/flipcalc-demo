import type { Metadata } from "next";
import { LegalPage, ToFill } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function Cgu() {
  return (
    <LegalPage title="Conditions d'utilisation" updated="14 novembre 2026">
      <section>
        <h2>Le service</h2>
        <p>
          Forma3D propose, à partir d&apos;une description ou d&apos;une photo, une pièce en 3D conçue par intelligence artificielle, avec un fichier à
          imprimer. Le service est fourni en l&apos;état, sans paiement ; un nombre limité de créations est inclus.
        </p>
      </section>
      <section>
        <h2>Pièces générées par IA : à vérifier avant usage</h2>
        <ul>
          <li>Chaque pièce est une proposition automatique. Vérifiez ses dimensions, sa solidité et son adéquation à votre usage avant de l&apos;utiliser.</li>
          <li>
            Une pièce imprimée en 3D par un particulier n&apos;offre <strong>aucune garantie de résistance</strong>. Ne l&apos;utilisez jamais pour retenir,
            porter ou protéger une personne, ni comme pièce de sécurité (freinage, levage, gaz, électricité du secteur).
          </li>
          <li>Les vérifications automatiques (parois, pièces flottantes, cotes) aident mais ne remplacent pas votre trancheur ni un essai réel.</li>
        </ul>
      </section>
      <section>
        <h2>Usages interdits</h2>
        <p>
          Il est interdit de demander des armes ou des pièces d&apos;armes, des objets illégaux, ou la reproduction de marques, de logos ou de personnages
          protégés. Ces demandes sont refusées.
        </p>
      </section>
      <section>
        <h2>Responsabilité</h2>
        <p>
          <ToFill>clause de responsabilité adaptée à votre statut, à faire relire</ToFill>. Point de vigilance : la directive européenne sur la
          responsabilité du fait des produits défectueux, applicable à partir du 9 décembre 2026, couvre aussi les logiciels.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>
          <ToFill>adresse e-mail de contact</ToFill>
        </p>
      </section>
    </LegalPage>
  );
}
