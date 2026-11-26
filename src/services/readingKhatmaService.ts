import { StorageService } from './storageService';
import { scheduleAuxiliaryCloudSync } from './auxiliaryCloudSyncService';

export interface ReadingKhatmaPlanOptions {
  durationDays: number;
  sessionsPerDay: number;
}

export interface ReadingKhatmaPlan extends ReadingKhatmaPlanOptions {
  targetCompletionDate: string;
}

export interface ReadingKhatmaDailyLog {
  date: string;
  pages: number[];
}

export interface ReadingKhatmaCycle {
  id: string;
  title?: string;
  startedAt: string;
  completedAt: string;
  durationDays?: number;
  pagesRead?: number;
}

export interface ReadingKhatma {
  id: string;
  title?: string;
  startedAt: string;
  completedPages: number[];
  completedAt?: string;
  completedCycles: ReadingKhatmaCycle[];
  plan?: ReadingKhatmaPlan;
  dailyLogs?: ReadingKhatmaDailyLog[];
  isPaused?: boolean;
  pausedAt?: string;
  lastReadAt?: string;
  lastVisitedPage?: number;
  startPage?: number;
  endPage?: number;
}

export interface CreateReadingKhatmaOptions extends ReadingKhatmaPlanOptions {
  title?: string;
  startPage?: number;
  endPage?: number;
}

export interface ReadingKhatmaStore {
  schemaVersion: 2;
  activeKhatmaId: string | null;
  khatmas: ReadingKhatma[];
  completedCycles: ReadingKhatmaCycle[];
}

export interface ReadingKhatmaProgress {
  completedPages: number;
  totalScopePages: number;
  remainingPages: number;
  percent: number;
  nextPage: number;
  resumePage: number;
  daysRemaining: number;
  pagesPerDay: number;
  sessionsPerDay: number;
  pagesPerSession: number;
  pagesReadToday: number;
  targetCompletionDate: string;
  isPaused: boolean;
}

const LEGACY_STORAGE_KEY = 'wird.reading.khatma.v1';
const STORAGE_KEY_V2 = 'wird.reading.khatmas.v2';
const DEFAULT_PLAN: ReadingKhatmaPlanOptions = { durationDays: 30, sessionsPerDay: 2 };

function getScopedLegacyKey(): string {
  return StorageService.resolveScopedKey(LEGACY_STORAGE_KEY);
}

function getScopedV2Key(): string {
  return StorageService.resolveScopedKey(STORAGE_KEY_V2);
}

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function addDays(date: Date, days: number): string {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  result.setDate(result.getDate() + days);
  return localDateKey(result);
}

function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function isValidPageNumber(page: unknown): page is number {
  return typeof page === 'number' && Number.isInteger(page) && page >= 1 && page <= 604;
}

function isValidPlan(value: unknown): value is ReadingKhatmaPlan {
  if (!value || typeof value !== 'object') return false;
  const plan = value as ReadingKhatmaPlan;
  const targetDate = typeof plan.targetCompletionDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(plan.targetCompletionDate)
      ? dateFromKey(plan.targetCompletionDate)
      : null;
  return Number.isInteger(plan.durationDays) && plan.durationDays >= 1 && plan.durationDays <= 365 &&
    Number.isInteger(plan.sessionsPerDay) && plan.sessionsPerDay >= 1 && plan.sessionsPerDay <= 6 &&
    Boolean(targetDate && Number.isFinite(targetDate.getTime()) && localDateKey(targetDate) === plan.targetCompletionDate);
}

function normalizePlan(options: ReadingKhatmaPlanOptions, now: Date): ReadingKhatmaPlan {
  if (!Number.isInteger(options.durationDays) || options.durationDays < 1 || options.durationDays > 365) {
    throw new RangeError('مدة الختمة يجب أن تكون بين يوم واحد و365 يوماً.');
  }
  if (!Number.isInteger(options.sessionsPerDay) || options.sessionsPerDay < 1 || options.sessionsPerDay > 6) {
    throw new RangeError('عدد جلسات القراءة اليومية يجب أن يكون بين جلسة واحدة و6 جلسات.');
  }
  return {
    durationDays: options.durationDays,
    sessionsPerDay: options.sessionsPerDay,
    targetCompletionDate: addDays(now, options.durationDays)
  };
}

