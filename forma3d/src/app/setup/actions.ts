"use server";

import { createHash, timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authErrorMessage } from "@/lib/auth-errors";
import { logEvent } from "@/lib/logs";
import { siteOrigin } from "@/lib/origin";
import { getServiceSupabase } from "@/lib/supabase/admin";
import { getServerSupabase, getSession } from "@/lib/supabase/server";

export interface SetupState {
  error?: string;
  info?: string;
}

const SetupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide.").max(254),
  password: z.string().min(10, "10 caractères minimum pour le compte administrateur.").max(72),
  displayName: z.string().trim().max(80).optional(),
  token: z.string().trim().max(200).optional(),
});

function sameSecret(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Le jeton est vérifié ici (SETUP_TOKEN) et en base (empreinte, fonction claim_first_admin). */
function tokenRejected(token: string | undefined): boolean {
  const expected = process.env.SETUP_TOKEN;
  return Boolean(expected) && !sameSecret(token ?? "", expected ?? "");
}

const CLAIM_ERRORS: Record<string, string> = {
  BAD_TOKEN: "Jeton d'installation incorrect.",
  AUTH_REQUIRED: "Connectez-vous d'abord.",
};

/** Utilisateur déjà connecté : il devient administrateur s'il fournit le bon jeton. */
export async function claimAdmin(_prev: SetupState, form: FormData): Promise<SetupState> {
  const token = String(form.get("token") ?? "").trim();
  if (tokenRejected(token)) return { error: "Jeton d'installation incorrect." };
  const session = await getSession();
  if (!session) return { error: "Connectez-vous d'abord." };
  const { data, error } = await session.supabase.rpc("claim_first_admin", { p_token: token });
  if (error) {
    const code = Object.keys(CLAIM_ERRORS).find((k) => error.message.includes(k));
    return { error: code ? CLAIM_ERRORS[code] : "Installation impossible." };
  }
  if (data !== true) return { error: "Un administrateur existe déjà : l'installation est verrouillée." };
  await logEvent("info", "setup", "Compte administrateur créé.", { supabase: session.supabase });
  redirect("/admin");
}

/** Création du compte administrateur (avec la clé secrète si disponible, sinon inscription classique). */
export async function completeSetup(_prev: SetupState, form: FormData): Promise<SetupState> {
  const parsed = SetupSchema.safeParse({
    email: form.get("email"),
    password: form.get("password"),
    displayName: form.get("displayName") || undefined,
    token: form.get("token") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { email, password, displayName, token } = parsed.data;
  if (tokenRejected(token)) return { error: "Jeton d'installation incorrect." };

  const supabase = await getServerSupabase();
  if (!supabase) return { error: "Supabase n'est pas configuré." };
  const { data: required, error: requiredError } = await supabase.rpc("setup_required");
  if (requiredError) return { error: "Base non initialisée : exécutez d'abord les scripts SQL (voir README)." };
  if (required !== true) return { error: "L'installation est déjà terminée." };

  const service = getServiceSupabase();
  if (service) {
    // Avec la clé secrète : compte confirmé immédiatement, sans email.
    let userId: string;
    let created = false;
    const { data: createdUser, error: createError } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: displayName ? { display_name: displayName } : undefined,
    });
    if (createError || !createdUser.user) {
      const { data: signedIn, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError || !signedIn.user) return { error: authErrorMessage(createError?.message ?? signInError?.message) };
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
    await supabase.auth.signInWithPassword({ email, password });
    await logEvent("info", "setup", "Compte administrateur créé.", { userId });
    redirect("/admin");
  }

  // Sans clé secrète : inscription classique (ou connexion si le compte existe), puis jeton vérifié en base.
  let { data: auth, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const signUp = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${await siteOrigin()}/auth/callback?next=/setup`,
        data: displayName ? { display_name: displayName } : undefined,
      },
    });
    if (signUp.error) return { error: authErrorMessage(signUp.error.message) };
    auth = { user: signUp.data.user, session: signUp.data.session } as typeof auth;
    error = null;
  }
  if (!auth?.session) {
    return {
      info: "Compte créé : confirmez votre adresse via le lien reçu par email. Vous reviendrez ici, connecté, pour saisir le jeton.",
    };
  }
  const { data: claimed, error: claimError } = await supabase.rpc("claim_first_admin", { p_token: token ?? "" });
  if (claimError) {
    const code = Object.keys(CLAIM_ERRORS).find((k) => claimError.message.includes(k));
    return { error: code ? CLAIM_ERRORS[code] : "Installation impossible." };
  }
  if (claimed !== true) return { error: "Un administrateur existe déjà : l'installation est verrouillée." };
  await logEvent("info", "setup", "Compte administrateur créé.", { supabase });
  redirect("/admin");
}
