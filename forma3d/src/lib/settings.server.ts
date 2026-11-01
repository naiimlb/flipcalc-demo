import "server-only";
import { cache } from "react";
import {
  AiSettingsSchema,
  DEFAULT_AI,
  DEFAULT_FEATURES,
  DEFAULT_SITE,
  FeatureFlagsSchema,
  SiteSettingsSchema,
  mergeWithDefaults,
  type AiSettings,
  type FeatureFlags,
  type SiteSettings,
} from "./settings";
import { getServerSupabase } from "./supabase/server";
import { getServiceSupabase } from "./supabase/admin";

/** Réglages publics (site + fonctionnalités), lus une fois par requête. */
export const getPublicSettings = cache(async (): Promise<{ site: SiteSettings; features: FeatureFlags }> => {
  const supabase = await getServerSupabase();
  if (!supabase) return { site: DEFAULT_SITE, features: DEFAULT_FEATURES };
  const { data, error } = await supabase.from("app_settings").select("key, value").in("key", ["site", "features"]);
  if (error) {
    console.error("Lecture des réglages impossible :", error.message);
    return { site: DEFAULT_SITE, features: DEFAULT_FEATURES };
  }
  const byKey = new Map((data ?? []).map((row) => [row.key as string, row.value as unknown]));
  return {
    site: mergeWithDefaults(SiteSettingsSchema, DEFAULT_SITE, byKey.get("site")),
    features: mergeWithDefaults(FeatureFlagsSchema, DEFAULT_FEATURES, byKey.get("features")),
  };
});

/** Réglages IA (réservés au serveur : lus avec la clé secrète). */
export async function getAiSettings(): Promise<AiSettings> {
  const service = getServiceSupabase();
  if (!service) return DEFAULT_AI;
  const { data } = await service.from("app_settings").select("value").eq("key", "ai").maybeSingle();
  return mergeWithDefaults(AiSettingsSchema, DEFAULT_AI, data?.value);
}
