"use client";

import { useSyncExternalStore } from "react";
import { rowToProfile, type ProfileRow } from "./db-map";
import { getSupabase, isSupabaseConfigured, supabaseRef } from "./supabase";
import { disablePush } from "./push";
import { applySnapshot, clearSnapshot, loadStore, readSnapshot, resetStore } from "./store";
import type { Profile } from "./types";

// Session de l'utilisateur : gardée dans des cookies de 400 jours (voir session-cookies.ts), renouvelée toute seule.
// On ne revient à l'écran de connexion que si le serveur répond CLAIREMENT que la session est invalide, ou après
// un clic sur « Me déconnecter ». Réseau coupé au lancement : on reste connecté et on affiche les dernières données.
export type AuthState =
  | { status: "loading" }
  | { status: "unconfigured" }
  | { status: "signedOut" }
  | { status: "error"; message: string }
  | { status: "signedIn"; profile: Profile; offline?: boolean };

let auth: AuthState = isSupabaseConfigured ? { status: "loading" } : { status: "unconfigured" };
let started = false;
const listeners = new Set<() => void>();
const set = (next: AuthState) => {
  auth = next;
  listeners.forEach((l) => l());
};

const LAST_USER_KEY = "hb-last-user";
const rememberUser = (id: string | null) => {
  try {
    if (id) localStorage.setItem(LAST_USER_KEY, id);
    else localStorage.removeItem(LAST_USER_KEY);
  } catch {
    /* ignoré */
  }
};
const lastUser = () => {
  try {
    return localStorage.getItem(LAST_USER_KEY);
  } catch {
    return null;
  }
};

/** Vrai pour un problème de réseau ou de serveur indisponible (on ne déconnecte jamais pour ça). */
export function isNetworkFailure(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const e = err as { name?: string; message?: string; status?: number } | null;
  if (!e) return false;
  if (e.name === "AuthRetryableFetchError") return true;
  if (typeof e.status === "number" && e.status >= 500) return true;
  return /failed to fetch|network|load failed|fetch failed|timeout|timed out|aborted|offline|connection/i.test(e.message ?? "");
}

let currentUserId: string | null = null;

/** Réseau coupé : on garde la session et on montre les dernières données enregistrées sur ce téléphone. */
function showOffline(userId: string | null): boolean {
  const id = userId ?? lastUser();
  const snap = id ? readSnapshot(id) : null;
  if (!id || !snap) return false;
  currentUserId = id;
  applySnapshot(snap);
  set({ status: "signedIn", profile: snap.profile, offline: true });
  return true;
}

async function handleSession(userId: string | null) {
  if (userId === currentUserId && auth.status === "signedIn" && !auth.offline) return; // simple renouvellement de session
  if (!userId) {
    // Le serveur a dit clairement que la session est finie, ou déconnexion volontaire.
    const previous = currentUserId ?? lastUser();
    currentUserId = null;
    if (previous) clearSnapshot(previous);
    rememberUser(null);
    resetStore();
    set({ status: "signedOut" });
    return;
  }
  currentUserId = userId;
  if (auth.status !== "signedIn") set({ status: "loading" });
  try {
    const { data, error } = await getSupabase().from("profiles").select("id,email,prenom,role").eq("id", userId).single();
    if (error || !data) throw error ?? new Error("profil introuvable");
    const profile = rowToProfile(data as ProfileRow);
    await loadStore(profile);
    rememberUser(userId);
    if (currentUserId === userId) set({ status: "signedIn", profile });
  } catch (err) {
    if (currentUserId !== userId) return;
    if (isNetworkFailure(err) && showOffline(userId)) return;
    set({ status: "error", message: isNetworkFailure(err) ? "Pas de connexion. Vérifie ton réseau puis réessaie." : "Impossible de charger ton espace. Réessaie dans un instant." });
  }
}

