/**
 * Cache audio hors ligne (Cache API). EveryAyah autorise les requêtes CORS, ce qui permet de
 * garder les fichiers et de les lire ensuite via une URL blob, sans réseau.
 */
export const AUDIO_CACHE = "hifz-audio-v1";

function cachesAvailable(): boolean {
  return typeof caches !== "undefined";
}

export async function isAudioCached(url: string): Promise<boolean> {
  if (!cachesAvailable()) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    return (await cache.match(url)) !== undefined;
  } catch {
    return false;
  }
}

/** Télécharge et garde un fichier audio (sans effet s'il est déjà en cache). Renvoie false en cas d'échec. */
export async function cacheAudio(url: string, signal?: AbortSignal): Promise<boolean> {
  if (!cachesAvailable()) return false;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    if (await cache.match(url)) return true;
    const res = await fetch(url, { mode: "cors", signal });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("audio/")) return false;
    await cache.put(url, res);
    return true;
  } catch {
    return false;
  }
}

export interface AudioSource {
  src: string;
  offline: boolean;
  release: () => void;
}

/**
 * Source à lire pour un verset : le fichier en cache si présent (URL blob), sinon l'URL distante.
 * Si `keep` est vrai, le fichier est mis en cache pour la prochaine fois.
 */
export async function resolveAudioSource(url: string, keep: boolean): Promise<AudioSource> {
  const remote: AudioSource = { src: url, offline: false, release: () => {} };
  if (!cachesAvailable()) return remote;
  try {
    const cache = await caches.open(AUDIO_CACHE);
    let hit = await cache.match(url);
    if (!hit && keep && navigator.onLine !== false) {
      if (await cacheAudio(url)) hit = await cache.match(url);
    }
    if (!hit) return remote;
    const blob = await hit.blob();
    const objectUrl = URL.createObjectURL(blob.type ? blob : new Blob([blob], { type: "audio/mpeg" }));
    return { src: objectUrl, offline: true, release: () => URL.revokeObjectURL(objectUrl) };
  } catch {
    return remote;
  }
}

export async function clearAudioCache(): Promise<void> {
  if (cachesAvailable()) await caches.delete(AUDIO_CACHE);
}

/** Nombre de fichiers audio gardés. */
export async function countCachedAudio(): Promise<number> {
  if (!cachesAvailable()) return 0;
  try {
    return (await (await caches.open(AUDIO_CACHE)).keys()).length;
  } catch {
    return 0;
  }
}
