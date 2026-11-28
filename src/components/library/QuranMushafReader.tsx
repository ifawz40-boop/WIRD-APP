import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  BookOpen,
  RefreshCw,
  Search,
  Layers,
  X,
  Check,
  RotateCcw,
  Maximize2,
  Minimize2,
  Download,
  Flag
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { QURAN_PAGE_INDEX } from '../../data/quranPageIndex.generated';
import { QURAN_JUZ_STARTS, QURAN_HIZB_QUARTER_STARTS } from '../../data/quranNavigationIndex.generated';
import { loadSurahVerses } from '../../data/quranDataLoader';
import { findSurahStartPage } from '../../data/quranNavigation';
import {
  RECITERS,
  computeGlobalAyahNumber,
  formatAyahAudioUrl,
  getLicensedAyahAudioUrl,
  requestOfflineAudioCache,
  resolveApprovedOfflineReciterId
} from '../../services/audioService';
import { offlineQuranAudioLibrary } from '../../services/offlineQuranAudioLibrary';
import { StorageService } from '../../services/storageService';
import {
  getSavedAudioRepeatCount,
  getSavedPlaybackRate,
  getSavedPreferredReciter,
  getSavedSegmentRepeatCount,
  normalizeAyahSegmentRepeatCount,
  saveAudioRepeatCount,
  savePlaybackRate,
  savePreferredReciter,
  saveSegmentRepeatCount,
  subscribeAudioPreferences
} from '../../services/audioPreferences';
import type { AudioRepeatCount, PlaybackRate } from '../../services/audioPreferences';
import { globalAudioCoordinator } from '../../services/globalAudioCoordinator';
import {
  DESKTOP_SPREAD_BREAKPOINT_PX,
  getSavedMushafSpreadMode,
  resolveEffectiveSpreadMode,
  stepSpreadPage
} from '../../services/mushafSpreadService';
import { QuranAudioQueueController } from '../../services/audioQueueController';
import type { Ayah, ReciterId } from '../../types/quran';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { InlineAudioOfflineBadgeButton } from '../shared/InlineAudioOfflineBadgeButton';
import { TafsirSheet } from './TafsirSheet';
import {
  getReadingKhatmaProgress,
  type ReadingKhatma
} from '../../services/readingKhatmaService';
import { QuranText } from '../shared/QuranText';
import { QuranBasmala } from '../shared/QuranBasmala';
import {
  downloadFullMushafForOffline,
  getPinnedMushafOfflineStatus,
  loadMushafFacsimilePage
} from '../../services/mushafFacsimileService';
import {
  placeMushafRibbon,
  readMushafRibbons,
  type MushafRibbonBookmark,
  type MushafRibbonId
} from '../../services/mushafRibbonBookmarksService';
import { scheduleAuxiliaryCloudSync } from '../../services/auxiliaryCloudSyncService';
import { recordSyncDeletion, recordSyncUpsert } from '../../services/syncTombstoneRegistry';
import { PrintedMushafSpread, type PrintedMushafSpreadContext } from './PrintedMushafSpread';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { SurahPickerControl } from '../shared/SurahPickerControl';
import { DisplaySettingsCollapsibleCard } from '../shared/DisplaySettingsMenu';
import { clampUiScale, formatAyahRangeOptionLabel } from '../../services/readingDisplayPreferences';

interface QuranMushafReaderProps {
  preferredReciter: ReciterId;
  onBack: () => void;
  initialPage?: number;
  readingKhatma?: ReadingKhatma | null;
  readingKhatmas?: ReadingKhatma[];
  onSelectReadingKhatma?: (id: string) => void;
  onMarkPageRead?: (page: number) => void;
  onMarkSpreadPagesRead?: (pages: number[]) => void;
  onMarkUntilPageRead?: (upToPage: number) => void;
  onUnmarkPagesRead?: (pages: number[]) => void;
  onQuickStartReadingKhatma?: () => void;
  onPageVisited?: (page: number) => void;
  readingKhatmaError?: string;
}