function isValidDailyLog(value: unknown): value is ReadingKhatmaDailyLog {
  if (!value || typeof value !== 'object') return false;
  const log = value as ReadingKhatmaDailyLog;
  const logDate = typeof log.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(log.date)
    ? dateFromKey(log.date)
    : null;
  return Boolean(logDate && Number.isFinite(logDate.getTime()) && localDateKey(logDate) === log.date) &&
    Array.isArray(log.pages) && log.pages.every(isValidPageNumber);
}

function isValidCycle(value: unknown): value is ReadingKhatmaCycle {
  if (!value || typeof value !== 'object') return false;
  const cycle = value as ReadingKhatmaCycle;
  return typeof cycle.id === 'string' && cycle.id.length > 0 &&
    isValidDate(cycle.startedAt) &&
    isValidDate(cycle.completedAt);
}

const isValidKhatma = (value: unknown): value is ReadingKhatma => {
  if (!value || typeof value !== 'object') return false;
  const item = value as ReadingKhatma;
  const cycles = item.completedCycles;
  const startPage = item.startPage ?? 1;
  const endPage = item.endPage ?? 604;
  return typeof item.id === 'string' && item.id.length > 0 &&
    (item.title === undefined || typeof item.title === 'string') &&
    isValidDate(item.startedAt) &&
    Array.isArray(item.completedPages) && item.completedPages.every(isValidPageNumber) &&
    (item.completedAt === undefined || isValidDate(item.completedAt)) &&
    (cycles === undefined || (Array.isArray(cycles) && cycles.length <= 1000 && cycles.every(isValidCycle))) &&
    (item.plan === undefined || isValidPlan(item.plan)) &&
    (item.dailyLogs === undefined || (Array.isArray(item.dailyLogs) && item.dailyLogs.length <= 1000 && item.dailyLogs.every(isValidDailyLog))) &&
    (item.isPaused === undefined || typeof item.isPaused === 'boolean') &&
    (item.pausedAt === undefined || isValidDate(item.pausedAt)) &&
    (item.lastReadAt === undefined || isValidDate(item.lastReadAt)) &&
    (item.lastVisitedPage === undefined || isValidPageNumber(item.lastVisitedPage)) &&
    isValidPageNumber(startPage) &&
    isValidPageNumber(endPage) &&
    startPage <= endPage;
};

function normalizeScopeBounds(khatma: Pick<ReadingKhatma, 'startPage' | 'endPage'>): { startPage: number; endPage: number } {
  const startPage = isValidPageNumber(khatma.startPage) ? khatma.startPage : 1;
  const rawEnd = isValidPageNumber(khatma.endPage) ? khatma.endPage : 604;
  return {
    startPage,
    endPage: Math.max(startPage, rawEnd)
  };
}

function normalizeKhatma(item: ReadingKhatma): ReadingKhatma {
  const startedAt = new Date(item.startedAt);
  const legacyPlan = normalizePlan(DEFAULT_PLAN, startedAt);
  const { startPage, endPage } = normalizeScopeBounds(item);
  const normalizedPages = [...new Set(item.completedPages)]
    .filter(p => p >= startPage && p <= endPage)
    .sort((a, b) => a - b);
  return {
    ...item,
    title: item.title?.trim() || 'ختمة القراءة',
    startPage,
    endPage,
    completedPages: normalizedPages,
    completedCycles: item.completedCycles || [],
    plan: item.plan || legacyPlan,
    dailyLogs: (item.dailyLogs || []).map(log => ({
      date: log.date,
      pages: [...new Set(log.pages)].sort((a, b) => a - b)
    })).sort((a, b) => a.date.localeCompare(b.date)),
    lastVisitedPage: isValidPageNumber(item.lastVisitedPage)
      ? Math.min(endPage, Math.max(startPage, item.lastVisitedPage))
      : undefined
  };
}

