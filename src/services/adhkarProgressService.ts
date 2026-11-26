import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  LEGACY_ADHKAR_ITEM_ID_ALIASES,
  getAdhkarItemsByCategory,
  getAdhkarRepeatTarget,
  type AdhkarCategory
} from '../data/adhkarData';
import { StorageService } from './storageService';
import { scheduleAuxiliaryCloudSync } from './auxiliaryCloudSyncService';
import { getLocalDateString } from './unifiedPortionService';

export const ADHKAR_PROGRESS_KEY = 'wird.adhkar.progress.v1';

export type AdhkarFontScale = 'sm' | 'md' | 'lg' | 'xl';

export interface AdhkarReadingPrefs {
  fontScale: AdhkarFontScale;
  showVirtueAndSource: boolean;
  autoAdvance: boolean;
}

export interface AdhkarProgressStore {
  schemaVersion: 1;
  countsByDate: Record<string, Record<string, number>>;
  favoriteIds: string[];
  freeTasbih: {
    presetId: string;
    currentCount: number;
    targetCount: number;
    totalLifetimeCount: number;
  };
  readingPrefs: AdhkarReadingPrefs;
}

export interface AdhkarCategoryProgressSummary {
  category: AdhkarCategory;
  totalItems: number;
  completedItems: number;
  totalRepetitionsTarget: number;
  completedRepetitions: number;
  percent: number;
  isComplete: boolean;
}

export interface OverallDailyAdhkarSummary {
  completedCategories: number;
  totalCategories: number;
  completedItemsToday: number;
  totalRepetitionsToday: number;
}

const VALID_ITEM_IDS = new Set(ADHKAR_ITEMS.map(item => item.id));
const VALID_PRESET_IDS = new Set(FREE_TASBIH_PRESETS.map(p => p.id));
const VALID_FONT_SCALES = new Set<AdhkarFontScale>(['sm', 'md', 'lg', 'xl']);

export const DEFAULT_ADHKAR_READING_PREFS: AdhkarReadingPrefs = {
  fontScale: 'md',
  showVirtueAndSource: true,
  autoAdvance: true
};

function normalizeAdhkarItemId(itemId: string): string {
  return LEGACY_ADHKAR_ITEM_ID_ALIASES[itemId] ?? itemId;
}

function normalizeReadingPrefs(raw: Partial<AdhkarReadingPrefs> | undefined): AdhkarReadingPrefs {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_ADHKAR_READING_PREFS };
  }
  return {
    fontScale:
      typeof raw.fontScale === 'string' && VALID_FONT_SCALES.has(raw.fontScale as AdhkarFontScale)
        ? (raw.fontScale as AdhkarFontScale)
        : DEFAULT_ADHKAR_READING_PREFS.fontScale,
    showVirtueAndSource:
      typeof raw.showVirtueAndSource === 'boolean'
        ? raw.showVirtueAndSource
        : DEFAULT_ADHKAR_READING_PREFS.showVirtueAndSource,
    autoAdvance:
      typeof raw.autoAdvance === 'boolean'
        ? raw.autoAdvance
        : DEFAULT_ADHKAR_READING_PREFS.autoAdvance
  };
}

function createDefaultStore(): AdhkarProgressStore {
  return {
    schemaVersion: 1,
    countsByDate: {},
    favoriteIds: [],
    freeTasbih: {
      presetId: FREE_TASBIH_PRESETS[0].id,
      currentCount: 0,
      targetCount: FREE_TASBIH_PRESETS[0].defaultTarget,
      totalLifetimeCount: 0
    },
    readingPrefs: { ...DEFAULT_ADHKAR_READING_PREFS }
  };
}

function getScopedKey(): string {
  return StorageService.resolveScopedKey(ADHKAR_PROGRESS_KEY);
}

export function getAdhkarRemainingCount(currentCount: number, targetCount: number): number {
  const safeTarget = Math.max(1, Math.floor(targetCount));
  const safeCurrent = Math.max(0, Math.floor(currentCount));
  return Math.max(0, safeTarget - safeCurrent);
}

