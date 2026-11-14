"use client";

import { Button, ButtonLink, Card } from "@/components/ui";

/** Erreur inattendue (par ex. stockage local bloqué en navigation privée). */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const storage = /indexeddb|stockage|storage|database/i.test(error.message);
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <Card className="text-center">
        <h1 className="text-xl font-bold">Un problème est survenu</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">
          {storage
            ? "Le stockage local de ce navigateur est indisponible (navigation privée ou réglage de Safari). Hifz en a besoin pour garder votre progression."
            : "L'écran n'a pas pu s'afficher. Vos données enregistrées ne sont pas perdues."}
        </p>
        <Button className="mt-5 w-full" onClick={reset}>
          Réessayer
        </Button>
        <ButtonLink href="/" variant="ghost" className="mt-2 w-full">
          Retour à l&apos;accueil
        </ButtonLink>
      </Card>
    </div>
  );
}
