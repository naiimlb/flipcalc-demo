import { ButtonLink, Card } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="flex min-h-[70dvh] flex-col justify-center">
      <Card className="text-center">
        <h1 className="text-xl font-bold">Page introuvable</h1>
        <p className="mt-2 text-[15px] text-muted">Cette page n&apos;existe pas ou plus.</p>
        <ButtonLink href="/" className="mt-5 w-full">
          Retour à l&apos;accueil
        </ButtonLink>
      </Card>
    </div>
  );
}
