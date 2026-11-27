"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { retryAuth, useAuth } from "@/lib/auth";
import { loginUrl, nextFromSearch, safeNext } from "@/lib/redirect";
import { Logo } from "./Logo";
import { NumKeyboardBar } from "./NumKeyboardBar";
import { Reminders } from "./Reminders";
import { ServiceWorkerRegistration } from "./ServiceWorker";
import { Splash } from "./Splash";
import { TabBar } from "./TabBar";
import { Toast } from "./Toast";

const PUBLIC_PATHS = ["/connexion", "/inscription", "/mot-de-passe-oublie", "/reinitialiser"];

/** Protège toutes les pages : sans connexion, redirection vers l'écran de connexion. */
export function AppShell({ children }: { children: ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const signedIn = auth.status === "signedIn";
  // Un lien de réinitialisation ouvre une session : on laisse la page /reinitialiser s'afficher.
  const leavePublic = signedIn && isPublic && pathname !== "/reinitialiser";
  const toLogin = auth.status === "signedOut" && !isPublic;

  useEffect(() => {
    // Lien ouvert sans être connecté (ex. notification) : connexion, puis retour exactement sur la bonne page.
    if (toLogin) router.replace(loginUrl(`${window.location.pathname}${window.location.search}`));
    else if (leavePublic) router.replace(nextFromSearch(window.location.search) ?? "/");
  }, [toLogin, leavePublic, router]);

  // Le service worker nous dit où aller quand on touche une notification alors que l'app est déjà ouverte.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; url?: string } | null;
      if (d?.type !== "hb-open") return;
      e.ports[0]?.postMessage("ok"); // « reçu » : le service worker n'a pas à recharger la page
      const next = safeNext(d.url);
      if (next) router.push(next);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [router]);

  let content: ReactNode = children;
  if (auth.status === "unconfigured") {
    content = (
      <div className="pt-6 text-center">
        <div className="mb-4 flex justify-center"><Logo height={56} /></div>
        <p className="text-xl font-extrabold">App pas encore reliée à Supabase</p>
        <p className="mt-2 text-sm text-mute">Il manque NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY (voir docs/COMPTES.md).</p>
      </div>
    );
  } else if (auth.status === "error") {
    content = (
      <div className="pt-6 text-center">
        <div className="mb-4 flex justify-center"><Logo height={56} /></div>
        <p className="text-xl font-extrabold">Oups 😬</p>
        <p className="mt-2 text-sm text-mute">{auth.message}</p>
        <button type="button" onClick={retryAuth} className="mt-5 min-h-14 rounded-full bg-pink px-8 text-lg font-extrabold text-white shadow-pop">
          Réessayer
        </button>
      </div>
    );
  } else if (auth.status === "loading" || toLogin || leavePublic) {
    content = <Splash />;
  }

  return (
    <>
      <ServiceWorkerRegistration />
      {signedIn && <Reminders />}
      <Toast />
      <NumKeyboardBar />
      <div className="pt-safe kb-pad mx-auto min-h-dvh max-w-[430px] px-4 pb-32">
        {auth.status === "signedIn" && auth.offline && (
          <p role="status" className="mb-4 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">
            📡 Hors ligne : tu vois tes dernières données. Tu restes connecté ; tes modifications ne seront enregistrées qu&apos;avec du réseau.
          </p>
        )}
        {content}
      </div>
      {signedIn && !isPublic && <TabBar />}
    </>
  );
}
