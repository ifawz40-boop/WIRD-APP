import { StorageService } from './storageService';

export const SEERAH_ENCYCLOPEDIA_STORAGE_KEY = 'wird.seerah.encyclopedia.v1';
export const SEERAH_ENCYCLOPEDIA_BASE_PATH = '/data/seerah-encyclopedia';
export const SEERAH_ENCYCLOPEDIA_CACHE_NAME = 'wird-app-content-v1';

export type SeerahEncyclopediaFontSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SeerahEncyclopediaChunkRef {
  chunkId: string;
  startPage: number;
  endPage: number;
}

export interface SeerahEncyclopediaVolumeMeta {
  volume: number;
  title: string;
  shortTitle: string;
  periodLabel: string;
  summary: string;
  sourcePdfName: string;
  sourcePdfTotalPages: number;
  firstPage: number;
  lastPage: number;
  pageCount: number;
  sectionCount: number;
  wordCount: number;
  chunkCount: number;
  chunks: SeerahEncyclopediaChunkRef[];
  searchIndexPath: string;
}

export interface SeerahCuratedChapterLink {
  volume: number;
  page: number;
  sectionId: string;
  chunkId: string;
  label: string;
}

export interface SeerahEncyclopediaManifest {
  schemaVersion: 1;
  encyclopediaVersion: string;
  title: string;
  classicalWork: string;
  author: string;
  editionAlignment: string;
  licenseNotice: string;
  totalVolumes: number;
  totalPages: number;
  totalSections: number;
  totalWords: number;
  totalChunks: number;
  volumes: SeerahEncyclopediaVolumeMeta[];
  curatedChapterLinks: Record<string, SeerahCuratedChapterLink>;
}

export interface SeerahEncyclopediaSection {
  id: string;
  volume: number;
  order: number;
  globalOrder: number;
  title: string;
  eraTag: string;
  startPage: number;
  endPage: number;
  pageCount: number;
  wordCount: number;
  chunkId: string;
  chunkIds: string[];
}

export interface SeerahEncyclopediaToc {
  schemaVersion: 1;
  encyclopediaVersion: string;
  totalSections: number;
  sections: SeerahEncyclopediaSection[];
}

export interface SeerahEncyclopediaPage {
  page: number;
  sectionId: string;
  paragraphs: string[];
}

export interface SeerahEncyclopediaChunk {
  chunkId: string;
  volume: number;
  startPage: number;
  endPage: number;
  pages: SeerahEncyclopediaPage[];
}

export interface SeerahEncyclopediaSearchEntry {
  p: number;
  s: string;
  c: string;
  t: string;
  x: string;
}

export interface SeerahEncyclopediaSearchIndex {
  volume: number;
  pageCount: number;
  entries: SeerahEncyclopediaSearchEntry[];
}

export interface SeerahEncyclopediaSearchHit {
  id: string;
  matchType: 'section' | 'page';
  volume: number;
  page: number;
  sectionId: string;
  sectionTitle: string;
  eraTag: string;
  snippet: string;
  matchCount: number;
}

export interface SeerahEncyclopediaBookmark {
  id: string;
  volume: number;
  page: number;
  sectionId: string;
  title: string;
  note?: string;
  createdAt: string;
}

export interface SeerahEncyclopediaLastPosition {
  volume: number;
  page: number;
  sectionId: string;
  updatedAt: string;
}

export interface SeerahEncyclopediaProgressStore {
  schemaVersion: 1;
  fontSize: SeerahEncyclopediaFontSize;
  focusMode: boolean;
  lastPosition: SeerahEncyclopediaLastPosition | null;
  readSectionIds: string[];
  bookmarks: SeerahEncyclopediaBookmark[];
}

export interface SeerahEncyclopediaOfflineStatus {
  supported: boolean;
  volume: number;
  cachedChunks: number;
  totalChunks: number;
  searchCached: boolean;
  complete: boolean;
}

