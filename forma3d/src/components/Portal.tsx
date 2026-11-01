"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Rend les calques plein écran (dialogues, toasts) directement dans <body> :
 * un ancêtre avec transform ou backdrop-filter capturerait sinon le position: fixed.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? createPortal(children, document.body) : null;
}
