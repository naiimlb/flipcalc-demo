"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth-errors";
import { logEvent } from "@/lib/logs";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getServerSupabase } from "@/lib/supabase/server";

export interface SetupState {
  error?: string;
}

const SetupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  password: z.string().min(10, "10 caractères minimum pour le compte administrateur.").max(72),
  displayName: z.string().trim().max(80).optional(),
  token: z.string().optional(),
});

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Crée le premier compte, le promeut administrateur, puis verrouille /setup. */
export async function completeSetup(_prev: SetupState, form: FormData): Promise<SetupState> {
  const service = getServiceSupabase();
  if (!service) return { error: "SUPABASE_SECRET_KEY manquante : ajoutez-la aux variables d'environnement." };

  const parsed = SetupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    displayName: form.get("displayName") || undefined,
    token: form.get("token") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, displayName, token } = parsed.data;

  const expected = process.env.SETUP_TOKEN;
  if (expected && !sameSecret(token ?? "", expected)) return { error: "Jeton d'installation incorrect." };

  const { data: required, error: requiredError } = await service.rpc("setup_required");
  if (requiredError) return { error: "Base non initialisée : exécutez d'abord le script SQL (voir README)." };
  if (required !== true) return { error: "L'installation est déjà terminée." };

  let userId: string;
  let created = false;
  const { data: createdUser, error: createError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: displayName ? { display_name: displayName } : undefined,
  });
  if (createError || !createdUser.user) {
    // Compte déjà existant : on vérifie le mot de passe avant de le promouvoir.
    const supabase = await getServerSupabase();
    const { data: signedIn, error: signInError } = (await supabase?.auth.signInWithPassword({ email, password })) ?? {
      data: null,
      error: createError,
    };
    if (signInError || !signedIn?.user) return { error: authErrorMessage(createError?.message ?? signInError?.message) };
    userId = signedIn.user.id;
  } else {
    userId = createdUser.user.id;
    created = true;
  }

  const { data: promoted, error: promoteError } = await service.rpc("promote_first_admin", { p_user_id: userId });
  if (promoteError || promoted !== true) {
    if (created) await service.auth.admin.deleteUser(userId);
    return { error: "Un administrateur existe déjà : l'installation est verrouillée." };
  }

  const supabase = await getServerSupabase();
  await supabase?.auth.signInWithPassword({ email, password });
  await logEvent("info", "setup", "Compte administrateur créé.", { userId });
  redirect("/admin");
}
