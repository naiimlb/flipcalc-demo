import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { quranIndex, reciters } from "@/lib/quran/catalog";

export const metadata: Metadata = { title: "Sources" };

const fetchedOn = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(quranIndex.fetchedAt));

function Ext({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-accent underline underline-offset-2">
      {children}
    </a>
  );
}

export default function SourcesPage() {
  const { text, translation, audio } = quranIndex.sources;
  return (
    <>
      <PageHeader title="Sources" subtitle="D'où viennent le texte, la traduction et l'audio." />

      <Card className="space-y-3 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">Texte arabe</h2>
        <p>
          Rasm uthmani du projet <Ext href="https://tanzil.net">Tanzil</Ext>, récupéré via l&apos;API{" "}
          <Ext href="https://alquran.cloud/api">{text.provider}</Ext> (édition <code>{text.edition}</code>) le {fetchedOn}.
        </p>
        <p className="text-muted">
          Le texte n&apos;est jamais saisi ni retouché à la main. Deux opérations techniques, vérifiées automatiquement,
          sont appliquées : retrait d&apos;un caractère invisible (BOM) en tête du verset 1:1, et affichage de la
          basmala au-dessus de la sourate plutôt que collée au verset 1. Chaque sourate est contrôlée par une empreinte
          SHA-256 avant d&apos;être enregistrée sur l&apos;appareil.
        </p>
      </Card>

      <Card className="mt-4 space-y-3 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">Traduction française</h2>
        <p>
          Traduction du sens par {translation.author}, via {translation.provider} (édition <code>{translation.edition}</code>
          ). Une traduction reste une interprétation humaine du sens et ne remplace pas le texte arabe.
        </p>
      </Card>

      <Card className="mt-4 space-y-3 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">Audio</h2>
        <p>
          Récitations verset par verset de <Ext href="https://everyayah.com">{audio.provider}</Ext>. {reciters.length}{" "}
          récitateurs disponibles dans les réglages.
        </p>
      </Card>

      <Card className="mt-4 space-y-3 text-[15px] leading-relaxed">
        <h2 className="text-lg font-semibold">Polices</h2>
        <p>
          <Ext href="https://fonts.google.com/specimen/Amiri+Quran">Amiri Quran</Ext> (Khaled Hosny) et{" "}
          <Ext href="https://fonts.google.com/specimen/Scheherazade+New">Scheherazade New</Ext> (SIL International),
          sous licence SIL Open Font License.
        </p>
      </Card>

      <SectionTitle>Rappel</SectionTitle>
      <p className="px-1 text-[15px] leading-relaxed text-muted">
        Cette application aide à organiser les révisions. Elle ne remplace pas un enseignant : faites vérifier votre
        récitation par une personne qualifiée.
      </p>
    </>
  );
}
