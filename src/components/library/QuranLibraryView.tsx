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
import { AudioPlaybackRateControl } from '../shared/AudioPlaybackRateControl';
import { InlineAudioOfflineBadgeButton } from '../shared/InlineAudioOfflineBadgeButton';
import { QuranMushafReader } from './QuranMushafReader';
import { QURAN_JUZ_STARTS } from '../../data/quranNavigationIndex.generated';
import {
  clearReadingKhatma,
  createReadingKhatma,
  deleteReadingKhatmaById,
  getReadingKhatmaProgress,
  markReadingPage,
  markReadingPagesRange,
  markReadingUntilPage,
  pauseReadingKhatma,
  readAllReadingKhatmas,
  resumeReadingKhatma,
  setActiveReadingKhatma,
  startReadingKhatma,
  unmarkReadingPages,
  updateReadingKhatmaPlan,
  updateReadingKhatmaPosition
} from '../../services/readingKhatmaService';
import { ReadingKhatmaPanel } from './ReadingKhatmaPanel';
import { QuranText } from '../shared/QuranText';
import { QuranBasmala } from '../shared/QuranBasmala';
import { QuranTypographyLab } from './QuranTypographyLab';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { READING_PAGE_WIDTH_CLASSES, formatAyahRangeOptionLabel } from '../../services/readingDisplayPreferences';

interface QuranLibraryViewProps {
  onStartSession: (surahNumber: number, startAyah?: number, endAyah?: number) => void;
  preferredReciter: ReciterId;
  pendingMushafResume?: { page: number; khatmaId?: string; nonce: number } | null;
  onClearPendingMushafResume?: () => void;
}

type MainTab = 'surahs' | 'juz' | 'study';
type StudyLayout = 'ayah-cards' | 'continuous';
type QuranReadingPosition = { surahNumber: number; ayahNumber: number };

const JUZ_INDEX = QURAN_JUZ_STARTS as unknown as Record<string, { surahNumber: number; ayahNumber: number; page: number }>;
const LAST_READING_POSITION_KEY = 'wird.quran.lastReadingPosition.v1';

function readLastReadingPosition(): QuranReadingPosition | null {
  try {
    const value = JSON.parse(localStorage.getItem(StorageService.resolveScopedKey(LAST_READING_POSITION_KEY)) || 'null') as QuranReadingPosition | null;
    if (!value || !Number.isInteger(value.surahNumber) || !Number.isInteger(value.ayahNumber)) return null;
    const surah = ALL_SURAHS[value.surahNumber - 1];
    return surah && value.ayahNumber >= 1 && value.ayahNumber <= surah.versesCount ? value : null;
  } catch {
    return null;
  }
}

