import type { Task } from "@/lib/types";

/** Pastille « 👥 de Léa » (reçue) ou « 👥 Partagée » (la mienne, partagée avec des collègues). */
export function ShareBadge({ task, light = false }: { task: Task; light?: boolean }) {
  const cls = `rounded-full px-2 py-0.5 text-[11px] font-bold ${light ? "bg-white/25" : "bg-pink-soft text-pink-deep"}`;
  if (task.sharedBy) return <span className={cls}>👥 de {task.sharedBy}</span>;
  if (task.shareMode) return <span className={cls}>👥 Partagée</span>;
  return null;
}