interface PageSegment {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

interface NavigationPoint {
  surahNumber: number;
  ayahNumber: number;
  page: number;
}

const LAST_PAGE_KEY = 'wird.quran.lastPage.v1';
const BOOKMARKS_KEY = 'wird.quran.pageBookmarks.v1';
const MUSHAF_TEXT_SCALE_KEY = 'wird.quran.mushafTextScale.v1';
const MUSHAF_PAGE_WIDTH_KEY = 'wird.quran.mushafPageWidth.v1';
const MUSHAF_FULL_WIDTH_KEY = 'wird.quran.mushafFullWidth.v1';
const MUSHAF_LINE_SPACING_KEY = 'wird.quran.mushafLineSpacing.v1';
const MUSHAF_UI_SCALE_KEY = 'wird.quran.mushafUiScale.v1';

type MushafTextScale = 'comfortable' | 'large' | 'extraLarge';
type MushafLineSpacing = 'compact' | 'normal' | 'relaxed';

const MUSHAF_TEXT_SCALE_CLASSES: Record<MushafTextScale, string> = {
  comfortable: 'text-[1.35rem] md:text-[1.6rem]',
  large: 'text-[1.55rem] md:text-[1.85rem]',
  extraLarge: 'text-[1.8rem] md:text-[2.1rem]',
};

const MUSHAF_LINE_SPACING_CLASSES: Record<MushafLineSpacing, string> = {
  compact: 'leading-[2.1] md:leading-[2.3]',
  normal: 'leading-[2.35] md:leading-[2.55]',
  relaxed: 'leading-[2.6] md:leading-[2.85]',
};

function readMushafTextScale(): MushafTextScale {
  try {
    const value = localStorage.getItem(MUSHAF_TEXT_SCALE_KEY);
    return value === 'comfortable' || value === 'large' || value === 'extraLarge' ? value : 'large';
  } catch { return 'large'; }
}

function readMushafPageWidth(): boolean {
  try { return localStorage.getItem(MUSHAF_PAGE_WIDTH_KEY) === 'wide'; }
  catch { return false; }
}

function readMushafFullWidth(): boolean {
  try { return localStorage.getItem(MUSHAF_FULL_WIDTH_KEY) === 'true'; }
  catch { return false; }
}

function readMushafLineSpacing(): MushafLineSpacing {
  try {
    const value = localStorage.getItem(MUSHAF_LINE_SPACING_KEY);
    return value === 'compact' || value === 'relaxed' ? value : 'normal';
  } catch { return 'normal'; }
}

function readMushafUiScale(): number {
  try {
    const raw = localStorage.getItem(MUSHAF_UI_SCALE_KEY);
    return raw ? clampUiScale(Number(raw), 80, 115) : 100;
  } catch { return 100; }
}
const PAGE_INDEX = QURAN_PAGE_INDEX as unknown as Record<string, PageSegment[]>;
const JUZ_INDEX = QURAN_JUZ_STARTS as unknown as Record<string, NavigationPoint>;
const HIZB_INDEX = QURAN_HIZB_QUARTER_STARTS as unknown as Record<string, NavigationPoint>;

function readLastPage(): number {
  try {
    const value = Number(localStorage.getItem(StorageService.resolveScopedKey(LAST_PAGE_KEY)));
    return Number.isInteger(value) && value >= 1 && value <= 604 ? value : 1;
  } catch {
    return 1;
  }
}

function readBookmarks(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(StorageService.resolveScopedKey(BOOKMARKS_KEY)) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((p): p is number => Number.isInteger(p) && p >= 1 && p <= 604))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export const QuranMushafReader: React.FC<QuranMushafReaderProps> = ({
  preferredReciter,
  onBack,
  initialPage,
  readingKhatma,
  readingKhatmas,
  onSelectReadingKhatma,
  onMarkPageRead,
  onMarkSpreadPagesRead,
  onMarkUntilPageRead,
  onUnmarkPagesRead,
  onQuickStartReadingKhatma,
  onPageVisited,
  readingKhatmaError
}) => {
  const [page, setPage] = useState(() => Number.isInteger(initialPage) && initialPage! >= 1 && initialPage! <= 604 ? initialPage! : readLastPage());
  const [pageInput, setPageInput] = useState(String(Number.isInteger(initialPage) && initialPage! >= 1 && initialPage! <= 604 ? initialPage! : readLastPage()));
  const [pageJumpError, setPageJumpError] = useState('');
  const [textScale, setTextScale] = useState<MushafTextScale>(readMushafTextScale);
  const [isWidePage, setIsWidePage] = useState(readMushafPageWidth);
  const [isFullWidth, setIsFullWidth] = useState(readMushafFullWidth);
  const [lineSpacing, setLineSpacing] = useState<MushafLineSpacing>(readMushafLineSpacing);
  const [uiScale, setUiScale] = useState<number>(readMushafUiScale);
  const [ayahs, setAyahs] = useState<Ayah[]>([]);
  const [bookmarks, setBookmarks] = useState<number[]>(readBookmarks);
  const [ribbons, setRibbons] = useState<MushafRibbonBookmark[]>(readMushafRibbons);

  useEffect(() => {
    const handleRemoteSync = () => {
      setBookmarks(readBookmarks());
      setRibbons(readMushafRibbons());
    };
    window.addEventListener('wird:cloud-sync-applied', handleRemoteSync);
    window.addEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    return () => {
      window.removeEventListener('wird:cloud-sync-applied', handleRemoteSync);
      window.removeEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    };
  }, []);
  const [zenMode, setZenMode] = useState<boolean>(false);
  const [pinnedMushafStatus, setPinnedMushafStatus] = useState<{ cachedPages: number; totalPages: number; isComplete: boolean } | null>(null);
  const [isDownloadingMushaf, setIsDownloadingMushaf] = useState(false);
  const mushafDownloadAbortRef = useRef<AbortController | null>(null);
  const [activeReciter, setActiveReciter] = useState<ReciterId>(() =>
    getSavedPreferredReciter(preferredReciter || 'alafasy')
  );
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(getSavedPlaybackRate);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [segmentStartIndex, setSegmentStartIndex] = useState(0);
  const [segmentEndIndex, setSegmentEndIndex] = useState(0);
  const [perAyahRepeatCount, setPerAyahRepeatCount] = useState<AudioRepeatCount>(getSavedAudioRepeatCount);
  const [segmentRepeatCount, setSegmentRepeatCount] = useState<AudioRepeatCount>(getSavedSegmentRepeatCount);
  const [segmentPlaybackStatus, setSegmentPlaybackStatus] = useState<{ ayahNumber: number; cycle: number; ayahIteration: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [tafsirAyah, setTafsirAyah] = useState<Ayah | null>(null);
  const [readerLayout, setReaderLayout] = useState<'flow' | 'printed'>(() => {
    try { return localStorage.getItem('wird.quran.readerLayout.v1') === 'flow' ? 'flow' : 'printed'; }
    catch { return 'printed'; }
  });
  const mushafStageRef = useRef<HTMLElement | null>(null);
  const [showHizbPicker, setShowHizbPicker] = useState(false);
  const [printedAyahsByPage, setPrintedAyahsByPage] = useState<Record<number, Ayah[]>>({});
  const [printedSpreadContext, setPrintedSpreadContext] = useState<PrintedMushafSpreadContext | null>(null);
  const [lastMarkedUndoPages, setLastMarkedUndoPages] = useState<number[]>([]);
  const audioAyahs = readerLayout === 'printed'
    ? (printedAyahsByPage[page] || [])
    : ayahs;
  const handlePrintedPageResolved = useRef((resolved: { page: number; ayahs: Ayah[] }) => {
    setPrintedAyahsByPage(prev => ({ ...prev, [resolved.page]: resolved.ayahs }));
  }).current;
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'previous'>('next');
  const audioQueueRef = useRef<QuranAudioQueueController | null>(null);
  const playbackRequestSeqRef = useRef(0);
  const activeObjectUrlRevokersRef = useRef<Set<() => void>>(new Set());
  const revokeAllActiveAudioUrls = () => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* ignore */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  };
  const autoPlayNextPageRef = useRef(false);
  const pendingTargetRef = useRef<{ surahNumber: number; ayahNumber: number } | null>(null);
  const touchStartPoint = useRef<{ x: number; y: number } | null>(null);
  const onPageVisitedRef = useRef(onPageVisited);
  onPageVisitedRef.current = onPageVisited;

  useEffect(() => {
    if (Number.isInteger(initialPage) && initialPage! >= 1 && initialPage! <= 604) {
      setPage(initialPage!);
    }
  }, [initialPage]);

  const pageSegments = useMemo(() => PAGE_INDEX[String(page)] || [], [page]);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setAyahs([]);
    audioQueueRef.current?.stop();
    audioQueueRef.current = null;
    setIsPlaying(false);
    setIsAudioPaused(false);
    setPlayingIndex(null);

    if (!pageSegments.length) {
      setLoadError('لا توجد بيانات موثقة لهذه الصفحة.');
      setIsLoading(false);
      return () => { cancelled = true; };
    }

    Promise.all(pageSegments.map(async segment => {
      const surahAyahs = await loadSurahVerses(segment.surahNumber);
      return surahAyahs.filter(ayah => ayah.numberInSurah >= segment.startAyah && ayah.numberInSurah <= segment.endAyah);
    }))
      .then(groups => {
        if (!cancelled) {
          const result = groups.flat().sort((a, b) => a.number - b.number);
          if (!result.length) throw new Error('لم يتم العثور على آيات الصفحة في الملفات المحلية.');
          setAyahs(result);
        }
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'تعذر تحميل الصفحة.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [page, retry, pageSegments]);

  useEffect(() => {
    setPageInput(String(page));
    try {
      localStorage.setItem(StorageService.resolveScopedKey(LAST_PAGE_KEY), String(page));
      scheduleAuxiliaryCloudSync(2500);
    } catch { /* Reading remains available without persistence. */ }
    onPageVisitedRef.current?.(page);
  }, [page]);

  useEffect(() => {
    try { localStorage.setItem(MUSHAF_TEXT_SCALE_KEY, textScale); } catch { /* Reading controls remain usable without storage. */ }
  }, [textScale]);

  useEffect(() => {
    try { localStorage.setItem(MUSHAF_PAGE_WIDTH_KEY, isWidePage ? 'wide' : 'comfortable'); } catch { /* Reading controls remain usable without storage. */ }
  }, [isWidePage]);

  useEffect(() => {
    try { localStorage.setItem(MUSHAF_FULL_WIDTH_KEY, String(isFullWidth)); } catch { /* Reading controls remain usable without storage. */ }
  }, [isFullWidth]);

  useEffect(() => {
    try { localStorage.setItem(MUSHAF_LINE_SPACING_KEY, lineSpacing); } catch { /* Reading controls remain usable without storage. */ }
  }, [lineSpacing]);

  useEffect(() => {
    try { localStorage.setItem(MUSHAF_UI_SCALE_KEY, String(uiScale)); } catch { /* Reading controls remain usable without storage. */ }
  }, [uiScale]);

  useEffect(() => {
    setSegmentStartIndex(0);
    setSegmentEndIndex(Math.max(0, audioAyahs.length - 1));
  }, [page, audioAyahs.length]);

  const stopAudio = () => {
    playbackRequestSeqRef.current += 1;
    audioQueueRef.current?.stop();
    audioQueueRef.current = null;
    revokeAllActiveAudioUrls();
    globalAudioCoordinator.releaseFocus('mushaf');
    setIsPlaying(false);
    setIsAudioPaused(false);
    setPlayingIndex(null);
    setSegmentPlaybackStatus(null);
  };

  useEffect(() => {
    const unsubAudioPrefs = subscribeAudioPreferences(prefs => {
      setActiveReciter(prefs.preferredReciter);
      setPlaybackRate(prefs.playbackRate);
      setPerAyahRepeatCount(prefs.repeatCount);
      setSegmentRepeatCount(prefs.segmentRepeatCount);
      audioQueueRef.current?.setPlaybackRate(prefs.playbackRate);
    });
    const unregCoordinator = globalAudioCoordinator.register('mushaf', stopAudio);
    return () => {
      unsubAudioPrefs();
      unregCoordinator();
      playbackRequestSeqRef.current += 1;
      audioQueueRef.current?.stop();
      audioQueueRef.current = null;
      revokeAllActiveAudioUrls();
    };
  }, []);

  const startAudioQueue = async (
    queue: Ayah[],
    startIndex: number,
    endIndex: number,
    repeatCount: AudioRepeatCount,
    continueAcrossPages: boolean,
    ayahRepeatCount: number = normalizeAyahSegmentRepeatCount(perAyahRepeatCount)
  ) => {
    if (!queue.length || startIndex < 0 || endIndex < startIndex || endIndex >= queue.length) return;
    stopAudio();
    globalAudioCoordinator.claimFocus('mushaf');
    const requestSeq = ++playbackRequestSeqRef.current;
    const approvedReciterId = resolveApprovedOfflineReciterId(activeReciter);
    const cacheUpcoming = (index: number) => {
      requestOfflineAudioCache(
        queue.slice(index, Math.min(endIndex + 1, index + 20)).map(ayah =>
          getLicensedAyahAudioUrl(ayah.surahNumber, ayah.numberInSurah, activeReciter).url
        )
      );
    };
    cacheUpcoming(startIndex);

    const tracks = await Promise.all(
      queue.map(async ayah => {
        const fallbackUrl = formatAyahAudioUrl(ayah.surahNumber, ayah.numberInSurah, activeReciter);
        const globalAyah = computeGlobalAyahNumber(ayah.surahNumber, ayah.numberInSurah);
        const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
          approvedReciterId,
          globalAyah,
          fallbackUrl
        );
        if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);
        return {
          id: String(ayah.number),
          url: resolved.src
        };
      })
    );

    if (requestSeq !== playbackRequestSeqRef.current) {
      revokeAllActiveAudioUrls();
      return;
    }

    const controller = new QuranAudioQueueController({
      onTrackChange: (index, cycle, ayahIteration) => {
        setPlayingIndex(index);
        setSegmentPlaybackStatus({
          ayahNumber: queue[index]?.numberInSurah ?? 1,
          cycle,
          ayahIteration
        });
        if ((index - startIndex) % 10 === 0) cacheUpcoming(index);
      },
      onPlaying: () => { setIsPlaying(true); setIsAudioPaused(false); },
      onPaused: () => { setIsPlaying(false); setIsAudioPaused(true); },
      onComplete: () => {
        if (audioQueueRef.current !== controller) return;
        audioQueueRef.current = null;
        revokeAllActiveAudioUrls();
        setIsPlaying(false);
        setIsAudioPaused(false);
        setPlayingIndex(null);
        setSegmentPlaybackStatus(null);
        if (continueAcrossPages && page < 604) {
          autoPlayNextPageRef.current = true;
          // Keep the next-page effect from seeing the previous page's ayahs
          // before the page loader has started and replaced them.
          setIsLoading(true);
          setPage(page + 1);
        }
      },
      onError: error => {
        console.warn('[WIRD Mushaf] Quran audio queue failed:', error);
        if (audioQueueRef.current !== controller) return;
        audioQueueRef.current = null;
        revokeAllActiveAudioUrls();
        setIsPlaying(false);
        setIsAudioPaused(false);
        setPlayingIndex(null);
        setSegmentPlaybackStatus(null);
      }
    });
    audioQueueRef.current = controller;
    try {
      controller.start({
        tracks,
        startIndex,
        endIndex,
        ayahRepeatCount,
        repeatCount: repeatCount === -1 ? null : repeatCount,
        playbackRate: getSavedPlaybackRate()
      });
      setPlayingIndex(startIndex);
      setIsPlaying(true);
      setIsAudioPaused(false);
    } catch (error) {
      controller.stop();
      audioQueueRef.current = null;
      revokeAllActiveAudioUrls();
      setIsPlaying(false);
      setIsAudioPaused(false);
      setPlayingIndex(null);
      setSegmentPlaybackStatus(null);
      console.warn('[WIRD Mushaf] Could not start Quran audio queue:', error);
    }
  };

  const playAyahAt = (index: number, queue: Ayah[] = audioAyahs) => {
    if (!queue[index]) {
      setIsPlaying(false);
      setPlayingIndex(null);
      return;
    }
    startAudioQueue(queue, index, queue.length - 1, 1, true, normalizeAyahSegmentRepeatCount(perAyahRepeatCount));
  };

  useEffect(() => {
    if (!isLoading && audioAyahs.length > 0 && autoPlayNextPageRef.current) {
      autoPlayNextPageRef.current = false;
      playAyahAt(0, audioAyahs);
    }
  }, [audioAyahs, isLoading, page]);

  const togglePageAudio = () => {
    const controller = audioQueueRef.current;
    if (controller?.getState().active) {
      if (controller.getState().paused) controller.resume();
      else controller.pause();
      return;
    }
    if (audioAyahs.length) {
      const fullPage = segmentStartIndex === 0 && segmentEndIndex === audioAyahs.length - 1;
      startAudioQueue(
        audioAyahs,
        segmentStartIndex,
        segmentEndIndex,
        segmentRepeatCount,
        fullPage,
        normalizeAyahSegmentRepeatCount(perAyahRepeatCount)
      );
    }
  };

  const changePage = (nextPage: number, options?: { scrollToStage?: boolean }) => {
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > 604) return;
    setPageJumpError('');
    setPageTurnDirection(nextPage > page ? 'next' : 'previous');
    pendingTargetRef.current = null;
    autoPlayNextPageRef.current = false;
    stopAudio();
    setPage(nextPage);
    if (options?.scrollToStage) {
      mushafStageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const jumpToNavigationPoint = (point: NavigationPoint) => {
    const target = { surahNumber: point.surahNumber, ayahNumber: point.ayahNumber };
    if (point.page === page && audioAyahs.length &&
        audioAyahs.some(ayah => ayah.surahNumber === target.surahNumber && ayah.numberInSurah === target.ayahNumber)) {
      document.getElementById('wird-ayah-' + point.surahNumber + '-' + point.ayahNumber)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      pendingTargetRef.current = null;
      return;
    }

    if (readerLayout === 'printed') {
      const candidatePages = [point.page, point.page - 1, point.page + 1]
        .filter(candidate => candidate >= 1 && candidate <= 604);
      void (async () => {
        for (const candidate of candidatePages) {
          try {
            const data = await loadMushafFacsimilePage(candidate);
            if (data.ayahAreas.some(area => area.surahNumber === target.surahNumber && area.ayahNumber === target.ayahNumber)) {
              changePage(candidate);
              pendingTargetRef.current = target;
              return;
            }
          } catch {
            // A neighboring page may be temporarily unavailable; try the next grounded candidate.
          }
        }
        setPageJumpError('تعذر تحديد صفحة الآية في تخطيط المصحف المطبوع؛ يمكنك استخدام العرض المرن للانتقال إليها.');
      })();
      return;
    }

    changePage(point.page);
    pendingTargetRef.current = target;
  };

  const jumpToJuz = (juz: number) => {
    const point = JUZ_INDEX[String(juz)];
    if (point) jumpToNavigationPoint(point);
  };

  const jumpToHizbQuarter = (quarter: number) => {
    const point = HIZB_INDEX[String(quarter)];
    if (point) jumpToNavigationPoint(point);
  };

  const jumpToSurah = (surahNumber: number) => {
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);
    const exactStartPage = findSurahStartPage(surahNumber, PAGE_INDEX);
    if (surah && exactStartPage !== null) {
      jumpToNavigationPoint({ surahNumber, ayahNumber: 1, page: exactStartPage });
    }
  };

  const submitPageJump = () => {
    const requestedPage = Number(pageInput);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 || requestedPage > 604) {
      setPageJumpError('أدخل رقم صفحة صحيحاً من 1 إلى 604.');
      setPageInput(String(page));
      return;
    }
    setPageJumpError('');
    changePage(requestedPage);
  };

