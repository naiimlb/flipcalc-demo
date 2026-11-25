"use client";

import { useEffect } from "react";
import { buildNotification, sendLocalNotification } from "@/lib/notify";
import { addDays, formatServiceDate, reminderAt, serviceDate, visiblePlan } from "@/lib/service";
import { updateState, useAppState, useNowMs } from "@/lib/store";

const GRACE_MS = 10 * 60_000; // on ne rattrape pas un rappel vieux de plus de 10 min

/**
 * Planificateur local : tant que l'app est ouverte, déclenche les rappels à l'heure.
 * App fermée ou iPhone verrouillé, il faudra le vrai Web Push (docs/PUSH.md).
 */
export function Reminders() {
  const state = useAppState();
  const nowMs = useNowMs();

  useEffect(() => {
    if (!state || nowMs === null || !state.settings.notify) return;
    const now = new Date(nowMs);
    const today = serviceDate(now);
    // Journée en cours + précédente (un rappel de 01h30 peut tomber après le changement de journée).
    for (const sDate of [today, addDays(today, -1)]) {
      for (const p of visiblePlan(state.tasks, sDate, state.settings.schedule)) {
        const at = reminderAt(p).getTime();
        if (at > nowMs || nowMs - at > GRACE_MS) continue;
        if (state.done[p.key] || state.notified[p.key]) continue;
        updateState((s) => ({ ...s, notified: { ...s.notified, [p.key]: true } }));
        void sendLocalNotification(buildNotification(p.task, formatServiceDate(sDate)), p.key);
      }
    }
  }, [state, nowMs]);

  return null;
}
