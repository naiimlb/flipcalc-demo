export interface AuthLikeError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

/** Message en français pour une erreur d'authentification Supabase (jamais le texte brut du serveur). */
export function authErrorMessage(error: unknown): string {
  const e = (error ?? {}) as AuthLikeError;
  const text = `${e.code ?? ""} ${e.message ?? ""}`.toLowerCase();

  if (/failed to fetch|networkerror|network request|load failed|fetch failed/.test(text) || e.name === "AuthRetryableFetchError") {
    return "Connexion impossible : vérifiez votre réseau puis réessayez.";
  }
  if (/invalid_credentials|invalid login credentials/.test(text)) return "E-mail ou mot de passe incorrect.";
  if (/email_not_confirmed|not confirmed/.test(text)) return "Confirmez d'abord votre adresse e-mail grâce au lien que nous vous avons envoyé.";
  if (/user_already_exists|already registered|already been registered/.test(text)) {
    return "Un compte existe déjà avec cette adresse. Connectez-vous ou réinitialisez votre mot de passe.";
  }
  if (/weak_password|password should be|password is too/.test(text)) {
    return "Mot de passe trop faible : choisissez-en un plus long ou moins courant.";
  }
  if (/signups_closed|signup_disabled|signups not allowed|database error saving new user/.test(text)) {
    return "Les inscriptions sont fermées pour le moment.";
  }
  if (/over_.*rate_limit|rate limit|too many/.test(text) || e.status === 429) {
    return "Trop de tentatives. Patientez quelques minutes avant de réessayer.";
  }
  if (/same_password|different from the old/.test(text)) return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (/session.*(missing|not found)|jwt|expired|otp_expired|invalid.*token/.test(text)) {
    return "Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.";
  }
  if (/invalid.*email|validation_failed/.test(text)) return "Adresse e-mail invalide.";
  return "Une erreur est survenue. Réessayez dans un instant.";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
