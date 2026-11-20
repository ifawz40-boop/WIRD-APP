import fs from 'node:fs';
import path from 'node:path';
import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  LEGACY_ADHKAR_ITEM_ID_ALIASES,
  getAdhkarItemsByCategory,
  getAdhkarRepeatTarget,
  getRecommendedAdhkarCategoryForHour
} from '../data/adhkarData';
import { ALL_SURAHS } from '../data/quranMeta';
import {
  ADHKAR_PROGRESS_KEY,
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
      assert(/^[a-z0-9-]+$/.test(item.id), `Adhkar item ID must be ASCII kebab-case: ${item.id}`);
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
      assert(!cat.description.includes('عندوي'), `Category ${cat.id} description must not contain typos`);
    }
    const sleepingCategory = ADHKAR_CATEGORIES.find(c => c.id === 'sleeping');
    assert(sleepingCategory?.description.includes('عند الإيواء إلى الفراش') === true, 'Sleeping category description must use corrected Arabic wording');
  });

  test('Adhkar categories and category-specific repetition targets match primary Hadith sources', () => {
    const kalimat = ADHKAR_ITEMS.find(item => item.id === 'adhkar-kalimat-tammat');
    assert(Boolean(kalimat), 'adhkar-kalimat-tammat must exist');
    assert(kalimat!.categories.includes('evening'), 'adhkar-kalimat-tammat must belong to evening adhkar');
    assert(!kalimat!.categories.includes('morning'), 'adhkar-kalimat-tammat must not be classified under morning adhkar');
    assert(kalimat!.source.includes('2708') && kalimat!.source.includes('2709') && kalimat!.source.includes('3604'), 'adhkar-kalimat-tammat must cite Muslim 2708/2709 and Tirmidhi 3604');

    for (const id of ['adhkar-ikhlas', 'adhkar-falaq', 'adhkar-nas']) {
      const item = ADHKAR_ITEMS.find(entry => entry.id === id);
      assert(Boolean(item), `${id} must exist`);
      assert(getAdhkarRepeatTarget(item!, 'morning') === 3, `${id} must target 3x in morning`);
      assert(getAdhkarRepeatTarget(item!, 'evening') === 3, `${id} must target 3x in evening`);
      assert(getAdhkarRepeatTarget(item!, 'sleeping') === 3, `${id} must target 3x at sleep`);
      assert(getAdhkarRepeatTarget(item!, 'after_prayer') === 1, `${id} must target 1x after obligatory prayer`);
    }
  });

  test('Category-specific counting (1x after_prayer vs 3x morning) and legacy Arabic ID alias migrate losslessly', () => {
    StorageService.__resetStorageForTests();
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); }
    };

    try {
      assert(StorageService.setStorageScope('user:adhkar-compat'), 'Scope should activate');
      const dateKey = '2026-11-20';

      // 1. After-prayer target for Al-Ikhlas completes on first count (1/1)
      const afterPrayerTap = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'after_prayer');
      assert(
        afterPrayerTap.currentCount === 1 && afterPrayerTap.targetCount === 1 && afterPrayerTap.justCompleted === true,
        'Al-Ikhlas in after_prayer must complete on count 1'
      );
      const afterPrayerSummary = getAdhkarCategoryProgressSummary('after_prayer', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(afterPrayerSummary.completedItems === 1, 'after_prayer summary must count Al-Ikhlas as completed at 1');

      // 2. Morning target for Al-Ikhlas continues to 3/3 and is NOT downgraded if tapped again in after_prayer
      const morningSummaryBefore = getAdhkarCategoryProgressSummary('morning', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(morningSummaryBefore.completedItems === 0, 'Morning summary must not mark Al-Ikhlas complete at count 1');
      incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'morning');
      const morningTap3 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'morning');
      assert(
        morningTap3.currentCount === 3 && morningTap3.targetCount === 3 && morningTap3.justCompleted === true,
        'Al-Ikhlas in morning must complete on count 3'
      );
      const afterPrayerRetap = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'after_prayer');
      assert(
        afterPrayerRetap.currentCount === 3 && afterPrayerRetap.justCompleted === false,
        'Tapping an already-completed item in a lower-target category must not downgrade its stored count'
      );

      // 3. Backward-compatible migration of legacy Arabic-character sleep dhikr ID
      const legacyId = 'adhkar-sleep-bismika-ربي-wadatu';
      const canonicalId = LEGACY_ADHKAR_ITEM_ID_ALIASES[legacyId];
      assert(canonicalId === 'adhkar-sleep-bismika-rabbi-wadatu', 'Legacy alias map must resolve to ASCII canonical ID');

      const scopedKey = StorageService.resolveScopedKey(ADHKAR_PROGRESS_KEY);
      map.set(
        scopedKey,
        JSON.stringify({
          schemaVersion: 1,
          countsByDate: { [dateKey]: { [legacyId]: 1 } },
          favoriteIds: [legacyId],
          freeTasbih: { presetId: FREE_TASBIH_PRESETS[0].id, currentCount: 0, targetCount: 33, totalLifetimeCount: 0 }
        })
      );

      const migrated = readAdhkarProgressStore(mockStorage);
      assert(migrated.countsByDate[dateKey]?.[canonicalId] === 1, 'Legacy ID daily count must migrate to canonical ID');
      assert(migrated.countsByDate[dateKey]?.[legacyId] === undefined, 'Legacy ID key must not remain after normalization');
      assert(migrated.favoriteIds.includes(canonicalId) && !migrated.favoriteIds.includes(legacyId), 'Legacy ID favorite must migrate to canonical ID');

      // Calling mutators with legacy ID must still operate cleanly on canonical ID
      const toggledOff = toggleAdhkarFavorite(legacyId, mockStorage);
      assert(!toggledOff.favoriteIds.includes(canonicalId), 'Toggling favorite via legacy ID must toggle canonical ID');
      const resetStore = resetAdhkarItemCount(legacyId, dateKey, mockStorage);
      assert(resetStore.countsByDate[dateKey]?.[canonicalId] === undefined, 'Resetting via legacy ID must clear canonical ID');
    } finally {
      StorageService.__resetStorageForTests();
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
