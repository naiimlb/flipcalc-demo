/** URL du fichier audio d'un verset sur EveryAyah (format SSSAAA.mp3). */
export const AUDIO_BASE_URL = "https://everyayah.com/data";

export function ayahAudioUrl(reciterId: string, surah: number, ayah: number): string {
  if (!/^[A-Za-z0-9_.-]+$/.test(reciterId)) throw new Error(`Récitateur invalide : ${reciterId}`);
  const pad = (n: number) => String(n).padStart(3, "0");
  return `${AUDIO_BASE_URL}/${reciterId}/${pad(surah)}${pad(ayah)}.mp3`;
}
