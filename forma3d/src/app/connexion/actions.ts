"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth-errors";
import { siteOrigin } from "@/lib/origin";
import { getPublicSettings } from "@/lib/settings.server";
import { getServerSupabase } from "@/lib/supabase/server";

export interface AuthState {
  error?: string;
  info?: string;
}

const Credentials = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  password: z.string().min(8, "8 caractères minimum.").max(72, "72 caractères maximum."),
});

function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/studio";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/studio";
}

export async function signIn(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await getServerSupabase();
  if (!supabase) return { error: "Supabase n'est pas configuré (mode démo)." };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: authErrorMessage(error.message) };
  redirect(safeNext(form.get("next")));
}

export async function signUp(_prev: AuthState, form: FormData): Promise<AuthState> {
  const parsed = Credentials.extend({
    displayName: z.string().trim().max(80).optional(),
  }).safeParse({
    email: form.get("email"),
    password: form.get("password"),
    displayName: form.get("displayName") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };

  const { features } = await getPublicSettings();
  if (!features.signupsOpen) return { error: "Les inscriptions sont fermées pour le moment." };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: "Supabase n'est pas configuré (mode démo)." };
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
      data: parsed.data.displayName ? { display_name: parsed.data.displayName } : undefined,
    },
  });
  if (error) return { error: authErrorMessage(error.message) };
  if (data.session) redirect("/studio");
  return { info: "Compte créé : cliquez sur le lien reçu par email pour l'activer." };
}

/** Connexion Google (OAuth) : redirige vers Google puis revient sur /auth/callback. */
export async function signInWithGoogle(form: FormData) {
  const supabase = await getServerSupabase();
  if (!supabase) redirect("/connexion");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(form.get("next")))}` },
  });
  if (error || !data.url) redirect("/connexion?erreur=google");
  redirect(data.url);
}

/** Mot de passe oublié : envoie le lien de réinitialisation (réponse identique que le compte existe ou non). */
export async function requestPasswordReset(_prev: AuthState, form: FormData): Promise<AuthState> {
  const email = z.string().trim().toLowerCase().email().safeParse(form.get("email"));
  if (!email.success) return { error: "Adresse email invalide." };
  const supabase = await getServerSupabase();
  if (!supabase) return { error: "Supabase n'est pas configuré (mode démo)." };
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/reinitialiser`,
  });
  if (error && /rate limit|too many/i.test(error.message)) return { error: authErrorMessage(error.message) };
  return { info: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé." };
}

/** Nouveau mot de passe (session ouverte par le lien reçu par email). */
export async function updatePassword(_prev: AuthState, form: FormData): Promise<AuthState> {
  const password = z.string().min(8, "8 caractères minimum.").max(72).safeParse(form.get("password"));
  if (!password.success) return { error: password.error.issues[0]?.message };
  if (form.get("password") !== form.get("confirm")) return { error: "Les deux mots de passe diffèrent." };
  const supabase = await getServerSupabase();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (!supabase || !data.user) return { error: "Lien expiré : redemandez un email de réinitialisation." };
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorMessage(error.message) };
  redirect("/espace?motdepasse=ok");
}
