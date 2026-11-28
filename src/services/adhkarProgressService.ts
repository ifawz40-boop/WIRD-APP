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
import { recordSyncDeletion, recordSyncUpsert } from './syncTombstoneRegistry';
import { getLocalDateString } from './unifiedPortionService';

export const ADHKAR_PROGRESS_KEY = 'wird.adhkar.progress.v1';

export type AdhkarFontScale = 'sm' | 'md' | 'lg' | 'xl';

export interface AdhkarReadingPrefs {
  fontScale: AdhkarFontScale;
  showVirtueAndSource: boolean;
  autoAdvance: boolean;
}

export interface CustomTasbihPhrase {
  id: string;
  phrase: string;
  virtue?: string;
  defaultTarget: number;
  createdAtMs: number;
  updatedAtMs: number;
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
  customTasbihPhrases: CustomTasbihPhrase[];
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
const VALID_CATEGORY_IDS = new Set<AdhkarCategory>(ADHKAR_CATEGORIES.map(c => c.id));
const VALID_PRESET_IDS = new Set(FREE_TASBIH_PRESETS.map(p => p.id));
const VALID_FONT_SCALES = new Set<AdhkarFontScale>(['sm', 'md', 'lg', 'xl']);
const CUSTOM_TASBIH_ID_RE = /^custom-tasbih-[a-zA-Z0-9_-]{4,64}$/;
export const MAX_CUSTOM_TASBIH_PHRASES = 50;

export const DEFAULT_ADHKAR_READING_PREFS: AdhkarReadingPrefs = {
  fontScale: 'md',
  showVirtueAndSource: true,
  autoAdvance: true
};

function normalizeAdhkarItemId(itemId: string): string {
  return LEGACY_ADHKAR_ITEM_ID_ALIASES[itemId] ?? itemId;
}

/**
 * Resolves the storage key for an Adhkar item count.
 * When `category` is provided, counters are strictly isolated per category
 * (e.g., counting Ayat Al-Kursi in `morning` never increments `evening` or `after_prayer`).
 */
export function getAdhkarCountKey(itemId: string, category?: AdhkarCategory): string {
  const canonicalId = normalizeAdhkarItemId(itemId);
  return category ? `${category}:${canonicalId}` : canonicalId;
}

/**
 * Reads the stored daily count for an Adhkar item in a given category context.
 */
export function getAdhkarItemCount(
  countsForDate: Record<string, number>,
  itemId: string,
  category?: AdhkarCategory
): number {
  const key = getAdhkarCountKey(itemId, category);
  const value = countsForDate[key];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

function normalizeCountRecordKey(rawKey: string): string | null {
  const colonIdx = rawKey.indexOf(':');
  if (colonIdx > 0) {
    const rawCat = rawKey.slice(0, colonIdx) as AdhkarCategory;
    const rawItem = rawKey.slice(colonIdx + 1);
    const canonicalItem = normalizeAdhkarItemId(rawItem);
    if (VALID_CATEGORY_IDS.has(rawCat) && VALID_ITEM_IDS.has(canonicalItem)) {
      return `${rawCat}:${canonicalItem}`;
    }
    return null;
  }
  const canonicalItem = normalizeAdhkarItemId(rawKey);
  return VALID_ITEM_IDS.has(canonicalItem) ? canonicalItem : null;
}

export function sanitizeCustomTasbihPhrases(raw: unknown): CustomTasbihPhrase[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const clean: CustomTasbihPhrase[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const r = entry as Record<string, unknown>;
    const id = typeof r.id === 'string' ? r.id.trim() : '';
    if (!CUSTOM_TASBIH_ID_RE.test(id) || seen.has(id)) continue;
    const phrase = typeof r.phrase === 'string' ? r.phrase.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
    if (phrase.length < 2) continue;
    const virtueRaw = typeof r.virtue === 'string' ? r.virtue.trim().replace(/\s+/g, ' ').slice(0, 180) : '';
    const defaultTarget =
      typeof r.defaultTarget === 'number' && Number.isSafeInteger(r.defaultTarget) && r.defaultTarget >= 0
        ? Math.min(10000, r.defaultTarget)
        : 33;
    const createdAtMs =
      typeof r.createdAtMs === 'number' && Number.isFinite(r.createdAtMs) && r.createdAtMs >= 0
        ? Math.trunc(r.createdAtMs)
        : 0;
    const updatedAtMs =
      typeof r.updatedAtMs === 'number' && Number.isFinite(r.updatedAtMs) && r.updatedAtMs >= 0
        ? Math.max(createdAtMs, Math.trunc(r.updatedAtMs))
        : createdAtMs;
    seen.add(id);
    clean.push({
      id,
      phrase,
      ...(virtueRaw ? { virtue: virtueRaw } : {}),
      defaultTarget,
      createdAtMs,
      updatedAtMs
    });
    if (clean.length >= MAX_CUSTOM_TASBIH_PHRASES) break;
  }
  return clean;
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
    customTasbihPhrases: [],
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
      for (const [rawKey, val] of Object.entries(dayRecord)) {
        const normalizedKey = normalizeCountRecordKey(rawKey);
        if (normalizedKey && typeof val === 'number' && Number.isSafeInteger(val) && val >= 0 && val <= 10000) {
          cleanDay[normalizedKey] = Math.max(cleanDay[normalizedKey] ?? 0, val);
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

    const customTasbihPhrases = sanitizeCustomTasbihPhrases(parsed.customTasbihPhrases);
    const customPhraseMap = new Map(customTasbihPhrases.map(p => [p.id, p]));

    const rawTasbih = parsed.freeTasbih;
    const rawPresetId = rawTasbih && typeof rawTasbih.presetId === 'string' ? rawTasbih.presetId : '';
    const presetId =
      VALID_PRESET_IDS.has(rawPresetId) || customPhraseMap.has(rawPresetId)
        ? rawPresetId
        : FREE_TASBIH_PRESETS[0].id;
    const defaultTarget =
      FREE_TASBIH_PRESETS.find(p => p.id === presetId)?.defaultTarget ??
      customPhraseMap.get(presetId)?.defaultTarget ??
      100;
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
      customTasbihPhrases,
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
  const countKey = getAdhkarCountKey(canonicalId, category);
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  const prevCount = dayCounts[countKey] ?? 0;
  const nextCount = prevCount >= targetCount ? prevCount : Math.min(targetCount, prevCount + 1);
  dayCounts[countKey] = nextCount;

  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    recordSyncUpsert('adhkarCounts', `${dateKey}:${countKey}`);
  }
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
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  category?: AdhkarCategory
): AdhkarProgressStore {
  const countKey = getAdhkarCountKey(itemId, category);
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  delete dayCounts[countKey];
  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    recordSyncDeletion('adhkarCounts', `${dateKey}:${countKey}`);
  }
  return persistAdhkarProgressStore(nextStore, storage);
}

export function resetAdhkarCategoryCounts(
  category: AdhkarCategory,
  dateKey: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  const dayCounts = { ...(store.countsByDate[dateKey] || {}) };
  const categoryItems = getAdhkarItemsByCategory(category);
  for (const item of categoryItems) {
    delete dayCounts[getAdhkarCountKey(item.id, category)];
  }
  const nextStore: AdhkarProgressStore = {
    ...store,
    countsByDate: {
      ...store.countsByDate,
      [dateKey]: dayCounts
    }
  };
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    for (const item of categoryItems) {
      recordSyncDeletion('adhkarCounts', `${dateKey}:${getAdhkarCountKey(item.id, category)}`);
    }
  }
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
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    if (exists) {
      recordSyncDeletion('adhkarFavorites', canonicalId);
    } else {
      recordSyncUpsert('adhkarFavorites', canonicalId);
    }
  }
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
  const store = readAdhkarProgressStore(storage);
  const builtInPreset = FREE_TASBIH_PRESETS.find(item => item.id === presetId);
  const customPreset = store.customTasbihPhrases.find(item => item.id === presetId);
  const resolved = builtInPreset || customPreset || FREE_TASBIH_PRESETS[0];
  return persistAdhkarProgressStore(
    {
      ...store,
      freeTasbih: {
        ...store.freeTasbih,
        presetId: resolved.id,
        currentCount: 0,
        targetCount: resolved.defaultTarget
      }
    },
    storage
  );
}