export function readAdhkarProgressStore(
  storage: Pick<Storage, 'getItem'> = localStorage
): AdhkarProgressStore {
  try {
    const raw = storage.getItem(getScopedKey());
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<AdhkarProgressStore> | null;
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.countsByDate !== 'object' || !parsed.countsByDate) {
      return createDefaultStore();
    }

    const countsByDate: Record<string, Record<string, number>> = {};
    const dateKeys = Object.keys(parsed.countsByDate)
      .filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k))
      .sort()
      .slice(-30); // Bound history to last 30 active days

    for (const dateKey of dateKeys) {
      const dayRecord = parsed.countsByDate[dateKey];
      if (!dayRecord || typeof dayRecord !== 'object') continue;
      const cleanDay: Record<string, number> = {};
      for (const [rawItemId, val] of Object.entries(dayRecord)) {
        const itemId = normalizeAdhkarItemId(rawItemId);
        if (VALID_ITEM_IDS.has(itemId) && typeof val === 'number' && Number.isSafeInteger(val) && val >= 0 && val <= 10000) {
          cleanDay[itemId] = Math.max(cleanDay[itemId] ?? 0, val);
        }
      }
      countsByDate[dateKey] = cleanDay;
    }

    const favoriteIds = Array.isArray(parsed.favoriteIds)
      ? [...new Set(
          parsed.favoriteIds
            .filter((id): id is string => typeof id === 'string')
            .map(normalizeAdhkarItemId)
            .filter(id => VALID_ITEM_IDS.has(id))
        )]
      : [];

    const rawTasbih = parsed.freeTasbih;
    const presetId = rawTasbih && typeof rawTasbih.presetId === 'string' && VALID_PRESET_IDS.has(rawTasbih.presetId)
      ? rawTasbih.presetId
      : FREE_TASBIH_PRESETS[0].id;
    const defaultTarget = FREE_TASBIH_PRESETS.find(p => p.id === presetId)?.defaultTarget ?? 100;
    const currentCount = rawTasbih && typeof rawTasbih.currentCount === 'number' && Number.isSafeInteger(rawTasbih.currentCount) && rawTasbih.currentCount >= 0
      ? Math.min(100000, rawTasbih.currentCount)
      : 0;
    // targetCount === 0 represents open/unlimited Tasbih mode
    const targetCount = rawTasbih && typeof rawTasbih.targetCount === 'number' && Number.isSafeInteger(rawTasbih.targetCount) && rawTasbih.targetCount >= 0
      ? Math.min(10000, rawTasbih.targetCount)
      : defaultTarget;
    const totalLifetimeCount = rawTasbih && typeof rawTasbih.totalLifetimeCount === 'number' && Number.isSafeInteger(rawTasbih.totalLifetimeCount) && rawTasbih.totalLifetimeCount >= 0
      ? Math.min(100_000_000, rawTasbih.totalLifetimeCount)
      : 0;

    return {
      schemaVersion: 1,
      countsByDate,
      favoriteIds,
      freeTasbih: {
        presetId,
        currentCount,
        targetCount,
        totalLifetimeCount
      },
      readingPrefs: normalizeReadingPrefs(parsed.readingPrefs)
    };
  } catch {
    return createDefaultStore();
  }
}

function persistAdhkarProgressStore(
  store: AdhkarProgressStore,
  storage: Pick<Storage, 'setItem'> = localStorage
): AdhkarProgressStore {
  try {
    storage.setItem(getScopedKey(), JSON.stringify(store));
    if (typeof localStorage !== 'undefined' && storage === localStorage) {
      scheduleAuxiliaryCloudSync();
    }
  } catch {
    // Keep interactive counter responsive if storage quota is blocked
  }
  return store;
}

export function getAdhkarCountsForDate(
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem'> = localStorage
): Record<string, number> {
  const store = readAdhkarProgressStore(storage);
  return { ...(store.countsByDate[dateKey] || {}) };
}

export function incrementAdhkarItemCount(
  itemId: string,
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  category?: AdhkarCategory
): { store: AdhkarProgressStore; currentCount: number; targetCount: number; remainingCount: number; justCompleted: boolean } {
  const canonicalId = normalizeAdhkarItemId(itemId);
  const item = ADHKAR_ITEMS.find(entry => entry.id === canonicalId);
  if (!item) {
    throw new Error('لم يتم العثور على الذكر المطلوب.');
  }
  const targetCount = getAdhkarRepeatTarget(item, category);
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  const prevCount = dayCounts[canonicalId] ?? 0;
  const nextCount = prevCount >= targetCount ? prevCount : Math.min(targetCount, prevCount + 1);
  dayCounts[canonicalId] = nextCount;

  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  persistAdhkarProgressStore(nextStore, storage);

  return {
    store: nextStore,
    currentCount: nextCount,
    targetCount,
    remainingCount: getAdhkarRemainingCount(nextCount, targetCount),
    justCompleted: prevCount < targetCount && nextCount >= targetCount
  };
}

export function resetAdhkarItemCount(
  itemId: string,
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const canonicalId = normalizeAdhkarItemId(itemId);
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  delete dayCounts[canonicalId];
  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  return persistAdhkarProgressStore(nextStore, storage);
}

