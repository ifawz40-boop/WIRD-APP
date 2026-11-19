import {
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  getAdhkarItemsByCategory,
  type AdhkarCategory
} from '../data/adhkarData';
import { StorageService } from './storageService';
import { getLocalDateString } from './unifiedPortionService';

export const ADHKAR_PROGRESS_KEY = 'wird.adhkar.progress.v1';

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

const VALID_ITEM_IDS = new Set(ADHKAR_ITEMS.map(item => item.id));
const VALID_PRESET_IDS = new Set(FREE_TASBIH_PRESETS.map(p => p.id));

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
    }
  };
}

function getScopedKey(): string {
  return StorageService.resolveScopedKey(ADHKAR_PROGRESS_KEY);
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
      for (const [itemId, val] of Object.entries(dayRecord)) {
        if (VALID_ITEM_IDS.has(itemId) && typeof val === 'number' && Number.isSafeInteger(val) && val >= 0 && val <= 10000) {
          cleanDay[itemId] = val;
        }
      }
      countsByDate[dateKey] = cleanDay;
    }

    const favoriteIds = Array.isArray(parsed.favoriteIds)
      ? [...new Set(parsed.favoriteIds.filter((id): id is string => typeof id === 'string' && VALID_ITEM_IDS.has(id)))]
      : [];

    const rawTasbih = parsed.freeTasbih;
    const presetId = rawTasbih && typeof rawTasbih.presetId === 'string' && VALID_PRESET_IDS.has(rawTasbih.presetId)
      ? rawTasbih.presetId
      : FREE_TASBIH_PRESETS[0].id;
    const defaultTarget = FREE_TASBIH_PRESETS.find(p => p.id === presetId)?.defaultTarget ?? 100;
    const currentCount = rawTasbih && typeof rawTasbih.currentCount === 'number' && Number.isSafeInteger(rawTasbih.currentCount) && rawTasbih.currentCount >= 0
      ? Math.min(100000, rawTasbih.currentCount)
      : 0;
    const targetCount = rawTasbih && typeof rawTasbih.targetCount === 'number' && Number.isSafeInteger(rawTasbih.targetCount) && rawTasbih.targetCount >= 1
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
      }
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
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): { store: AdhkarProgressStore; currentCount: number; targetCount: number; justCompleted: boolean } {
  const item = ADHKAR_ITEMS.find(entry => entry.id === itemId);
  if (!item) {
    throw new Error('لم يتم العثور على الذكر المطلوب.');
  }
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  const prevCount = dayCounts[itemId] ?? 0;
  const nextCount = Math.min(item.repeatTarget, prevCount + 1);
  dayCounts[itemId] = nextCount;

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
    targetCount: item.repeatTarget,
    justCompleted: prevCount < item.repeatTarget && nextCount >= item.repeatTarget
  };
}

export function resetAdhkarItemCount(
  itemId: string,
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  delete dayCounts[itemId];
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
  if (!VALID_ITEM_IDS.has(itemId)) return readAdhkarProgressStore(storage);
  const store = readAdhkarProgressStore(storage);
  const exists = store.favoriteIds.includes(itemId);
  const favoriteIds = exists
    ? store.favoriteIds.filter(id => id !== itemId)
    : [...store.favoriteIds, itemId];
  return persistAdhkarProgressStore({ ...store, favoriteIds }, storage);
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

export function getAdhkarCategoryProgressSummary(
  category: AdhkarCategory,
  countsForDate: Record<string, number>
): AdhkarCategoryProgressSummary {
  const items = getAdhkarItemsByCategory(category);
  let completedItems = 0;
  let totalRepetitionsTarget = 0;
  let completedRepetitions = 0;

  for (const item of items) {
    const count = Math.min(item.repeatTarget, Math.max(0, countsForDate[item.id] ?? 0));
    totalRepetitionsTarget += item.repeatTarget;
    completedRepetitions += count;
    if (count >= item.repeatTarget) {
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