function parseLegacyV1(storage: Pick<Storage, 'getItem'>): {
  status: 'missing' | 'corrupt' | 'valid';
  khatma?: ReadingKhatma;
} {
  const raw = storage.getItem(getScopedLegacyKey());
  if (!raw) return { status: 'missing' };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isValidKhatma(parsed)) return { status: 'corrupt' };
    return { status: 'valid', khatma: normalizeKhatma(parsed) };
  } catch {
    return { status: 'corrupt' };
  }
}

function dedupeCycles(cycles: ReadingKhatmaCycle[]): ReadingKhatmaCycle[] {
  const map = new Map<string, ReadingKhatmaCycle>();
  for (const cycle of cycles) {
    map.set(cycle.id, cycle);
  }
  return Array.from(map.values()).sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}

function readStoreInternal(storage: Pick<Storage, 'getItem'> = localStorage): {
  store: ReadingKhatmaStore;
  legacyState: 'missing' | 'corrupt' | 'valid';
  legacyKhatma?: ReadingKhatma;
} {
  const legacy = parseLegacyV1(storage);
  let storeV2: ReadingKhatmaStore | null = null;
  try {
    const rawV2 = storage.getItem(getScopedV2Key());
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2) as Partial<ReadingKhatmaStore> | null;
      if (
        parsedV2 &&
        parsedV2.schemaVersion === 2 &&
        Array.isArray(parsedV2.khatmas) &&
        parsedV2.khatmas.every(isValidKhatma)
      ) {
        const khatmas = parsedV2.khatmas.map(normalizeKhatma);
        const rawCycles = Array.isArray(parsedV2.completedCycles)
          ? parsedV2.completedCycles.filter(isValidCycle)
          : [];
        const nestedCycles = khatmas.flatMap(k => k.completedCycles || []);
        const completedCycles = dedupeCycles([...rawCycles, ...nestedCycles]);
        const activeId =
          typeof parsedV2.activeKhatmaId === 'string' &&
          khatmas.some(k => k.id === parsedV2.activeKhatmaId)
            ? parsedV2.activeKhatmaId
            : khatmas.find(k => !k.completedAt)?.id || khatmas[0]?.id || null;
        storeV2 = {
          schemaVersion: 2,
          activeKhatmaId: activeId,
          khatmas,
          completedCycles
        };
      }
    }
  } catch {
    storeV2 = null;
  }

  // Migrate seamlessly from v1 if v2 isn't saved yet, or if an external caller injected a newer v1 item
  if (legacy.status === 'valid' && legacy.khatma) {
    if (!storeV2) {
      const v1Item = legacy.khatma;
      const completedCycles = dedupeCycles(v1Item.completedCycles || []);
      return {
        store: {
          schemaVersion: 2,
          activeKhatmaId: v1Item.id,
          khatmas: [v1Item],
          completedCycles
        },
        legacyState: legacy.status,
        legacyKhatma: v1Item
      };
    }
    const alreadyInV2 = storeV2.khatmas.some(k => k.id === legacy.khatma!.id);
    if (!alreadyInV2) {
      const mergedKhatmas = [...storeV2.khatmas, legacy.khatma];
      const mergedCycles = dedupeCycles([...storeV2.completedCycles, ...(legacy.khatma.completedCycles || [])]);
      return {
        store: {
          schemaVersion: 2,
          activeKhatmaId: legacy.khatma.id,
          khatmas: mergedKhatmas,
          completedCycles: mergedCycles
        },
        legacyState: legacy.status,
        legacyKhatma: legacy.khatma
      };
    }
  }

  if (storeV2) {
    return {
      store: storeV2,
      legacyState: legacy.status,
      legacyKhatma: legacy.khatma
    };
  }

  return {
    store: {
      schemaVersion: 2,
      activeKhatmaId: null,
      khatmas: [],
      completedCycles: []
    },
    legacyState: legacy.status,
    legacyKhatma: legacy.khatma
  };
}

