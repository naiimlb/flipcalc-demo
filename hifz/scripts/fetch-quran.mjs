#!/usr/bin/env node
/**
 * Récupère le texte du Coran et les métadonnées audio depuis des sources ouvertes,
 * puis les écrit dans l'app (cache statique versionné).
 *
 *   node scripts/fetch-quran.mjs [--skip-audio-check]
 *
 * Sources :
 *   - Texte arabe (rasm uthmani) : AlQuran Cloud, édition « quran-uthmani » (texte Tanzil).
 *   - Traduction française : AlQuran Cloud, édition « fr.hamidullah » (Muhammad Hamidullah).
 *   - Liste des récitateurs : EveryAyah (data/recitations.js).
 *
 * RÈGLE : le texte arabe n'est jamais réécrit. Seules deux opérations techniques sont faites,
 * chacune vérifiée, et le script échoue au moindre écart :
 *   1. Suppression du caractère invisible U+FEFF (BOM) présent en tête du verset 1:1.
 *   2. AlQuran Cloud colle la basmala au début du verset 1 des sourates 2 à 114 (sauf 9).
 *      Elle est retirée seulement si le préfixe est identique au verset 1:1 récupéré
 *      (ou à sa variante Tanzil avec chadda sur le bā', présente en 95 et 97, dérivée de 1:1),
 *      suivi d'une espace. La basmala est alors affichée au-dessus de la sourate.
 *
 * Sorties :
 *   - public/quran/surah/NNN.json        (une sourate par fichier, chargée à la demande)
 *   - src/lib/quran/generated/quran-index.json  (métadonnées, empreintes SHA-256, récitateurs)
 */
import { createHash } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SURAH_DIR = join(ROOT, "public", "quran", "surah");
const INDEX_FILE = join(ROOT, "src", "lib", "quran", "generated", "quran-index.json");

const API = "https://api.alquran.cloud/v1";
const TEXT_EDITION = "quran-uthmani";
const TRANSLATION_EDITION = "fr.hamidullah";
const EVERYAYAH = "https://everyayah.com/data";

const EXPECTED_SURAHS = 114;
const EXPECTED_AYAHS = 6236;
const BOM = "﻿";
const SHADDA = "ّ";

/** Récitateurs proposés (dossiers EveryAyah, lecture Hafs). Le premier est celui par défaut. */
const RECITERS = [
  { id: "Alafasy_128kbps", name: "Mishary Rashid Alafasy", style: "murattal" },
  { id: "Husary_128kbps", name: "Mahmoud Khalil Al-Husary", style: "murattal" },
  { id: "Husary_Muallim_128kbps", name: "Al-Husary (mode enseignement)", style: "enseignement" },
  { id: "Minshawy_Murattal_128kbps", name: "Mohamed Siddiq Al-Minshawi", style: "murattal" },
  { id: "Abdul_Basit_Murattal_192kbps", name: "Abdul Basit Abdul Samad", style: "murattal" },
  { id: "Abdurrahmaan_As-Sudais_192kbps", name: "Abdur-Rahman As-Sudais", style: "murattal" },
  { id: "Saood_ash-Shuraym_128kbps", name: "Saoud Ash-Shuraim", style: "murattal" },
  { id: "MaherAlMuaiqly128kbps", name: "Maher Al-Muaiqly", style: "murattal" },
  { id: "Abu_Bakr_Ash-Shaatree_128kbps", name: "Abu Bakr Ash-Shatri", style: "murattal" },
  { id: "Muhammad_Ayyoub_128kbps", name: "Muhammad Ayyub", style: "murattal" },
  { id: "Hudhaify_128kbps", name: "Ali Al-Hudhaify", style: "murattal" },
  { id: "Yasser_Ad-Dussary_128kbps", name: "Yasser Ad-Dossari", style: "murattal" },
  { id: "Abdullah_Basfar_192kbps", name: "Abdullah Basfar", style: "murattal" },
  { id: "Muhammad_Jibreel_128kbps", name: "Muhammad Jibreel", style: "murattal" },
  { id: "Nasser_Alqatami_128kbps", name: "Nasser Al-Qatami", style: "murattal" },
];

const skipAudioCheck = process.argv.includes("--skip-audio-check");

class FetchError extends Error {}

function fail(message) {
  throw new Error(`Validation : ${message}`);
}

