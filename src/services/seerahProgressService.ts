import {
  SEERAH_BOOK_VERSION,
  SEERAH_CHAPTERS,
  SEERAH_PARTS,
  getSeerahChapterById
} from '../data/seerahData';
import { StorageService } from './storageService';

export const SEERAH_PROGRESS_KEY = 'wird.seerah.progress.v1';

export type SeerahReadingMode = 'continuous' | 'study';

export interface SeerahBookmark {
  id: string;
  bookVersion: string;
  partId: string;
  chapterId: string;
  sceneId: string;
  title: string;
  createdAt: string;
}

export interface SeerahLastPosition {
  bookVersion: string;
  partId: string;
  chapterId: string;
  sceneId: string;
  updatedAt: string;
}

export interface SeerahProgressStore {
  schemaVersion: 1;
  bookVersion: string;
  readingMode: SeerahReadingMode;
  lastPosition: SeerahLastPosition | null;
  completedChapterIds: string[];
  bookmarks: SeerahBookmark[];
}

const VALID_CHAPTER_IDS = new Set(SEERAH_CHAPTERS.map(ch => ch.id));
const VALID_PART_IDS = new Set(SEERAH_PARTS.map(p => p.id));

function createDefaultStore(): SeerahProgressStore {
  return {
    schemaVersion: 1,
    bookVersion: SEERAH_BOOK_VERSION,
    readingMode: 'study',
    lastPosition: null,
    completedChapterIds: [],
    bookmarks: []
  };
}

function getScopedKey(): string {
  return StorageService.resolveScopedKey(SEERAH_PROGRESS_KEY);
}

