import {
  DEFAULT_FEATURED_SERIES_ID,
  SERIES_CATEGORY_LABELS,
  VIDEO_SERIES_CATALOG,
  extractYouTubePlaylistId,
  getAllSeriesMerged,
  getYouTubePlaylistUrl,
  isValidYouTubePlaylistId,
  isValidYouTubeVideoId,
  parseDurationToSeconds,
  type VideoLessonItem,
  type VideoSeriesCategory,
  type VideoSeriesDefinition,
} from '../data/videoSeriesCatalog';
import { StorageService } from './storageService';
import { getLocalDateString } from './unifiedPortionService';

export const VIDEO_SERIES_STORAGE_KEY = 'wird.video.series.v1';

export type LessonWatchStatus = 'unwatched' | 'in_progress' | 'completed';

export interface SeriesWatchProgress {
  completedVideoIds: string[];
  inProgressVideoIds: string[];
  lastWatchedVideoId?: string;
  videoNotes: Record<string, string>;
  lastUpdatedAt: string;
}

export interface DailySeriesSelection {
  date: string; // YYYY-MM-DD
  seriesId: string;
  videoId: string;
}

export interface VideoSeriesStoreV1 {
  schemaVersion: 1;
  featuredSeriesId: string;
  dailySelection: DailySeriesSelection | null;
  progressBySeries: Record<string, SeriesWatchProgress>;
  customSeries: VideoSeriesDefinition[];
}

export interface DailySuggestedLessonResult {
  series: VideoSeriesDefinition;
  lesson: VideoLessonItem;
  status: LessonWatchStatus;
  completedCount: number;
  totalCount: number;
  percent: number;
  isSeriesCompleted: boolean;
  date: string;
}

export interface SeriesProgressSummary {
  completedCount: number;
  inProgressCount: number;
  unwatchedCount: number;
  totalCount: number;
  percent: number;
  isCompleted: boolean;
  nextUnwatchedLesson: VideoLessonItem;
}

function createEmptySeriesProgress(): SeriesWatchProgress {
  return {
    completedVideoIds: [],
    inProgressVideoIds: [],
    videoNotes: {},
    lastUpdatedAt: new Date().toISOString(),
  };
}

function createDefaultStore(): VideoSeriesStoreV1 {
  return {
    schemaVersion: 1,
    featuredSeriesId: DEFAULT_FEATURED_SERIES_ID,
    dailySelection: null,
    progressBySeries: {},
    customSeries: [],
  };
}

function getScopedKey(): string {
  return StorageService.resolveScopedKey(VIDEO_SERIES_STORAGE_KEY);
}

function sanitizeCustomVideo(raw: unknown, idx: number, fallbackSpeaker: string): VideoLessonItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const videoId = typeof r.videoId === 'string' ? r.videoId.trim() : '';
  if (!isValidYouTubeVideoId(videoId)) return null;
  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 180) : `الدرس ${idx + 1}`;
  const durationText = typeof r.durationText === 'string' && r.durationText.trim() ? r.durationText.trim().slice(0, 20) : '—';
  const durationSeconds =
    typeof r.durationSeconds === 'number' && Number.isFinite(r.durationSeconds) && r.durationSeconds >= 0
      ? Math.floor(r.durationSeconds)
      : parseDurationToSeconds(durationText);
  return {
    id: typeof r.id === 'string' && r.id.trim() ? r.id.trim() : `yt:${videoId}`,
    order: typeof r.order === 'number' && Number.isInteger(r.order) && r.order > 0 ? r.order : idx + 1,
    videoId,
    title,
    description: typeof r.description === 'string' ? r.description.trim().slice(0, 800) : undefined,
    durationText,
    durationSeconds,
    publishedAt: typeof r.publishedAt === 'string' ? r.publishedAt.slice(0, 32) : undefined,
    speaker: typeof r.speaker === 'string' && r.speaker.trim() ? r.speaker.trim().slice(0, 100) : fallbackSpeaker,
    topic: typeof r.topic === 'string' && r.topic.trim() ? r.topic.trim().slice(0, 60) : undefined,
  };
}