/** Ancienne session (avant les cookies) : on la reprend sans redemander le mot de passe. */
async function migrateLegacySession() {
  try {
    const key = `sb-${supabaseRef()}-auth-token`;
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const old = JSON.parse(raw) as { access_token?: string; refresh_token?: string };
    if (old.access_token && old.refresh_token) {
      const { error } = await getSupabase().auth.setSession({ access_token: old.access_token, refresh_token: old.refresh_token });
      if (error && isNetworkFailure(error)) return; // on réessaiera au prochain lancement
    }
    localStorage.removeItem(key);
  } catch {
    /* ignoré */
  }
}

/** Lancement : on vérifie la session AVANT d'afficher quoi que ce soit (écran de chargement entre-temps). */
const LAUNCH_TIMEOUT_MS = 4000; // sans réseau, Supabase réessaie jusqu'à 30 s : on n'attend pas aussi longtemps

async function bootstrap() {
  const sb = getSupabase();
  // Le navigateur sait déjà qu'il est hors ligne : on affiche tout de suite les dernières données.
  if (typeof navigator !== "undefined" && navigator.onLine === false && showOffline(null)) return;
  const first = await Promise.race([sb.auth.getSession(), new Promise<"timeout">((r) => setTimeout(() => r("timeout"), LAUNCH_TIMEOUT_MS))]);
  if (first === "timeout" && showOffline(null)) return; // réseau trop lent ou coupé : on reste connecté avec les données déjà chargées
  let { data, error } = first === "timeout" ? await sb.auth.getSession() : first;
  if (!data.session && !error) {
    await migrateLegacySession();
    ({ data, error } = await sb.auth.getSession());
  }
  if (data.session) return handleSession(data.session.user.id);
  if (error && isNetworkFailure(error)) {
    // Réseau coupé (cave, sous-sol) : la session n'a pas été invalidée, on reste connecté.
    if (showOffline(null)) return;
    return set({ status: "error", message: "Pas de connexion. Vérifie ton réseau puis réessaie." });
  }
  return handleSession(null);
}

function start() {
  if (started || !isSupabaseConfigured) return;
  started = true;
  // On sort du callback avant d'appeler Supabase (recommandé par la doc pour éviter les blocages).
  getSupabase().auth.onAuthStateChange((event, session) => {
    // Le lancement est géré par bootstrap() ; les renouvellements de jeton se font en silence.
    if (event === "TOKEN_REFRESHED" && auth.status === "signedIn" && auth.offline) return retryAuth(); // le réseau est revenu
    if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
    setTimeout(() => void handleSession(session?.user.id ?? null), 0);
  });
  void bootstrap();
  // Retour du réseau : on reprend la session normale et on recharge les données.
  const back = () => {
    if (auth.status === "signedIn" && auth.offline) retryAuth();
  };
  window.addEventListener("online", back);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && back());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  start();
  return () => void listeners.delete(cb);
}

export function useAuth(): AuthState {
  return useSyncExternalStore(subscribe, () => auth, () => (isSupabaseConfigured ? ({ status: "loading" } as AuthState) : auth));
}

/** Relance le chargement (après une erreur, ou au retour du réseau). */
export function retryAuth() {
  if (auth.status !== "signedIn") set({ status: "loading" });
  currentUserId = null;
  void bootstrap();
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
  // Cet appareil ne doit plus recevoir les rappels de ce compte (téléphone partagé).
  if (auth.status === "signedIn" && !auth.offline) await disablePush(auth.profile.id);
  const { error } = await getSupabase().auth.signOut();
  // Réseau coupé : on se déconnecte quand même sur ce téléphone (la session côté serveur expirera d'elle-même).
  if (error) await getSupabase().auth.signOut({ scope: "local" });
}

export async function sendResetEmail(email: string): Promise<ActionResult> {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${window.location.origin}/reinitialiser` });
  return error && error.status === 429 ? { ok: false, message: frenchError(error) } : { ok: true }; // même réponse si le compte existe ou non
}

export async function setNewPassword(password: string): Promise<ActionResult> {
  const { error } = await getSupabase().auth.updateUser({ password });
  return error ? { ok: false, message: frenchError(error) } : { ok: true };
}
