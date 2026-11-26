import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/session-cookies";

/**
 * Rafraîchit la session Supabase à chaque visite : si le jeton d'accès a expiré, il est renouvelé ici et les cookies
 * (400 jours) sont renvoyés au navigateur. Ce proxy ne redirige JAMAIS et ne bloque JAMAIS une page : en cas
 * d'erreur ou de réseau coupé côté serveur, la requête continue normalement (c'est l'app qui décide).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return response;

  // Rien à renouveler sans cookie de session, ni pour les préchargements de pages.
  const hasSession = request.cookies.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("auth-token"));
  const prefetch = request.headers.has("next-router-prefetch") || request.headers.get("purpose") === "prefetch";
  if (!hasSession || prefetch) return response;

  const supabase = createServerClient(url, anon, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(list) {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS });
      },
    },
  });

  try {
    await supabase.auth.getClaims(); // vérifie la session et la renouvelle si besoin
  } catch {
    /* ne jamais bloquer la page */
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|api/push|sw\\.js|icons/|manifest\\.webmanifest|.*\\.(?:png|jpg|jpeg|svg|ico|webp|css|js|woff2?)$).*)"],
};
