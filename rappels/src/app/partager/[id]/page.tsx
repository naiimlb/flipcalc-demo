"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";
import { Skeleton } from "@/components/Skeleton";
import { dateKey, serviceDate } from "@/lib/service";
import { listColleagues, shareOverview, shareTask, type Colleague } from "@/lib/sharing";
import { refreshStore, useAppState } from "@/lib/store";
import { showToast } from "@/lib/toast";
import { isMine, type ShareMode } from "@/lib/types";

const MODES: { value: ShareMode; title: string; hint: string }[] = [
  { value: "each", title: "Chacun la fait", hint: "La tâche apparaît chez chacun, qui la coche de son côté." },
  { value: "one", title: "Un seul s'en occupe", hint: "Le premier qui appuie sur « Je m'en occupe » la prend. Les autres sont prévenus et leurs rappels s'arrêtent." },
];

/** Choisir avec quels collègues caissiers partager une tâche (on ne voit que leur prénom). */
export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const state = useAppState();
  const router = useRouter();
  const [colleagues, setColleagues] = useState<Colleague[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ShareMode>("each");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const task = state?.tasks.find((t) => t.id === id);
  const initialMode = task?.shareMode;
  const ready = !!state && !!task;

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      try {
        const [list, people] = await Promise.all([listColleagues(), shareOverview(id, dateKey(serviceDate(new Date()))).catch(() => [])]);
        if (cancelled) return;
        setColleagues(list);
        setPicked(new Set(people.filter((p) => !p.isOwner).map((p) => p.userId)));
        if (initialMode) setMode(initialMode);
      } catch {
        if (!cancelled) setError("Impossible de charger la liste de tes collègues. Vérifie ta connexion.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, id, initialMode]);

  if (!state) return <Skeleton />;
  if (!task || !isMine(task, state.profile.id)) {
    return (
      <div className="pt-6 text-center">
        <p className="text-xl font-extrabold">Tu ne peux pas partager cette tâche 🤷</p>
        <p className="mt-2 text-sm text-mute">Seul son créateur peut la partager.</p>
        <Link href="/" className="mt-4 inline-flex min-h-12 items-center rounded-full bg-pink px-6 font-bold text-white">Retour</Link>
      </div>
    );
  }

  const toggle = (cid: string) =>
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(cid)) n.delete(cid);
      else n.add(cid);
      return n;
    });

  async function save(recipients: string[]) {
    setBusy(true);
    setError("");
    try {
      await shareTask(id, recipients, mode);
      await refreshStore(true);
      showToast(recipients.length ? "👥 Tâche partagée" : "Partage arrêté", recipients.length ? "Tes collègues vont recevoir une notification." : "Plus personne ne voit cette tâche.");
      router.push(`/taches/${id}`);
    } catch {
      setError("Le partage n'a pas été enregistré. Vérifie ta connexion et réessaie.");
      setBusy(false);
    }
  }

  const already = !!task.shareMode;
  return (
    <div className="pb-8">
      <Link href={`/taches/${id}`} className="mb-3 inline-flex min-h-11 items-center text-sm font-bold text-pink-deep">← Retour</Link>
      <h1 className="h-street text-[2rem]">Partager</h1>
      <p className="mt-1 text-[17px] font-bold leading-snug">{task.title}</p>

      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide">Avec qui ?</legend>
        {colleagues === null && !error ? (
          <p className="text-sm text-mute">Chargement…</p>
        ) : colleagues && colleagues.length === 0 ? (
          <p className="rounded-2xl bg-white p-4 text-sm text-mute shadow-card">Aucun autre caissier inscrit pour le moment. Dis à tes collègues de créer leur compte.</p>
        ) : (
          <ul className="space-y-2">
            {(colleagues ?? []).map((c) => {
              const on = picked.has(c.id);
              return (
                <li key={c.id}>
                  <label className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 px-4 ${on ? "border-pink bg-pink-soft" : "border-line bg-white"}`}>
                    <input type="checkbox" checked={on} onChange={() => toggle(c.id)} className="size-6 accent-[#ff1f6e]" />
                    <span className="text-[17px] font-bold">{c.prenom}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm font-extrabold uppercase tracking-wide">Comment ?</legend>
        <div className="space-y-2">
          {MODES.map((m) => (
            <label key={m.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 ${mode === m.value ? "border-pink bg-pink-soft" : "border-line bg-white"}`}>
              <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 size-5 accent-[#ff1f6e]" />
              <span>
                <span className="block text-[17px] font-bold">{m.title}</span>
                <span className="block text-[13px] leading-snug text-mute">{m.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="mt-4 rounded-2xl bg-ink px-4 py-3 text-sm font-bold text-white">{error}</p>}

      <div className="mt-6 space-y-3">
        <button type="button" disabled={busy || picked.size === 0} onClick={() => save([...picked])} className="min-h-14 w-full rounded-full bg-pink text-lg font-extrabold text-white shadow-pop active:scale-[0.98] disabled:opacity-50">
          {busy ? "Envoi…" : picked.size === 0 ? "Choisis au moins un collègue" : already ? "Enregistrer le partage" : `Partager avec ${picked.size} collègue${picked.size > 1 ? "s" : ""}`}
        </button>
        {already && (
          <button type="button" disabled={busy} onClick={() => save([])} className="min-h-12 w-full rounded-full border-2 border-ink/15 bg-white text-base font-bold text-pink-deep">
            Arrêter de partager
          </button>
        )}
      </div>
    </div>
  );
}
