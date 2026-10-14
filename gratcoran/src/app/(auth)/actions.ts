"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
import { authErrorMessage, validateCredentials, validateEmail } from "@/lib/auth-errors";

export type AuthState = { error?: string; info?: string; email?: string };

function field(form: FormData, name: string): string {
  const v = form.get(name);
  return typeof v === "string" ? v.trim() : "";
}

async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const invalid = validateCredentials(email, password);
  if (invalid) return { error: invalid, email };

  const supabase = await getServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: authErrorMessage(error), email };
  redirect("/");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, "email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const invalid = validateCredentials(email, password);
  if (invalid) return { error: invalid, email };

  const supabase = await getServerSupabase();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/login` },
  });
  if (error) return { error: authErrorMessage(error), email };
  if (data.session) redirect("/");
  // Confirmation d'email activée : Supabase masque les comptes existants (identities vides).
  if (data.user && data.user.identities?.length === 0) {
    return { error: authErrorMessage({ code: "user_already_exists" }), email };
  }
  return {
    info: "Compte créé. Confirme ton adresse grâce à l'email reçu, puis connecte-toi.",
    email,
  };
}

export async function signOut(): Promise<void> {
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * Envoie le lien de réinitialisation. Flux « implicit » : le lien fonctionne
 * même s'il s'ouvre dans un autre navigateur que l'app (PWA iOS → Safari).
 */
export async function requestPasswordReset(_: AuthState, form: FormData): Promise<AuthState> {
  const email = field(form, "email").toLowerCase();
  const invalid = validateEmail(email);
  if (invalid) return { error: invalid, email };

  const { url, key } = supabaseEnv();
  const client = createClient(url, key, {
    auth: { flowType: "implicit", persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/reinitialiser`,
  });
  if (error) return { error: authErrorMessage(error), email };
  return {
    info: "Si un compte existe pour cette adresse, un lien de réinitialisation vient d'être envoyé.",
    email,
  };
}