function sanitizeCustomSeries(raw: unknown): VideoSeriesDefinition | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const playlistId = typeof r.playlistId === 'string' ? r.playlistId.trim() : '';
  if (!isValidYouTubePlaylistId(playlistId)) return null;

  const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim().slice(0, 160) : '';
  if (!title) return null;

  const speaker =
    typeof r.speaker === 'string' && r.speaker.trim() ? r.speaker.trim().slice(0, 100) : 'سلسلة علمية';
  const rawVideos = Array.isArray(r.videos) ? r.videos : [];
  const seenVideoIds = new Set<string>();
  const videos: VideoLessonItem[] = [];
  for (let i = 0; i < rawVideos.length; i++) {
    const parsed = sanitizeCustomVideo(rawVideos[i], videos.length, speaker);
    if (!parsed || seenVideoIds.has(parsed.videoId)) continue;
    seenVideoIds.add(parsed.videoId);
    videos.push({ ...parsed, order: videos.length + 1 });
  }
  if (videos.length === 0) return null;

  const rawCategory = typeof r.category === 'string' ? r.category : 'general';
  const category: VideoSeriesCategory =
    rawCategory in SERIES_CATEGORY_LABELS ? (rawCategory as VideoSeriesCategory) : 'general';

  const id =
    typeof r.id === 'string' && r.id.trim()
      ? r.id.trim().slice(0, 80)
      : `custom:${playlistId}`;

  return {
    id,
    playlistId,
    playlistUrl: getYouTubePlaylistUrl(playlistId),
    title,
    speaker,
    channelName: typeof r.channelName === 'string' ? r.channelName.slice(0, 100) : speaker,
    category,
    categoryLabelAr: SERIES_CATEGORY_LABELS[category],
    description:
      typeof r.description === 'string' && r.description.trim()
        ? r.description.trim().slice(0, 600)
        : `قائمة تشغيل تعليمية مضافة (${videos.length} درساً).`,
    isFeaturedOnDashboard: Boolean(r.isFeaturedOnDashboard),
    sourceType: 'custom',
    addedAt: typeof r.addedAt === 'string' ? r.addedAt.slice(0, 32) : getLocalDateString(),
    videos,
  };
}