async function fetchWithRetry(url, { attempts = 4, timeoutMs = 60_000, method = "GET" } = {}) {
  let lastError;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { method, signal: AbortSignal.timeout(timeoutMs) });
      if (res.status >= 500 || res.status === 429) throw new FetchError(`HTTP ${res.status} sur ${url}`);
      return res;
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        const delay = 1000 * 2 ** i;
        console.warn(`  Échec (${error.message}), nouvel essai dans ${delay / 1000} s…`);
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

async function fetchJson(url) {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new FetchError(`HTTP ${res.status} sur ${url}`);
  return res.json();
}

async function fetchEdition(edition) {
  console.log(`→ ${API}/quran/${edition}`);
  const body = await fetchJson(`${API}/quran/${edition}`);
  if (body.code !== 200 || body.status !== "OK") fail(`réponse inattendue pour ${edition}`);
  if (body.data?.edition?.identifier !== edition) fail(`édition reçue ≠ ${edition}`);
  const surahs = body.data.surahs;
  if (!Array.isArray(surahs) || surahs.length !== EXPECTED_SURAHS) fail(`${edition} : 114 sourates attendues`);
  const total = surahs.reduce((n, s) => n + s.ayahs.length, 0);
  if (total !== EXPECTED_AYAHS) fail(`${edition} : ${EXPECTED_AYAHS} versets attendus, ${total} reçus`);
  surahs.forEach((s, i) => {
    if (s.number !== i + 1) fail(`${edition} : sourates dans le désordre`);
    s.ayahs.forEach((a, j) => {
      if (a.numberInSurah !== j + 1) fail(`${edition} : versets dans le désordre en ${s.number}`);
      if (typeof a.text !== "string" || a.text.length === 0) fail(`${edition} : texte vide en ${s.number}:${j + 1}`);
    });
  });
  return body.data;
}

/** Applique les deux seules opérations autorisées sur le texte arabe (voir en-tête). */
function prepareArabic(surahs) {
  const bomCount = surahs.flatMap((s) => s.ayahs).filter((a) => a.text.includes(BOM)).length;
  const first = surahs[0].ayahs[0].text;
  if (bomCount > 1 || (bomCount === 1 && !first.startsWith(BOM))) fail("BOM inattendu ailleurs qu'en 1:1");
  const basmala = first.replace(BOM, "");
  if (basmala.includes(BOM) || basmala !== basmala.trim()) fail("verset 1:1 inattendu");

  // Variante Tanzil : chadda ajoutée sur la première lettre (ب), dérivée du verset 1:1.
  const basmalaShadda = basmala.slice(0, 1) + SHADDA + basmala.slice(1);
  const accepted = [basmala + " ", basmalaShadda + " "];

  return {
    basmala,
    surahs: surahs.map((s) => {
      const ayahs = s.ayahs.map((a) => ({ ...a, text: s.number === 1 && a.numberInSurah === 1 ? basmala : a.text }));
      let hasBasmala = false;
      if (s.number !== 1 && s.number !== 9) {
        const prefix = accepted.find((p) => ayahs[0].text.startsWith(p));
        if (!prefix) fail(`basmala attendue en tête de ${s.number}:1, préfixe non reconnu`);
        const rest = ayahs[0].text.slice(prefix.length);
        if (rest.length === 0 || rest !== rest.trim()) fail(`verset ${s.number}:1 vide ou mal formé après séparation`);
        ayahs[0] = { ...ayahs[0], text: rest };
        hasBasmala = true;
      } else if (s.number === 9 && accepted.some((p) => ayahs[0].text.startsWith(p))) {
        fail("la sourate 9 ne doit pas commencer par la basmala");
      }
      for (const a of ayahs) {
        if (a.text !== a.text.trim()) fail(`espaces en bord de verset ${s.number}:${a.numberInSurah}`);
        if (a.text.includes(BOM)) fail(`BOM restant en ${s.number}:${a.numberInSurah}`);
      }
      return { ...s, ayahs, hasBasmala };
    }),
  };
}

