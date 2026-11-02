import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { SESSION_COOKIE_OPTIONS, supabaseConfig } from "./env";

/** Client serveur lié aux cookies de session de l'utilisateur (soumis à la RLS). */
export async function getServerSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, { ...SESSION_COOKIE_OPTIONS, ...options });
          }
        } catch {
          // Appelé depuis un Server Component : le middleware rafraîchit déjà la session.
        }
      },
    },
  });
}

export type Role = "admin" | "user";

export interface Profile {
  displayName: string | null;
  avatarUrl: string | null;
  language: "fr" | "en" | "ar";
  units: "mm" | "cm" | "in";
  favoriteMaterials: string[];
}

export interface Session {
  user: User;
  role: Role;
  displayName: string | null;
  profile: Profile;
  supabase: SupabaseClient;
}

/** Utilisateur vérifié auprès de Supabase Auth et son rôle (mis en cache pour la requête). */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await getServerSupabase();
  if (!supabase) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, display_name, avatar_url, language, units, favorite_materials")
    .eq("id", user.id)
    .maybeSingle();
  return {
    user,
    role: profile?.role === "admin" ? "admin" : "user",
    displayName: profile?.display_name ?? null,
    profile: {
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      language: profile?.language === "en" || profile?.language === "ar" ? profile.language : "fr",
      units: profile?.units === "cm" || profile?.units === "in" ? profile.units : "mm",
      favoriteMaterials: Array.isArray(profile?.favorite_materials) ? profile.favorite_materials : [],
    },
    supabase,
  };
});
