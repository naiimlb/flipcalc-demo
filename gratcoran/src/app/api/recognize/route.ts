import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { consumeQuota, quotaMessage } from "@/lib/rate-limit";
import { readAudioUpload } from "@/lib/audio";
import { transcribeArabic, TranscriptionError } from "@/lib/transcription";
import { getMatcher } from "@/lib/quran/engine";
import { present, type Recognition } from "@/lib/quran/present";
import { SURAHS } from "@/lib/quran/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export type RecognizeResponse = {
  recognition: Recognition;
  transcript: string;
  saved: boolean;
};

type ErrorBody = { error: string; code: string };

function fail(status: number, code: string, error: string) {
  return NextResponse.json<ErrorBody>({ error, code }, { status });
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Session expirée : reconnecte-toi.");

  const upload = await readAudioUpload(request);
  if (!upload.ok) return fail(upload.status, upload.code, upload.error);
  const { audio, ext } = upload;

  const quota = await consumeQuota(supabase, user.id);
  if (quota !== "ok") return fail(429, "rate_limited", quotaMessage(quota));

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
