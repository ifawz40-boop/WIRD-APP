import fs from 'node:fs';
import path from 'node:path';
import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  LEGACY_ADHKAR_ITEM_ID_ALIASES,
  getAdhkarCategoriesByGroup,
  getAdhkarItemsByCategory,
  getAdhkarRepeatTarget,
  getRecommendedAdhkarCategoryForHour
} from '../data/adhkarData';
import { ALL_SURAHS } from '../data/quranMeta';
import {
  ADHKAR_PROGRESS_KEY,
  getAdhkarCategoryProgressSummary,
  getAdhkarCountsForDate,
  getAdhkarRemainingCount,
  getOverallDailyAdhkarSummary,
  incrementAdhkarItemCount,
  incrementFreeTasbihCount,
  readAdhkarProgressStore,
  resetAdhkarCategoryCounts,
  resetAdhkarItemCount,
  resetFreeTasbihCount,
  selectFreeTasbihPreset,
  setFreeTasbihTarget,
  toggleAdhkarFavorite,
  updateAdhkarReadingPrefs
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

  test('All 18 Hisn al-Muslim & Duas categories are populated with 115+ sourced, graded, vocalized items', () => {
    assert(ADHKAR_CATEGORIES.length === 18, `Expected 18 Adhkar categories, got ${ADHKAR_CATEGORIES.length}`);
    assert(ADHKAR_ITEMS.length >= 115, `Expected at least 115 Adhkar items, got ${ADHKAR_ITEMS.length}`);

    assert(getAdhkarCategoriesByGroup('daily_adhkar').length === 6, 'Expected 6 daily adhkar categories');
    assert(getAdhkarCategoriesByGroup('occasion_adhkar').length === 9, 'Expected 9 occasion adhkar categories');
    assert(getAdhkarCategoriesByGroup('duas').length === 3, 'Expected 3 dedicated dua categories');

    const seenIds = new Set<string>();
    const validCatIds = new Set(ADHKAR_CATEGORIES.map(c => c.id));

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
      for (const cat of item.categories) {
        assert(validCatIds.has(cat), `Item ${item.id} references unknown category ${cat}`);
      }

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
      assert(catItems.length >= 5, `Category ${cat.id} must have at least 5 items, got ${catItems.length}`);
      assert(!cat.description.includes('عندوي'), `Category ${cat.id} description must not contain typos`);
    }
    const sleepingCategory = ADHKAR_CATEGORIES.find(c => c.id === 'sleeping');
    assert(sleepingCategory?.description.includes('عند الإيواء إلى الفراش') === true, 'Sleeping category description must use corrected Arabic wording');
  });

  test('Adhkar categories and category-specific repetition targets match primary Hadith sources', () => {
    const kalimat = ADHKAR_ITEMS.find(item => item.id === 'adhkar-kalimat-tammat');
    assert(Boolean(kalimat), 'adhkar-kalimat-tammat must exist');
    assert(kalimat!.categories.includes('evening'), 'adhkar-kalimat-tammat must belong to evening adhkar');
    assert(kalimat!.categories.includes('travel'), 'adhkar-kalimat-tammat must also belong to travel (stopping at a place)');
    assert(!kalimat!.categories.includes('morning'), 'adhkar-kalimat-tammat must not be classified under morning adhkar');
    assert(getAdhkarRepeatTarget(kalimat!, 'evening') === 3, 'adhkar-kalimat-tammat must target 3x in evening');
    assert(getAdhkarRepeatTarget(kalimat!, 'travel') === 1, 'adhkar-kalimat-tammat must target 1x when stopping at a place in travel');
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

  test('Category-specific counting (1x after_prayer vs 3x morning), countdown math, and legacy Arabic ID alias migrate losslessly', () => {
    StorageService.__resetStorageForTests();
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); }
    };

    try {
      assert(StorageService.setStorageScope('user:adhkar-compat'), 'Scope should activate');
      const dateKey = '2026-11-25';

      // Countdown helper sanity
      assert(getAdhkarRemainingCount(0, 3) === 3, 'Remaining at 0/3 must be 3');
      assert(getAdhkarRemainingCount(2, 3) === 1, 'Remaining at 2/3 must be 1');
      assert(getAdhkarRemainingCount(5, 3) === 0, 'Remaining never drops below 0');

      // 1. After-prayer target for Al-Ikhlas completes on first count (1/1 -> remaining 0)
      const afterPrayerTap = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'after_prayer');
      assert(
        afterPrayerTap.currentCount === 1 &&
        afterPrayerTap.targetCount === 1 &&
        afterPrayerTap.remainingCount === 0 &&
        afterPrayerTap.justCompleted === true,
        'Al-Ikhlas in after_prayer must complete on count 1 with 0 remaining'
      );
      const afterPrayerSummary = getAdhkarCategoryProgressSummary('after_prayer', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(afterPrayerSummary.completedItems === 1, 'after_prayer summary must count Al-Ikhlas as completed at 1');

      // 2. Morning target for Al-Ikhlas continues to 3/3 and is NOT downgraded if tapped again in after_prayer
      const morningSummaryBefore = getAdhkarCategoryProgressSummary('morning', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(morningSummaryBefore.completedItems === 0, 'Morning summary must not mark Al-Ikhlas complete at count 1');
      const morningTap2 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'morning');
      assert(morningTap2.remainingCount === 1, 'Morning Al-Ikhlas must show 1 remaining at count 2/3');
      const morningTap3 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'morning');
      assert(
        morningTap3.currentCount === 3 &&
        morningTap3.targetCount === 3 &&
        morningTap3.remainingCount === 0 &&
        morningTap3.justCompleted === true,
        'Al-Ikhlas in morning must complete on count 3'
      );
      const afterPrayerRetap = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage, 'after_prayer');
      assert(
        afterPrayerRetap.currentCount === 3 && afterPrayerRetap.justCompleted === false,
        'Tapping an already-completed item in a lower-target category must not downgrade its stored count'
      );

      // 3. Backward-compatible migration of legacy Arabic-character sleep dhikr ID (including missing readingPrefs)
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
      assert(migrated.readingPrefs.fontScale === 'md' && migrated.readingPrefs.showVirtueAndSource === true, 'Older stores without readingPrefs must hydrate safe defaults');

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

  test('Adhkar progress counter, reading prefs, customizable Tasbih target, favorites, and UID isolation work cleanly', () => {
    StorageService.__resetStorageForTests();
    const map = new Map<string, string>();
    const mockStorage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, v); },
      removeItem: (k: string) => { map.delete(k); }
    };

    try {
      assert(StorageService.setStorageScope('user:alpha'), 'Alpha scope should activate');
      const dateKey = '2026-11-25';
      const firstResult = incrementAdhkarItemCount('adhkar-ayat-alkursi', dateKey, mockStorage);
      assert(firstResult.currentCount === 1 && firstResult.remainingCount === 0 && firstResult.justCompleted === true, 'Ayat Al-Kursi (target 1) must complete on first count');

      const ikhlas1 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      assert(ikhlas1.currentCount === 1 && ikhlas1.remainingCount === 2 && ikhlas1.justCompleted === false, 'Al-Ikhlas (target 3) must have 2 remaining on count 1');
      incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      const ikhlas3 = incrementAdhkarItemCount('adhkar-ikhlas', dateKey, mockStorage);
      assert(ikhlas3.currentCount === 3 && ikhlas3.remainingCount === 0 && ikhlas3.justCompleted === true, 'Al-Ikhlas must complete on count 3');

      const summary = getAdhkarCategoryProgressSummary('morning', getAdhkarCountsForDate(dateKey, mockStorage));
      assert(summary.completedItems === 2 && summary.totalItems >= 20, `Morning summary must reflect 2 completed items out of >= 20, got ${summary.totalItems}`);

      const overall = getOverallDailyAdhkarSummary(getAdhkarCountsForDate(dateKey, mockStorage));
      assert(overall.totalCategories === 18 && overall.totalRepetitionsToday === 4, 'Overall daily summary must aggregate repetitions across 18 categories');

      // Reading preferences persist per UID
      updateAdhkarReadingPrefs({ fontScale: 'xl', showVirtueAndSource: false }, mockStorage);
      const savedPrefs = readAdhkarProgressStore(mockStorage).readingPrefs;
      assert(savedPrefs.fontScale === 'xl' && savedPrefs.showVirtueAndSource === false, 'Reading preferences must persist');

      toggleAdhkarFavorite('adhkar-sayyid-istighfar', mockStorage);
      assert(readAdhkarProgressStore(mockStorage).favoriteIds.includes('adhkar-sayyid-istighfar'), 'Favorite must persist');

      // Free Tasbih preset + custom open target (0)
      selectFreeTasbihPreset(FREE_TASBIH_PRESETS[1].id, mockStorage);
      setFreeTasbihTarget(0, mockStorage);
      assert(readAdhkarProgressStore(mockStorage).freeTasbih.targetCount === 0, 'Unlimited Tasbih target (0) must persist');
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
      assert(readAdhkarProgressStore(mockStorage).readingPrefs.fontScale === 'md', 'Beta must have independent default reading preferences');

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

  test('AdhkarView integrates verified local Quran chunks, offline audio playback, separated tabs, and CircularCountdownRing', () => {
    const viewSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/adhkar/AdhkarView.tsx'), 'utf8');
    const cardSource = fs.readFileSync(path.resolve(process.cwd(), 'src/components/adhkar/AdhkarCard.tsx'), 'utf8');
    assert(viewSource.includes('loadSurahVerses(item.surahNumber!)'), 'AdhkarView must load verified local Quran chunks for Quranic adhkar');
    assert(viewSource.includes('offlineQuranAudioLibrary.resolvePlaybackSource('), 'AdhkarView must support local-first offline audio playback');
    assert(viewSource.includes("globalAudioCoordinator.register('adhkar'"), 'AdhkarView must register with globalAudioCoordinator');
    assert(viewSource.includes("item.kind === 'quran'") || cardSource.includes("item.kind === 'quran'"), 'Only verified Quranic adhkar expose recitation audio playback');
    assert(viewSource.includes('TasbihStudioPanel'), 'AdhkarView must separate Electronic Tasbih into TasbihStudioPanel');
    assert(cardSource.includes('CircularCountdownRing'), 'AdhkarCard must render CircularCountdownRing countdown counter');
  });

  return { passed, failed };
}
