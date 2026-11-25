"use client";

import { useSyncExternalStore } from "react";
import { doneKey, parseDoneKey, rowToSettings, rowToTask, taskToFields, type DoneRow, type SettingsRow, type TaskRow } from "./db-map";
import { getSupabase } from "./supabase";
import { diffState, isEmptyOps, type SyncOps } from "./sync-diff";
import { showToast } from "./toast";
import type { AppState, Profile } from "./types";

// Données de l'utilisateur connecté (tâches, tâches faites, réglages, profil), stockées dans Supabase.
// Les écrans lisent useAppState() et écrivent avec updateState() : l'écran change tout de suite,
// puis la modification part dans la base en arrière-plan (la sécurité est assurée par les règles RLS).
let state: AppState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const FOLLOW_DAYS = 21; // on ne charge que les 3 dernières semaines de « tâches faites »

const dateKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// ----- rappels déjà envoyés : propres à cet appareil, jamais envoyés à la base -----
const notifiedKey = (uid: string) => `hb-notified:${uid}`;
function loadNotified(uid: string): Record<string, true> {
  try {
    return JSON.parse(localStorage.getItem(notifiedKey(uid)) ?? "{}") as Record<string, true>;
  } catch {
    return {};
  }
}
function saveNotified(uid: string, map: Record<string, true>) {
  const min = dateKeyOf(new Date(Date.now() - FOLLOW_DAYS * 86_400_000));
  const kept = Object.fromEntries(Object.entries(map).filter(([k]) => parseDoneKey(k).serviceDate >= min));
  try {
    localStorage.setItem(notifiedKey(uid), JSON.stringify(kept));
  } catch {
    /* stockage plein ou indisponible : sans gravité */
  }
}

// ----- lecture -----
async function fetchState(profile: Profile, notified: Record<string, true>): Promise<AppState> {
  const sb = getSupabase();
  const since = dateKeyOf(new Date(Date.now() - FOLLOW_DAYS * 86_400_000));
  const [tasks, done, settings] = await Promise.all([
    sb.from("tasks").select("id,user_id,assigned_by,title,category,at_time,days,once_date,team,remind,note").order("created_at"),
    sb.from("task_done").select("task_id,service_date").gte("service_date", since),
    sb.from("settings").select("default_remind,notify,handover_min,schedule").maybeSingle(),
  ]);
  if (tasks.error) throw tasks.error;
  if (done.error) throw done.error;
  if (settings.error) throw settings.error;
  return {
    profile,
    tasks: (tasks.data as TaskRow[]).map(rowToTask),
    done: Object.fromEntries((done.data as DoneRow[]).map((d) => [doneKey(d.task_id, d.service_date), true as const])),
    notified,
    settings: rowToSettings(settings.data as SettingsRow | null),
  };
}

/** Charge les données du compte connecté (appelé une fois la session ouverte). */
export async function loadStore(profile: Profile): Promise<void> {
  state = await fetchState(profile, loadNotified(profile.id));
  // L'ancien historique de chat (fonction supprimée) n'a plus lieu d'être.
  try {
    localStorage.removeItem("hb-assistant:v1");
    localStorage.removeItem("hb-assistant-client");
  } catch {
    /* ignoré */
  }
  emit();
}

/** À la déconnexion : on vide tout ce qui est en mémoire. */
export function resetStore() {
  state = null;
  emit();
}

let lastRefresh = 0;
/** Recharge depuis la base (retour au premier plan, autre téléphone, tâche assignée par le responsable…). */
export async function refreshStore(force = false): Promise<void> {
  if (!state || (!force && Date.now() - lastRefresh < 20_000)) return;
  lastRefresh = Date.now();
  await chain;
  if (!state) return;
  try {
    const fresh = await fetchState(state.profile, state.notified);
    if (state) {
      state = fresh;
      emit();
    }
  } catch {
    /* hors ligne : on garde l'affichage actuel */
  }
}

// ----- écriture -----
type Result = { error: { message: string } | null };
async function check(p: PromiseLike<Result>) {
  const { error } = await p;
  if (error) throw new Error(error.message);
}

async function push(ops: SyncOps, next: AppState) {
  const sb = getSupabase();
  const uid = next.profile.id;
  if (ops.taskInserts.length) await check(sb.from("tasks").insert(ops.taskInserts.map((t) => ({ id: t.id, user_id: uid, ...taskToFields(t) }))));
  for (const t of ops.taskUpdates) await check(sb.from("tasks").update(taskToFields(t)).eq("id", t.id));
  if (ops.taskDeletes.length) await check(sb.from("tasks").delete().in("id", ops.taskDeletes));
  if (ops.doneAdds.length) {
    const rows = ops.doneAdds.map((k) => {
      const { taskId, serviceDate } = parseDoneKey(k);
      return { task_id: taskId, service_date: serviceDate, user_id: uid };
    });
    await check(sb.from("task_done").upsert(rows, { onConflict: "task_id,service_date" }));
  }
  for (const k of ops.doneRemoves) {
    const { taskId, serviceDate } = parseDoneKey(k);
    await check(sb.from("task_done").delete().eq("task_id", taskId).eq("service_date", serviceDate));
  }
  if (ops.settingsChanged) {
    await check(
      sb.from("settings").upsert({ user_id: uid, default_remind: next.settings.defaultRemind, notify: next.settings.notify, handover_min: next.settings.handover, schedule: next.settings.schedule, updated_at: new Date().toISOString() }, { onConflict: "user_id" }),
    );
  }
  if (ops.profileChanged) await check(sb.from("profiles").update({ prenom: next.profile.prenom }).eq("id", uid));
}

let chain: Promise<unknown> = Promise.resolve();

/**
 * Modifie l'état : l'écran se met à jour tout de suite, puis la base suit (dans l'ordre).
 * Renvoie true quand tout est bien enregistré, false si l'écriture a échoué (l'état est alors rechargé).
 */
export function updateState(fn: (s: AppState) => AppState): Promise<boolean> {
  if (!state) return Promise.resolve(false);
  const prev = state;
  const next = fn(prev);
  state = next;
  if (next.notified !== prev.notified) saveNotified(next.profile.id, next.notified);
  emit();

  const ops = diffState(prev, next);
  if (isEmptyOps(ops)) return Promise.resolve(true);
  const job = chain.then(() => push(ops, next)).then(
    () => true,
    () => {
      showToast("⚠️ Pas enregistré", "Vérifie ta connexion : ta dernière modification n'a pas été sauvegardée.");
      void refreshStore(true);
      return false;
    },
  );
  chain = job;
  return job;
}

// ----- hooks -----
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => void listeners.delete(cb);
}

/** null tant que l'utilisateur n'est pas connecté ou que ses données ne sont pas chargées. */
export function useAppState(): AppState | null {
  return useSyncExternalStore(subscribe, () => state, () => null);
}

// ----- horloge : un tick toutes les 15 s, sans setState dans un effet -----
const TICK = 15_000;
function subscribeClock(cb: () => void) {
  const id = setInterval(cb, 5_000);
  const onVisible = () => {
    cb();
    if (document.visibilityState === "visible") void refreshStore();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

/** Heure courante en ms (arrondie à 15 s), null côté serveur. */
export function useNowMs(): number | null {
  return useSyncExternalStore(subscribeClock, () => Math.floor(Date.now() / TICK) * TICK, () => null);
}
