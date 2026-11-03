import { redirect } from "next/navigation";
import { Landing } from "@/components/landing/Landing";

export const dynamic = "force-dynamic";

/** Accueil : toujours la présentation du site (l'éditeur est sur /studio). */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const params = await searchParams;
  // Anciens liens « /?p=<id> » (avant la refonte) : on ouvre le projet dans l'éditeur.
  if (params.p && /^[0-9a-f-]{36}$/i.test(params.p)) redirect(`/studio?p=${params.p}`);
  return <Landing />;
}