export function addCustomTasbihPhrase(
  input: { phrase: string; defaultTarget?: number; virtue?: string },
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  nowMs: number = Date.now()
): { ok: true; item: CustomTasbihPhrase; store: AdhkarProgressStore } | { ok: false; errorAr: string } {
  const phrase = typeof input.phrase === 'string' ? input.phrase.trim().replace(/\s+/g, ' ').slice(0, 240) : '';
  if (phrase.length < 2) {
    return { ok: false, errorAr: 'يرجى كتابة صيغة الذكر (حرفان على الأقل).' };
  }

  const store = readAdhkarProgressStore(storage);
  if (store.customTasbihPhrases.length >= MAX_CUSTOM_TASBIH_PHRASES) {
    return { ok: false, errorAr: `وصلت إلى الحد الأقصى للأذكار المخصصة (${MAX_CUSTOM_TASBIH_PHRASES}).` };
  }

  const duplicate = store.customTasbihPhrases.find(p => p.phrase === phrase);
  if (duplicate) {
    return { ok: false, errorAr: 'هذا الذكر مضاف بالفعل إلى مسبحتك.' };
  }

  const safeTarget =
    typeof input.defaultTarget === 'number' && Number.isSafeInteger(input.defaultTarget) && input.defaultTarget >= 0
      ? Math.min(10000, input.defaultTarget)
      : 33;
  const virtue =
    typeof input.virtue === 'string' ? input.virtue.trim().replace(/\s+/g, ' ').slice(0, 180) : '';

  const safeNow = Number.isFinite(nowMs) && nowMs > 0 ? Math.trunc(nowMs) : Date.now();
  const suffix = Math.random().toString(36).slice(2, 8);
  const item: CustomTasbihPhrase = {
    id: `custom-tasbih-${safeNow.toString(36)}-${suffix}`,
    phrase,
    ...(virtue ? { virtue } : {}),
    defaultTarget: safeTarget,
    createdAtMs: safeNow,
    updatedAtMs: safeNow
  };

  const nextStore: AdhkarProgressStore = {
    ...store,
    customTasbihPhrases: [item, ...store.customTasbihPhrases],
    freeTasbih: {
      ...store.freeTasbih,
      presetId: item.id,
      currentCount: 0,
      targetCount: item.defaultTarget
    }
  };

  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    recordSyncUpsert('customTasbih', item.id, safeNow);
  }
  const persisted = persistAdhkarProgressStore(nextStore, storage);
  return { ok: true, item, store: persisted };
}

