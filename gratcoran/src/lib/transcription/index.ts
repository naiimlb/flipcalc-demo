import "server-only";

export type TranscriptionErrorCode =
  | "missing_key"
  | "invalid_key"
  | "quota"
  | "bad_audio"
  | "provider";

export class TranscriptionError extends Error {
  constructor(
    public readonly code: TranscriptionErrorCode,
    message: string,
  ) {
    super(message);
  }
}

type Provider = {
  name: string;
  envKey: string;
  endpoint: string;
  defaultModel: string;
};

const PROVIDERS: Record<string, Provider> = {
  groq: {
    name: "Groq",
    envKey: "GROQ_API_KEY",
    endpoint: "https://api.groq.com/openai/v1/audio/transcriptions",
    defaultModel: "whisper-large-v3",
  },
  openai: {
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
    defaultModel: "whisper-1",
  },
};

function provider(): Provider {
  const id = (process.env.TRANSCRIPTION_PROVIDER ?? "groq").trim().toLowerCase();
  const p = PROVIDERS[id];
  if (!p) {
    throw new TranscriptionError(
      "provider",
      `TRANSCRIPTION_PROVIDER inconnu (« ${id} ») : utilise « groq » ou « openai ».`,
    );
  }
  return p;
}

export type DetailedTranscript = {
  text: string;
  words: { word: string; start: number; end: number }[];
  /** Vrai si Whisper estime qu'il n'y a presque pas de parole dans l'audio. */
  noSpeech: boolean;
};

type WhisperVerbose = {
  text?: string;
  words?: { word: string; start: number; end: number }[];
  segments?: { no_speech_prob?: number; avg_logprob?: number }[];
};

/**
 * Appel à l'API de transcription. La clé d'API n'est lue que côté serveur et
 * n'apparaît jamais dans les messages d'erreur ni dans les journaux.
 *
 * Aucun « prompt » n'est envoyé : donner le texte attendu à Whisper biaiserait la
 * transcription vers le texte correct et masquerait les erreurs de récitation.
 */
async function requestTranscription(audio: Blob, filename: string, verbose: boolean): Promise<WhisperVerbose> {
  const p = provider();
  const apiKey = process.env[p.envKey]?.trim();
  if (!apiKey) {
    throw new TranscriptionError(
      "missing_key",
      `Clé ${p.name} absente : ajoute la variable d'environnement ${p.envKey} sur Vercel puis redéploie.`,
    );
  }

  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", process.env.TRANSCRIPTION_MODEL?.trim() || p.defaultModel);
  form.append("language", "ar");
  form.append("temperature", "0");
  if (verbose) {
    form.append("response_format", "verbose_json");
    form.append("timestamp_granularities[]", "word");
    form.append("timestamp_granularities[]", "segment");
  } else {
    form.append("response_format", "json");
  }

  let res: Response;
  try {
    res = await fetch(p.endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(25_000),
    });
  } catch {
    throw new TranscriptionError(
      "provider",
      `Le service de transcription (${p.name}) ne répond pas. Réessaie dans un instant.`,
    );
  }

  if (res.status === 401 || res.status === 403) {
    throw new TranscriptionError(
      "invalid_key",
      `Clé ${p.name} refusée : vérifie la valeur de ${p.envKey} sur Vercel.`,
    );
  }
  if (res.status === 429) {
    throw new TranscriptionError("quota", "Trop de demandes, réessaie dans une minute.");
  }
  if (res.status === 400 || res.status === 413 || res.status === 415) {
    throw new TranscriptionError(
      "bad_audio",
      "L'enregistrement n'a pas pu être lu. Réessaie en parlant un peu plus longtemps.",
    );
  }
  if (!res.ok) {
    throw new TranscriptionError(
      "provider",
      `Erreur du service de transcription (${p.name}, code ${res.status}). Réessaie.`,
    );
  }
  return (await res.json()) as WhisperVerbose;
}

/** Transcription simple (reconnaissance de sourate). */
export async function transcribeArabic(audio: Blob, filename: string): Promise<string> {
  const data = await requestTranscription(audio, filename, false);
  return (data.text ?? "").trim();
}

/** Transcription détaillée (correcteur de tajweed) : mots horodatés et indice de non-parole. */
export async function transcribeArabicDetailed(audio: Blob, filename: string): Promise<DetailedTranscript> {
  const data = await requestTranscription(audio, filename, true);
  const segments = data.segments ?? [];
  const noSpeech =
    segments.length > 0 &&
    segments.every((s) => (s.no_speech_prob ?? 0) > 0.6 || (s.avg_logprob ?? 0) < -1.5);
  return { text: (data.text ?? "").trim(), words: data.words ?? [], noSpeech };
}

/** Code HTTP et message à renvoyer pour une erreur de transcription. */
export function transcriptionFailure(err: unknown): { status: number; code: string; message: string } {
  if (err instanceof TranscriptionError) {
    const status =
      err.code === "quota" ? 429 : err.code === "bad_audio" ? 422 : err.code === "missing_key" ? 503 : 502;
    return { status, code: err.code, message: err.message };
  }
  return { status: 502, code: "provider", message: "Erreur de transcription : réessaie." };
}