const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeArabicSearchQuery(input: string): string {
  return input
    .replace(ARABIC_DIACRITICS_REGEX, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/[^\u0621-\u063A\u0641-\u064A0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// In-memory runtime caches for fast repeat navigation
let cachedManifest: SeerahEncyclopediaManifest | null = null;
let cachedToc: SeerahEncyclopediaToc | null = null;
const chunkCache = new Map<string, SeerahEncyclopediaChunk>();
const searchIndexCache = new Map<number, SeerahEncyclopediaSearchIndex>();

export function clearSeerahEncyclopediaMemoryCache(): void {
  cachedManifest = null;
  cachedToc = null;
  chunkCache.clear();
  searchIndexCache.clear();
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`تعذر تحميل بيانات موسوعة السيرة (${response.status}): ${url}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadSeerahEncyclopediaManifest(): Promise<SeerahEncyclopediaManifest> {
  if (cachedManifest) return cachedManifest;
  const data = await fetchJsonWithTimeout<SeerahEncyclopediaManifest>(
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/manifest.json`
  );
  cachedManifest = data;
  return data;
}

export async function loadSeerahEncyclopediaToc(): Promise<SeerahEncyclopediaToc> {
  if (cachedToc) return cachedToc;
  const data = await fetchJsonWithTimeout<SeerahEncyclopediaToc>(
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/toc.json`
  );
  cachedToc = data;
  return data;
}

export async function loadSeerahEncyclopediaChunk(chunkId: string): Promise<SeerahEncyclopediaChunk> {
  if (!/^vol-[1-4]-chunk-\d{2}$/.test(chunkId)) {
    throw new Error(`معرّف شريحة السيرة غير صالح: ${chunkId}`);
  }
  const existing = chunkCache.get(chunkId);
  if (existing) return existing;
  const data = await fetchJsonWithTimeout<SeerahEncyclopediaChunk>(
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/chunks/${chunkId}.json`
  );
  chunkCache.set(chunkId, data);
  return data;
}

export async function loadSeerahEncyclopediaSectionPages(
  section: SeerahEncyclopediaSection
): Promise<SeerahEncyclopediaPage[]> {
  const chunks = await Promise.all(section.chunkIds.map((cid) => loadSeerahEncyclopediaChunk(cid)));
  const pages: SeerahEncyclopediaPage[] = [];
  for (const chunk of chunks) {
    for (const page of chunk.pages) {
      if (page.sectionId === section.id || (page.page >= section.startPage && page.page <= section.endPage)) {
        pages.push(page);
      }
    }
  }
  // Deduplicate and sort by printed page number
  const byPage = new Map<number, SeerahEncyclopediaPage>();
  for (const p of pages) {
    if (!byPage.has(p.page)) byPage.set(p.page, p);
  }
  return Array.from(byPage.values()).sort((a, b) => a.page - b.page);
}

export async function loadSeerahEncyclopediaVolumeSearch(
  volume: number
): Promise<SeerahEncyclopediaSearchIndex> {
  if (![1, 2, 3, 4].includes(volume)) {
    throw new Error(`رقم المجلد غير صالح: ${volume}`);
  }
  const existing = searchIndexCache.get(volume);
  if (existing) return existing;
  const data = await fetchJsonWithTimeout<SeerahEncyclopediaSearchIndex>(
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/search/vol-${volume}-search.json`,
    25000
  );
  searchIndexCache.set(volume, data);
  return data;
}

export function findChunkIdForVolumePage(
  manifest: SeerahEncyclopediaManifest,
  volume: number,
  page: number
): { chunkId: string; resolvedPage: number } | null {
  const volMeta = manifest.volumes.find((v) => v.volume === volume);
  if (!volMeta || volMeta.chunks.length === 0) return null;
  const clampedPage = Math.max(volMeta.firstPage, Math.min(volMeta.lastPage, Math.floor(page)));
  const exact = volMeta.chunks.find(
    (ch) => clampedPage >= ch.startPage && clampedPage <= ch.endPage
  );
  if (exact) {
    return { chunkId: exact.chunkId, resolvedPage: clampedPage };
  }
  // Fallback to closest chunk
  const fallback =
    volMeta.chunks.find((ch) => ch.endPage >= clampedPage) ||
    volMeta.chunks[volMeta.chunks.length - 1];
  return { chunkId: fallback.chunkId, resolvedPage: Math.max(fallback.startPage, clampedPage) };
}

export function findSectionForVolumePage(
  toc: SeerahEncyclopediaToc,
  volume: number,
  page: number
): SeerahEncyclopediaSection | null {
  const volSections = toc.sections.filter((s) => s.volume === volume);
  if (volSections.length === 0) return null;
  const exact = volSections.find((s) => page >= s.startPage && page <= s.endPage);
  if (exact) return exact;
  // Nearest preceding section
  let best = volSections[0];
  for (const s of volSections) {
    if (s.startPage <= page) best = s;
    else break;
  }
  return best;
}

function buildSnippetFromNormalized(normalizedText: string, terms: string[]): string {
  const firstTerm = terms[0] || '';
  const idx = firstTerm ? normalizedText.indexOf(firstTerm) : 0;
  if (idx < 0) return normalizedText.slice(0, 180) + (normalizedText.length > 180 ? '…' : '');
  const start = Math.max(0, idx - 65);
  const end = Math.min(normalizedText.length, idx + firstTerm.length + 125);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < normalizedText.length ? '…' : '';
  return `${prefix}${normalizedText.slice(start, end).trim()}${suffix}`;
}

export function searchSeerahEncyclopediaSync(
  query: string,
  toc: SeerahEncyclopediaToc,
  loadedIndexes: SeerahEncyclopediaSearchIndex[],
  options: { volumeFilter?: number | 'all'; maxResults?: number } = {}
): SeerahEncyclopediaSearchHit[] {
  const normalized = normalizeArabicSearchQuery(query);
  if (normalized.length < 2) return [];
  const terms = normalized.split(' ').filter((t) => t.length >= 2);
  if (terms.length === 0) return [];

  const volumeFilter = options.volumeFilter ?? 'all';
  const maxResults = options.maxResults ?? 60;
  const sectionMap = new Map(toc.sections.map((s) => [s.id, s]));
  const hits: SeerahEncyclopediaSearchHit[] = [];

  // 1. Section title matches first (highest signal)
  for (const sec of toc.sections) {
    if (volumeFilter !== 'all' && sec.volume !== volumeFilter) continue;
    const normTitle = normalizeArabicSearchQuery(`${sec.title} ${sec.eraTag}`);
    if (terms.every((t) => normTitle.includes(t))) {
      hits.push({
        id: `sec:${sec.id}`,
        matchType: 'section',
        volume: sec.volume,
        page: sec.startPage,
        sectionId: sec.id,
        sectionTitle: sec.title,
        eraTag: sec.eraTag,
        snippet: `${sec.title} (${sec.eraTag} · ص ${sec.startPage}–${sec.endPage})`,
        matchCount: terms.length,
      });
    }
  }

  // 2. Full-text page matches across loaded volume indexes
  for (const idx of loadedIndexes) {
    if (volumeFilter !== 'all' && idx.volume !== volumeFilter) continue;
    for (const entry of idx.entries) {
      if (hits.length >= maxResults) break;
      if (!terms.every((t) => entry.t.includes(t))) continue;
      const sec = sectionMap.get(entry.s);
      let count = 0;
      for (const term of terms) {
        let pos = 0;
        while ((pos = entry.t.indexOf(term, pos)) !== -1) {
          count++;
          pos += term.length;
          if (count > 25) break;
        }
      }
      hits.push({
        id: `pg:${idx.volume}:${entry.p}`,
        matchType: 'page',
        volume: idx.volume,
        page: entry.p,
        sectionId: entry.s,
        sectionTitle: sec?.title || `المجلد ${idx.volume}`,
        eraTag: sec?.eraTag || `المجلد ${idx.volume}`,
        snippet: buildSnippetFromNormalized(entry.t, terms),
        matchCount: count,
      });
    }
    if (hits.length >= maxResults) break;
  }

  return hits.slice(0, maxResults);
}

export async function searchSeerahEncyclopedia(
  query: string,
  toc: SeerahEncyclopediaToc,
  options: { volumeFilter?: number | 'all'; maxResults?: number } = {}
): Promise<SeerahEncyclopediaSearchHit[]> {
  const normalized = normalizeArabicSearchQuery(query);
  if (normalized.length < 2) return [];
  const volumeFilter = options.volumeFilter ?? 'all';
  const targetVolumes = volumeFilter === 'all' ? [1, 2, 3, 4] : [volumeFilter];
  const indexes = await Promise.all(
    targetVolumes.map((v) => loadSeerahEncyclopediaVolumeSearch(v))
  );
  return searchSeerahEncyclopediaSync(query, toc, indexes, options);
}

// ============================================================================
// Optional Offline Caching via Cache API (wird-app-content-v1)
// ============================================================================

export async function getSeerahVolumeOfflineStatus(
  manifest: SeerahEncyclopediaManifest,
  volume: number
): Promise<SeerahEncyclopediaOfflineStatus> {
  const volMeta = manifest.volumes.find((v) => v.volume === volume);
  const totalChunks = volMeta?.chunks.length ?? 0;
  if (typeof caches === 'undefined' || !volMeta) {
    return {
      supported: false,
      volume,
      cachedChunks: 0,
      totalChunks,
      searchCached: false,
      complete: false,
    };
  }
  try {
    const cache = await caches.open(SEERAH_ENCYCLOPEDIA_CACHE_NAME);
    let cachedChunks = 0;
    for (const ch of volMeta.chunks) {
      const url = `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/chunks/${ch.chunkId}.json`;
      if (await cache.match(url)) cachedChunks++;
    }
    const searchCached = Boolean(await cache.match(volMeta.searchIndexPath));
    return {
      supported: true,
      volume,
      cachedChunks,
      totalChunks,
      searchCached,
      complete: cachedChunks === totalChunks && searchCached,
    };
  } catch {
    return {
      supported: false,
      volume,
      cachedChunks: 0,
      totalChunks,
      searchCached: false,
      complete: false,
    };
  }
}

export async function cacheSeerahVolumeOffline(
  manifest: SeerahEncyclopediaManifest,
  volume: number,
  onProgress?: (completed: number, total: number) => void
): Promise<SeerahEncyclopediaOfflineStatus> {
  const volMeta = manifest.volumes.find((v) => v.volume === volume);
  if (!volMeta || typeof caches === 'undefined') {
    return getSeerahVolumeOfflineStatus(manifest, volume);
  }
  const cache = await caches.open(SEERAH_ENCYCLOPEDIA_CACHE_NAME);
  const urls = [
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/manifest.json`,
    `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/toc.json`,
    ...volMeta.chunks.map((ch) => `${SEERAH_ENCYCLOPEDIA_BASE_PATH}/chunks/${ch.chunkId}.json`),
    volMeta.searchIndexPath,
  ];

  let completed = 0;
  for (const url of urls) {
    const existing = await cache.match(url);
    if (!existing) {
      const resp = await fetch(url);
      if (resp.ok) {
        await cache.put(url, resp.clone());
      }
    }
    completed++;
    onProgress?.(completed, urls.length);
  }

  return getSeerahVolumeOfflineStatus(manifest, volume);
}

// ============================================================================
// UID-Scoped User Progress, Bookmarks & Reader Settings
// ============================================================================

function getScopedStorageKey(): string {
  return StorageService.resolveScopedKey(SEERAH_ENCYCLOPEDIA_STORAGE_KEY);
}

function createDefaultEncyclopediaStore(): SeerahEncyclopediaProgressStore {
  return {
    schemaVersion: 1,
    fontSize: 'md',
    focusMode: false,
    lastPosition: null,
    readSectionIds: [],
    bookmarks: [],
  };
}

export function readSeerahEncyclopediaStore(
  storage: Pick<Storage, 'getItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  try {
    const raw = storage.getItem(getScopedStorageKey());
    if (!raw) return createDefaultEncyclopediaStore();
    const parsed = JSON.parse(raw) as Partial<SeerahEncyclopediaProgressStore> | null;
    if (!parsed || parsed.schemaVersion !== 1) return createDefaultEncyclopediaStore();

    const fontSize: SeerahEncyclopediaFontSize =
      parsed.fontSize === 'sm' || parsed.fontSize === 'lg' || parsed.fontSize === 'xl'
        ? parsed.fontSize
        : 'md';

    const focusMode = Boolean(parsed.focusMode);

    let lastPosition: SeerahEncyclopediaLastPosition | null = null;
    if (
      parsed.lastPosition &&
      typeof parsed.lastPosition === 'object' &&
      [1, 2, 3, 4].includes(Number(parsed.lastPosition.volume)) &&
      Number.isInteger(parsed.lastPosition.page) &&
      parsed.lastPosition.page >= 1 &&
      typeof parsed.lastPosition.sectionId === 'string' &&
      parsed.lastPosition.sectionId.trim().length > 0
    ) {
      lastPosition = {
        volume: Number(parsed.lastPosition.volume),
        page: parsed.lastPosition.page,
        sectionId: parsed.lastPosition.sectionId,
        updatedAt:
          typeof parsed.lastPosition.updatedAt === 'string'
            ? parsed.lastPosition.updatedAt
            : new Date().toISOString(),
      };
    }

    const readSectionIds = Array.isArray(parsed.readSectionIds)
      ? [
          ...new Set(
            parsed.readSectionIds.filter(
              (id): id is string => typeof id === 'string' && /^v[1-4]-sec-\d{3}$/.test(id)
            )
          ),
        ]
      : [];

    const bookmarks: SeerahEncyclopediaBookmark[] = [];
    const seenIds = new Set<string>();
    if (Array.isArray(parsed.bookmarks)) {
      for (const bm of parsed.bookmarks) {
        if (
          !bm ||
          typeof bm !== 'object' ||
          ![1, 2, 3, 4].includes(Number(bm.volume)) ||
          !Number.isInteger(bm.page) ||
          bm.page < 1 ||
          typeof bm.sectionId !== 'string'
        ) {
          continue;
        }
        const id = `v${bm.volume}:p${bm.page}`;
        if (seenIds.has(id)) continue;
        seenIds.add(id);
        bookmarks.push({
          id,
          volume: Number(bm.volume),
          page: bm.page,
          sectionId: bm.sectionId,
          title:
            typeof bm.title === 'string' && bm.title.trim().length > 0
              ? bm.title.trim()
              : `المجلد ${bm.volume} · صفحة ${bm.page}`,
          note: typeof bm.note === 'string' && bm.note.trim().length > 0 ? bm.note.trim().slice(0, 500) : undefined,
          createdAt: typeof bm.createdAt === 'string' ? bm.createdAt : new Date().toISOString(),
        });
      }
    }

    return {
      schemaVersion: 1,
      fontSize,
      focusMode,
      lastPosition,
      readSectionIds,
      bookmarks,
    };
  } catch {
    return createDefaultEncyclopediaStore();
  }
}

function persistEncyclopediaStore(
  store: SeerahEncyclopediaProgressStore,
  storage: Pick<Storage, 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  try {
    storage.setItem(getScopedStorageKey(), JSON.stringify(store));
  } catch {
    // Keep reading active when storage is restricted
  }
  return store;
}

export function saveEncyclopediaPosition(
  volume: number,
  page: number,
  sectionId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  if (![1, 2, 3, 4].includes(volume) || !Number.isInteger(page) || page < 1) return store;
  return persistEncyclopediaStore(
    {
      ...store,
      lastPosition: {
        volume,
        page,
        sectionId,
        updatedAt: new Date().toISOString(),
      },
    },
    storage
  );
}

export function toggleEncyclopediaSectionRead(
  sectionId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  if (!/^v[1-4]-sec-\d{3}$/.test(sectionId)) return store;
  const exists = store.readSectionIds.includes(sectionId);
  const readSectionIds = exists
    ? store.readSectionIds.filter((id) => id !== sectionId)
    : [...store.readSectionIds, sectionId];
  return persistEncyclopediaStore({ ...store, readSectionIds }, storage);
}

export function toggleEncyclopediaBookmark(
  volume: number,
  page: number,
  sectionId: string,
  title: string,
  note?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  if (![1, 2, 3, 4].includes(volume) || !Number.isInteger(page) || page < 1) return store;
  const id = `v${volume}:p${page}`;
  const exists = store.bookmarks.some((bm) => bm.id === id);
  const bookmarks = exists
    ? store.bookmarks.filter((bm) => bm.id !== id)
    : [
        {
          id,
          volume,
          page,
          sectionId,
          title: title.trim() || `المجلد ${volume} · صفحة ${page}`,
          note: note?.trim() ? note.trim().slice(0, 500) : undefined,
          createdAt: new Date().toISOString(),
        },
        ...store.bookmarks,
      ];
  return persistEncyclopediaStore({ ...store, bookmarks }, storage);
}

export function updateEncyclopediaBookmarkNote(
  bookmarkId: string,
  note: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  const cleaned = note.trim().slice(0, 500);
  const bookmarks = store.bookmarks.map((bm) =>
    bm.id === bookmarkId ? { ...bm, note: cleaned || undefined } : bm
  );
  return persistEncyclopediaStore({ ...store, bookmarks }, storage);
}

export function setEncyclopediaFontSize(
  fontSize: SeerahEncyclopediaFontSize,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  return persistEncyclopediaStore({ ...store, fontSize }, storage);
}

export function setEncyclopediaFocusMode(
  focusMode: boolean,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahEncyclopediaProgressStore {
  const store = readSeerahEncyclopediaStore(storage);
  return persistEncyclopediaStore({ ...store, focusMode }, storage);
}

export function getEncyclopediaProgressSummary(
  store: SeerahEncyclopediaProgressStore,
  toc: SeerahEncyclopediaToc | null
): {
  completedSections: number;
  totalSections: number;
  percent: number;
  byVolume: Record<number, { completed: number; total: number; percent: number }>;
} {
  const byVolume: Record<number, { completed: number; total: number; percent: number }> = {
    1: { completed: 0, total: 0, percent: 0 },
    2: { completed: 0, total: 0, percent: 0 },
    3: { completed: 0, total: 0, percent: 0 },
    4: { completed: 0, total: 0, percent: 0 },
  };
  if (!toc || toc.sections.length === 0) {
    return { completedSections: 0, totalSections: 0, percent: 0, byVolume };
  }
  const readSet = new Set(store.readSectionIds);
  let completedSections = 0;
  for (const sec of toc.sections) {
    const bucket = byVolume[sec.volume];
    if (bucket) {
      bucket.total++;
      if (readSet.has(sec.id)) {
        bucket.completed++;
        completedSections++;
      }
    }
  }
  for (const v of [1, 2, 3, 4]) {
    const b = byVolume[v];
    b.percent = b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0;
  }
  const totalSections = toc.sections.length;
  const percent = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;
  return { completedSections, totalSections, percent, byVolume };
}
