import type { ReactNode } from "react";

// Mini rendu markdown (puces, numéros, **gras**) sans dépendance ni HTML brut : tout passe par des nœuds React.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={i} className="font-extrabold">{part.slice(2, -2)}</strong> : part,
  );
}

type Block = { kind: "p"; text: string } | { kind: "ul" | "ol"; items: string[] };

function parse(text: string): Block[] {
  const blocks: Block[] = [];
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const bullet = /^[-•*]\s+(.*)$/.exec(t);
    const numbered = /^\d+[.)]\s+(.*)$/.exec(t);
    const item = bullet?.[1] ?? numbered?.[1];
    const kind = bullet ? "ul" : numbered ? "ol" : null;
    const last = blocks[blocks.length - 1];
    if (item !== undefined && kind) {
      if (last && last.kind === kind) last.items.push(item);
      else blocks.push({ kind, items: [item] });
    } else blocks.push({ kind: "p", text: t });
  }
  return blocks;
}

export function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5">
      {parse(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>{inline(b.text)}</p>
        ) : b.kind === "ul" ? (
          <ul key={i} className="ml-5 list-disc space-y-0.5 marker:text-pink">
            {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </ul>
        ) : (
          <ol key={i} className="ml-5 list-decimal space-y-0.5 marker:font-bold marker:text-pink">
            {b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}
          </ol>
        ),
      )}
    </div>
  );
}
