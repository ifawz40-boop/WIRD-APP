import type { Ayah } from '../types/quran';
import type { RuqyahAudioSession, RuqyahItem } from '../data/ruqyahData';
import { loadSurahVerses } from '../data/quranDataLoader';
import { ALL_SURAHS } from '../data/quranMeta';

export interface RuqyahVerseRange {
  start: number;
  end: number;
}

export interface RuqyahAudioAyah {
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
}

export function parseRuqyahVerseRange(value: string): RuqyahVerseRange {
  if (typeof value !== 'string') throw new Error('نطاق آيات الرقية غير صالح.');
  const match = value.trim().match(/^(\d+)\s*(?:[-–—]\s*(\d+))?$/);
  if (!match) throw new Error('نطاق آيات الرقية غير صالح.');
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
    throw new Error('نطاق آيات الرقية خارج الحدود الصحيحة.');
  }
  return { start, end };
}

export function validateRuqyahSurahChunk(surahNumber: number, verses: Ayah[]): void {
  const metadata = ALL_SURAHS[surahNumber - 1];
  if (!metadata || metadata.number !== surahNumber || !Array.isArray(verses) ||
      verses.length !== metadata.versesCount) {
    throw new Error('بيانات سورة ' + surahNumber + ' ناقصة أو غير مكتملة في المصحف المحلي المعتمد.');
  }
  const globalStart = ALL_SURAHS.slice(0, surahNumber - 1)
    .reduce((total, surah) => total + surah.versesCount, 1);
  for (let index = 0; index < verses.length; index++) {
    const ayah = verses[index];
    if (!ayah || ayah.surahNumber !== surahNumber ||
        ayah.numberInSurah !== index + 1 ||
        ayah.number !== globalStart + index ||
        typeof ayah.text !== 'string' || !ayah.text.trim()) {
      throw new Error('تعذر التحقق من سلامة تسلسل آيات سورة ' + surahNumber + ' في المصحف المحلي المعتمد.');
    }
  }
}

function validateQuranItem(item: RuqyahItem): { surahNumber: number; range: RuqyahVerseRange } {
  const surahNumber = item.surahNumber;
  if (item.type !== 'quran' || !Number.isInteger(surahNumber) ||
      surahNumber === undefined || surahNumber < 1 || surahNumber > 114 || !item.verseRange) {
    throw new Error('بيانات موضع الآيات في عنصر الرقية غير مكتملة.');
  }
  const range = parseRuqyahVerseRange(item.verseRange);
  const metadata = ALL_SURAHS[surahNumber - 1];
  if (!metadata || range.end > metadata.versesCount) {
    throw new Error('نطاق الآيات ' + surahNumber + ':' + item.verseRange + ' خارج حدود السورة في المصحف المعتمد.');
  }
  return { surahNumber, range };
}

export async function loadRuqyahSurah(surahNumber: number): Promise<Ayah[]> {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new Error('رقم السورة غير صالح لتحميل المصحف المعتمد.');
  }
  const verses = await loadSurahVerses(surahNumber);
  validateRuqyahSurahChunk(surahNumber, verses);
  return verses;
}

export async function getRuqyahAyahs(item: RuqyahItem): Promise<Ayah[]> {
  const { surahNumber, range } = validateQuranItem(item);
  const surah = await loadRuqyahSurah(surahNumber);
  const ayahs = surah.slice(range.start - 1, range.end);
  if (ayahs.length !== range.end - range.start + 1 ||
      ayahs.some((ayah, index) => ayah.numberInSurah !== range.start + index)) {
    throw new Error('تعذر التحقق من اكتمال نص آيات الرقية في المصحف المعتمد.');
  }
  return ayahs;
}

/** Non-Quran material remains synchronous; Quran text always resolves from verified local Surah chunks. */
export function getRuqyahDisplayText(item: RuqyahItem): string | Promise<string> {
  if (item.type !== 'quran') return item.text;
  return getRuqyahAyahs(item).then(ayahs => ayahs.map(ayah => `${ayah.text} ﴿${ayah.numberInSurah}﴾`).join(' '));
}

