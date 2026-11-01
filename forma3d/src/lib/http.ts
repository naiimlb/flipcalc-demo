import "server-only";
import { NextResponse } from "next/server";

/** Réponse d'erreur JSON homogène. */
export function jsonError(status: number, error: string, code?: string) {
  return NextResponse.json({ error, code }, { status });
}

/**
 * Protection CSRF des routes API : la requête doit venir du même site.
 * (Les cookies SameSite=Lax protègent déjà les POST cross-site ; ceci ajoute une défense.)
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true; // requêtes same-origin de certains navigateurs, outils serveur
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
