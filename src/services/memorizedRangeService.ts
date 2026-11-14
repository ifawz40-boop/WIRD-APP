import { ALL_SURAHS, JUZ_NAMES, TOTAL_QURAN_VERSES } from '../data/quranMeta';
import { QURAN_JUZ_STARTS } from '../data/quranNavigationIndex.generated';
import { QuranMath } from './quranMath';
import type { WirdPortion } from '../types/quran';

export interface MemorizedAyahRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export type CoverageStatus = 'none' | 'partial' | 'full';

export interface JuzDefinition {
  juzNumber: number;
  name: string;
  startSurahNumber: number;
  startSurahName: string;
  startAyah: number;
  endSurahNumber: number;
  endSurahName: string;
  endAyah: number;
  totalVerses: number;
  ranges: MemorizedAyahRange[];
}

export interface MemorizedRangeSummaryItem extends MemorizedAyahRange {
  surahName: string;
  surahTotalVerses: number;
  versesCount: number;
  isFullSurah: boolean;
}

const JUZ_STARTS_RECORD = QURAN_JUZ_STARTS as unknown as Record<
  string,
  { surahNumber: number; ayahNumber: number; page: number }
>;

function clampRange(range: MemorizedAyahRange): MemorizedAyahRange | null {
  if (
    !Number.isSafeInteger(range.surahNumber) ||
    !Number.isSafeInteger(range.startAyah) ||
    !Number.isSafeInteger(range.endAyah)
  ) {
    return null;
  }
  const surah = ALL_SURAHS.find(item => item.number === range.surahNumber);
  if (!surah) return null;
  const startAyah = Math.max(1, Math.min(surah.versesCount, range.startAyah));
  const endAyah = Math.max(1, Math.min(surah.versesCount, range.endAyah));
  if (startAyah > endAyah) return null;
  return { surahNumber: surah.number, startAyah, endAyah };
}

/**
 * Normalize and merge overlapping or contiguous memorized ayah intervals per Surah.
 */
export function mergeMemorizedRanges(ranges: MemorizedAyahRange[]): MemorizedAyahRange[] {
  const bySurah = new Map<number, Array<{ start: number; end: number }>>();

  for (const raw of ranges) {
    const valid = clampRange(raw);
    if (!valid) continue;
    const list = bySurah.get(valid.surahNumber) ?? [];
    list.push({ start: valid.startAyah, end: valid.endAyah });
    bySurah.set(valid.surahNumber, list);
  }

  const merged: MemorizedAyahRange[] = [];
  const sortedSurahs = Array.from(bySurah.keys()).sort((a, b) => a - b);

  for (const surahNumber of sortedSurahs) {
    const intervals = bySurah.get(surahNumber) ?? [];
    intervals.sort((a, b) => (a.start !== b.start ? a.start - b.start : a.end - b.end));

    const combined: Array<{ start: number; end: number }> = [];
    for (const current of intervals) {
      const last = combined[combined.length - 1];
      if (!last || current.start > last.end + 1) {
        combined.push({ ...current });
      } else {
        last.end = Math.max(last.end, current.end);
      }
    }

    for (const interval of combined) {
      merged.push({
        surahNumber,
        startAyah: interval.start,
        endAyah: interval.end,
      });
    }
  }

  return merged;
}

/**
 * Subtract a set of ayah ranges from the active memorized set without harming neighboring verses.
 */
export function subtractMemorizedRanges(
  current: MemorizedAyahRange[],
  toRemove: MemorizedAyahRange[]
): MemorizedAyahRange[] {
  const base = mergeMemorizedRanges(current);
  const removals = mergeMemorizedRanges(toRemove);
  if (removals.length === 0) return base;

  const removalsBySurah = new Map<number, Array<{ start: number; end: number }>>();
  for (const item of removals) {
    const list = removalsBySurah.get(item.surahNumber) ?? [];
    list.push({ start: item.startAyah, end: item.endAyah });
    removalsBySurah.set(item.surahNumber, list);
  }

  const result: MemorizedAyahRange[] = [];

  for (const item of base) {
    const subList = removalsBySurah.get(item.surahNumber);
    if (!subList || subList.length === 0) {
      result.push(item);
      continue;
    }

    let segments: Array<{ start: number; end: number }> = [
      { start: item.startAyah, end: item.endAyah },
    ];

    for (const rem of subList) {
      const nextSegments: Array<{ start: number; end: number }> = [];
      for (const seg of segments) {
        if (rem.end < seg.start || rem.start > seg.end) {
          nextSegments.push(seg);
          continue;
        }
        if (rem.start > seg.start) {
          nextSegments.push({ start: seg.start, end: rem.start - 1 });
        }
        if (rem.end < seg.end) {
          nextSegments.push({ start: rem.end + 1, end: seg.end });
        }
      }
      segments = nextSegments;
    }

    for (const seg of segments) {
      result.push({
        surahNumber: item.surahNumber,
        startAyah: seg.start,
        endAyah: seg.end,
      });
    }
  }

  return mergeMemorizedRanges(result);
}

/**
 * Compute exact Hafs ayah ranges for a given Juz (1..30) from canonical Juz start coordinates.
 */
