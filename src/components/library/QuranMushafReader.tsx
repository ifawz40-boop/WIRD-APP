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
  Sparkles,
  Layers,
  X
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { QURAN_PAGE_INDEX } from '../../data/quranPageIndex.generated';
import { QURAN_JUZ_STARTS, QURAN_HIZB_QUARTER_STARTS } from '../../data/quranNavigationIndex.generated';
import { loadSurahVerses } from '../../data/quranDataLoader';
import { findSurahStartPage } from '../../data/quranNavigation';
import { RECITERS, getLicensedAyahAudioUrl, requestOfflineAudioCache } from '../../services/audioService';
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
import { offlineQuranAudioLibrary } from '../../services/offlineQuranAudioLibrary';
import {
  DESKTOP_SPREAD_BREAKPOINT_PX,
  getSavedMushafSpreadMode,
  resolveEffectiveSpreadMode,
  stepSpreadPage
} from '../../services/mushafSpreadService';
import { QuranAudioQueueController } from '../../services/audioQueueController';
import type { Ayah, ReciterId } from '../../types/quran';
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { TafsirSheet } from './TafsirSheet';
import type { ReadingKhatma } from '../../services/readingKhatmaService';
import { QuranText } from '../shared/QuranText';
import { AyahNavigationControls } from '../shared/AyahNavigationControls';
import { QuranBasmala } from '../shared/QuranBasmala';
import { loadMushafFacsimilePage } from '../../services/mushafFacsimileService';
import { PrintedMushafSpread } from './PrintedMushafSpread';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { SurahPickerControl } from '../shared/SurahPickerControl';
import { DisplaySettingsCollapsibleCard } from '../shared/DisplaySettingsMenu';
import { clampUiScale, formatAyahRangeOptionLabel } from '../../services/readingDisplayPreferences';

interface QuranMushafReaderProps {
  preferredReciter: ReciterId;
  onBack: () => void;
  initialPage?: number;
  readingKhatma?: ReadingKhatma | null;
  onMarkPageRead?: (page: number) => void;
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
    const value = Number(localStorage.getItem(LAST_PAGE_KEY));
    return Number.isInteger(value) && value >= 1 && value <= 604 ? value : 1;
  } catch {
    return 1;
  }
}