export function readSeerahProgressStore(
  storage: Pick<Storage, 'getItem'> = localStorage
): SeerahProgressStore {
  try {
    const raw = storage.getItem(getScopedKey());
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<SeerahProgressStore> | null;
    if (!parsed || parsed.schemaVersion !== 1) return createDefaultStore();

    const readingMode: SeerahReadingMode = parsed.readingMode === 'continuous' ? 'continuous' : 'study';

    const completedChapterIds = Array.isArray(parsed.completedChapterIds)
      ? [...new Set(parsed.completedChapterIds.filter((id): id is string => typeof id === 'string' && VALID_CHAPTER_IDS.has(id)))]
      : [];

    let lastPosition: SeerahLastPosition | null = null;
    if (
      parsed.lastPosition &&
      typeof parsed.lastPosition === 'object' &&
      typeof parsed.lastPosition.chapterId === 'string' &&
      VALID_CHAPTER_IDS.has(parsed.lastPosition.chapterId)
    ) {
      const ch = getSeerahChapterById(parsed.lastPosition.chapterId)!;
      const validScene = ch.scenes.find(sc => sc.id === parsed.lastPosition?.sceneId) || ch.scenes[0];
      lastPosition = {
        bookVersion: SEERAH_BOOK_VERSION,
        partId: ch.partId,
        chapterId: ch.id,
        sceneId: validScene.id,
        updatedAt: typeof parsed.lastPosition.updatedAt === 'string' ? parsed.lastPosition.updatedAt : new Date().toISOString()
      };
    }

    const bookmarks: SeerahBookmark[] = [];
    const seenKeys = new Set<string>();
    if (Array.isArray(parsed.bookmarks)) {
      for (const bm of parsed.bookmarks) {
        if (!bm || typeof bm !== 'object' || typeof bm.chapterId !== 'string' || !VALID_CHAPTER_IDS.has(bm.chapterId)) {
          continue;
        }
        const ch = getSeerahChapterById(bm.chapterId)!;
        const sc = ch.scenes.find(s => s.id === bm.sceneId) || ch.scenes[0];
        const key = `${ch.id}:${sc.id}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        bookmarks.push({
          id: key,
          bookVersion: SEERAH_BOOK_VERSION,
          partId: ch.partId,
          chapterId: ch.id,
          sceneId: sc.id,
          title: typeof bm.title === 'string' && bm.title.trim().length > 0 ? bm.title : `${ch.title} — ${sc.title}`,
          createdAt: typeof bm.createdAt === 'string' ? bm.createdAt : new Date().toISOString()
        });
      }
    }

    return {
      schemaVersion: 1,
      bookVersion: SEERAH_BOOK_VERSION,
      readingMode,
      lastPosition,
      completedChapterIds,
      bookmarks
    };
  } catch {
    return createDefaultStore();
  }
}

function persistSeerahProgressStore(
  store: SeerahProgressStore,
  storage: Pick<Storage, 'setItem'> = localStorage
): SeerahProgressStore {
  try {
    storage.setItem(getScopedKey(), JSON.stringify(store));
  } catch {
    // Keep reading active when storage is restricted
  }
  return store;
}

export function saveSeerahReadingPosition(
  chapterId: string,
  sceneId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressStore {
  const ch = getSeerahChapterById(chapterId);
  if (!ch) return readSeerahProgressStore(storage);
  const sc = (sceneId ? ch.scenes.find(s => s.id === sceneId) : null) || ch.scenes[0];
  const store = readSeerahProgressStore(storage);
  return persistSeerahProgressStore(
    {
      ...store,
      lastPosition: {
        bookVersion: SEERAH_BOOK_VERSION,
        partId: ch.partId,
        chapterId: ch.id,
        sceneId: sc.id,
        updatedAt: new Date().toISOString()
      }
    },
    storage
  );
}

export function toggleSeerahChapterCompleted(
  chapterId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressStore {
  if (!VALID_CHAPTER_IDS.has(chapterId)) return readSeerahProgressStore(storage);
  const store = readSeerahProgressStore(storage);
  const exists = store.completedChapterIds.includes(chapterId);
  const completedChapterIds = exists
    ? store.completedChapterIds.filter(id => id !== chapterId)
    : [...store.completedChapterIds, chapterId];
  return persistSeerahProgressStore({ ...store, completedChapterIds }, storage);
}

export function toggleSeerahBookmark(
  chapterId: string,
  sceneId?: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressStore {
  const ch = getSeerahChapterById(chapterId);
  if (!ch) return readSeerahProgressStore(storage);
  const sc = (sceneId ? ch.scenes.find(s => s.id === sceneId) : null) || ch.scenes[0];
  const key = `${ch.id}:${sc.id}`;
  const store = readSeerahProgressStore(storage);
  const exists = store.bookmarks.some(bm => bm.id === key);
  const bookmarks = exists
    ? store.bookmarks.filter(bm => bm.id !== key)
    : [
        {
          id: key,
          bookVersion: SEERAH_BOOK_VERSION,
          partId: ch.partId,
          chapterId: ch.id,
          sceneId: sc.id,
          title: `${ch.title} — ${sc.title}`,
          createdAt: new Date().toISOString()
        },
        ...store.bookmarks
      ];
  return persistSeerahProgressStore({ ...store, bookmarks }, storage);
}

export function setSeerahReadingMode(
  readingMode: SeerahReadingMode,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): SeerahProgressStore {
  const store = readSeerahProgressStore(storage);
  return persistSeerahProgressStore({ ...store, readingMode }, storage);
}

export function getSeerahOverallProgress(store: SeerahProgressStore): {
  completedChapters: number;
  totalChapters: number;
  percent: number;
  nextRecommendedChapterId: string;
} {
  const totalChapters = SEERAH_CHAPTERS.length;
  const completedSet = new Set(store.completedChapterIds);
  const completedChapters = completedSet.size;
  const percent = totalChapters > 0 ? Math.floor((completedChapters / totalChapters) * 100) : 0;
  const firstUncompleted = SEERAH_CHAPTERS.find(ch => !completedSet.has(ch.id));
  const nextRecommendedChapterId =
    store.lastPosition?.chapterId ||
    firstUncompleted?.id ||
    SEERAH_CHAPTERS[0].id;

  return {
    completedChapters,
    totalChapters,
    percent,
    nextRecommendedChapterId
  };
}

export function isValidSeerahPartId(partId: string): boolean {
  return VALID_PART_IDS.has(partId);
}
