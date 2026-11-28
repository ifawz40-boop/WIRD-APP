import { StorageService } from './storageService';
import { scheduleAuxiliaryCloudSync } from './auxiliaryCloudSyncService';
import { recordSyncDeletion, recordSyncUpsert } from './syncTombstoneRegistry';

export const SEERAH_BOOK_STORAGE_KEY = 'wird.seerah.v2';
export const SEERAH_BOOK_BASE_PATH = '/data/seerah';

export type SeerahFontSize = 'sm' | 'md' | 'lg' | 'xl';
export type SeerahDatePrecision = 'exact' | 'approximate' | 'range' | 'disputed';
export type SeerahPublishStatus =
  | 'Draft'
  | 'Historical review'
  | 'Language review'
  | 'Quotation verification'
  | 'Approved'
  | 'Published';

export interface SeerahEraMeta {
  id: string;
  order: number;
  title: string;
  periodLabel: string;
  summary: string;
}

export interface SeerahSectionMeta {
  id: string;
  eraId: string;
  order: number;
  title: string;
  periodLabel: string;
  summary: string;
}

export interface SeerahChapterCard {
  id: string;
  order: number;
  eraId: string;
  sectionId: string;
  title: string;
  subtitle: string;
  periodLabel: string;
  datePrecision: SeerahDatePrecision;
  wordCount: number;
  estimatedReadingMinutes: number;
  sceneCount: number;
  characterIds: string[];
  previousChapterId: string | null;
  nextChapterId: string | null;
  status: SeerahPublishStatus;
}

export interface SeerahCharacterCard {
  id: string;
  order: number;
  name: string;
  epithet: string;
  category: string;
  summary: string;
  wordCount: number;
  estimatedReadingMinutes: number;
  linkedChapterIds: string[];
  status: SeerahPublishStatus;
}

export interface SeerahPlaceRecord {
  id: string;
  name: string;
  region: string;
  summary: string;
  mentionedPageCount: number;
}

export interface SeerahSourceRecord {
  id: string;
  workTitle: string;
  author: string;
  category: string;
  rightsStatus: 'verified_public_domain';
  citationCountAcrossVolumes: number;
}

export interface SeerahBookManifest {
  schemaVersion: 1;
  bookVersion: string;
  publishedAt: string;
  title: string;
  subtitle: string;
  primaryResearchSource: string;
  totalEras: number;
  totalSections: number;
  totalChapters: number;
  totalCharacters: number;
  totalWords: number;
  verifiedQuranQuotations: number;
  verifiedHadithQuotations: number;
  eras: SeerahEraMeta[];
  sections: SeerahSectionMeta[];
  chapters: SeerahChapterCard[];
  characters: SeerahCharacterCard[];
  places: SeerahPlaceRecord[];
  sources: SeerahSourceRecord[];
}

export type SeerahSceneBlock =
  | {
      id: string;
      type: 'paragraph' | 'uncertainty_note';
      text: string;
    }
  | {
      id: string;
      type: 'quran';
      quoteId: string;
      leadIn?: string;
      verbatimText: string;
      reference: string;
      surahNumber: number;
      startAyah: number;
      endAyah: number;
    }
  | {
      id: string;
      type: 'hadith';
      quoteId: string;
      leadIn?: string;
      verbatimText: string;
      reference: string;
      encyclopediaLocator: { volume: number; page: number };
    };

export interface SeerahNarrativeScene {
  id: string;
  order: number;
  title: string;
  blocks: SeerahSceneBlock[];
  characterIds: string[];
  placeIds: string[];
}