async function fetchReciters() {
  console.log(`→ ${EVERYAYAH}/recitations.js`);
  const res = await fetchWithRetry(`${EVERYAYAH}/recitations.js`);
  if (!res.ok) throw new FetchError(`HTTP ${res.status} sur recitations.js`);
  const list = JSON.parse(await res.text());
  const known = new Map(
    Object.entries(list)
      .filter(([k]) => k !== "ayahCount")
      .map(([, v]) => [v.subfolder, v]),
  );
  const reciters = [];
  for (const r of RECITERS) {
    const entry = known.get(r.id);
    if (!entry) {
      if (r === RECITERS[0]) fail(`récitateur par défaut ${r.id} absent d'EveryAyah`);
      console.warn(`  Récitateur ignoré (absent de la liste EveryAyah) : ${r.id}`);
      continue;
    }
    if (!skipAudioCheck) {
      const ok = await Promise.all(
        ["001001", "114006"].map(async (file) => {
          const head = await fetchWithRetry(`${EVERYAYAH}/${r.id}/${file}.mp3`, { method: "HEAD", timeoutMs: 20_000 });
          return head.ok && (head.headers.get("content-type") ?? "").startsWith("audio/");
        }),
      );
      if (!ok.every(Boolean)) {
        if (r === RECITERS[0]) fail(`audio indisponible pour le récitateur par défaut ${r.id}`);
        console.warn(`  Récitateur ignoré (audio introuvable) : ${r.id}`);
        continue;
      }
    }
    reciters.push({ id: r.id, name: r.name, style: r.style, bitrate: entry.bitrate });
  }
  return reciters;
}

const sha256 = (s) => createHash("sha256").update(s).digest("hex");
const pad3 = (n) => String(n).padStart(3, "0");

async function main() {
  const [text, translation, reciters] = await Promise.all([
    fetchEdition(TEXT_EDITION),
    fetchEdition(TRANSLATION_EDITION),
    fetchReciters(),
  ]);

  translation.surahs.forEach((s, i) => {
    if (s.ayahs.length !== text.surahs[i].ayahs.length) fail(`traduction désalignée en sourate ${s.number}`);
  });

  const { basmala, surahs } = prepareArabic(text.surahs);
  const fetchedAt = new Date().toISOString();

  let globalNumber = 0;
  const files = [];
  const index = surahs.map((s, i) => {
    const ayahs = s.ayahs.map((a, j) => {
      globalNumber++;
      if (a.number !== globalNumber) fail(`numérotation globale inattendue en ${s.number}:${j + 1}`);
      return {
        n: a.numberInSurah,
        g: a.number,
        ar: a.text,
        fr: translation.surahs[i].ayahs[j].text,
        juz: a.juz,
        page: a.page,
        ...(a.sajda ? { sajda: true } : {}),
      };
    });
    const body = JSON.stringify({ number: s.number, basmala: s.hasBasmala, ayahs });
    files.push({ name: `${pad3(s.number)}.json`, body });
    return {
      number: s.number,
      nameAr: s.name,
      transliteration: s.englishName,
      revelation: s.revelationType === "Meccan" ? "meccan" : "medinan",
      ayahCount: s.ayahs.length,
      firstAyah: s.ayahs[0].number,
      sha256: sha256(body),
      bytes: Buffer.byteLength(body),
    };
  });

  const indexJson = {
    schema: 1,
    fetchedAt,
    sources: {
      text: { provider: "AlQuran Cloud", edition: TEXT_EDITION, url: `${API}/quran/${TEXT_EDITION}`, origin: "Tanzil Project (tanzil.net)" },
      translation: { provider: "AlQuran Cloud", edition: TRANSLATION_EDITION, url: `${API}/quran/${TRANSLATION_EDITION}`, author: "Muhammad Hamidullah" },
      audio: { provider: "EveryAyah", url: `${EVERYAYAH}/recitations.js` },
    },
    totals: { surahs: EXPECTED_SURAHS, ayahs: EXPECTED_AYAHS },
    basmala,
    defaultReciter: reciters[0].id,
    reciters,
    surahs: index,
  };

  // Écriture atomique : tout dans un dossier temporaire, puis remplacement.
  const tmp = `${SURAH_DIR}.tmp`;
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  await Promise.all(files.map((f) => writeFile(join(tmp, f.name), f.body)));
  await rm(SURAH_DIR, { recursive: true, force: true });
  await rename(tmp, SURAH_DIR);
  await mkdir(dirname(INDEX_FILE), { recursive: true });
  await writeFile(INDEX_FILE, `${JSON.stringify(indexJson, null, 2)}\n`);

  const totalBytes = index.reduce((n, s) => n + s.bytes, 0);
  console.log(
    `✓ ${index.length} sourates, ${globalNumber} versets, ${(totalBytes / 1024).toFixed(0)} Ko, ${reciters.length} récitateurs.`,
  );
}

main().catch((error) => {
  console.error(`✗ ${error.message}`);
  process.exit(1);
});
