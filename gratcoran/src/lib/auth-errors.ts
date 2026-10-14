type MaybeAuthError = { code?: string; message?: string; status?: number } | null | undefined;

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Email ou mot de passe incorrect.",
  email_not_confirmed: "Ton adresse email n'est pas encore confirmée : ouvre le lien reçu par email.",
  user_already_exists: "Un compte existe déjà avec cet email. Connecte-toi.",
  email_exists: "Un compte existe déjà avec cet email. Connecte-toi.",
  weak_password: "Mot de passe trop faible : 8 caractères minimum.",
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  email_address_invalid: "Adresse email invalide.",
  validation_failed: "Adresse email ou mot de passe invalide.",
  over_email_send_rate_limit: "Trop d'emails envoyés : réessaie dans quelques minutes.",
  over_request_rate_limit: "Trop de tentatives : réessaie dans quelques minutes.",
  signup_disabled: "Les inscriptions sont fermées pour le moment.",
  user_banned: "Ce compte est suspendu.",
  session_not_found: "Session expirée : reconnecte-toi.",
  otp_expired: "Ce lien a expiré : demande un nouveau lien.",
};

/** Traduit une erreur Supabase Auth en message français lisible. */
export function authErrorMessage(error: MaybeAuthError): string {
  if (!error) return "Une erreur est survenue. Réessaie.";
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  const msg = (error.message ?? "").toLowerCase();
  if (msg.includes("invalid login")) return MESSAGES.invalid_credentials;
  if (msg.includes("already registered")) return MESSAGES.user_already_exists;
  if (msg.includes("not confirmed")) return MESSAGES.email_not_confirmed;
  if (msg.includes("rate limit")) return MESSAGES.over_request_rate_limit;
  if (msg.includes("password")) return MESSAGES.weak_password;
  if (msg.includes("fetch") || msg.includes("network")) {
    return "Connexion impossible : vérifie ta connexion internet.";
  }
  if (error.status === 429) return MESSAGES.over_request_rate_limit;
  return "Une erreur est survenue. Réessaie.";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateCredentials(email: string, password: string): string | null {
  if (!EMAIL_RE.test(email)) return MESSAGES.email_address_invalid;
  if (password.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
  return null;
}

export function validateEmail(email: string): string | null {
  return EMAIL_RE.test(email) ? null : MESSAGES.email_address_invalid;
}
