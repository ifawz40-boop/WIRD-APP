import { DEFAULT_MUSHAF_RIBBONS, type MushafRibbonBookmark, type MushafRibbonId } from './mushafRibbonBookmarksService';

export const AUXILIARY_SYNC_DOCUMENT_ID = 'auxiliaryDomainsV1';

export const SYNCED_AUXILIARY_KEYS = {
  READING_KHATMAS_V2: 'wird.reading.khatmas.v2',
  PAGE_BOOKMARKS: 'wird.quran.pageBookmarks.v1',
  RIBBONS: 'wird.quran.ribbons.v1',
  LAST_PAGE: 'wird.quran.lastPage.v1',
  LAST_READING_POS: 'wird.quran.lastReadingPosition.v1',
  ADHKAR_PROGRESS: 'wird.adhkar.progress.v1',
  SEERAH_V2: 'wird.seerah.v2',
  VIDEO_SERIES: 'wird.video.series.v1',
} as const;

export interface AuxiliaryDomainSnapshotV1 {
  schemaVersion: 1;
  updatedAtMs: number;
  pageBookmarks: number[];
  ribbons: MushafRibbonBookmark[];
  lastPage: { page: number; updatedAtMs: number } | null;
  lastReadingPositionRaw: string | null;
  readingKhatmasRaw: string | null;
  adhkarProgressRaw: string | null;
  seerahV2Raw: string | null;
  videoSeriesRaw: string | null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidPage(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 604;
}

function sanitizePageBookmarks(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const valid = raw.filter(isValidPage);
  return [...new Set(valid)].sort((a, b) => a - b);
}

function sanitizeRibbons(raw: unknown): MushafRibbonBookmark[] {
  const defaults = DEFAULT_MUSHAF_RIBBONS.map((item) => ({ ...item }));
  if (!Array.isArray(raw)) return defaults;
  const byId = new Map<string, Record<string, unknown>>();
  for (const item of raw) {
    if (isPlainRecord(item) && typeof item.id === 'string') {
      byId.set(item.id, item);
    }
  }
  return defaults.map((def) => {
    const saved = byId.get(def.id);
    if (!saved) return def;
    const pageNum = Number(saved.page);
    const validPage = Number.isInteger(pageNum) && pageNum >= 1 && pageNum <= 604 ? pageNum : null;
    const updatedAtMs =
      typeof saved.updatedAtMs === 'number' && Number.isFinite(saved.updatedAtMs)
        ? Math.max(0, Math.trunc(saved.updatedAtMs))
        : 0;
    const note =
      typeof saved.note === 'string' && saved.note.trim()
        ? saved.note.trim().slice(0, 160)
        : undefined;
    return {
      ...def,
      id: def.id as MushafRibbonId,
      page: validPage,
      note,
      updatedAtMs,
    };
  });
}

function safeJsonParse(raw: string | null): unknown {
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseIsoMs(iso: unknown): number {
  if (typeof iso !== 'string' || !iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isValidAuxiliaryDomainSnapshot(value: unknown): value is AuxiliaryDomainSnapshotV1 {
  if (!isPlainRecord(value)) return false;
  if (value.schemaVersion !== 1) return false;
  if (typeof value.updatedAtMs !== 'number' || !Number.isSafeInteger(value.updatedAtMs) || value.updatedAtMs < 0) {
    return false;
  }
  if (!Array.isArray(value.pageBookmarks) || value.pageBookmarks.length > 604 || !value.pageBookmarks.every(isValidPage)) {
    return false;
  }
  if (!Array.isArray(value.ribbons) || value.ribbons.length > 16) {
    return false;
  }
  if (value.lastPage !== null) {
    if (!isPlainRecord(value.lastPage) || !isValidPage(value.lastPage.page) || typeof value.lastPage.updatedAtMs !== 'number') {
      return false;
    }
  }
  const nullableBoundedString = (field: unknown, maxLen: number) =>
    field === null || (typeof field === 'string' && field.length <= maxLen);

  return (
    nullableBoundedString(value.lastReadingPositionRaw, 2_000) &&
    nullableBoundedString(value.readingKhatmasRaw, 48_000) &&
    nullableBoundedString(value.adhkarProgressRaw, 48_000) &&
    nullableBoundedString(value.seerahV2Raw, 16_000) &&
    nullableBoundedString(value.videoSeriesRaw, 48_000)
  );
}

function pruneAdhkarRawForSync(raw: string | null): string | null {
  if (!raw) return null;
  const parsed = safeJsonParse(raw);
  if (!isPlainRecord(parsed)) return null;
  const countsByDate = isPlainRecord(parsed.countsByDate) ? parsed.countsByDate : {};
  const recentDates = Object.keys(countsByDate)
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 90);
  const prunedCounts: Record<string, unknown> = {};
  for (const dateKey of recentDates) {
    prunedCounts[dateKey] = countsByDate[dateKey];
  }
  return JSON.stringify({
    ...parsed,
    countsByDate: prunedCounts,
  });
}

export function captureAuxiliaryDomainSnapshot(
  getRawItem: (key: string) => string | null,
  nowMs: number = Date.now()
): AuxiliaryDomainSnapshotV1 {
  const bookmarksParsed = safeJsonParse(getRawItem(SYNCED_AUXILIARY_KEYS.PAGE_BOOKMARKS));
  const ribbonsParsed = safeJsonParse(getRawItem(SYNCED_AUXILIARY_KEYS.RIBBONS));
  const lastPageRaw = getRawItem(SYNCED_AUXILIARY_KEYS.LAST_PAGE);
  const lastPageNum = lastPageRaw ? Number(lastPageRaw) : NaN;

  return {
    schemaVersion: 1,
    updatedAtMs: Math.max(0, Math.trunc(nowMs)),
    pageBookmarks: sanitizePageBookmarks(bookmarksParsed),
    ribbons: sanitizeRibbons(ribbonsParsed),
    lastPage: isValidPage(lastPageNum) ? { page: lastPageNum, updatedAtMs: Math.max(0, Math.trunc(nowMs)) } : null,
    lastReadingPositionRaw: getRawItem(SYNCED_AUXILIARY_KEYS.LAST_READING_POS)?.slice(0, 2_000) ?? null,
    readingKhatmasRaw: getRawItem(SYNCED_AUXILIARY_KEYS.READING_KHATMAS_V2)?.slice(0, 48_000) ?? null,
    adhkarProgressRaw: pruneAdhkarRawForSync(getRawItem(SYNCED_AUXILIARY_KEYS.ADHKAR_PROGRESS)),
    seerahV2Raw: getRawItem(SYNCED_AUXILIARY_KEYS.SEERAH_V2)?.slice(0, 16_000) ?? null,
    videoSeriesRaw: getRawItem(SYNCED_AUXILIARY_KEYS.VIDEO_SERIES)?.slice(0, 48_000) ?? null,
  };
}

function mergeReadingKhatmasJson(localRaw: string | null, remoteRaw: string | null): string | null {
  if (!localRaw) return remoteRaw;
  if (!remoteRaw) return localRaw;
  const localObj = safeJsonParse(localRaw);
  const remoteObj = safeJsonParse(remoteRaw);
  if (!isPlainRecord(localObj)) return remoteRaw;
  if (!isPlainRecord(remoteObj)) return localRaw;

  const localKhatmas = Array.isArray(localObj.khatmas) ? localObj.khatmas.filter(isPlainRecord) : [];
  const remoteKhatmas = Array.isArray(remoteObj.khatmas) ? remoteObj.khatmas.filter(isPlainRecord) : [];
  const byId = new Map<string, Record<string, unknown>>();

  for (const item of localKhatmas) {
    if (typeof item.id === 'string') byId.set(item.id, item);
  }
  for (const rItem of remoteKhatmas) {
    if (typeof rItem.id !== 'string') continue;
    const lItem = byId.get(rItem.id);
    if (!lItem) {
      byId.set(rItem.id, rItem);
      continue;
    }
    const mergedPages = sanitizePageBookmarks([
      ...(Array.isArray(lItem.completedPages) ? lItem.completedPages : []),
      ...(Array.isArray(rItem.completedPages) ? rItem.completedPages : []),
    ]);
    const logMap = new Map<string, number[]>();
    for (const srcLogs of [lItem.dailyLogs, rItem.dailyLogs]) {
      if (!Array.isArray(srcLogs)) continue;
      for (const entry of srcLogs) {
        if (isPlainRecord(entry) && typeof entry.date === 'string' && Array.isArray(entry.pages)) {
          const prev = logMap.get(entry.date) || [];
          logMap.set(entry.date, sanitizePageBookmarks([...prev, ...entry.pages]));
        }
      }
    }
    const cycleMap = new Map<string, Record<string, unknown>>();
    for (const srcCycles of [lItem.completedCycles, rItem.completedCycles]) {
      if (!Array.isArray(srcCycles)) continue;
      for (const c of srcCycles) {
        if (isPlainRecord(c) && typeof c.id === 'string') cycleMap.set(c.id, c);
      }
    }
    const remoteNewer = parseIsoMs(rItem.lastReadAt) >= parseIsoMs(lItem.lastReadAt);
    const primary = remoteNewer ? rItem : lItem;
    const secondary = remoteNewer ? lItem : rItem;
    byId.set(rItem.id, {
      ...secondary,
      ...primary,
      completedPages: mergedPages,
      completedCycles: [...cycleMap.values()],
      dailyLogs: [...logMap.entries()]
        .map(([date, pages]) => ({ date, pages }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  }

  const cycleUnion = new Map<string, Record<string, unknown>>();
  for (const srcCycles of [localObj.completedCycles, remoteObj.completedCycles]) {
    if (!Array.isArray(srcCycles)) continue;
    for (const c of srcCycles) {
      if (isPlainRecord(c) && typeof c.id === 'string') cycleUnion.set(c.id, c);
    }
  }

  const mergedKhatmas = [...byId.values()];
  const activeKhatmaId =
    (typeof remoteObj.activeKhatmaId === 'string' && byId.has(remoteObj.activeKhatmaId)
      ? remoteObj.activeKhatmaId
      : null) ??
    (typeof localObj.activeKhatmaId === 'string' && byId.has(localObj.activeKhatmaId)
      ? localObj.activeKhatmaId
      : null) ??
    (mergedKhatmas[0]?.id as string | undefined) ??
    null;

  return JSON.stringify({
    schemaVersion: 2,
    activeKhatmaId,
    khatmas: mergedKhatmas,
    completedCycles: [...cycleUnion.values()],
  });
}

function mergeAdhkarJson(localRaw: string | null, remoteRaw: string | null): string | null {
  if (!localRaw) return remoteRaw;
  if (!remoteRaw) return localRaw;
  const localObj = safeJsonParse(localRaw);
  const remoteObj = safeJsonParse(remoteRaw);
  if (!isPlainRecord(localObj)) return remoteRaw;
  if (!isPlainRecord(remoteObj)) return localRaw;

  const favoriteIds = [
    ...new Set([
      ...(Array.isArray(localObj.favoriteIds) ? localObj.favoriteIds.filter((x): x is string => typeof x === 'string') : []),
      ...(Array.isArray(remoteObj.favoriteIds) ? remoteObj.favoriteIds.filter((x): x is string => typeof x === 'string') : []),
    ]),
  ];

  const allDates = new Set<string>([
    ...(isPlainRecord(localObj.countsByDate) ? Object.keys(localObj.countsByDate) : []),
    ...(isPlainRecord(remoteObj.countsByDate) ? Object.keys(remoteObj.countsByDate) : []),
  ]);
  const countsByDate: Record<string, Record<string, number>> = {};
  for (const dateKey of [...allDates].sort((a, b) => b.localeCompare(a)).slice(0, 90)) {
    const lDay = isPlainRecord(localObj.countsByDate) && isPlainRecord(localObj.countsByDate[dateKey])
      ? (localObj.countsByDate[dateKey] as Record<string, unknown>)
      : {};
    const rDay = isPlainRecord(remoteObj.countsByDate) && isPlainRecord(remoteObj.countsByDate[dateKey])
      ? (remoteObj.countsByDate[dateKey] as Record<string, unknown>)
      : {};
    const mergedDay: Record<string, number> = {};
    for (const itemId of new Set([...Object.keys(lDay), ...Object.keys(rDay)])) {
      const lVal = typeof lDay[itemId] === 'number' && Number.isFinite(lDay[itemId]) ? Math.max(0, Math.trunc(lDay[itemId] as number)) : 0;
      const rVal = typeof rDay[itemId] === 'number' && Number.isFinite(rDay[itemId]) ? Math.max(0, Math.trunc(rDay[itemId] as number)) : 0;
      if (Math.max(lVal, rVal) > 0) mergedDay[itemId] = Math.max(lVal, rVal);
    }
    if (Object.keys(mergedDay).length > 0) countsByDate[dateKey] = mergedDay;
  }

  const lTasbih = isPlainRecord(localObj.freeTasbih) ? localObj.freeTasbih : {};
  const rTasbih = isPlainRecord(remoteObj.freeTasbih) ? remoteObj.freeTasbih : {};
  const lLife = typeof lTasbih.totalLifetimeCount === 'number' ? lTasbih.totalLifetimeCount : 0;
  const rLife = typeof rTasbih.totalLifetimeCount === 'number' ? rTasbih.totalLifetimeCount : 0;
  const primaryTasbih = rLife >= lLife ? rTasbih : lTasbih;

  return JSON.stringify({
    schemaVersion: 1,
    countsByDate,
    favoriteIds,
    freeTasbih: {
      presetId: typeof primaryTasbih.presetId === 'string' ? primaryTasbih.presetId : 'subhanallah_wabihamdihi',
      currentCount: Math.max(
        typeof lTasbih.currentCount === 'number' ? lTasbih.currentCount : 0,
        typeof rTasbih.currentCount === 'number' ? rTasbih.currentCount : 0
      ),
      targetCount: typeof primaryTasbih.targetCount === 'number' ? primaryTasbih.targetCount : 100,
      totalLifetimeCount: Math.max(lLife, rLife),
    },
    readingPrefs: isPlainRecord(localObj.readingPrefs)
      ? localObj.readingPrefs
      : isPlainRecord(remoteObj.readingPrefs)
        ? remoteObj.readingPrefs
        : { fontScale: 'md', showVirtueAndSource: true, autoAdvance: true },
  });
}

function mergeSeerahV2Json(localRaw: string | null, remoteRaw: string | null): string | null {
  if (!localRaw) return remoteRaw;
  if (!remoteRaw) return localRaw;
  const localObj = safeJsonParse(localRaw);
  const remoteObj = safeJsonParse(remoteRaw);
  if (!isPlainRecord(localObj)) return remoteRaw;
  if (!isPlainRecord(remoteObj)) return localRaw;

  const completedChapterIds = [
    ...new Set([
      ...(Array.isArray(localObj.completedChapterIds) ? localObj.completedChapterIds.filter((x): x is string => typeof x === 'string') : []),
      ...(Array.isArray(remoteObj.completedChapterIds) ? remoteObj.completedChapterIds.filter((x): x is string => typeof x === 'string') : []),
    ]),
  ].sort();

  const lPos = isPlainRecord(localObj.lastPosition) ? localObj.lastPosition : null;
  const rPos = isPlainRecord(remoteObj.lastPosition) ? remoteObj.lastPosition : null;
  const lastPosition =
    lPos && rPos
      ? parseIsoMs(rPos.updatedAt) >= parseIsoMs(lPos.updatedAt)
        ? rPos
        : lPos
      : rPos || lPos;

  return JSON.stringify({
    schemaVersion: 2,
    fontSize: typeof localObj.fontSize === 'string' ? localObj.fontSize : remoteObj.fontSize || 'md',
    completedChapterIds,
    lastPosition,
  });
}

function mergeVideoSeriesJson(localRaw: string | null, remoteRaw: string | null): string | null {
  if (!localRaw) return remoteRaw;
  if (!remoteRaw) return localRaw;
  const localObj = safeJsonParse(localRaw);
  const remoteObj = safeJsonParse(remoteRaw);
  if (!isPlainRecord(localObj)) return remoteRaw;
  if (!isPlainRecord(remoteObj)) return localRaw;

  const customMap = new Map<string, unknown>();
  for (const list of [localObj.customSeries, remoteObj.customSeries]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (isPlainRecord(item) && typeof item.id === 'string') customMap.set(item.id, item);
    }
  }

  const lProgMap = isPlainRecord(localObj.progressBySeries) ? localObj.progressBySeries : {};
  const rProgMap = isPlainRecord(remoteObj.progressBySeries) ? remoteObj.progressBySeries : {};
  const mergedProgress: Record<string, unknown> = {};

  for (const seriesId of new Set([...Object.keys(lProgMap), ...Object.keys(rProgMap)])) {
    const lProg = isPlainRecord(lProgMap[seriesId]) ? lProgMap[seriesId] : null;
    const rProg = isPlainRecord(rProgMap[seriesId]) ? rProgMap[seriesId] : null;
    if (!lProg) {
      mergedProgress[seriesId] = rProg;
      continue;
    }
    if (!rProg) {
      mergedProgress[seriesId] = lProg;
      continue;
    }
    const completedVideoIds = [
      ...new Set([
        ...(Array.isArray(lProg.completedVideoIds) ? lProg.completedVideoIds.filter((x): x is string => typeof x === 'string') : []),
        ...(Array.isArray(rProg.completedVideoIds) ? rProg.completedVideoIds.filter((x): x is string => typeof x === 'string') : []),
      ]),
    ];
    const completedSet = new Set(completedVideoIds);
    const inProgressVideoIds = [
      ...new Set([
        ...(Array.isArray(lProg.inProgressVideoIds) ? lProg.inProgressVideoIds.filter((x): x is string => typeof x === 'string') : []),
        ...(Array.isArray(rProg.inProgressVideoIds) ? rProg.inProgressVideoIds.filter((x): x is string => typeof x === 'string') : []),
      ]),
    ].filter((id) => !completedSet.has(id));

    const remoteNewer = parseIsoMs(rProg.lastUpdatedAt) >= parseIsoMs(lProg.lastUpdatedAt);
    const primary = remoteNewer ? rProg : lProg;
    const secondary = remoteNewer ? lProg : rProg;
    const videoNotes = {
      ...(isPlainRecord(secondary.videoNotes) ? secondary.videoNotes : {}),
      ...(isPlainRecord(primary.videoNotes) ? primary.videoNotes : {}),
    };

    mergedProgress[seriesId] = {
      completedVideoIds,
      inProgressVideoIds,
      lastWatchedVideoId: primary.lastWatchedVideoId ?? secondary.lastWatchedVideoId,
      videoNotes,
      lastUpdatedAt: primary.lastUpdatedAt ?? secondary.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  return JSON.stringify({
    schemaVersion: 1,
    featuredSeriesId: remoteObj.featuredSeriesId ?? localObj.featuredSeriesId ?? 'seerah-suwaidan',
    dailySelection: localObj.dailySelection ?? remoteObj.dailySelection ?? null,
    progressBySeries: mergedProgress,
    customSeries: [...customMap.values()],
  });
}

/**
 * Deterministic, commutative/idempotent CRDT merge across all auxiliary user domains.
 * Never drops completed Khatma pages, bookmarks, ribbons, Seerah chapters, Adhkar favorites, or watched lessons.
 */
export function mergeAuxiliaryDomainSnapshots(
  local: AuxiliaryDomainSnapshotV1,
  remote: AuxiliaryDomainSnapshotV1
): AuxiliaryDomainSnapshotV1 {
  const pageBookmarks = sanitizePageBookmarks([...local.pageBookmarks, ...remote.pageBookmarks]);

  const localRibbons = sanitizeRibbons(local.ribbons);
  const remoteRibbons = sanitizeRibbons(remote.ribbons);
  const remoteRibbonById = new Map(remoteRibbons.map((r) => [r.id, r]));
  const ribbons = localRibbons.map((lRib) => {
    const rRib = remoteRibbonById.get(lRib.id);
    if (!rRib) return lRib;
    return rRib.updatedAtMs >= lRib.updatedAtMs ? rRib : lRib;
  });

  let lastPage = local.lastPage;
  if (remote.lastPage && (!local.lastPage || remote.lastPage.updatedAtMs >= local.lastPage.updatedAtMs)) {
    lastPage = remote.lastPage;
  }

  const remoteIsNewerOverall = remote.updatedAtMs >= local.updatedAtMs;
  const lastReadingPositionRaw = remoteIsNewerOverall
    ? remote.lastReadingPositionRaw ?? local.lastReadingPositionRaw
    : local.lastReadingPositionRaw ?? remote.lastReadingPositionRaw;

  return {
    schemaVersion: 1,
    updatedAtMs: Math.max(local.updatedAtMs, remote.updatedAtMs),
    pageBookmarks,
    ribbons,
    lastPage,
    lastReadingPositionRaw,
    readingKhatmasRaw: mergeReadingKhatmasJson(local.readingKhatmasRaw, remote.readingKhatmasRaw),
    adhkarProgressRaw: mergeAdhkarJson(local.adhkarProgressRaw, remote.adhkarProgressRaw),
    seerahV2Raw: mergeSeerahV2Json(local.seerahV2Raw, remote.seerahV2Raw),
    videoSeriesRaw: mergeVideoSeriesJson(local.videoSeriesRaw, remote.videoSeriesRaw),
  };
}

export function applyMergedAuxiliaryDomainSnapshot(
  merged: AuxiliaryDomainSnapshotV1,
  setRawItem: (key: string, value: string) => boolean
): boolean {
  if (!setRawItem(SYNCED_AUXILIARY_KEYS.PAGE_BOOKMARKS, JSON.stringify(merged.pageBookmarks))) return false;
  if (!setRawItem(SYNCED_AUXILIARY_KEYS.RIBBONS, JSON.stringify(merged.ribbons))) return false;
  if (merged.lastPage && !setRawItem(SYNCED_AUXILIARY_KEYS.LAST_PAGE, String(merged.lastPage.page))) return false;
  if (merged.lastReadingPositionRaw !== null && !setRawItem(SYNCED_AUXILIARY_KEYS.LAST_READING_POS, merged.lastReadingPositionRaw)) {
    return false;
  }
  if (merged.readingKhatmasRaw !== null && !setRawItem(SYNCED_AUXILIARY_KEYS.READING_KHATMAS_V2, merged.readingKhatmasRaw)) {
    return false;
  }
  if (merged.adhkarProgressRaw !== null && !setRawItem(SYNCED_AUXILIARY_KEYS.ADHKAR_PROGRESS, merged.adhkarProgressRaw)) {
    return false;
  }
  if (merged.seerahV2Raw !== null && !setRawItem(SYNCED_AUXILIARY_KEYS.SEERAH_V2, merged.seerahV2Raw)) {
    return false;
  }
  if (merged.videoSeriesRaw !== null && !setRawItem(SYNCED_AUXILIARY_KEYS.VIDEO_SERIES, merged.videoSeriesRaw)) {
    return false;
  }
  return true;
}
