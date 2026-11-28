import { DEFAULT_MUSHAF_RIBBONS, type MushafRibbonBookmark, type MushafRibbonId } from './mushafRibbonBookmarksService';
import {
  SYNC_TOMBSTONES_STORAGE_KEY,
  isItemDeletedInLedger,
  mergeSyncTombstoneLedgers,
  normalizeSyncTombstoneLedger,
  type SyncTombstoneLedgerV1,
} from './syncTombstoneRegistry';

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
  TOMBSTONES: SYNC_TOMBSTONES_STORAGE_KEY,
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
  tombstoneLedger?: SyncTombstoneLedgerV1;
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
  const tombstonesParsed = safeJsonParse(getRawItem(SYNCED_AUXILIARY_KEYS.TOMBSTONES));

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
    tombstoneLedger: normalizeSyncTombstoneLedger(tombstonesParsed),
  };
}

function mergeReadingKhatmasJson(
  localRaw: string | null,
  remoteRaw: string | null,
  ledger: SyncTombstoneLedgerV1
): string | null {
  if (!localRaw && !remoteRaw) return null;
  const localObj = safeJsonParse(localRaw) ?? { schemaVersion: 2, activeKhatmaId: null, khatmas: [], completedCycles: [] };
  const remoteObj = safeJsonParse(remoteRaw) ?? { schemaVersion: 2, activeKhatmaId: null, khatmas: [], completedCycles: [] };
  if (!isPlainRecord(localObj) && !isPlainRecord(remoteObj)) return null;
  const safeLocal = isPlainRecord(localObj) ? localObj : {};
  const safeRemote = isPlainRecord(remoteObj) ? remoteObj : {};

  const localKhatmas = Array.isArray(safeLocal.khatmas) ? safeLocal.khatmas.filter(isPlainRecord) : [];
  const remoteKhatmas = Array.isArray(safeRemote.khatmas) ? safeRemote.khatmas.filter(isPlainRecord) : [];
  const byId = new Map<string, Record<string, unknown>>();

  const isKhatmaDeleted = (item: Record<string, unknown>): boolean => {
    if (typeof item.id !== 'string') return true;
    const startedMs = parseIsoMs(item.startedAt);
    return isItemDeletedInLedger(ledger, 'readingKhatmas', item.id, startedMs);
  };

  const filterPagesWithTombstones = (khatmaId: string, pages: number[]): number[] =>
    pages.filter((page) => !isItemDeletedInLedger(ledger, 'khatmaPages', `${khatmaId}:${page}`));

  for (const item of localKhatmas) {
    if (typeof item.id === 'string' && !isKhatmaDeleted(item)) {
      const filteredPages = filterPagesWithTombstones(
        item.id,
        sanitizePageBookmarks(Array.isArray(item.completedPages) ? item.completedPages : [])
      );
      const filteredLogs = Array.isArray(item.dailyLogs)
        ? item.dailyLogs
            .filter(isPlainRecord)
            .map((entry) => ({
              date: String(entry.date || ''),
              pages: filterPagesWithTombstones(item.id as string, sanitizePageBookmarks(entry.pages)),
            }))
            .filter((entry) => entry.date && entry.pages.length > 0)
        : [];
      byId.set(item.id, { ...item, completedPages: filteredPages, dailyLogs: filteredLogs });
    }
  }

  for (const rItem of remoteKhatmas) {
    if (typeof rItem.id !== 'string' || isKhatmaDeleted(rItem)) continue;
    const rFilteredPages = filterPagesWithTombstones(
      rItem.id,
      sanitizePageBookmarks(Array.isArray(rItem.completedPages) ? rItem.completedPages : [])
    );
    const lItem = byId.get(rItem.id);
    if (!lItem) {
      const rFilteredLogs = Array.isArray(rItem.dailyLogs)
        ? rItem.dailyLogs
            .filter(isPlainRecord)
            .map((entry) => ({
              date: String(entry.date || ''),
              pages: filterPagesWithTombstones(rItem.id as string, sanitizePageBookmarks(entry.pages)),
            }))
            .filter((entry) => entry.date && entry.pages.length > 0)
        : [];
      byId.set(rItem.id, { ...rItem, completedPages: rFilteredPages, dailyLogs: rFilteredLogs });
      continue;
    }
    const mergedPages = filterPagesWithTombstones(
      rItem.id,
      sanitizePageBookmarks([
        ...(Array.isArray(lItem.completedPages) ? lItem.completedPages : []),
        ...rFilteredPages,
      ])
    );
    const logMap = new Map<string, number[]>();
    for (const srcLogs of [lItem.dailyLogs, rItem.dailyLogs]) {
      if (!Array.isArray(srcLogs)) continue;
      for (const entry of srcLogs) {
        if (isPlainRecord(entry) && typeof entry.date === 'string' && Array.isArray(entry.pages)) {
          const prev = logMap.get(entry.date) || [];
          const cleanPages = filterPagesWithTombstones(
            rItem.id,
            sanitizePageBookmarks([...prev, ...entry.pages])
          );
          if (cleanPages.length > 0) {
            logMap.set(entry.date, cleanPages);
          }
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
  for (const srcCycles of [safeLocal.completedCycles, safeRemote.completedCycles]) {
    if (!Array.isArray(srcCycles)) continue;
    for (const c of srcCycles) {
      if (isPlainRecord(c) && typeof c.id === 'string' && !isItemDeletedInLedger(ledger, 'readingKhatmas', c.id)) {
        cycleUnion.set(c.id, c);
      }
    }
  }

  const mergedKhatmas = [...byId.values()];
  const activeKhatmaId =
    (typeof safeRemote.activeKhatmaId === 'string' && byId.has(safeRemote.activeKhatmaId)
      ? safeRemote.activeKhatmaId
      : null) ??
    (typeof safeLocal.activeKhatmaId === 'string' && byId.has(safeLocal.activeKhatmaId)
      ? safeLocal.activeKhatmaId
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

function mergeAdhkarJson(
  localRaw: string | null,
  remoteRaw: string | null,
  ledger: SyncTombstoneLedgerV1
): string | null {
  if (!localRaw && !remoteRaw) return null;
  const localObj = safeJsonParse(localRaw) ?? {};
  const remoteObj = safeJsonParse(remoteRaw) ?? {};
  if (!isPlainRecord(localObj) && !isPlainRecord(remoteObj)) return null;
  const safeLocal = isPlainRecord(localObj) ? localObj : {};
  const safeRemote = isPlainRecord(remoteObj) ? remoteObj : {};

  const favoriteIds = [
    ...new Set([
      ...(Array.isArray(safeLocal.favoriteIds) ? safeLocal.favoriteIds.filter((x): x is string => typeof x === 'string') : []),
      ...(Array.isArray(safeRemote.favoriteIds) ? safeRemote.favoriteIds.filter((x): x is string => typeof x === 'string') : []),
    ]),
  ].filter((id) => !isItemDeletedInLedger(ledger, 'adhkarFavorites', id));

  const allDates = new Set<string>([
    ...(isPlainRecord(safeLocal.countsByDate) ? Object.keys(safeLocal.countsByDate) : []),
    ...(isPlainRecord(safeRemote.countsByDate) ? Object.keys(safeRemote.countsByDate) : []),
  ]);
  const countsByDate: Record<string, Record<string, number>> = {};
  for (const dateKey of [...allDates].sort((a, b) => b.localeCompare(a)).slice(0, 90)) {
    const lDay = isPlainRecord(safeLocal.countsByDate) && isPlainRecord(safeLocal.countsByDate[dateKey])
      ? (safeLocal.countsByDate[dateKey] as Record<string, unknown>)
      : {};
    const rDay = isPlainRecord(safeRemote.countsByDate) && isPlainRecord(safeRemote.countsByDate[dateKey])
      ? (safeRemote.countsByDate[dateKey] as Record<string, unknown>)
      : {};
    const mergedDay: Record<string, number> = {};
    for (const itemId of new Set([...Object.keys(lDay), ...Object.keys(rDay)])) {
      if (isItemDeletedInLedger(ledger, 'adhkarCounts', `${dateKey}:${itemId}`)) {
        continue;
      }
      const lVal = typeof lDay[itemId] === 'number' && Number.isFinite(lDay[itemId]) ? Math.max(0, Math.trunc(lDay[itemId] as number)) : 0;
      const rVal = typeof rDay[itemId] === 'number' && Number.isFinite(rDay[itemId]) ? Math.max(0, Math.trunc(rDay[itemId] as number)) : 0;
      if (Math.max(lVal, rVal) > 0) mergedDay[itemId] = Math.max(lVal, rVal);
    }
    if (Object.keys(mergedDay).length > 0) countsByDate[dateKey] = mergedDay;
  }

  const lTasbih = isPlainRecord(safeLocal.freeTasbih) ? safeLocal.freeTasbih : {};
  const rTasbih = isPlainRecord(safeRemote.freeTasbih) ? safeRemote.freeTasbih : {};
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
    readingPrefs: isPlainRecord(safeLocal.readingPrefs)
      ? safeLocal.readingPrefs
      : isPlainRecord(safeRemote.readingPrefs)
        ? safeRemote.readingPrefs
        : { fontScale: 'md', showVirtueAndSource: true, autoAdvance: true },
  });
}

function mergeSeerahV2Json(
  localRaw: string | null,
  remoteRaw: string | null,
  ledger: SyncTombstoneLedgerV1
): string | null {
  if (!localRaw && !remoteRaw) return null;
  const localObj = safeJsonParse(localRaw) ?? {};
  const remoteObj = safeJsonParse(remoteRaw) ?? {};
  if (!isPlainRecord(localObj) && !isPlainRecord(remoteObj)) return null;
  const safeLocal = isPlainRecord(localObj) ? localObj : {};
  const safeRemote = isPlainRecord(remoteObj) ? remoteObj : {};

  const completedChapterIds = [
    ...new Set([
      ...(Array.isArray(safeLocal.completedChapterIds) ? safeLocal.completedChapterIds.filter((x): x is string => typeof x === 'string') : []),
      ...(Array.isArray(safeRemote.completedChapterIds) ? safeRemote.completedChapterIds.filter((x): x is string => typeof x === 'string') : []),
    ]),
  ]
    .filter((chapterId) => !isItemDeletedInLedger(ledger, 'seerahChapters', chapterId))
    .sort();

  const lPos = isPlainRecord(safeLocal.lastPosition) ? safeLocal.lastPosition : null;
  const rPos = isPlainRecord(safeRemote.lastPosition) ? safeRemote.lastPosition : null;
  const lastPosition =
    lPos && rPos
      ? parseIsoMs(rPos.updatedAt) >= parseIsoMs(lPos.updatedAt)
        ? rPos
        : lPos
      : rPos || lPos;

  return JSON.stringify({
    schemaVersion: 2,
    fontSize: typeof safeLocal.fontSize === 'string' ? safeLocal.fontSize : safeRemote.fontSize || 'md',
    completedChapterIds,
    lastPosition,
  });
}

function mergeVideoSeriesJson(
  localRaw: string | null,
  remoteRaw: string | null,
  ledger: SyncTombstoneLedgerV1
): string | null {
  if (!localRaw && !remoteRaw) return null;
  const localObj = safeJsonParse(localRaw) ?? {};
  const remoteObj = safeJsonParse(remoteRaw) ?? {};
  if (!isPlainRecord(localObj) && !isPlainRecord(remoteObj)) return null;
  const safeLocal = isPlainRecord(localObj) ? localObj : {};
  const safeRemote = isPlainRecord(remoteObj) ? remoteObj : {};

  const customMap = new Map<string, unknown>();
  for (const list of [safeLocal.customSeries, safeRemote.customSeries]) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (
        isPlainRecord(item) &&
        typeof item.id === 'string' &&
        !isItemDeletedInLedger(ledger, 'customVideoSeries', item.id)
      ) {
        customMap.set(item.id, item);
      }
    }
  }

  const lProgMap = isPlainRecord(safeLocal.progressBySeries) ? safeLocal.progressBySeries : {};
  const rProgMap = isPlainRecord(safeRemote.progressBySeries) ? safeRemote.progressBySeries : {};
  const mergedProgress: Record<string, unknown> = {};

  for (const seriesId of new Set([...Object.keys(lProgMap), ...Object.keys(rProgMap)])) {
    if (seriesId.startsWith('custom:') && isItemDeletedInLedger(ledger, 'customVideoSeries', seriesId)) {
      continue;
    }
    const lProg = isPlainRecord(lProgMap[seriesId]) ? lProgMap[seriesId] : null;
    const rProg = isPlainRecord(rProgMap[seriesId]) ? rProgMap[seriesId] : null;
    const baseProg = lProg || rProg;
    if (!baseProg) continue;

    const completedVideoIds = [
      ...new Set([
        ...(lProg && Array.isArray(lProg.completedVideoIds) ? lProg.completedVideoIds.filter((x): x is string => typeof x === 'string') : []),
        ...(rProg && Array.isArray(rProg.completedVideoIds) ? rProg.completedVideoIds.filter((x): x is string => typeof x === 'string') : []),
      ]),
    ].filter((videoId) => !isItemDeletedInLedger(ledger, 'watchedVideos', `${seriesId}:${videoId}`));

    const completedSet = new Set(completedVideoIds);
    const inProgressVideoIds = [
      ...new Set([
        ...(lProg && Array.isArray(lProg.inProgressVideoIds) ? lProg.inProgressVideoIds.filter((x): x is string => typeof x === 'string') : []),
        ...(rProg && Array.isArray(rProg.inProgressVideoIds) ? rProg.inProgressVideoIds.filter((x): x is string => typeof x === 'string') : []),
      ]),
    ].filter((id) => !completedSet.has(id) && !isItemDeletedInLedger(ledger, 'watchedVideos', `${seriesId}:${id}`));

    const remoteNewer =
      lProg && rProg ? parseIsoMs(rProg.lastUpdatedAt) >= parseIsoMs(lProg.lastUpdatedAt) : Boolean(rProg);
    const primary = (remoteNewer ? rProg : lProg) || baseProg;
    const secondary = (remoteNewer ? lProg : rProg) || baseProg;
    const rawVideoNotes = {
      ...(isPlainRecord(secondary.videoNotes) ? secondary.videoNotes : {}),
      ...(isPlainRecord(primary.videoNotes) ? primary.videoNotes : {}),
    };
    const videoNotes: Record<string, unknown> = {};
    for (const [vid, note] of Object.entries(rawVideoNotes)) {
      if (!isItemDeletedInLedger(ledger, 'videoNotes', `${seriesId}:${vid}`)) {
        videoNotes[vid] = note;
      }
    }

    mergedProgress[seriesId] = {
      completedVideoIds,
      inProgressVideoIds,
      lastWatchedVideoId: primary.lastWatchedVideoId ?? secondary.lastWatchedVideoId,
      videoNotes,
      lastUpdatedAt: primary.lastUpdatedAt ?? secondary.lastUpdatedAt ?? new Date().toISOString(),
    };
  }

  const candidateFeatured = safeRemote.featuredSeriesId ?? safeLocal.featuredSeriesId ?? 'bina-al-nafs-al-mutmainnah';
  const featuredSeriesId =
    typeof candidateFeatured === 'string' &&
    !(candidateFeatured.startsWith('custom:') && isItemDeletedInLedger(ledger, 'customVideoSeries', candidateFeatured))
      ? candidateFeatured
      : 'bina-al-nafs-al-mutmainnah';

  return JSON.stringify({
    schemaVersion: 1,
    featuredSeriesId,
    dailySelection: safeLocal.dailySelection ?? safeRemote.dailySelection ?? null,
    progressBySeries: mergedProgress,
    customSeries: [...customMap.values()],
  });
}

/**
 * Deterministic, commutative/idempotent LWW-Element-Set CRDT merge across all auxiliary user domains.
 * Preserves concurrent additions AND honors explicit deletions/unmarks via `SyncTombstoneLedgerV1`.
 */
export function mergeAuxiliaryDomainSnapshots(
  local: AuxiliaryDomainSnapshotV1,
  remote: AuxiliaryDomainSnapshotV1,
  externalLedger?: SyncTombstoneLedgerV1
): AuxiliaryDomainSnapshotV1 {
  const mergedLedger = externalLedger
    ? mergeSyncTombstoneLedgers(
        mergeSyncTombstoneLedgers(local.tombstoneLedger, remote.tombstoneLedger),
        externalLedger
      )
    : mergeSyncTombstoneLedgers(local.tombstoneLedger, remote.tombstoneLedger);

  const pageBookmarks = sanitizePageBookmarks([...local.pageBookmarks, ...remote.pageBookmarks]).filter(
    (page) => !isItemDeletedInLedger(mergedLedger, 'pageBookmarks', String(page))
  );

  const localRibbons = sanitizeRibbons(local.ribbons);
  const remoteRibbons = sanitizeRibbons(remote.ribbons);
  const remoteRibbonById = new Map(remoteRibbons.map((r) => [r.id, r]));
  const ribbons = localRibbons.map((lRib) => {
    const rRib = remoteRibbonById.get(lRib.id);
    const chosen = !rRib ? lRib : rRib.updatedAtMs >= lRib.updatedAtMs ? rRib : lRib;
    if (isItemDeletedInLedger(mergedLedger, 'ribbons', chosen.id, chosen.updatedAtMs)) {
      return {
        ...chosen,
        page: null,
        note: undefined,
        updatedAtMs: Math.max(chosen.updatedAtMs, mergedLedger.deletedAtMs.ribbons?.[chosen.id] ?? 0),
      };
    }
    return chosen;
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
    updatedAtMs: Math.max(local.updatedAtMs, remote.updatedAtMs, mergedLedger.updatedAtMs),
    pageBookmarks,
    ribbons,
    lastPage,
    lastReadingPositionRaw,
    readingKhatmasRaw: mergeReadingKhatmasJson(local.readingKhatmasRaw, remote.readingKhatmasRaw, mergedLedger),
    adhkarProgressRaw: mergeAdhkarJson(local.adhkarProgressRaw, remote.adhkarProgressRaw, mergedLedger),
    seerahV2Raw: mergeSeerahV2Json(local.seerahV2Raw, remote.seerahV2Raw, mergedLedger),
    videoSeriesRaw: mergeVideoSeriesJson(local.videoSeriesRaw, remote.videoSeriesRaw, mergedLedger),
    tombstoneLedger: mergedLedger,
  };
}

export function applyMergedAuxiliaryDomainSnapshot(
  merged: AuxiliaryDomainSnapshotV1,
  setRawItem: (key: string, value: string) => boolean
): boolean {
  if (merged.tombstoneLedger && !setRawItem(SYNCED_AUXILIARY_KEYS.TOMBSTONES, JSON.stringify(merged.tombstoneLedger))) {
    return false;
  }
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
