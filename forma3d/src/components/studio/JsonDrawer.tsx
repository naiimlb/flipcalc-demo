"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { IconX, Spinner } from "../icons";

interface DebugRow {
  raw_response: string | null;
  stop_reason: string | null;
  usage: Record<string, number | null> | null;
  validation_errors: string[] | null;
}

/** Mode Dev : JSON brut renvoyé par l'IA (table request_debug, lisible par les admins uniquement). */
export function JsonDrawer({
  item,
  localRaw,
  onClose,
}: {
  item: RequestItem | null;
  localRaw: string | null;
  onClose(): void;
}) {
  const [debug, setDebug] = useState<DebugRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<"raw" | "design">("raw");

  useEffect(() => {
    setDebug(null);
    if (!item || item.sample) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setLoading(true);
    supabase
      .from("request_debug")
      .select("raw_response, stop_reason, usage, validation_errors")
      .eq("request_id", item.id)
      .maybeSingle()
      .then(({ data }) => {
        setDebug((data as DebugRow | null) ?? null);
        setLoading(false);
      });
  }, [item]);

  const raw = debug?.raw_response ?? localRaw;
  let pretty = raw ?? "";
  try {
    if (raw) pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    // texte non JSON : affiché tel quel
  }
  const content = view === "raw" ? pretty || "(aucune réponse brute enregistrée)" : JSON.stringify(item?.design ?? null, null, 2);

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.aside
            initial={{ x: 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            className="flex h-full w-full max-w-2xl flex-col bg-[#0f1020] text-white"
            aria-label="JSON brut"
          >
            <header className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wide text-white/50">Mode Dev</p>
                <p className="truncate font-semibold">{item.title ?? item.prompt}</p>
              </div>
              <button type="button" onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Fermer">
                <IconX size={16} />
              </button>
            </header>
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 text-xs">
              {(["raw", "design"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`rounded-full px-3 py-1 font-semibold ${view === v ? "bg-white text-ink" : "bg-white/10"}`}
                >
                  {v === "raw" ? "Réponse brute de l'IA" : "Conception validée"}
                </button>
              ))}
              {loading && <Spinner size={14} />}
              {debug?.stop_reason && <span className="text-white/60">stop_reason : {debug.stop_reason}</span>}
              {debug?.usage && (
                <span className="text-white/60">
                  jetons : {debug.usage.input_tokens ?? "?"} entrée / {debug.usage.output_tokens ?? "?"} sortie
                </span>
              )}
              <button
                type="button"
                onClick={() => navigator.clipboard?.writeText(content)}
                className="ml-auto rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20"
              >
                Copier
              </button>
            </div>
            {debug?.validation_errors && debug.validation_errors.length > 0 && (
              <div className="mx-5 mb-3 rounded-xl bg-rose-500/15 p-3 text-xs text-rose-200">
                <p className="font-semibold">Erreurs de validation</p>
                <ul className="mt-1 list-disc pl-4">
                  {debug.validation_errors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
            <pre className="mx-5 mb-5 flex-1 overflow-auto rounded-xl bg-black/40 p-4 font-mono text-[11.5px] leading-relaxed text-emerald-200 scrollbar-thin">
              {content}
            </pre>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