export const QuranLibraryView: React.FC<QuranLibraryViewProps> = ({
  onStartSession,
  preferredReciter: initialReciter,
  pendingMushafResume,
  onClearPendingMushafResume
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
  const [khatmaStore, setKhatmaStore] = useState(() => readAllReadingKhatmas());
  const readingKhatma = khatmaStore.activeKhatma;
  const refreshKhatmaStore = () => setKhatmaStore(readAllReadingKhatmas());
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
  const activeObjectUrlRevokersRef = useRef<Set<() => void>>(new Set());
  const revokeAllActiveAudioUrls = () => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* ignore */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  };
  const currentRepeatCountRef = useRef(1);
  const repeatTargetRef = useRef<number | null>(repeatTarget === -1 ? null : repeatTarget);
  const stopAudioRef = useRef<() => void>(() => {});

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
    try { localStorage.setItem(StorageService.resolveScopedKey(LAST_READING_POSITION_KEY), JSON.stringify(position)); } catch { /* Keep the current read usable when storage is unavailable. */ }
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

  // Audio playback uses refs for event-driven repeat state; React state is UI-only.
  const handlePlayAyah = (ayahNumberInSurah: number) => {
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
        });
      }
      return;
    }

    const fallbackUrl = formatAyahAudioUrl(selectedSurah.number, ayahNumberInSurah, activeReciter);
    requestOfflineAudioCache(
      currentAyahs.filter(ayah => ayah.numberInSurah >= ayahNumberInSurah).slice(0, 20)
        .map(ayah => getLicensedAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter).url)
    );
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
    setIsPlaying(true);

    const requestSeq = ++playbackRequestSeqRef.current;
    const approvedReciterId = resolveApprovedOfflineReciterId(activeReciter);
    const globalAyah = computeGlobalAyahNumber(selectedSurah.number, ayahNumberInSurah);

    void offlineQuranAudioLibrary.resolvePlaybackSource(approvedReciterId, globalAyah, fallbackUrl)
      .then(resolved => {
        if (requestSeq !== playbackRequestSeqRef.current) {
          resolved.revoke?.();
          return;
        }
        if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);

        const audio = new Audio(resolved.src);
        audio.playbackRate = getSavedPlaybackRate();
        audioRef.current = audio;

        attachAyahRepeatHandler(
          audio,
          currentRepeatCountRef,
          repeatTargetRef,
          setCurrentRepeatCount,
          () => {
            revokeAllActiveAudioUrls();
            const nextAyah = ayahNumberInSurah + 1;
            const hasNext = currentAyahs.some(a => a.numberInSurah === nextAyah);
            if (hasNext) {
              handlePlayAyah(nextAyah);
            } else {
              audioRef.current = null;
              setIsPlaying(false);
              setPlayingAyah(null);
            }
          },
          () => {
            audio.onended = null;
            audioRef.current = null;
            revokeAllActiveAudioUrls();
            currentRepeatCountRef.current = 1;
            setCurrentRepeatCount(1);
            setIsPlaying(false);
            setPlayingAyah(null);
          }
        );

        audio.onerror = () => {
          audio.onended = null;
          audioRef.current = null;
          revokeAllActiveAudioUrls();
          currentRepeatCountRef.current = 1;
          setCurrentRepeatCount(1);
          setIsPlaying(false);
          setPlayingAyah(null);
        };

        audio.play().catch(error => {
          console.warn('Audio play prevented or unavailable', error);
          audio.onended = null;
          audioRef.current = null;
          revokeAllActiveAudioUrls();
          currentRepeatCountRef.current = 1;
          setCurrentRepeatCount(1);
          setIsPlaying(false);
          setPlayingAyah(null);
        });
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
    segmentQueueRef.current?.stop();
    segmentQueueRef.current = null;
    revokeAllActiveAudioUrls();
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
    const approvedReciterId = resolveApprovedOfflineReciterId(activeReciter);
    requestOfflineAudioCache(
      currentAyahs.slice(segmentStartIndex, Math.min(segmentEndIndex + 1, segmentStartIndex + 20)).map(ayah =>
        getLicensedAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter).url
      )
    );

    const tracks = await Promise.all(
      currentAyahs.map(async ayah => {
        const fallbackUrl = formatAyahAudioUrl(selectedSurah.number, ayah.numberInSurah, activeReciter);
        const globalAyah = computeGlobalAyahNumber(selectedSurah.number, ayah.numberInSurah);
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
        revokeAllActiveAudioUrls();
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsPlaying(false);
        setPlayingAyah(null);
        setSegmentStatus(null);
        setCurrentRepeatCount(1);
        globalAudioCoordinator.releaseFocus('library');
      },
      onError: error => {
        console.warn('[WIRD Study] Segment audio queue failed:', error);
        if (segmentQueueRef.current !== controller) return;
        segmentQueueRef.current = null;
        revokeAllActiveAudioUrls();
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsPlaying(false);
        setPlayingAyah(null);
        setSegmentStatus(null);
        setCurrentRepeatCount(1);
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
      revokeAllActiveAudioUrls();
      setIsSegmentPlaying(false);
      setIsSegmentPaused(false);
      setIsPlaying(false);
      globalAudioCoordinator.releaseFocus('library');
      console.warn('[WIRD Study] Could not start segment audio:', error);
    }
  };

  useEffect(() => {
    return () => {
      playbackRequestSeqRef.current += 1;
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current = null;
      }
      segmentQueueRef.current?.stop();
      segmentQueueRef.current = null;
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

  useEffect(() => {
    if (!pendingMushafResume) return;
    if (pendingMushafResume.khatmaId) {
      try {
        setActiveReadingKhatma(pendingMushafResume.khatmaId);
        refreshKhatmaStore();
      } catch {
        // Continue opening the requested Mushaf page.
      }
    }
    handleOpenMushafPage(pendingMushafResume.page);
    onClearPendingMushafResume?.();
  }, [pendingMushafResume?.nonce]);

  if (showMushafReader) {
    return (
      <QuranMushafReader
        preferredReciter={activeReciter}
        initialPage={mushafInitialPage}
        onBack={() => { setShowMushafReader(false); refreshKhatmaStore(); }}
        readingKhatma={readingKhatma}
        readingKhatmas={khatmaStore.khatmas}
        readingKhatmaError={readingKhatmaError}
        onSelectReadingKhatma={id => {
          try {
            setActiveReadingKhatma(id);
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تبديل الختمة.');
          }
        }}
        onMarkPageRead={page => {
          try {
            markReadingPage(page);
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تسجيل الصفحة.');
          }
        }}
        onMarkSpreadPagesRead={pages => {
          try {
            markReadingPagesRange(pages);
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تسجيل الصفحتين.');
          }
        }}
        onMarkUntilPageRead={upToPage => {
          try {
            markReadingUntilPage(upToPage);
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تسجيل الصفحات.');
          }
        }}
        onUnmarkPagesRead={pages => {
          try {
            unmarkReadingPages(pages);
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر التراجع عن تسجيل الصفحات.');
          }
        }}
        onQuickStartReadingKhatma={() => {
          try {
            startReadingKhatma(localStorage, new Date());
            refreshKhatmaStore();
            setReadingKhatmaError('');
          } catch (error) {
            setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر بدء ختمة القراءة.');
          }
        }}
        onPageVisited={visitedPage => {
          if (!readingKhatma || readingKhatma.completedAt || readingKhatma.lastVisitedPage === visitedPage) return;
          try {
            updateReadingKhatmaPosition(visitedPage, readingKhatma.id, localStorage);
            refreshKhatmaStore();
          } catch {
            // Position tracking does not interrupt reading.
          }
        }}
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
        <button type="button" onClick={handleResumeReading} className="min-h-11 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-gold)] bg-[var(--wird-surface-muted)] px-4 py-2 text-sm font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] transition-colors">
          متابعة آخر موضع قراءة · سورة {ALL_SURAHS[lastReadingPosition.surahNumber - 1]?.name} · الآية {lastReadingPosition.ayahNumber}
        </button>
      )}
      {/* 1. Calm Editorial Quran Hero Banner */}
      <section className="wird-hero-surface relative overflow-hidden rounded-[var(--wird-radius-card)] p-6 md:p-8">
        <WirdIslamicPattern opacity={0.055} variant="gold" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl text-right">
            <p className="text-xs font-semibold text-[#E6B85C] flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>المصحف المطبوع والقراءة · برواية حفص عن عاصم</span>
            </p>
            <h1 className="text-3xl md:text-4xl font-black font-quran text-[#F9F6EE] tracking-wide leading-tight">
              القرآن الكريم
            </h1>
            <p className="text-[#F5F1E8]/85 text-sm leading-relaxed font-sans-ui">
              اقرأ في المصحف المطبوع بصفحة أو صفحتين متقابلتين مع التفسير المقابل، أو تصفّح السور الـ 114 والأجزاء الثلاثين مع الاستماع والختمات.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {readingKhatma && !readingKhatma.completedAt && (
              <button
                type="button"
                onClick={() => handleOpenMushafPage(getReadingKhatmaProgress(readingKhatma).resumePage)}
                className="min-h-12 inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--wird-radius-control)] border border-white/25 bg-white/12 hover:bg-white/20 text-[#F9F6EE] text-xs md:text-sm font-bold transition-colors tabular-nums"
              >
                <BookOpen className="w-4 h-4 text-[#E6B85C]" />
                <span>استكمال ختمة القراءة · ص {getReadingKhatmaProgress(readingKhatma).resumePage}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
              className="min-h-12 inline-flex items-center gap-2 px-5 py-2.5 rounded-[var(--wird-radius-control)] wird-btn-accent text-xs md:text-sm font-bold"
            >
              <BookOpen className="w-4 h-4" />
              <span>فتح المصحف بالصفحات (604)</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-6 max-w-3xl mx-auto relative">
          <Search className="w-5 h-5 text-[var(--wird-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ابحث عن أي سورة، رقمها، أو جزء (مثال: الملك، 67، البقرة، جزء عم)..."
            className="w-full min-h-12 pl-10 pr-12 py-3 bg-[var(--wird-surface)] text-[var(--wird-text)] rounded-[var(--wird-radius-control)] text-sm shadow-md border border-[var(--wird-border-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)] transition-all placeholder:text-[var(--wird-muted)]"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="مسح البحث"
              className="min-h-10 min-w-10 flex items-center justify-center absolute left-2 top-1/2 -translate-y-1/2 text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </section>

      <ReadingKhatmaPanel
        khatma={readingKhatma}
        khatmas={khatmaStore.khatmas}
        activeKhatmaId={khatmaStore.activeKhatmaId}
        completedCycles={khatmaStore.completedCycles}
        error={readingKhatmaError}
        onStart={plan => { try { startReadingKhatma(localStorage, new Date(), plan); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر بدء الختمة.'); } }}
        onCreateKhatma={options => { try { createReadingKhatma(options); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إنشاء الختمة.'); } }}
        onSelectKhatma={id => { try { setActiveReadingKhatma(id); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تحديد الختمة.'); } }}
        onDeleteKhatma={id => { try { deleteReadingKhatmaById(id); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر حذف الختمة.'); } }}
        onReset={() => { try { clearReadingKhatma(); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إعادة ضبط الختمة.'); } }}
        onPause={id => { try { pauseReadingKhatma(localStorage, new Date(), id); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر إيقاف الختمة مؤقتاً.'); } }}
        onResume={id => { try { resumeReadingKhatma(localStorage, new Date(), id); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر استئناف الختمة.'); } }}
        onUpdatePlan={(plan, id, title) => { try { updateReadingKhatmaPlan(plan, localStorage, new Date(), id, title); refreshKhatmaStore(); setReadingKhatmaError(''); } catch (error) { setReadingKhatmaError(error instanceof Error ? error.message : 'تعذر تحديث خطة الختمة.'); } }}
        onContinue={page => handleOpenMushafPage(page)}
      />

      {/* 2. Top Segmented Navigation Tabs + Direct Reciter Rail + Speed */}
      <div className="space-y-3 border-b border-[var(--wird-border)] pb-3">
        <HorizontalScrollRail ariaLabel="أقسام تصفح القرآن" activeKey={activeTab}>
          <button
            type="button"
            onClick={() => setActiveTab('surahs')}
            aria-pressed={activeTab === 'surahs'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-[var(--wird-radius-control)] text-xs font-bold border transition-all ${
              activeTab === 'surahs'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
            }`}
          >
            السور ({filteredSurahs.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('juz')}
            aria-pressed={activeTab === 'juz'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-[var(--wird-radius-control)] text-xs font-bold border transition-all ${
              activeTab === 'juz'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
            }`}
          >
            الأجزاء (30 جزء)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('study')}
            aria-pressed={activeTab === 'study'}
            className={`min-h-11 shrink-0 snap-start px-4 py-2 rounded-[var(--wird-radius-control)] text-xs font-bold border transition-all flex items-center gap-1.5 ${
              activeTab === 'study'
                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" />
            <span className="whitespace-nowrap">تلاوة ودراسة: سورة {selectedSurah.name}</span>
          </button>
        </HorizontalScrollRail>

        {/* Global Controls: Direct Reciter Buttons + Audio Speed */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="inline-flex items-center gap-1.5 font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">
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
                    className={`min-h-10 shrink-0 snap-start px-3 py-1.5 rounded-[var(--wird-radius-control)] border text-xs font-bold transition-all whitespace-nowrap ${
                      isReciterActive
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                        : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
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

      {/* 3. TAB 1: SURAHS DIRECTORY GRID */}
      {activeTab === 'surahs' && (
        <div className="space-y-5">
          {/* Revelation Filters */}
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[var(--wird-muted)] font-semibold">تصنيف النزول:</span>
              <div className="inline-flex p-1 bg-[var(--wird-surface-muted)] rounded-[var(--wird-radius-control)] border border-[var(--wird-border)]">
                {(['all', 'مكية', 'مدنية'] as const).map(filter => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setRevelationFilter(filter)}
                    className={`min-h-9 px-3.5 py-1 rounded-lg font-bold transition-colors ${
                      revelationFilter === filter
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-2xs'
                        : 'text-[var(--wird-muted)] hover:text-[var(--wird-text)]'
                    }`}
                  >
                    {filter === 'all' ? 'الكل' : filter}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[var(--wird-muted)] text-xs tabular-nums font-medium">
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
                  className={`wird-card group relative p-4 rounded-[var(--wird-radius-card)] transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-[var(--wird-accent)] ring-1 ring-[var(--wird-border-gold)]'
                      : 'hover:border-[var(--wird-border-gold)]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono tabular-nums font-bold text-xs transition-colors ${
                        isSelected
                          ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                          : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] group-hover:bg-[var(--wird-primary)] group-hover:text-[var(--wird-primary-ink)]'
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
                            className="text-right text-[var(--wird-text)] hover:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)] rounded-md transition-colors"
                          >
                            سورة {surah.name}
                          </button>
                        </h3>
                        <p className="text-xs text-[var(--wird-muted)] font-sans tracking-wide">
                          {surah.englishName}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
                      {surah.revelationType}
                    </span>
                  </div>

                  {/* Unboxed Metadata & Action Buttons */}
                  <div className="mt-4 pt-3 border-t border-[var(--wird-border)] flex items-center justify-between text-xs text-[var(--wird-muted)]">
                    <div className="flex items-center gap-1.5 text-[11px] tabular-nums">
                      <span>{surah.versesCount} آيات</span>
                      <span aria-hidden="true">·</span>
                      <span>صفحة {surah.pageStart}</span>
                      <span aria-hidden="true">·</span>
                      <span>الجزء {surah.juzStart}</span>
                    </div>

                    <div className="flex items-center gap-1">
                      <InlineAudioOfflineBadgeButton
                        reciter={activeReciter}
                        scopeKind="surah"
                        labelAr={`سورة ${surah.name}`}
                        ranges={[{ surahNumber: surah.number, startAyah: 1, endAyah: surah.versesCount }]}
                        compact
                      />

                      <button
                        type="button"
                        onClick={() => {
                          handleOpenMushafPage(surah.pageStart);
                        }}
                        title="قراءة في المصحف"
                        aria-label={`قراءة سورة ${surah.name} في المصحف`}
                        className="min-h-10 min-w-10 flex items-center justify-center rounded-lg hover:bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] hover:text-[var(--wird-primary)] dark:text-[var(--wird-accent)] transition-colors"
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
                        className="min-h-10 min-w-10 flex items-center justify-center rounded-lg hover:bg-[var(--wird-accent-soft)] text-[var(--wird-muted)] hover:text-[var(--wird-accent)] transition-colors"
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
            <div className="wird-card text-center py-16 rounded-3xl text-[var(--wird-muted)] text-sm">
              لم يتم العثور على سور مطابقة لكلمة البحث. جرّب البحث برقم السورة أو كتابة اسم آخر.
            </div>
          )}
        </div>
      )}

      {/* 4. TAB 2: JUZ DIRECTORY GRID (30 Juz) */}
      {activeTab === 'juz' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 30 }, (_, index) => index + 1).map((juzNumber) => {
              const point = JUZ_INDEX[String(juzNumber)];
              const startSurah = point ? ALL_SURAHS.find(s => s.number === point.surahNumber) : undefined;
              const juzName = JUZ_NAMES[juzNumber - 1] || `الجزء ${juzNumber}`;

              return (
                <div
                  key={juzNumber}
                  className="wird-card p-5 rounded-[var(--wird-radius-card)] hover:border-[var(--wird-border-gold)] transition-all flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[var(--wird-accent-soft)] border border-[var(--wird-border-gold)] text-[var(--wird-accent)] flex items-center justify-center font-bold font-mono tabular-nums text-sm">
                        {juzNumber}
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-[var(--wird-text)]">
                          {juzName}
                        </h3>
                        <p className="text-xs text-[var(--wird-muted)]">
                          يبدأ من: سورة {startSurah?.name || '—'} (الآية {point?.ayahNumber || 1})
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-[var(--wird-border)] flex items-center justify-between text-xs">
                    <span className="text-[var(--wird-muted)] text-[11px] tabular-nums">
                      صفحة {point?.page || Math.ceil((juzNumber - 1) * 20 + 2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleOpenMushafPage(point?.page || 1)}
                      className="min-h-11 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)] font-bold transition-colors"
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
        <div className="space-y-6">
          {/* Surah Header Card with Calligraphy and Metadata */}
          <div className="rounded-[var(--wird-radius-card)] border border-[var(--wird-border-gold)] bg-[var(--wird-surface)] p-6 md:p-8 text-center relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--wird-muted)] font-semibold border-b border-[var(--wird-border)] pb-3 mb-4">
              <span>الجزء {selectedSurah.juzStart} {selectedSurah.juzEnd !== selectedSurah.juzStart && `إلى ${selectedSurah.juzEnd}`}</span>
              <span className="font-quran text-lg text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold">
                سورة {selectedSurah.name} ({selectedSurah.englishName})
              </span>
              <span className="tabular-nums">{selectedSurah.revelationType} · صفحة {selectedSurah.pageStart}</span>
            </div>

            <h2 className="text-3xl md:text-5xl font-black font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)] my-2">
              سُورَةُ {selectedSurah.name}
            </h2>

            <p className="text-xs text-[var(--wird-muted)] mt-1 tabular-nums">
              عدد آياتها: <strong className="font-mono text-[var(--wird-text)]">{selectedSurah.versesCount}</strong> آية
            </p>

            {/* Sacred Basmalah */}
            {selectedSurah.number !== 1 && selectedSurah.number !== 9 && (
              <p className="font-quran text-2xl md:text-3xl text-[var(--wird-primary)] dark:text-[var(--wird-accent)] py-4 mt-2">
                <QuranBasmala surahNumber={selectedSurah.number} />
              </p>
            )}

            {/* Quick Action Shortcuts */}
            <div className="flex flex-wrap items-center justify-center gap-3 mt-4 pt-3 border-t border-[var(--wird-border)]">
              <button
                type="button"
                onClick={() => handlePlayAyah(1)}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)] font-bold text-xs transition-colors shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>استماع للسورة من البداية</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenMushafPage(selectedSurah.pageStart)}
                className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-accent)] border border-[var(--wird-border-strong)] font-bold text-xs transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span>فتح صفحة {selectedSurah.pageStart} في المصحف</span>
              </button>

              <div className="flex flex-wrap items-center gap-2 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] px-2.5 py-1.5 text-xs">
                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-muted)]">
                  <span>من</span>
                  <select
                    aria-label="بداية نطاق الحفظ من الآية"
                    value={sessionRangeStart}
                    onChange={event => {
                      const nextStart = Number(event.target.value);
                      setSessionRangeStart(nextStart);
                      if (sessionRangeEnd < nextStart) setSessionRangeEnd(nextStart);
                    }}
                    className="min-h-9 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-xs font-bold text-[var(--wird-text)] tabular-nums"
                  >
                    {Array.from({ length: selectedSurah.versesCount }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>آية {num}</option>
                    ))}
                  </select>
                </label>

                <label className="inline-flex items-center gap-1.5 font-semibold text-[var(--wird-muted)]">
                  <span>إلى</span>
                  <select
                    aria-label="نهاية نطاق الحفظ إلى الآية"
                    value={sessionRangeEnd}
                    onChange={event => setSessionRangeEnd(Number(event.target.value))}
                    className="min-h-9 rounded-lg border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] px-2 text-xs font-bold text-[var(--wird-text)] tabular-nums"
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
                  className="min-h-11 inline-flex items-center gap-2 px-4 py-2 rounded-[var(--wird-radius-control)] wird-btn-accent text-xs font-bold shadow-xs"
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
            <div className="py-24 text-center text-[var(--wird-primary)] dark:text-[var(--wird-accent)] space-y-2">
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
                  <p className="text-sm font-bold text-[var(--wird-text)]">طريقة عرض الآيات</p>
                  <div className="flex flex-wrap items-center gap-2">
                  <div role="group" aria-label="طريقة عرض آيات السورة" className="inline-flex rounded-xl bg-[var(--wird-surface-muted)] p-1 dark:bg-[var(--wird-surface-muted)]">
                    <button type="button" aria-pressed={studyLayout === 'ayah-cards'} onClick={() => setStudyLayout('ayah-cards')} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${studyLayout === 'ayah-cards' ? 'bg-[var(--wird-primary)] text-white shadow-xs' : 'text-[var(--wird-muted)]'}`}>
                      آية آية
                    </button>
                    <button type="button" aria-pressed={studyLayout === 'continuous'} onClick={() => setStudyLayout('continuous')} className={`min-h-11 rounded-lg px-3 text-sm font-bold transition-colors ${studyLayout === 'continuous' ? 'bg-[var(--wird-primary)] text-white shadow-xs' : 'text-[var(--wird-muted)]'}`}>
                      قراءة متصلة
                    </button>
                  </div>
                  <button type="button" aria-expanded={showTypographyLab} onClick={() => setShowTypographyLab(value => !value)} className="min-h-11 rounded-xl border border-[var(--wird-border)] px-3 text-sm font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:bg-[var(--wird-surface-muted)] transition-colors">
                    {showTypographyLab ? 'إخفاء مختبر الخطوط' : 'مختبر الخطوط'}
                  </button>
                  </div>
                </div>

                {/* Study Segment Audio Range + Dual Loop Repetition */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--wird-border)] text-xs">
                  <div className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-bg)]/70 dark:bg-[var(--wird-surface-muted)] px-2.5 py-1" dir="rtl">
                    <span className="font-bold text-[var(--wird-text)]">المقطع الصوتي</span>
                    <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                      <span className="font-bold">من</span>
                      <select
                        aria-label="بداية المقطع الصوتي في الدراسة"
                        value={segmentStartIndex}
                        onChange={event => {
                          const next = Number(event.target.value);
                          setSegmentStartIndex(next);
                          if (segmentEndIndex < next) setSegmentEndIndex(next);
                        }}
                        className="min-h-11 min-w-24 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
                      >
                        {currentAyahs.map((ayah, index) => (
                          <option key={ayah.number} value={index}>{formatAyahRangeOptionLabel(ayah.numberInSurah)}</option>
                        ))}
                      </select>
                    </label>
                    <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                      <span className="font-bold">إلى</span>
                      <select
                        aria-label="نهاية المقطع الصوتي في الدراسة"
                        value={segmentEndIndex}
                        onChange={event => setSegmentEndIndex(Number(event.target.value))}
                        className="min-h-11 min-w-24 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
                      >
                        {currentAyahs.slice(segmentStartIndex).map((ayah, offset) => (
                          <option key={ayah.number} value={segmentStartIndex + offset}>{formatAyahRangeOptionLabel(ayah.numberInSurah)}</option>
                        ))}
                      </select>
                    </label>
                    {currentAyahs[segmentStartIndex] && currentAyahs[segmentEndIndex] && (
                      <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                        من آية {currentAyahs[segmentStartIndex].numberInSurah} إلى آية {currentAyahs[segmentEndIndex].numberInSurah}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                      <span className="font-semibold">تكرار كل آية</span>
                      <select
                        aria-label="عدد مرات تكرار الآية في الدراسة"
                        value={normalizeAyahSegmentRepeatCount(repeatTarget)}
                        onChange={event => handleRepeatTargetChange(Number(event.target.value) as AudioRepeatCount)}
                        className="min-h-11 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
                      >
                        <option value={1}>مرة واحدة</option>
                        <option value={2}>مرتان</option>
                        <option value={3}>3 مرات</option>
                        <option value={5}>5 مرات</option>
                        <option value={10}>10 مرات</option>
                      </select>
                    </label>

                    <label className="inline-flex items-center gap-1.5 text-[var(--wird-muted)]">
                      <span className="font-semibold">تكرار المقطع</span>
                      <select
                        aria-label="عدد مرات تكرار المقطع في الدراسة"
                        value={segmentRepeatCount}
                        onChange={event => handleSegmentRepeatCountChange(Number(event.target.value) as AudioRepeatCount)}
                        className="min-h-11 rounded-lg border border-[var(--wird-border)] bg-[var(--wird-surface)] text-[var(--wird-text)] px-2.5 text-xs font-semibold"
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
                        isSegmentPlaying ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]' : 'bg-[var(--wird-primary)] text-white hover:bg-[#143D36]'
                      }`}
                    >
                      {isSegmentPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isSegmentPlaying ? 'إيقاف مؤقت للمقطع' : isSegmentPaused ? 'استئناف المقطع' : 'تشغيل المقطع المحدد'}</span>
                    </button>
                  </div>
                </div>

                {segmentStatus && (
                  <p aria-live="polite" className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
                    جاري التلاوة: آية {segmentStatus.ayahNumber} · تكرار الآية {segmentStatus.ayahIteration}/{normalizeAyahSegmentRepeatCount(repeatTarget)} · دورة المقطع {segmentStatus.cycle}{segmentRepeatCount === -1 ? ' (مستمر)' : `/${segmentRepeatCount}`}
                  </p>
                )}
              </div>

              {showTypographyLab && <QuranTypographyLab onClose={() => setShowTypographyLab(false)} />}

              {studyLayout === 'continuous' ? (
                <div aria-label={`قراءة متصلة لسورة ${selectedSurah.name}`} className={`rounded-3xl border border-[#C59B27]/30 bg-[var(--wird-bg)] ${studyCardPaddingClass} text-right shadow-xs dark:border-[#E0A96D]/25 dark:bg-[var(--wird-surface)]`}>
                  <p
                    className="quran-text font-quran text-[var(--wird-text)]"
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
                            className={`mx-1 inline-flex min-h-11 min-w-11 translate-y-1 items-center justify-center rounded-full align-baseline ${isThisPlaying ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]' : 'bg-[var(--wird-primary)]/12 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] dark:bg-[var(--wird-primary)]/40 dark:text-[var(--wird-accent)]'}`}
                          >
                            {isThisPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                          </button>{' '}
                        </React.Fragment>
                      );
                    })}
                  </p>
                  <p className="mt-4 text-xs text-[var(--wird-muted)]">اضغط نص الآية لفتح تفسيرها، أو زر الاستماع لبدء التلاوة منها.</p>
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
                        ? 'border-[var(--wird-border-gold)] shadow-md ring-2 ring-[#C59B27]/40'
                        : 'hover:border-[var(--wird-border-gold)]/60 dark:hover:border-[#E0A96D]/45'
                    }`}
                  >
                    {/* Top Verse Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[var(--wird-border)] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-xs bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] px-2.5 py-1 rounded-lg border border-[var(--wird-border)]">
                          الآية {ayah.numberInSurah}
                        </span>

                        <span className="text-[11px] text-[var(--wird-muted)] hidden sm:inline tabular-nums">
                          صفحة {ayah.page} · جزء {ayah.juz}
                        </span>

                        {ayah.sajda && (
                          <span className="text-[11px] text-[var(--wird-accent)] font-bold">
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
                              ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                              : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)]'
                          }`}
                        >
                          {isThisPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => { rememberReadingPosition(ayah.numberInSurah); setTafsirAyah(ayah); }}
                          title="عرض التفسير المعتمد (Quran.com v4)"
                          aria-label={`تفسير الآية ${ayah.numberInSurah}`}
                          className="min-h-10 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 text-[var(--wird-primary)] dark:text-[var(--wird-text)] hover:bg-[var(--wird-primary)] hover:text-[var(--wird-primary-ink)] transition-colors font-bold text-xs"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>التفسير</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyAyah(ayah)}
                          title="نسخ نص الآية الكريمة"
                          aria-label={`نسخ الآية ${ayah.numberInSurah}`}
                          className="min-h-10 min-w-10 flex items-center justify-center rounded-xl bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] transition-colors"
                        >
                          {isCopied ? <Check className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" /> : <Copy className="w-4 h-4" />}
                        </button>

                        <button
                          type="button"
                          onClick={() => onStartSession(selectedSurah.number, ayah.numberInSurah, ayah.numberInSurah)}
                          title="تدريب وحفظ هذه الآية"
                          className="min-h-10 inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-[var(--wird-accent-soft)] text-[#8A6914] dark:text-[#E0A96D] hover:bg-[#C59B27]/25 transition-colors font-bold text-xs border border-[#C59B27]/30"
                        >
                          <Sparkles className="w-3.5 h-3.5 text-[var(--wird-accent)]" />
                          <span className="hidden sm:inline">تدريب وحفظ</span>
                        </button>
                      </div>
                    </div>

                    {/* Canonical Ayah Text */}
                    <div className="py-2 text-right">
                      <p
                        className="font-quran text-[var(--wird-text)] selection:bg-[#C59B27]/30"
                        style={{ fontSize: `${displayPreferences.fontSize}px`, lineHeight: studyLineHeight }}
                      >
                        <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' '}
                        <span className="ayah-number" title={`الآية ${ayah.numberInSurah}`}>
                          {ayah.numberInSurah}
                        </span>
                      </p>
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
          className="fixed bottom-0 left-0 right-0 z-50 bg-[var(--wird-header-glass)] backdrop-blur-md border-t border-[var(--wird-border-gold)] shadow-2xl px-4 py-3 transition-transform animate-in slide-in-from-bottom duration-300"
        >
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
            {/* Playing Context */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-[var(--wird-primary)] text-[var(--wird-accent)] flex items-center justify-center font-bold text-sm shrink-0 shadow-xs">
                <Volume2 className="w-5 h-5" />
              </div>
              <div className="min-w-0 text-right">
                <h4 className="font-bold text-[var(--wird-text)] text-sm truncate font-quran">
                  سورة {selectedSurah.name} · الآية {playingAyah || 1}
                </h4>
                <p className="text-[11px] text-[var(--wird-muted)] truncate tabular-nums">
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
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)] transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => (isSegmentPlaying || isSegmentPaused) ? handleToggleStudySegmentAudio() : (playingAyah && handlePlayAyah(playingAyah))}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'استئناف'}
                className="w-11 h-11 rounded-2xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-white flex items-center justify-center shadow-md active:scale-95 transition-all"
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white mr-0.5" />}
              </button>

              <button
                type="button"
                onClick={handleNextAyah}
                aria-label="الآية التالية"
                title="الآية التالية"
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl text-[var(--wird-muted)] hover:bg-[var(--wird-surface-muted)] transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              {/* Single Repeat Selector Dropdown */}
              <label className="inline-flex items-center gap-1.5 text-xs text-[var(--wird-muted)]">
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="font-semibold">تكرار الآية</span>
                <select
                  aria-label="مرات تكرار الآية للحفظ"
                  value={repeatTarget}
                  onChange={event => handleRepeatTargetChange(Number(event.target.value) as AudioRepeatCount)}
                  className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] px-2.5 text-xs font-bold text-[var(--wird-text)]"
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
                className="min-h-11 min-w-11 flex items-center justify-center rounded-xl hover:bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* 7. Verification & Integrity Footer */}
      <footer className="wird-card rounded-3xl p-6 text-xs text-[var(--wird-muted)] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[var(--wird-primary)]/12 dark:bg-[var(--wird-primary)]/40 flex items-center justify-center shrink-0 border border-[#C59B27]/30">
            <CheckCircle2 className="w-5 h-5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          </div>
          <div>
            <div className="font-bold text-[var(--wird-text)] flex flex-wrap items-center gap-2">
              <span>قاعدة البيانات القرآنية الموثقة — 114 سورة كاملة (6,236 آية)</span>
              <span className="text-[11px] font-mono text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                · Hafs 'an Asim
              </span>
            </div>
            <p className="text-[11px] text-[var(--wird-muted)] mt-0.5">
              النص المرجعي العثماني محفوظ دون تغيير، والعرض الافتراضي يستخدم نص Tanzil الرسمي بالرسم الإملائي Simple 1.1 كامل التشكيل.
            </p>
          </div>
        </div>

        <div className="text-right text-[11px] space-y-0.5 shrink-0">
          <div className="text-[var(--wird-text)]">
            المصدر: <a href={QURAN_DATA_SOURCE_INFO.displaySourceUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] underline underline-offset-2">{QURAN_DATA_SOURCE_INFO.provider}</a>
            <div className="text-[var(--wird-muted)]">{QURAN_DATA_SOURCE_INFO.displayVersion} · {QURAN_DATA_SOURCE_INFO.displayLicense}</div>
          </div>
          <div className="text-[var(--wird-muted)]">
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
