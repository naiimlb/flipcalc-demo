"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Answer, ClarifyQuestion } from "@/lib/clarify-types";
import type { Design } from "@/lib/design/schema";
import type { StreamProgress } from "@/lib/design/partial-json";
import type { RequestItem } from "@/lib/requests";
import { readDraft, readPending, saveDraft, savePending } from "../studio/draft";
import { saveGuestItems, readGuestItems } from "../studio/guest";
import { prepareImage, type ImagePayload } from "../studio/image";
import { readEventStream } from "../studio/stream";
import { SimpleClarify } from "./SimpleClarify";
import { SimpleHome, type SimpleRequest } from "./SimpleHome";
import { SimpleProgress } from "./SimpleProgress";
import { SimpleResult } from "./SimpleResult";
import { currentStep } from "./steps";
import { ToastProvider } from "./ui";

/** Résultat transmis à l'éditeur (mode avancé) quand il n'est pas enregistré en base (démo, essai sans compte). */
export const HANDOFF_KEY = "forma3d:handoff";
const PRINTER_KEY = "forma3d:printer";

type Notice = { text: string; action?: { label: string; href: string }; examples?: boolean } | null;
type Screen =
  | { kind: "home" }
  | { kind: "checking"; startedAt: number }
  | { kind: "questions"; questions: ClarifyQuestion[] }
  | { kind: "working"; startedAt: number; progress: StreamProgress | null }
  | { kind: "result"; item: RequestItem; design: Design };

interface Props {
  demo: boolean;
  signedIn: boolean;
  features: { newRequests: boolean; imageUpload: boolean; guestTrial: boolean };
}

/** Message humain selon l'échec, avec l'action qui aide (jamais un code technique). */
function humanError(status: number, body: { error?: string; code?: string }): Notice {
  if (status === 401 || body.code === "unauthorized") {
    return { text: "Pour créer une pièce, il faut un compte gratuit. Votre demande est conservée.", action: { label: "Créer un compte", href: "/connexion" } };
  }
  if (body.code === "guest_quota" || body.code === "guest_unavailable") {
    return { text: body.error ?? "Votre essai gratuit est utilisé. Votre demande est conservée.", action: { label: "Créer un compte gratuit", href: "/connexion" } };
  }
  if (status === 402 || body.code === "credits_exhausted") {
    return { text: body.error ?? "Vous n'avez plus de crédits pour le moment. Votre demande est conservée.", action: { label: "Voir mes projets", href: "/espace" } };
  }
  if (status === 504) {
    return { text: "C'est plus long que prévu. Votre pièce est peut-être prête dans « Mes projets ». Vous pouvez aussi réessayer : votre texte est conservé.", action: { label: "Mes projets", href: "/espace" } };
  }
  return { text: `${body.error ?? "Je n'ai pas réussi à créer cette pièce."} Votre texte est conservé : vous pouvez réessayer.` };
}

/**
 * Parcours Simple complet : demande → précisions (si utile) → création → résultat.
 * Branché sur les mêmes API que l'éditeur (/api/clarify, /api/generate) : comptes, crédits, quotas et cache inchangés.
 */
