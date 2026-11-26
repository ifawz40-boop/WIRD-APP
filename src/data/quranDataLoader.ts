import { Ayah } from '../types/quran';

// The split files are generated from completeQuranData.json before dev/build.
// Vite turns each matching JSON file into an independent lazy-loaded chunk.
const surahModules: Record<string, () => Promise<{ default: Ayah[] }>> = (() => {
  // Vite replaces this glob at build time. Node/tsx tests do not implement import.meta.glob.
  try {
    return import.meta.glob<{ default: Ayah[] }>('./quran-surahs/*.json');
  } catch {
    return {};
  }
})();
const surahCache = new Map<number, Promise<Ayah[]>>();
let quranSurahLoaderForTests: ((surahNumber: number) => Promise<Ayah[]>) | undefined;

/** Node-test adapter only; production callers must use Vite's generated per-Surah loaders. */
export function setQuranSurahLoaderForTests(
  loader?: (surahNumber: number) => Promise<Ayah[]>
): void {
  quranSurahLoaderForTests = loader;
  surahCache.clear();
}

export async function loadSurahVerses(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return [];

  const cached = surahCache.get(surahNumber);
  if (cached) return cached;

  const modulePath = './quran-surahs/' + surahNumber + '.json';
  const moduleLoader = surahModules[modulePath];
  if (!quranSurahLoaderForTests && !moduleLoader) {
    throw new Error('Missing local Quran chunk for Surah ' + surahNumber + '. Run the Quran chunk generator.');
  }

  const pending = quranSurahLoaderForTests
    ? quranSurahLoaderForTests(surahNumber).then(verses => Array.isArray(verses) ? verses : [])
    : moduleLoader!().then(module => Array.isArray(module.default) ? module.default : [])
    .catch(error => {
      surahCache.delete(surahNumber);
      throw error;
    });
  surahCache.set(surahNumber, pending);
  return pending;
}

export async function loadAyahByCoordinate(surahNumber: number, ayahNumber: number): Promise<Ayah | undefined> {
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) return undefined;
  const verses = await loadSurahVerses(surahNumber);
  return verses.find(ayah => ayah.numberInSurah === ayahNumber);
}

const QURAN_ANNOTATION_TOKEN_RE = /^[\u06D6-\u06ED\u06DE\u06E9]+$/;

/**
 * Split an ayah into reading/masking word units while preserving 100% of diacritics,
 * waqf pause signs (ۚ ۖ ۗ ۛ ۙ ۘ ۜ), sajdah (۩), and rub-el-hizb (۞) symbols.
 */
export function getAyahWords(text: string): string[] {
  const rawTokens = text.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return [];

  const merged: string[] = [];
  const leadingSymbols: string[] = [];

  for (const token of rawTokens) {
    if (QURAN_ANNOTATION_TOKEN_RE.test(token)) {
      if (merged.length > 0) {
        merged[merged.length - 1] = `${merged[merged.length - 1]} ${token}`;
      } else {
        leadingSymbols.push(token);
      }
    } else if (leadingSymbols.length > 0) {
      merged.push(`${leadingSymbols.join(' ')} ${token}`);
      leadingSymbols.length = 0;
    } else {
      merged.push(token);
    }
  }

  if (leadingSymbols.length > 0) {
    merged.push(leadingSymbols.join(' '));
  }

  return merged;
}
 
// Tanzil Simple is stored separately from the canonical Uthmani corpus and loaded per surah.
interface SimpleAyahRecord { surahNumber: number; ayahNumber: number; text: string; }
interface SimpleSurahChunk { source: string; version: string; copyright: string; license: string; sourceUrl: string; surahNumber: number; bismillahText: string | null; ayahs: SimpleAyahRecord[]; }
const simpleSurahModules: Record<string, () => Promise<{ default: SimpleSurahChunk }>> = (() => {
  // Vite replaces this glob at build time; guard Node/tsx module evaluation.
  try {
    return import.meta.glob<{ default: SimpleSurahChunk }>('./quran-simple-surahs/*.json');
  } catch {
    return {};
  }
})();
const simpleSurahCache = new Map<number, Promise<SimpleAyahRecord[]>>();

