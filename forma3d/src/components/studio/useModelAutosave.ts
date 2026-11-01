"use client";

import { useEffect, useRef } from "react";
import type { RequestItem } from "@/lib/requests";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { exportGlb } from "@/lib/three/export";

/**
 * Sauvegarde automatique du modèle 3D (GLB) dans Supabase Storage :
 * models/<id utilisateur>/<id demande>.glb, puis lien enregistré sur la demande.
 * La demande affichée passe en premier ; quelques autres sont rattrapées en arrière-plan.
 */
export function useModelAutosave(
  items: RequestItem[],
  selectedId: string | null,
  userId: string | null,
  onSaved: (id: string, path: string) => void,
) {
  const tried = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    if (!userId || running.current) return;
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    const eligible = (i: RequestItem) =>
      i.status === "ready" && i.design && !i.modelPath && !i.sample && !i.guest && !i.id.startsWith("tmp-") && !tried.current.has(i.id);
    const queue = [...items.filter((i) => i.id === selectedId && eligible(i)), ...items.filter((i) => i.id !== selectedId && eligible(i))].slice(0, 3);
    if (!queue.length) return;

    running.current = true;
    (async () => {
      for (const item of queue) {
        tried.current.add(item.id);
        try {
          const buffer = await exportGlb(item.design!);
          const path = `${userId}/${item.id}.glb`;
          const { error: uploadError } = await supabase.storage
            .from("models")
            .upload(path, new Blob([buffer], { type: "model/gltf-binary" }), { upsert: true, contentType: "model/gltf-binary" });
          if (uploadError) throw uploadError;
          const { error } = await supabase.from("design_requests").update({ model_path: path }).eq("id", item.id);
          if (error) throw error;
          onSaved(item.id, path);
        } catch (err) {
          console.warn("Sauvegarde du modèle 3D impossible :", err);
        }
      }
      running.current = false;
    })();
  }, [items, selectedId, userId, onSaved]);
}