export function SimpleApp({ demo, signedIn, features }: Props) {
  const [screen, setScreen] = useState<Screen>({ kind: "home" });
  const [notice, setNotice] = useState<Notice>(null);
  const [initial, setInitial] = useState<Partial<SimpleRequest>>({});
  const [printer, setPrinter] = useState<string | undefined>(undefined);
  const request = useRef<{ req: SimpleRequest; image: ImagePayload | null; answers: Answer[] } | null>(null);
  const abort = useRef<AbortController | null>(null);
  const [title, setTitle] = useState<{ title?: string; summary?: string }>({});

  // Texte non abouti (rechargement, mise à jour du site) : on le restaure.
  useEffect(() => {
    const draft = readPending() ?? readDraft();
    let storedPrinter: string | undefined;
    try {
      storedPrinter = localStorage.getItem(PRINTER_KEY) ?? undefined;
    } catch {
      storedPrinter = undefined;
    }
    setPrinter(storedPrinter);
    setInitial({ prompt: draft?.prompt ?? "", printer: storedPrinter });
  }, []);

  const backHome = useCallback((message: Notice = null) => {
    abort.current?.abort();
    abort.current = null;
    const r = request.current;
    setInitial({ prompt: r?.req.prompt ?? readDraft()?.prompt ?? "", printer: r?.req.printer ?? printer, photo: r?.req.photo ?? null });
    setNotice(message);
    setScreen({ kind: "home" });
  }, [printer]);

  const generate = useCallback(
    async (answers: Answer[]) => {
      const current = request.current;
      if (!current) return;
      current.answers = answers;
      const controller = new AbortController();
      abort.current = controller;
      setTitle({});
      setScreen({ kind: "working", startedAt: Date.now(), progress: null });
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
          body: JSON.stringify({
            prompt: current.req.prompt,
            answers,
            image: current.image ? { mediaType: current.image.mediaType, data: current.image.data } : null,
          }),
          signal: controller.signal,
        });
        let status = res.status;
        let body: { request?: RequestItem; error?: string; code?: string } = {};
        if (res.headers.get("content-type")?.includes("application/x-ndjson") && res.body) {
          const final = await readEventStream(res.body, (event) => {
            if (event.t === "progress" && event.progress) {
              const progress = event.progress;
              setTitle({ title: progress.title, summary: progress.analysis?.summary });
              setScreen((s) => (s.kind === "working" ? { ...s, progress } : s));
            }
          });
          if (!final) throw new Error("flux interrompu");
          status = final.status ?? 500;
          body = (final.body ?? {}) as typeof body;
        } else {
          body = (await res.json().catch(() => ({}))) as typeof body;
        }
        const item = body.request;
        if (status < 200 || status >= 300 || !item) {
          backHome(humanError(status, body));
          return;
        }
        if (item.status !== "ready" || !item.design) {
          if (item.error?.startsWith("Je n'ai pas compris")) {
            backHome({ text: "Je n'ai pas compris ce besoin. Décrivez un objet du quotidien (support, range-câbles, cache…), ou partez d'un exemple :", examples: true });
            return;
          }
          backHome({ text: `${item.error ?? "Je n'ai pas réussi à créer cette pièce."} Votre texte est conservé : vous pouvez réessayer ou le reformuler.` });
          return;
        }
        savePending(null);
        saveDraft(null);
        if (item.guest) saveGuestItems([item, ...readGuestItems()]);
        setScreen({ kind: "result", item, design: item.design });
      } catch (err) {
        if (controller.signal.aborted) return; // « Annuler » : backHome a déjà été appelé
        backHome({ text: "La connexion a été interrompue. Votre texte est conservé : vous pouvez réessayer." });
        void err;
      } finally {
        if (abort.current === controller) abort.current = null;
      }
    },
    [backHome],
  );

  const submit = useCallback(
    async (req: SimpleRequest) => {
      setNotice(null);
      try {
        localStorage.setItem(PRINTER_KEY, req.printer);
      } catch {
        // stockage indisponible
      }
      setPrinter(req.printer);
      let image: ImagePayload | null = null;
      if (req.photo) {
        try {
          image = await prepareImage(req.photo);
        } catch (err) {
          setInitial({ ...req, photo: null });
          setNotice({ text: err instanceof Error ? err.message : "Cette photo n'a pas pu être lue. Essayez une autre image." });
          return;
        }
      }
      request.current = { req, image, answers: [] };
      savePending({ prompt: req.prompt, image });
      if (!features.newRequests) {
        await generate([]);
        return;
      }
      // Précisions : seulement si la demande est floue ; jamais bloquant.
      const controller = new AbortController();
      abort.current = controller;
      setScreen({ kind: "checking", startedAt: Date.now() });
      let questions: ClarifyQuestion[] = [];
      try {
        const timer = setTimeout(() => controller.abort(), 25_000);
        const res = await fetch("/api/clarify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: req.prompt, hasImage: Boolean(image), image: image ? { mediaType: image.mediaType, data: image.data } : null }),
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (res.ok) {
          const data = (await res.json()) as { needed?: boolean; questions?: ClarifyQuestion[] };
          if (data.needed && Array.isArray(data.questions)) questions = data.questions.slice(0, 3);
        }
      } catch {
        // pas de précisions : la demande part telle quelle
      }
      if (abort.current !== controller) return; // annulé entre-temps
      abort.current = null;
      if (questions.length) setScreen({ kind: "questions", questions });
      else await generate([]);
    },
    [features.newRequests, generate],
  );

  const openAdvanced = useCallback(
    (item: RequestItem, design: Design) => {
      if (!demo && !item.guest) {
        window.location.assign(`/studio?p=${item.id}`);
        return;
      }
      try {
        sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ ...item, design }));
      } catch {
        // stockage indisponible : l'éditeur s'ouvre sans la pièce
      }
      window.location.assign("/studio");
    },
    [demo],
  );

  return (
    <ToastProvider>
      <div className="simple-ui min-h-dvh">
        {screen.kind === "home" && (
          <SimpleHome
            key={`${initial.prompt ?? ""}|${notice?.text ?? ""}`}
            demo={demo}
            signedIn={signedIn}
            allowPhoto={features.imageUpload}
            initial={initial}
            notice={notice}
            onDraft={(prompt) => saveDraft({ prompt, image: null })}
            onSubmit={submit}
          />
        )}
        {screen.kind === "checking" && <SimpleProgress current={0} startedAt={screen.startedAt} onCancel={() => backHome({ text: "Demande annulée. Votre texte est conservé." })} />}
        {screen.kind === "questions" && request.current && (
          <SimpleClarify prompt={request.current.req.prompt} questions={screen.questions} onDone={(answers) => void generate(answers)} onEdit={() => backHome()} />
        )}
        {screen.kind === "working" && (
          <SimpleProgress
            current={currentStep(screen.progress)}
            title={title.title}
            summary={title.summary}
            startedAt={screen.startedAt}
            onCancel={() => backHome({ text: "Demande annulée. Votre texte est conservé." })}
          />
        )}
        {screen.kind === "result" && (
          <SimpleResult
            design={screen.design}
            demo={demo}
            printerId={printer}
            onBack={() => {
              request.current = null;
              setInitial({ prompt: "", printer });
              setNotice(null);
              setScreen({ kind: "home" });
            }}
            onAdvanced={() => openAdvanced(screen.item, screen.design)}
          />
        )}
      </div>
    </ToastProvider>
  );
}
