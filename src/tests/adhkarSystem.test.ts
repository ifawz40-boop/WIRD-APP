import fs from 'node:fs';
import path from 'node:path';
import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  getAdhkarItemsByCategory,
  getRecommendedAdhkarCategoryForHour
} from '../data/adhkarData';
import { ALL_SURAHS } from '../data/quranMeta';
import {
  getAdhkarCategoryProgressSummary,
  getAdhkarCountsForDate,
  incrementAdhkarItemCount,
  incrementFreeTasbihCount,
  readAdhkarProgressStore,
  resetAdhkarCategoryCounts,
  resetAdhkarItemCount,
  resetFreeTasbihCount,
  selectFreeTasbihPreset,
  toggleAdhkarFavorite
} from '../services/adhkarProgressService';
import { StorageService } from '../services/storageService';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export function runAdhkarSystemTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  test('All 8 Adhkar & Dua categories are populated with sourced, graded, vocalized items', () => {
    assert(ADHKAR_CATEGORIES.length === 8, 'Expected 8 Adhkar categories');
    assert(ADHKAR_ITEMS.length >= 25, `Expected at least 25 Adhkar items, got ${ADHKAR_ITEMS.length}`);

    const seenIds = new Set<string>();
    for (const item of ADHKAR_ITEMS) {
      assert(!seenIds.has(item.id), `Duplicate Adhkar item ID: ${item.id}`);
      seenIds.add(item.id);
      assert(item.title.trim().length > 0, `Item ${item.id} must have a title`);
      assert(item.text.trim().length > 0, `Item ${item.id} must have vocalized text`);
      assert(item.source.trim().length > 0, `Item ${item.id} must have an explicit source reference`);
      assert(item.virtue.trim().length > 0, `Item ${item.id} must have a virtue/benefit note`);
      assert(Number.isSafeInteger(item.repeatTarget) && item.repeatTarget >= 1, `Item ${item.id} must have a positive repeatTarget`);
      assert(item.categories.length >= 1, `Item ${item.id} must belong to at least one category`);

      if (item.kind === 'quran') {
        assert(typeof item.surahNumber === 'number' && item.surahNumber >= 1 && item.surahNumber <= 114, `Quranic Dhikr ${item.id} must have a valid surahNumber`);
        const surah = ALL_SURAHS[item.surahNumber - 1];
        assert(Boolean(surah), `Surah metadata must exist for ${item.id}`);
        assert(
          typeof item.startAyah === 'number' &&
          typeof item.endAyah === 'number' &&
          item.startAyah >= 1 &&
          item.endAyah >= item.startAyah &&
          item.endAyah <= surah.versesCount,
          `Quranic Dhikr ${item.id} must have valid ayah bounds within Surah ${surah.name}`
        );
      }
    }

    for (const cat of ADHKAR_CATEGORIES) {
      const catItems = getAdhkarItemsByCategory(cat.id);
      assert(catItems.length >= 2, `Category ${cat.id} must have at least 2 items`);
    }
  });

  test('Time-of-day category recommendation maps morning, evening, and night hours accurately', () => {
    assert(getRecommendedAdhkarCategoryForHour(6) === 'morning', '6 AM should recommend morning adhkar');
    assert(getRecommendedAdhkarCategoryForHour(17) === 'evening', '5 PM should recommend evening adhkar');
    assert(getRecommendedAdhkarCategoryForHour(23) === 'sleeping', '11 PM should recommend sleeping adhkar');
  });

  test('Adhkar progress counter, category completion, favorites, and free Tasbih persist and isolate per UID', () => {
    StorageService.__resetStorageForTests();
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); }
    };

    try {
      assert(StorageService.setStorageScope('user:alpha'), 'Alpha scope should activate');
      const dateKey = '2026-11-20';
      const firstResult = incrementAdhkarItemCount('adhkar-ayat-alkursi', dateKey, mockStorage);
      assert(firstResult.currentCount === 1 && firstResult.justCompleted === true, 'Ayat Al-Kursi (target 1) must complete on first count');

      const ikhlas1 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      assert(ikhlas1.currentCount === 1 && ikhlas1.justCompleted === false, 'Al-Ikhlas (target 3) must not complete on count 1');
      incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      const ikhlas3 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      assert(ikhlas3.currentCount === 3 && ikhlas3.justCompleted === true, 'Al-Ikhlas must complete on count 3');

      const summary = getAdhkarCategoryProgressSummary('morning', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(summary.completedItems === 2 && summary.totalItems >= 8, 'Morning summary must reflect 2 completed items');

      toggleAdhkarFavorite('adhkar-sayyid-istighfar', mockStorage);
      assert(readAdhkarProgressStore(mockStorage).favoriteIds.includes('adhkar-sayyid-istighfar'), 'Favorite must persist');

      selectFreeTasbihPreset(FREE_TASBIH_PRESETS[1].id, mockStorage);
      incrementFreeTasbihCount(mockStorage);
      incrementFreeTasbihCount(mockStorage);
      assert(readAdhkarProgressStore(mockStorage).freeTasbih.currentCount === 2, 'Free Tasbih count must increment');
      assert(readAdhkarProgressStore(mockStorage).freeTasbih.totalLifetimeCount === 2, 'Lifetime Tasbih count must increment');
      resetFreeTasbihCount(mockStorage);
      assert(readAdhkarProgressStore(mockStorage).freeTasbih.currentCount === 0, 'Resetting current Tasbih count sets it to 0');
      assert(readAdhkarProgressStore(mockStorage).freeTasbih.totalLifetimeCount === 2, 'Resetting current Tasbih preserves lifetime total');

      // Switch to user:beta and verify complete UID isolation
      assert(StorageService.setStorageScope('user:beta'), 'Beta scope should activate');
      assert(Object.keys(getAdhkarCountsForDate(dateKey, mockStorage)).length === 0, 'Beta must not see Alpha Adhkar counts');
      assert(readAdhkarProgressStore(mockStorage).favoriteIds.length === 0, 'Beta must not see Alpha favorite Adhkar');

      // Switch back to user:alpha and verify item & category reset
      assert(StorageService.setStorageScope('user:alpha'), 'Alpha scope should reactivate');
      resetAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      assert((getAdhkarCountsForDate(dateKey, mockStorage)['adhkar-ikhlas'] ?? 0) === 0, 'Item reset must clear count');
      resetAdhkarCategoryCounts('morning', dateKey, mockStorage);
      assert((getAdhkarCountsForDate(dateKey, mockStorage)['adhkar-ayat-alkursi'] ?? 0) === 0, 'Category reset must clear all items in category');
    } finally {
      StorageService.__resetStorageForTests();
    }
  });

  test('AdhkarView integrates verified local Quran chunks, offline audio playback, and globalAudioCoordinator', () => {
    const viewSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/adhkar/AdhkarView.tsx'), 'utf8');
    assert(viewSource.includes('loadSurahVerses(item.surahNumber!)'), 'AdhkarView must load verified local Quran chunks for Quranic adhkar');
    assert(viewSource.includes('offlineQuranAudioLibrary.resolvePlaybackSource('), 'AdhkarView must support local-first offline audio playback');
    assert(viewSource.includes("globalAudioCoordinator.register('adhkar'"), 'AdhkarView must register with globalAudioCoordinator');
    assert(viewSource.includes('item.kind === \'quran\''), 'Only verified Quranic adhkar expose recitation audio playback');
  });

  return { passed, failed };
}
