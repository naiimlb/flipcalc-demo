import type { Metadata } from "next";
import { LegalPage, ToFill } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Mentions légales" };

export default function MentionsLegales() {
  return (
    <LegalPage title="Mentions légales" updated="14 novembre 2026">
      <section>
        <h2>Éditeur du site</h2>
        <p>
          Nom ou raison sociale : <ToFill>nom de l&apos;éditeur</ToFill>
          <br />
          Statut et numéro d&apos;immatriculation (SIREN / SIRET) : <ToFill>statut, numéro</ToFill>
          <br />
          Adresse : <ToFill>adresse postale</ToFill>
          <br />
          Contact : <ToFill>adresse e-mail de contact</ToFill>
          <br />
          Directeur ou directrice de la publication : <ToFill>nom</ToFill>
        </p>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          Application : Vercel Inc. — <ToFill>adresse de l&apos;hébergeur, à vérifier sur le site de Vercel</ToFill>.
          <br />
          Base de données et comptes : Supabase — <ToFill>raison sociale, adresse et région d&apos;hébergement des données</ToFill>.
        </p>
      </section>
      <section>
        <h2>Intelligence artificielle</h2>
        <p>
          Les pièces sont conçues automatiquement par une intelligence artificielle (Claude, d&apos;Anthropic) à partir de votre demande. Chaque fichier
          produit porte la mention « générée par IA ». Ces pièces sont des propositions : vérifiez-les avant toute utilisation (voir les{" "}
          <a href="/cgu">conditions d&apos;utilisation</a>).
        </p>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          Les polices Inter et JetBrains Mono sont distribuées sous licence SIL Open Font License. Les icônes proviennent de Lucide (licence ISC). Les
          conceptions que vous créez vous appartiennent ; vous restez responsable de ne pas reproduire d&apos;œuvres, de marques ou de personnages
          protégés.
        </p>
      </section>
    </LegalPage>
  );
}
