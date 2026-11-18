import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search,
  Play,
  Pause,
  Volume2,
  BookOpen,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Bookmark,
  Layers,
  Copy,
  Check,
  RotateCcw,
  SkipBack,
  SkipForward,
  X,
  ExternalLink,
  SlidersHorizontal,
  Compass
} from 'lucide-react';
import { ALL_SURAHS, JUZ_NAMES } from '../../data/quranMeta';
import { QURAN_DATA_SOURCE_INFO } from '../../data/quranDataInfo';
import { loadSurahVerses, getAyahDisplayText } from '../../data/quranDataLoader';
import { TafsirSheet } from './TafsirSheet';
import { Ayah, SurahMeta, ReciterId } from '../../types/quran';
import { RECITERS, getLicensedAyahAudioUrl, requestOfflineAudioCache } from '../../services/audioService';
import { attachAyahRepeatHandler } from '../../services/audioRepeatController';
import { QuranAudioQueueController } from '../../services/audioQueueController';
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
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { QuranMushafReader } from './QuranMushafReader';
import { QURAN_JUZ_STARTS } from '../../data/quranNavigationIndex.generated';
import {
  clearReadingKhatma,
  markReadingPage,
  pauseReadingKhatma,
  readReadingKhatma,
  resumeReadingKhatma,
  startReadingKhatma,
  updateReadingKhatmaPlan
} from '../../services/readingKhatmaService';
import type { ReadingKhatma } from '../../services/readingKhatmaService';
import { ReadingKhatmaPanel } from './ReadingKhatmaPanel';
import { QuranText } from '../shared/QuranText';
import { AyahNavigationControls } from '../shared/AyahNavigationControls';
import { QuranBasmala } from '../shared/QuranBasmala';
import { QuranTypographyLab } from './QuranTypographyLab';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { READING_PAGE_WIDTH_CLASSES, formatAyahRangeOptionLabel } from '../../services/readingDisplayPreferences';

interface QuranLibraryViewProps {
  onStartSession: (surahNumber: number, startAyah?: number, endAyah?: number) => void;
  preferredReciter: ReciterId;
}

type MainTab = 'surahs' | 'juz' | 'study';
type StudyLayout = 'ayah-cards' | 'continuous';
type QuranReadingPosition = { surahNumber: number; ayahNumber: number };

const JUZ_INDEX = QURAN_JUZ_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
const LAST_READING_POSITION_KEY = 'wird.quran.lastReadingPosition.v1';

function readLastReadingPosition(): QuranReadingPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(LAST_READING_POSITION_KEY) || 'null') as QuranReadingPosition | null;
    if (!value || !Number.isInteger(value.surahNumber) || !Number.isInteger(value.ayahNumber)) return null;
    const surah = ALL_SURAHS[value.surahNumber - 1];
    return surah && value.ayahNumber >= 1 && value.ayahNumber <= surah.versesCount ? value : null;
  } catch {
    return null;
  }
}