function getActiveFromStore(store: ReadingKhatmaStore): ReadingKhatma | null {
  if (store.activeKhatmaId) {
    const matched = store.khatmas.find(k => k.id === store.activeKhatmaId);
    if (matched) return matched;
  }
  return store.khatmas.find(k => !k.completedAt) || store.khatmas[0] || null;
}

function persistStore(
  store: ReadingKhatmaStore,
  storage: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'removeItem'>>
): void {
  const normalizedKhatmas = store.khatmas.map(normalizeKhatma);
  const completedCycles = dedupeCycles([
    ...store.completedCycles,
    ...normalizedKhatmas.flatMap(k => k.completedCycles || [])
  ]);
  const active =
    (store.activeKhatmaId ? normalizedKhatmas.find(k => k.id === store.activeKhatmaId) : null) ||
    normalizedKhatmas.find(k => !k.completedAt) ||
    normalizedKhatmas[0] ||
    null;

  const finalStore: ReadingKhatmaStore = {
    schemaVersion: 2,
    activeKhatmaId: active?.id ?? null,
    khatmas: normalizedKhatmas,
    completedCycles
  };

  storage.setItem(getScopedV2Key(), JSON.stringify(finalStore));
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    scheduleAuxiliaryCloudSync();
  }
  if (active) {
    const legacyMirror: ReadingKhatma = {
      ...active,
      completedCycles
    };
    storage.setItem(getScopedLegacyKey(), JSON.stringify(legacyMirror));
  } else if (typeof storage.removeItem === 'function') {
    storage.removeItem(getScopedLegacyKey());
  }
}

export function readAllReadingKhatmas(
  storage: Pick<Storage, 'getItem'> = localStorage
): {
  khatmas: ReadingKhatma[];
  activeKhatma: ReadingKhatma | null;
  activeKhatmaId: string | null;
  completedCycles: ReadingKhatmaCycle[];
} {
  const { store, legacyState } = readStoreInternal(storage);
  if (legacyState === 'corrupt' && store.khatmas.length === 0) {
    return {
      khatmas: [],
      activeKhatma: null,
      activeKhatmaId: null,
      completedCycles: []
    };
  }
  const activeKhatma = getActiveFromStore(store);
  return {
    khatmas: store.khatmas.map(k => ({
      ...k,
      completedCycles: store.completedCycles
    })),
    activeKhatma: activeKhatma
      ? { ...activeKhatma, completedCycles: store.completedCycles }
      : null,
    activeKhatmaId: activeKhatma?.id ?? null,
    completedCycles: store.completedCycles
  };
}

export function readReadingKhatma(storage: Pick<Storage, 'getItem'> = localStorage): ReadingKhatma | null {
  const { store, legacyState } = readStoreInternal(storage);
  if (legacyState === 'corrupt') return null;
  const active = getActiveFromStore(store);
  if (!active) return null;
  return {
    ...active,
    completedCycles: dedupeCycles([...store.completedCycles, ...(active.completedCycles || [])])
  };
}

export function createReadingKhatma(
  options: CreateReadingKhatmaOptions,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const startPage = options.startPage ?? 1;
  const endPage = options.endPage ?? 604;
  if (!isValidPageNumber(startPage) || !isValidPageNumber(endPage) || startPage > endPage) {
    throw new RangeError('نطاق صفحات الختمة يجب أن يكون بين 1 و604.');
  }

  const normalizedPlan = normalizePlan(
    { durationDays: options.durationDays, sessionsPerDay: options.sessionsPerDay },
    now
  );
  const activeCount = store.khatmas.filter(k => !k.completedAt).length;
  const trimmedTitle = options.title?.trim();
  const title = trimmedTitle && trimmedTitle.length > 0
    ? trimmedTitle
    : activeCount === 0
    ? 'ختمة القراءة الأولى'
    : `ختمة القراءة (${activeCount + 1})`;

  const archiveCyclesFromCompleted = store.khatmas
    .filter(k => Boolean(k.completedAt))
    .map(k => ({
      id: k.id,
      title: k.title,
      startedAt: k.startedAt,
      completedAt: k.completedAt!,
      durationDays: k.plan?.durationDays,
      pagesRead: k.completedPages.length
    }));
  const completedCycles = dedupeCycles([...store.completedCycles, ...archiveCyclesFromCompleted]);

  const next: ReadingKhatma = {
    id: now.getTime() + '-' + Math.random().toString(36).slice(2),
    title,
    startedAt: now.toISOString(),
    completedPages: [],
    completedCycles,
    plan: normalizedPlan,
    dailyLogs: [],
    isPaused: false,
    startPage,
    endPage,
    lastVisitedPage: startPage
  };

  // Preserve unfinished active Khatmas so multiple independent Khatmas coexist; remove already-completed entries once archived into completedCycles
  const remainingKhatmas = store.khatmas.filter(k => !k.completedAt);
  const nextStore: ReadingKhatmaStore = {
    schemaVersion: 2,
    activeKhatmaId: next.id,
    khatmas: [...remainingKhatmas, next],
    completedCycles
  };
  persistStore(nextStore, storage);
  return next;
}

