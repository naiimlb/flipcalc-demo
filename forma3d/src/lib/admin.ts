import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "./supabase/server";

/** Pages admin : redirige si l'utilisateur n'est pas administrateur. */
export async function requireAdminPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/connexion?next=/admin");
  if (session.role !== "admin") redirect("/");
  return session;
}

/** Actions serveur admin : lève une erreur si l'utilisateur n'est pas administrateur. */
export async function requireAdminAction(): Promise<Session> {
  const session = await getSession();
  if (!session || session.role !== "admin") throw new Error("Réservé aux administrateurs.");
  return session;
}
