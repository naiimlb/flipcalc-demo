/* =====================================================================
   middleware.ts — Rafraîchit la session Supabase à chaque navigation.
   ---------------------------------------------------------------------
   Sans ce passage, le jeton d'authentification expire côté serveur et
   l'utilisateur se retrouve déconnecté sans comprendre pourquoi.
   Si Supabase n'est pas configuré, le middleware ne fait rien.
   ===================================================================== */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(requete: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const cle = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !cle) return NextResponse.next();

  let reponse = NextResponse.next({ request: requete });

  const supabase = createServerClient(url, cle, {
    cookies: {
      getAll() {
        return requete.cookies.getAll();
      },
      setAll(cookiesAEcrire) {
        for (const { name, value } of cookiesAEcrire) {
          requete.cookies.set(name, value);
        }
        reponse = NextResponse.next({ request: requete });
        for (const { name, value, options } of cookiesAEcrire) {
          reponse.cookies.set(name, value, options);
        }
      },
    },
  });

  await supabase.auth.getUser();
  return reponse;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers statiques et les images.
    '/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
