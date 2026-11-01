import type { RequestItem } from "@/lib/requests";

/** Résultats d'essai sans compte, gardés dans ce navigateur jusqu'à l'inscription. */
const KEY = "forma3d:guest-items";

export function readGuestItems(): RequestItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as RequestItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && i.design && i.status === "ready").slice(0, 5) : [];
  } catch {
    return [];
  }
}

export function saveGuestItems(items: RequestItem[]) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items.slice(0, 5)));
    else localStorage.removeItem(KEY);
  } catch {
    // stockage indisponible
  }
}
