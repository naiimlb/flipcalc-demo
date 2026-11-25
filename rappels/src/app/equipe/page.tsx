"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/Skeleton";
import { listCashiers } from "@/lib/team";
import { useAppState } from "@/lib/store";
import type { Profile } from "@/lib/types";

/** Réservé au responsable (la base refuse de toute façon l'accès à un caissier). */
export default function TeamPage() {
  const app = useAppState();
  const [cashiers, setCashiers] = useState<Profile[] | null>(null);
  const [failed, setFailed] = useState(false);
  const isManager = app?.profile.role === "responsable";

  useEffect(() => {
    if (!isManager) return;
    let alive = true;
    listCashiers().then(
      (list) => alive && setCashiers(list),
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [isManager]);

  if (!app) return <Skeleton />;
  if (!isManager) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Page réservée au responsable</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Retour</Link>
      </div>
    );
  }

  return (
    <>
      <Header title="Mon équipe" />
      <p className="-mt-2 mb-4 text-sm font-medium text-mute">Touche un caissier pour lui assigner une tâche.</p>
      {failed ? (
        <p role="alert" className="rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">Impossible de charger l&apos;équipe. Vérifie ta connexion.</p>
      ) : !cashiers ? (
        <Skeleton />
      ) : cashiers.length === 0 ? (
        <div className="rounded-3xl bg-white p-6 text-center shadow-card">
          <p className="text-lg font-extrabold">Aucun caissier pour l&apos;instant</p>
          <p className="mt-1 text-sm text-mute">Ils apparaissent ici dès qu&apos;ils ont créé leur compte avec le code d&apos;équipe.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {cashiers.map((c) => (
            <li key={c.id}>
              <Link href={`/equipe/${c.id}`} className="flex min-h-16 items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-card active:scale-[0.99]">
                <span className="min-w-0">
                  <span className="block truncate text-lg font-extrabold">{c.prenom}</span>
                  <span className="block truncate text-sm text-mute">{c.email}</span>
                </span>
                <span className="shrink-0 rounded-full bg-pink px-4 py-2 text-sm font-extrabold text-white">Assigner</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
