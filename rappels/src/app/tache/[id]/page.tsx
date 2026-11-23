"use client";

import Link from "next/link";
import { use } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TaskForm } from "@/components/TaskForm";
import { useAppState } from "@/lib/store";

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
  return <TaskForm initial={task} />;
}