export function getJuzAyahRanges(juzNumber: number): MemorizedAyahRange[] {
  if (!Number.isSafeInteger(juzNumber) || juzNumber < 1 || juzNumber > 30) {
    return [];
  }
  const startCoord = JUZ_STARTS_RECORD[String(juzNumber)];
  if (!startCoord) return [];

  const startAbs = QuranMath.getAbsoluteAyahIndex(startCoord.surahNumber, startCoord.ayahNumber);
  const endAbs =
    juzNumber === 30
      ? TOTAL_QURAN_VERSES
      : (() => {
          const nextCoord = JUZ_STARTS_RECORD[String(juzNumber + 1)];
          if (!nextCoord) return TOTAL_QURAN_VERSES;
          return QuranMath.getAbsoluteAyahIndex(nextCoord.surahNumber, nextCoord.ayahNumber) - 1;
        })();

  if (startAbs <= 0 || endAbs < startAbs) return [];
  const endCoord = QuranMath.getCoordinateFromAbsoluteIndex(endAbs);

  const ranges: MemorizedAyahRange[] = [];
  for (let s = startCoord.surahNumber; s <= endCoord.surahNumber; s++) {
    const meta = ALL_SURAHS.find(item => item.number === s);
    if (!meta) continue;
    const startAyah = s === startCoord.surahNumber ? startCoord.ayahNumber : 1;
    const endAyah = s === endCoord.surahNumber ? endCoord.ayahNumber : meta.versesCount;
    ranges.push({ surahNumber: s, startAyah, endAyah });
  }

  return ranges;
}

export const ALL_JUZ_DEFINITIONS: JuzDefinition[] = Array.from({ length: 30 }, (_, index) => {
  const juzNumber = index + 1;
  const ranges = getJuzAyahRanges(juzNumber);
  const first = ranges[0];
  const last = ranges[ranges.length - 1];
  const startSurah = ALL_SURAHS.find(s => s.number === first?.surahNumber);
  const endSurah = ALL_SURAHS.find(s => s.number === last?.surahNumber);
  const totalVerses = ranges.reduce((sum, r) => sum + (r.endAyah - r.startAyah + 1), 0);

  return {
    juzNumber,
    name: JUZ_NAMES[index] || `الجزء ${juzNumber}`,
    startSurahNumber: first?.surahNumber || 1,
    startSurahName: startSurah?.name || '',
    startAyah: first?.startAyah || 1,
    endSurahNumber: last?.surahNumber || 114,
    endSurahName: endSurah?.name || '',
    endAyah: last?.endAyah || 6,
    totalVerses,
    ranges,
  };
});

function countIntersectionVerses(
  mergedRanges: MemorizedAyahRange[],
  target: MemorizedAyahRange
): number {
  let covered = 0;
  for (const item of mergedRanges) {
    if (item.surahNumber !== target.surahNumber) continue;
    const overlapStart = Math.max(item.startAyah, target.startAyah);
    const overlapEnd = Math.min(item.endAyah, target.endAyah);
    if (overlapEnd >= overlapStart) {
      covered += overlapEnd - overlapStart + 1;
    }
  }
  return covered;
}

export function getSurahCoverageStatus(
  ranges: MemorizedAyahRange[],
  surahNumber: number
): CoverageStatus {
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  if (!surah) return 'none';
  const merged = mergeMemorizedRanges(ranges);
  const covered = countIntersectionVerses(merged, {
    surahNumber,
    startAyah: 1,
    endAyah: surah.versesCount,
  });
  if (covered <= 0) return 'none';
  if (covered >= surah.versesCount) return 'full';
  return 'partial';
}

export function getJuzCoverageStatus(
  ranges: MemorizedAyahRange[],
  juzNumber: number
): CoverageStatus {
  const def = ALL_JUZ_DEFINITIONS.find(item => item.juzNumber === juzNumber);
  if (!def || def.totalVerses <= 0) return 'none';
  const merged = mergeMemorizedRanges(ranges);
  let covered = 0;
  for (const seg of def.ranges) {
    covered += countIntersectionVerses(merged, seg);
  }
  if (covered <= 0) return 'none';
  if (covered >= def.totalVerses) return 'full';
  return 'partial';
}

export function countTotalMemorizedVerses(ranges: MemorizedAyahRange[]): number {
  const merged = mergeMemorizedRanges(ranges);
  return merged.reduce((sum, item) => sum + (item.endAyah - item.startAyah + 1), 0);
}

/**
 * Convert persisted user memorization/revision records into clean ayah ranges.
 */
export function extractMemorizedRangesFromPortions(
  portions: WirdPortion[]
): MemorizedAyahRange[] {
  const validRanges: MemorizedAyahRange[] = [];
  for (const portion of portions) {
    if (!portion || portion.status === 'not_memorized') continue;
    validRanges.push({
      surahNumber: portion.surahNumber,
      startAyah: portion.startAyah,
      endAyah: portion.endAyah,
    });
  }
  return mergeMemorizedRanges(validRanges);
}

export function summarizeMemorizedRanges(ranges: MemorizedAyahRange[]): {
  totalVerses: number;
  completeJuzs: number[];
  items: MemorizedRangeSummaryItem[];
} {
  const merged = mergeMemorizedRanges(ranges);
  const totalVerses = countTotalMemorizedVerses(merged);
  const completeJuzs = ALL_JUZ_DEFINITIONS
    .filter(def => getJuzCoverageStatus(merged, def.juzNumber) === 'full')
    .map(def => def.juzNumber);

  const items: MemorizedRangeSummaryItem[] = merged.map(range => {
    const surah = ALL_SURAHS.find(item => item.number === range.surahNumber);
    const surahTotalVerses = surah?.versesCount ?? range.endAyah;
    const versesCount = range.endAyah - range.startAyah + 1;
    return {
      ...range,
      surahName: surah?.name || `سورة ${range.surahNumber}`,
      surahTotalVerses,
      versesCount,
      isFullSurah: range.startAyah === 1 && range.endAyah === surahTotalVerses,
    };
  });

  return { totalVerses, completeJuzs, items };
}
