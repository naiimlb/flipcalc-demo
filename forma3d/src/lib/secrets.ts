import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getServiceSupabase } from "./supabase/admin";

/**
 * Clés d'API : saisies dans /admin/cles, chiffrées en AES-256-GCM avec SECRETS_ENCRYPTION_KEY,
 * stockées dans app_secrets (accessible uniquement avec la clé secrète Supabase).
 * Elles ne sont jamais renvoyées au navigateur : seul un indice (4 derniers caractères) l'est.
 */

export const KNOWN_SECRETS = [
  { name: "ANTHROPIC_API_KEY", label: "Anthropic (Claude)", help: "Génère l'analyse et le modèle 3D." },
  { name: "MESHY_API_KEY", label: "Meshy (text-to-3D, expérimental)", help: "Maillage 3D détaillé en complément." },
] as const;
export type SecretName = (typeof KNOWN_SECRETS)[number]["name"];

function encryptionKey(): Buffer | null {
  const raw = process.env.SECRETS_ENCRYPTION_KEY;
  if (!raw) return null;
  const decoded = Buffer.from(raw, "base64");
  // Clé base64 de 32 octets attendue ; sinon on dérive 32 octets de la chaîne fournie.
  return decoded.length === 32 ? decoded : createHash("sha256").update(raw).digest();
}

export function canStoreSecrets(): boolean {
  return encryptionKey() !== null && getServiceSupabase() !== null;
}

export function encryptSecret(plain: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64"), tag.toString("base64"), ciphertext.toString("base64")].join(":");
}

export function decryptSecret(payload: string, key: Buffer): string {
  const [version, iv, tag, data] = payload.split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Format de secret inconnu.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function secretHint(value: string): string {
  return value.length > 8 ? `…${value.slice(-4)}` : "…";
}

/** Valeur d'un secret : base de données d'abord (modifiable depuis l'admin), puis variable d'environnement. */
export async function getSecret(name: SecretName): Promise<string | null> {
  const key = encryptionKey();
  const service = getServiceSupabase();
  if (key && service) {
    const { data } = await service.from("app_secrets").select("ciphertext").eq("name", name).maybeSingle();
    if (data?.ciphertext) {
      try {
        return decryptSecret(data.ciphertext, key);
      } catch (err) {
        console.error(`Secret ${name} illisible (SECRETS_ENCRYPTION_KEY a changé ?)`, err);
      }
    }
  }
  return process.env[name] || null;
}

export interface SecretStatus {
  name: SecretName;
  label: string;
  help: string;
  source: "admin" | "env" | "none";
  hint: string;
  updatedAt: string | null;
}

export async function listSecretStatuses(): Promise<SecretStatus[]> {
  const service = getServiceSupabase();
  const stored = new Map<string, { hint: string; updated_at: string }>();
  if (service) {
    const { data } = await service.from("app_secrets").select("name, hint, updated_at");
    for (const row of data ?? []) stored.set(row.name, row);
  }
  return KNOWN_SECRETS.map((s) => {
    const db = stored.get(s.name);
    const env = process.env[s.name];
    return {
      name: s.name,
      label: s.label,
      help: s.help,
      source: db ? "admin" : env ? "env" : "none",
      hint: db ? db.hint : env ? secretHint(env) : "",
      updatedAt: db?.updated_at ?? null,
    };
  });
}

export async function storeSecret(name: SecretName, value: string, userId: string): Promise<void> {
  const key = encryptionKey();
  const service = getServiceSupabase();
  if (!key || !service) throw new Error("SECRETS_ENCRYPTION_KEY ou SUPABASE_SECRET_KEY manquante.");
  const { error } = await service.from("app_secrets").upsert({
    name,
    ciphertext: encryptSecret(value, key),
    hint: secretHint(value),
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
  if (error) throw new Error(error.message);
}

export async function deleteSecret(name: SecretName): Promise<void> {
  const service = getServiceSupabase();
  if (!service) throw new Error("SUPABASE_SECRET_KEY manquante.");
  const { error } = await service.from("app_secrets").delete().eq("name", name);
  if (error) throw new Error(error.message);
}
