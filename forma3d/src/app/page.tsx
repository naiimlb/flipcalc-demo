import { StudioScreen } from "@/components/app/StudioScreen";
import { Landing } from "@/components/landing/Landing";
import { isDemoMode } from "@/lib/supabase/env";
import { getSession } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Accueil : présentation pour les visiteurs, tableau de bord pour les personnes connectées. */
export default async function HomePage({ searchParams }: { searchParams: Promise<{ p?: string }> }) {
  const params = await searchParams;
  const session = isDemoMode() ? null : await getSession();
  if (session) return <StudioScreen p={params.p} />;
  return <Landing />;
}