export function setActiveReadingKhatma(
  khatmaId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const target = store.khatmas.find(k => k.id === khatmaId);
  if (!target) {
    throw new Error('تعذر العثور على الختمة المطلوبة.');
  }
  persistStore({ ...store, activeKhatmaId: target.id }, storage);
  return { ...target, completedCycles: store.completedCycles };
}

export function startReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  options: ReadingKhatmaPlanOptions = DEFAULT_PLAN
): ReadingKhatma {
  const { store, legacyState } = readStoreInternal(storage);
  if (legacyState === 'corrupt') {
    throw new Error('تعذر قراءة تقدم ختمة سابق؛ احتفظنا بالبيانات ولم نستبدلها.');
  }
  const current = getActiveFromStore(store);
  if (current && !current.completedAt) return current;
  return createReadingKhatma(options, storage, now);
}

export function updateReadingKhatmaPlan(
  options: ReadingKhatmaPlanOptions,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  khatmaId?: string,
  title?: string
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const target = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!target || target.completedAt) {
    throw new Error('لا توجد ختمة قراءة نشطة لتعديل خطتها.');
  }
  const normalizedPlan = normalizePlan(options, now);
  const updated: ReadingKhatma = {
    ...target,
    ...(title !== undefined && title.trim().length > 0 ? { title: title.trim() } : {}),
    plan: normalizedPlan
  };
  const nextStore: ReadingKhatmaStore = {
    ...store,
    khatmas: store.khatmas.map(k => (k.id === target.id ? updated : k))
  };
  persistStore(nextStore, storage);
  return updated;
}

export function pauseReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  khatmaId?: string
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current || current.completedAt) throw new Error('لا توجد ختمة نشطة لإيقافها مؤقتاً.');
  if (current.isPaused) return current;
  const next: ReadingKhatma = { ...current, isPaused: true, pausedAt: now.toISOString() };
  persistStore(
    { ...store, khatmas: store.khatmas.map(k => (k.id === current.id ? next : k)) },
    storage
  );
  return next;
}

export function resumeReadingKhatma(
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  khatmaId?: string
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current || current.completedAt) throw new Error('لا توجد ختمة نشطة لاستئنافها.');
  if (!current.isPaused) return current;

  const pausedDate = current.pausedAt ? new Date(current.pausedAt) : now;
  const pausedDays = Math.max(0, Math.ceil(
    (dateFromKey(localDateKey(now)).getTime() - dateFromKey(localDateKey(pausedDate)).getTime()) / 86_400_000
  ));
  const plan = current.plan
    ? { ...current.plan, targetCompletionDate: addDays(dateFromKey(current.plan.targetCompletionDate), pausedDays) }
    : current.plan;
  const next: ReadingKhatma = { ...current, isPaused: false, plan };
  delete next.pausedAt;
  persistStore(
    { ...store, khatmas: store.khatmas.map(k => (k.id === current.id ? next : k)) },
    storage
  );
  return next;
}

