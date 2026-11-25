/** Carte façon notification iOS : icône de l'app, titre de la tâche, heure. */
export function NotificationCard({ title, body, when = "maintenant" }: { title: string; body: string; when?: string }) {
  return (
    <div className="flex gap-3 rounded-[22px] bg-white/90 p-3 shadow-card ring-1 ring-black/5 backdrop-blur">
      <span
        aria-hidden
        className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-pink text-[13px] font-extrabold text-white"
      >
        #HB
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[15px] font-bold leading-tight text-ink">{title}</p>
          <span className="shrink-0 text-xs text-mute">{when}</span>
        </div>
        <p className="mt-0.5 text-[14px] leading-snug text-ink/80">{body}</p>
      </div>
    </div>
  );
}
