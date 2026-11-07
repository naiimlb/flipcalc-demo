"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AuthContext, useAuth, type AuthContextValue, type AuthState, type AuthUser } from "@/components/providers/auth-context";
import { LegacyClaim } from "@/components/auth/LegacyClaim";
import { SettingsProvider } from "@/components/providers/SettingsProvider";
import { getSupabase } from "@/lib/auth/client";
import { isAuthConfigured, isPublicPath, MIN_PASSWORD_LENGTH } from "@/lib/auth/config";
import { authErrorMessage } from "@/lib/auth/errors";
import type { HifzDB } from "@/lib/storage/db";
import { openDb, setActiveDb } from "@/lib/storage/client";
import { SyncController } from "@/lib/sync/controller";
import { createSupabaseRemote } from "@/lib/sync/supabase-remote";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: isAuthConfigured ? "loading" : "disabled" });
  const [sync, setSync] = useState<SyncController | null>(null);

  useEffect(() => {
    if (!isAuthConfigured) return;
    const supabase = getSupabase();
    const toState = (user: { id: string; email?: string } | null | undefined): AuthState =>
      user ? { status: "signedIn", user: { id: user.id, email: user.email ?? "" } } : { status: "signedOut" };
    // La session est lue dans le stockage local : fonctionne hors ligne.
    void supabase.auth.getSession().then(({ data }) => setState(toState(data.session?.user)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setState(toState(session?.user)));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    return error ? authErrorMessage(error) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return { error: `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`, needsConfirmation: false };
    }
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: `${window.location.origin}/connexion` },
    });
    if (error) return { error: authErrorMessage(error), needsConfirmation: false };
    return { error: null, needsConfirmation: !data.session };
  }, []);

  const signOut = useCallback(async () => {
    // « local » : ne dépend pas du réseau. Les données restent sur l'appareil, rattachées au compte.
    await getSupabase().auth.signOut({ scope: "local" });
  }, []);

  const requestReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/reinitialiser`,
    });
    return error ? authErrorMessage(error) : null;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    if (password.length < MIN_PASSWORD_LENGTH) return `Le mot de passe doit contenir au moins ${MIN_PASSWORD_LENGTH} caractères.`;
    const { error } = await getSupabase().auth.updateUser({ password });
    return error ? authErrorMessage(error) : null;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ state, sync, signIn, signUp, signOut, requestReset, updatePassword }),
    [state, sync, signIn, signUp, signOut, requestReset, updatePassword],
  );

  return (
    <AuthContext.Provider value={value}>
      <AuthGate onSync={setSync}>{children}</AuthGate>
    </AuthContext.Provider>
  );
}

function Skeleton() {
  return <div className="mt-24 h-48 animate-pulse rounded-3xl bg-elevated" aria-busy="true" aria-label="Chargement" />;
}

/** Décide ce qui s'affiche : identification, ou l'app avec la base du bon compte. */
function AuthGate({ children, onSync }: { children: ReactNode; onSync: (c: SyncController | null) => void }) {
  const { state } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const signedOutOnPrivatePage = state.status === "signedOut" && !isPublicPath(pathname);
  const signedInOnLogin = state.status === "signedIn" && pathname === "/connexion";

  useEffect(() => {
    if (signedOutOnPrivatePage) router.replace("/connexion");
    else if (signedInOnLogin) router.replace("/");
  }, [signedOutOnPrivatePage, signedInOnLogin, router]);

  if (state.status === "loading") return <Skeleton />;
  if (state.status === "signedOut") return signedOutOnPrivatePage ? <Skeleton /> : <>{children}</>;
  if (state.status === "disabled") return <DbHost user={null} onSync={onSync}>{children}</DbHost>;
  return (
    <DbHost key={state.user.id} user={state.user} onSync={onSync}>
      {children}
    </DbHost>
  );
}

/** Ouvre la base du compte, lance la synchronisation et fournit les réglages à l'app. */
function DbHost({ user, onSync, children }: { user: AuthUser | null; onSync: (c: SyncController | null) => void; children: ReactNode }) {
  const [host, setHost] = useState<{ db: HifzDB; ctl: SyncController | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const userId = user?.id ?? null;

  useEffect(() => {
    let alive = true;
    let db: HifzDB | null = null;
    let ctl: SyncController | null = null;
    try {
      db = userId ? openDb(`hifz-u-${userId}`, true) : openDb("hifz", false);
      setActiveDb(db);
      ctl = userId ? new SyncController(db, createSupabaseRemote(getSupabase(), userId)) : null;
      const opened = db;
      const controller = ctl;
      // Mise à jour de l'état de façon différée : l'effet crée seulement les ressources externes.
      void Promise.resolve().then(() => {
        if (!alive) return;
        setHost({ db: opened, ctl: controller });
        onSync(controller);
      });
      if (ctl) void ctl.syncNow();
    } catch {
      void Promise.resolve().then(() => {
        if (alive) setError("Le stockage local de ce navigateur est indisponible (navigation privée ou réglage de Safari). Hifz en a besoin pour garder votre progression.");
      });
      return () => {
        alive = false;
      };
    }

    // Synchronisation au retour du réseau, à la réouverture de l'app et régulièrement.
    const sync = () => {
      if (ctl && navigator.onLine) void ctl.syncNow();
    };
    const onVisible = () => document.visibilityState === "visible" && sync();
    window.addEventListener("online", sync);
    document.addEventListener("visibilitychange", onVisible);
    const timer = setInterval(onVisible, 60_000);

    return () => {
      alive = false;
      window.removeEventListener("online", sync);
      document.removeEventListener("visibilitychange", onVisible);
      clearInterval(timer);
      ctl?.dispose();
      onSync(null);
      setActiveDb(null);
      setHost(null);
      db?.close();
    };
  }, [userId, onSync]);

  if (error) {
    return (
      <div role="alert" className="mt-24 rounded-3xl border border-line bg-surface p-6 text-center">
        <h1 className="text-xl font-bold">Stockage indisponible</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{error}</p>
      </div>
    );
  }
  if (!host) return <Skeleton />;
  return (
    <SettingsProvider>
      {children}
      {host.ctl && user ? <LegacyClaim db={host.db} ctl={host.ctl} /> : null}
    </SettingsProvider>
  );
}