export function updateReadingKhatmaPosition(
  page: number,
  khatmaId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): ReadingKhatma | null {
  if (!isValidPageNumber(page)) return null;
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current || current.completedAt) return null;
  const { startPage, endPage } = normalizeScopeBounds(current);
  const clampedPage = Math.min(endPage, Math.max(startPage, page));
  if (current.lastVisitedPage === clampedPage) return current;
  const next: ReadingKhatma = { ...current, lastVisitedPage: clampedPage };
  persistStore(
    { ...store, khatmas: store.khatmas.map(k => (k.id === current.id ? next : k)) },
    storage
  );
  return next;
}

export function markReadingPagesRange(
  pages: number[],
  khatmaId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  if (!Array.isArray(pages) || pages.length === 0) {
    throw new RangeError('اختر صفحة واحدة على الأقل لتسجيل القراءة.');
  }
  for (const page of pages) {
    if (!isValidPageNumber(page)) {
      throw new RangeError('رقم الصفحة يجب أن يكون بين 1 و604.');
    }
  }
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current || current.completedAt) throw new Error('ابدأ ختمة قراءة نشطة أولاً.');
  if (current.isPaused) throw new Error('الختمة متوقفة مؤقتاً؛ استأنفها قبل تسجيل القراءة.');

  const { startPage, endPage } = normalizeScopeBounds(current);
  const totalScopePages = endPage - startPage + 1;
  const validScopedPages = pages.filter(p => p >= startPage && p <= endPage);
  if (validScopedPages.length === 0) {
    throw new RangeError(`نطاق هذه الختمة من ص ${startPage} إلى ص ${endPage}.`);
  }

  const completedPages = [...new Set([...current.completedPages, ...validScopedPages])].sort((a, b) => a - b);
  const today = localDateKey(now);
  const dailyLogs = [...(current.dailyLogs || [])];
  const todayIndex = dailyLogs.findIndex(log => log.date === today);
  if (todayIndex >= 0) {
    dailyLogs[todayIndex] = {
      date: today,
      pages: [...new Set([...dailyLogs[todayIndex].pages, ...validScopedPages])].sort((a, b) => a - b)
    };
  } else {
    dailyLogs.push({ date: today, pages: [...new Set(validScopedPages)].sort((a, b) => a - b) });
  }

  const highestPage = Math.max(...validScopedPages);
  const isNowComplete = completedPages.length >= totalScopePages;
  const completedAt = isNowComplete ? now.toISOString() : undefined;
  const updatedCycles = isNowComplete
    ? dedupeCycles([
        ...store.completedCycles,
        {
          id: current.id,
          title: current.title,
          startedAt: current.startedAt,
          completedAt: completedAt!,
          durationDays: current.plan?.durationDays,
          pagesRead: completedPages.length
        }
      ])
    : store.completedCycles;

  const next: ReadingKhatma = {
    ...current,
    completedPages,
    completedCycles: updatedCycles,
    dailyLogs: dailyLogs.sort((a, b) => a.date.localeCompare(b.date)),
    lastReadAt: now.toISOString(),
    lastVisitedPage: highestPage,
    ...(isNowComplete ? { completedAt, isPaused: false } : {})
  };

  persistStore(
    {
      ...store,
      completedCycles: updatedCycles,
      khatmas: store.khatmas.map(k => (k.id === current.id ? next : k))
    },
    storage
  );
  return next;
}

export function markReadingUntilPage(
  upToPage: number,
  khatmaId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date()
): ReadingKhatma {
  if (!isValidPageNumber(upToPage)) {
    throw new RangeError('رقم الصفحة يجب أن يكون بين 1 و604.');
  }
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current || current.completedAt) throw new Error('ابدأ ختمة قراءة نشطة أولاً.');
  const { startPage, endPage } = normalizeScopeBounds(current);
  const cappedTarget = Math.min(endPage, Math.max(startPage, upToPage));
  const range: number[] = [];
  for (let p = startPage; p <= cappedTarget; p++) {
    range.push(p);
  }
  return markReadingPagesRange(range, current.id, storage, now);
}