export function resetAdhkarCategoryCounts(
  category: AdhkarCategory,
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  for (const item of getAdhkarItemsByCategory(category)) {
    delete dayCounts[item.id];
  }
  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  return persistAdhkarProgressStore(nextStore, storage);
}

export function toggleAdhkarFavorite(
  itemId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const canonicalId = normalizeAdhkarItemId(itemId);
  if (!VALID_ITEM_IDS.has(canonicalId)) return readAdhkarProgressStore(storage);
  const store = readAdhkarProgressStore(storage);
  const exists = store.favoriteIds.includes(canonicalId);
  const favoriteIds = exists
    ? store.favoriteIds.filter(id => id !== canonicalId)
    : [...store.favoriteIds, canonicalId];
  return persistAdhkarProgressStore({ ...store, favoriteIds }, storage);
}

export function updateAdhkarReadingPrefs(
  patch: Partial<AdhkarReadingPrefs>,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  const readingPrefs = normalizeReadingPrefs({ ...store.readingPrefs, ...patch });
  return persistAdhkarProgressStore({ ...store, readingPrefs }, storage);
}

export function incrementFreeTasbihCount(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  const nextStore: AdhkarProgressStore = {
    ...store,
    freeTasbih: {
      ...store.freeTasbih,
      currentCount: store.freeTasbih.currentCount + 1,
      totalLifetimeCount: store.freeTasbih.totalLifetimeCount + 1
    }
  };
  return persistAdhkarProgressStore(nextStore, storage);
}

export function resetFreeTasbihCount(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  return persistAdhkarProgressStore(
    {
      ...store,
      freeTasbih: {
        ...store.freeTasbih,
        currentCount: 0
      }
    },
    storage
  );
}

export function selectFreeTasbihPreset(
  presetId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const preset = FREE_TASBIH_PRESETS.find(item => item.id === presetId) || FREE_TASBIH_PRESETS[0];
  const store = readAdhkarProgressStore(storage);
  return persistAdhkarProgressStore(
    {
      ...store,
      freeTasbih: {
        ...store.freeTasbih,
        presetId: preset.id,
        currentCount: 0,
        targetCount: preset.defaultTarget
      }
    },
    storage
  );
}

export function setFreeTasbihTarget(
  targetCount: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const safeTarget = Number.isSafeInteger(targetCount) && targetCount >= 0
    ? Math.min(10000, targetCount)
    : 33;
  const store = readAdhkarProgressStore(storage);
  return persistAdhkarProgressStore(
    {
      ...store,
      freeTasbih: {
        ...store.freeTasbih,
        targetCount: safeTarget,
        currentCount: 0
      }
    },
    storage
  );
}

export function getAdhkarCategoryProgressSummary(
  category: AdhkarCategory,
  countsForDate: Record<string, number>
): AdhkarCategoryProgressSummary {
  const items = getAdhkarItemsByCategory(category);
  let completedItems = 0;
  let totalRepetitionsTarget = 0;
  let completedRepetitions = 0;

  for (const item of items) {
    const target = getAdhkarRepeatTarget(item, category);
    const count = Math.min(target, Math.max(0, countsForDate[item.id] ?? 0));
    totalRepetitionsTarget += target;
    completedRepetitions += count;
    if (count >= target) {
      completedItems += 1;
    }
  }

  const percent = totalRepetitionsTarget > 0
    ? Math.floor((completedRepetitions / totalRepetitionsTarget) * 100)
    : 0;

  return {
    category,
    totalItems: items.length,
    completedItems,
    totalRepetitionsTarget,
    completedRepetitions,
    percent,
    isComplete: items.length > 0 && completedItems === items.length
  };
}

export function getOverallDailyAdhkarSummary(
  countsForDate: Record<string, number>
): OverallDailyAdhkarSummary {
  let completedCategories = 0;
  for (const cat of ADHKAR_CATEGORIES) {
    if (getAdhkarCategoryProgressSummary(cat.id, countsForDate).isComplete) {
      completedCategories += 1;
    }
  }

  let completedItemsToday = 0;
  let totalRepetitionsToday = 0;
  for (const item of ADHKAR_ITEMS) {
    const rawCount = Math.max(0, countsForDate[item.id] ?? 0);
    if (rawCount > 0) {
      totalRepetitionsToday += rawCount;
    }
    const minTarget = item.repeatTargetByCategory
      ? Math.min(item.repeatTarget, ...Object.values(item.repeatTargetByCategory).filter((v): v is number => typeof v === 'number'))
      : item.repeatTarget;
    if (rawCount >= minTarget) {
      completedItemsToday += 1;
    }
  }

  return {
    completedCategories,
    totalCategories: ADHKAR_CATEGORIES.length,
    completedItemsToday,
    totalRepetitionsToday
  };
}
