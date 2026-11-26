"use client";

import Link from "next/link";
import { use } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TaskForm } from "@/components/TaskForm";
import { useAppState } from "@/lib/store";
import { isMine } from "@/lib/types";

export default function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useAppState();
  if (!state) return <Skeleton />;
  const task = state.tasks.find((t) => t.id === id);
  if (!task) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Tâche introuvable 🤷</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">
          Retour
        </Link>
      </div>
    );
  }
  if (!isMine(task, state.profile.id)) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Tâche de {task.sharedBy ?? "ton collègue"} 👥</p>
        <p className="mt-2 text-sm text-mute">Seul son créateur peut la modifier. Toi, tu peux la voir, la prendre et la cocher.</p>
        <Link href={`/taches/${task.id}`} className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Ouvrir la tâche</Link>
      </div>
    );
  }
  return <TaskForm initial={task} />;
}
