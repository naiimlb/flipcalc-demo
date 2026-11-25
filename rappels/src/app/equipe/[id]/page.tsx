"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { TaskForm } from "@/components/TaskForm";
import { useAppState } from "@/lib/store";
import { getCashier } from "@/lib/team";
import type { Profile } from "@/lib/types";

export default function AssignTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const app = useAppState();
  const [cashier, setCashier] = useState<Profile | null | undefined>(undefined); // undefined = chargement
  const isManager = app?.profile.role === "responsable";

  useEffect(() => {
    if (!isManager) return;
    let alive = true;
    getCashier(id).then(
      (c) => alive && setCashier(c),
      () => alive && setCashier(null),
    );
    return () => {
      alive = false;
    };
  }, [id, isManager]);

  if (!app || (isManager && cashier === undefined)) return <Skeleton />;
  if (!isManager || !cashier) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Caissier introuvable 🤷</p>
        <Link href="/equipe" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Retour</Link>
      </div>
    );
  }
  return <TaskForm assignTo={{ id: cashier.id, prenom: cashier.prenom }} />;
}
