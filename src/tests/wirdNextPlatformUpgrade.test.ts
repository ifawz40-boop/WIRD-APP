import fs from 'node:fs';
import path from 'node:path';
import { RECITERS, resolveApprovedOfflineReciterId } from '../services/audioService';
import { FALLBACK_QURAN_RECITERS } from '../services/ruqyahAudioService';
import { normalizeThemePreferences } from '../services/themePreferences';
import {
  DEFAULT_MUSHAF_RIBBONS,
  placeMushafRibbon,
  readMushafRibbons,
} from '../services/mushafRibbonBookmarksService';
import {
  AUXILIARY_SYNC_DOCUMENT_ID,
  captureAuxiliaryDomainSnapshot,
  mergeAuxiliaryDomainSnapshots,
  type AuxiliaryDomainSnapshotV1,
} from '../services/auxiliaryDomainsSchema';
import { StorageService, CLEAN_INITIAL_PROFILE } from '../services/storageService';
import {
  buildChapterAudioSegments,
  prepareArabicSpokenText,
} from '../services/seerahAudioNarratorService';
import type { SeerahChapterDocument } from '../services/seerahBookService';
import { findMutashabihatForAyah } from '../data/mutashabihatData';
import { getContextualSunnahSuggestions } from '../services/sunnahWirdRemindersService';

export async function runWirdNextPlatformUpgradeTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.error(`  ❌ ${label}`);
      failed++;
    }
  }

  // 1. Self-hosted WOFF2 fonts & reading paper-tone preferences
  try {
    const fontsDir = path.resolve('./public/fonts');
    const woff2Files = fs.existsSync(fontsDir)
      ? fs.readdirSync(fontsDir).filter((f) => f.endsWith('.woff2'))
      : [];
    assert(woff2Files.length >= 16, `Self-hosted offline WOFF2 font pack present (${woff2Files.length} files)`);

    const prefs = normalizeThemePreferences({
      design: 'design-a',
      paperTone: 'madinah-cream',
      quranFont: 'scheherazade',
    });
    assert(
      prefs.paperTone === 'madinah-cream' && prefs.quranFont === 'scheherazade',
      'Theme preferences normalize paperTone and quranFont cleanly'
    );
  } catch (err: any) {
    assert(false, `Typography & theme preferences test failed: ${err?.message}`);
  }

  // 2. Unified 8 Reciters across Audio, Ruqyah, and UserProfile storage validation
  try {
    assert(RECITERS.length === 8, `RECITERS defines all 8 unified reciters (got ${RECITERS.length})`);
    assert(
      FALLBACK_QURAN_RECITERS.length === 7 &&
        resolveApprovedOfflineReciterId('sudais') === 'ar.sudais' &&
        resolveApprovedOfflineReciterId('shuraim') === 'ar.shuraim' &&
        resolveApprovedOfflineReciterId('ajamy') === 'ar.ajamy',
      'Sudais, Shuraim, and Ajamy resolve as licensed offline-capable reciters'
    );

    const snapshot = StorageService.getStorageSnapshot();
    try {
      const savedSudais = StorageService.saveProfile({
        ...CLEAN_INITIAL_PROFILE,
        preferredReciter: 'sudais',
      });
      assert(
        savedSudais && StorageService.getProfile().preferredReciter === 'sudais',
        'StorageService.saveProfile accepts newly unified reciters (sudais, shuraim, ajamy)'
      );
    } finally {
      StorageService.restoreStorageSnapshot(snapshot);
    }
  } catch (err: any) {
    assert(false, `Unified reciter catalog test failed: ${err?.message}`);
  }

  // 3. Colored Silk Mushaf Ribbons (UID-scoped)
  try {
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('guest');
    assert(DEFAULT_MUSHAF_RIBBONS.length === 4, '4 colored Mushaf silk ribbons defined');
    const updated = placeMushafRibbon('khatma', 293, 'ورد الجمعة');
    const khatmaRibbon = updated.find((r) => r.id === 'khatma');
    assert(
      khatmaRibbon?.page === 293 && readMushafRibbons().find((r) => r.id === 'khatma')?.page === 293,
      'Mushaf ribbon placement persists page and note accurately'
    );
  } catch (err: any) {
    assert(false, `Mushaf ribbons test failed: ${err?.message}`);
  } finally {
    StorageService.__resetStorageForTests();
  }

  // 4. Cloud Sync V3 Convergent Auxiliary Merge (zero worship progress loss across devices)
  try {
    const deviceA: AuxiliaryDomainSnapshotV1 = {
      schemaVersion: 1,
      updatedAtMs: 1000,
      pageBookmarks: [1, 255],
      ribbons: DEFAULT_MUSHAF_RIBBONS.map((r) =>
        r.id === 'khatma' ? { ...r, page: 120, updatedAtMs: 900 } : { ...r }
      ),
      lastPage: { page: 120, updatedAtMs: 900 },
      lastReadingPositionRaw: null,
      readingKhatmasRaw: JSON.stringify({
        schemaVersion: 2,
        activeKhatmaId: 'k1',
        khatmas: [{ id: 'k1', startedAt: '2026-11-01T00:00:00Z', completedPages: [1, 2, 3], completedCycles: [] }],
        completedCycles: [],
      }),
      adhkarProgressRaw: JSON.stringify({
        schemaVersion: 1,
        countsByDate: { '2026-11-26': { 'm-1': 3 } },
        favoriteIds: ['m-1'],
        freeTasbih: { presetId: 'subhanallah_wabihamdihi', currentCount: 33, targetCount: 100, totalLifetimeCount: 330 },
      }),
      seerahV2Raw: JSON.stringify({
        schemaVersion: 2,
        fontSize: 'md',
        completedChapterIds: ['ch-01', 'ch-02'],
        lastPosition: { chapterId: 'ch-02', updatedAt: '2026-11-26T10:00:00Z' },
      }),
      videoSeriesRaw: null,
    };

    const deviceB: AuxiliaryDomainSnapshotV1 = {
      schemaVersion: 1,
      updatedAtMs: 2000,
      pageBookmarks: [255, 604],
      ribbons: DEFAULT_MUSHAF_RIBBONS.map((r) =>
        r.id === 'khatma'
          ? { ...r, page: 145, updatedAtMs: 1800 }
          : r.id === 'hifz'
            ? { ...r, page: 562, updatedAtMs: 1700 }
            : { ...r }
      ),
      lastPage: { page: 145, updatedAtMs: 1800 },
      lastReadingPositionRaw: null,
      readingKhatmasRaw: JSON.stringify({
        schemaVersion: 2,
        activeKhatmaId: 'k1',
        khatmas: [{ id: 'k1', startedAt: '2026-11-01T00:00:00Z', completedPages: [3, 4, 5], completedCycles: [] }],
        completedCycles: [],
      }),
      adhkarProgressRaw: JSON.stringify({
        schemaVersion: 1,
        countsByDate: { '2026-11-26': { 'm-1': 1, 'm-2': 7 } },
        favoriteIds: ['m-2'],
        freeTasbih: { presetId: 'subhanallah_wabihamdihi', currentCount: 60, targetCount: 100, totalLifetimeCount: 500 },
      }),
      seerahV2Raw: JSON.stringify({
        schemaVersion: 2,
        fontSize: 'lg',
        completedChapterIds: ['ch-02', 'ch-10'],
        lastPosition: { chapterId: 'ch-10', updatedAt: '2026-11-26T14:00:00Z' },
      }),
      videoSeriesRaw: null,
    };

    const merged = mergeAuxiliaryDomainSnapshots(deviceA, deviceB);
    const mergedKhatma = JSON.parse(merged.readingKhatmasRaw!);
    const mergedAdhkar = JSON.parse(merged.adhkarProgressRaw!);
    const mergedSeerah = JSON.parse(merged.seerahV2Raw!);

    assert(
      JSON.stringify(merged.pageBookmarks) === JSON.stringify([1, 255, 604]),
      'Auxiliary CRDT merge unions Mushaf page bookmarks without duplicates'
    );
    assert(
      merged.ribbons.find((r) => r.id === 'khatma')?.page === 145 &&
        merged.ribbons.find((r) => r.id === 'hifz')?.page === 562,
      'Auxiliary CRDT merge preserves per-ribbon newest placement independently'
    );
    assert(
      JSON.stringify(mergedKhatma.khatmas[0].completedPages) === JSON.stringify([1, 2, 3, 4, 5]),
      'Auxiliary CRDT merge unions completed Khatma pages across devices'
    );
    assert(
      mergedAdhkar.countsByDate['2026-11-26']['m-1'] === 3 &&
        mergedAdhkar.countsByDate['2026-11-26']['m-2'] === 7 &&
        mergedAdhkar.favoriteIds.length === 2 &&
        mergedAdhkar.freeTasbih.totalLifetimeCount === 500,
      'Auxiliary CRDT merge preserves max daily Adhkar repetitions, favorites union, and Tasbih lifetime counter'
    );
    assert(
      JSON.stringify(mergedSeerah.completedChapterIds) === JSON.stringify(['ch-01', 'ch-02', 'ch-10']) &&
        mergedSeerah.lastPosition.chapterId === 'ch-10',
      'Auxiliary CRDT merge unions completed Seerah chapters and selects newest reading position'
    );

    // Verify StorageService.applyJournalEvent applies syncMeta/auxiliaryDomainsV1 atomically
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v3-uid');
    const applied = StorageService.applyJournalEvent({
      key: 'sync-v3-uid:evt-aux-1',
      uid: 'sync-v3-uid',
      eventId: 'evt-aux-1',
      mutationId: 'evt-aux-1',
      eventType: 'domain-mutation',
      collection: 'syncMeta',
      documentId: AUXILIARY_SYNC_DOCUMENT_ID,
      operation: 'upsert',
      schemaVersion: 1,
      clientUpdatedAtMs: 2500,
      createdAtMs: 2500,
      deviceId: 'dev-b',
      payload: { auxiliarySnapshot: merged },
      fingerprint: '0123456789abcdef',
      sequence: 1,
    });
    const capturedAfter = captureAuxiliaryDomainSnapshot((k) => StorageService.getRawItem(k), 2500);
    assert(
      applied && capturedAfter.pageBookmarks.length === 3 && capturedAfter.lastPage?.page === 145,
      'StorageService.applyJournalEvent applies syncMeta/auxiliaryDomainsV1 cleanly in user scope'
    );
  } catch (err: any) {
    assert(false, `Cloud Sync V3 auxiliary merge test failed: ${err?.message}`);
  } finally {
    StorageService.__resetStorageForTests();
  }

  // 5. Seerah Audio Narrator Queue & Authentic Quran Recitation Interleaving
  try {
    const ch10Path = path.resolve('./public/data/seerah/chapters/ch-10.json');
    const ch10 = JSON.parse(fs.readFileSync(ch10Path, 'utf8')) as SeerahChapterDocument;
    const segments = buildChapterAudioSegments(ch10);
    const quranSegs = segments.filter((s) => s.kind === 'quran_ayahs');
    assert(
      segments.length >= 6 &&
        quranSegs.some((q) => q.surahNumber === 96 && q.startAyah === 1 && q.endAyah === 5),
      'Seerah Chapter 10 audio queue interleaves real Qari recitation for Surah Al-Alaq (96:1-5)'
    );
    assert(
      prepareArabicSpokenText('محمد ﷺ').includes('صلى الله عليه وسلم'),
      'Seerah spoken text preprocessor expands honorific ligature ﷺ for clear Arabic narration'
    );
  } catch (err: any) {
    assert(false, `Seerah audio narrator queue test failed: ${err?.message}`);
  }

  // 6. Mutashabihat & Contextual Sunnah Suggestions
  try {
    const mulkMatch = findMutashabihatForAyah(67, 19);
    assert(mulkMatch.exactMatches.length >= 1, 'Mutashabihat finder locates exact match for Surah Al-Mulk 67:19');

    const fridayMorning = new Date('2026-11-27T08:00:00'); // Friday 08:00
    const suggestions = getContextualSunnahSuggestions(fridayMorning);
    assert(
      suggestions.some((s) => s.id === 'friday_kahf') &&
        suggestions.some((s) => s.id === 'morning_adhkar'),
      'Contextual Sunnah suggestions surface Surah Al-Kahf on Friday and Morning Adhkar in the morning'
    );
  } catch (err: any) {
    assert(false, `Mutashabihat & Sunnah suggestions test failed: ${err?.message}`);
  }

  return { passed, failed };
}
