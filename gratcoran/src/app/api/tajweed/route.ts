import { NextResponse, type NextRequest } from "next/server";
import { getServerSupabase } from "@/lib/supabase/server";
import { consumeQuota, quotaMessage } from "@/lib/rate-limit";
import { readAudioUpload } from "@/lib/audio";
import { transcribeArabicDetailed, transcriptionFailure } from "@/lib/transcription";
import { SURAHS } from "@/lib/quran/data";
import { analyzeRecitation, buildPassage, validateRef, type Analysis, type PassageRef, type TajweedError } from "@/lib/tajweed/analyze";
import { noticeAccepted, passageSessions } from "@/lib/tajweed/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export type PreviousAttempt = { attempt: number; correct: number; total: number; errors: TajweedError[] };

export type TajweedResponse = {
  analysis: Analysis;
  /** Numéro de cet essai (null s'il n'a pas été compté). */
  attempt: number | null;
  /** Essai précédent sur le même passage, pour la comparaison. */
  previous: PreviousAttempt | null;
  saved: boolean;
};

function fail(status: number, code: string, error: string) {
  return NextResponse.json({ error, code }, { status });
}

function intField(form: FormData, name: string): number | null {
  const v = form.get(name);
  if (typeof v !== "string" || v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : NaN;
}

export async function POST(request: NextRequest) {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(401, "unauthorized", "Session expirée : reconnecte-toi.");
  if (!(await noticeAccepted(supabase))) {
    return fail(403, "notice", "Lis et accepte l'avertissement de l'onglet Tajweed avant de commencer.");
  }

  const upload = await readAudioUpload(request);
  if (!upload.ok) return fail(upload.status, upload.code, upload.error);
  const { audio, ext, form } = upload;

  const ref: PassageRef = {
    surah: intField(form, "surah") ?? NaN,
    verseStart: intField(form, "verseStart") ?? NaN,
    verseEnd: intField(form, "verseEnd") ?? NaN,
    wordStart: intField(form, "wordStart"),
    wordEnd: intField(form, "wordEnd"),
  };
  const invalid = validateRef(SURAHS, ref);
  if (invalid || Number.isNaN(ref.wordStart) || Number.isNaN(ref.wordEnd)) {
    return fail(400, "bad_passage", invalid ?? "Segment invalide.");
  }
  const passage = buildPassage(SURAHS, ref);

  const quota = await consumeQuota(supabase, user.id, "tajweed");
  if (quota !== "ok") return fail(429, "rate_limited", quotaMessage(quota));

  let transcript;
  try {
    transcript = await transcribeArabicDetailed(audio, `recitation.${ext}`);
  } catch (err) {
    const f = transcriptionFailure(err);
    console.error(`[tajweed] transcription : ${f.code}`);
    return fail(f.status, f.code, f.message);
  }

  const analysis = analyzeRecitation(passage.words, transcript.text, { noSpeech: transcript.noSpeech });
  const history = await passageSessions(supabase, passage.ref);
  const last = history[history.length - 1];
  const previous: PreviousAttempt | null = last
    ? { attempt: last.attempt_number, correct: last.correct_words, total: last.total_words, errors: last.errors ?? [] }
    : null;

  // Seuls les essais exploitables sont enregistrés (un audio incompris n'est pas compté).
  let saved = false;
  let attempt: number | null = null;
  if (analysis.status === "ok") {
    attempt = (last?.attempt_number ?? 0) + 1;
    const { error } = await supabase.from("tajweed_sessions").insert({
      user_id: user.id,
      surah: passage.ref.surah,
      verse_start: passage.ref.verseStart,
      verse_end: passage.ref.verseEnd,
      word_start: passage.ref.wordStart ?? null,
      word_end: passage.ref.wordEnd ?? null,
      attempt_number: attempt,
      correct_words: analysis.correct,
      total_words: analysis.total,
      errors: analysis.errors,
    });
    saved = !error;
    if (error) console.error("[tajweed] essai non enregistré :", error.code);
  }

  return NextResponse.json<TajweedResponse>({ analysis, attempt, previous, saved });
}