  useEffect(() => {
    let active = true;
    void getPinnedMushafOfflineStatus().then(st => {
      if (active) setPinnedMushafStatus(st);
    });
    return () => {
      active = false;
      mushafDownloadAbortRef.current?.abort();
    };
  }, []);

  const handleDownloadFullPrintedMushaf = async () => {
    if (isDownloadingMushaf) {
      mushafDownloadAbortRef.current?.abort();
      setIsDownloadingMushaf(false);
      return;
    }
    const ctrl = new AbortController();
    mushafDownloadAbortRef.current = ctrl;
    setIsDownloadingMushaf(true);
    try {
      await downloadFullMushafForOffline(prog => {
        setPinnedMushafStatus({
          cachedPages: prog.completed,
          totalPages: prog.total,
          isComplete: prog.completed >= prog.total,
        });
      }, ctrl.signal);
      const finalSt = await getPinnedMushafOfflineStatus();
      setPinnedMushafStatus(finalSt);
    } catch {
      const st = await getPinnedMushafOfflineStatus();
      setPinnedMushafStatus(st);
    } finally {
      setIsDownloadingMushaf(false);
    }
  };

  const handleToggleOrJumpRibbon = (ribbonId: MushafRibbonId, currentRibbonPage: number | null) => {
    if (currentRibbonPage === page) {
      setRibbons(placeMushafRibbon(ribbonId, null));
    } else {
      setRibbons(placeMushafRibbon(ribbonId, page));
    }
  };

