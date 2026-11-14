import { TOTAL_QURAN_VERSES } from '../data/quranMeta';
import type { WirdPortion } from '../types/quran';
import {
  ALL_JUZ_DEFINITIONS,
  countTotalMemorizedVerses,
  extractMemorizedRangesFromPortions,
  getJuzAyahRanges,
  getJuzCoverageStatus,
  getSurahCoverageStatus,
  mergeMemorizedRanges,
  subtractMemorizedRanges,
  summarizeMemorizedRanges,
} from './memorizedRangeService';

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export function runMemorizedRangeServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: unknown) {
      failed++;
      console.error(`  ❌ ${name}:`, error instanceof Error ? error.message : error);
    }
  };

  test('All 30 Hafs Juz definitions sum to exactly 6236 ayahs with no overlaps', () => {
    const allRanges = ALL_JUZ_DEFINITIONS.flatMap(j => j.ranges);
    const rawSum = ALL_JUZ_DEFINITIONS.reduce((acc, j) => acc + j.totalVerses, 0);
    assert(rawSum === TOTAL_QURAN_VERSES, `Expected 6236 raw ayahs across 30 Juzs, got ${rawSum}`);
    const mergedCount = countTotalMemorizedVerses(allRanges);
    assert(mergedCount === TOTAL_QURAN_VERSES, `Expected 6236 unique ayahs across 30 Juzs, got ${mergedCount}`);
  });

  test('Juz 1 splits Al-Baqarah accurately at ayah 141 and Juz 2 resumes at 142..252', () => {
    const juz1 = getJuzAyahRanges(1);
    assert(juz1.length === 2, 'Juz 1 must contain 2 Surah segments');
    assert(
      juz1[0].surahNumber === 1 && juz1[0].startAyah === 1 && juz1[0].endAyah === 7,
      'Juz 1 first segment must be Al-Fatihah 1..7'
    );
    assert(
      juz1[1].surahNumber === 2 && juz1[1].startAyah === 1 && juz1[1].endAyah === 141,
      'Juz 1 second segment must be Al-Baqarah 1..141'
    );

    const juz2 = getJuzAyahRanges(2);
    assert(
      juz2.length === 1 && juz2[0].surahNumber === 2 && juz2[0].startAyah === 142 && juz2[0].endAyah === 252,
      'Juz 2 must be Al-Baqarah 142..252'
    );
  });

  test('Juz 30 covers An-Naba 1..40 through An-Nas 1..6', () => {
    const juz30 = getJuzAyahRanges(30);
    assert(juz30.length === 37, `Expected 37 Surahs in Juz 30, got ${juz30.length}`);
    assert(juz30[0].surahNumber === 78 && juz30[0].startAyah === 1 && juz30[0].endAyah === 40, 'Juz 30 starts with An-Naba');
    assert(juz30[36].surahNumber === 114 && juz30[36].startAyah === 1 && juz30[36].endAyah === 6, 'Juz 30 ends with An-Nas');
  });

  test('Overlapping and contiguous ranges within the same Surah merge cleanly', () => {
    const merged = mergeMemorizedRanges([
      { surahNumber: 2, startAyah: 1, endAyah: 50 },
      { surahNumber: 2, startAyah: 40, endAyah: 100 },
      { surahNumber: 2, startAyah: 101, endAyah: 141 },
    ]);
    assert(merged.length === 1, `Expected 1 merged range, got ${merged.length}`);
    assert(merged[0].startAyah === 1 && merged[0].endAyah === 141, 'Merged range should span 1..141');
  });

  test('Subtracting Juz 1 preserves Juz 2 ayahs in Al-Baqarah intact', () => {
    const juz1And2 = mergeMemorizedRanges([...getJuzAyahRanges(1), ...getJuzAyahRanges(2)]);
    assert(getJuzCoverageStatus(juz1And2, 1) === 'full', 'Juz 1 should be full');
    assert(getJuzCoverageStatus(juz1And2, 2) === 'full', 'Juz 2 should be full');
    assert(getSurahCoverageStatus(juz1And2, 2) === 'partial', 'Al-Baqarah 1..252 is partial');

    const afterRemovingJuz1 = subtractMemorizedRanges(juz1And2, getJuzAyahRanges(1));
    assert(getJuzCoverageStatus(afterRemovingJuz1, 1) === 'none', 'Juz 1 must be cleared');
    assert(getJuzCoverageStatus(afterRemovingJuz1, 2) === 'full', 'Juz 2 must remain full');
    assert(
      afterRemovingJuz1.length === 1 && afterRemovingJuz1[0].surahNumber === 2 && afterRemovingJuz1[0].startAyah === 142 && afterRemovingJuz1[0].endAyah === 252,
      'Remaining range must equal Al-Baqarah 142..252'
    );
  });

  test('extractMemorizedRangesFromPortions excludes not_memorized and merges duplicates', () => {
    const mockPortions: WirdPortion[] = [
      {
        id: 'p1',
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 1,
        endAyah: 15,
        status: 'stable',
        nextDueDate: '2026-11-15',
        intervalDays: 7,
        easeFactor: 2.5,
        repetitionCount: 3,
      },
      {
        id: 'p2',
        type: 'passage',
        surahNumber: 67,
        surahName: 'الملك',
        startAyah: 16,
        endAyah: 30,
        status: 'recently_memorized',
        nextDueDate: '2026-11-15',
        intervalDays: 2,
        easeFactor: 2.5,
        repetitionCount: 1,
      },
      {
        id: 'p3',
        type: 'surah',
        surahNumber: 112,
        surahName: 'الإخلاص',
        startAyah: 1,
        endAyah: 4,
        status: 'not_memorized',
        nextDueDate: '2026-11-15',
        intervalDays: 0,
        easeFactor: 2.5,
        repetitionCount: 0,
      },
    ];

    const extracted = extractMemorizedRangesFromPortions(mockPortions);
    assert(extracted.length === 1, 'Expected Mulk segments to merge into 1 and not_memorized to be excluded');
    assert(extracted[0].surahNumber === 67 && extracted[0].startAyah === 1 && extracted[0].endAyah === 30, 'Mulk 1..30 expected');

    const summary = summarizeMemorizedRanges(extracted);
    assert(summary.totalVerses === 30, 'Summary total verses should equal 30');
    assert(summary.items[0].isFullSurah === true, 'Al-Mulk 1..30 should be recognized as full Surah');
  });

  return { passed, failed };
}
