import type { Metadata } from "next";
import Link from "next/link";
import { SURAHS } from "@/lib/quran/data";
import { surahInfo, versesOf } from "@/lib/quran/present";
import { getServerSupabase } from "@/lib/supabase/server";
import {
  buildPassage,
  MAX_VERSES,
  passageKey,
  passageWords,
  proposeSegments,
  validateRef,
  type PassageRef,
} from "@/lib/tajweed/analyze";
import { pratiqueHref } from "@/lib/tajweed/links";
import { passageSessions } from "@/lib/tajweed/server";
import { Practice } from "@/components/tajweed/Practice";

export const metadata: Metadata = { title: "Corriger ma récitation · Grat'Coran" };
export const dynamic = "force-dynamic";

type Search = Promise<Record<string, string | string[] | undefined>>;

const int = (v: string | string[] | undefined) => {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) ? n : null;
};

/** Passage suivant : segment suivant, puis versets suivants, puis sourate suivante. */
function nextRef(ref: PassageRef, segments: { start: number; end: number }[]): PassageRef | null {
  if (ref.wordStart != null) {
    const k = segments.findIndex((s) => s.start === ref.wordStart);
    if (k >= 0 && k + 1 < segments.length) {
      return { ...ref, wordStart: segments[k + 1].start, wordEnd: segments[k + 1].end };
    }
  }
  const surah = SURAHS[ref.surah - 1];
  const count = ref.verseEnd - ref.verseStart + 1;
  if (ref.verseEnd < surah.verses.length) {
    const from = ref.verseEnd + 1;
    return { surah: ref.surah, verseStart: from, verseEnd: Math.min(surah.verses.length, from + count - 1) };
  }
  if (ref.surah < 114) {
    const next = SURAHS[ref.surah];
    return { surah: next.id, verseStart: 1, verseEnd: Math.min(next.verses.length, MAX_VERSES) };
  }
  return null;
}

export default async function PracticePage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const ref: PassageRef = {
    surah: int(sp.s) ?? 1,
    verseStart: int(sp.from) ?? 1,
    verseEnd: int(sp.to) ?? int(sp.from) ?? 1,
    wordStart: int(sp.ws),
    wordEnd: int(sp.we),
  };
  const invalid = validateRef(SURAHS, ref);
  if (invalid) {
    return (
      <main className="pb-tabbar mx-auto max-w-md px-5 pt-8">
        <div className="glass space-y-4 rounded-3xl p-6">
          <h1 className="text-xl font-bold">Passage introuvable</h1>
          <p className="text-[15px] text-muted">{invalid}</p>
          <Link href="/tajweed" className="pressable flex h-12 items-center justify-center rounded-2xl bg-brand font-semibold text-white">
            Choisir un passage
          </Link>
        </div>
      </main>
    );
  }

  const surah = SURAHS[ref.surah - 1];
  const all = passageWords(SURAHS, ref);
  const segments = proposeSegments(all);
  const hasSegment = ref.wordStart != null && ref.wordEnd != null;

  // Passage long : on propose de le découper avant de commencer.
  if (segments.length && !hasSegment) {
    return (
      <main className="pb-tabbar mx-auto max-w-md px-5 pt-4">
        <Link href="/tajweed" className="pressable inline-flex min-h-[44px] items-center text-[15px] font-semibold text-emerald-deep dark:text-emerald">
          ‹ Tajweed
        </Link>
        <h1 className="text-[26px] font-bold tracking-tight">{surah.transliteration}</h1>
        <p className="text-[15px] text-muted">
          Ce passage compte {all.length} mots : pour bien t&apos;entraîner en 30 secondes, travaille-le par segment.
        </p>
        <ul className="mt-5 space-y-3">
          {segments.map((s, k) => (
            <li key={s.start}>
              <Link
                href={pratiqueHref({ ...ref, wordStart: s.start, wordEnd: s.end })}
                className="glass pressable flex min-h-[64px] items-center gap-3 rounded-3xl p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-brand font-bold text-white">{k + 1}</span>
                <span className="min-w-0 flex-1">
                  <span lang="ar" dir="rtl" className="quran block truncate text-right text-[22px] leading-snug">
                    {s.preview} …
                  </span>
                  <span className="block text-[13px] text-muted">Mots {s.start + 1} à {s.end + 1}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const passage = buildPassage(SURAHS, ref);
  const supabase = await getServerSupabase();
  const history = await passageSessions(supabase, passage.ref);
  const last = history[history.length - 1];
  const next = nextRef(passage.ref, segments);
  const segIndex = hasSegment ? segments.findIndex((s) => s.start === passage.ref.wordStart) : -1;

  return (
    <Practice
      key={passageKey(passage.ref)}
      passageRef={passage.ref}
      surah={surahInfo(surah)}
      verses={versesOf(surah, ref.verseStart, ref.verseEnd)}
      words={passage.words}
      rules={passage.rules}
      segmentLabel={segIndex >= 0 ? `Segment ${segIndex + 1} sur ${segments.length}` : null}
      previous={last ? { attempt: last.attempt_number, correct: last.correct_words, total: last.total_words, errors: last.errors ?? [] } : null}
      nextHref={next ? pratiqueHref(next) : null}
    />
  );
}
