"use client";

import { useSyncExternalStore } from "react";
import type { ProposedTask } from "./assistant-types";

// Historique de la discussion : uniquement dans ce navigateur (localStorage), jamais côté serveur.
const KEY = "hb-assistant:v1";
const CLIENT_KEY = "hb-assistant-client";
const MAX_KEPT = 60;

export type ChatProposal = { id: string; task: ProposedTask; added?: boolean };
export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposals?: ChatProposal[];
  /** Message d'erreur affiché à la place de la réponse. */
  error?: string;
};
export type ChatState = { v: 1; messages: ChatMessage[] };

const empty: ChatState = { v: 1, messages: [] };
let lastRaw: string | null | undefined;
let cache: ChatState = empty;
const listeners = new Set<() => void>();

function read(): ChatState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    /* stockage indisponible */
  }
  if (raw !== lastRaw) {
    lastRaw = raw;
    try {
      const data = raw ? (JSON.parse(raw) as ChatState) : empty;
      cache = data.v === 1 && Array.isArray(data.messages) ? data : empty;
    } catch {
      cache = empty;
    }
  }
  return cache;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** null avant hydratation. */
export function useChat(): ChatState | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

/** `persist: false` pendant le streaming (évite d'écrire à chaque mot). */
export function updateChat(fn: (s: ChatState) => ChatState, persist = true) {
  const next = fn(read());
  next.messages = next.messages.slice(-MAX_KEPT);
  cache = next;
  if (persist) {
    const raw = JSON.stringify(next);
    try {
      localStorage.setItem(KEY, raw);
    } catch {
      /* quota : on garde la session en mémoire */
    }
    lastRaw = raw;
  }
  listeners.forEach((l) => l());
}

export function clearChat() {
  updateChat(() => ({ v: 1, messages: [] }));
}

/** Identifiant anonyme de l'appareil (sert uniquement à la limite de messages). */
export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