async function loadSimpleSurahTexts(surahNumber: number): Promise<SimpleAyahRecord[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) return [];
  const cached = simpleSurahCache.get(surahNumber);
  if (cached) return cached;
  const modulePath = './quran-simple-surahs/' + surahNumber + '.json';
  const loader = simpleSurahModules[modulePath];
  if (!loader) throw new Error('Missing local Tanzil Simple chunk for Surah ' + surahNumber + '. Run the Quran data generator.');
  const pending = loader()
    .then(module => Array.isArray(module.default?.ayahs) && module.default.surahNumber === surahNumber ? module.default.ayahs : [])
    .catch(error => { simpleSurahCache.delete(surahNumber); throw error; });
  simpleSurahCache.set(surahNumber, pending);
  return pending;
}

export async function loadSimpleAyahText(surahNumber: number, ayahNumber: number): Promise<string | undefined> {
  if (!Number.isInteger(ayahNumber) || ayahNumber < 1) return undefined;
  const verses = await loadSimpleSurahTexts(surahNumber);
  return verses.find(ayah => ayah.surahNumber === surahNumber && ayah.ayahNumber === ayahNumber)?.text;
}

export async function loadSimpleAyahRange(surahNumber: number, startAyah: number, endAyah = startAyah): Promise<string[]> {
  if (!Number.isInteger(startAyah) || !Number.isInteger(endAyah) || startAyah < 1 || endAyah < startAyah) return [];
  const verses = await loadSimpleSurahTexts(surahNumber);
  const selected = verses.filter(ayah => ayah.surahNumber === surahNumber && ayah.ayahNumber >= startAyah && ayah.ayahNumber <= endAyah);
  if (selected.length !== endAyah - startAyah + 1) return [];
  return selected.sort((a, b) => a.ayahNumber - b.ayahNumber).map(ayah => ayah.text);
}

/** Resolve the display spelling asynchronously while preserving the canonical Uthmani Ayah.text field. */
export async function getAyahDisplayText(ayah: Ayah): Promise<string> {
  const simpleText = await loadSimpleAyahText(ayah.surahNumber, ayah.numberInSurah);
  if (!simpleText) throw new Error('Missing verified Tanzil Simple text for ' + ayah.surahNumber + ':' + ayah.numberInSurah);
  return simpleText;
}

/** Official separate basmala text from Tanzil Simple; absent for Al-Fatihah and At-Tawbah. */
export async function loadSimpleBasmala(surahNumber: number): Promise<string | undefined> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 || surahNumber === 1 || surahNumber === 9) return undefined;
  const modulePath = './quran-simple-surahs/' + surahNumber + '.json';
  const loader = simpleSurahModules[modulePath];
  if (!loader) throw new Error('Missing local Tanzil Simple basmala for Surah ' + surahNumber);
  const module = await loader();
  if (module.default.surahNumber !== surahNumber || !module.default.bismillahText) throw new Error('Invalid Tanzil Simple basmala for Surah ' + surahNumber);
  return module.default.bismillahText;
}

/** Bounds in-memory Surah chunk Maps when the app moves to background to keep RAM usage low. */
export function trimLoadedQuranCaches(maxEntries = 24): void {
  const safeMax = Math.max(4, maxEntries);
  while (surahCache.size > safeMax) {
    const oldest = surahCache.keys().next().value;
    if (oldest === undefined) break;
    surahCache.delete(oldest);
  }
  while (simpleSurahCache.size > safeMax) {
    const oldest = simpleSurahCache.keys().next().value;
    if (oldest === undefined) break;
    simpleSurahCache.delete(oldest);
  }
}