export const QuranLibraryView: React.FC<QuranLibraryViewProps> = ({
  onStartSession,
  preferredReciter: initialReciter
}) => {
  const [activeTab, setActiveTab] = useState<MainTab>('surahs');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedJuz, setSelectedJuz] = useState<number | 'all'>('all');
  const [revelationFilter, setRevelationFilter] = useState<'all' | 'مكية' | 'مدنية'>('all');
  const [selectedSurah, setSelectedSurah] = useState<SurahMeta>(ALL_SURAHS[0]); // Default to Al-Fatihah (1)
  const [sessionRangeStart, setSessionRangeStart] = useState<number>(1);
  const [sessionRangeEnd, setSessionRangeEnd] = useState<number>(ALL_SURAHS[0].versesCount);
  const [currentAyahs, setCurrentAyahs] = useState<Ayah[]>([]);
  const [isLoadingSurah, setIsLoadingSurah] = useState(false);
  const [surahLoadError, setSurahLoadError] = useState(false);
  const [loadRetry, setLoadRetry] = useState(0);
  const [tafsirAyah, setTafsirAyah] = useState<Ayah | null>(null);

  useEffect(() => {
    setSessionRangeStart(1);
    setSessionRangeEnd(selectedSurah.versesCount);
  }, [selectedSurah.number, selectedSurah.versesCount]);

  // Device-local display preferences for Quran Library & Study mode
  const {
    preferences: displayPreferences,
    updatePreferences: updateDisplayPreferences,
    resetPreferences: resetDisplayPreferences,
  } = useReadingDisplayPreferences('library');
  const [showMushafReader, setShowMushafReader] = useState(false);
  const [studyLayout, setStudyLayout] = useState<StudyLayout>('ayah-cards');
  const [showTypographyLab, setShowTypographyLab] = useState(false);
  const [lastReadingPosition, setLastReadingPosition] = useState<QuranReadingPosition | null>(readLastReadingPosition);
  const [resumeTarget, setResumeTarget] = useState<QuranReadingPosition | null>(null);
  const [mushafInitialPage, setMushafInitialPage] = useState<number | undefined>(undefined);
  const [copiedAyahNumber, setCopiedAyahNumber] = useState<number | null>(null);
  const [readingKhatma, setReadingKhatma] = useState<ReadingKhatma | null>(() => readReadingKhatma());
  const [readingKhatmaError, setReadingKhatmaError] = useState('');

  // Audio state (reconciled live across all audio views)
  const [activeReciter, setActiveReciter] = useState<ReciterId>(() =>
    getSavedPreferredReciter(initialReciter || 'alafasy')
  );
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => getSavedPlaybackRate());
  const [playingAyah, setPlayingAyah] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [repeatTarget, setRepeatTarget] = useState<AudioRepeatCount>(() => getSavedAudioRepeatCount());
  const [currentRepeatCount, setCurrentRepeatCount] = useState<number>(1);
  const [segmentStartIndex, setSegmentStartIndex] = useState<number>(0);
  const [segmentEndIndex, setSegmentEndIndex] = useState<number>(0);
  const [segmentRepeatCount, setSegmentRepeatCount] = useState<AudioRepeatCount>(() => getSavedSegmentRepeatCount());
  const [isSegmentPlaying, setIsSegmentPlaying] = useState<boolean>(false);
  const [isSegmentPaused, setIsSegmentPaused] = useState<boolean>(false);
  const [segmentStatus, setSegmentStatus] = useState<{ ayahNumber: number; cycle: number; ayahIteration: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentQueueRef = useRef<QuranAudioQueueController | null>(null);
  const playbackRequestSeqRef = useRef(0);
  const activeObjectUrlRevokersRef = useRef(new Set<() => void>());
  const currentRepeatCountRef = useRef(1);
  const repeatTargetRef = useRef<number | null>(repeatTarget === -1 ? null : repeatTarget);
  const stopAudioRef = useRef<() => void>(() => {});
  const revokeAllActiveAudioUrls = () => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* Ignore stale object URL cleanup. */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  };


  // Filter surahs
  const filteredSurahs = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return ALL_SURAHS.filter(surah => {
      const matchesSearch =
        !term ||
        surah.name.includes(term) ||
        surah.englishName.toLowerCase().includes(term) ||
        String(surah.number) === term;
      const matchesJuz = selectedJuz === 'all' || (surah.juzStart <= selectedJuz && surah.juzEnd >= selectedJuz);
      const matchesType = revelationFilter === 'all' || surah.revelationType === revelationFilter;
      return matchesSearch && matchesJuz && matchesType;
    });
  }, [searchTerm, selectedJuz, revelationFilter]);

  // Lazy-load the selected Surah verses only when needed
  useEffect(() => {
    let cancelled = false;
    if (showMushafReader || activeTab !== 'study') return () => { cancelled = true; };

    setCurrentAyahs([]);
    setIsLoadingSurah(true);
    setSurahLoadError(false);

    loadSurahVerses(selectedSurah.number)
      .then(ayahs => {
        if (!cancelled) setCurrentAyahs(ayahs);
      })
      .catch(error => {
        if (!cancelled) {
          console.error('[WIRD Quran Library] Failed to load Surah ' + selectedSurah.number, error);
          setSurahLoadError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingSurah(false);
      });

    return () => { cancelled = true; };
  }, [selectedSurah.number, loadRetry, showMushafReader, activeTab]);

  useEffect(() => {
    setSegmentStartIndex(0);
    setSegmentEndIndex(Math.max(0, currentAyahs.length - 1));
  }, [currentAyahs.length, selectedSurah.number]);

  useEffect(() => {
    if (!resumeTarget || activeTab !== 'study' || showMushafReader || selectedSurah.number !== resumeTarget.surahNumber || !currentAyahs.some(ayah => ayah.numberInSurah === resumeTarget.ayahNumber)) return;
    const timer = window.setTimeout(() => {
      document.getElementById(`continuous-ayah-${resumeTarget.ayahNumber}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setResumeTarget(null);
    }, 80);
    return () => window.clearTimeout(timer);
  }, [resumeTarget, activeTab, showMushafReader, selectedSurah.number, currentAyahs]);

  const rememberReadingPosition = (ayahNumber: number) => {
    const position = { surahNumber: selectedSurah.number, ayahNumber };
    setLastReadingPosition(position);
    try { localStorage.setItem(LAST_READING_POSITION_KEY, JSON.stringify(position)); } catch { /* Keep the current read usable when storage is unavailable. */ }
  };

  const handleResumeReading = () => {
    if (!lastReadingPosition) return;
    const surah = ALL_SURAHS[lastReadingPosition.surahNumber - 1];
    if (!surah) return;
    setResumeTarget(lastReadingPosition);
    setStudyLayout('continuous');
    setSelectedSurah(surah);
    setActiveTab('study');
  };

  const handleNavigateToAyah = (surahNumber: number, ayahNumber: number) => {
    const surah = ALL_SURAHS[surahNumber - 1];
    if (!surah || ayahNumber < 1 || ayahNumber > surah.versesCount) return;
    const position = { surahNumber, ayahNumber };
    setLastReadingPosition(position);
    setResumeTarget(position);
    try { localStorage.setItem(LAST_READING_POSITION_KEY, JSON.stringify(position)); } catch { /* Keep navigation available without storage. */ }
    setStudyLayout('continuous');
    setSelectedSurah(surah);
    setActiveTab('study');
  };

  // Audio playback uses refs for event-driven repeat state; React state is UI-only.
  const handlePlayAyah = async (ayahNumberInSurah: number) => {
    rememberReadingPosition(ayahNumberInSurah);
    segmentQueueRef.current?.stop();
    segmentQueueRef.current = null;
    setIsSegmentPlaying(false);
    setIsSegmentPaused(false);
    setSegmentStatus(null);
    if (playingAyah === ayahNumberInSurah && audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
        globalAudioCoordinator.releaseFocus('library');
      } else {
        globalAudioCoordinator.claimFocus('library');
        audioRef.current.play().then(() => setIsPlaying(true)).catch(error => {
          console.warn('Audio resume failed', error);
          setIsPlaying(false);
          globalAudioCoordinator.releaseFocus('library');
        });
      }
      return;
    }

    const requestSeq = ++playbackRequestSeqRef.current;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    revokeAllActiveAudioUrls();
    globalAudioCoordinator.claimFocus('library');
    currentRepeatCountRef.current = 1;
    repeatTargetRef.current = repeatTarget === -1 ? null : repeatTarget;
    setCurrentRepeatCount(1);
    setPlayingAyah(ayahNumberInSurah);
    setIsPlaying(false);

    const descriptor = getLicensedAyahAudioUrl(selectedSurah.number, ayahNumberInSurah, activeReciter);
    requestOfflineAudioCache(
      currentAyahs.filter(ayah => ayah.numberInSurah >= ayahNumberInSurah).slice(0, 20)
        .map(ayah => getLicensedAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter).url)
    );
    const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
      descriptor.approvedReciterId,
      descriptor.globalAyahNumber,
      descriptor.url
    );
    if (requestSeq !== playbackRequestSeqRef.current) {
      resolved.revoke?.();
      return;
    }
    if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);

    const audio = new Audio(resolved.src);
    audio.playbackRate = getSavedPlaybackRate();
    audioRef.current = audio;
    setIsPlaying(true);

    const resetFailedPlayback = () => {
      if (requestSeq !== playbackRequestSeqRef.current) return;
      if (audioRef.current === audio) audioRef.current = null;
      audio.onended = null;
      audio.onerror = null;
      currentRepeatCountRef.current = 1;
      setCurrentRepeatCount(1);
      setIsPlaying(false);
      setPlayingAyah(null);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('library');
    };

    attachAyahRepeatHandler(
      audio,
      currentRepeatCountRef,
      repeatTargetRef,
      setCurrentRepeatCount,
      () => {
        const nextAyah = ayahNumberInSurah + 1;
        const hasNext = currentAyahs.some(a => a.numberInSurah === nextAyah);
        if (hasNext) {
          void handlePlayAyah(nextAyah);
        } else {
          audioRef.current = null;
          setIsPlaying(false);
          setPlayingAyah(null);
          revokeAllActiveAudioUrls();
          globalAudioCoordinator.releaseFocus('library');
        }
      },
      () => {
        audio.onended = null;
        audioRef.current = null;
        currentRepeatCountRef.current = 1;
        setCurrentRepeatCount(1);
        setIsPlaying(false);
        setPlayingAyah(null);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('library');
      }
    );

    audio.onerror = () => {
      console.warn('[WIRD Library] Audio playback failed:', audio.error);
      resetFailedPlayback();
    };
    audio.play().catch(error => {
      console.warn('Audio play prevented or unavailable', error);
      resetFailedPlayback();
    });
  };
  const handleNextAyah = () => {
    if (!currentAyahs.length) return;
    const current = playingAyah || 1;
    const next = current + 1;
    if (next <= selectedSurah.versesCount) {
      setCurrentRepeatCount(1);
      handlePlayAyah(next);
    }
  };

  const handlePrevAyah = () => {
    if (!currentAyahs.length) return;
    const current = playingAyah || 1;
    const prev = current - 1;
    if (prev >= 1) {
      setCurrentRepeatCount(1);
      handlePlayAyah(prev);
    }
  };

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
    segmentQueueRef.current?.setPlaybackRate(savedRate);
  };

  const handleRepeatTargetChange = (count: AudioRepeatCount) => {
    const savedCount = saveAudioRepeatCount(count);
    repeatTargetRef.current = savedCount === -1 ? null : savedCount;
    setRepeatTarget(savedCount);
    segmentQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(savedCount));
  };

  const handleSegmentRepeatCountChange = (count: AudioRepeatCount) => {
    const savedCount = saveSegmentRepeatCount(count);
    setSegmentRepeatCount(savedCount);
    segmentQueueRef.current?.setRepeatCount(savedCount === -1 ? null : savedCount);
  };

  const handleStopAudio = () => {
    playbackRequestSeqRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    revokeAllActiveAudioUrls();
    segmentQueueRef.current?.stop();
    segmentQueueRef.current = null;
    currentRepeatCountRef.current = 1;
    setIsPlaying(false);
    setPlayingAyah(null);
    setCurrentRepeatCount(1);
    setIsSegmentPlaying(false);
    setIsSegmentPaused(false);
    setSegmentStatus(null);
    globalAudioCoordinator.releaseFocus('library');
  };
  stopAudioRef.current = handleStopAudio;

  useEffect(() => {
    const unregisterAudio = globalAudioCoordinator.register('library', () => stopAudioRef.current());
    const unsubscribePrefs = subscribeAudioPreferences(prefs => {
      setActiveReciter(prev => {
        if (prev !== prefs.preferredReciter) {
          stopAudioRef.current();
          return prefs.preferredReciter;
        }
        return prev;
      });
      setPlaybackRate(prefs.playbackRate);
      if (audioRef.current) audioRef.current.playbackRate = prefs.playbackRate;
      segmentQueueRef.current?.setPlaybackRate(prefs.playbackRate);
      setRepeatTarget(prefs.repeatCount);
      repeatTargetRef.current = prefs.repeatCount === -1 ? null : prefs.repeatCount;
      segmentQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(prefs.repeatCount));
      setSegmentRepeatCount(prefs.segmentRepeatCount);
      segmentQueueRef.current?.setRepeatCount(prefs.segmentRepeatCount === -1 ? null : prefs.segmentRepeatCount);
    });
    return () => {
      unregisterAudio();
      unsubscribePrefs();
    };
  }, []);

  const handleToggleStudySegmentAudio = async () => {
    const activeQueue = segmentQueueRef.current;
    if (activeQueue?.getState().active) {
      if (activeQueue.getState().paused) {
        globalAudioCoordinator.claimFocus('library');
        activeQueue.resume();
        setIsSegmentPaused(false);
        setIsSegmentPlaying(true);
      } else {
        activeQueue.pause();
        globalAudioCoordinator.releaseFocus('library');
      }
      return;
    }
    if (!currentAyahs.length || segmentStartIndex > segmentEndIndex) return;

    handleStopAudio();
    globalAudioCoordinator.claimFocus('library');
    const requestSeq = ++playbackRequestSeqRef.current;
    const resolvedTracks = await Promise.all(currentAyahs.map(async ayah => {
      const descriptor = getLicensedAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter);
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
    requestOfflineAudioCache(
      tracks.slice(segmentStartIndex, Math.min(segmentEndIndex + 1, segmentStartIndex + 20)).map(track => track.url)
    );

    const controller = new QuranAudioQueueController({
      onTrackChange: (index, cycle, ayahIteration) => {
        const ayahNum = currentAyahs[index]?.numberInSurah ?? 1;
        setPlayingAyah(ayahNum);
        setCurrentRepeatCount(ayahIteration);
        setSegmentStatus({ ayahNumber: ayahNum, cycle, ayahIteration });
      },
      onPlaying: () => {
        setIsSegmentPlaying(true);
        setIsSegmentPaused(false);
        setIsPlaying(true);
      },
      onPaused: () => {
        setIsSegmentPlaying(false);
        setIsSegmentPaused(true);
        setIsPlaying(false);
      },
      onComplete: () => {
        if (segmentQueueRef.current !== controller) return;
        segmentQueueRef.current = null;
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsPlaying(false);
        setPlayingAyah(null);
        setSegmentStatus(null);
        setCurrentRepeatCount(1);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('library');
      },
      onError: error => {
        console.warn('[WIRD Study] Segment audio queue failed:', error);
        if (segmentQueueRef.current !== controller) return;
        segmentQueueRef.current = null;
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsPlaying(false);
        setPlayingAyah(null);
        setSegmentStatus(null);
        setCurrentRepeatCount(1);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('library');
      }
    });
    segmentQueueRef.current = controller;
    try {
      controller.start({
        tracks,
        startIndex: segmentStartIndex,
        endIndex: segmentEndIndex,
        ayahRepeatCount: normalizeAyahSegmentRepeatCount(repeatTarget),
        repeatCount: segmentRepeatCount === -1 ? null : segmentRepeatCount,
        playbackRate: getSavedPlaybackRate()
      });
      setIsSegmentPlaying(true);
      setIsSegmentPaused(false);
      setIsPlaying(true);
    } catch (error) {
      controller.stop();
      segmentQueueRef.current = null;
      setIsSegmentPlaying(false);
      setIsSegmentPaused(false);
      setIsPlaying(false);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('library');
      console.warn('[WIRD Study] Could not start segment audio:', error);
    }
  };

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      segmentQueueRef.current?.stop();
      segmentQueueRef.current = null;
      playbackRequestSeqRef.current += 1;
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('library');
    };
  }, []);

  const handleOpenStudy = (surah: SurahMeta) => {
    handleStopAudio();
    setSelectedSurah(surah);
    setActiveTab('study');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenMushafPage = (pageNumber: number) => {
    handleStopAudio();
    setMushafInitialPage(pageNumber);
    setShowMushafReader(true);
  };

  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const handleCopyAyah = async (ayah: Ayah) => {
    const displayText = await getAyahDisplayText(ayah);
    const text = `﴿ ${displayText} ﴾ [سورة ${selectedSurah.name}: ${ayah.numberInSurah}]`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      setCopiedAyahNumber(ayah.numberInSurah);
      copyTimerRef.current = window.setTimeout(() => {
        setCopiedAyahNumber(null);
        copyTimerRef.current = null;
      }, 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  if (showMushafReader) {
    return (
      <QuranMushafReader
        preferredReciter={activeReciter}
        initialPage={mushafInitialPage}
        onBack={() => setShowMushafReader(false)}
        readingKhatma={readingKhatma}
        readingKhatmaError={readingKhatmaError}
        onMarkPageRead={page => { try { setReadingKhatma(markReadingPage(page)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تسجيل الصفحة.'); } }}
      />
    );
  }

  const activeReciterName = RECITERS.find(r => r.id === activeReciter)?.name || 'مشاري العفاسي';
  const studySpacingClass =
    displayPreferences.spacing === 'compact'
      ? 'space-y-2.5'
      : displayPreferences.spacing === 'relaxed'
      ? 'space-y-6'
      : 'space-y-4';
  const studyCardPaddingClass =
    displayPreferences.spacing === 'compact'
      ? 'p-4 md:p-5'
      : displayPreferences.spacing === 'relaxed'
      ? 'p-7 md:p-10'
      : 'p-6 md:p-8';
  const studyLineHeight =
    displayPreferences.spacing === 'compact'
      ? 2.25
      : displayPreferences.spacing === 'relaxed'
      ? 3.05
      : 2.65;

  return (
    <div
      className={`space-y-8 ${READING_PAGE_WIDTH_CLASSES[displayPreferences.pageWidth]} mx-auto pb-24 transition-all`}
    >
      {lastReadingPosition && (
        <button type="button" onClick={handleResumeReading} className="min-h-11 rounded-xl border border-[#C59B27]/40 dark:border-[#E0A96D]/35 bg-[#F2EDE2] dark:bg-[#111F36] px-4 py-2 text-sm font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:border-[#C59B27] transition-colors">
          متابعة آخر موضع قراءة · سورة {ALL_SURAHS[lastReadingPosition.surahNumber - 1]?.name} · الآية {lastReadingPosition.ayahNumber}
        </button>
      )}
      <ReadingKhatmaPanel
        khatma={readingKhatma}
        error={readingKhatmaError}
        onStart={plan => { try { setReadingKhatma(startReadingKhatma(localStorage, new Date(), plan)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر بدء الختمة.'); } }}
        onReset={() => { try { clearReadingKhatma(); setReadingKhatma(null); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إعادة ضبط الختمة.'); } }}
        onPause={() => { try { setReadingKhatma(pauseReadingKhatma()); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إيقاف الختمة مؤقتاً.'); } }}
        onResume={() => { try { setReadingKhatma(resumeReadingKhatma()); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر استئناف الختمة.'); } }}
        onUpdatePlan={plan => { try { setReadingKhatma(updateReadingKhatmaPlan(plan)); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تحديث خطة الختمة.'); } }}
        onContinue={page => handleOpenMushafPage(page)}
      />
      {/* 1. Hero Quran Header Banner */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B132B] via-[#1C4E46] to-[#111F36] text-white p-7 md:p-10 shadow-xl border border-[#C59B27]/35">
        <WirdIslamicPattern opacity={0.06} className="text-white" />
        <div className="absolute top-0 left-0 w-80 h-80 bg-radial from-[#E0A96D]/20 via-transparent to-transparent rounded-full -translate-x-20 -translate-y-20 pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl text-right">
            <p className="text-xs font-semibold text-[#E0A96D] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-[#C59B27] shrink-0" />
              <span>قراءة القرآن الكريم · برواية حفص عن عاصم</span>
            </p>
            <h1 className="text-3xl md:text-5xl font-black font-quran text-[#F9F6EE] tracking-wide leading-tight">
              القرآن الكريم
            </h1>
            <p className="text-[#F5F1E8]/85 text-sm md:text-base leading-relaxed font-sans-ui">
              تصفّح سور القرآن الكريم الـ 114 كاملة مع الاستماع المباشر لكبار القرّاء، وعرض التفسير المعتمد من منصة Quran.com، والقراءة بصفحات المصحف الشريف.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
              className="min-h-12 inline-flex items-center gap-2 px-5 py-3 rounded-2xl wird-btn-accent text-sm font-bold shadow-lg"
            >
              <BookOpen className="w-4 h-4 fill-[#0B132B]" />
              <span>فتح المصحف بالصفحات (604)</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-8 max-w-3xl mx-auto relative">
          <Search className="w-5 h-5 text-[#5B6F6B] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن أي سورة، رقمها، أو جزء (مثال: الملك، 67، البقرة، جزء عم)..."
            className="w-full min-h-12 pl-10 pr-12 py-3.5 bg-[#F9F6EE] dark:bg-[#111F36]/95 text-[#142421] dark:text-[#F5F1E8] rounded-2xl text-sm md:text-base shadow-xl border border-[#C59B27]/30 focus:outline-none focus:ring-2 focus:ring-[#E0A96D] transition-all placeholder:text-[#5B6F6B] dark:placeholder:text-[#8B9E9B]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="مسح البحث"
              className="min-h-10 min-w-10 flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 text-[#5B6F6B] hover:text-[#142421] dark:hover:text-[#F5F1E8]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      {/* 2. Top Segmented Navigation Tabs + Direct Reciter Rail + Speed */}
      <div className="space-y-3 border-b border-[#1C4E46]/12 dark:border-[#E0A96D]/15 pb-3">
        <HorizontalScrollRail ariaLabel="أقسام تصفح القرآن" activeKey={activeTab}>
          <button
            type="button"
            onClick={() => setActiveTab('surahs')}
            aria-pressed={activeTab === 'surahs'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'surahs'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
            }`}
          >
            السور ({filteredSurahs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('juz')}
            aria-pressed={activeTab === 'juz'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
              activeTab === 'juz'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
            }`}
          >
            الأجزاء (30 جزء)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            aria-pressed={activeTab === 'study'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
              activeTab === 'study'
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">تلاوة ودراسة: سورة {selectedSurah.name}</span>
          </button>
        </HorizontalScrollRail>

        {/* Global Controls: Direct Reciter Buttons + Audio Speed */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 font-bold text-[#1C4E46] dark:text-[#E0A96D] shrink-0">
              <Volume2 className="w-4 h-4" />
              <span>القارئ:</span>
            </span>
            <HorizontalScrollRail ariaLabel="اختيار القارئ" activeKey={activeReciter}>
              {RECITERS.map(r => {
                const isReciterActive = activeReciter === r.id;
                const shortName = r.name.replace('الشيخ ', '').replace(' (مرتل)', '');
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={isReciterActive}
                    onClick={() => {
                      handleStopAudio();
                      savePreferredReciter(r.id);
                      setActiveReciter(r.id);
                    }}
                    className={`min-h-11 shrink-0 snap-start px-3 py-1.5 rounded-xl border text-xs font-bold transition-all whitespace-nowrap ${
                      isReciterActive
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-xs'
                        : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                    }`}
                  >
                    {shortName}
                  </button>
                );
              })}
            </HorizontalScrollRail>
          </div>

          <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
        </div>

        <ReadingDisplaySettingsMenu
          viewLabel="القرآن والتلاوة"
          preferences={displayPreferences}
          onUpdate={updateDisplayPreferences}
          onReset={resetDisplayPreferences}
          fontLabel="حجم خط الآيات"
        />
      </div>

      {/* Scaled Reading Stage (settings menu & fixed audio bar stay crisp at 100%) */}
      <div className="space-y-8" style={{ zoom: displayPreferences.uiScale / 100 }}>

      {/* 3. TAB 1: SURAHS DIRECTORY GRID (Like Quran.com Home) */}
      {activeTab === 'surahs' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Revelation Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#5B6F6B] dark:text-[#8B9E9B] font-semibold">تصنيف النزول:</span>
              <div className="inline-flex p-1 bg-[#F2EDE2] dark:bg-[#0E1A2F] rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                <button
                  type="button"
                  onClick={() => setRevelationFilter('all')}
                  className={`min-h-10 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                    revelationFilter === 'all'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                      : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setRevelationFilter('مكية')}
                  className={`min-h-10 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                    revelationFilter === 'مكية'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                      : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                  }`}
                >
                  مكية
                </button>
                <button
                  type="button"
                  onClick={() => setRevelationFilter('مدنية')}
                  className={`min-h-10 px-3.5 py-1.5 rounded-lg font-bold transition-colors ${
                    revelationFilter === 'مدنية'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-2xs'
                      : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                  }`}
                >
                  مدنية
                </button>
              </div>
            </div>

            <div className="text-[#5B6F6B] dark:text-[#8B9E9B] text-xs tabular-nums font-medium">
              عرض {filteredSurahs.length} من أصل 114 سورة
            </div>
          </div>

          {/* 3-Column Responsive Surahs Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSurahs.map((surah) => {
              const isSelected = selectedSurah.number === surah.number;
              return (
                <article
                  key={surah.number}
                  className={`wird-card group relative p-4 rounded-2xl border transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[#C59B27] dark:border-[#E0A96D] shadow-sm ring-1 ring-[#C59B27]/40'
                      : 'hover:border-[#C59B27]/60 dark:hover:border-[#E0A96D]/50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono tabular-nums font-bold text-xs transition-colors ${
                        isSelected
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-[#E0A96D] border-[#C59B27]'
                          : 'bg-[#F2EDE2] dark:bg-[#162744] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-[#1C4E46] dark:text-[#E0A96D] group-hover:bg-[#1C4E46] group-hover:text-white'
                      }`}>
                        {surah.number}
                      </div>

                      <div className="text-right">
                        <h3 className="font-quran text-xl font-bold">
                          <button
                            type="button"
                            onClick={() => handleOpenStudy(surah)}
                            aria-label={`فتح سورة ${surah.name} للدراسة`}
                            aria-pressed={isSelected}
                            className="text-right text-[#142421] dark:text-[#F5F1E8] hover:text-[#1C4E46] dark:hover:text-[#E0A96D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] rounded-md transition-colors"
                          >
                            سورة {surah.name}
                          </button>
                        </h3>
                        <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-sans tracking-wide">
                          {surah.englishName}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                      {surah.revelationType}
                    </span>
                  </div>

                  {/* Unboxed Metadata & Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                    <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                      <span>{surah.versesCount} آيات</span>
                      <span aria-hidden="true">·</span>
                      <span>صفحة {surah.pageStart}</span>
                      <span aria-hidden="true">·</span>
                      <span>الجزء {surah.juzStart}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenMushafPage(surah.pageStart);
                        }}
                        title="قراءة في المصحف"
                        aria-label={`قراءة سورة ${surah.name} في المصحف`}
                        className="min-h-10 min-w-10 flex items-center justify-center rounded-lg hover:bg-[#1C4E46]/10 dark:hover:bg-[#1E4A47] text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#1C4E46] dark:hover:text-[#E0A96D] transition-colors"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          onStartSession(surah.number, 1, surah.versesCount);
                        }}
                        title="بدء حفظ السورة"
                        aria-label={`بدء جلسة حفظ لسورة ${surah.name}`}
                        className="min-h-10 min-w-10 flex items-center justify-center rounded-lg hover:bg-[#C59B27]/15 dark:hover:bg-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#C59B27] dark:hover:text-[#E0A96D] transition-colors"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          {filteredSurahs.length === 0 && (
            <div className="wird-card text-center py-16 rounded-3xl text-[#5B6F6B] dark:text-[#8B9E9B] text-sm">
              لم يتم العثور على سور مطابقة لكلمة البحث. جرّب البحث برقم السورة أو كتابة اسم آخر.
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: JUZ DIRECTORY GRID (30 Juz) */}
      {activeTab === 'juz' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 30 }, (_, index) => index + 1).map((juzNumber) => {
              const point = JUZ_INDEX[String(juzNumber)];
              const startSurah = point ? ALL_SURAHS.find(s => s.number === point.surahNumber) : undefined;
              const juzName = JUZ_NAMES[juzNumber - 1] || `الجزء ${juzNumber}`;

              return (
                <div
                  key={juzNumber}
                  className="wird-card p-5 rounded-2xl hover:border-[#C59B27] dark:hover:border-[#E0A96D] hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 border border-[#C59B27]/40 dark:border-[#E0A96D]/30 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center font-bold font-mono tabular-nums text-sm">
                        {juzNumber}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[#142421] dark:text-[#F5F1E8]">
                          {juzName}
                        </h3>
                        <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                          يبدأ من: سورة {startSurah?.name || '—'} (الآية {point?.ayahNumber || 1})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between text-xs">
                    <span className="text-[#5B6F6B] dark:text-[#8B9E9B] text-[11px] tabular-nums">
                      صفحة {point?.page || Math.ceil((juzNumber - 1) * 20 + 2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenMushafPage(point?.page || 1)}
                      className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1C4E46]/10 dark:bg-[#1E4A47] text-[#1C4E46] dark:text-[#F5F1E8] hover:bg-[#1C4E46] hover:text-white font-bold transition-colors"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>قراءة الجزء</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. TAB 3: VERSE-BY-VERSE STUDY & RECITATION VIEW */}
      {activeTab === 'study' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Surah Header Card with Calligraphy and Metadata */}
          <div className="rounded-3xl border border-[#C59B27]/40 dark:border-[#E0A96D]/30 bg-gradient-to-br from-[#F9F6EE] to-[#F2EDE2] dark:from-[#111F36] dark:to-[#0B132B] p-6 md:p-8 text-center relative overflow-hidden shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-semibold border-b border-[#C59B27]/25 dark:border-[#E0A96D]/20 pb-3 mb-4">
              <span>الجزء {selectedSurah.juzStart} {selectedSurah.juzEnd !== selectedSurah.juzStart && `إلى ${selectedSurah.juzEnd}`}</span>
              <span className="font-quran text-lg text-[#1C4E46] dark:text-[#E0A96D] font-bold">
                سورة {selectedSurah.name} ({selectedSurah.englishName})
              </span>
              <span className="tabular-nums">{selectedSurah.revelationType} · صفحة {selectedSurah.pageStart}</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black font-quran text-[#1C4E46] dark:text-[#F9F6EE] my-2">
              سُورَةُ {selectedSurah.name}
            </h2>

            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1 tabular-nums">
              عدد آياتها: <strong className="font-mono text-[#142421] dark:text-[#E0A96D]">{selectedSurah.versesCount}</strong> آية
            </p>

            {/* Sacred Basmalah */}
            {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
              <p className="font-quran text-2xl md:text-3xl text-[#1C4E46] dark:text-[#E0A96D] py-4 mt-2">
                <QuranBasmala surahNumber={selectedSurah.number} />
              </p>
            )}

            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-[#C59B27]/25 dark:border-[#E0A96D]/20">
              <button
                type="button"
                onClick={() => handlePlayAyah(1)}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] dark:hover:bg-[#163A37] text-white font-bold text-xs transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-white" />
                <span>استماع للسورة من البداية</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 font-bold text-xs transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#1C4E46] dark:text-[#E0A96D]" />
                <span>فتح صفحة {selectedSurah.pageStart} في المصحف</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white/80 dark:bg-[#0B132B]/70 px-2.5 py-1.5 text-xs">
                <label className="inline-flex items-center gap-1.5 font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                  <span>من</span>
                  <select
                    aria-label="بداية نطاق الحفظ من الآية"
                    value={sessionRangeStart}
                    onChange={event => {
                      const nextStart = Number(event.target.value);
                      setSessionRangeStart(nextStart);
                      if (sessionRangeEnd < nextStart) setSessionRangeEnd(nextStart);
                    }}
                    className="min-h-9 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#111F36] px-2 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums"
                  >
                    {Array.from({ length: selectedSurah.versesCount }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-1.5 font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                  <span>إلى</span>
                  <select
                    aria-label="نهاية نطاق الحفظ إلى الآية"
                    value={sessionRangeEnd}
                    onChange={event => setSessionRangeEnd(Number(event.target.value))}
                    className="min-h-9 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#111F36] px-2 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums"
                  >
                    {Array.from(
                      { length: selectedSurah.versesCount - sessionRangeStart + 1 },
                      (_, i) => sessionRangeStart + i
                    ).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </label>

                <button
                  type="button"
                  onClick={() => onStartSession(selectedSurah.number, sessionRangeStart, sessionRangeEnd)}
                  className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-xl wird-btn-accent text-xs font-bold shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {sessionRangeStart === 1 && sessionRangeEnd === selectedSurah.versesCount
                      ? 'بدء حفظ السورة كاملة'
                      : `بدء حفظ (${sessionRangeStart}–${sessionRangeEnd})`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Verses Container */}
          {isLoadingSurah && (
            <div className="py-24 text-center text-[#1C4E46] dark:text-[#E0A96D] space-y-2">
              <div className="w-8 h-8 border-3 border-[#C59B27] border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-sm font-semibold">جارٍ تحميل آيات سورة {selectedSurah.name}...</p>
            </div>
          )}

          {!isLoadingSurah && surahLoadError && (
            <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/40 border border-rose-200 rounded-3xl space-y-3">
              <p className="text-sm font-bold text-rose-800 dark:text-rose-300">تعذر تحميل نص السورة حالياً.</p>
              <button
                type="button"
                onClick={() => setLoadRetry(v => v + 1)}
                className="px-4 py-2 rounded-xl bg-rose-700 text-white text-xs font-bold"
              >
                إعادة المحاولة
              </button>
            </div>
          )}

          {!isLoadingSurah && !surahLoadError && currentAyahs.length > 0 && (
            <div className="space-y-4">
              <div className="wird-card space-y-3 rounded-2xl p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">طريقة عرض الآيات</p>
                  <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label="طريقة عرض آيات السورة" className="inline-flex rounded-xl bg-[#F2EDE2] p-1 dark:bg-[#0E1A2F]">
                    <button type="button" aria-pressed={studyLayout === 'ayah-cards'} onClick={() => setStudyLayout('ayah-cards')} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${studyLayout === 'ayah-cards' ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      آية آية
                    </button>
                    <button type="button" aria-pressed={studyLayout === 'continuous'} onClick={() => setStudyLayout('continuous')} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${studyLayout === 'continuous' ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      قراءة متصلة
                    </button>
                  </div>
                  <button type="button" aria-expanded={showTypographyLab} onClick={() => setShowTypographyLab(value => !value)} className="min-h-11 rounded-xl border border-[#1C4E46]/30 dark:border-[#E0A96D]/30 px-3 text-sm font-bold text-[#1C4E46] dark:text-[#E0A96D] hover:bg-[#F2EDE2] dark:hover:bg-[#162744] transition-colors">
                    {showTypographyLab ? 'إخفاء مختبر الخطوط' : 'مختبر الخطوط'}
                  </button>
                  </div>
                </div>

                {/* Study Segment Audio Range + Dual Loop Repetition */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-xs">
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE]/70 dark:bg-[#0E1A2F] px-2.5 py-1" dir="rtl">
                    <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">المقطع الصوتي</span>
                    <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
                      <span className="font-bold">من</span>
                      <select
                        aria-label="بداية المقطع الصوتي في الدراسة"
                        value={segmentStartIndex}
                        onChange={event => {
                          const next = Number(event.target.value);
                          setSegmentStartIndex(next);
                          if (segmentEndIndex < next) setSegmentEndIndex(next);
                        }}
                        className="min-h-11 min-w-24 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
                      >
                        {currentAyahs.map((ayah, index) => (
                          <option key={ayah.number} value={index}>{formatAyahRangeOptionLabel(ayah.numberInSurah)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
                      <span className="font-bold">إلى</span>
                      <select
                        aria-label="نهاية المقطع الصوتي في الدراسة"
                        value={segmentEndIndex}
                        onChange={event => setSegmentEndIndex(Number(event.target.value))}
                        className="min-h-11 min-w-24 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
                      >
                        {currentAyahs.slice(segmentStartIndex).map((ayah, offset) => (
                          <option key={ayah.number} value={segmentStartIndex + offset}>{formatAyahRangeOptionLabel(ayah.numberInSurah)}</option>
                        ))}
                      </select>
                    </label>
                    {currentAyahs[segmentStartIndex] && currentAyahs[segmentEndIndex] && (
                      <span className="text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                        من آية {currentAyahs[segmentStartIndex].numberInSurah} إلى آية {currentAyahs[segmentEndIndex].numberInSurah}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
                      <span className="font-semibold">تكرار كل آية</span>
                      <select
                        aria-label="عدد مرات تكرار الآية في الدراسة"
                        value={normalizeAyahSegmentRepeatCount(repeatTarget)}
                        onChange={event => handleRepeatTargetChange(Number(event.target.value) as AudioRepeatCount)}
                        className="min-h-11 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
                      >
                        <option value={1}>مرة واحدة</option>
                        <option value={2}>مرتان</option>
                        <option value={3}>3 مرات</option>
                        <option value={5}>5 مرات</option>
                        <option value={10}>10 مرات</option>
                      </select>
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B]">
                      <span className="font-semibold">تكرار المقطع</span>
                      <select
                        aria-label="عدد مرات تكرار المقطع في الدراسة"
                        value={segmentRepeatCount}
                        onChange={event => handleSegmentRepeatCountChange(Number(event.target.value) as AudioRepeatCount)}
                        className="min-h-11 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] px-2.5 text-xs font-semibold"
                      >
                        <option value={1}>مرة واحدة</option>
                        <option value={2}>مرتان</option>
                        <option value={3}>3 مرات</option>
                        <option value={5}>5 مرات</option>
                        <option value={10}>10 مرات</option>
                        <option value={-1}>مستمر</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={handleToggleStudySegmentAudio}
                      className={`min-h-11 inline-flex items-center gap-1.5 rounded-xl px-4 text-xs font-bold transition-colors ${
                        isSegmentPlaying ? 'bg-[#C59B27] text-[#0B132B]' : 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white hover:bg-[#143D36]'
                      }`}
                    >
                      {isSegmentPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isSegmentPlaying ? 'إيقاف مؤقت للمقطع' : isSegmentPaused ? 'استئناف المقطع' : 'تشغيل المقطع المحدد'}</span>
                    </button>
                  </div>
                </div>

                {segmentStatus && (
                  <p aria-live="polite" className="text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums">
                    جاري التلاوة: آية {segmentStatus.ayahNumber} · تكرار الآية {segmentStatus.ayahIteration}/{normalizeAyahSegmentRepeatCount(repeatTarget)} · دورة المقطع {segmentStatus.cycle}{segmentRepeatCount === -1 ? ' (مستمر)' : `/${segmentRepeatCount}`}
                  </p>
                )}
              </div>

              {showTypographyLab && <QuranTypographyLab onClose={() => setShowTypographyLab(false)} />}

              {studyLayout === 'continuous' ? (
                <div aria-label={`قراءة متصلة لسورة ${selectedSurah.name}`} className={`rounded-3xl border border-[#C59B27]/30 bg-[#F9F6EE] ${studyCardPaddingClass} text-right shadow-xs dark:border-[#E0A96D]/25 dark:bg-[#111F36]`}>
                  <p
                    className="quran-text font-quran text-[#142421] dark:text-[#F5F1E8]"
                    style={{ fontSize: `${displayPreferences.fontSize}px`, lineHeight: studyLineHeight }}
                  >
                    {currentAyahs.map(ayah => {
                      const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;
                      return (
                        <React.Fragment key={ayah.number}>
                          <button
                            id={`continuous-ayah-${ayah.numberInSurah}`}
                            type="button"
                            onClick={() => { rememberReadingPosition(ayah.numberInSurah); setTafsirAyah(ayah); }}
                            aria-label={`تفسير سورة ${selectedSurah.name}، الآية ${ayah.numberInSurah}`}
                            className={`inline rounded-lg px-1 text-right align-baseline transition-colors ${isThisPlaying ? 'bg-[#C59B27]/25 dark:bg-[#E0A96D]/25' : 'hover:bg-[#C59B27]/15 dark:hover:bg-[#E0A96D]/15'}`}
                          >
                            <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>
                            <span className="ayah-number" aria-label={`الآية ${ayah.numberInSurah}`}>{ayah.numberInSurah}</span>
                          </button>{' '}
                          <button
                            type="button"
                            onClick={() => handlePlayAyah(ayah.numberInSurah)}
                            aria-label={`${isThisPlaying ? 'إيقاف' : 'استماع'} الآية ${ayah.numberInSurah} من سورة ${selectedSurah.name}`}
                            className={`mx-1 inline-flex min-h-11 min-w-11 translate-y-1 items-center justify-center rounded-full align-baseline ${isThisPlaying ? 'bg-[#C59B27] text-[#0B132B]' : 'bg-[#1C4E46]/10 text-[#1C4E46] dark:bg-[#1E4A47] dark:text-[#E0A96D]'}`}
                          >
                            {isThisPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>{' '}
                        </React.Fragment>
                      );
                    })}
                  </p>
                  <p className="mt-4 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">اضغط نص الآية لفتح تفسيرها، أو زر الاستماع لبدء التلاوة منها.</p>
                  {(() => {
                    const activeAyahNumber = playingAyah ?? (lastReadingPosition?.surahNumber === selectedSurah.number ? lastReadingPosition.ayahNumber : 1);
                    const activeAyah = currentAyahs.find(ayah => ayah.numberInSurah === activeAyahNumber) || currentAyahs[0];
                    return activeAyah ? (
                      <div className="mt-4">
                        <AyahNavigationControls currentAyah={activeAyah} onNavigate={handleNavigateToAyah} />
                      </div>
                    ) : null;
                  })()}
                </div>
              ) : (
            <div className={studySpacingClass}>
              {currentAyahs.map((ayah) => {
                const isThisPlaying = playingAyah === ayah.numberInSurah && isPlaying;
                const isCopied = copiedAyahNumber === ayah.numberInSurah;

                return (
                  <article
                    key={ayah.numberInSurah}
                    id={`study-ayah-${ayah.numberInSurah}`}
                    className={`wird-card ${studyCardPaddingClass} rounded-3xl transition-all ${
                      isThisPlaying
                        ? 'border-[#C59B27] dark:border-[#E0A96D] shadow-md ring-2 ring-[#C59B27]/40'
                        : 'hover:border-[#C59B27]/60 dark:hover:border-[#E0A96D]/45'
                    }`}
                  >
                    {/* Top Verse Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-xs bg-[#F2EDE2] dark:bg-[#0E1A2F] text-[#1C4E46] dark:text-[#E0A96D] px-2.5 py-1 rounded-lg border border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                          الآية {ayah.numberInSurah}
                        </span>

                        <span className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] hidden sm:inline tabular-nums">
                          صفحة {ayah.page} · جزء {ayah.juz}
                        </span>

                        {ayah.sajda && (
                          <span className="text-[11px] text-[#C59B27] dark:text-[#E0A96D] font-bold">
                            · موضع سجدة
                          </span>
                        )}
                      </div>

                      {/* Action Icons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handlePlayAyah(ayah.numberInSurah)}
                          aria-label={isThisPlaying ? 'إيقاف تلاوة الآية' : 'استماع لتلاوة الآية'}
                          title={isThisPlaying ? 'إيقاف مؤقت' : 'استمع لتلاوة الآية'}
                          className={`min-h-10 min-w-10 flex items-center justify-center rounded-xl transition-colors ${
                            isThisPlaying
                              ? 'bg-[#C59B27] text-[#0B132B]'
                              : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] hover:bg-[#1C4E46] hover:text-white'
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => { rememberReadingPosition(ayah.numberInSurah); setTafsirAyah(ayah); }}
                          title="عرض التفسير المعتمد (Quran.com v4)"
                          aria-label={`تفسير الآية ${ayah.numberInSurah}`}
                          className="min-h-10 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#1C4E46]/10 dark:bg-[#1E4A47] text-[#1C4E46] dark:text-[#F5F1E8] hover:bg-[#1C4E46] hover:text-white transition-colors font-bold text-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>التفسير</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyAyah(ayah)}
                          title="نسخ نص الآية الكريمة"
                          aria-label={`نسخ الآية ${ayah.numberInSurah}`}
                          className="min-h-10 min-w-10 flex items-center justify-center rounded-xl bg-[#F2EDE2] dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8] transition-colors"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onStartSession(selectedSurah.number, ayah.numberInSurah, ayah.numberInSurah)}
                          title="تدريب وحفظ هذه الآية"
                          className="min-h-10 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#8A6914] dark:text-[#E0A96D] hover:bg-[#C59B27]/25 transition-colors font-bold text-xs border border-[#C59B27]/30"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                          <span className="hidden sm:inline">تدريب وحفظ</span>
                        </button>
                      </div>
                    </div>

                    {/* Canonical Ayah Text */}
                    <div className="py-2 text-right">
                      <p
                        className="font-quran text-[#142421] dark:text-[#F5F1E8] selection:bg-[#C59B27]/30"
                        style={{ fontSize: `${displayPreferences.fontSize}px`, lineHeight: studyLineHeight }}
                      >
                        <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' '}
                        <span className="ayah-number" title={`الآية ${ayah.numberInSurah}`}>
                          {ayah.numberInSurah}
                        </span>
                      </p>
                    </div>
                    <div className="mt-3 border-t border-[#1C4E46]/10 pt-3 dark:border-[#E0A96D]/15">
                      <AyahNavigationControls currentAyah={ayah} compact onNavigate={handleNavigateToAyah} />
                    </div>
                  </article>
                );
              })}
            </div>
              )}
            </div>
          )}
        </div>
      )}
      </div>

      {/* 6. Sticky Bottom Audio Player Bar */}
      {(isPlaying || isSegmentPaused || playingAyah !== null) && (
        <aside
          role="region"
          aria-label="مشغل التلاوة الصوتي"
          className="fixed bottom-0 left-0 right-0 z-50 bg-[#F9F6EE]/95 dark:bg-[#0B132B]/95 backdrop-blur-md border-t border-[#C59B27]/35 dark:border-[#E0A96D]/25 shadow-2xl px-4 py-3 transition-transform animate-in slide-in-from-bottom duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Playing Context */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[#1C4E46] text-[#E0A96D] flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                <Volume2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-right">
                <h4 className="font-bold text-[#142421] dark:text-[#F5F1E8] text-sm truncate font-quran">
                  سورة {selectedSurah.name} · الآية {playingAyah || 1}
                </h4>
                <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] truncate tabular-nums">
                  القارئ: {activeReciterName}
                  {segmentStatus
                    ? ` · الآية ${segmentStatus.ayahIteration}/${normalizeAyahSegmentRepeatCount(repeatTarget)} · المقطع ${segmentStatus.cycle}${segmentRepeatCount === -1 ? ' (مستمر)' : `/${segmentRepeatCount}`}`
                    : repeatTarget === -1
                      ? ` · تكرار مستمر (${currentRepeatCount})`
                      : repeatTarget > 1
                        ? ` · التكرار: ${currentRepeatCount}/${repeatTarget}`
                        : ''}
                </p>
              </div>
            </div>

            {/* Playback Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handlePrevAyah}
                aria-label="الآية السابقة"
                title="الآية السابقة"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] dark:text-[#8B9E9B] hover:bg-[#F2EDE2] dark:hover:bg-[#162744] transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => (isSegmentPlaying || isSegmentPaused) ? handleToggleStudySegmentAudio() : (playingAyah && handlePlayAyah(playingAyah))}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'استئناف'}
                className="w-11 h-11 rounded-2xl bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white mr-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleNextAyah}
                aria-label="الآية التالية"
                title="الآية التالية"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[#5B6F6B] dark:text-[#8B9E9B] hover:bg-[#F2EDE2] dark:hover:bg-[#162744] transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Single Repeat Selector Dropdown */}
              <label className="inline-flex items-center gap-1.5 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="font-semibold">تكرار الآية</span>
                <select
                  aria-label="مرات تكرار الآية للحفظ"
                  value={repeatTarget}
                  onChange={event => handleRepeatTargetChange(Number(event.target.value) as AudioRepeatCount)}
                  className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-2.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8]"
                >
                  <option value={1}>مرة</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                  <option value={5}>5</option>
                  <option value={10}>10</option>
                  <option value={-1}>مستمر</option>
                </select>
              </label>
            </div>

            {/* Close / Stop */}
            <div className="flex items-center gap-2">
              <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
              <button
                type="button"
                onClick={handleStopAudio}
                aria-label="إغلاق المشغل"
                title="إيقاف وإغلاق المشغل"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-[#F2EDE2] dark:hover:bg-[#162744] text-[#5B6F6B] hover:text-[#142421] dark:hover:text-[#F5F1E8] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 7. Verification & Integrity Footer */}
      <footer className="wird-card rounded-3xl p-6 text-xs text-[#5B6F6B] dark:text-[#8B9E9B] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#1C4E46]/10 dark:bg-[#1E4A47]/60 flex items-center justify-center shrink-0 border border-[#C59B27]/30">
            <CheckCircle2 className="w-5 h-5 text-[#1C4E46] dark:text-[#E0A96D]" />
          </div>
          <div>
            <div className="font-bold text-[#142421] dark:text-[#F5F1E8] flex flex-wrap items-center gap-2">
              <span>قاعدة البيانات القرآنية الموثقة — 114 سورة كاملة (6,236 آية)</span>
              <span className="text-[11px] font-mono text-[#1C4E46] dark:text-[#E0A96D]">
                · Hafs 'an Asim
              </span>
            </div>
            <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] mt-0.5">
              النص المرجعي العثماني محفوظ دون تغيير، والعرض الافتراضي يستخدم نص Tanzil الرسمي بالرسم الإملائي Simple 1.1 كامل التشكيل.
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] space-y-0.5 shrink-0">
          <div className="text-[#142421] dark:text-[#F5F1E8]">
            المصدر: <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1C4E46] dark:text-[#E0A96D] underline underline-offset-2">{QURAN_DATA_SOURCE_INFO.provider}</a>
            <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">{QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayLicense}</div>
          </div>
          <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">
            التفسير معتمد عبر بوابة مطوري Quran.com API v4
          </div>
        </div>
      </footer>

      {/* Multi-Edition Tafsir Sheet */}
      <TafsirSheet
        ayah={tafsirAyah}
        onSelectAyah={nextAyah => {
          rememberReadingPosition(nextAyah.numberInSurah);
          setTafsirAyah(nextAyah);
        }}
        onClose={() => setTafsirAyah(null)}
      />
    </div>
  );
};