export function readVideoSeriesStore(
  storage: Pick<Storage, 'getItem'> = localStorage
): VideoSeriesStoreV1 {
  try {
    const raw = storage.getItem(getScopedKey());
    if (!raw) return createDefaultStore();
    const parsed = JSON.parse(raw) as Partial<VideoSeriesStoreV1> | null;
    if (!parsed || parsed.schemaVersion !== 1) return createDefaultStore();

    const customSeries: VideoSeriesDefinition[] = [];
    const seenIds = new Set<string>(VIDEO_SERIES_CATALOG.map((s) => s.id));
    if (Array.isArray(parsed.customSeries)) {
      for (const item of parsed.customSeries) {
        const sanitized = sanitizeCustomSeries(item);
        if (!sanitized || seenIds.has(sanitized.id)) continue;
        seenIds.add(sanitized.id);
        customSeries.push(sanitized);
      }
    }

    const allSeries = getAllSeriesMerged(customSeries);
    const seriesMap = new Map(allSeries.map((s) => [s.id, s]));

    const featuredSeriesId =
      typeof parsed.featuredSeriesId === 'string' && seriesMap.has(parsed.featuredSeriesId)
        ? parsed.featuredSeriesId
        : DEFAULT_FEATURED_SERIES_ID;

    const progressBySeries: Record<string, SeriesWatchProgress> = {};
    if (parsed.progressBySeries && typeof parsed.progressBySeries === 'object') {
      for (const [seriesId, rawProg] of Object.entries(parsed.progressBySeries)) {
        const series = seriesMap.get(seriesId);
        if (!series || !rawProg || typeof rawProg !== 'object') continue;
        const validVideoIds = new Set(series.videos.map((v) => v.videoId));
        const completedVideoIds = Array.isArray(rawProg.completedVideoIds)
          ? [...new Set(rawProg.completedVideoIds.filter((id): id is string => typeof id === 'string' && validVideoIds.has(id)))]
          : [];
        const completedSet = new Set(completedVideoIds);
        const inProgressVideoIds = Array.isArray(rawProg.inProgressVideoIds)
          ? [...new Set(rawProg.inProgressVideoIds.filter((id): id is string => typeof id === 'string' && validVideoIds.has(id) && !completedSet.has(id)))]
          : [];
        const videoNotes: Record<string, string> = {};
        if (rawProg.videoNotes && typeof rawProg.videoNotes === 'object') {
          for (const [vid, note] of Object.entries(rawProg.videoNotes)) {
            if (validVideoIds.has(vid) && typeof note === 'string' && note.trim()) {
              videoNotes[vid] = note.slice(0, 1500);
            }
          }
        }
        const lastWatchedVideoId =
          typeof rawProg.lastWatchedVideoId === 'string' && validVideoIds.has(rawProg.lastWatchedVideoId)
            ? rawProg.lastWatchedVideoId
            : undefined;
        progressBySeries[seriesId] = {
          completedVideoIds,
          inProgressVideoIds,
          lastWatchedVideoId,
          videoNotes,
          lastUpdatedAt:
            typeof rawProg.lastUpdatedAt === 'string'
              ? rawProg.lastUpdatedAt
              : new Date().toISOString(),
        };
      }
    }

    let dailySelection: DailySeriesSelection | null = null;
    if (
      parsed.dailySelection &&
      typeof parsed.dailySelection === 'object' &&
      typeof parsed.dailySelection.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.dailySelection.date) &&
      typeof parsed.dailySelection.seriesId === 'string' &&
      typeof parsed.dailySelection.videoId === 'string'
    ) {
      const targetSeries = seriesMap.get(parsed.dailySelection.seriesId);
      if (targetSeries?.videos.some((v) => v.videoId === parsed.dailySelection?.videoId)) {
        dailySelection = {
          date: parsed.dailySelection.date,
          seriesId: targetSeries.id,
          videoId: parsed.dailySelection.videoId,
        };
      }
    }

    return {
      schemaVersion: 1,
      featuredSeriesId,
      dailySelection,
      progressBySeries,
      customSeries,
    };
  } catch {
    return createDefaultStore();
  }
}

function persistVideoSeriesStore(
  store: VideoSeriesStoreV1,
  storage: Pick<Storage, 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  try {
    storage.setItem(getScopedKey(), JSON.stringify(store));
  } catch {
    // Keep session responsive if storage quota or privacy mode restricts persistence
  }
  return store;
}

export function getSeriesWatchProgress(
  store: VideoSeriesStoreV1,
  seriesId: string
): SeriesWatchProgress {
  return store.progressBySeries[seriesId] || createEmptySeriesProgress();
}

export function getLessonWatchStatus(
  store: VideoSeriesStoreV1,
  seriesId: string,
  videoId: string
): LessonWatchStatus {
  const prog = store.progressBySeries[seriesId];
  if (!prog) return 'unwatched';
  if (prog.completedVideoIds.includes(videoId)) return 'completed';
  if (prog.inProgressVideoIds.includes(videoId)) return 'in_progress';
  return 'unwatched';
}

