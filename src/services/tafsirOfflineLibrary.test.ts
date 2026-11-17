import { ALL_SURAHS } from '../data/quranMeta';
import {
  deriveOfflineTafsirDownloadStatus,
  OFFLINE_TAFSIR_SOURCE
} from './tafsirOfflineLibrary';

function makeStoredSurah(surahNumber: number, sourceVersion: string = OFFLINE_TAFSIR_SOURCE.version) {
  const versesCount = ALL_SURAHS[surahNumber - 1]?.versesCount || 0;
  return {
    surahNumber,
    sourceVersion,
    savedAt: '2026-11-17T00:00:00.000Z',
    payload: Array.from({ length: versesCount }, (_, index) => ({
      sura: surahNumber,
      aya: index + 1,
      translation: `تفسير موثق للاختبار ${index + 1}`
    }))
  };
}

export function runOfflineTafsirLibraryTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const assert = (condition: boolean, message: string) => {
    if (!condition) throw new Error(message);
  };

  const test = (name: string, run: () => void) => {
    try {
      run();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  test('Recovers valid stored surahs when the manifest is missing after an interrupted write', () => {
    const status = deriveOfflineTafsirDownloadStatus([makeStoredSurah(1)], null);
    assert(status.downloadedSurahs === 1, 'A valid persisted surah must not be reported as zero');
    assert(status.status === 'paused' && !status.isComplete, 'A partial package without a manifest must be resumable, not complete');
  });

  test('Recovers a valid stored surah omitted from a stale manifest list', () => {
    const manifest = {
      key: 'manifest',
      sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
      downloadedSurahs: [],
      status: 'paused',
      updatedAt: '2026-11-17T00:00:00.000Z'
    };
    const status = deriveOfflineTafsirDownloadStatus([makeStoredSurah(1)], manifest);
    assert(status.downloadedSurahs === 1, 'Validated IndexedDB records must recover a manifest write gap');
  });

  test('Ignores corrupt payloads and records from another source version', () => {
    const valid = makeStoredSurah(1);
    const corrupt = {
      ...makeStoredSurah(2),
      payload: [{ sura: 2, aya: 2, translation: 'آية خارج الترتيب' }]
    };
    const stale = makeStoredSurah(3, '0.9.0');
    const status = deriveOfflineTafsirDownloadStatus([valid, corrupt, stale], null);
    assert(status.downloadedSurahs === 1, 'Only complete, coordinate-valid records from the pinned source version may count');
  });

  test('Does not report a corrupt partial package as complete when manifest says complete', () => {
    const manifest = {
      key: 'manifest',
      sourceVersion: OFFLINE_TAFSIR_SOURCE.version,
      downloadedSurahs: Array.from({ length: 114 }, (_, index) => index + 1),
      status: 'complete',
      updatedAt: '2026-11-17T00:00:00.000Z'
    };
    const status = deriveOfflineTafsirDownloadStatus([makeStoredSurah(1)], manifest);
    assert(!status.isComplete, 'Manifest alone must never establish offline completeness');
    assert(status.status === 'paused', 'Incomplete stored coverage must be shown as paused');
  });

  test('Reports an empty package as not downloaded', () => {
    const status = deriveOfflineTafsirDownloadStatus([], null);
    assert(status.downloadedSurahs === 0 && status.status === 'not_downloaded', 'Empty local storage must remain not downloaded');
  });

  return { passed, failed };
}
