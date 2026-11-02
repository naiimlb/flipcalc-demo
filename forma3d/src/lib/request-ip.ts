import "server-only";
import { createHash } from "node:crypto";

/** Empreinte salée de l'IP du visiteur (l'IP elle-même n'est jamais stockée). */
export function ipHash(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "inconnu";
  const salt = process.env.SECRETS_ENCRYPTION_KEY || process.env.NEXT_PUBLIC_SUPABASE_URL || "forma3d";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}