export function getSeriesProgressSummary(
  series: VideoSeriesDefinition,
  store: VideoSeriesStoreV1
): SeriesProgressSummary {
  const prog = getSeriesWatchProgress(store, series.id);
  const completedSet = new Set(prog.completedVideoIds);
  const inProgressSet = new Set(
    prog.inProgressVideoIds.filter((id) => !completedSet.has(id))
  );
  const totalCount = series.videos.length;
  const completedCount = series.videos.filter((v) => completedSet.has(v.videoId)).length;
  const inProgressCount = series.videos.filter((v) => inProgressSet.has(v.videoId)).length;
  const unwatchedCount = Math.max(0, totalCount - completedCount - inProgressCount);
  const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextUnwatchedLesson =
    series.videos.find((v) => !completedSet.has(v.videoId)) || series.videos[0];

  return {
    completedCount,
    inProgressCount,
    unwatchedCount,
    totalCount,
    percent,
    isCompleted: totalCount > 0 && completedCount === totalCount,
    nextUnwatchedLesson,
  };
}

function dayIndexFromDateStr(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return 0;
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Resolve today's suggested lesson from the active/featured series.
 * - On a given calendar date `dateStr`, stays consistent all day if already chosen for that date & series.
 * - On a new day, automatically selects the next unwatched lesson in sequential order.
 * - If all lessons in the series are completed, deterministically rotates across the series by day.
 */
export function getDailySuggestedLesson(
  store: VideoSeriesStoreV1,
  dateStr: string = getLocalDateString(),
  preferredSeriesId?: string
): DailySuggestedLessonResult {
  const allSeries = getAllSeriesMerged(store.customSeries);
  const targetSeries =
    allSeries.find((s) => s.id === (preferredSeriesId || store.featuredSeriesId)) ||
    allSeries[0];

  const summary = getSeriesProgressSummary(targetSeries, store);
  const prog = getSeriesWatchProgress(store, targetSeries.id);
  const completedSet = new Set(prog.completedVideoIds);

  let chosenLesson: VideoLessonItem | undefined;
  if (
    store.dailySelection &&
    store.dailySelection.date === dateStr &&
    store.dailySelection.seriesId === targetSeries.id
  ) {
    chosenLesson = targetSeries.videos.find(
      (v) => v.videoId === store.dailySelection?.videoId
    );
  }

  if (!chosenLesson) {
    const firstInProgressOrUnwatched = targetSeries.videos.find(
      (v) => !completedSet.has(v.videoId)
    );
    if (firstInProgressOrUnwatched) {
      chosenLesson = firstInProgressOrUnwatched;
    } else {
      const idx = Math.abs(dayIndexFromDateStr(dateStr)) % targetSeries.videos.length;
      chosenLesson = targetSeries.videos[idx] || targetSeries.videos[0];
    }
  }

  return {
    series: targetSeries,
    lesson: chosenLesson,
    status: getLessonWatchStatus(store, targetSeries.id, chosenLesson.videoId),
    completedCount: summary.completedCount,
    totalCount: summary.totalCount,
    percent: summary.percent,
    isSeriesCompleted: summary.isCompleted,
    date: dateStr,
  };
}

export function setLessonWatchStatus(
  seriesId: string,
  videoId: string,
  status: LessonWatchStatus,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  const series = getAllSeriesMerged(store.customSeries).find((s) => s.id === seriesId);
  if (!series || !series.videos.some((v) => v.videoId === videoId)) return store;

  const existing = getSeriesWatchProgress(store, seriesId);
  let completedVideoIds = existing.completedVideoIds.filter((id) => id !== videoId);
  let inProgressVideoIds = existing.inProgressVideoIds.filter((id) => id !== videoId);

  if (status === 'completed') {
    completedVideoIds = [...completedVideoIds, videoId];
  } else if (status === 'in_progress') {
    inProgressVideoIds = [...inProgressVideoIds, videoId];
  }

  const nextStore: VideoSeriesStoreV1 = {
    ...store,
    progressBySeries: {
      ...store.progressBySeries,
      [seriesId]: {
        ...existing,
        completedVideoIds,
        inProgressVideoIds,
        lastWatchedVideoId: status === 'unwatched' ? existing.lastWatchedVideoId : videoId,
        lastUpdatedAt: new Date().toISOString(),
      },
    },
  };

  return persistVideoSeriesStore(nextStore, storage);
}

export function toggleLessonCompleted(
  seriesId: string,
  videoId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  const currentStatus = getLessonWatchStatus(store, seriesId, videoId);
  return setLessonWatchStatus(
    seriesId,
    videoId,
    currentStatus === 'completed' ? 'unwatched' : 'completed',
    storage
  );
}

export function advanceDailySuggestedLesson(
  seriesId?: string,
  dateStr: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  const current = getDailySuggestedLesson(store, dateStr, seriesId);
  const videos = current.series.videos;
  const currentIdx = videos.findIndex((v) => v.videoId === current.lesson.videoId);
  const completedSet = new Set(getSeriesWatchProgress(store, current.series.id).completedVideoIds);

  // Prefer the next unwatched video after currentIdx, wrapping around; otherwise simply step +1
  let nextLesson: VideoLessonItem | undefined;
  for (let offset = 1; offset <= videos.length; offset++) {
    const candidate = videos[(currentIdx + offset) % videos.length];
    if (!completedSet.has(candidate.videoId) && candidate.videoId !== current.lesson.videoId) {
      nextLesson = candidate;
      break;
    }
  }
  if (!nextLesson) {
    nextLesson = videos[(currentIdx + 1) % videos.length] || videos[0];
  }

  return persistVideoSeriesStore(
    {
      ...store,
      featuredSeriesId: current.series.id,
      dailySelection: {
        date: dateStr,
        seriesId: current.series.id,
        videoId: nextLesson.videoId,
      },
    },
    storage
  );
}

export function setFeaturedSeries(
  seriesId: string,
  dateStr: string = getLocalDateString(),
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  const series = getAllSeriesMerged(store.customSeries).find((s) => s.id === seriesId);
  if (!series) return store;

  const summary = getSeriesProgressSummary(series, store);
  return persistVideoSeriesStore(
    {
      ...store,
      featuredSeriesId: series.id,
      dailySelection: {
        date: dateStr,
        seriesId: series.id,
        videoId: summary.nextUnwatchedLesson.videoId,
      },
    },
    storage
  );
}

export function saveLessonNote(
  seriesId: string,
  videoId: string,
  note: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  const series = getAllSeriesMerged(store.customSeries).find((s) => s.id === seriesId);
  if (!series || !series.videos.some((v) => v.videoId === videoId)) return store;

  const existing = getSeriesWatchProgress(store, seriesId);
  const nextNotes = { ...existing.videoNotes };
  const trimmed = note.trim().slice(0, 1500);
  if (trimmed) {
    nextNotes[videoId] = trimmed;
  } else {
    delete nextNotes[videoId];
  }

  return persistVideoSeriesStore(
    {
      ...store,
      progressBySeries: {
        ...store.progressBySeries,
        [seriesId]: {
          ...existing,
          videoNotes: nextNotes,
          lastUpdatedAt: new Date().toISOString(),
        },
      },
    },
    storage
  );
}

export function addCustomSeries(
  input: {
    playlistId: string;
    title: string;
    speaker: string;
    category?: VideoSeriesCategory;
    description?: string;
    videos: Array<Pick<VideoLessonItem, 'videoId' | 'title' | 'durationText'> & Partial<VideoLessonItem>>;
    featureOnDashboard?: boolean;
  },
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): { ok: true; series: VideoSeriesDefinition; store: VideoSeriesStoreV1 } | { ok: false; errorAr: string } {
  const playlistId = extractYouTubePlaylistId(input.playlistId) || input.playlistId.trim();
  if (!isValidYouTubePlaylistId(playlistId)) {
    return { ok: false, errorAr: 'معرف قائمة التشغيل على يوتيوب غير صالح.' };
  }
  const title = input.title.trim();
  if (!title) {
    return { ok: false, errorAr: 'يرجى إدخال عنوان السلسلة.' };
  }
  const speaker = input.speaker.trim() || 'سلسلة علمية';
  const category = input.category || 'general';
  const candidate = sanitizeCustomSeries({
    id: `custom:${playlistId}`,
    playlistId,
    title,
    speaker,
    category,
    description: input.description,
    isFeaturedOnDashboard: Boolean(input.featureOnDashboard),
    videos: input.videos.map((v, idx) => ({
      ...v,
      order: idx + 1,
      speaker: v.speaker || speaker,
    })),
  });

  if (!candidate) {
    return { ok: false, errorAr: 'يجب أن تحتوي السلسلة على درس واحد صالح على الأقل.' };
  }

  const store = readVideoSeriesStore(storage);
  const existingBuiltin = VIDEO_SERIES_CATALOG.find(
    (s) => s.playlistId === candidate.playlistId || s.id === candidate.id
  );
  if (existingBuiltin) {
    return { ok: false, errorAr: 'هذه السلسلة مضافة بالفعل ضمن السلاسل الأساسية في المنصة.' };
  }

  const filteredCustom = store.customSeries.filter((s) => s.id !== candidate.id && s.playlistId !== candidate.playlistId);
  const nextStore = persistVideoSeriesStore(
    {
      ...store,
      featuredSeriesId: input.featureOnDashboard ? candidate.id : store.featuredSeriesId,
      dailySelection: input.featureOnDashboard
        ? {
            date: getLocalDateString(),
            seriesId: candidate.id,
            videoId: candidate.videos[0].videoId,
          }
        : store.dailySelection,
      customSeries: [candidate, ...filteredCustom],
    },
    storage
  );

  return { ok: true, series: candidate, store: nextStore };
}

export function removeCustomSeries(
  seriesId: string,
  storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage
): VideoSeriesStoreV1 {
  const store = readVideoSeriesStore(storage);
  if (!store.customSeries.some((s) => s.id === seriesId)) return store;

  const customSeries = store.customSeries.filter((s) => s.id !== seriesId);
  const nextProgress = { ...store.progressBySeries };
  delete nextProgress[seriesId];

  const featuredSeriesId =
    store.featuredSeriesId === seriesId ? DEFAULT_FEATURED_SERIES_ID : store.featuredSeriesId;
  const dailySelection =
    store.dailySelection?.seriesId === seriesId ? null : store.dailySelection;

  return persistVideoSeriesStore(
    {
      ...store,
      featuredSeriesId,
      dailySelection,
      progressBySeries: nextProgress,
      customSeries,
    },
    storage
  );
}

export interface ImportedYouTubePlaylistPayload {
  playlistId: string;
  playlistUrl: string;
  title: string;
  speaker: string;
  videos: Array<{
    videoId: string;
    title: string;
    durationText: string;
    durationSeconds: number;
    description?: string;
    publishedAt?: string;
  }>;
}

export async function fetchYouTubePlaylistMetadata(
  playlistUrlOrId: string
): Promise<ImportedYouTubePlaylistPayload> {
  const playlistId = extractYouTubePlaylistId(playlistUrlOrId);
  if (!playlistId) {
    throw new Error('يرجى لصق رابط قائمة تشغيل يوتيوب صحيح (يحتوي على list=...).');
  }

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(
      `/api/youtube-playlist?list=${encodeURIComponent(playlistId)}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok || !data || !Array.isArray(data.videos) || data.videos.length === 0) {
      throw new Error(
        data?.message || 'تعذر جلب بيانات قائمة التشغيل من يوتيوب حالياً. يمكنك التحقق من أن القائمة عامة.'
      );
    }
    return data as ImportedYouTubePlaylistPayload;
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error('انتهت مهلة الاتصال أثناء جلب بيانات السلسلة. حاول مرة أخرى.');
    }
    throw err instanceof Error ? err : new Error('تعذر استيراد السلسلة.');
  } finally {
    window.clearTimeout(timer);
  }
}
