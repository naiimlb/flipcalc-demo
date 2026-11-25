"use client";

import { hideToast, useToast } from "@/lib/toast";
import { NotificationCard } from "./NotificationCard";

/** Bandeau « notification » affiché dans l'app (simulation / app au premier plan). */
export function Toast() {
  const toast = useToast();
  if (!toast) return null;
  return (
    <div className="pt-safe fixed inset-x-0 top-0 z-50 mx-auto max-w-[430px] px-3" role="status" aria-live="polite">
      <button key={toast.id} type="button" onClick={hideToast} className="pop-in block w-full text-left">
        <NotificationCard title={toast.title} body={toast.body} />
      </button>
    </div>
  );
}
