import {
  BINA_AL_NAFS_SERIES,
  VIDEO_SERIES_CATALOG,
  extractYouTubePlaylistId,
  formatTotalSeriesDurationAr,
  getAllSeriesMerged,
  getYouTubeEmbedUrl,
  getYouTubeThumbnailUrl,
  getYouTubeWatchUrl,
  isValidYouTubePlaylistId,
  isValidYouTubeVideoId,
} from '../data/videoSeriesCatalog';
import {
  addCustomSeries,
  advanceDailySuggestedLesson,
  getDailySuggestedLesson,
  getLessonWatchStatus,
  getSeriesProgressSummary,
  readVideoSeriesStore,
  removeCustomSeries,
  saveLessonNote,
  setFeaturedSeries,
  setLessonWatchStatus,
  toggleLessonCompleted,
} from '../services/videoSeriesService';
import { StorageService } from '../services/storageService';
import { buildRouteHash, parseRoute } from '../services/router';
import youtubePlaylistHandler from '../../api/youtube-playlist';

export async function runVideoSeriesSystemTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const runTest = async (name: string, fn: () => void | Promise<void>) => {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name} — ${err?.message || err}`);
      failed++;
    }
  };

  const createMockStorage = () => {
    const map = new Map<string, string>();
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
      clear: () => map.clear(),
    };
  };

  await runTest(
    'Bina Al-Nafs catalog contains all 13 verified episodes with valid YouTube IDs and ordering',
    () => {
      assert(VIDEO_SERIES_CATALOG.length >= 1, 'Catalog must contain at least one curated series');
      assert(
        BINA_AL_NAFS_SERIES.playlistId === 'PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5',
        'Playlist ID must match requested YouTube playlist'
      );
      assert(
        BINA_AL_NAFS_SERIES.videos.length === 13,
        `Expected 13 episodes, found ${BINA_AL_NAFS_SERIES.videos.length}`
      );
      const seenIds = new Set<string>();
      BINA_AL_NAFS_SERIES.videos.forEach((v, idx) => {
        assert(v.order === idx + 1, `Episode order mismatch at index ${idx}`);
        assert(isValidYouTubeVideoId(v.videoId), `Invalid YouTube videoId: ${v.videoId}`);
        assert(!seenIds.has(v.videoId), `Duplicate videoId: ${v.videoId}`);
        seenIds.add(v.videoId);
        assert(v.title.trim().length > 3, `Empty title for ${v.videoId}`);
        assert(v.durationSeconds > 600, `Expected realistic duration for ${v.videoId}`);
        assert(getYouTubeEmbedUrl(v.videoId).startsWith('https://www.youtube-nocookie.com/embed/'), 'Embed URL must use youtube-nocookie');
        assert(getYouTubeWatchUrl(v.videoId, BINA_AL_NAFS_SERIES.playlistId).includes('list=PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5'), 'Watch URL must include playlist');
        assert(getYouTubeThumbnailUrl(v.videoId).startsWith('https://i.ytimg.com/vi/'), 'Thumbnail URL must use ytimg');
      });
      assert(formatTotalSeriesDurationAr(BINA_AL_NAFS_SERIES.videos).includes('ساعة'), 'Total duration should format in Arabic hours');
    }
  );

  await runTest(
    'YouTube URL and ID validators reject unsafe schemes, non-YouTube domains, and malformed IDs',
    () => {
      assert(
        extractYouTubePlaylistId(
          'https://youtube.com/playlist?list=PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5&si=VX050-ATs8AlcrQA'
        ) === 'PLlciBs22ptiSJpZBg91Udlue8avJ7RtB5',
        'Valid playlist URL should extract exact playlist ID'
      );
      assert(extractYouTubePlaylistId('javascript:alert(1)') === null, 'Must reject javascript: scheme');
      assert(extractYouTubePlaylistId('https://evil.example/playlist?list=PL123456789012') === null, 'Must reject non-YouTube domain');
      assert(!isValidYouTubePlaylistId('../etc/passwd'), 'Must reject path traversal playlist ID');
      assert(!isValidYouTubeVideoId('bad<script>'), 'Must reject malformed video ID');
      assert(getYouTubeEmbedUrl('bad<script>') === '', 'Invalid video ID must return empty embed URL');
    }
  );

  await runTest(
    'Watch status transitions, personal notes, and progress summaries persist and isolate per UID',
    () => {
      const storage = createMockStorage();
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:series_alpha', 'keep-guest');

      const ep1 = BINA_AL_NAFS_SERIES.videos[0].videoId;
      const ep2 = BINA_AL_NAFS_SERIES.videos[1].videoId;

      let store = setLessonWatchStatus(BINA_AL_NAFS_SERIES.id, ep1, 'in_progress', storage);
      assert(getLessonWatchStatus(store, BINA_AL_NAFS_SERIES.id, ep1) === 'in_progress', 'ep1 should be in_progress');

      store = toggleLessonCompleted(BINA_AL_NAFS_SERIES.id, ep1, storage);
      assert(getLessonWatchStatus(store, BINA_AL_NAFS_SERIES.id, ep1) === 'completed', 'ep1 should become completed');

      store = setLessonWatchStatus(BINA_AL_NAFS_SERIES.id, ep2, 'in_progress', storage);
      store = saveLessonNote(BINA_AL_NAFS_SERIES.id, ep1, 'الاستعداد للآخرة يثمر طمأنينة القلب', storage);

      const summary = getSeriesProgressSummary(BINA_AL_NAFS_SERIES, store);
      assert(summary.completedCount === 1, 'Completed count must be 1');
      assert(summary.inProgressCount === 1, 'In-progress count must be 1');
      assert(summary.unwatchedCount === 11, 'Unwatched count must be 11');
      assert(summary.nextUnwatchedLesson.videoId === ep2, 'Next unwatched lesson must be ep2');
      assert(
        store.progressBySeries[BINA_AL_NAFS_SERIES.id].videoNotes[ep1].includes('طمأنينة'),
        'Personal note must persist'
      );

      // Switch UID and verify strict isolation
      StorageService.setStorageScope('user:series_beta', 'keep-guest');
      const betaStore = readVideoSeriesStore(storage);
      assert(
        getLessonWatchStatus(betaStore, BINA_AL_NAFS_SERIES.id, ep1) === 'unwatched',
        'Different UID must not inherit alpha watch history'
      );

      StorageService.__resetStorageForTests();
    }
  );

  await runTest(
    'Daily suggested video advances across days, honors manual skip, and rotates after completion',
    () => {
      const storage = createMockStorage();
      StorageService.__resetStorageForTests();

      let store = readVideoSeriesStore(storage);
      const day1 = getDailySuggestedLesson(store, '2026-11-23');
      assert(day1.lesson.order === 1, 'Fresh user daily suggestion should start at episode 1');

      // Complete ep1 and verify next day suggests ep2
      store = toggleLessonCompleted(BINA_AL_NAFS_SERIES.id, day1.lesson.videoId, storage);
      const day2 = getDailySuggestedLesson(store, '2026-11-24');
      assert(day2.lesson.order === 2, 'Next day after completing ep1 should suggest ep2');

      // Manual advance on same day persists for that day
      store = advanceDailySuggestedLesson(BINA_AL_NAFS_SERIES.id, '2026-11-24', storage);
      const skipped = getDailySuggestedLesson(store, '2026-11-24');
      assert(skipped.lesson.order === 3, 'Manual advance should move suggestion to ep3');

      // Complete all 13 episodes and verify deterministic daily review rotation
      for (const v of BINA_AL_NAFS_SERIES.videos) {
        store = setLessonWatchStatus(BINA_AL_NAFS_SERIES.id, v.videoId, 'completed', storage);
      }
      const completedDay = getDailySuggestedLesson(store, '2026-11-25');
      assert(completedDay.isSeriesCompleted === true, 'Series should be flagged as completed');
      assert(completedDay.percent === 100, 'Percent should be 100');
      assert(completedDay.lesson.order >= 1 && completedDay.lesson.order <= 13, 'Completed rotation must pick a valid lesson');
    }
  );

  await runTest(
    'Extensible multi-series architecture adds custom playlists, switches featured series, and cleans up on removal',
    () => {
      const storage = createMockStorage();
      StorageService.__resetStorageForTests();

      // Reject duplicating built-in playlist
      const dup = addCustomSeries(
        {
          playlistId: BINA_AL_NAFS_SERIES.playlistId,
          title: 'مكررة',
          speaker: 'اختبار',
          videos: [{ videoId: 'HVNcSAD8xKs', title: 'درس 1', durationText: '10:00' }],
        },
        storage
      );
      assert(dup.ok === false, 'Must reject duplicate built-in playlist');

      // Add a new custom series (with raw YouTube descriptions passed in -> must be stripped cleanly)
      const added = addCustomSeries(
        {
          playlistId: 'PLCustomSeriesTest123456',
          title: 'سلسلة تدبر سور المفصل',
          speaker: 'الشيخ التجريبي',
          category: 'quran',
          featureOnDashboard: true,
          videos: [
            { videoId: 'dQw4w9WgXcQ', title: 'مقدمة التدبر', durationText: '42:15', description: 'وصف يوتيوب طويل جداً لا ينبغي عرضه' },
            { videoId: '9bZkp7q19f0', title: 'تأملات سورة ق', durationText: '38:40', description: 'روابط القناة والاشتراك...' },
          ],
        },
        storage
      );
      assert(added.ok === true, 'Valid custom series should be added');
      if (added.ok) {
        assert(added.series.description === '', 'Custom playlist should not fabricate boilerplate description');
        assert(
          added.series.videos.every((v) => v.description === undefined),
          'Custom playlist videos must strip raw YouTube descriptions'
        );
        const merged = getAllSeriesMerged(added.store.customSeries);
        assert(merged.length === VIDEO_SERIES_CATALOG.length + 1, 'Merged catalog should include custom series');
        const daily = getDailySuggestedLesson(added.store, '2026-11-23');
        assert(daily.series.id === added.series.id, 'Featured custom series should become dashboard daily source');

        // Switch featured back to built-in
        const switched = setFeaturedSeries(BINA_AL_NAFS_SERIES.id, '2026-11-23', storage);
        assert(switched.featuredSeriesId === BINA_AL_NAFS_SERIES.id, 'Featured series switch should persist');

        // Remove custom series
        const afterRemove = removeCustomSeries(added.series.id, storage);
        assert(afterRemove.customSeries.length === 0, 'Custom series should be removed cleanly');
      }
    }
  );

  await runTest(
    'Router supports #/series deep-linking and /api/youtube-playlist rejects invalid input safely',
    async () => {
      const hash = buildRouteHash({
        tab: 'series',
        seriesId: BINA_AL_NAFS_SERIES.id,
        videoId: BINA_AL_NAFS_SERIES.videos[2].videoId,
      });
      const parsed = parseRoute(hash);
      assert(parsed.tab === 'series', 'Route tab should be series');
      assert(parsed.seriesId === BINA_AL_NAFS_SERIES.id, 'Route seriesId should round-trip');
      assert(parsed.videoId === BINA_AL_NAFS_SERIES.videos[2].videoId, 'Route videoId should round-trip');

      const mockRes = {
        statusCode: 200,
        headers: {} as Record<string, string>,
        body: undefined as unknown,
        setHeader(k: string, v: string) {
          this.headers[k] = v;
        },
        status(code: number) {
          this.statusCode = code;
          return this;
        },
        json(payload: unknown) {
          this.body = payload;
          return this;
        },
        end() {
          return this;
        },
      };
      await youtubePlaylistHandler({ method: 'GET', query: { list: '../bad' } }, mockRes);
      assert(mockRes.statusCode === 400, `Expected HTTP 400 for invalid playlist ID, got ${mockRes.statusCode}`);
    }
  );

  return { passed, failed };
}
