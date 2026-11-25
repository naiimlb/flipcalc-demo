"use client";

import { rowToProfile, taskToFields, type ProfileRow } from "./db-map";
import { getSupabase } from "./supabase";
import type { Profile, Task } from "./types";

// Fonctions du responsable. La base (RLS) refuse tout à un caissier, même s'il appelait ces fonctions.

/** Liste des caissiers (prénom + email). */
export async function listCashiers(): Promise<Profile[]> {
  const { data, error } = await getSupabase().from("profiles").select("id,email,prenom,role").eq("role", "caissier").order("prenom");
  if (error) throw new Error(error.message);
  return (data as ProfileRow[]).map(rowToProfile);
}

export async function getCashier(id: string): Promise<Profile | null> {
  const { data, error } = await getSupabase().from("profiles").select("id,email,prenom,role").eq("id", id).eq("role", "caissier").maybeSingle();
  if (error) throw new Error(error.message);
  return data ? rowToProfile(data as ProfileRow) : null;
}

/** Crée une tâche pour un caissier précis. Le responsable ne peut pas relire ni modifier les tâches du caissier. */
export async function assignTask(cashierId: string, managerId: string, task: Task): Promise<boolean> {
  const { error } = await getSupabase()
    .from("tasks")
    .insert({ id: task.id, user_id: cashierId, assigned_by: managerId, ...taskToFields(task) }); // pas de .select() : lecture interdite
  return !error;
}