export function removeCustomTasbihPhrase(
  phraseId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): AdhkarProgressStore {
  const store = readAdhkarProgressStore(storage);
  if (!store.customTasbihPhrases.some(p => p.id === phraseId)) {
    return store;
  }

  const remaining = store.customTasbihPhrases.filter(p => p.id !== phraseId);
  const wasActive = store.freeTasbih.presetId === phraseId;
  const fallback = FREE_TASBIH_PRESETS[0];

  const nextStore: AdhkarProgressStore = {
    ...store,
    customTasbihPhrases: remaining,
    freeTasbih: wasActive
      ? {
          ...store.freeTasbih,
          presetId: fallback.id,
          currentCount: 0,
          targetCount: fallback.defaultTarget
        }
      : store.freeTasbih
  };

  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    recordSyncDeletion('customTasbih', phraseId);
  }
  return persistAdhkarProgressStore(nextStore, storage);
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
    const count = Math.min(target, getAdhkarItemCount(countsForDate, item.id, category));
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
  let completedItemsToday = 0;
  for (const cat of ADHKAR_CATEGORIES) {
    const summary = getAdhkarCategoryProgressSummary(cat.id, countsForDate);
    if (summary.isComplete) {
      completedCategories += 1;
    }
    completedItemsToday += summary.completedItems;
  }

  let totalRepetitionsToday = 0;
  for (const [key, val] of Object.entries(countsForDate)) {
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      totalRepetitionsToday += Math.floor(val);
    }
    // Count uncategorized (favorites/global search) completions if bare item key meets its minimum target
    if (!key.includes(':')) {
      const item = ADHKAR_ITEMS.find(entry => entry.id === key);
      if (item) {
        const minTarget = item.repeatTargetByCategory
          ? Math.min(item.repeatTarget, ...Object.values(item.repeatTargetByCategory).filter((v): v is number => typeof v === 'number'))
          : item.repeatTarget;
        if (Math.floor(val) >= minTarget) {
          completedItemsToday += 1;
        }
      }
    }
  }

  return {
    completedCategories,
    totalCategories: ADHKAR_CATEGORIES.length,
    completedItemsToday,
    totalRepetitionsToday
  };
}
