import "server-only";
import type { StudioViewer } from "@/components/studio/types";
import { isDemoMode } from "./supabase/env";
import { getSession } from "./supabase/server";

/** Personne connectée, sous la forme attendue par l'en-tête et le studio (null pour un visiteur). */
export async function getViewer(): Promise<StudioViewer | null> {
  if (isDemoMode()) return null;
  const session = await getSession();
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email ?? "",
    displayName: session.profile.displayName,
    avatarUrl: session.profile.avatarUrl,
    role: session.role,
    units: session.profile.units,
    favoriteMaterials: session.profile.favoriteMaterials,
  };
}
