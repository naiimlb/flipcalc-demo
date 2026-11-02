"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminAction } from "@/lib/admin";
import { logEvent } from "@/lib/logs";
import { KNOWN_SECRETS, canStoreSecrets, deleteSecret, storeSecret, type SecretName } from "@/lib/secrets";
import { AiSettingsSchema, FeatureFlagsSchema, SiteSettingsSchema } from "@/lib/settings";

export interface ActionResult {
  ok: boolean;
  message: string;
}

async function saveSetting(key: "site" | "features" | "ai", value: unknown): Promise<ActionResult> {
  const session = await requireAdminAction();
  // Écriture avec la session de l'admin : la RLS (settings_update_admin) fait foi.
  const { error } = await session.supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString(), updated_by: session.user.id });
  if (error) {
    await logEvent("error", "admin:settings", `Enregistrement de « ${key} » impossible.`, { details: error, supabase: session.supabase });
    return { ok: false, message: "Enregistrement impossible." };
  }
  await logEvent("info", "admin:settings", `Réglages « ${key} » mis à jour.`, { supabase: session.supabase });
  revalidatePath("/", "layout");
  return { ok: true, message: "Enregistré." };
}

export async function saveSiteSettings(input: unknown): Promise<ActionResult> {
  const parsed = SiteSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  return saveSetting("site", parsed.data);
}

export async function saveFeatures(input: unknown): Promise<ActionResult> {
  const parsed = FeatureFlagsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  return saveSetting("features", parsed.data);
}

export async function saveAiSettings(input: unknown): Promise<ActionResult> {
  const parsed = AiSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Valeurs invalides." };
  return saveSetting("ai", parsed.data);
}

const SecretNameSchema = z.enum(KNOWN_SECRETS.map((s) => s.name) as [SecretName, ...SecretName[]]);

export async function setSecret(name: string, value: string): Promise<ActionResult> {
  const session = await requireAdminAction();
  const parsedName = SecretNameSchema.safeParse(name);
  const trimmed = value.trim();
  if (!parsedName.success) return { ok: false, message: "Clé inconnue." };
  if (trimmed.length < 10 || trimmed.length > 400 || /\s/.test(trimmed)) return { ok: false, message: "Valeur de clé invalide." };
  if (!canStoreSecrets()) return { ok: false, message: "Définissez SECRETS_ENCRYPTION_KEY et SUPABASE_SECRET_KEY côté serveur." };
  try {
    await storeSecret(parsedName.data, trimmed, session.user.id);
  } catch (err) {
    await logEvent("error", "admin:secrets", "Enregistrement de clé impossible.", { details: String(err), supabase: session.supabase });
    return { ok: false, message: "Enregistrement impossible." };
  }
  await logEvent("info", "admin:secrets", `Clé ${parsedName.data} mise à jour.`, { supabase: session.supabase });
  revalidatePath("/admin/cles");
  return { ok: true, message: "Clé enregistrée (chiffrée)." };
}

export async function removeSecret(name: string): Promise<ActionResult> {
  const session = await requireAdminAction();
  const parsedName = SecretNameSchema.safeParse(name);
  if (!parsedName.success) return { ok: false, message: "Clé inconnue." };
  try {
    await deleteSecret(parsedName.data);
  } catch {
    return { ok: false, message: "Suppression impossible." };
  }
  await logEvent("info", "admin:secrets", `Clé ${parsedName.data} supprimée.`, { supabase: session.supabase });
  revalidatePath("/admin/cles");
  return { ok: true, message: "Clé supprimée : la variable d'environnement reprend le relais si elle existe." };
}

export async function setUserRole(userId: string, role: "admin" | "user"): Promise<ActionResult> {
  const session = await requireAdminAction();
  if (!z.string().uuid().safeParse(userId).success || (role !== "admin" && role !== "user")) {
    return { ok: false, message: "Requête invalide." };
  }
  if (userId === session.user.id && role !== "admin") return { ok: false, message: "Vous ne pouvez pas retirer votre propre rôle." };
  const { error } = await session.supabase.rpc("set_user_role", { p_user_id: userId, p_role: role });
  if (error) return { ok: false, message: "Mise à jour impossible." };
  await logEvent("info", "admin:users", `Rôle « ${role} » attribué.`, { details: { target: userId }, supabase: session.supabase });
  revalidatePath("/admin/utilisateurs");
  return { ok: true, message: "Rôle mis à jour." };
}

export async function adminDeleteRequest(id: string): Promise<ActionResult> {
  const session = await requireAdminAction();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Identifiant invalide." };
  const { error } = await session.supabase.from("design_requests").delete().eq("id", id);
  if (error) return { ok: false, message: "Suppression impossible." };
  revalidatePath("/admin/demandes");
  return { ok: true, message: "Demande supprimée." };
}

export async function clearLogs(): Promise<ActionResult> {
  const session = await requireAdminAction();
  const { error } = await session.supabase.from("app_logs").delete().gt("id", 0);
  if (error) return { ok: false, message: "Purge impossible." };
  revalidatePath("/admin/logs");
  return { ok: true, message: "Journal vidé." };
}

/** Modération de la galerie : masquer, réafficher ou supprimer une publication (RLS : administrateurs uniquement). */
export async function moderateGalleryItem(id: string, action: "hide" | "show" | "delete"): Promise<ActionResult> {
  const session = await requireAdminAction();
  if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Identifiant invalide." };
  const { error } =
    action === "delete"
      ? await session.supabase.from("gallery").delete().eq("id", id)
      : await session.supabase.from("gallery").update({ status: action === "hide" ? "hidden" : "published" }).eq("id", id);
  if (error) return { ok: false, message: "Action impossible." };
  await logEvent("info", "admin:galerie", `Publication ${id} : ${action}.`, { supabase: session.supabase });
  revalidatePath("/admin/galerie");
  revalidatePath("/galerie");
  return { ok: true, message: "Fait." };
}