  const activePlayingAyah =
    isPlaying && playingIndex !== null ? audioAyahs[playingIndex] || null : null;

  const toggleBookmark = () => {
    setBookmarks(current => {
      const removing = current.includes(page);
      const next = removing ? current.filter(item => item !== page) : [...current, page].sort((a, b) => a - b);
      try {
        localStorage.setItem(StorageService.resolveScopedKey(BOOKMARKS_KEY), JSON.stringify(next));
        if (removing) {
          recordSyncDeletion('pageBookmarks', String(page));
        } else {
          recordSyncUpsert('pageBookmarks', String(page));
        }
        scheduleAuxiliaryCloudSync();
      } catch { /* Bookmark works for this view if storage is blocked. */ }
      return next;
    });
  };

  useEffect(() => {
    const target = pendingTargetRef.current;
    if (!target || isLoading || !audioAyahs.length) return;
    if (!audioAyahs.some(ayah => ayah.surahNumber === target.surahNumber && ayah.numberInSurah === target.ayahNumber)) return;
    document.getElementById('wird-ayah-' + target.surahNumber + '-' + target.ayahNumber)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    pendingTargetRef.current = null;
  }, [audioAyahs, isLoading]);

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    audioQueueRef.current?.setPlaybackRate(savedRate);
  };

  const selectReaderLayout = (layout: 'flow' | 'printed') => {
    setReaderLayout(layout);
    try { localStorage.setItem('wird.quran.readerLayout.v1', layout); } catch { /* Layout preference remains available for this view. */ }
  };

  const currentBookmark = bookmarks.includes(page);
  const primarySurah = audioAyahs.length ? ALL_SURAHS.find(s => s.number === audioAyahs[0].surahNumber) : undefined;
  const currentJuz = audioAyahs.length ? audioAyahs[0].juz : Math.ceil(page / 20);
  const hasMultipleSurahsOnPage = useMemo(
    () => new Set(audioAyahs.map(item => item.surahNumber)).size > 1,
    [audioAyahs]
  );
  const selectedStartAyah = audioAyahs[segmentStartIndex];
  const selectedEndAyah = audioAyahs[segmentEndIndex];

  const isTwoPageSpreadActive = readerLayout === 'printed' && (
    printedSpreadContext
      ? printedSpreadContext.isTwoPage
      : (
          typeof window !== 'undefined' &&
          resolveEffectiveSpreadMode(getSavedMushafSpreadMode('library'), window.innerWidth) === 'double' &&
          window.innerWidth >= DESKTOP_SPREAD_BREAKPOINT_PX
        )
  );
  const isOppositeTafsirActive = readerLayout === 'printed' && Boolean(printedSpreadContext?.isOppositeTafsirActive);
  const visibleSpreadPages = readerLayout === 'printed' && printedSpreadContext?.visiblePages.length
    ? printedSpreadContext.visiblePages
    : [page];
  const activeReadingKhatmas = useMemo(
    () => (readingKhatmas || []).filter(k => !k.completedAt),
    [readingKhatmas]
  );
  const khatmaProgress = readingKhatma ? getReadingKhatmaProgress(readingKhatma) : null;

  return (
    <div className={`space-y-5 ${isFullWidth ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-12`}>
      {/* Top Control Bar */}
      <header className="wird-card rounded-[var(--wird-radius-card)] p-4 shadow-xs space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] transition-colors"
            >
              <ArrowRight className="h-4 w-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" /> العودة للفهرس
            </button>
            <div className="h-5 w-[1px] bg-[var(--wird-border)] mx-1 hidden sm:block" />
            <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] text-sm hidden sm:inline">
              المصحف الشريف
            </span>
          </div>

          {/* Quick Page Jump & Bookmarks */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] p-1 text-xs">
              <span className="text-[var(--wird-muted)] px-1.5 text-[11px] font-semibold">صفحة:</span>
              <input
                type="number"
                min={1}
                max={604}
                value={pageInput}
                onChange={event => { setPageInput(event.target.value); setPageJumpError(''); }}
                aria-invalid={Boolean(pageJumpError)}
                aria-describedby={pageJumpError ? 'mushaf-page-jump-error' : undefined}
                onKeyDown={event => event.key === 'Enter' && submitPageJump()}
                aria-label="رقم صفحة المصحف"
                className="min-h-10 w-14 rounded-lg bg-[var(--wird-surface-muted)] px-2 py-1 text-center font-mono tabular-nums font-bold text-xs text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
              />
              <button
                type="button"
                onClick={submitPageJump}
                aria-label="انتقال إلى رقم الصفحة"
                className="min-h-10 rounded-lg bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] px-3 py-1 text-xs font-bold transition-colors"
              >
                انتقال
              </button>
            </div>
            {pageJumpError && <span id="mushaf-page-jump-error" role="alert" className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">{pageJumpError}</span>}

            <button
              type="button"
              onClick={() => setZenMode(prev => !prev)}
              aria-pressed={zenMode}
              title={zenMode ? 'إظهار شريط الأدوات الكامل' : 'وضع القراءة الصافية (إخفاء القوائم العلوية)'}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] border px-3 py-1.5 text-xs font-bold transition-colors ${
                zenMode
                  ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                  : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
              }`}
            >
              {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />}
              <span className="hidden sm:inline">{zenMode ? 'إنهاء القراءة الصافية' : 'قراءة صافية'}</span>
            </button>

            <button
              type="button"
              onClick={toggleBookmark}
              aria-label={currentBookmark ? 'إزالة العلامة المحفوظة' : 'حفظ علامة مرجعية'}
              title={currentBookmark ? 'إزالة العلامة من هذه الصفحة' : 'حفظ الصفحة في العلامات المرجعية'}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] border px-3 py-1.5 text-xs font-bold transition-colors ${
                currentBookmark
                  ? 'border-[var(--wird-accent)] bg-[var(--wird-accent-soft)] text-[var(--wird-accent)]'
                  : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-muted)] hover:border-[var(--wird-accent)] hover:text-[var(--wird-text)]'
              }`}
            >
              {currentBookmark ? <BookmarkCheck className="h-4 w-4 text-[var(--wird-accent)]" /> : <Bookmark className="h-4 w-4" />}
              <span className="hidden sm:inline">{currentBookmark ? 'محفوظة' : 'حفظ علامة'}</span>
            </button>
          </div>
        </div>

        {/* Colored Silk Ribbons & 604-Page Offline Mushaf Pack Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-[var(--wird-border)] text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[var(--wird-muted)] me-1">
              <Flag className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
              <span>الفواصل الملونة:</span>
            </span>
            {ribbons.map(ribbon => {
              const isOnCurrentPage = ribbon.page === page;
              return (
                <div
                  key={ribbon.id}
                  className="inline-flex items-center rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => handleToggleOrJumpRibbon(ribbon.id, ribbon.page)}
                    title={isOnCurrentPage ? `إزالة ${ribbon.labelAr} من هذه الصفحة` : `وضع ${ribbon.labelAr} على صفحة ${page}`}
                    className={`min-h-9 px-2.5 py-1 inline-flex items-center gap-1.5 text-[11px] font-bold transition-colors ${
                      isOnCurrentPage
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                        : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface)]'
                    }`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: ribbon.colorHex }}
                      aria-hidden="true"
                    />
                    <span>{ribbon.labelAr.replace('فاصل ', '')}</span>
                  </button>
                  {ribbon.page !== null && !isOnCurrentPage && (
                    <button
                      type="button"
                      onClick={() => changePage(ribbon.page!)}
                      title={`الانتقال إلى ${ribbon.labelAr} (صفحة ${ribbon.page})`}
                      className="min-h-9 px-2 py-1 border-s border-[var(--wird-border)] font-mono tabular-nums text-[10px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-accent-soft)] transition-colors"
                    >
                      ص {ribbon.page}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {readerLayout === 'printed' && (
            <button
              type="button"
              onClick={() => void handleDownloadFullPrintedMushaf()}
              className={`min-h-9 px-3 py-1.5 rounded-lg border text-[11px] font-bold inline-flex items-center gap-1.5 transition-colors ${
                pinnedMushafStatus?.isComplete
                  ? 'border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                  : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'
              }`}
            >
              <Download className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span className="tabular-nums">
                {isDownloadingMushaf
                  ? `جارٍ حفظ المصحف أوفلاين (${pinnedMushafStatus?.cachedPages ?? 0}/604) — إيقاف`
                  : pinnedMushafStatus?.isComplete
                    ? 'المصحف المطبوع محفوظ أوفلاين (604/604)'
                    : pinnedMushafStatus && pinnedMushafStatus.cachedPages > 0
                      ? `استكمال حفظ المصحف أوفلاين (${pinnedMushafStatus.cachedPages}/604)`
                      : 'حفظ المصحف المطبوع كاملاً أوفلاين (604 ص)'}
              </span>
            </button>
          )}
        </div>

        {/* Navigation: Searchable Surah Picker + Hizb Modal + Direct Juz Scroll Rail + Bookmarks */}
        <div className={`${zenMode ? 'hidden' : 'space-y-2.5 pt-2.5 border-t border-[var(--wird-border)] text-xs'}`}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex-1 min-w-[210px]">
              <SurahPickerControl
                value={primarySurah?.number || 1}
                onChange={jumpToSurah}
                ariaLabel="الانتقال إلى سورة"
                compact
                showQuickPopular={false}
              />
            </div>

            <button
              type="button"
              onClick={() => setShowHizbPicker(true)}
              className="min-h-11 inline-flex items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] hover:border-[var(--wird-accent)] px-3.5 py-2 text-xs font-bold text-[var(--wird-text)] transition-colors"
            >
              <Layers className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <span>أرباع الأحزاب (240)</span>
            </button>

            {bookmarks.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-[var(--wird-muted)]">العلامات:</span>
                {bookmarks.map(savedPage => (
                  <button
                    key={savedPage}
                    type="button"
                    onClick={() => changePage(savedPage)}
                    className={`min-h-10 px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums font-bold transition-colors ${
                      savedPage === page
                        ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)] border-[var(--wird-accent)]'
                        : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                    }`}
                  >
                    ص {savedPage}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">الأجزاء:</span>
            <HorizontalScrollRail ariaLabel="الانتقال السريع بين الأجزاء" activeKey={currentJuz}>
              {Array.from({ length: 30 }, (_, index) => index + 1).map(juz => (
                <button
                  key={juz}
                  type="button"
                  aria-pressed={currentJuz === juz}
                  onClick={() => jumpToJuz(juz)}
                  className={`min-h-10 shrink-0 snap-start px-3 py-1 rounded-lg border text-[11px] font-bold font-mono tabular-nums transition-colors ${
                    currentJuz === juz
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  ج {juz}
                </button>
              ))}
            </HorizontalScrollRail>
          </div>
        </div>

        {/* Display Layout Toggle (Printed Mushaf Primary + Flexible Flow Fallback) */}
        <div className={`${zenMode ? 'hidden' : 'flex flex-wrap items-center justify-between gap-2 border-t border-[var(--wird-border)] pt-3'}`}>
          <span className="text-xs font-semibold text-[var(--wird-muted)]">طريقة عرض الصفحة</span>
          <div role="group" aria-label="طريقة عرض المصحف" className="inline-flex rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] p-1">
            <button
              type="button"
              aria-pressed={readerLayout === 'printed'}
              onClick={() => selectReaderLayout('printed')}
              className={`min-h-10 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${readerLayout === 'printed' ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'}`}
            >
              الصفحة المطبوعة
            </button>
            <button
              type="button"
              aria-pressed={readerLayout === 'flow'}
              onClick={() => selectReaderLayout('flow')}
              className={`min-h-10 rounded-lg px-3.5 py-1.5 text-xs font-bold transition-colors ${readerLayout === 'flow' ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'}`}
            >
              النص المرن
            </button>
          </div>
        </div>

        {/* Top Navigation & Audio Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--wird-border)] pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => changePage(stepSpreadPage(page, 'prev', isTwoPageSpreadActive, { isOppositeTafsirActive }))}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" /> الصفحة السابقة
            </button>
            <span aria-live="polite" aria-atomic="true" className="text-xs font-bold font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] bg-[var(--wird-surface-muted)] px-3 py-1.5 rounded-lg border border-[var(--wird-border-gold)]">
              {visibleSpreadPages.length === 2 ? `${visibleSpreadPages[0]}–${visibleSpreadPages[1]} / 604` : `${page} / 604`}
            </span>
            <button
              type="button"
              disabled={page >= 604}
              onClick={() => changePage(stepSpreadPage(page, 'next', isTwoPageSpreadActive, { isOppositeTafsirActive }))}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors"
            >
              الصفحة التالية <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Audio Player Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 max-w-full">
              <Volume2 className="h-4 w-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0" />
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                {RECITERS.map(reciter => {
                  const shortName = reciter.name.replace('الشيخ ', '').replace(' (مرتل)', '');
                  return (
                    <button
                      key={reciter.id}
                      type="button"
                      aria-pressed={activeReciter === reciter.id}
                      onClick={() => {
                        stopAudio();
                        const updated = savePreferredReciter(reciter.id);
                        setActiveReciter(updated.preferredReciter);
                      }}
                      className={`min-h-10 shrink-0 px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-colors ${
                        activeReciter === reciter.id
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                          : 'bg-[var(--wird-surface)] text-[var(--wird-muted)] border-[var(--wird-border)] hover:border-[var(--wird-accent)] hover:text-[var(--wird-text)]'
                      }`}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />

            <div className="inline-flex flex-wrap items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border)] bg-[var(--wird-surface-muted)]/75 px-2.5 py-1" dir="rtl">
              <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                <span className="font-bold">من</span>
                <select
                  aria-label="بداية المقطع الصوتي"
                  value={segmentStartIndex}
                  disabled={!audioAyahs.length}
                  onChange={event => {
                    const next = Number(event.target.value);
                    setSegmentStartIndex(next);
                    if (segmentEndIndex < next) setSegmentEndIndex(next);
                  }}
                  className="min-h-10 min-w-24 max-w-44 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
                >
                  {audioAyahs.map((ayah, index) => {
                    const surah = hasMultipleSurahsOnPage ? ALL_SURAHS.find(item => item.number === ayah.surahNumber) : undefined;
                    return (
                      <option key={ayah.number} value={index}>
                        {formatAyahRangeOptionLabel(ayah.numberInSurah, surah?.name, hasMultipleSurahsOnPage)}
                      </option>
                    );
                  })}
                </select>
              </label>

              <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                <span className="font-bold">إلى</span>
                <select
                  aria-label="نهاية المقطع الصوتي"
                  value={segmentEndIndex}
                  disabled={!audioAyahs.length}
                  onChange={event => setSegmentEndIndex(Number(event.target.value))}
                  className="min-h-10 min-w-24 max-w-44 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
                >
                  {audioAyahs.slice(segmentStartIndex).map((ayah, offset) => {
                    const index = segmentStartIndex + offset;
                    const surah = hasMultipleSurahsOnPage ? ALL_SURAHS.find(item => item.number === ayah.surahNumber) : undefined;
                    return (
                      <option key={ayah.number} value={index}>
                        {formatAyahRangeOptionLabel(ayah.numberInSurah, surah?.name, hasMultipleSurahsOnPage)}
                      </option>
                    );
                  })}
                </select>
              </label>

              {selectedStartAyah && selectedEndAyah && (
                <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hidden sm:inline">
                  من آية {selectedStartAyah.numberInSurah} إلى آية {selectedEndAyah.numberInSurah}
                </span>
              )}
            </div>

            <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
              <span>تكرار الآية</span>
              <select
                aria-label="عدد مرات تكرار كل آية في المصحف"
                value={normalizeAyahSegmentRepeatCount(perAyahRepeatCount)}
                onChange={event => {
                  const next = saveAudioRepeatCount(Number(event.target.value));
                  setPerAyahRepeatCount(next);
                  audioQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(next));
                }}
                className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2 text-xs font-semibold"
              >
                <option value={1}>مرة</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
              <span>تكرار المقطع</span>
              <select
                aria-label="عدد مرات تكرار المقطع الصوتي"
                value={segmentRepeatCount}
                onChange={event => {
                  const next = saveSegmentRepeatCount(Number(event.target.value));
                  setSegmentRepeatCount(next);
                  audioQueueRef.current?.setRepeatCount(next === -1 ? null : next);
                }}
                className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2 text-xs font-semibold"
              >
                <option value={1}>مرة</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={-1}>مستمر</option>
              </select>
            </label>

            <button
              type="button"
              onClick={togglePageAudio}
              disabled={!audioAyahs.length || (readerLayout === 'flow' && isLoading)}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] px-4 py-1.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 ${
                isPlaying
                  ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                  : 'bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)]'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'إيقاف مؤقت' : isAudioPaused ? 'استئناف التلاوة' : 'استماع للمقطع'}</span>
            </button>

            {pageSegments.length > 0 && (
              <InlineAudioOfflineBadgeButton
                reciter={activeReciter}
                scopeKind="range"
                labelAr={`صفحة المصحف ${page}`}
                ranges={pageSegments.map(seg => ({
                  surahNumber: seg.surahNumber,
                  startAyah: seg.startAyah,
                  endAyah: seg.endAyah
                }))}
                compact
              />
            )}

            {segmentPlaybackStatus && (
              <span aria-live="polite" className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] bg-[var(--wird-surface-muted)] px-2.5 py-1.5 rounded-lg border border-[var(--wird-border-gold)] tabular-nums">
                آية {segmentPlaybackStatus.ayahNumber} · الآية {segmentPlaybackStatus.ayahIteration}/{normalizeAyahSegmentRepeatCount(perAyahRepeatCount)} · المقطع {segmentPlaybackStatus.cycle}{segmentRepeatCount === -1 ? ' (مستمر)' : `/${segmentRepeatCount}`}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Collapsible Display Settings Menu for both Printed & Flexible Mushaf */}
      <DisplaySettingsCollapsibleCard
        title="إعدادات العرض"
        defaultOpen={false}
        storageKey="wird.quran.mushafDisplayMenuOpen.v1"
        summaryText={`${uiScale}% · ${textScale === 'comfortable' ? 'نص مريح' : textScale === 'large' ? 'نص كبير' : 'نص أكبر'}`}
      >
        <div className="space-y-3" role="group" aria-label="إعدادات عرض المصحف">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <label htmlFor="mushaf-ui-scale" className="text-xs font-bold text-[var(--wird-text)] whitespace-nowrap">
              حجم واجهة المصحف
            </label>
            <input
              id="mushaf-ui-scale"
              aria-label="حجم واجهة المصحف"
              type="range"
              min={80}
              max={115}
              step={5}
              value={uiScale}
              aria-valuetext={`${uiScale}%`}
              onChange={event => setUiScale(Number(event.target.value))}
              className="min-h-11 w-full accent-[var(--wird-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)]"
            />
            <output htmlFor="mushaf-ui-scale" className="text-xs font-mono tabular-nums text-[var(--wird-muted)] min-w-12 text-center">
              {uiScale}%
            </output>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--wird-border)]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[var(--wird-muted)]">حجم النص</span>
              {([{ value: 'comfortable', label: 'مريح' }, { value: 'large', label: 'كبير' }, { value: 'extraLarge', label: 'أكبر' }] as const).map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={textScale === option.value}
                  onClick={() => setTextScale(option.value)}
                  className={`min-h-10 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${textScale === option.value ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-[var(--wird-muted)]">
                <span>تباعد الأسطر</span>
                <select
                  aria-label="تباعد أسطر المصحف"
                  value={lineSpacing}
                  onChange={event => setLineSpacing(event.target.value as MushafLineSpacing)}
                  className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2.5 text-xs font-semibold text-[var(--wird-text)]"
                >
                  <option value="compact">متقارب</option>
                  <option value="normal">مريح</option>
                  <option value="relaxed">متباعد</option>
                </select>
              </label>
              <button
                type="button"
                aria-pressed={isWidePage}
                onClick={() => { setIsFullWidth(false); setIsWidePage(value => !value); }}
                className={`min-h-10 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${isWidePage ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'}`}
              >
                {isWidePage ? 'تقليل عرض الصفحة' : 'توسيع مساحة القراءة'}
              </button>
              <button
                type="button"
                aria-pressed={isFullWidth}
                onClick={() => setIsFullWidth(value => !value)}
                className={`min-h-10 rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors ${isFullWidth ? 'border-[var(--wird-accent)] bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]' : 'border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] hover:border-[var(--wird-accent)]'}`}
              >
                ملء الشاشة
              </button>
              <button
                type="button"
                onClick={() => { setUiScale(100); setTextScale('large'); setLineSpacing('normal'); setIsWidePage(false); setIsFullWidth(false); }}
                className="min-h-10 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-1.5 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)]"
              >
                إعادة ضبط العرض
              </button>
            </div>
          </div>
        </div>
      </DisplaySettingsCollapsibleCard>

      {/* Unified Reading Khatma Progress & Instant Save Bar */}
      {readingKhatma && !readingKhatma.completedAt && khatmaProgress && (
        <section
          aria-label="متابعة ورد القراءة والختمة"
          className="rounded-[var(--wird-radius-card)] border border-[var(--wird-border)] bg-[var(--wird-surface)] px-4 py-3 shadow-xs space-y-2.5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              {activeReadingKhatmas.length > 1 && onSelectReadingKhatma ? (
                <select
                  aria-label="اختيار الختمة النشطة داخل المصحف"
                  value={readingKhatma.id}
                  onChange={e => onSelectReadingKhatma(e.target.value)}
                  className="min-h-10 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] px-2.5 py-1 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]"
                >
                  {activeReadingKhatmas.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title || 'ختمة القراءة'} ({getReadingKhatmaProgress(item).percent}%)
                    </option>
                  ))}
                </select>
              ) : (
                <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                  {readingKhatma.title || 'ختمة القراءة'}
                </span>
              )}
              <span className="font-mono tabular-nums text-[var(--wird-text)]">
                {khatmaProgress.completedPages} / {khatmaProgress.totalScopePages} صفحة ({khatmaProgress.percent}%)
              </span>
              <span className="text-[var(--wird-muted)] tabular-nums">
                · ورد اليوم: {khatmaProgress.pagesReadToday}/{khatmaProgress.pagesPerDay}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLastMarkedUndoPages([page]);
                  onMarkPageRead?.(page);
                }}
                disabled={readingKhatma.completedPages.includes(page)}
                className="min-h-11 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] px-3.5 py-2 text-xs font-bold text-[var(--wird-primary-ink)] disabled:bg-[var(--wird-surface-muted)] disabled:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] transition-colors"
              >
                {readingKhatma.completedPages.includes(page) && <Check className="w-3.5 h-3.5" />}
                <span>{readingKhatma.completedPages.includes(page) ? 'تم تسجيل الصفحة كمقروءة' : 'تسجيل الصفحة كمقروءة'}</span>
              </button>

              {readerLayout === 'printed' &&
                visibleSpreadPages.length === 2 &&
                onMarkSpreadPagesRead &&
                visibleSpreadPages.some(p => !readingKhatma.completedPages.includes(p)) && (
                  <button
                    type="button"
                    onClick={() => {
                      const newlyMarked = visibleSpreadPages.filter(p => !readingKhatma.completedPages.includes(p));
                      setLastMarkedUndoPages(newlyMarked);
                      onMarkSpreadPagesRead(visibleSpreadPages);
                    }}
                    className="min-h-11 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] transition-colors tabular-nums"
                  >
                    تسجيل الصفحتين ({visibleSpreadPages[0]}–{visibleSpreadPages[1]})
                  </button>
                )}

              {onMarkUntilPageRead &&
                page > khatmaProgress.nextPage &&
                page - khatmaProgress.nextPage <= 30 &&
                !readingKhatma.completedPages.includes(page) && (
                  <button
                    type="button"
                    onClick={() => {
                      const batch: number[] = [];
                      for (let p = khatmaProgress.nextPage; p <= page; p += 1) {
                        if (!readingKhatma.completedPages.includes(p)) batch.push(p);
                      }
                      setLastMarkedUndoPages(batch);
                      onMarkUntilPageRead(page);
                    }}
                    className="min-h-11 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-3 py-2 text-xs font-bold text-[var(--wird-accent)] hover:border-[var(--wird-accent)] transition-colors tabular-nums"
                  >
                    تسجيل حتى ص {page}
                  </button>
                )}

              {onUnmarkPagesRead &&
                (readingKhatma.completedPages.includes(page) || lastMarkedUndoPages.length > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetUndo = lastMarkedUndoPages.length > 0 ? lastMarkedUndoPages : [page];
                      onUnmarkPagesRead(targetUndo);
                      setLastMarkedUndoPages([]);
                    }}
                    className="min-h-11 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-3 py-2 text-xs font-semibold text-[var(--wird-muted)] hover:border-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>تراجع</span>
                  </button>
                )}

              {page !== khatmaProgress.nextPage && !readingKhatma.completedPages.includes(khatmaProgress.nextPage) && (
                <button
                  type="button"
                  onClick={() => changePage(khatmaProgress.nextPage)}
                  className="min-h-11 inline-flex items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] px-3 py-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-surface-muted)] transition-colors tabular-nums"
                >
                  أول غير مقروءة (ص {khatmaProgress.nextPage})
                </button>
              )}
            </div>
          </div>
          {readingKhatmaError && (
            <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs font-semibold text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
              {readingKhatmaError}
            </p>
          )}
        </section>
      )}
      {(!readingKhatma || readingKhatma.completedAt) && onQuickStartReadingKhatma && (
        <section
          aria-label="بدء متابعة ختمة القراءة من المصحف"
          className="flex flex-wrap items-center justify-between gap-2.5 rounded-[var(--wird-radius-card)] border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)]/85 px-4 py-2.5 text-xs"
        >
          <span className="font-semibold text-[var(--wird-muted)]">
            لا توجد ختمة قراءة نشطة حالياً لتسجيل تقدمك في صفحات المصحف.
          </span>
          <button
            type="button"
            onClick={onQuickStartReadingKhatma}
            className="min-h-11 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] px-3.5 py-2 text-xs font-bold text-[var(--wird-primary-ink)] transition-colors whitespace-nowrap"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>بدء ختمة قراءة الآن</span>
          </button>
        </section>
      )}
      {(!readingKhatma || readingKhatma.completedAt) && readingKhatmaError && (
        <p role="alert" className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">
          {readingKhatmaError}
        </p>
      )}

      {/* Responsive page-style reading surface */}
      <main
        ref={mushafStageRef}
        key={readerLayout === 'printed' ? 'printed-mushaf-surface' : page}
        style={{ zoom: uiScale / 100 }}
        onTouchStart={event => {
          // Printed Mushaf delegates all pointer/touch turning exclusively to MushafPaperFlipStage.
          if (readerLayout === 'printed' || event.touches.length !== 1) {
            touchStartPoint.current = null;
            return;
          }
          const t = event.touches[0];
          touchStartPoint.current = t ? { x: t.clientX, y: t.clientY } : null;
        }}
        onTouchEnd={event => {
          const start = touchStartPoint.current;
          touchStartPoint.current = null;
          if (readerLayout === 'printed' || !start || event.changedTouches.length === 0) return;
          const end = event.changedTouches[0];
          const dx = end.clientX - start.x;
          const dy = end.clientY - start.y;
          // Require clear horizontal swipe (> 85px and >= 1.8x vertical movement) to avoid accidental flips on scroll/tap
          if (Math.abs(dx) >= 85 && Math.abs(dx) >= Math.abs(dy) * 1.8) {
            changePage(stepSpreadPage(page, dx > 0 ? 'next' : 'prev', isTwoPageSpreadActive, { isOppositeTafsirActive }));
          }
        }}
        aria-label={`صفحة المصحف ${page}`}
        data-mushaf-page-width={isFullWidth ? 'full' : isWidePage ? 'wide' : 'comfortable'}
        className={
          readerLayout === 'printed'
            ? `mx-auto w-full scroll-mt-20 ${isFullWidth ? 'max-w-none' : 'max-w-7xl'}`
            : `mushaf-page-frame mx-auto scroll-mt-20 ${isFullWidth ? 'max-w-none' : isWidePage ? 'max-w-6xl' : 'max-w-4xl'} rounded-3xl px-6 py-8 md:px-14 md:py-12 shadow-lg transition-colors animate-mushaf-page-${pageTurnDirection}`
        }
      >
        {readerLayout === 'printed' ? (
          <PrintedMushafSpread
            surface="library"
            anchorPage={page}
            onAnchorPageChange={changePage}
            selectedAyah={tafsirAyah}
            playingAyah={activePlayingAyah}
            ribbons={ribbons}
            onSelectAyah={setTafsirAyah}
            onAyahsResolved={handlePrintedPageResolved}
            onSpreadContextChange={setPrintedSpreadContext}
            onFallback={() => selectReaderLayout('flow')}
            maxWidthClass={isFullWidth ? 'max-w-none' : 'max-w-7xl'}
          />
        ) : (
          <div className="space-y-0">
            {/* Top Margins of the Sacred Page */}
            <div className="mb-8 flex items-center justify-between border-b-2 border-[var(--wird-border-gold)] pb-3 text-xs font-bold text-[var(--wird-text)]">
              <span className="font-quran text-base text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                {primarySurah?.name ? `سورة ${primarySurah.name}` : 'القرآن الكريم'}
              </span>
              <span className="font-mono tabular-nums text-xs px-3 py-0.5 rounded-lg bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border-gold)]">
                صفحة {page}
              </span>
              <span className="font-sans-ui text-xs text-[var(--wird-muted)]">
                الجزء {currentJuz}
              </span>
            </div>

            <p className="mb-5 text-center text-xs text-[var(--wird-muted)]" role="note">
              عرض الآيات موزّع داخل صفحة مرنة، وليس محاكاة مطابقة لأسطر المصحف المطبوع. ستظل مطابقة الأسطر غير متاحة حتى تتوفر بيانات تخطيط موثّقة.
            </p>

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center gap-3 py-28 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                <RefreshCw className="h-7 w-7 animate-spin" />
                <p className="text-sm font-semibold">جارٍ فتح صفحات المصحف الشريف...</p>
              </div>
            )}

            {/* Error State */}
            {!isLoading && loadError && (
              <div role="alert" className="space-y-4 py-20 text-center text-sm text-rose-700 dark:text-rose-300">
                <p className="font-bold">{loadError}</p>
                <button
                  type="button"
                  onClick={() => setRetry(val => val + 1)}
                  className="rounded-xl bg-rose-700 hover:bg-rose-800 px-5 py-2 text-xs font-bold text-white transition-colors"
                >
                  إعادة تحميل الصفحة
                </button>
              </div>
            )}

            {/* Verses Flow with Authentic Typography */}
            {!isLoading && !loadError && ayahs.length > 0 && (
              <div data-mushaf-line-spacing={lineSpacing} className={`text-right font-quran ${MUSHAF_TEXT_SCALE_CLASSES[textScale]} ${MUSHAF_LINE_SPACING_CLASSES[lineSpacing]} text-[var(--wird-text)] selection:bg-[var(--wird-accent-soft)]`}>
                {ayahs.map((ayah, index) => {
                  const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
                  const isCurrent = playingIndex === index && isPlaying;
                  return (
                    <React.Fragment key={ayah.number}>
                      {ayah.numberInSurah === 1 && (
                        <div className="my-8 text-center">
                          <div className="surah-header-banner rounded-2xl py-4 px-6 text-white my-4 relative overflow-hidden shadow-md">
                            <div className="flex items-center justify-between text-xs text-[#F5F1E8]/90 font-sans-ui border-b border-white/20 pb-2 mb-2">
                              <span>{surah?.revelationType || 'مكية'}</span>
                              <h3 className="font-quran text-2xl md:text-3xl font-bold text-[#E6B85C] tracking-wide">
                                سورة {surah?.name || ayah.surahNumber}
                              </h3>
                              <span>{surah?.versesCount} آيات</span>
                            </div>
                          </div>

                          {ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && (
                            <p className="font-quran text-2xl md:text-3xl text-[var(--wird-primary)] dark:text-[var(--wird-accent)] py-3 text-center tracking-wide">
                              <QuranBasmala surahNumber={ayah.surahNumber} />
                            </p>
                          )}
                        </div>
                      )}

                      <button
                        id={'wird-ayah-' + ayah.surahNumber + '-' + ayah.numberInSurah}
                        type="button"
                        onClick={() => setTafsirAyah(ayah)}
                        title={`عرض التفسير المعتمد لسورة ${surah?.name || ayah.surahNumber}، الآية ${ayah.numberInSurah}`}
                        className={`inline rounded-xl px-1.5 py-0.5 text-right transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-[var(--wird-accent-soft)] ring-2 ring-[var(--wird-accent)] shadow-xs'
                            : 'hover:bg-[var(--wird-surface-muted)]'
                        }`}
                      >
                        <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
                        <span
                          className="ayah-number"
                          title={`الآية ${ayah.numberInSurah}`}
                        >
                          {ayah.numberInSurah}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => playAyahAt(index)}
                        aria-label={`استماع للآية ${ayah.numberInSurah} من سورة ${surah?.name || ayah.surahNumber}`}
                        title={`استماع للآية ${ayah.numberInSurah}`}
                        className={`mx-1 inline-flex h-6 w-6 translate-y-[-2px] items-center justify-center rounded-full text-[10px] transition-colors ${
                          isCurrent
                            ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                            : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)]'
                        }`}
                      >
                        {isCurrent ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            )}

            {/* Bottom Margins of the Sacred Page */}
            <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[var(--wird-border-gold)] pt-4 text-[11px] text-[var(--wird-muted)]">
              <span className="max-w-[72%]">{QURAN_DATA_SOURCE_INFO.displayEdition} {QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayScript} · CC BY 3.0</span>
              <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)] underline underline-offset-2 font-semibold">Tanzil Project</a>
              <span className="font-quran text-sm text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">
                — {page} —
              </span>
              <span className="tabular-nums">
                {audioAyahs.length ? `من الآية ${audioAyahs[0].numberInSurah} إلى ${audioAyahs[audioAyahs.length - 1].numberInSurah}` : '—'}
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Page Navigation Bar (Eliminates scrolling back to the top to turn pages) */}
      <nav
        aria-label="التنقل السفلي بين صفحات المصحف"
        className="wird-card rounded-[var(--wird-radius-card)] px-4 py-3 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => changePage(stepSpreadPage(page, 'prev', isTwoPageSpreadActive, { isOppositeTafsirActive }), { scrollToStage: true })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-4 py-2 text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] disabled:opacity-40 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
            <span>الصفحة السابقة</span>
          </button>

          <span className="text-xs font-bold font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] bg-[var(--wird-surface-muted)] px-3.5 py-2 rounded-lg border border-[var(--wird-border-gold)]">
            {visibleSpreadPages.length === 2 ? `${visibleSpreadPages[0]}–${visibleSpreadPages[1]} / 604` : `${page} / 604`}
          </span>

          <button
            type="button"
            disabled={page >= 604}
            onClick={() => changePage(stepSpreadPage(page, 'next', isTwoPageSpreadActive, { isOppositeTafsirActive }), { scrollToStage: true })}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-[var(--wird-radius-control)] bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] px-4 py-2 text-xs font-bold text-[var(--wird-primary-ink)] disabled:opacity-40 transition-colors"
          >
            <span>{isOppositeTafsirActive ? 'الصفحة المقابلة التالية' : 'الصفحة التالية'}</span>
            <ChevronLeft className="h-4 w-4" />
          </button>

          {isOppositeTafsirActive && page < 603 && (
            <button
              type="button"
              onClick={() => changePage(stepSpreadPage(page, 'next', true, { isOppositeTafsirActive: false }), { scrollToStage: true })}
              className="inline-flex min-h-11 items-center gap-1 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] px-3 py-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] transition-colors whitespace-nowrap"
            >
              <span>تخطي صفحتين</span>
            </button>
          )}
        </div>

        {/* Bottom Quick Khatma Mark */}
        {readingKhatma && !readingKhatma.completedAt && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setLastMarkedUndoPages([page]);
                onMarkPageRead?.(page);
              }}
              disabled={readingKhatma.completedPages.includes(page)}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] px-3.5 py-2 text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] disabled:opacity-60 transition-colors"
            >
              {readingKhatma.completedPages.includes(page) && <Check className="w-3.5 h-3.5" />}
              <span>{readingKhatma.completedPages.includes(page) ? 'مسجلة في الختمة' : 'تسجيل الصفحة كمقروءة'}</span>
            </button>
          </div>
        )}
      </nav>

      {/* Hizb Quarters Modal Picker */}
      {showHizbPicker && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowHizbPicker(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="الانتقال إلى ربع حزب"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[82vh] flex flex-col bg-[var(--wird-bg)] border border-[var(--wird-border-gold)] rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[var(--wird-border)] flex items-center justify-between gap-3 bg-[var(--wird-surface)]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <h3 className="text-sm font-bold text-[var(--wird-text)]">الانتقال إلى ربع حزب (1 – 240)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHizbPicker(false)}
                aria-label="إغلاق منتقي الأرباع"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-4 sm:grid-cols-6 gap-2">
              {Array.from({ length: 240 }, (_, index) => index + 1).map(quarter => {
                const pt = HIZB_INDEX[String(quarter)];
                const isCurrentPageQuarter = pt?.page === page;
                return (
                  <button
                    key={quarter}
                    type="button"
                    onClick={() => {
                      jumpToHizbQuarter(quarter);
                      setShowHizbPicker(false);
                    }}
                    className={`min-h-11 rounded-xl border px-2 py-1.5 text-xs font-mono tabular-nums font-bold transition-colors ${
                      isCurrentPageQuarter
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                        : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                    }`}
                  >
                    ربع {quarter}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Helpful Hint */}
      <div className="text-center text-xs text-[var(--wird-muted)] flex items-center justify-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
        <span>انقر على أي آية لفتح التفسير المنقح من Quran.com مع إمكانية التبديل بين التفسير المقابل أو اللوحة الجانبية.</span>
      </div>

      {/* Multi-Edition Tafsir Sheet (Flow Mode only; Printed mode manages desktop side/opposite Tafsir inside PrintedMushafSpread) */}
      {readerLayout !== 'printed' && (
        <TafsirSheet
          ayah={tafsirAyah}
          onSelectAyah={setTafsirAyah}
          onClose={() => setTafsirAyah(null)}
          pageNumber={page}
          pageAyahs={ayahs}
        />
      )}
    </div>
  );
};
