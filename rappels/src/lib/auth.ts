"use client";

import { useSyncExternalStore } from "react";
import { rowToProfile, type ProfileRow } from "./db-map";
import { getSupabase, isSupabaseConfigured } from "./supabase";
import { loadStore, resetStore } from "./store";
import type { Profile } from "./types";

// Session de l'utilisateur : gardée dans le téléphone par Supabase (elle se renouvelle toute seule).
export type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "signedIn"; profile: Profile };

let auth: AuthState = isSupabaseConfigured ? { status: "loading" } : { status: "unconfigured" };
let started = false;
const listeners = new Set<() => void>();
const set = (next: AuthState) => {
  auth = next;
  listeners.forEach((l) => l());
};

let currentUserId: string | null = null;

async function handleSession(userId: string | null) {
  if (userId === currentUserId && auth.status !== "loading") return; // simple renouvellement de session
  currentUserId = userId;
  if (!userId) {
    resetStore();
    set({ status: "signedOut" });
    return;
  }
  set({ status: "loading" });
  try {
    const { data, error } = await getSupabase().from("profiles").select("id,email,prenom,role").eq("id", userId).single();
    if (error || !data) throw new Error("profil introuvable");
    const profile = rowToProfile(data as ProfileRow);
    await loadStore(profile);
    if (currentUserId === userId) set({ status: "signedIn", profile });
  } catch {
    if (currentUserId === userId) set({ status: "error", message: "Impossible de charger ton espace. Vérifie ta connexion puis réessaie." });
  }
}

function start() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  // On sort du callback avant d'appeler Supabase (recommandé par la doc pour éviter les blocages).
  getSupabase().auth.onAuthStateChange((_event, session) => {
    setTimeout(() => void handleSession(session?.user.id ?? null), 0);
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => void listeners.delete(cb);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => auth, () => (isSupabaseConfigured ? ({ status: "loading" } as AuthState) : auth));
}

/** Relance le chargement après une erreur. */
export function retryAuth() {
  currentUserId = null;
  set({ status: "loading" });
  void getSupabase().auth.getSession().then(({ data }) => handleSession(data.session?.user.id ?? null));
}

// ----- actions (messages d'erreur en français) -----
export type ActionResult = { ok: true } | { ok: false; message: string };

export function frenchError(err: { message?: string; status?: number; code?: string } | null): string {
  const msg = (err?.message ?? "").toLowerCase();
  if (err?.status === 429 || err?.code === "over_request_rate_limit" || msg.includes("rate limit")) return "Trop d'essais. Réessaie dans une minute.";
  if (msg.includes("invalid login") || err?.code === "invalid_credentials") return "Email ou mot de passe incorrect.";
  if (err?.code === "user_already_exists" || err?.code === "email_exists" || msg.includes("already registered") || msg.includes("already been registered")) return "Cet email a déjà un compte. Connecte-toi.";
  if (err?.code === "signup_disabled" || msg.includes("signups not allowed")) return "Les inscriptions sont fermées pour le moment.";
  if (err?.code === "email_address_invalid" || msg.includes("invalid format") || msg.includes("is invalid")) return "Cet email n'a pas l'air valide.";
  if (msg.includes("fetch") || msg.includes("network")) return "Pas de connexion. Vérifie ton réseau.";
  if (msg.includes("password") && (msg.includes("least") || msg.includes("weak"))) return "Mot de passe trop court : 8 caractères minimum.";
  if (msg.includes("same password") || err?.code === "same_password") return "Choisis un mot de passe différent de l'ancien.";
  return "Oups, une erreur est survenue. Réessaie.";
}

export async function signIn(email: string, password: string): Promise<ActionResult> {
  const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  return error ? { ok: false, message: frenchError(error) } : { ok: true };
}

/**
 * Création de compte libre (email + mot de passe). Le prénom part dans les métadonnées : un déclencheur de la base
 * crée le profil (rôle TOUJOURS « caissier »). `needsConfirmation` : Supabase demande de confirmer l'email avant de se connecter.
 */
export async function signUp(prenom: string, email: string, password: string): Promise<ActionResult & { needsConfirmation?: boolean }> {
  const { data, error } = await getSupabase().auth.signUp({ email: email.trim().toLowerCase(), password, options: { data: { prenom } } });
  if (error) return { ok: false, message: frenchError(error) };
  // Pas de session = confirmation par email exigée. Pas d'identité = email déjà utilisé (Supabase masque l'erreur dans ce mode).
  if (data.user && data.user.identities?.length === 0) return { ok: false, message: frenchError({ code: "user_already_exists" }) };
  return data.session ? { ok: true } : { ok: true, needsConfirmation: true };
}

export async function signOut(): Promise<void> {
  await getSupabase().auth.signOut();
}

export async function sendResetEmail(email: string): Promise<ActionResult> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reinitialiser` });
  return error && error.status === 429 ? { ok: false, message: frenchError(error) } : { ok: true }; // même réponse si le compte existe ou non
}

export async function setNewPassword(password: string): Promise<ActionResult> {
  const { error } = await getSupabase().auth.updateUser({ password });
  return error ? { ok: false, message: frenchError(error) } : { ok: true };
}
