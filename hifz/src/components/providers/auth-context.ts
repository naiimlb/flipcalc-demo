"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { SyncController, SyncStatus } from "@/lib/sync/controller";

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthState =
  | { status: "loading" }
  | { status: "disabled" }
  | { status: "signedOut" }
  | { status: "signedIn"; user: AuthUser };

export interface AuthContextValue {
  state: AuthState;
  /** Contrôleur de synchronisation du compte connecté (null sinon). */
  sync: SyncController | null;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestReset: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans AuthProvider.");
  return ctx;
}

const IDLE: SyncStatus = { state: "idle", lastSyncAt: null, message: null };

/** État de synchronisation du compte (réactif). */
export function useSyncStatus(): SyncStatus {
  const { sync } = useAuth();
  return useSyncExternalStore(
    (cb) => (sync ? sync.subscribe(cb) : () => {}),
    () => (sync ? sync.getStatus() : IDLE),
    () => IDLE,
  );
}

