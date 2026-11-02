"use client";

import { useEffect } from "react";
import { captureInstallPrompt } from "@/lib/install-prompt";

/** Enregistre le service worker (application installable + page hors-ligne), en production uniquement. */
export function RegisterServiceWorker() {
  useEffect(() => {
    captureInstallPrompt();
  }, []);
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // l'application fonctionne très bien sans
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
