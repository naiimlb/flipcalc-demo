import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { consumeQuota } from "@/lib/rate-limit";
import { transcribeArabic, TranscriptionError } from "@/lib/transcription";
import { getMatcher } from "@/lib/quran/engine";
import { present, type Recognition } from "@/lib/quran/present";
import { SURAHS } from "@/lib/quran/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MAX_BYTES = 5 * 1024 * 1024;
const MIN_BYTES = 1024;

export type RecognizeResponse = {
  recognition: Recognition;
  transcript: string;
  saved: boolean;
};

type ErrorBody = { error: string; code: string };

function fail(status: number, code: string, error: string) {
  return NextResponse.json<ErrorBody>({ error, code }, { status });
}

/** Extension acceptée par l'API de transcription selon le type MIME envoyé. */
function extensionFor(type: string): string | null {
  const t = type.toLowerCase();
  if (t.includes("mp4") || t.includes("m4a") || t.includes("aac")) return "mp4";
  if (t.includes("webm")) return "webm";
  if (t.includes("ogg")) return "ogg";
  if (t.includes("mpeg") || t.includes("mp3")) return "mp3";
  if (t.includes("wav")) return "wav";
  if (t.includes("flac")) return "flac";
  return null;
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Session expirée : reconnecte-toi.");

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES + 64 * 1024) {
    return fail(413, "too_large", "Enregistrement trop volumineux (5 Mo maximum).");
  }

  let audio: File | null = null;
  try {
    const form = await request.formData();
    const entry = form.get("audio");
    audio = entry instanceof File ? entry : null;
  } catch {
    return fail(400, "bad_request", "Envoi invalide : réessaie.");
  }
  if (!audio) return fail(400, "bad_request", "Aucun enregistrement reçu.");
  if (audio.size > MAX_BYTES) {
    return fail(413, "too_large", "Enregistrement trop volumineux (5 Mo maximum).");
  }
  if (audio.size < MIN_BYTES) {
    return fail(422, "bad_audio", "Enregistrement trop court ou vide : réessaie.");
  }
  const ext = extensionFor(audio.type);
  if (!ext) return fail(415, "bad_audio", "Format audio non pris en charge.");

  const quota = await consumeQuota(supabase, user.id);
  if (quota === "minute") {
    return fail(429, "rate_limited", "Trop de demandes, réessaie dans une minute.");
  }
  if (quota === "day") {
    return fail(429, "rate_limited", "Limite quotidienne atteinte : reviens demain.");
  }

  let transcript: string;
  try {
    transcript = await transcribeArabic(audio, `recitation.${ext}`);
  } catch (err) {
    if (err instanceof TranscriptionError) {
      const status =
        err.code === "quota" ? 429 : err.code === "bad_audio" ? 422 : err.code === "missing_key" ? 503 : 502;
      console.error(`[recognize] transcription : ${err.code}`);
      return fail(status, err.code, err.message);
    }
    console.error("[recognize] erreur inattendue de transcription");
    return fail(502, "provider", "Erreur de transcription : réessaie.");
  }

  const recognition = present(getMatcher().match(transcript), SURAHS);

  // Historique : seules les reconnaissances fiables (haute ou moyenne) sont enregistrées.
  let saved = false;
  if (recognition.surah && recognition.confidence !== "low") {
    const { error } = await supabase.from("recognitions").insert({
      user_id: user.id,
      surah: recognition.surah.number,
      verse_start: recognition.showVerse ? recognition.verseStart : null,
      verse_end: recognition.showVerse ? recognition.verseEnd : null,
      confidence: recognition.confidence,
      score: recognition.score,
    });
    saved = !error;
    if (error) console.error("[recognize] historique non enregistré :", error.code);
  }

  return NextResponse.json<RecognizeResponse>({ recognition, transcript, saved });
}
