"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { ProposalCard } from "@/components/ProposalCard";
import { RichText } from "@/components/RichText";
import { Skeleton } from "@/components/Skeleton";
import { buildContext, toTurns } from "@/lib/assistant-context";
import type { ProposedTask, StreamEvent } from "@/lib/assistant-types";
import { clearChat, getClientId, updateChat, useChat, type ChatMessage } from "@/lib/chat-store";
import { dateKey, serviceDate, weekdayIndex } from "@/lib/service";
import { updateState, useAppState } from "@/lib/store";

const uid = () => Math.random().toString(36).slice(2, 10);

const SUGGESTIONS = [
  { label: "Que faire maintenant ?", send: "Que faire maintenant ?" },
  { label: "🧮 Compter la caisse", href: "/assistant/caisse" },
  { label: "Calculer TTC", prefill: "Calcule le TTC de " },
  { label: "Aide clôture", send: "Aide-moi pour la clôture." },
] as const;

export default function AssistantPage() {
  const chat = useChat();
  const app = useAppState();
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const count = chat?.messages.length ?? 0;
  const lastText = chat?.messages[count - 1]?.text;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [count, lastText, busy]);

  if (!chat || !app) return <Skeleton />;

  const patch = (id: string, fn: (m: ChatMessage) => ChatMessage, persist = false) =>
    updateChat((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? fn(m) : m)) }), persist);

  async function send(raw: string) {
    const text = raw.trim().slice(0, 600);
    if (!text || busy || !chat || !app) return;
    setBusy(true);
    setInput("");

    const userMsg: ChatMessage = { id: uid(), role: "user", text };
    const botId = uid();
    const history = [...chat.messages, userMsg];
    updateChat((s) => ({ ...s, messages: [...s.messages, userMsg, { id: botId, role: "assistant", text: "" }] }));

    const fail = (error: string) => patch(botId, (m) => ({ ...m, error }), true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-client-id": getClientId() },
        body: JSON.stringify({ messages: toTurns(history), context: buildContext(app, new Date()) }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => null)) as { message?: string } | null;
        return fail(j?.message ?? "Oups, l'assistant ne répond pas. Réessaie.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as StreamEvent;
          if (ev.type === "text") patch(botId, (m) => ({ ...m, text: m.text + ev.text }));
          else if (ev.type === "proposal") patch(botId, (m) => ({ ...m, proposals: [...(m.proposals ?? []), { id: uid(), task: ev.task }] }));
          else if (ev.type === "error") patch(botId, (m) => ({ ...m, error: ev.message }));
        }
      }
      patch(botId, (m) => (m.text || m.proposals?.length || m.error ? m : { ...m, error: "Je n'ai pas de réponse là. Reformule ?" }), true);
    } catch {
      fail("Pas de connexion. Vérifie ton réseau et réessaie.");
    } finally {
      setBusy(false);
    }
  }

  function retry(botId: string) {
    const i = chat!.messages.findIndex((m) => m.id === botId);
    const question = chat!.messages[i - 1];
    if (!question || question.role !== "user") return;
    updateChat((s) => ({ ...s, messages: s.messages.filter((m) => m.id !== botId && m.id !== question.id) }));
    void send(question.text);
  }

  function addTask(msgId: string, proposalId: string, task: ProposedTask) {
    const sDate = serviceDate(new Date());
    updateState((s) => ({
      ...s,
      tasks: [
        ...s.tasks,
        {
          id: `t-${Date.now().toString(36)}`,
          title: task.title,
          category: task.category,
          time: task.time,
          remind: task.remind,
          // Ponctuelle : liée à ce service seulement (modifiable ensuite en « Répéter chaque semaine »).
          date: dateKey(sDate),
          days: [weekdayIndex(sDate)],
          ...(task.note ? { note: task.note } : {}),
        },
      ],
    }));
    patch(msgId, (m) => ({ ...m, proposals: m.proposals?.map((p) => (p.id === proposalId ? { ...p, added: true } : p)) }), true);
  }

  return (
    <>
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Logo height={36} />
          <h1 className="h-street text-2xl">Assistant caisse</h1>
        </div>
        {chat.messages.length > 0 && (
          <button
            type="button"
            onClick={clearChat}
            disabled={busy}
            className="min-h-11 rounded-full border-2 border-pink bg-white px-3 text-xs font-extrabold text-pink-deep disabled:opacity-50"
          >
            Nouvelle discussion
          </button>
        )}
      </header>

      <div className="space-y-3" aria-live="polite">
        {chat.messages.length === 0 && (
          <div className="rounded-3xl bg-white p-4 shadow-card">
            <p className="text-lg font-extrabold">Salut {app.role.toLowerCase()} 👋</p>
            <ul className="mt-2 ml-5 list-disc space-y-1 text-[15px] marker:text-pink">
              <li>Je te dis quoi faire selon l&apos;heure et ta liste.</li>
              <li>Je t&apos;aide pour les comptes : caisse, TVA, monnaie, écart.</li>
              <li>Je ne connais ni les prix ni les règles de ton resto : pour ça, ton responsable.</li>
            </ul>
            <p className="mt-3 rounded-2xl bg-pink-soft p-3 text-[13px] font-semibold text-pink-deep">
              🔒 Écris seulement des tâches et des montants : pas de noms, ni de numéros de téléphone ou de carte.
            </p>
          </div>
        )}

        {chat.messages.map((m, i) => {
          const isLast = i === chat.messages.length - 1;
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-md bg-pink px-4 py-2.5 text-[16px] font-semibold text-white shadow-pop">{m.text}</p>
              </div>
            );
          }
          const waiting = busy && isLast && !m.text && !m.proposals?.length && !m.error;
          return (
            <div key={m.id} className="flex gap-2">
              <span aria-hidden className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-pink text-[10px] font-extrabold text-white">#HB</span>
              <div className="min-w-0 max-w-[88%]">
                {(m.text || waiting || m.error) && (
                  <div className={`rounded-3xl rounded-bl-md px-4 py-2.5 text-[16px] leading-snug shadow-card ${m.error ? "bg-pink-soft text-pink-deep" : "bg-white"}`}>
                    {waiting ? (
                      <span className="flex gap-1 py-1.5" role="status" aria-label="L'assistant écrit">
                        {[0, 1, 2].map((d) => (
                          <span key={d} className="size-2 animate-bounce rounded-full bg-pink" style={{ animationDelay: `${d * 150}ms` }} />
                        ))}
                      </span>
                    ) : m.error ? (
                      <>
                        <p className="font-semibold">⚠️ {m.error}</p>
                        {isLast && !busy && (
                          <button type="button" onClick={() => retry(m.id)} className="mt-2 min-h-11 rounded-full bg-pink px-4 text-sm font-extrabold text-white">
                            Réessayer
                          </button>
                        )}
                      </>
                    ) : (
                      <RichText text={m.text.trim()} />
                    )}
                  </div>
                )}
                {m.proposals?.map((p) => (
                  <ProposalCard key={p.id} proposal={p} onAdd={() => addTask(m.id, p.id, p.task)} />
                ))}
              </div>
            </div>
          );
        })}
        <div ref={endRef} className="h-44" aria-hidden />
      </div>

      <div
        className="fixed inset-x-0 z-20 border-t border-line bg-canvas/95 backdrop-blur"
        style={{ bottom: "calc(3.5rem + max(env(safe-area-inset-bottom), 0.5rem) + 1px)" }}
      >
        <div className="mx-auto max-w-[430px] px-3 pb-2 pt-2">
          <div className="-mx-3 mb-2 flex gap-2 overflow-x-auto px-3 pb-1">
            {SUGGESTIONS.map((s) => {
              const cls = "min-h-11 shrink-0 rounded-full border-2 border-pink bg-white px-4 text-sm font-bold text-pink-deep active:bg-pink-soft disabled:opacity-50";
              if ("href" in s) return <Link key={s.label} href={s.href} className={`${cls} inline-flex items-center`}>{s.label}</Link>;
              return (
                <button
                  key={s.label}
                  type="button"
                  disabled={busy}
                  className={cls}
                  onClick={() => {
                    if ("send" in s) void send(s.send);
                    else {
                      setInput(s.prefill);
                      inputRef.current?.focus();
                    }
                  }}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={600}
              enterKeyHint="send"
              autoComplete="off"
              placeholder="Écris ta question…"
              aria-label="Ton message"
              className="min-h-12 min-w-0 flex-1 rounded-full border-2 border-line bg-white px-4 text-[16px] font-semibold focus:border-pink"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              aria-label="Envoyer"
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pink text-white shadow-pop active:scale-95 disabled:opacity-50 disabled:shadow-none"
            >
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
