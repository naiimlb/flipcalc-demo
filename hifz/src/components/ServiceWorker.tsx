"use client";

import { useEffect } from "react";

/** Enregistre le service worker (en production seulement, pour ne pas gêner le développement). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    if (document.readyState === "complete") void register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