export interface SeerahChapterDocument {
  id: string;
  order: number;
  eraId: string;
  sectionId: string;
  title: string;
  subtitle: string;
  periodLabel: string;
  datePrecision: SeerahDatePrecision;
  status: SeerahPublishStatus;
  reviews: {
    historical: string;
    language: string;
    quotation: string;
    editorialNotes?: string;
  };
  wordCount: number;
  estimatedReadingMinutes: number;
  openingHook: string;
  historicalContext: string;
  scenes: SeerahNarrativeScene[];
  closingBridge: string;
  keyTakeaways: string[];
  characterIds: string[];
  placeIds: string[];
  sourceIds: string[];
  encyclopediaSourceRefs: Array<{ volume: number; startPage: number; endPage: number }>;
  disputeIds: string[];
  previousChapterId: string | null;
  nextChapterId: string | null;
}

export interface SeerahCharacterMoment {
  id: string;
  order: number;
  title: string;
  periodLabel: string;
  description: string;
  chapterId: string;
}

export interface SeerahCharacterDocument {
  id: string;
  order: number;
  name: string;
  epithet: string;
  category: string;
  summary: string;
  status: SeerahPublishStatus;
  reviews: {
    historical: string;
    language: string;
    quotation: string;
    editorialNotes?: string;
  };
  wordCount: number;
  estimatedReadingMinutes: number;
  introduction: string;
  backgroundAndContext: string;
  relationshipWithProphet: string;
  narrativeStoryParagraphs: string[];
  documentedVirtues: string[];
  chronologicalMoments: SeerahCharacterMoment[];
  linkedChapterIds: string[];
  encyclopediaStats: {
    mentions: number;
    pagesCount: number;
    firstAppearance: { volume: number; page: number };
  };
}

export interface SeerahSearchItem {
  kind: 'chapter' | 'character';
  id: string;
  order: number;
  sectionId?: string;
  title: string;
  subtitle: string;
  periodLabel: string;
  norm: string;
  preview: string;
}

export interface SeerahReadingPosition {
  chapterId: string;
  sceneId?: string;
  scrollRatio?: number;
  updatedAt: string;
}

export interface SeerahProgressState {
  schemaVersion: 2;
  fontSize: SeerahFontSize;
  completedChapterIds: string[];
  lastPosition: SeerahReadingPosition | null;
}

const ARABIC_DIACRITICS_REGEX = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]/g;

