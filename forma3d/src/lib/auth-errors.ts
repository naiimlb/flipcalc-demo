/** Messages d'erreur Supabase Auth traduits en français. */
export function authErrorMessage(message: string | undefined | null): string {
  const m = (message ?? "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Email ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Confirmez d'abord votre adresse email (lien reçu par email).";
  if (m.includes("already registered") || m.includes("already been registered")) return "Un compte existe déjà avec cet email.";
  if (m.includes("signups_closed") || m.includes("database error saving new user")) return "Les inscriptions sont fermées.";
  if (m.includes("password should be") || m.includes("weak password")) return "Mot de passe trop faible (8 caractères minimum).";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives : réessayez dans quelques minutes.";
  if (m.includes("invalid email") || m.includes("unable to validate email")) return "Adresse email invalide.";
  return "Une erreur est survenue. Réessayez.";
}
