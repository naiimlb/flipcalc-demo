// Cookies de session Supabase : longue durée pour rester connecté des semaines (jusqu'à ce qu'on se déconnecte).
// 400 jours = le maximum que les navigateurs acceptent (au-delà, ils plafonnent à 400 jours).
// httpOnly est volontairement ABSENT : les requêtes de données partent du navigateur (protégées par la RLS de la base),
// qui doit donc pouvoir lire la session. Secure + SameSite=Lax limitent l'exposition.
export const SESSION_MAX_AGE = 400 * 24 * 60 * 60; // secondes

export const SESSION_COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax" as const,
  maxAge: SESSION_MAX_AGE,
  secure: process.env.NODE_ENV === "production",
};