export async function getRuqyahAudioQueue(item: RuqyahItem): Promise<RuqyahAudioAyah[]> {
  const ayahs = await getRuqyahAyahs(item);
  const surahNumber = item.surahNumber!;
  return ayahs.map(ayah => ({
    surahNumber,
    ayahNumber: ayah.numberInSurah,
    globalAyahNumber: ayah.number
  }));
}

export interface RuqyahAudioQueueEntry extends RuqyahAudioAyah {
  itemId: string;
  title: string;
}

/** Preserve category item/ayah order while removing duplicate global ayahs. */
export async function getRuqyahAudioQueueForItems(items: RuqyahItem[]): Promise<RuqyahAudioQueueEntry[]> {
  const itemQueues = await Promise.all(items
    .filter(item => item.type === 'quran')
    .map(async item => ({ item, ayahs: await getRuqyahAudioQueue(item) })));
  const seenAyahs = new Set<number>();
  return itemQueues.flatMap(({ item, ayahs }) => ayahs.map(ayah => ({
    ...ayah,
    itemId: item.id,
    title: item.title
  }))).filter(entry => {
    if (seenAyahs.has(entry.globalAyahNumber)) return false;
    seenAyahs.add(entry.globalAyahNumber);
    return true;
  });
}

export interface RuqyahSessionAudioEntry extends RuqyahAudioQueueEntry {
  ayahText: string;
  surahName?: string;
  passageIndex: number;
  repeatIndex: number;
  repeatTotal: number;
}

export interface RuqyahSessionStats {
  passageCount: number;
  totalAyahCount: number;
  estimatedMinutes: number;
}

/** Pure synchronous stats calculation for a timed Audio Ruqyah session. */
export function estimateRuqyahSessionStats(
  session: RuqyahAudioSession,
  items: RuqyahItem[]
): RuqyahSessionStats {
  const byId: Record<string, RuqyahItem> = Object.create(null);
  for (const item of items) byId[item.id] = item;
  let totalAyahCount = 0;
  for (const track of session.tracks) {
    const item = byId[track.itemId];
    if (!item || item.type !== 'quran' || !item.verseRange) continue;
    const range = parseRuqyahVerseRange(item.verseRange);
    const repeat = Math.max(1, track.repeatCount ?? 1);
    totalAyahCount += (range.end - range.start + 1) * repeat;
  }
  return {
    passageCount: session.tracks.length,
    totalAyahCount,
    estimatedMinutes: session.estimatedMinutes
  };
}

/**
 * Resolve a timed Audio Ruqyah session into a sequential canonical Quran ayah queue.
 * Preserves explicit passage repetitions (e.g., Mu'awwidhat 3x) while resolving every
 * verse exclusively from verified local Surah chunks.
 */
export async function buildAudioRuqyahSessionQueue(
  session: RuqyahAudioSession,
  items: RuqyahItem[]
): Promise<{ queue: RuqyahSessionAudioEntry[]; passageStartIndices: number[] }> {
  const byId: Record<string, RuqyahItem> = Object.create(null);
  for (const item of items) byId[item.id] = item;
  const queue: RuqyahSessionAudioEntry[] = [];
  const passageStartIndices: number[] = [];

  for (let passageIndex = 0; passageIndex < session.tracks.length; passageIndex++) {
    const track = session.tracks[passageIndex];
    const item = byId[track.itemId];
    if (!item || item.type !== 'quran') {
      throw new Error('مقطع الجلسة الصوتية غير موجود في آيات الرقية المعتمدة: ' + track.itemId);
    }
    const ayahs = await getRuqyahAyahs(item);
    const repeatTotal = Math.max(1, track.repeatCount ?? 1);
    passageStartIndices.push(queue.length);

    for (let repeatIndex = 1; repeatIndex <= repeatTotal; repeatIndex++) {
      for (const ayah of ayahs) {
        queue.push({
          surahNumber: item.surahNumber!,
          ayahNumber: ayah.numberInSurah,
          globalAyahNumber: ayah.number,
          itemId: item.id,
          title: repeatTotal > 1 ? `${item.title} (${repeatIndex}/${repeatTotal})` : item.title,
          ayahText: ayah.text,
          surahName: item.surahName,
          passageIndex,
          repeatIndex,
          repeatTotal
        });
      }
    }
  }

  return { queue, passageStartIndices };
}
