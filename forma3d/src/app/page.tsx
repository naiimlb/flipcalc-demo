import { redirect } from "next/navigation";
import { SimpleApp } from "@/components/simple/SimpleApp";
import { getPublicSettings } from "@/lib/settings.server";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Accueil = l'outil : le parcours Simple (demande → précisions → création → résultat). La présentation du site est sur /decouvrir. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const params = await searchParams;
  // Anciens liens « /?p=<id> » (avant la refonte) : on ouvre le projet dans l'éditeur.
  if (params.p && /^[0-9a-f-]{36}$/i.test(params.p)) redirect(`/studio?p=${params.p}`);
  const demo = isDemoMode();
  const { features } = await getPublicSettings();
  const session = demo ? null : await getSession().catch(() => null);
  return (
    <SimpleApp demo={demo} signedIn={Boolean(session)} features={{ newRequests: features.newRequests, imageUpload: features.imageUpload, guestTrial: features.guestTrial }} />
  );
}
