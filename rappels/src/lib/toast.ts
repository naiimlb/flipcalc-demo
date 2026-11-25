"use client";

import { useSyncExternalStore } from "react";

export type ToastData = { id: number; title: string; body: string };

let current: ToastData | null = null;
let seq = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

export function showToast(title: string, body: string) {
  current = { id: ++seq, title, body };
  clearTimeout(timer);
  timer = setTimeout(hideToast, 8_000);
  listeners.forEach((l) => l());
}

export function hideToast() {
  current = null;
  listeners.forEach((l) => l());
}

export function useToast(): ToastData | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}
