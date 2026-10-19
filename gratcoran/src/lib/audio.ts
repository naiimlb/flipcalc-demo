import "server-only";
import type { NextRequest } from "next/server";

export const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MIN_AUDIO_BYTES = 1024;

/** Extension acceptée par l'API de transcription selon le type MIME envoyé. */
export function extensionFor(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("flac")) return "flac";
  return null;
}

export type AudioUpload =
  | { ok: true; audio: File; ext: string; form: FormData }
  | { ok: false; status: number; code: string; error: string };

/** Lit et valide le fichier « audio » d'un envoi multipart (5 Mo maximum). */
export async function readAudioUpload(request: NextRequest): Promise<AudioUpload> {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_AUDIO_BYTES + 64 * 1024) {
    return { ok: false, status: 413, code: "too_large", error: "Enregistrement trop volumineux (5 Mo maximum)." };
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return { ok: false, status: 400, code: "bad_request", error: "Envoi invalide : réessaie." };
  }
  const entry = form.get("audio");
  const audio = entry instanceof File ? entry : null;
  if (!audio) return { ok: false, status: 400, code: "bad_request", error: "Aucun enregistrement reçu." };
  if (audio.size > MAX_AUDIO_BYTES) {
    return { ok: false, status: 413, code: "too_large", error: "Enregistrement trop volumineux (5 Mo maximum)." };
  }
  if (audio.size < MIN_AUDIO_BYTES) {
    return { ok: false, status: 422, code: "bad_audio", error: "Enregistrement trop court ou vide : réessaie." };
  }
  const ext = extensionFor(audio.type);
  if (!ext) return { ok: false, status: 415, code: "bad_audio", error: "Format audio non pris en charge." };
  return { ok: true, audio, ext, form };
}
