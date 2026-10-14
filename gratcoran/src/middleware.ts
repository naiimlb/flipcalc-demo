import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SESSION_COOKIE_OPTIONS, supabaseEnv } from "@/lib/supabase/env";

/** Pages accessibles sans session. */
const PUBLIC_PATHS = ["/login", "/mot-de-passe-oublie", "/reinitialiser"];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();
  const written = new Set<string>();

  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          written.add(name);
          response.cookies.set(name, value, { ...SESSION_COOKIE_OPTIONS, ...options });
        }
      },
    },
  });

  // Vérifie la session et rafraîchit le jeton d'accès si besoin (refresh token).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!user && !isPublic) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Session expirée : reconnecte-toi.", code: "unauthorized" },
        { status: 401 },
      );
    }
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  // Ré-émet les cookies de session par le serveur (Set-Cookie) : Safari limite
  // à 7 jours les cookies écrits en JavaScript, pas ceux posés par le serveur.
  if (user) {
    for (const cookie of request.cookies.getAll()) {
      if (cookie.name.startsWith("sb-") && !written.has(cookie.name)) {
        response.cookies.set(cookie.name, cookie.value, SESSION_COOKIE_OPTIONS);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|favicon-32.png|icons/|apple-touch-icon.png|manifest.webmanifest|logo.svg|robots.txt).*)",
  ],
};