export function normalizeSeerahSearchText(input: string): string {
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

// Runtime memory caches for zero-latency repeat reads
let manifestCache: SeerahBookManifest | null = null;
const chapterCache = new Map<string, SeerahChapterDocument>();
let charactersMapCache: Map<string, SeerahCharacterDocument> | null = null;
let searchIndexCache: SeerahSearchItem[] | null = null;

export function clearSeerahBookMemoryCache(): void {
  manifestCache = null;
  chapterCache.clear();
  charactersMapCache = null;
  searchIndexCache = null;
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs = 15000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`تعذر تحميل محتوى كتاب السيرة (${res.status})`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

export async function loadSeerahBookManifest(): Promise<SeerahBookManifest> {
  if (manifestCache) return manifestCache;
  const data = await fetchJsonWithTimeout<SeerahBookManifest>(
    `${SEERAH_BOOK_BASE_PATH}/manifest.json`
  );
  manifestCache = data;
  return data;
}

export async function loadSeerahChapter(chapterId: string): Promise<SeerahChapterDocument> {
  if (!/^ch-\d{2}$/.test(chapterId)) {
    throw new Error(`معرّف فصل السيرة غير صالح: ${chapterId}`);
  }
  const existing = chapterCache.get(chapterId);
  if (existing) return existing;
  const data = await fetchJsonWithTimeout<SeerahChapterDocument>(
    `${SEERAH_BOOK_BASE_PATH}/chapters/${chapterId}.json`
  );
  chapterCache.set(chapterId, data);
  return data;
}

export async function loadAllSeerahCharacters(): Promise<Map<string, SeerahCharacterDocument>> {
  if (charactersMapCache) return charactersMapCache;
  const payload = await fetchJsonWithTimeout<{ characters: SeerahCharacterDocument[] }>(
    `${SEERAH_BOOK_BASE_PATH}/characters/characters.json`
  );
  const map = new Map<string, SeerahCharacterDocument>();
  for (const c of payload.characters) {
    map.set(c.id, c);
  }
  charactersMapCache = map;
  return map;
}

export async function loadSeerahCharacter(characterId: string): Promise<SeerahCharacterDocument | null> {
  const map = await loadAllSeerahCharacters();
  return map.get(characterId) || null;
}

export async function loadSeerahSearchIndex(): Promise<SeerahSearchItem[]> {
  if (searchIndexCache) return searchIndexCache;
  const payload = await fetchJsonWithTimeout<{ items: SeerahSearchItem[] }>(
    `${SEERAH_BOOK_BASE_PATH}/search-index.json`
  );
  searchIndexCache = payload.items;
  return payload.items;
}

export function searchSeerahItemsSync(
  query: string,
  items: SeerahSearchItem[],
  filterKind: 'all' | 'chapter' | 'character' = 'all'
): SeerahSearchItem[] {
  const normalized = normalizeSeerahSearchText(query);
  if (normalized.length < 2) return [];
  const terms = normalized.split(' ').filter((t) => t.length >= 2);
  if (terms.length === 0) return [];

  const matched: Array<{ item: SeerahSearchItem; score: number }> = [];
  for (const item of items) {
    if (filterKind !== 'all' && item.kind !== filterKind) continue;
    if (!terms.every((t) => item.norm.includes(t))) continue;
    const normTitle = normalizeSeerahSearchText(`${item.title} ${item.subtitle}`);
    const titleHit = terms.every((t) => normTitle.includes(t)) ? 10 : 1;
    matched.push({ item, score: titleHit });
  }
  matched.sort((a, b) => b.score - a.score || a.item.order - b.item.order);
  return matched.slice(0, 40).map((m) => m.item);
}

// ============================================================================
// Guest & Authenticated UID-Scoped Reading Progress Persistence
// ============================================================================

function resolveKey(): string {
  return StorageService.resolveScopedKey(SEERAH_BOOK_STORAGE_KEY);
}

function createDefaultProgress(): SeerahProgressState {
  return {
    schemaVersion: 2,
    fontSize: 'md',
    completedChapterIds: [],
    lastPosition: null,
  };
}

export function readSeerahProgress(
  storage: Pick<Storage, 'getItem'> = localStorage
): SeerahProgressState {
  try {
    const raw = storage.getItem(resolveKey());
    if (!raw) return createDefaultProgress();
    const parsed = JSON.parse(raw) as Partial<SeerahProgressState> | null;
    if (!parsed || parsed.schemaVersion !== 2) return createDefaultProgress();

    const fontSize: SeerahFontSize =
      parsed.fontSize === 'sm' || parsed.fontSize === 'lg' || parsed.fontSize === 'xl'
        ? parsed.fontSize
        : 'md';

    const completedChapterIds = Array.isArray(parsed.completedChapterIds)
      ? [
          ...new Set(
            parsed.completedChapterIds.filter(
              (id): id is string => typeof id === 'string' && /^ch-\d{2}$/.test(id)
            )
          ),
        ]
      : [];

    let lastPosition: SeerahReadingPosition | null = null;
    if (
      parsed.lastPosition &&
      typeof parsed.lastPosition === 'object' &&
      typeof parsed.lastPosition.chapterId === 'string' &&
      /^ch-\d{2}$/.test(parsed.lastPosition.chapterId)
    ) {
      lastPosition = {
        chapterId: parsed.lastPosition.chapterId,
        sceneId:
          typeof parsed.lastPosition.sceneId === 'string'
            ? parsed.lastPosition.sceneId
            : undefined,
        scrollRatio:
          typeof parsed.lastPosition.scrollRatio === 'number' &&
          Number.isFinite(parsed.lastPosition.scrollRatio)
            ? Math.max(0, Math.min(1, parsed.lastPosition.scrollRatio))
            : undefined,
        updatedAt:
          typeof parsed.lastPosition.updatedAt === 'string'
            ? parsed.lastPosition.updatedAt
            : new Date().toISOString(),
      };
    }

    return {
      schemaVersion: 2,
      fontSize,
      completedChapterIds,
      lastPosition,
    };
  } catch {
    return createDefaultProgress();
  }
}

function writeSeerahProgress(
  state: SeerahProgressState,
  storage: Pick<Storage, 'setItem'> = localStorage
): SeerahProgressState {
  try {
    storage.setItem(resolveKey(), JSON.stringify(state));
    if (typeof localStorage !== 'undefined' && storage === localStorage) {
      scheduleAuxiliaryCloudSync();
    }
  } catch {
    // Preserve interactive reading even under storage quota restriction
  }
  return state;
}

export function setSeerahChapterReadState(
  chapterId: string,
  read: boolean,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressState {
  if (!/^ch-\d{2}$/.test(chapterId)) return readSeerahProgress(storage);
  const current = readSeerahProgress(storage);
  const exists = current.completedChapterIds.includes(chapterId);
  const completedChapterIds = read
    ? exists
      ? current.completedChapterIds
      : [...current.completedChapterIds, chapterId]
    : current.completedChapterIds.filter((id) => id !== chapterId);
  if (typeof localStorage !== 'undefined' && storage === localStorage) {
    if (read) {
      recordSyncUpsert('seerahChapters', chapterId);
    } else {
      recordSyncDeletion('seerahChapters', chapterId);
    }
  }
  return writeSeerahProgress({ ...current, completedChapterIds }, storage);
}

export function toggleSeerahChapterReadState(
  chapterId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressState {
  const current = readSeerahProgress(storage);
  const isDone = current.completedChapterIds.includes(chapterId);
  return setSeerahChapterReadState(chapterId, !isDone, storage);
}

export function saveSeerahBookPosition(
  chapterId: string,
  sceneId?: string,
  scrollRatio?: number,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressState {
  if (!/^ch-\d{2}$/.test(chapterId)) return readSeerahProgress(storage);
  const current = readSeerahProgress(storage);
  return writeSeerahProgress(
    {
      ...current,
      lastPosition: {
        chapterId,
        sceneId,
        scrollRatio,
        updatedAt: new Date().toISOString(),
      },
    },
    storage
  );
}

export function setSeerahBookFontSize(
  fontSize: SeerahFontSize,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressState {
  const current = readSeerahProgress(storage);
  return writeSeerahProgress({ ...current, fontSize }, storage);
}

export function computeSeerahBookProgress(
  state: SeerahProgressState,
  manifest: SeerahBookManifest | null
): {
  completedCount: number;
  totalCount: number;
  percent: number;
  bySection: Record<string, { completed: number; total: number; percent: number }>;
} {
  const bySection: Record<string, { completed: number; total: number; percent: number }> = {};
  if (!manifest) {
    return { completedCount: 0, totalCount: 0, percent: 0, bySection };
  }
  const doneSet = new Set(state.completedChapterIds);
  let completedCount = 0;
  for (const sec of manifest.sections) {
    bySection[sec.id] = { completed: 0, total: 0, percent: 0 };
  }
  for (const ch of manifest.chapters) {
    const bucket = bySection[ch.sectionId];
    if (bucket) {
      bucket.total++;
      if (doneSet.has(ch.id)) {
        bucket.completed++;
        completedCount++;
      }
    } else if (doneSet.has(ch.id)) {
      completedCount++;
    }
  }
  for (const bucket of Object.values(bySection)) {
    bucket.percent = bucket.total > 0 ? Math.round((bucket.completed / bucket.total) * 100) : 0;
  }
  const totalCount = manifest.chapters.length;
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  return { completedCount, totalCount, percent, bySection };
}