export function unmarkReadingPages(
  pages: number[],
  khatmaId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): ReadingKhatma {
  const { store } = readStoreInternal(storage);
  const current = khatmaId
    ? store.khatmas.find(k => k.id === khatmaId)
    : getActiveFromStore(store);
  if (!current) throw new Error('لا توجد ختمة محددة للتراجع.');
  const removeSet = new Set(pages);
  const completedPages = current.completedPages.filter(p => !removeSet.has(p));
  const dailyLogs = (current.dailyLogs || [])
    .map(log => ({ date: log.date, pages: log.pages.filter(p => !removeSet.has(p)) }))
    .filter(log => log.pages.length > 0);
  const next: ReadingKhatma = {
    ...current,
    completedPages,
    dailyLogs,
    completedAt: undefined
  };
  delete next.completedAt;
  persistStore(
    { ...store, khatmas: store.khatmas.map(k => (k.id === current.id ? next : k)) },
    storage
  );
  return next;
}

export function markReadingPage(
  page: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  now = new Date(),
  khatmaId?: string
): ReadingKhatma {
  return markReadingPagesRange([page], khatmaId, storage, now);
}

export function getReadingKhatmaProgress(khatma: ReadingKhatma, now = new Date()): ReadingKhatmaProgress {
  const { startPage, endPage } = normalizeScopeBounds(khatma);
  const totalScopePages = endPage - startPage + 1;
  const completedSet = new Set(khatma.completedPages.filter(p => p >= startPage && p <= endPage));
  const completedPages = completedSet.size;
  const remainingPages = Math.max(0, totalScopePages - completedPages);
  const plan = khatma.plan || normalizePlan(DEFAULT_PLAN, new Date(khatma.startedAt));
  const daysRemaining = khatma.completedAt
    ? 0
    : Math.max(1, Math.ceil((dateFromKey(plan.targetCompletionDate).getTime() - dateFromKey(localDateKey(now)).getTime()) / 86_400_000));
  const pagesPerDay = remainingPages === 0 ? 0 : Math.ceil(remainingPages / daysRemaining);
  const sessionsPerDay = pagesPerDay === 0 ? 0 : Math.min(plan.sessionsPerDay, pagesPerDay);
  const todayLog = khatma.dailyLogs?.find(log => log.date === localDateKey(now));

  let nextPage = endPage;
  for (let p = startPage; p <= endPage; p++) {
    if (!completedSet.has(p)) {
      nextPage = p;
      break;
    }
  }
  const resumePage =
    isValidPageNumber(khatma.lastVisitedPage) &&
    khatma.lastVisitedPage >= startPage &&
    khatma.lastVisitedPage <= endPage
      ? khatma.lastVisitedPage
      : nextPage;

  return {
    completedPages,
    totalScopePages,
    remainingPages,
    percent: Math.floor((completedPages / Math.max(1, totalScopePages)) * 100),
    nextPage,
    resumePage,
    daysRemaining,
    pagesPerDay,
    sessionsPerDay,
    pagesPerSession: pagesPerDay === 0 ? 0 : Math.ceil(pagesPerDay / Math.max(1, sessionsPerDay)),
    pagesReadToday: todayLog?.pages.length || 0,
    targetCompletionDate: plan.targetCompletionDate,
    isPaused: Boolean(khatma.isPaused)
  };
}

export function deleteReadingKhatmaById(
  khatmaId: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage
): void {
  const { store } = readStoreInternal(storage);
  const remaining = store.khatmas.filter(k => k.id !== khatmaId);
  const nextActive = store.activeKhatmaId === khatmaId
    ? (remaining.find(k => !k.completedAt)?.id || remaining[0]?.id || null)
    : store.activeKhatmaId;
  if (remaining.length === 0 && store.completedCycles.length === 0) {
    storage.removeItem(getScopedLegacyKey());
    storage.removeItem(getScopedV2Key());
    return;
  }
  persistStore(
    {
      ...store,
      activeKhatmaId: nextActive,
      khatmas: remaining
    },
    storage
  );
}

export function clearReadingKhatma(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem(getScopedLegacyKey());
  storage.removeItem(getScopedV2Key());
}