function readBookmarks(): number[] {
  try {
    const value = JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((p): p is number => Number.isInteger(p) && p >= 1 && p <= 604))].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export const QuranMushafReader: React.FC<QuranMushafReaderProps> = ({ preferredReciter, onBack, initialPage, readingKhatma, onMarkPageRead, readingKhatmaError }) => {
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
    try { return localStorage.getItem('wird.quran.readerLayout.v1') === 'printed' ? 'printed' : 'flow'; }
    catch { return 'flow'; }
  });
  const [showHizbPicker, setShowHizbPicker] = useState(false);
  const [printedAyahsByPage, setPrintedAyahsByPage] = useState<Record<number, Ayah[]>>({});
  const audioAyahs = readerLayout === 'printed'
    ? isTwoPageSpreadActive
      ? [...(printedAyahsByPage[page] || []), ...(printedAyahsByPage[page + 1] || [])]
      : (printedAyahsByPage[page] || [])
    : ayahs;
  const handlePrintedPageResolved = useRef((resolved: { page: number; ayahs: Ayah[] }) => {
    setPrintedAyahsByPage(prev => ({ ...prev, [resolved.page]: resolved.ayahs }));
  }).current;
  const [pageTurnDirection, setPageTurnDirection] = useState<'next' | 'previous'>('next');
  const audioQueueRef = useRef<QuranAudioQueueController | null>(null);
  const playbackRequestSeqRef = useRef(0);
  const activeObjectUrlRevokersRef = useRef(new Set<() => void>());
  const autoPlayNextPageRef = useRef(false);
  const pendingTargetRef = useRef<{ surahNumber: number; ayahNumber: number } | null>(null);
  const touchStartX = useRef<number | null>(null);
  const revokeAllActiveAudioUrls = () => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* Ignore stale object URL cleanup. */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  };


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
    try { localStorage.setItem(LAST_PAGE_KEY, String(page)); } catch { /* Reading remains available without persistence. */ }
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
      audioQueueRef.current?.stop();
      audioQueueRef.current = null;
      playbackRequestSeqRef.current += 1;
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
    const requestSeq = ++playbackRequestSeqRef.current;
    globalAudioCoordinator.claimFocus('mushaf');
    const resolvedTracks = await Promise.all(queue.map(async ayah => {
      const descriptor = getLicensedAyahAudioUrl(ayah.surahNumber, ayah.numberInSurah, activeReciter);
      const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
        descriptor.approvedReciterId,
        descriptor.globalAyahNumber,
        descriptor.url
      );
      return { track: { id: String(ayah.number), url: resolved.src }, revoke: resolved.revoke };
    }));
    if (requestSeq !== playbackRequestSeqRef.current) {
      resolvedTracks.forEach(item => item.revoke?.());
      return;
    }
    resolvedTracks.forEach(item => { if (item.revoke) activeObjectUrlRevokersRef.current.add(item.revoke); });
    const tracks = resolvedTracks.map(item => item.track);
    const cacheUpcoming = (index: number) => {
      requestOfflineAudioCache(tracks.slice(index, Math.min(endIndex + 1, index + 20)).map(track => track.url));
    };
    cacheUpcoming(startIndex);

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
        setIsPlaying(false);
        setIsAudioPaused(false);
        setPlayingIndex(null);
        setSegmentPlaybackStatus(null);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('mushaf');
        const nextPage = stepSpreadPage(page, 'next', isTwoPageSpreadActive);
        if (continueAcrossPages && nextPage !== page && nextPage <= 604) {
          autoPlayNextPageRef.current = true;
          // Keep the next-page effect from seeing the previous page's ayahs
          // before the page loader has started and replaced them.
          setIsLoading(true);
          setPage(nextPage);
        }
      },
      onError: error => {
        console.warn('[WIRD Mushaf] Quran audio queue failed:', error);
        if (audioQueueRef.current !== controller) return;
        audioQueueRef.current = null;
        setIsPlaying(false);
        setIsAudioPaused(false);
        setPlayingIndex(null);
        setSegmentPlaybackStatus(null);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('mushaf');
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
      setIsPlaying(false);
      setIsAudioPaused(false);
      setPlayingIndex(null);
      setSegmentPlaybackStatus(null);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('mushaf');
      console.warn('[WIRD Mushaf] Could not start Quran audio queue:', error);
    }
  };

  const playAyahAt = (index: number, queue: Ayah[] = audioAyahs) => {
    if (!queue[index]) {
      setIsPlaying(false);
      setPlayingIndex(null);
      return;
    }
    void startAudioQueue(queue, index, queue.length - 1, 1, true, normalizeAyahSegmentRepeatCount(perAyahRepeatCount));
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

  const changePage = (nextPage: number) => {
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > 604) return;
    setPageJumpError('');
    setPageTurnDirection(nextPage > page ? 'next' : 'previous');
    pendingTargetRef.current = null;
    autoPlayNextPageRef.current = false;
    stopAudio();
    setPage(nextPage);
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

  const handleNavigateToAyah = (surahNumber: number, ayahNumber: number): number | null => {
    const targetPage = Object.entries(PAGE_INDEX).find(([, segments]) =>
      segments.some(segment => segment.surahNumber === surahNumber && ayahNumber >= segment.startAyah && ayahNumber <= segment.endAyah)
    );
    if (!targetPage) return null;
    const pageNumber = Number(targetPage[0]);
    jumpToNavigationPoint({ surahNumber, ayahNumber, page: pageNumber });
    return pageNumber;
  };

  const handleNavigateFromTafsir = (surahNumber: number, ayahNumber: number): number | null => {
    const pageNumber = handleNavigateToAyah(surahNumber, ayahNumber);
    void loadSurahVerses(surahNumber).then(verses => {
      const targetAyah = verses.find(ayah => ayah.numberInSurah === ayahNumber);
      if (targetAyah) setTafsirAyah(targetAyah);
    }).catch(error => {
      console.warn('[WIRD Mushaf] Could not restore the selected local ayah after Tafsir navigation:', error);
    });
    return pageNumber;
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

  const toggleBookmark = () => {
    setBookmarks(current => {
      const next = current.includes(page) ? current.filter(item => item !== page) : [...current, page].sort((a, b) => a - b);
      try { localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next)); } catch { /* Bookmark works for this view if storage is blocked. */ }
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

  const isTwoPageSpreadActive = readerLayout === 'printed' &&
    typeof window !== 'undefined' &&
    resolveEffectiveSpreadMode(getSavedMushafSpreadMode('library'), window.innerWidth) === 'double' &&
    window.innerWidth >= DESKTOP_SPREAD_BREAKPOINT_PX;

  return (
    <div className={`space-y-6 ${isFullWidth ? 'max-w-none' : 'max-w-7xl'} mx-auto pb-12`}>
      {/* Top Control Bar */}
      <header className="wird-card rounded-2xl p-4 shadow-sm space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 py-1.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] transition-colors"
            >
              <ArrowRight className="h-4 w-4 text-[#1C4E46] dark:text-[#E0A96D]" /> العودة للفهرس
            </button>
            <div className="h-5 w-[1px] bg-[#1C4E46]/15 dark:bg-[#E0A96D]/20 mx-1 hidden sm:block" />
            <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D] text-sm hidden sm:inline">
              قارئ القرآن الكريم
            </span>
          </div>

          {/* Quick Page Jump & Bookmarks */}
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] p-1 text-xs">
              <span className="text-[#5B6F6B] dark:text-[#8B9E9B] px-1.5 text-[11px] font-semibold">صفحة:</span>
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
                className="min-h-11 w-14 rounded-lg bg-[#F2EDE2] dark:bg-[#0B132B] px-2 py-1 text-center font-mono tabular-nums font-bold text-xs text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
              <button
                type="button"
                onClick={submitPageJump}
                aria-label="انتقال إلى رقم الصفحة"
                className="min-h-11 rounded-lg bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] text-white px-3 py-1 text-xs font-bold transition-colors"
              >
                انتقال
              </button>
            </div>
            {pageJumpError && <span id="mushaf-page-jump-error" role="alert" className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">{pageJumpError}</span>}

            <button
              type="button"
              onClick={toggleBookmark}
              aria-label={currentBookmark ? 'إزالة العلامة المحفوظة' : 'حفظ علامة مرجعية'}
              title={currentBookmark ? 'إزالة العلامة من هذه الصفحة' : 'حفظ الصفحة في العلامات المرجعية'}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                currentBookmark
                  ? 'border-[#C59B27] bg-[#C59B27]/15 text-[#8A6914] dark:border-[#E0A96D] dark:bg-[#E0A96D]/15 dark:text-[#E0A96D]'
                  : 'border-[#1C4E46]/15 bg-white text-[#5B6F6B] hover:border-[#C59B27] dark:border-[#E0A96D]/25 dark:bg-[#111F36] dark:text-[#F5F1E8]'
              }`}
            >
              {currentBookmark ? <BookmarkCheck className="h-4 w-4 text-[#C59B27] dark:text-[#E0A96D]" /> : <Bookmark className="h-4 w-4" />}
              <span className="hidden sm:inline">{currentBookmark ? 'محفوظة' : 'حفظ علامة'}</span>
            </button>
          </div>
        </div>

        {/* Navigation: Searchable Surah Picker + Hizb Modal + Direct Juz Scroll Rail + Bookmarks */}
        <div className="space-y-2.5 pt-2.5 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-xs">
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
              className="min-h-11 inline-flex items-center gap-2 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] hover:border-[#C59B27] px-3.5 py-2 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] transition-colors"
            >
              <Layers className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
              <span>أرباع الأحزاب (240)</span>
            </button>

            {bookmarks.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">العلامات:</span>
                {bookmarks.map(savedPage => (
                  <button
                    key={savedPage}
                    type="button"
                    onClick={() => changePage(savedPage)}
                    className={`min-h-10 px-2.5 py-1 rounded-lg border text-xs font-mono tabular-nums font-bold transition-colors ${
                      savedPage === page
                        ? 'bg-[#C59B27] text-[#0B132B] border-[#C59B27]'
                        : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                    }`}
                  >
                    ص {savedPage}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D] shrink-0">الأجزاء:</span>
            <HorizontalScrollRail ariaLabel="الانتقال السريع بين الأجزاء" activeKey={currentJuz}>
              {Array.from({ length: 30 }, (_, index) => index + 1).map(juz => (
                <button
                  key={juz}
                  type="button"
                  aria-pressed={currentJuz === juz}
                  onClick={() => jumpToJuz(juz)}
                  className={`min-h-10 shrink-0 snap-start px-3 py-1 rounded-lg border text-[11px] font-bold font-mono tabular-nums transition-colors ${
                    currentJuz === juz
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                      : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                  }`}
                >
                  ج {juz}
                </button>
              ))}
            </HorizontalScrollRail>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#1C4E46]/10 pt-3 dark:border-[#E0A96D]/15">
          <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">طريقة عرض الصفحة</span>
          <div role="group" aria-label="طريقة عرض المصحف" className="inline-flex rounded-xl border border-[#1C4E46]/15 bg-[#F2EDE2] p-1 dark:border-[#E0A96D]/25 dark:bg-[#0E1A2F]">
            <button
              type="button"
              aria-pressed={readerLayout === 'printed'}
              onClick={() => selectReaderLayout('printed')}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${readerLayout === 'printed' ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white' : 'text-[#5B6F6B] hover:text-[#142421] dark:text-[#8B9E9B] dark:hover:text-[#F5F1E8]'}`}
            >
              الصفحة المطبوعة
            </button>
            <button
              type="button"
              aria-pressed={readerLayout === 'flow'}
              onClick={() => selectReaderLayout('flow')}
              className={`min-h-11 rounded-lg px-3 py-2 text-xs font-bold transition-colors ${readerLayout === 'flow' ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white' : 'text-[#5B6F6B] hover:text-[#142421] dark:text-[#8B9E9B] dark:hover:text-[#F5F1E8]'}`}
            >
              النص المرن
            </button>
          </div>
        </div>

        {/* Navigation & Audio Controls Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => changePage(stepSpreadPage(page, 'prev', isTwoPageSpreadActive))}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 py-1.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" /> الصفحة السابقة
            </button>
            <span aria-live="polite" aria-atomic="true" className="text-xs font-bold font-mono tabular-nums text-[#1C4E46] dark:text-[#E0A96D] bg-[#F2EDE2] dark:bg-[#162744] px-3 py-1.5 rounded-lg border border-[#C59B27]/30">
              {page} / 604
            </span>
            <button
              type="button"
              disabled={page >= 604}
              onClick={() => changePage(stepSpreadPage(page, 'next', isTwoPageSpreadActive))}
              className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 py-1.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] disabled:opacity-40 transition-colors"
            >
              الصفحة التالية <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Audio Player Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 max-w-full">
              <Volume2 className="h-4 w-4 text-[#1C4E46] dark:text-[#E0A96D] shrink-0" />
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
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                          : 'bg-white dark:bg-[#111F36] text-[#5B6F6B] dark:text-[#8B9E9B] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                      }`}
                    >
                      {shortName}
                    </button>
                  );
                })}
              </div>
            </div>

            <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />

            <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE]/70 dark:bg-[#0E1A2F] px-2.5 py-1" dir="rtl">
              <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
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
                  className="min-h-11 min-w-24 max-w-44 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
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

              <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
                <span className="font-bold">إلى</span>
                <select
                  aria-label="نهاية المقطع الصوتي"
                  value={segmentEndIndex}
                  disabled={!audioAyahs.length}
                  onChange={event => setSegmentEndIndex(Number(event.target.value))}
                  className="min-h-11 min-w-24 max-w-44 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
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
                <span className="text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D] hidden sm:inline">
                  من آية {selectedStartAyah.numberInSurah} إلى آية {selectedEndAyah.numberInSurah}
                </span>
              )}
            </div>

            <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
              <span>تكرار الآية</span>
              <select
                aria-label="عدد مرات تكرار كل آية في المصحف"
                value={normalizeAyahSegmentRepeatCount(perAyahRepeatCount)}
                onChange={event => {
                  const next = saveAudioRepeatCount(Number(event.target.value));
                  setPerAyahRepeatCount(next);
                  audioQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(next));
                }}
                className="min-h-11 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2 text-xs font-semibold"
              >
                <option value={1}>مرة</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
            </label>

            <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
              <span>تكرار المقطع</span>
              <select
                aria-label="عدد مرات تكرار المقطع الصوتي"
                value={segmentRepeatCount}
                onChange={event => {
                  const next = saveSegmentRepeatCount(Number(event.target.value));
                  setSegmentRepeatCount(next);
                  audioQueueRef.current?.setRepeatCount(next === -1 ? null : next);
                }}
                className="min-h-11 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2 text-xs font-semibold"
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
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-bold transition-all shadow-xs disabled:opacity-50 ${
                isPlaying ? 'bg-[#C59B27] text-[#0B132B] hover:bg-[#d6ad3b]' : 'bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] text-white'
              }`}
            >
              {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              <span>{isPlaying ? 'إيقاف مؤقت' : isAudioPaused ? 'استئناف التلاوة' : 'استماع للمقطع'}</span>
            </button>

            {segmentPlaybackStatus && (
              <span aria-live="polite" className="text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D] bg-[#F2EDE2] dark:bg-[#162744] px-2.5 py-1.5 rounded-lg border border-[#C59B27]/30 tabular-nums">
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
            <label htmlFor="mushaf-ui-scale" className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8] whitespace-nowrap">
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
              className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
            />
            <output htmlFor="mushaf-ui-scale" className="text-xs font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B] min-w-12 text-center">
              {uiScale}%
            </output>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">حجم النص</span>
              {([{ value: 'comfortable', label: 'مريح' }, { value: 'large', label: 'كبير' }, { value: 'extraLarge', label: 'أكبر' }] as const).map(option => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={textScale === option.value}
                  onClick={() => setTextScale(option.value)}
                  className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${textScale === option.value ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'border-[#1C4E46]/15 bg-white text-[#142421] hover:border-[#C59B27] dark:border-[#E0A96D]/20 dark:bg-[#0B132B] dark:text-[#F5F1E8]'}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                <span>تباعد الأسطر</span>
                <select
                  aria-label="تباعد أسطر المصحف"
                  value={lineSpacing}
                  onChange={event => setLineSpacing(event.target.value as MushafLineSpacing)}
                  className="min-h-11 rounded-lg border border-[#1C4E46]/15 bg-white px-2.5 text-xs font-semibold text-[#142421] dark:border-[#E0A96D]/25 dark:bg-[#0B132B] dark:text-[#F5F1E8]"
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
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${isWidePage ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'border-[#1C4E46]/15 bg-white text-[#142421] hover:border-[#C59B27] dark:border-[#E0A96D]/20 dark:bg-[#0B132B] dark:text-[#F5F1E8]'}`}
              >
                {isWidePage ? 'تقليل عرض الصفحة' : 'توسيع مساحة القراءة'}
              </button>
              <button
                type="button"
                aria-pressed={isFullWidth}
                onClick={() => setIsFullWidth(value => !value)}
                className={`min-h-11 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${isFullWidth ? 'border-[#C59B27] bg-[#1C4E46] text-white dark:bg-[#1E4A47]' : 'border-[#1C4E46]/15 bg-white text-[#142421] hover:border-[#C59B27] dark:border-[#E0A96D]/20 dark:bg-[#0B132B] dark:text-[#F5F1E8]'}`}
              >
                ملء الشاشة
              </button>
              <button
                type="button"
                onClick={() => { setUiScale(100); setTextScale('large'); setLineSpacing('normal'); setIsWidePage(false); setIsFullWidth(false); }}
                className="min-h-11 rounded-lg border border-[#1C4E46]/15 bg-white px-3 py-2 text-xs font-bold text-[#142421] hover:border-[#C59B27] dark:border-[#E0A96D]/20 dark:bg-[#0B132B] dark:text-[#F5F1E8]"
              >
                إعادة ضبط العرض
              </button>
            </div>
          </div>
        </div>
      </DisplaySettingsCollapsibleCard>

      {/* Responsive page-style reading surface */}
      <main key={page} style={{ zoom: uiScale / 100 }} onTouchStart={event => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={event => {
        const startX = touchStartX.current; touchStartX.current = null;
        if (startX === null || event.changedTouches.length === 0) return;
        const delta = event.changedTouches[0].clientX - startX;
        if (Math.abs(delta) > 65) changePage(stepSpreadPage(page, delta > 0 ? 'prev' : 'next', isTwoPageSpreadActive));
      }} aria-label={`صفحة المصحف ${page}`} data-mushaf-page-width={isFullWidth ? 'full' : isWidePage ? 'wide' : 'comfortable'} className={readerLayout === 'printed' ? `mx-auto w-full ${isFullWidth ? 'max-w-none' : 'max-w-7xl'}` : `mushaf-page-frame mx-auto ${isFullWidth ? 'max-w-none' : isWidePage ? 'max-w-6xl' : 'max-w-4xl'} rounded-3xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#C59B27]/40 dark:border-[#E0A96D]/25 px-6 py-8 md:px-14 md:py-12 shadow-xl transition-colors animate-mushaf-page-${pageTurnDirection}`}>
        {readerLayout === 'printed' ? (
          <PrintedMushafSpread
            surface="library"
            anchorPage={page}
            selectedAyah={tafsirAyah}
            onSelectAyah={setTafsirAyah}
            onAyahsResolved={handlePrintedPageResolved}
            onNavigateToAyah={handleNavigateFromTafsir}
            onFallback={() => selectReaderLayout('flow')}
            maxWidthClass={isFullWidth ? 'max-w-none' : 'max-w-7xl'}
          />
        ) : (
          <div className="space-y-0">
        {/* Top Margins of the Sacred Page */}
        <div className="mb-8 flex items-center justify-between border-b-2 border-[#C59B27]/40 dark:border-[#E0A96D]/35 pb-3 text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
          <span className="font-quran text-base text-[#1C4E46] dark:text-[#E0A96D]">
            {primarySurah?.name ? `سورة ${primarySurah.name}` : 'القرآن الكريم'}
          </span>
          <span className="font-mono tabular-nums text-xs px-3 py-0.5 rounded-lg bg-[#F2EDE2] dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] border border-[#C59B27]/40">
            صفحة {page}
          </span>
          <span className="font-sans-ui text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
            الجزء {currentJuz}
          </span>
        </div>

        <p className="mb-5 text-center text-xs text-[#5B6F6B] dark:text-[#8B9E9B]" role="note">
          عرض الآيات موزّع داخل صفحة مرنة، وليس محاكاة مطابقة لأسطر المصحف المطبوع. ستظل مطابقة الأسطر غير متاحة حتى تتوفر بيانات تخطيط موثّقة.
        </p>

        {readingKhatma && !readingKhatma.completedAt && <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#1C4E46]/10 px-3 py-2 text-xs dark:bg-[#1E4A47]/40">
          <span className="text-[#142421] dark:text-[#F5F1E8]">ختمة القراءة · {readingKhatma.completedPages.length} / 604 صفحة</span>
          <button type="button" onClick={() => onMarkPageRead?.(page)} disabled={readingKhatma.completedPages.includes(page)} className="min-h-11 rounded-lg bg-[#1C4E46] px-3 py-2 font-bold text-white disabled:bg-[#F2EDE2] disabled:text-[#1C4E46] dark:bg-[#1E4A47] dark:disabled:bg-[#111F36] dark:disabled:text-[#E0A96D]">
            {readingKhatma.completedPages.includes(page) ? 'تم تسجيل الصفحة كمقروءة' : 'تسجيل الصفحة كمقروءة'}
          </button>
        </div>}
        {readingKhatmaError && <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/40 dark:text-rose-200">{readingKhatmaError}</p>}

        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center gap-3 py-28 text-[#1C4E46] dark:text-[#E0A96D]">
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
          <div data-mushaf-line-spacing={lineSpacing} className={`text-right font-quran ${MUSHAF_TEXT_SCALE_CLASSES[textScale]} ${MUSHAF_LINE_SPACING_CLASSES[lineSpacing]} text-[#142421] dark:text-[#F5F1E8] selection:bg-[#C59B27]/30 selection:text-[#142421]`}>
            {ayahs.map((ayah, index) => {
              const surah = ALL_SURAHS.find(item => item.number === ayah.surahNumber);
              const isCurrent = playingIndex === index && isPlaying;
              return (
                <React.Fragment key={ayah.number}>
                  {/* Ornate Surah Header Banner when a Surah Starts on this Page */}
                  {ayah.numberInSurah === 1 && (
                    <div className="my-8 text-center">
                      <div className="surah-header-banner rounded-2xl py-4 px-6 text-white my-4 relative overflow-hidden shadow-md">
                        <div className="flex items-center justify-between text-xs text-[#F5F1E8]/90 font-sans-ui border-b border-[#C59B27]/40 pb-2 mb-2">
                          <span>{surah?.revelationType || 'مكية'}</span>
                          <h3 className="font-quran text-2xl md:text-3xl font-bold text-[#E0A96D] tracking-wide">
                            سورة {surah?.name || ayah.surahNumber}
                          </h3>
                          <span>{surah?.versesCount} آيات</span>
                        </div>
                      </div>

                      {/* Sacred Basmalah Presentation */}
                      {ayah.surahNumber !== 1 && ayah.surahNumber !== 9 && (
                        <p className="font-quran text-2xl md:text-3xl text-[#1C4E46] dark:text-[#E0A96D] py-3 text-center tracking-wide">
                          <QuranBasmala surahNumber={ayah.surahNumber} />
                        </p>
                      )}
                    </div>
                  )}

                  {/* Interactive Ayah Button with Hover / Active states */}
                  <button
                    id={'wird-ayah-' + ayah.surahNumber + '-' + ayah.numberInSurah}
                    type="button"
                    onClick={() => setTafsirAyah(ayah)}
                    title={`عرض التفسير المعتمد لسورة ${surah?.name || ayah.surahNumber}، الآية ${ayah.numberInSurah}`}
                    className={`inline rounded-xl px-1.5 py-0.5 text-right transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#e8dfc9] dark:bg-[#1d4940] ring-2 ring-[#b99b62] shadow-xs'
                        : 'hover:bg-[#e8dfc9]/50 dark:hover:bg-[#18332e]/60'
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

                  {/* Discrete Ayah Audio Button */}
                  <button
                    type="button"
                    onClick={() => playAyahAt(index)}
                    aria-label={`استماع للآية ${ayah.numberInSurah} من سورة ${surah?.name || ayah.surahNumber}`}
                    title={`استماع للآية ${ayah.numberInSurah}`}
                    className={`mx-1 inline-flex h-6 w-6 translate-y-[-2px] items-center justify-center rounded-full text-[10px] transition-colors ${
                      isCurrent
                        ? 'bg-[#b99b62] text-[#102d29]'
                        : 'bg-[#102d29]/5 text-[#102d29] hover:bg-[#102d29]/15 dark:bg-[#18332e] dark:text-[#dfcaa2]'
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
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t-2 border-[#C59B27]/40 dark:border-[#E0A96D]/30 pt-4 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
          <span className="max-w-[72%]">{QURAN_DATA_SOURCE_INFO.displayEdition} {QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayScript} · CC BY 3.0</span>
          <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="text-[#1C4E46] dark:text-[#E0A96D] underline underline-offset-2 font-semibold">Tanzil Project</a>
          <span className="font-quran text-sm text-[#142421] dark:text-[#E0A96D] font-bold">
            — {page} —
          </span>
          <span className="tabular-nums">
            {audioAyahs.length ? `من الآية ${audioAyahs[0].numberInSurah} إلى ${audioAyahs[audioAyahs.length - 1].numberInSurah}` : '—'}
          </span>
        </div>
          </div>
        )}
      </main>

      {/* Hizb Quarters Modal Picker */}
      {showHizbPicker && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4" onClick={() => setShowHizbPicker(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="الانتقال إلى ربع حزب"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl max-h-[82vh] flex flex-col bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#C59B27]/40 dark:border-[#E0A96D]/35 rounded-3xl shadow-2xl overflow-hidden"
          >
            <div className="p-4 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between gap-3 bg-white dark:bg-[#111F36]">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
                <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">الانتقال إلى ربع حزب (1 – 240)</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHizbPicker(false)}
                aria-label="إغلاق منتقي الأرباع"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] hover:text-[#142421] dark:hover:text-white"
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
                        ? 'bg-[#1C4E46] text-white border-[#C59B27]'
                        : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
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

      {(() => {
        const navigationAyah = tafsirAyah || audioAyahs[0] || ayahs[0];
        return navigationAyah ? (
          <div className="mx-auto mt-3 w-full max-w-4xl">
            <AyahNavigationControls currentAyah={navigationAyah} onNavigate={handleNavigateToAyah} />
          </div>
        ) : null;
      })()}

      {/* Helpful Hint */}
      <div className="text-center text-xs text-[#5B6F6B] dark:text-[#8B9E9B] flex items-center justify-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
        <span>انقر على أي آية لفتح التفسير المنقح من Quran.com مع إمكانية التبديل بين أمهات التفاسير والنسخ الفوري.</span>
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
