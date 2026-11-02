import type { StreamProgress } from "@/lib/design/partial-json";

/** Évènement diffusé par /api/generate (une ligne JSON chacun). */
export interface StreamEvent {
  t: "progress" | "ping" | "result";
  progress?: StreamProgress;
  status?: number;
  body?: unknown;
}

/** Lit un flux « une ligne JSON par évènement » et renvoie l'évènement final (« result »), s'il est arrivé. */
export async function readEventStream(
  stream: ReadableStream<Uint8Array>,
  onEvent: (event: StreamEvent) => void,
): Promise<StreamEvent | null> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: StreamEvent | null = null;

  const handle = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const event = JSON.parse(trimmed) as StreamEvent;
      if (event.t === "result") result = event;
      onEvent(event);
    } catch {
      // ligne illisible : ignorée
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline = buffer.indexOf("\n");
    while (newline >= 0) {
      handle(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf("\n");
    }
  }
  handle(buffer + decoder.decode());
  return result;
}
