"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { retryAuth, useAuth } from "@/lib/auth";
import { Logo } from "./Logo";
import { Reminders } from "./Reminders";
import { ServiceWorkerRegistration } from "./ServiceWorker";
import { Skeleton } from "./Skeleton";
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
    if (toLogin) router.replace("/connexion");
    else if (leavePublic) router.replace("/");
  }, [toLogin, leavePublic, router]);

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
    content = <Skeleton />;
  }

  return (
    <>
      <ServiceWorkerRegistration />
      {signedIn && <Reminders />}
      <Toast />
      <div className="pt-safe mx-auto min-h-dvh max-w-[430px] px-4 pb-32">{content}</div>
      {signedIn && !isPublic && <TabBar />}
    </>
  );
}
