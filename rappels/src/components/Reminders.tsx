"use client";

import { useEffect } from "react";
import { buildSlotNotification } from "@/lib/notification-text";
import { sendLocalNotification } from "@/lib/notify";
import { addDays, notificationSlots, serviceDate, visiblePlan } from "@/lib/service";
import { reconcilePush, usePushOn } from "@/lib/push";
import { updateState, useAppState, useNowMs } from "@/lib/store";

const GRACE_MS = 5 * 60_000; // on ne rattrape pas un rappel vieux de plus de 5 min

/**
 * Planificateur local : tant que l'app est ouverte, déclenche les rappels (y compris les répétitions).
 * Quand les notifications push du serveur sont activées sur cet appareil, il s'efface pour éviter les doublons.
 * App fermée ou iPhone verrouillé : ce sont les push du serveur qui prennent le relais (docs/NOTIFICATIONS.md).
 */
export function Reminders() {
  const state = useAppState();
  const nowMs = useNowMs();
  const uid = state?.profile.id;
  const pushOn = usePushOn(uid);

  useEffect(() => {
    if (uid) void reconcilePush(uid);
  }, [uid]);

  useEffect(() => {
    if (!state || nowMs === null || !state.settings.notify || pushOn) return;
    const today = serviceDate(new Date(nowMs));
    // Journée en cours + précédente (un rappel de 01h30 appartient à la journée de la veille).
    for (const sDate of [today, addDays(today, -1)]) {
      for (const p of visiblePlan(state.tasks, sDate, state.settings.schedule)) {
        if (state.done[p.key] && p.task.untilDone) continue;
        for (const slot of notificationSlots(p.task, sDate)) {
          const late = nowMs - slot.at.getTime();
          if (late < 0 || late >= GRACE_MS) continue;
          const mark = `${p.key}#${slot.ext}`; // un créneau ne part qu'une seule fois
          if (state.notified[mark]) continue;
          void updateState((s) => ({ ...s, notified: { ...s.notified, [mark]: true } }));
          void sendLocalNotification(buildSlotNotification(p.task, slot.ext), mark);
        }
      }
    }
  }, [state, nowMs, pushOn]);

  return null;
}
