import type { Metadata } from "next";
import { LegalPage, ToFill } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Confidentialité et cookies" };

export default function Confidentialite() {
  return (
    <LegalPage title="Confidentialité et cookies" updated="14 novembre 2026">
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          <ToFill>nom et coordonnées du responsable du traitement</ToFill>. Pour exercer vos droits : <ToFill>adresse e-mail dédiée</ToFill>.
        </p>
      </section>
      <section>
        <h2>Données traitées et durée de conservation</h2>
        <ul>
          <li>
            <strong>Compte</strong> (adresse e-mail, nom affiché, préférences) : conservé tant que le compte existe, supprimé avec lui.
          </li>
          <li>
            <strong>Demandes et pièces</strong> (texte de la demande, réponses aux questions, conception 3D) : conservées dans votre espace jusqu&apos;à ce que
            vous les supprimiez ou supprimiez votre compte.
          </li>
          <li>
            <strong>Photos</strong> : envoyées à l&apos;intelligence artificielle uniquement pour analyser la demande. Forma3D ne les enregistre pas (seul
            le fait qu&apos;une photo a été jointe est noté). Conservation chez le fournisseur d&apos;IA : <ToFill>durée selon les conditions d&apos;Anthropic en vigueur</ToFill>.
          </li>
          <li>
            <strong>Essai sans compte</strong> : le résultat reste dans votre navigateur ; une empreinte anonymisée de l&apos;adresse IP sert à limiter le
            nombre d&apos;essais gratuits.
          </li>
          <li>
            <strong>Journaux techniques</strong> (erreurs, limites de débit) : <ToFill>durée de conservation</ToFill>.
          </li>
        </ul>
      </section>
      <section>
        <h2>Sous-traitants</h2>
        <p>
          Hébergement de l&apos;application : Vercel. Base de données et authentification : Supabase. Intelligence artificielle : Anthropic (Claude). Transferts
          hors de l&apos;Union européenne et garanties : <ToFill>à préciser selon les contrats</ToFill>.
        </p>
      </section>
      <section>
        <h2>Vos droits</h2>
        <p>
          Vous pouvez à tout moment exporter vos données ou supprimer votre compte depuis « Mon espace ». Vous disposez aussi des droits d&apos;accès, de
          rectification, d&apos;opposition et de réclamation auprès de la CNIL (cnil.fr).
        </p>
      </section>
      <section>
        <h2>Cookies</h2>
        <p>
          Forma3D n&apos;utilise <strong>aucun cookie publicitaire ni de mesure d&apos;audience</strong>. Seuls des cookies et stockages strictement
          nécessaires sont utilisés : session de connexion, thème et langue choisis, brouillon de la demande et préférences (imprimante, bulles
          d&apos;aide) gardés dans votre navigateur. Ils ne nécessitent pas de consentement ; c&apos;est pourquoi aucun bandeau ne vous est affiché.
        </p>
      </section>
    </LegalPage>
  );
}
