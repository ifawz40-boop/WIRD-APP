import React, { useState, useRef, useEffect, useId, useMemo, useCallback } from 'react';
import {
  Play,
  Pause,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Volume2,
  BookOpen,
  ArrowRight,
  Flame,
  Award,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  BookText,
  FileImage,
  Repeat,
  AlertTriangle,
  Link2,
  Check
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import { loadSurahVerses, getAyahWords, loadSimpleAyahText, loadSimpleAyahRange } from '../../data/quranDataLoader';
import { QuranBasmala } from '../shared/QuranBasmala';
import { Ayah, ReciterId, UserProfile } from '../../types/quran';
import { RECITERS, computeGlobalAyahNumber, getLicensedAyahAudioUrl } from '../../services/audioService';
import { offlineQuranAudioLibrary } from '../../services/offlineQuranAudioLibrary';
import { createSecureId } from '../../services/secureId';
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
import { attachAyahRepeatHandler } from '../../services/audioRepeatController';
import { SessionTafsirPanel } from './SessionTafsirPanel';
import { PrintedMushafSpread } from '../library/PrintedMushafSpread';
import {
  DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES,
  getMemorizationDisplayPreferences,
  saveMemorizationDisplayPreferences,
  type MemorizationDisplayPreferences,
  type MemorizationSessionPageWidth
} from '../../services/memorizationDisplayPreferences';
import {
  CUMULATIVE_WINDOW_SIZES,
  confirmAyahMastery,
  confirmFinalSegmentMastery,
  getSavedStudyMethod,
  loadCumulativeSessionProgress,
  recordListeningProgress,
  recordRecallVerification,
  saveCumulativeSessionProgress,
  saveStudyMethod,
  type AyahMemorizationStage,
  type CumulativeSessionProgress,
  type CumulativeWindowSize
} from '../../services/cumulativeLinkingService';

const SESSION_PAGE_WIDTH_CLASSES: Record<MemorizationSessionPageWidth, string> = {
  comfortable: 'max-w-4xl',
  wide: 'max-w-6xl',
  full: 'max-w-none'
};

interface MemorizationSessionViewProps {
  initialSurahNumber?: number;
  initialStartAyah?: number;
  initialEndAyah?: number;
  mode?: 'memorize' | 'review';
  profile: UserProfile;
  onCompleteSession: (memorizedAyahs: number, reviewedPages: number, minutes: number, taskName: string, mode?: 'memorize' | 'review') => boolean | Promise<boolean>;
  onAddVerseToRevision?: (surahNumber: number, surahName: string, ayahNumber: number, text: string, notes: string, mutationId: string) => boolean | Promise<boolean>;
  onRangeChange?: (surahNumber: number, startAyah: number, endAyah: number) => void;
  onExit: () => void;
  onProgressChange?: (inProgress: boolean) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const MemorizationSessionView: React.FC<MemorizationSessionViewProps> = ({
  initialSurahNumber = 67, // Default Al-Mulk
  initialStartAyah = 1,
  initialEndAyah = 5,
  mode = 'memorize',
  profile,
  onCompleteSession,
  onAddVerseToRevision,
  onRangeChange,
  onExit,
  onProgressChange,
  onToast
}) => {
  const [surahNumber, setSurahNumber] = useState(initialSurahNumber);
  const [startAyah, setStartAyah] = useState(() => Math.max(1, initialStartAyah));
  const [endAyah, setEndAyah] = useState(() => {
    const initialMeta = ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66];
    const safeStart = Math.min(Math.max(1, initialStartAyah || 1), initialMeta.versesCount);
    return Math.min(Math.max(safeStart, initialEndAyah || initialMeta.versesCount), initialMeta.versesCount);
  });
  const [isRangeEditorOpen, setIsRangeEditorOpen] = useState(false);
  const [cumulativeProgress, setCumulativeProgress] = useState<CumulativeSessionProgress>(() =>
    loadCumulativeSessionProgress(
      initialSurahNumber,
      Math.max(1, initialStartAyah),
      Math.min(
        Math.max(Math.max(1, initialStartAyah), initialEndAyah || (ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66]).versesCount),
        (ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66]).versesCount
      )
    )
  );
  const [currentAyahIndex, setCurrentAyahIndex] = useState(() => Math.max(0, cumulativeProgress.currentIndex));
  const [allSurahAyahs, setAllSurahAyahs] = useState<Ayah[]>([]);
  const [isLoadingAyahs, setIsLoadingAyahs] = useState(true);
  const [loadRetry, setLoadRetry] = useState(0);

  const [activeReciter, setActiveReciter] = useState<ReciterId>(() =>
    getSavedPreferredReciter(profile.preferredReciter || 'alafasy')
  );

  useEffect(() => {
    const meta = ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66];
    const safeStart = Math.min(Math.max(1, initialStartAyah || 1), meta.versesCount);
    const safeEnd = Math.min(Math.max(safeStart, initialEndAyah || meta.versesCount), meta.versesCount);
    setSurahNumber(meta.number);
    setStartAyah(safeStart);
    setEndAyah(safeEnd);
    const restored = loadCumulativeSessionProgress(meta.number, safeStart, safeEnd);
    setCumulativeProgress(restored);
    setStudyMethod(getSavedStudyMethod(meta.number, safeStart, safeEnd));
    setCurrentAyahIndex(Math.min(restored.currentIndex, Math.max(0, safeEnd - safeStart)));
  }, [initialSurahNumber, initialStartAyah, initialEndAyah]);

  // Load only the active surah's verses into the memorization session.
  const surahMeta = ALL_SURAHS.find(s => s.number === surahNumber) || ALL_SURAHS[66];
  useEffect(() => {
    let cancelled = false;
    setAllSurahAyahs([]);
    setIsLoadingAyahs(true);
    loadSurahVerses(surahNumber)
      .then(ayahs => { if (!cancelled) setAllSurahAyahs(ayahs); })
      .catch(error => { if (!cancelled) console.error('[WIRD Session] Failed to load Surah ' + surahNumber, error); })
      .finally(() => { if (!cancelled) setIsLoadingAyahs(false); });
    return () => { cancelled = true; };
  }, [surahNumber, loadRetry]);
  
  // Filter ayahs within selected range
  const sessionAyahs = useMemo(
    () =>
      allSurahAyahs.length > 0
        ? allSurahAyahs.filter(a => a.numberInSurah >= startAyah && a.numberInSurah <= endAyah)
        : [],
    [allSurahAyahs, startAyah, endAyah]
  );

  // Pre-cache only approved licensed active-session recitation files (bounded in SW).
  useEffect(() => {
    if (!sessionAyahs.length || currentAyahIndex % 10 !== 0 || !('serviceWorker' in navigator)) return;
    let cancelled = false;
    const urls = sessionAyahs.slice(currentAyahIndex, currentAyahIndex + 20)
      .map(ayah => getLicensedAyahAudioUrl(surahNumber, ayah.numberInSurah, activeReciter))
      .filter(descriptor => !descriptor.streamOnly)
      .map(descriptor => descriptor.url);
    if (!urls.length) return;
    navigator.serviceWorker.ready
      .then(registration => {
        if (cancelled) return;
        const worker = navigator.serviceWorker.controller || registration.active || registration.waiting;
        worker?.postMessage({ type: 'WIRD_CACHE_SESSION_AUDIO', urls });
      })
      .catch(error => console.warn('[WIRD Session] Audio cache unavailable:', error));
    return () => { cancelled = true; };
  }, [surahNumber, activeReciter, sessionAyahs, currentAyahIndex]);

  const currentAyah: Ayah | undefined = sessionAyahs[currentAyahIndex];

  const [displayPreferences, setDisplayPreferences] = useState<MemorizationDisplayPreferences>(
    () => getMemorizationDisplayPreferences()
  );
  useEffect(() => {
    saveMemorizationDisplayPreferences(displayPreferences);
  }, [displayPreferences]);
  const updateDisplayPreferences = useCallback((updates: Partial<MemorizationDisplayPreferences>) => {
    setDisplayPreferences(previous => ({ ...previous, ...updates }));
  }, []);

  const settingsPanelId = useId();
  const settingsStorageKey = 'wird:memorization-display-panel-open:v1';
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    try {
      return localStorage.getItem(settingsStorageKey) === 'true';
    } catch {
      return false;
    }
  });
  const settingsToggleRef = useRef<HTMLButtonElement | null>(null);
  const setSettingsOpenPersist = useCallback((nextValue: boolean | ((prev: boolean) => boolean)) => {
    setIsSettingsOpen(prev => {
      const next = typeof nextValue === 'function' ? nextValue(prev) : nextValue;
      try { localStorage.setItem(settingsStorageKey, String(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isSettingsOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSettingsOpenPersist(false);
        settingsToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isSettingsOpen, setSettingsOpenPersist]);

  const [pageDisplayTexts, setPageDisplayTexts] = useState<string[]>([]);
  const [pageDisplayError, setPageDisplayError] = useState(false);
  const activePageAyahRef = useRef<HTMLButtonElement | null>(null);
  const sessionPages = useMemo(
    () => Array.from(new Set(sessionAyahs.map(ayah => ayah.page))).sort((a, b) => a - b),
    [sessionAyahs]
  );
  const [printedPage, setPrintedPage] = useState<number>(() => currentAyah?.page || 1);
  const [outOfRangeNotice, setOutOfRangeNotice] = useState<string | null>(null);
  const [printedTafsirAyah, setPrintedTafsirAyah] = useState<Ayah | null>(null);

  useEffect(() => {
    if (currentAyah?.page) {
      setPrintedPage(currentAyah.page);
    }
  }, [currentAyah?.page]);

  useEffect(() => {
    if (
      displayPreferences.viewMode !== 'page' ||
      isLoadingAyahs ||
      sessionAyahs.length === 0 ||
      sessionAyahs[0].surahNumber !== surahNumber
    ) {
      setPageDisplayTexts([]);
      setPageDisplayError(false);
      return;
    }
    let cancelled = false;
    setPageDisplayTexts([]);
    setPageDisplayError(false);
    const rangeStart = sessionAyahs[0].numberInSurah;
    const rangeEnd = sessionAyahs[sessionAyahs.length - 1].numberInSurah;
    loadSimpleAyahRange(surahNumber, rangeStart, rangeEnd)
      .then(texts => {
        if (cancelled) return;
        if (
          texts.length !== sessionAyahs.length ||
          texts.some(item => typeof item !== 'string' || item.trim().length === 0)
        ) {
          throw new Error('Verified Tanzil Simple range did not match the selected memorization range.');
        }
        setPageDisplayTexts(texts);
      })
      .catch(error => {
        if (cancelled) return;
        console.error('[WIRD Session] Whole-session verified text unavailable:', error);
        setPageDisplayError(true);
      });
    return () => { cancelled = true; };
  }, [displayPreferences.viewMode, isLoadingAyahs, surahNumber, sessionAyahs]);

  // Keep the selected verse visible when the user jumps from the sticky selector or the page list.
  useEffect(() => {
    if (displayPreferences.viewMode !== 'page' || displayPreferences.mushafStyle !== 'connected') return;
    if (pageDisplayTexts.length !== sessionAyahs.length) return;
    activePageAyahRef.current?.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }, [currentAyahIndex, displayPreferences.viewMode, displayPreferences.mushafStyle, pageDisplayTexts.length, sessionAyahs.length]);

  // 1. Audio recitation state
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<PlaybackRate>(() => getSavedPlaybackRate());
  const [audioRepeatCount, setAudioRepeatCount] = useState<AudioRepeatCount>(() => getSavedAudioRepeatCount());
  const [segmentRepeatCount, setSegmentRepeatCount] = useState<AudioRepeatCount>(() => getSavedSegmentRepeatCount());
  const [segmentStartIndex, setSegmentStartIndex] = useState(0);
  const [segmentEndIndex, setSegmentEndIndex] = useState(Math.max(0, sessionAyahs.length - 1));
  const [isSegmentPlaying, setIsSegmentPlaying] = useState(false);
  const [isSegmentPaused, setIsSegmentPaused] = useState(false);
  const [segmentProgress, setSegmentProgress] = useState<{ ayahNumber: number; cycle: number; ayahIteration: number } | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const segmentAudioQueueRef = useRef<QuranAudioQueueController | null>(null);
  const activeObjectUrlRevokersRef = useRef<Set<() => void>>(new Set());
  const playbackRequestSeqRef = useRef(0);
  const queueAdvanceRef = useRef(false);
  const currentAyahIndexRef = useRef(currentAyahIndex);
  const playbackIterationRef = useRef(1);
  const repeatTargetRef = useRef<number | null>(audioRepeatCount === -1 ? null : audioRepeatCount);
  const completionInProgressRef = useRef(false);
  const stopAudioRef = useRef<() => void>(() => {});

  // Track 3: Durable 5-stage Cumulative Linking & Instant Weak-Verse Capture
  const [studyMethod, setStudyMethod] = useState<'free' | 'cumulative_linking'>(() =>
    getSavedStudyMethod(
      initialSurahNumber,
      Math.max(1, initialStartAyah),
      Math.min(
        Math.max(Math.max(1, initialStartAyah), initialEndAyah || (ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66]).versesCount),
        (ALL_SURAHS[initialSurahNumber - 1] || ALL_SURAHS[66]).versesCount
      )
    )
  );
  const [masteryFeedback, setMasteryFeedback] = useState<string | null>(null);
  const [awaitingFinalConfirm, setAwaitingFinalConfirm] = useState(false);
  const [isCumulativePlaying, setIsCumulativePlaying] = useState(false);
  const [weakMarkedAyahs, setWeakMarkedAyahs] = useState<Set<string>>(new Set());
  const [isCapturingWeakVerse, setIsCapturingWeakVerse] = useState(false);
  const [weakCaptureFeedback, setWeakCaptureFeedback] = useState<{ ayahKey: string; message: string; success: boolean } | null>(null);
  const weakCaptureMutationIdsRef = useRef<Map<string, string>>(new Map());
  const weakCaptureInFlightRef = useRef(false);

  const masteredIndices = useMemo(
    () => new Set(cumulativeProgress.masteredIndices),
    [cumulativeProgress.masteredIndices]
  );
  const recallVerifiedIndices = useMemo(
    () => new Set(cumulativeProgress.recallVerifiedIndices),
    [cumulativeProgress.recallVerifiedIndices]
  );

  useEffect(() => {
    saveCumulativeSessionProgress({
      ...cumulativeProgress,
      currentIndex: currentAyahIndex
    });
  }, [cumulativeProgress, currentAyahIndex]);

  const handlePlaybackRateChange = (rate: PlaybackRate) => {
    const savedRate = savePlaybackRate(rate);
    setPlaybackRate(savedRate);
    if (audioRef.current) audioRef.current.playbackRate = savedRate;
    segmentAudioQueueRef.current?.setPlaybackRate(savedRate);
  };

  const handleAudioRepeatCountChange = (count: AudioRepeatCount) => {
    const savedCount = saveAudioRepeatCount(count);
    repeatTargetRef.current = savedCount === -1 ? null : savedCount;
    setAudioRepeatCount(savedCount);
    segmentAudioQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(savedCount));
  };

  const handleSegmentRepeatCountChange = (count: AudioRepeatCount) => {
    const savedCount = saveSegmentRepeatCount(count);
    setSegmentRepeatCount(savedCount);
    segmentAudioQueueRef.current?.setRepeatCount(savedCount === -1 ? null : savedCount);
  };

  const handleReciterChange = (reciterId: ReciterId) => {
    stopAudioRef.current();
    const prefs = savePreferredReciter(reciterId);
    setActiveReciter(prefs.preferredReciter);
  };

  // 2. Progressive word masking: 0 = none, 1 = 30%, 2 = 60%, 3 = 100% (hidden)
  const [maskLevel, setMaskLevel] = useState<number>(0);
  const [revealedWordIndices, setRevealedWordIndices] = useState<Set<number>>(new Set());

  // 3. Repetition counter
  const [repeatCount, setRepeatCount] = useState(0);
  const targetRepeats = profile.repetitionTarget || 10;

  // Session elapsed timer
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    onProgressChange?.(repeatCount > 0 && !isCompleted);
  }, [repeatCount, isCompleted, onProgressChange]);

  // Keyboard shortcut: Spacebar repeats only when focus is outside interactive controls.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || event.repeat) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('button, a, input, select, textarea, [contenteditable="true"], [role="button"], [role="link"]')) return;
      event.preventDefault();
      setRepeatCount(count => count + 1);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset revealed words when ayah or mask changes
  useEffect(() => {
    currentAyahIndexRef.current = currentAyahIndex;
  }, [currentAyahIndex]);

  useEffect(() => {
    setSegmentStartIndex(0);
    setSegmentEndIndex(Math.max(0, sessionAyahs.length - 1));
  }, [sessionAyahs.length, surahNumber, startAyah, endAyah]);

  const revokeAllActiveAudioUrls = useCallback(() => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* ignore */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  }, []);

  const handleStopAudio = useCallback(() => {
    playbackRequestSeqRef.current += 1;
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.onplaying = null;
      audioRef.current.pause();
      audioRef.current = null;
      setIsPlaying(false);
      setIsAudioLoading(false);
    }
    segmentAudioQueueRef.current?.stop();
    segmentAudioQueueRef.current = null;
    setIsSegmentPlaying(false);
    setIsSegmentPaused(false);
    setIsCumulativePlaying(false);
    setSegmentProgress(null);
    queueAdvanceRef.current = false;
    playbackIterationRef.current = 1;
    revokeAllActiveAudioUrls();
    globalAudioCoordinator.releaseFocus('session');
  }, [revokeAllActiveAudioUrls]);
  stopAudioRef.current = handleStopAudio;

  useEffect(() => {
    const unregisterAudio = globalAudioCoordinator.register('session', () => stopAudioRef.current());
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
      segmentAudioQueueRef.current?.setPlaybackRate(prefs.playbackRate);
      setAudioRepeatCount(prefs.repeatCount);
      repeatTargetRef.current = prefs.repeatCount === -1 ? null : prefs.repeatCount;
      segmentAudioQueueRef.current?.setAyahRepeatCount(normalizeAyahSegmentRepeatCount(prefs.repeatCount));
      setSegmentRepeatCount(prefs.segmentRepeatCount);
      segmentAudioQueueRef.current?.setRepeatCount(prefs.segmentRepeatCount === -1 ? null : prefs.segmentRepeatCount);
    });
    return () => {
      unregisterAudio();
      unsubscribePrefs();
      globalAudioCoordinator.releaseFocus('session');
    };
  }, []);

  const applySessionRange = useCallback((nextSurah: number, nextStart: number, nextEnd: number) => {
    const meta = ALL_SURAHS[nextSurah - 1] || ALL_SURAHS[66];
    const safeStart = Math.min(Math.max(1, nextStart), meta.versesCount);
    const safeEnd = Math.min(Math.max(safeStart, nextEnd), meta.versesCount);
    handleStopAudio();
    setOutOfRangeNotice(null);
    setMasteryFeedback(null);
    setAwaitingFinalConfirm(false);
    setRevealedWordIndices(new Set());
    setRepeatCount(0);
    setSurahNumber(meta.number);
    setStartAyah(safeStart);
    setEndAyah(safeEnd);
    const restored = loadCumulativeSessionProgress(meta.number, safeStart, safeEnd);
    setCumulativeProgress(restored);
    setCurrentAyahIndex(Math.min(restored.currentIndex, Math.max(0, safeEnd - safeStart)));
    onRangeChange?.(meta.number, safeStart, safeEnd);
  }, [handleStopAudio, onRangeChange]);

  useEffect(() => {
    setRevealedWordIndices(new Set());
    setMasteryFeedback(null);
    setAwaitingFinalConfirm(false);
  }, [currentAyahIndex, maskLevel]);

  const isMaskingDisabled = displayPreferences.viewMode === 'page' && displayPreferences.mushafStyle === 'printed';

  useEffect(() => {
    if (isMaskingDisabled) {
      setMaskLevel(0);
      setRevealedWordIndices(new Set());
    }
  }, [isMaskingDisabled]);

  // Progressive masking cue when cumulative_linking method is active (works in both connected & focused views)
  useEffect(() => {
    if (studyMethod !== 'cumulative_linking' || isMaskingDisabled) return;
    if (repeatCount >= targetRepeats && maskLevel < 3) {
      setMaskLevel(3);
    } else if (repeatCount >= Math.max(2, Math.ceil(targetRepeats * 0.7)) && maskLevel < 2) {
      setMaskLevel(2);
    } else if (repeatCount >= Math.max(1, Math.ceil(targetRepeats * 0.4)) && maskLevel < 1) {
      setMaskLevel(1);
    }
  }, [studyMethod, isMaskingDisabled, repeatCount, targetRepeats, maskLevel]);

  useEffect(() => {
    setRepeatCount(0);
    if (queueAdvanceRef.current) {
      queueAdvanceRef.current = false;
      return;
    }
    handleStopAudio();
  }, [currentAyahIndex, handleStopAudio]);

  // Audio Playback (Local-First from Offline Audio Library with Network Fallback)
  const handleToggleAudio = async () => {
    if (!currentAyah) return;
    segmentAudioQueueRef.current?.stop();
    segmentAudioQueueRef.current = null;
    setIsSegmentPlaying(false);
    setIsSegmentPaused(false);
    setIsCumulativePlaying(false);

    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
      playbackIterationRef.current = 1;
      setIsPlaying(false);
      setIsAudioLoading(false);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('session');
      return;
    }

    globalAudioCoordinator.claimFocus('session');
    const requestSeq = ++playbackRequestSeqRef.current;
    const audioDescriptor = getLicensedAyahAudioUrl(surahNumber, currentAyah.numberInSurah, activeReciter);
    const approvedReciterId = audioDescriptor.approvedReciterId;
    const globalAyah = computeGlobalAyahNumber(surahNumber, currentAyah.numberInSurah);
    const fallbackUrl = audioDescriptor.url;
    const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
      approvedReciterId,
      globalAyah,
      fallbackUrl
    );
    if (requestSeq !== playbackRequestSeqRef.current) {
      resolved.revoke?.();
      return;
    }
    if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);

    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
    }

    const audio = new Audio(resolved.src);
    audio.playbackRate = getSavedPlaybackRate();
    audio.preload = 'auto';
    audioRef.current = audio;
    playbackIterationRef.current = 1;
    setIsPlaying(true);
    setIsAudioLoading(true);

    audio.onplaying = () => {
      if (audioRef.current === audio) setIsAudioLoading(false);
    };
    const resetFailedPlayback = () => {
      // Use request sequence as source of truth: late mobile media errors must
      // clear the active request, but stale errors must not stop newer playback.
      if (requestSeq !== playbackRequestSeqRef.current) return;
      if (audioRef.current === audio) audioRef.current = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      playbackIterationRef.current = 1;
      setIsPlaying(false);
      setIsAudioLoading(false);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('session');
    };

    audio.onerror = () => {
      console.warn('Audio playback failed to load', audio.error);
      resetFailedPlayback();
    };

    audio.play().catch(error => {
      console.warn('Audio playback error', error);
      resetFailedPlayback();
    });

    attachAyahRepeatHandler(
      audio,
      playbackIterationRef,
      repeatTargetRef,
      () => setRepeatCount(count => count + 1),
      () => {
        if (audioRef.current !== audio) return;
        audio.onended = null;
        audioRef.current = null;
        setIsPlaying(false);
        setIsAudioLoading(false);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('session');
        setCumulativeProgress(prev => recordListeningProgress(prev, currentAyahIndexRef.current, false));
      },
      () => {
        if (audioRef.current !== audio) return;
        audio.onended = null;
        audioRef.current = null;
        playbackIterationRef.current = 1;
        setIsPlaying(false);
        setIsAudioLoading(false);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('session');
      }
    );
  };

  const startRangeQueuePlayback = async (
    startIdx: number,
    endIdx: number,
    options: { cumulativeMode: boolean; returnToIndex?: number }
  ) => {
    if (!sessionAyahs.length || startIdx > endIdx) return;
    handleStopAudio();
    globalAudioCoordinator.claimFocus('session');
    const requestSeq = ++playbackRequestSeqRef.current;
    const tracks = await Promise.all(
      sessionAyahs.map(async ayah => {
        const audioDescriptor = getLicensedAyahAudioUrl(surahNumber, ayah.numberInSurah, activeReciter);
        const globalAyah = computeGlobalAyahNumber(surahNumber, ayah.numberInSurah);
        const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
          audioDescriptor.approvedReciterId,
          globalAyah,
          audioDescriptor.url
        );
        if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);
        return { id: String(ayah.number), url: resolved.src };
      })
    );

    if (requestSeq !== playbackRequestSeqRef.current) {
      revokeAllActiveAudioUrls();
      return;
    }

    const controller = new QuranAudioQueueController({
      onTrackChange: (index, cycle, ayahIteration) => {
        if (index !== currentAyahIndexRef.current) {
          queueAdvanceRef.current = true;
          currentAyahIndexRef.current = index;
          setCurrentAyahIndex(index);
        }
        setSegmentProgress({
          ayahNumber: sessionAyahs[index]?.numberInSurah ?? 1,
          cycle,
          ayahIteration
        });
      },
      onPlaying: () => {
        setIsSegmentPlaying(true);
        setIsSegmentPaused(false);
        setIsCumulativePlaying(options.cumulativeMode);
      },
      onPaused: () => {
        setIsSegmentPlaying(false);
        setIsSegmentPaused(true);
      },
      onComplete: () => {
        if (segmentAudioQueueRef.current !== controller) return;
        segmentAudioQueueRef.current = null;
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsCumulativePlaying(false);
        setSegmentProgress(null);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('session');
        if (options.cumulativeMode && typeof options.returnToIndex === 'number') {
          // Audio playback records listening/cumulative-bridge familiarity ONLY;
          // mastery requires explicit recall verification + confirmation.
          const targetIdx = options.returnToIndex;
          setCumulativeProgress(prev => recordListeningProgress(prev, targetIdx, true));
          queueAdvanceRef.current = true;
          currentAyahIndexRef.current = targetIdx;
          setCurrentAyahIndex(targetIdx);
        }
      },
      onError: error => {
        console.warn('[WIRD Session] Segment audio queue failed:', error);
        if (segmentAudioQueueRef.current !== controller) return;
        segmentAudioQueueRef.current = null;
        setIsSegmentPlaying(false);
        setIsSegmentPaused(false);
        setIsCumulativePlaying(false);
        setSegmentProgress(null);
        revokeAllActiveAudioUrls();
        globalAudioCoordinator.releaseFocus('session');
      }
    });
    segmentAudioQueueRef.current = controller;
    try {
      controller.start({
        tracks,
        startIndex: startIdx,
        endIndex: endIdx,
        ayahRepeatCount: options.cumulativeMode ? 1 : normalizeAyahSegmentRepeatCount(audioRepeatCount),
        repeatCount: options.cumulativeMode ? 1 : (segmentRepeatCount === -1 ? null : segmentRepeatCount),
        playbackRate: getSavedPlaybackRate()
      });
      setIsSegmentPlaying(true);
      setIsSegmentPaused(false);
      setIsCumulativePlaying(options.cumulativeMode);
    } catch (error) {
      controller.stop();
      segmentAudioQueueRef.current = null;
      setIsSegmentPlaying(false);
      setIsSegmentPaused(false);
      setIsCumulativePlaying(false);
      setSegmentProgress(null);
      revokeAllActiveAudioUrls();
      globalAudioCoordinator.releaseFocus('session');
      console.warn('[WIRD Session] Could not start segment audio:', error);
    }
  };

  const handleToggleSegmentAudio = () => {
    const activeQueue = segmentAudioQueueRef.current;
    if (activeQueue?.getState().active && !isCumulativePlaying) {
      if (activeQueue.getState().paused) {
        globalAudioCoordinator.claimFocus('session');
        activeQueue.resume();
        setIsSegmentPaused(false);
      } else {
        activeQueue.pause();
        globalAudioCoordinator.releaseFocus('session');
      }
      return;
    }
    void startRangeQueuePlayback(segmentStartIndex, segmentEndIndex, { cumulativeMode: false });
  };

  const cumulativeStartIndex = useMemo(
    () => (
      cumulativeProgress.windowMode === 'last_n'
        ? Math.max(0, currentAyahIndex - cumulativeProgress.windowSize + 1)
        : 0
    ),
    [cumulativeProgress.windowMode, cumulativeProgress.windowSize, currentAyahIndex]
  );

  const handleCumulativeLinkPlayback = () => {
    if (isCumulativePlaying) {
      handleStopAudio();
      return;
    }
    void startRangeQueuePlayback(cumulativeStartIndex, currentAyahIndex, {
      cumulativeMode: true,
      returnToIndex: currentAyahIndex
    });
  };

  const handleVerifyRecallForCurrentAyah = () => {
    setMasteryFeedback(null);
    setCumulativeProgress(prev => recordRecallVerification(prev, currentAyahIndex));
  };

  const handleConfirmCurrentAyahMastery = () => {
    const outcome = confirmAyahMastery(cumulativeProgress, currentAyahIndex);
    if (!outcome.confirmed) {
      setMasteryFeedback(outcome.reasonAr || 'تحقق من الاسترجاع بدون نظر أولاً قبل تثبيت الإتقان.');
      return;
    }
    setMasteryFeedback(null);
    setCumulativeProgress(outcome.state);
    if (currentAyahIndex < sessionAyahs.length - 1) {
      handleStopAudio();
      setCurrentAyahIndex(prev => prev + 1);
    }
  };

  const handleCaptureWeakVerse = async () => {
    if (!currentAyah || !onAddVerseToRevision || weakCaptureInFlightRef.current || isCapturingWeakVerse) return;
    const ayahKey = `${surahNumber}:${currentAyah.numberInSurah}`;
    const mutationId = weakCaptureMutationIdsRef.current.get(ayahKey) || `weak-${createSecureId()}`;
    weakCaptureMutationIdsRef.current.set(ayahKey, mutationId);
    weakCaptureInFlightRef.current = true;
    setIsCapturingWeakVerse(true);
    let saved = false;
    try {
      saved = await onAddVerseToRevision(
        surahNumber,
        surahMeta.name,
        currentAyah.numberInSurah,
        currentAyah.text,
        `توثيق تعثر أثناء ${mode === 'review' ? 'المراجعة' : 'جلسة الحفظ'}`,
        mutationId
      );
    } catch (error) {
      console.error('[WIRD Session] Weak verse capture failed:', error);
    } finally {
      weakCaptureInFlightRef.current = false;
      setIsCapturingWeakVerse(false);
    }
    if (saved) {
      weakCaptureMutationIdsRef.current.delete(ayahKey);
      setWeakMarkedAyahs(prev => new Set(prev).add(ayahKey));
      onToast?.(`تم توثيق الآية ${currentAyah.numberInSurah} في مركز المراجعة العاجلة دون تعطيل جلستك.`, 'success');
    }
    setWeakCaptureFeedback({
      ayahKey,
      success: saved,
      message: saved
        ? `تم توثيق الآية ${currentAyah.numberInSurah} في المراجعة العاجلة مع استمرار جلستك.`
        : 'تعذر حفظ الآية المتعثرة الآن؛ أعد المحاولة بعد التأكد من التخزين.'
    });
  };

  useEffect(() => () => {
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    segmentAudioQueueRef.current?.stop();
    segmentAudioQueueRef.current = null;
    revokeAllActiveAudioUrls();
  }, [revokeAllActiveAudioUrls]);

  const handleExit = () => {
    handleStopAudio();
    onExit();
  };

  // Word Masking Logic
  const [displayWords, setDisplayWords] = useState<string[]>([]);
  const [displayTextError, setDisplayTextError] = useState(false);
  useEffect(() => {
    let active = true;
    if (!currentAyah) { setDisplayWords([]); setDisplayTextError(false); return () => { active = false; }; }
    setDisplayWords([]);
    setDisplayTextError(false);
    loadSimpleAyahText(currentAyah.surahNumber, currentAyah.numberInSurah)
      .then(text => {
        if (!active) return;
        if (!text) {
          setDisplayTextError(true);
          return;
        }
        const normalizedInput = text.trim().replace(/\s+/g, ' ');
        const tokenized = getAyahWords(normalizedInput);
        if (tokenized.length === 0 || tokenized.join(' ') !== normalizedInput) {
          console.error('[WIRD Memorization] Ayah tokenization mismatch detected:', currentAyah.surahNumber, currentAyah.numberInSurah);
          setDisplayTextError(true);
          return;
        }
        setDisplayWords(tokenized);
      })
      .catch(error => {
        console.error('[WIRD Memorization] Could not load local Tanzil Simple text:', error);
        if (active) setDisplayTextError(true);
      });
    return () => { active = false; };
  }, [currentAyah?.surahNumber, currentAyah?.numberInSurah, currentAyah?.text]);
  const words = displayWords;
  
  const isWordMasked = (index: number) => {
    if (maskLevel === 0) return false;
    if (revealedWordIndices.has(index)) return false;
    if (maskLevel === 3) return true; // all hidden
    if (maskLevel === 2) return index % 2 === 0; // 50-60% hidden
    if (maskLevel === 1) return index % 3 === 0; // 33% hidden
    return false;
  };

  const handleToggleWordReveal = (index: number) => {
    setRevealedWordIndices(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const finalizeSessionCompletion = async () => {
    handleStopAudio();
    if (completionInProgressRef.current) return;
    completionInProgressRef.current = true;
    const minutesSpent = Math.max(1, Math.round(secondsElapsed / 60));
    try {
      const saved = await onCompleteSession(
        mode === 'memorize' ? sessionAyahs.length : 0,
        mode === 'review' ? Math.max(1, new Set(sessionAyahs.map(ayah => ayah.page)).size) : 0,
        minutesSpent,
        `${mode === 'review' ? 'مراجعة' : 'إتمام حفظ'} سورة ${surahMeta.name} الآيات (${sessionAyahs[0]?.numberInSurah}-${sessionAyahs[sessionAyahs.length - 1]?.numberInSurah})`,
        mode
      );
      if (!saved) { completionInProgressRef.current = false; return; }
      handleStopAudio();
      setIsCompleted(true);
    } catch (error) {
      completionInProgressRef.current = false;
      console.error('[WIRD Session] Completion persistence failed:', error);
    }
  };

  // Next / Previous Ayah (Semantic RTL: Next is on Left, Prev is on Right)
  const handleNextAyah = async () => {
    if (currentAyahIndex < sessionAyahs.length - 1) {
      handleStopAudio();
      setCurrentAyahIndex(prev => prev + 1);
      return;
    }
    if (studyMethod === 'cumulative_linking' && !cumulativeProgress.finalSegmentConfirmed) {
      setAwaitingFinalConfirm(true);
      return;
    }
    await finalizeSessionCompletion();
  };

  const handlePrevAyah = () => {
    if (currentAyahIndex > 0) {
      handleStopAudio();
      setCurrentAyahIndex(prev => prev - 1);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handlePrintedAyahsResolved = useCallback(({ ayahs }: { page: number; ayahs: Ayah[] }) => {
    if (!currentAyah) return;
    const hasCurrent = ayahs.some(item => item.surahNumber === currentAyah.surahNumber && item.numberInSurah === currentAyah.numberInSurah);
    if (!hasCurrent && ayahs.length > 0 && printedPage === currentAyah.page) {
      const first = ayahs[0];
      if (first.surahNumber === currentAyah.surahNumber) {
        if (currentAyah.numberInSurah < first.numberInSurah && printedPage > 1) {
          setPrintedPage(printedPage - 1);
        } else if (currentAyah.numberInSurah > ayahs[ayahs.length - 1].numberInSurah && printedPage < 604) {
          setPrintedPage(printedPage + 1);
        }
      }
    }
  }, [currentAyah, printedPage]);

  const handlePrintedSelectAyah = useCallback((ayah: Ayah) => {
    const matchIndex = sessionAyahs.findIndex(
      item => item.surahNumber === ayah.surahNumber && item.numberInSurah === ayah.numberInSurah
    );
    if (matchIndex === -1) {
      const firstNum = sessionAyahs[0]?.numberInSurah ?? startAyah;
      const lastNum = sessionAyahs[sessionAyahs.length - 1]?.numberInSurah ?? endAyah;
      setOutOfRangeNotice(`الآية ${ayah.numberInSurah} خارج نطاق جلسة الحفظ الحالية (من آية ${firstNum} إلى آية ${lastNum}).`);
      return;
    }
    setOutOfRangeNotice(null);
    if (matchIndex !== currentAyahIndex) {
      handleStopAudio();
      setCurrentAyahIndex(matchIndex);
    }
  }, [sessionAyahs, currentAyahIndex, startAyah, endAyah, handleStopAudio]);

  const handlePrintedFallback = useCallback(() => {
    updateDisplayPreferences({ mushafStyle: 'connected' });
  }, [updateDisplayPreferences]);

  const handleMaskLevelChange = useCallback((nextLevel: number) => {
    if (isMaskingDisabled && nextLevel > 0) return;
    setMaskLevel(nextLevel);
  }, [isMaskingDisabled]);

  if (isLoadingAyahs) {
    return (
      <div className="wird-card rounded-3xl p-8 text-center space-y-3 max-w-lg mx-auto shadow-sm">
        <BookOpen className="w-8 h-8 mx-auto text-[#1C4E46] dark:text-[#E0A96D] animate-pulse" />
        <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">جارٍ تحميل سورة {surahMeta.name}...</p>
        <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">يتم تحميل نص السورة المطلوبة فقط.</p>
      </div>
    );
  }

  if (!currentAyah) {
    const isInvalidRange = allSurahAyahs.length > 0 && sessionAyahs.length === 0;
    return (
      <div className="wird-card rounded-3xl p-8 text-center space-y-5 max-w-lg mx-auto shadow-sm">
        <div className="w-14 h-14 rounded-2xl bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#9A7415] dark:text-[#E0A96D] flex items-center justify-center mx-auto border border-[#C59B27]/35 dark:border-[#E0A96D]/30">
          <BookOpen className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <span className="text-[11px] font-bold text-[#9A7415] dark:text-[#E0A96D] tracking-wider">
            {isInvalidRange ? 'نطاق الآيات غير صالح' : 'تعذر تحميل النص القرآني'}
          </span>
          <h3 className="font-bold text-[#142421] dark:text-[#F5F1E8] text-lg">
            سورة {surahMeta.name} ({surahMeta.versesCount} آية)
          </h3>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed max-w-md mx-auto">
            {isInvalidRange
              ? `النطاق المحدد (من آية ${startAyah} إلى آية ${endAyah}) خارج حدود آيات سورة ${surahMeta.name}. اختر جلسة صحيحة للمتابعة.`
              : 'تعذر تحميل النص القرآني العثماني لهذه السورة من الملفات المحلية. تحقق من سلامة ملفات التطبيق ثم أعد المحاولة؛ لم يتم استبدال النص بأي مصدر غير موثوق.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            onClick={() => setLoadRetry(value => value + 1)}
            className="w-full sm:w-auto min-h-11 px-5 py-2.5 bg-[#C59B27] text-[#0B132B] rounded-xl text-xs font-bold shadow-xs hover:bg-[#d8ae37] transition-colors"
          >
            إعادة تحميل النص
          </button>
          <button
            onClick={() => applySessionRange(67, 1, 10)}
            className="w-full sm:w-auto min-h-11 px-5 py-2.5 bg-[#1C4E46] dark:bg-[#1E4A47] text-white rounded-xl text-xs font-bold shadow-xs hover:bg-[#143D36] transition-colors"
          >
            جلسة سورة الملك (الآيات 1-10)
          </button>
          <button
            onClick={() => applySessionRange(1, 1, 7)}
            className="w-full sm:w-auto min-h-11 px-5 py-2.5 bg-[#F2EDE2] hover:bg-[#E6DFCE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 rounded-xl text-xs font-semibold transition-colors"
          >
            سورة الفاتحة (كاملة)
          </button>
        </div>
      </div>
    );
  }

  // Completion Celebration View
  if (isCompleted) {
    return (
      <div className="wird-card rounded-3xl p-8 text-center space-y-6 max-w-xl mx-auto shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#9A7415] dark:text-[#E0A96D] flex items-center justify-center mx-auto shadow-inner border border-[#C59B27]/35 dark:border-[#E0A96D]/30">
          <Award className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] uppercase tracking-wider">
            {mode === 'review' ? 'مبارك إتمام المراجعة' : 'مبارك الإنجاز القرآني'}
          </span>
          <h2 className="text-2xl font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
            {mode === 'review' ? 'أتممت جلسة المراجعة بنجاح!' : 'أتممت وِرد الحفظ اليومي بنجاح!'}
          </h2>
          <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] max-w-sm mx-auto leading-relaxed">
            {mode === 'review' ? `تمت مراجعة الآيات المحددة من سورة ${surahMeta.name}.` : `تم حفظ وتكرار وتثبيت الآيات المقررة لسورة ${surahMeta.name}. ثبّت الله القرآن في قلبك ونفعك به في الدنيا والآخرة.`}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3 p-4 bg-[#F9F6EE] dark:bg-[#0B132B]/70 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-xs">
          <div>
            <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">{mode === 'review' ? 'الآيات المراجعة' : 'الآيات المحفوظة'}</div>
            <div className="text-lg font-bold text-[#1C4E46] dark:text-[#E0A96D] font-mono tabular-nums">
              {sessionAyahs.length}
            </div>
          </div>
          <div>
            <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">زمن الجلسة</div>
            <div className="text-lg font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
              {formatTime(secondsElapsed)}
            </div>
          </div>
          <div>
            <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">سلسلة المواظبة</div>
            <div className="text-lg font-bold text-[#C59B27] dark:text-[#E0A96D] font-mono tabular-nums flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-[#C59B27] dark:fill-[#E0A96D]" />
              <span>{profile.streakDays} يوم</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => {
              completionInProgressRef.current = false;
              setIsCompleted(false);
              setCurrentAyahIndex(0);
              setSecondsElapsed(0);
            }}
            className="min-h-11 px-4 py-2.5 bg-[#F2EDE2] hover:bg-[#E6DFCE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 rounded-xl text-xs font-semibold"
          >
            {mode === 'review' ? 'إعادة المراجعة' : 'تكرار الجلسة للتثبيت'}
          </button>

          <button
            onClick={handleExit}
            className="min-h-11 px-6 py-2.5 bg-[#1C4E46] dark:bg-[#1E4A47] hover:bg-[#143D36] text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
          >
            العودة للرئيسية
          </button>
        </div>
      </div>
    );
  }

  const formatRepeatBadge = (count: AudioRepeatCount, continuousLabel: string) => {
    if (count === -1) return continuousLabel;
    if (count === 1) return 'مرة';
    if (count === 2) return 'مرتين';
    return `${count} مرات`;
  };

  const renderMaskedWords = () => (
    <>
      {displayTextError ? (
        <span role="alert" className="text-sm text-rose-700 dark:text-rose-300">
          تعذر تحميل النص الإملائي المعتمد لهذه الآية؛ أعد المحاولة قبل متابعة التسميع.
        </span>
      ) : words.length === 0 ? <span role="status" className="text-sm text-[#5B6F6B] dark:text-[#8B9E9B]">جارٍ تجهيز نص الآية للتسميع...</span> : (
        words.map((word, idx) => {
          const masked = isWordMasked(idx);
          if (masked) {
            const baseCharCount = word.replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u06DE\u06E9\s]/g, '').length;
            const dotCount = Math.min(5, Math.max(2, Math.round(baseCharCount / 2)));
            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleToggleWordReveal(idx)}
                aria-label={`إظهار الكلمة رقم ${idx + 1}`}
                className="min-h-11 px-3 py-0.5 inline-flex items-center justify-center rounded-lg select-none bg-[#E6DFCE] dark:bg-[#162744] text-[#9A7415]/80 dark:text-[#E0A96D]/80 cursor-pointer active:scale-95 border border-dashed border-[#C59B27]/70 dark:border-[#E0A96D]/50 text-[0.7em] tracking-widest transition-colors"
                title="اضغط لإظهار الكلمة للتسميع"
              >
                <span aria-hidden="true">{'•'.repeat(dotCount)}</span>
              </button>
            );
          }
          return (
            <span key={idx} className="inline-block px-2 py-0.5 select-none">
              {word}
            </span>
          );
        })
      )}
    </>
  );

  const activePrintedPageIdx = sessionPages.indexOf(printedPage);

  return (
    <div
      data-session-page-width={displayPreferences.pageWidth}
      className={`w-full mx-auto space-y-5 ${SESSION_PAGE_WIDTH_CLASSES[displayPreferences.pageWidth]}`}
    >
      {/* 1. Streamlined Session Progress Bar & Unified Settings Drawer */}
      <header className="wird-card rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={handleExit}
            className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 px-3 py-2 text-xs font-bold text-[#142421] hover:border-[#C59B27] dark:text-[#F5F1E8] transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D]" />
            <span>خروج من الجلسة</span>
          </button>

          <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 min-w-0 text-xs">
            <span className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8] font-quran">
              سورة {surahMeta.name}
            </span>
            <span aria-hidden="true" className="text-[#5B6F6B]/50 dark:text-[#8B9E9B]/50">·</span>
            <span aria-live="polite" className="text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums font-semibold">
              الآية {currentAyah.numberInSurah} (نطاق {startAyah}–{endAyah})
            </span>
            <span aria-hidden="true" className="text-[#5B6F6B]/50 dark:text-[#8B9E9B]/50">·</span>
            <span className="font-mono tabular-nums font-bold text-[#1C4E46] dark:text-[#E0A96D]">
              {formatTime(secondsElapsed)}
            </span>
            <button
              type="button"
              onClick={() => setIsRangeEditorOpen(prev => !prev)}
              aria-expanded={isRangeEditorOpen}
              className={`min-h-9 inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-bold transition-colors ${
                isRangeEditorOpen
                  ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#1C4E46] dark:text-[#E0A96D] border-[#1C4E46]/15 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
              }`}
            >
              <span>تغيير النطاق</span>
              {isRangeEditorOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          <button
            ref={settingsToggleRef}
            type="button"
            onClick={() => setSettingsOpenPersist(prev => !prev)}
            aria-expanded={isSettingsOpen}
            aria-controls={settingsPanelId}
            className={`min-h-11 inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
              isSettingsOpen
                ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D]'
                : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 shrink-0" />
            <span>إعدادات العرض والصوت</span>
            <span className={`hidden sm:inline text-[10px] font-mono tabular-nums ${
              isSettingsOpen ? 'text-[#F5F1E8]/85' : 'text-[#5B6F6B] dark:text-[#8B9E9B]'
            }`}>
              {displayPreferences.uiScale}% · {displayPreferences.fontSize}px
            </span>
            {isSettingsOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isRangeEditorOpen && (
          <div
            role="region"
            aria-label="نطاق السورة والآيات في الجلسة"
            className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 bg-[#F9F6EE] dark:bg-[#0B132B]/70 p-3 text-xs"
          >
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">السورة</span>
              <select
                aria-label="اختيار سورة جلسة الحفظ"
                value={surahNumber}
                onChange={event => {
                  const nextSurahNum = Number(event.target.value);
                  const nextMeta = ALL_SURAHS[nextSurahNum - 1];
                  if (nextMeta) applySessionRange(nextMeta.number, 1, nextMeta.versesCount);
                }}
                className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              >
                {ALL_SURAHS.map(s => (
                  <option key={s.number} value={s.number}>
                    {s.number}. سورة {s.name} ({s.versesCount} آية)
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1">
              <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">من آية</span>
              <select
                aria-label="بداية نطاق الجلسة من الآية"
                value={startAyah}
                onChange={event => {
                  const nextStart = Number(event.target.value);
                  applySessionRange(surahNumber, nextStart, Math.max(nextStart, endAyah));
                }}
                className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              >
                {Array.from({ length: surahMeta.versesCount }, (_, i) => i + 1).map(num => (
                  <option key={num} value={num}>آية {num}</option>
                ))}
              </select>
            </label>

            <div className="flex items-end gap-2">
              <label className="flex flex-col gap-1 flex-1">
                <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">إلى آية</span>
                <select
                  aria-label="نهاية نطاق الجلسة إلى الآية"
                  value={endAyah}
                  onChange={event => applySessionRange(surahNumber, startAyah, Number(event.target.value))}
                  className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                >
                  {Array.from({ length: surahMeta.versesCount - startAyah + 1 }, (_, i) => startAyah + i).map(num => (
                    <option key={num} value={num}>آية {num}</option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => applySessionRange(surahNumber, 1, surahMeta.versesCount)}
                className="min-h-11 px-3 rounded-xl border border-[#C59B27]/40 dark:border-[#E0A96D]/35 bg-[#C59B27]/12 dark:bg-[#E0A96D]/12 text-[#9A7415] dark:text-[#E0A96D] text-[11px] font-bold whitespace-nowrap hover:bg-[#C59B27]/20 transition-colors"
                title="تحديد كامل آيات السورة"
              >
                كاملة
              </button>
            </div>
          </div>
        )}

        <div
          role="progressbar"
          aria-label="تقدم جلسة الحفظ"
          aria-valuemin={0}
          aria-valuemax={sessionAyahs.length}
          aria-valuenow={currentAyahIndex + 1}
          aria-valuetext={`الآية ${currentAyah.numberInSurah} من ${sessionAyahs.length}`}
          className="h-1.5 w-full overflow-hidden rounded-full bg-[#1C4E46]/12 dark:bg-[#162744]"
        >
          <div
            className="h-full rounded-full bg-[#1C4E46] dark:bg-[#E0A96D] transition-all duration-300"
            style={{ width: `${((currentAyahIndex + 1) / Math.max(1, sessionAyahs.length)) * 100}%` }}
          />
        </div>

        {isSettingsOpen && (
          <div
            id={settingsPanelId}
            className="border-t border-[#1C4E46]/12 dark:border-[#E0A96D]/18 pt-4 mt-1 grid grid-cols-1 lg:grid-cols-2 gap-6"
          >
            {/* Column 1: Display & Mushaf Controls */}
            <section aria-label="إعدادات عرض جلسة الحفظ" className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                <h3 className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                  إعدادات العرض والمصحف
                </h3>
                <button
                  type="button"
                  onClick={() => setDisplayPreferences({ ...DEFAULT_MEMORIZATION_DISPLAY_PREFERENCES })}
                  className="min-h-11 inline-flex items-center gap-1.5 rounded-lg border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 py-1.5 text-[11px] font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة ضبط العرض</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="session-ui-scale" className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
                      حجم واجهة الجلسة
                    </label>
                    <output htmlFor="session-ui-scale" aria-live="polite" className="text-xs font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">
                      {displayPreferences.uiScale}%
                    </output>
                  </div>
                  <input
                    id="session-ui-scale"
                    aria-label="حجم واجهة جلسة الحفظ"
                    type="range"
                    min={80}
                    max={110}
                    step={5}
                    value={displayPreferences.uiScale}
                    aria-valuetext={`${displayPreferences.uiScale}%`}
                    onChange={event => updateDisplayPreferences({ uiScale: Number(event.target.value) })}
                    className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="session-ayah-font-size" className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">
                      حجم خط الآيات
                    </label>
                    <output htmlFor="session-ayah-font-size" aria-live="polite" className="text-xs font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">
                      {displayPreferences.fontSize}px
                    </output>
                  </div>
                  <input
                    id="session-ayah-font-size"
                    aria-label="حجم خط الآيات"
                    type="range"
                    min={20}
                    max={44}
                    step={2}
                    value={displayPreferences.fontSize}
                    aria-valuetext={`${displayPreferences.fontSize} بكسل`}
                    onChange={event => updateDisplayPreferences({ fontSize: Number(event.target.value) })}
                    className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">عرض الآيات</span>
                  <div role="group" aria-label="طريقة عرض الآيات" className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      aria-pressed={displayPreferences.viewMode === 'focused'}
                      onClick={() => updateDisplayPreferences({ viewMode: 'focused' })}
                      className={`min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                        displayPreferences.viewMode === 'focused'
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                          : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                      }`}
                    >
                      آية واحدة
                    </button>
                    <button
                      type="button"
                      aria-pressed={displayPreferences.viewMode === 'page'}
                      onClick={() => updateDisplayPreferences({ viewMode: 'page' })}
                      className={`min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                        displayPreferences.viewMode === 'page'
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                          : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                      }`}
                    >
                      كل آيات الجلسة
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="block text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">المسافات والسطور</span>
                  <div role="group" aria-label="كثافة عرض العناصر" className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      aria-pressed={displayPreferences.density === 'comfortable'}
                      onClick={() => updateDisplayPreferences({ density: 'comfortable' })}
                      className={`min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                        displayPreferences.density === 'comfortable'
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                          : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                      }`}
                    >
                      مريحة
                    </button>
                    <button
                      type="button"
                      aria-pressed={displayPreferences.density === 'compact'}
                      onClick={() => updateDisplayPreferences({ density: 'compact' })}
                      className={`min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                        displayPreferences.density === 'compact'
                          ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                          : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                      }`}
                    >
                      مضغوطة
                    </button>
                  </div>
                </div>

                {displayPreferences.viewMode === 'page' && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <span className="block text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">نمط المصحف عند عرض كل الآيات</span>
                    <div role="group" aria-label="نمط المصحف في الجلسة" className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-pressed={displayPreferences.mushafStyle === 'connected'}
                        onClick={() => updateDisplayPreferences({ mushafStyle: 'connected' })}
                        className={`min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          displayPreferences.mushafStyle === 'connected'
                            ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                            : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                        }`}
                      >
                        <BookText className="w-3.5 h-3.5 shrink-0" />
                        <span>صفحة مصحف متصلة</span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={displayPreferences.mushafStyle === 'printed'}
                        onClick={() => {
                          setMaskLevel(0);
                          updateDisplayPreferences({ mushafStyle: 'printed' });
                        }}
                        className={`min-h-11 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-colors ${
                          displayPreferences.mushafStyle === 'printed'
                            ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                            : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                        }`}
                      >
                        <FileImage className="w-3.5 h-3.5 shrink-0" />
                        <span>المصحف المطبوع بالرسم</span>
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5 sm:col-span-2">
                  <span className="block text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">اتساع مساحة الصفحة</span>
                  <div role="group" aria-label="عرض مساحة صفحة الحفظ" className="grid grid-cols-3 gap-1.5">
                    {([
                      { value: 'comfortable', label: 'قياسية' },
                      { value: 'wide', label: 'واسعة' },
                      { value: 'full', label: 'ملء العرض' }
                    ] as const).map(option => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={displayPreferences.pageWidth === option.value}
                        onClick={() => updateDisplayPreferences({ pageWidth: option.value })}
                        className={`min-h-11 px-2.5 py-2 rounded-xl text-xs font-bold border transition-colors whitespace-nowrap ${
                          displayPreferences.pageWidth === option.value
                            ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                            : 'bg-[#F2EDE2] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                تُحفظ إعدادات العرض على هذا الجهاز فقط دون مزامنة مع تقدم الحفظ.
              </p>
            </section>

            {/* Column 2: Audio & Segment Repetition Controls */}
            <section aria-label="إعدادات الصوت والمقطع الصوتي" className="space-y-4">
              <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                <h3 className="text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                  إعدادات الصوت والمقطع
                </h3>
                {sessionAyahs[segmentStartIndex] && sessionAyahs[segmentEndIndex] && (
                  <span className="text-[11px] font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">
                    المقطع: من آية {sessionAyahs[segmentStartIndex].numberInSurah} إلى آية {sessionAyahs[segmentEndIndex].numberInSurah}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <label className="flex flex-col gap-1 text-xs text-[#5B6F6B] dark:text-[#8B9E9B] sm:col-span-2">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">القارئ المعتمد</span>
                  <select
                    aria-label="اختيار القارئ في الجلسة"
                    value={activeReciter}
                    onChange={event => handleReciterChange(event.target.value as ReciterId)}
                    className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                  >
                    {RECITERS.map(reciter => (
                      <option key={reciter.id} value={reciter.id}>{reciter.name}</option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-col justify-end">
                  <AudioPlaybackRateControl value={playbackRate} onChange={handlePlaybackRateChange} />
                </div>

                <label className="flex flex-col gap-1 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">تكرار الآية الواحدة</span>
                  <select
                    aria-label="عدد مرات تكرار الصوت"
                    value={audioRepeatCount}
                    onChange={event => handleAudioRepeatCountChange(Number(event.target.value) as AudioRepeatCount)}
                    className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                  >
                    <option value={1}>مرة واحدة</option>
                    <option value={2}>مرتان</option>
                    <option value={3}>3 مرات</option>
                    <option value={5}>5 مرات</option>
                    <option value={10}>10 مرات</option>
                    <option value={-1}>حتى الإيقاف</option>
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">بداية المقطع (من آية)</span>
                  <select
                    aria-label="بداية المقطع الصوتي في الجلسة"
                    value={segmentStartIndex}
                    disabled={!sessionAyahs.length}
                    onChange={event => {
                      const next = Number(event.target.value);
                      setSegmentStartIndex(next);
                      if (segmentEndIndex < next) setSegmentEndIndex(next);
                    }}
                    className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                  >
                    {sessionAyahs.map((ayah, index) => (
                      <option key={ayah.number} value={index}>آية {ayah.numberInSurah}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">نهاية المقطع (إلى آية)</span>
                  <select
                    aria-label="نهاية المقطع الصوتي في الجلسة"
                    value={segmentEndIndex}
                    disabled={!sessionAyahs.length}
                    onChange={event => setSegmentEndIndex(Number(event.target.value))}
                    className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                  >
                    {sessionAyahs.slice(segmentStartIndex).map((ayah, offset) => (
                      <option key={ayah.number} value={segmentStartIndex + offset}>آية {ayah.numberInSurah}</option>
                    ))}
                  </select>
                </label>

                <label className="flex flex-col gap-1 text-xs text-[#5B6F6B] dark:text-[#8B9E9B] sm:col-span-2">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">تكرار المقطع الصوتي كاملاً</span>
                  <select
                    aria-label="عدد مرات تكرار المقطع الصوتي"
                    value={segmentRepeatCount}
                    onChange={event => handleSegmentRepeatCountChange(Number(event.target.value) as AudioRepeatCount)}
                    className="min-h-11 w-full rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-3 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
                  >
                    <option value={1}>مرة واحدة</option>
                    <option value={2}>مرتان</option>
                    <option value={3}>3 مرات</option>
                    <option value={5}>5 مرات</option>
                    <option value={10}>10 مرات</option>
                    <option value={-1}>مستمر</option>
                  </select>
                </label>
              </div>
            </section>
          </div>
        )}
      </header>

      {/* 2. Memorization Stage (Content-Only Zoom) + Merged Masking & Counter Toolbar */}
      <div className="space-y-4" style={{ zoom: displayPreferences.uiScale / 100 }}>
        {displayPreferences.viewMode === 'page' ? (
          <section
            aria-label="كل آيات الجلسة"
            className="mushaf-page-frame rounded-3xl bg-[#F9F6EE] dark:bg-[#0B132B] px-4 py-5 sm:px-8 sm:py-7 shadow-md space-y-5"
          >
            {/* Mushaf Header with quick style switch (Connected vs Printed Facsimile) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#C59B27]/35 dark:border-[#E0A96D]/25 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D]">
                  سورة {surahMeta.name}
                </h3>
                <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                  كل آيات الجلسة · من آية {sessionAyahs[0]?.numberInSurah ?? startAyah} إلى آية {sessionAyahs[sessionAyahs.length - 1]?.numberInSurah ?? endAyah} · اضغط على أي آية للانتقال إليها
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {displayPreferences.mushafStyle === 'printed' && sessionPages.length > 1 && (
                  <div className="inline-flex items-center gap-1 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white/80 dark:bg-[#111F36] p-1 text-xs">
                    <button
                      type="button"
                      disabled={activePrintedPageIdx <= 0}
                      onClick={() => activePrintedPageIdx > 0 && setPrintedPage(sessionPages[activePrintedPageIdx - 1])}
                      className="min-h-11 px-2.5 rounded-lg font-bold text-[#142421] dark:text-[#F5F1E8] disabled:opacity-40 hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      aria-label="صفحة المصحف السابقة في الجلسة"
                    >
                      السابقة
                    </button>
                    <span className="px-2 font-mono tabular-nums font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                      ص {printedPage}
                    </span>
                    <button
                      type="button"
                      disabled={activePrintedPageIdx === -1 || activePrintedPageIdx >= sessionPages.length - 1}
                      onClick={() => activePrintedPageIdx < sessionPages.length - 1 && setPrintedPage(sessionPages[activePrintedPageIdx + 1])}
                      className="min-h-11 px-2.5 rounded-lg font-bold text-[#142421] dark:text-[#F5F1E8] disabled:opacity-40 hover:bg-[#F2EDE2] dark:hover:bg-[#162744]"
                      aria-label="صفحة المصحف التالية في الجلسة"
                    >
                      التالية
                    </button>
                  </div>
                )}

                <div role="group" aria-label="تبديل نمط عرض صفحة المصحف" className="wird-segmented-track inline-flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    aria-pressed={displayPreferences.mushafStyle === 'connected'}
                    onClick={() => updateDisplayPreferences({ mushafStyle: 'connected' })}
                    className={`min-h-11 px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                      displayPreferences.mushafStyle === 'connected'
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs'
                        : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                    }`}
                  >
                    صفحة متصلة
                  </button>
                  <button
                    type="button"
                    aria-pressed={displayPreferences.mushafStyle === 'printed'}
                    onClick={() => {
                      setMaskLevel(0);
                      updateDisplayPreferences({ mushafStyle: 'printed' });
                    }}
                    className={`min-h-11 px-3 py-1.5 rounded-xl font-bold transition-colors whitespace-nowrap ${
                      displayPreferences.mushafStyle === 'printed'
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs'
                        : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                    }`}
                  >
                    مصحف مطبوع
                  </button>
                </div>
              </div>
            </div>

            {displayPreferences.mushafStyle === 'printed' ? (
              <div className="space-y-4">
                <PrintedMushafSpread
                  surface="session"
                  anchorPage={printedPage}
                  selectedAyah={currentAyah}
                  onSelectAyah={(ayah: Ayah | null) => {
                    if (ayah) handlePrintedSelectAyah(ayah);
                  }}
                  tafsirAyah={printedTafsirAyah}
                  onTafsirAyahChange={(nextAyah: Ayah | null) => {
                    setPrintedTafsirAyah(nextAyah);
                    if (nextAyah) handlePrintedSelectAyah(nextAyah);
                  }}
                  onAyahsResolved={handlePrintedAyahsResolved}
                  onFallback={handlePrintedFallback}
                />

                {outOfRangeNotice && (
                  <p role="status" className="text-center text-xs font-semibold text-[#9A7415] dark:text-[#E0A96D]">
                    {outOfRangeNotice}
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="surah-header-banner rounded-2xl py-3 px-5 text-white text-center shadow-xs">
                  <div className="flex items-center justify-between text-[11px] text-[#F5F1E8]/90 font-sans-ui border-b border-[#C59B27]/35 pb-1.5 mb-1.5">
                    <span>{surahMeta.revelationType}</span>
                    <span className="font-quran text-xl md:text-2xl font-bold text-[#E0A96D]">سورة {surahMeta.name}</span>
                    <span>الجزء {currentAyah.juz}</span>
                  </div>
                </div>

                {sessionAyahs[0]?.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9 && (
                  <p className="font-quran text-xl md:text-2xl text-[#1C4E46] dark:text-[#E0A96D] text-center py-1">
                    <QuranBasmala surahNumber={surahNumber} />
                  </p>
                )}

                {pageDisplayError ? (
                  <p role="alert" className="px-3 py-5 text-sm text-rose-700 dark:text-rose-300 text-center">
                    تعذر تحميل النص القرآني المعتمد لهذا النطاق؛ لم نعرض نصًا بديلًا. أعد المحاولة أو استخدم عرض الآية الواحدة.
                  </p>
                ) : pageDisplayTexts.length !== sessionAyahs.length ? (
                  <p role="status" className="px-3 py-5 text-sm text-[#5B6F6B] dark:text-[#8B9E9B] text-center">
                    جارٍ تحميل نص الآيات المعتمد...
                  </p>
                ) : (
                  <div
                    dir="rtl"
                    className={`quran-text font-quran text-right text-[#142421] dark:text-[#F5F1E8] max-h-[62vh] overflow-y-auto overscroll-contain px-1 sm:px-3 ${
                      displayPreferences.density === 'compact' ? 'py-1' : 'py-2'
                    }`}
                    style={{
                      fontSize: `${displayPreferences.fontSize}px`,
                      lineHeight: displayPreferences.density === 'compact' ? 1.95 : 2.35
                    }}
                  >
                    {sessionAyahs.map((ayah, index) => {
                      const isActive = index === currentAyahIndex;
                      const isMastered = masteredIndices.has(index);
                      if (isActive && maskLevel > 0) {
                        return (
                          <span
                            key={ayah.numberInSurah}
                            id="active-connected-ayah"
                            className="inline-flex flex-wrap items-center gap-x-2 gap-y-2 rounded-xl bg-[#1C4E46]/10 dark:bg-[#1E4A47]/65 ring-1 ring-[#C59B27]/60 mx-1 px-2.5 py-1 align-baseline"
                          >
                            {renderMaskedWords()}
                            <button
                              ref={activePageAyahRef}
                              type="button"
                              aria-pressed={true}
                              aria-label={`الآية ${ayah.numberInSurah}`}
                              onClick={() => setMaskLevel(0)}
                              title="اضغط لإظهار نص الآية كاملاً"
                              className="ayah-number cursor-pointer"
                            >
                              {ayah.numberInSurah}
                            </button>
                          </span>
                        );
                      }
                      return (
                        <button
                          ref={isActive ? activePageAyahRef : undefined}
                          type="button"
                          key={ayah.numberInSurah}
                          aria-pressed={index === currentAyahIndex}
                          onClick={() => {
                            if (index === currentAyahIndex) return;
                            handleStopAudio();
                            setCurrentAyahIndex(index);
                          }}
                          className={`inline text-right rounded-xl transition-colors cursor-pointer mx-0.5 px-1.5 py-0.5 ${
                            isActive
                              ? 'bg-[#1C4E46]/10 dark:bg-[#1E4A47]/65 ring-1 ring-[#C59B27]/60'
                              : isMastered
                                ? 'bg-[#C59B27]/8 dark:bg-[#E0A96D]/10 hover:bg-[#1C4E46]/8'
                                : 'hover:bg-[#1C4E46]/5 dark:hover:bg-[#162744]/70'
                          }`}
                        >
                          <span>{pageDisplayTexts[index]}</span>
                          <span className="ayah-number">{ayah.numberInSurah}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        ) : (
          /* Single Focused Ayah Studio (only when viewMode === 'focused') */
          <div className={`bg-[#F9F6EE] dark:bg-[#111F36] rounded-3xl ${displayPreferences.density === 'compact' ? 'p-4 md:p-6 space-y-3' : 'p-6 md:p-10 space-y-5'} border border-[#C59B27]/35 dark:border-[#E0A96D]/25 shadow-xs text-center relative`}>
            {currentAyah.numberInSurah === 1 && surahNumber !== 1 && surahNumber !== 9 && (
              <div className="font-quran text-lg text-[#1C4E46] dark:text-[#E0A96D] pb-2 border-b border-[#C59B27]/20">
                <QuranBasmala surahNumber={surahNumber} />
              </div>
            )}

            <div className="min-h-[140px] flex items-center justify-center py-3">
              <p
                className="quran-text font-quran text-[#142421] dark:text-[#F5F1E8] flex flex-wrap items-center justify-center gap-x-3 gap-y-4"
                style={{
                  fontSize: `${displayPreferences.fontSize}px`,
                  lineHeight: displayPreferences.density === 'compact' ? 1.8 : 2.25
                }}
              >
                {renderMaskedWords()}
                <span className="ayah-number">{currentAyah.numberInSurah}</span>
              </p>
            </div>
          </div>
        )}

        {/* Merged Word Masking & Manual Repetition Toolbar directly below Quran text */}
        <div className="wird-card rounded-2xl p-3.5 sm:p-4 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
          {/* Masking Controls (Enabled in both Connected and Focused views; disabled only in Printed facsimile view) */}
          <div className="flex flex-col gap-2 text-xs">
            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2.5">
              <div className="inline-flex items-center gap-1.5 text-[#5B6F6B] dark:text-[#8B9E9B] font-semibold">
                <EyeOff className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D] shrink-0" />
                <span>الإخفاء:</span>
              </div>

              <div
                role="group"
                aria-label="خيارات إخفاء الكلمات للتسميع"
                className={`flex flex-wrap items-center bg-[#F2EDE2] dark:bg-[#0B132B] p-1 rounded-xl border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 gap-1 ${
                  isMaskingDisabled ? 'opacity-65' : ''
                }`}
              >
                {[
                  { level: 0, label: 'إظهار كامل' },
                  { level: 1, label: 'إخفاء 30%' },
                  { level: 2, label: 'إخفاء 60%' },
                  { level: 3, label: 'إخفاء تام' },
                ].map(m => (
                  <button
                    key={m.level}
                    type="button"
                    disabled={isMaskingDisabled}
                    aria-disabled={isMaskingDisabled}
                    aria-pressed={!isMaskingDisabled && maskLevel === m.level}
                    onClick={() => handleMaskLevelChange(m.level)}
                    title={isMaskingDisabled ? 'أوقف وضع المصحف المطبوع لتفعيل الإخفاء التفاعلي على الآية الحالية' : undefined}
                    className={`min-h-11 px-3 py-1.5 rounded-lg font-bold transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed ${
                      !isMaskingDisabled && maskLevel === m.level
                        ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white shadow-xs'
                        : 'text-[#5B6F6B] dark:text-[#8B9E9B] hover:text-[#142421] dark:hover:text-[#F5F1E8]'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            {isMaskingDisabled && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                <span>الإخفاء التفاعلي متاح في العرض المتصل وآية واحدة</span>
                <button
                  type="button"
                  onClick={() => updateDisplayPreferences({ mushafStyle: 'connected' })}
                  className="min-h-11 px-3 py-1.5 rounded-xl border border-[#1C4E46]/25 dark:border-[#E0A96D]/30 bg-white dark:bg-[#111F36] text-[#1C4E46] dark:text-[#E0A96D] font-bold hover:border-[#C59B27] transition-colors whitespace-nowrap"
                >
                  العودة للعرض المتصل
                </button>
              </div>
            )}
          </div>

          <div className="h-px lg:h-8 lg:w-px bg-[#1C4E46]/12 dark:bg-[#E0A96D]/18 shrink-0" aria-hidden="true" />

          {/* Manual Repetition Counter */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
                <h4 className="font-bold text-xs text-[#142421] dark:text-[#F5F1E8]">
                  عدّاد التكرار والتثبيت ({repeatCount} / {targetRepeats})
                </h4>
              </div>
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                اختصار لوحة المفاتيح: مسافة (Space)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setRepeatCount(c => Math.max(0, c - 1))}
                className="min-h-11 min-w-11 rounded-xl bg-[#F2EDE2] hover:bg-[#E6DFCE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] font-bold text-xs flex items-center justify-center border border-[#1C4E46]/12 dark:border-[#E0A96D]/20"
                title="إنقاص مرة واحدة"
              >
                -1
              </button>

              <button
                type="button"
                onClick={() => setRepeatCount(c => c + 1)}
                className="min-h-11 px-4 py-2 wird-btn-accent font-bold rounded-xl text-xs sm:text-sm shadow-xs transition-transform active:scale-95 whitespace-nowrap"
                title="زيادة التكرار (أو اضغط مسافة)"
              >
                + تكرار ({repeatCount})
              </button>
            </div>
          </div>
        </div>

        {/* Study Method Strip & Instant Weak-Verse Capture */}
        <div className="wird-card rounded-2xl p-3.5 sm:p-4 shadow-xs space-y-3 text-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-[#5B6F6B] dark:text-[#8B9E9B]">أسلوب الحفظ:</span>
              <div role="group" aria-label="اختيار أسلوب جلسة الحفظ" className="inline-flex items-center gap-1.5">
                <button
                  type="button"
                  aria-pressed={studyMethod === 'free'}
                  onClick={() => setStudyMethod(saveStudyMethod(surahNumber, startAyah, endAyah, 'free'))}
                  className={`min-h-11 px-3 py-1.5 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                    studyMethod === 'free'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                      : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  حفظ حر
                </button>
                <button
                  type="button"
                  aria-pressed={studyMethod === 'cumulative_linking'}
                  onClick={() => setStudyMethod(saveStudyMethod(surahNumber, startAyah, endAyah, 'cumulative_linking'))}
                  className={`min-h-11 px-3 py-1.5 rounded-xl font-bold border inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    studyMethod === 'cumulative_linking'
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                      : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                  }`}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>الربط التراكمي والمنهجي</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {onAddVerseToRevision && (
                <button
                  type="button"
                  onClick={handleCaptureWeakVerse}
                  disabled={isCapturingWeakVerse}
                  className={`min-h-11 px-3.5 py-2 rounded-xl border font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    weakMarkedAyahs.has(`${surahNumber}:${currentAyah.numberInSurah}`)
                      ? 'bg-[#C59B27]/15 dark:bg-[#E0A96D]/20 border-[#C59B27] text-[#9A7512] dark:text-[#E0A96D]'
                      : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#C59B27]/40 dark:border-[#E0A96D]/30 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D] shrink-0" />
                  <span>
                    {isCapturingWeakVerse
                      ? 'جارٍ التوثيق...'
                      : weakMarkedAyahs.has(`${surahNumber}:${currentAyah.numberInSurah}`)
                      ? 'مُوثّقة في المراجعة العاجلة'
                      : 'توثيق تعثر في هذه الآية'}
                  </span>
                </button>
              )}
            </div>
          </div>

          {weakCaptureFeedback && weakCaptureFeedback.ayahKey === `${surahNumber}:${currentAyah.numberInSurah}` && (
            <p
              role="status"
              aria-live="polite"
              className={`text-[11px] font-semibold ${weakCaptureFeedback.success ? 'text-[#1C4E46] dark:text-[#E0A96D]' : 'text-rose-600 dark:text-rose-300'}`}
            >
              {weakCaptureFeedback.message}
            </p>
          )}

          {studyMethod === 'cumulative_linking' && (
            <div className="pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[#142421] dark:text-[#F5F1E8]">
                  <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                    مسار التثبيت والربط الخماسي:
                  </span>
                  <span className="font-mono tabular-nums">
                    المتقنة {masteredIndices.size}/{sessionAyahs.length}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    aria-pressed={cumulativeProgress.windowMode === 'from_start'}
                    onClick={() => setCumulativeProgress(prev => ({ ...prev, windowMode: 'from_start' }))}
                    className={`min-h-11 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${
                      cumulativeProgress.windowMode === 'from_start'
                        ? 'bg-[#1C4E46]/12 dark:bg-[#1E4A47]/50 border-[#1C4E46] dark:border-[#E0A96D] text-[#1C4E46] dark:text-[#E0A96D]'
                        : 'border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#8B9E9B]'
                    }`}
                  >
                    من أول الورد (آية {sessionAyahs[0]?.numberInSurah ?? startAyah})
                  </button>
                  <button
                    type="button"
                    aria-pressed={cumulativeProgress.windowMode === 'last_n'}
                    onClick={() => setCumulativeProgress(prev => ({ ...prev, windowMode: 'last_n' }))}
                    className={`min-h-11 px-2.5 py-1 rounded-lg border text-[11px] font-bold whitespace-nowrap ${
                      cumulativeProgress.windowMode === 'last_n'
                        ? 'bg-[#1C4E46]/12 dark:bg-[#1E4A47]/50 border-[#1C4E46] dark:border-[#E0A96D] text-[#1C4E46] dark:text-[#E0A96D]'
                        : 'border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#8B9E9B]'
                    }`}
                  >
                    آخر {cumulativeProgress.windowSize} آيات
                  </button>
                  {cumulativeProgress.windowMode === 'last_n' && (
                    <select
                      aria-label="عدد آيات نافذة الربط التراكمي"
                      value={cumulativeProgress.windowSize}
                      onChange={event => setCumulativeProgress(prev => ({
                        ...prev,
                        windowSize: Number(event.target.value) as CumulativeWindowSize
                      }))}
                      className="min-h-11 rounded-lg border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] px-2 text-[11px] font-bold text-[#142421] dark:text-[#F5F1E8]"
                    >
                      {CUMULATIVE_WINDOW_SIZES.map(size => (
                        <option key={size} value={size}>{size} آيات</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {(() => {
                const activeStage: AyahMemorizationStage =
                  cumulativeProgress.stageByIndex[currentAyahIndex] || 'listen_repeat';
                const isRecallVerified = recallVerifiedIndices.has(currentAyahIndex);
                const isMastered = masteredIndices.has(currentAyahIndex);
                return (
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                    <div className={`p-2 rounded-xl border ${activeStage === 'listen_repeat' ? 'border-[#1C4E46] dark:border-[#E0A96D] bg-[#1C4E46]/8 dark:bg-[#1E4A47]/35 font-bold text-[#142421] dark:text-[#F5F1E8]' : 'border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      1. استماع وتكرار ({repeatCount}/{Math.ceil(targetRepeats * 0.4)})
                    </div>
                    <div className={`p-2 rounded-xl border ${activeStage === 'conceal_recall' ? 'border-[#1C4E46] dark:border-[#E0A96D] bg-[#1C4E46]/8 dark:bg-[#1E4A47]/35 font-bold text-[#142421] dark:text-[#F5F1E8]' : 'border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      2. تسميع بالإخفاء ({maskLevel === 0 ? 'مظهرة' : maskLevel === 1 ? '30%' : maskLevel === 2 ? '60%' : '100%'})
                    </div>
                    <div className={`p-2 rounded-xl border ${isRecallVerified ? 'border-[#1C4E46]/50 bg-[#1C4E46]/10 dark:bg-[#1E4A47]/40 font-bold text-[#1C4E46] dark:text-[#E0A96D]' : 'border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      3. {isRecallVerified ? 'تم تحقق الاسترجاع' : 'تحقق الاسترجاع'}
                    </div>
                    <div className={`p-2 rounded-xl border ${activeStage === 'cumulative_bridge' || activeStage === 'connected_loop' ? 'border-[#C59B27] bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 font-bold text-[#142421] dark:text-[#F5F1E8]' : 'border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      4. الربط ({sessionAyahs[cumulativeStartIndex]?.numberInSurah}–{currentAyah.numberInSurah})
                    </div>
                    <div className={`p-2 rounded-xl border ${isMastered ? 'border-[#C59B27] bg-[#C59B27]/18 dark:bg-[#E0A96D]/20 font-bold text-[#142421] dark:text-[#F5F1E8]' : 'border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[#5B6F6B] dark:text-[#8B9E9B]'}`}>
                      5. {isMastered ? 'متقنة ومثبتة' : 'تثبيت الإتقان'}
                    </div>
                  </div>
                );
              })()}

              {masteryFeedback && (
                <p role="alert" className="text-xs font-semibold text-amber-800 dark:text-[#E0A96D]">
                  {masteryFeedback}
                </p>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleVerifyRecallForCurrentAyah}
                    className={`min-h-11 px-3.5 py-2 rounded-xl border font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                      recallVerifiedIndices.has(currentAyahIndex)
                        ? 'bg-[#1C4E46]/12 dark:bg-[#1E4A47]/60 border-[#1C4E46] dark:border-[#E0A96D] text-[#1C4E46] dark:text-[#E0A96D]'
                        : 'bg-white dark:bg-[#0B132B] border-[#1C4E46]/25 dark:border-[#E0A96D]/30 text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {recallVerifiedIndices.has(currentAyahIndex)
                        ? 'تم التحقق من الاسترجاع'
                        : 'تحقق من الاسترجاع بدون نظر'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCumulativeLinkPlayback}
                    disabled={!sessionAyahs.length}
                    className={`min-h-11 px-4 py-2 rounded-xl font-bold inline-flex items-center gap-2 whitespace-nowrap transition-colors ${
                      isCumulativePlaying
                        ? 'bg-[#C59B27] text-[#0B132B]'
                        : 'bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] text-white'
                    }`}
                  >
                    <Link2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isCumulativePlaying
                        ? 'إيقاف الربط التراكمي'
                        : `تشغيل الربط التراكمي (الآيات ${sessionAyahs[cumulativeStartIndex]?.numberInSurah ?? startAyah}–${currentAyah.numberInSurah})`}
                    </span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleConfirmCurrentAyahMastery}
                  className="min-h-11 px-4 py-2 rounded-xl border border-[#C59B27]/60 dark:border-[#E0A96D]/45 bg-[#C59B27]/12 dark:bg-[#E0A96D]/15 text-[#142421] dark:text-[#F5F1E8] font-bold inline-flex items-center gap-1.5 whitespace-nowrap hover:border-[#C59B27] transition-colors"
                >
                  <Check className="w-4 h-4 shrink-0 text-[#1C4E46] dark:text-[#E0A96D]" />
                  <span>
                    {currentAyahIndex < sessionAyahs.length - 1 ? 'تثبيت الإتقان والانتقال للتالية' : 'تثبيت إتقان الآية'}
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Clean Quick Audio Bar */}
      <section aria-label="التشغيل الصوتي السريع" className="wird-card rounded-2xl p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
          {/* Single Ayah Playback */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={handleToggleAudio}
                className={`w-12 h-12 shrink-0 rounded-2xl flex items-center justify-center shadow-xs transition-all ${
                  isPlaying
                    ? 'bg-[#C59B27] text-[#0B132B]'
                    : 'bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] text-white'
                }`}
                title={isPlaying ? 'إيقاف مؤقت' : 'استماع للآية'}
                aria-label={isPlaying ? 'إيقاف مؤقت' : 'استماع للآية'}
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 fill-white mr-0.5" />}
              </button>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-[#1C4E46] dark:text-[#E0A96D] shrink-0" />
                  <h4 className="font-bold text-xs text-[#142421] dark:text-[#F5F1E8]">تلاوة الآية الحالية</h4>
                </div>
                <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] truncate">
                  السرعة {playbackRate}× · تكرار الآية: {formatRepeatBadge(audioRepeatCount, 'مستمر')}
                </p>
              </div>
            </div>
            {isAudioLoading && (
              <span role="status" className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] whitespace-nowrap">
                جارٍ تحميل التلاوة…
              </span>
            )}
          </div>

          {/* Selected Segment Playback */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 pt-3 md:border-t-0 md:pt-0 md:border-r md:border-[#1C4E46]/12 md:dark:border-[#E0A96D]/18 md:pr-4">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <Repeat className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D] shrink-0" />
                <span className="font-bold text-xs text-[#142421] dark:text-[#F5F1E8]">المقطع الصوتي المحدد</span>
              </div>
              <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                {sessionAyahs[segmentStartIndex] && sessionAyahs[segmentEndIndex]
                  ? `من آية ${sessionAyahs[segmentStartIndex].numberInSurah} إلى آية ${sessionAyahs[segmentEndIndex].numberInSurah}`
                  : 'نطاق الجلسة'}
                {' · '}
                تكرار المقطع: {formatRepeatBadge(segmentRepeatCount, 'مستمر')}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={!sessionAyahs.length}
                onClick={handleToggleSegmentAudio}
                className={`min-h-11 rounded-xl px-4 text-xs font-bold transition-colors disabled:opacity-50 whitespace-nowrap ${
                  isSegmentPlaying ? 'bg-[#C59B27] text-[#0B132B]' : 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white hover:bg-[#143D36]'
                }`}
              >
                {isSegmentPlaying ? 'إيقاف مؤقت للمقطع الصوتي' : isSegmentPaused ? 'استئناف المقطع الصوتي' : 'تشغيل المقطع الصوتي المحدد'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSettingsOpenPersist(true);
                  settingsToggleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                className="min-h-11 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] transition-colors whitespace-nowrap"
              >
                ضبط الصوت والمقطع
              </button>
            </div>
          </div>
        </div>

        {segmentProgress && (
          <div aria-live="polite" className="pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 text-[11px] font-bold text-[#1C4E46] dark:text-[#E0A96D] tabular-nums text-center sm:text-right">
            قيد التلاوة: آية {segmentProgress.ayahNumber} · تكرار الآية {segmentProgress.ayahIteration}/{normalizeAyahSegmentRepeatCount(audioRepeatCount)} · دورة المقطع {segmentProgress.cycle}{segmentRepeatCount === -1 ? ' (مستمر)' : `/${segmentRepeatCount}`}
          </div>
        )}
      </section>

      {/* 4. Collapsed Ayah Tafsir Accordion */}
      <SessionTafsirPanel ayah={currentAyah} />

      {/* Explicit Final Segment Confirmation Banner when in Cumulative Linking Mode */}
      {awaitingFinalConfirm && studyMethod === 'cumulative_linking' && !cumulativeProgress.finalSegmentConfirmed && (
        <section
          role="region"
          aria-label="تأكيد إتمام المقطع المتصل"
          className="wird-card rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
        >
          <div className="space-y-1">
            <h4 className="font-bold text-[#142421] dark:text-[#F5F1E8]">
              تأكيد الربط الختامي للورد ({sessionAyahs[0]?.numberInSurah ?? startAyah}–{sessionAyahs[sessionAyahs.length - 1]?.numberInSurah ?? endAyah})
            </h4>
            <p className="text-[#5B6F6B] dark:text-[#8B9E9B]">
              أكّد تسميع ومراجعة كامل مقطع الجلسة متصلاً قبل تسجيل إتمام جلسة الحفظ. (الآيات المثبتة: {masteredIndices.size}/{sessionAyahs.length})
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAwaitingFinalConfirm(false)}
              className="min-h-11 px-3.5 py-2 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 font-bold text-[#142421] dark:text-[#F5F1E8]"
            >
              مراجعة إضافية
            </button>
            <button
              type="button"
              onClick={() => {
                setCumulativeProgress(prev => confirmFinalSegmentMastery(prev));
                setAwaitingFinalConfirm(false);
                void finalizeSessionCompletion();
              }}
              className="min-h-11 px-4 py-2 rounded-xl bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#E0A96D] dark:text-[#0B132B] text-white font-bold"
            >
              تأكيد إتمام كامل المقطع
            </button>
          </div>
        </section>
      )}

      {/* 5. Sticky Session Navigation */}
      <div
        role="group"
        aria-label="التنقل بين آيات جلسة الحفظ"
        className="sticky bottom-2 z-30 flex items-center justify-between gap-2 rounded-2xl border border-[#C59B27]/35 dark:border-[#E0A96D]/25 bg-[#F9F6EE]/95 dark:bg-[#0B132B]/95 backdrop-blur-md p-2 sm:p-3 shadow-lg"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <button
          onClick={handlePrevAyah}
          disabled={currentAyahIndex === 0}
          className="min-h-14 flex flex-1 items-center justify-center gap-2 px-3 py-2.5 bg-white hover:bg-[#F2EDE2] dark:bg-[#111F36] dark:hover:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 rounded-xl text-xs sm:text-sm font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 shrink-0" />
          <span>السابقة</span>
        </button>

        <label className="sr-only" htmlFor="session-ayah-jump">الانتقال المباشر إلى آية في الجلسة</label>
        <select
          id="session-ayah-jump"
          aria-label="الانتقال المباشر إلى آية في الجلسة"
          title="انتقل مباشرة إلى آية"
          value={currentAyahIndex}
          onChange={event => {
            const nextIndex = Number(event.target.value);
            if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= sessionAyahs.length || nextIndex === currentAyahIndex) return;
            handleStopAudio();
            setCurrentAyahIndex(nextIndex);
          }}
          className="min-h-14 w-20 sm:w-28 shrink-0 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-1 text-center text-xs font-bold text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
        >
          {sessionAyahs.map((ayah, index) => (
            <option key={ayah.number} value={index}>آية {ayah.numberInSurah}</option>
          ))}
        </select>

        <button
          onClick={handleNextAyah}
          className="min-h-14 flex flex-[1.4] items-center justify-center gap-2 px-3 sm:px-5 py-2.5 bg-[#1C4E46] hover:bg-[#143D36] dark:bg-[#1E4A47] dark:hover:bg-[#163A37] text-white rounded-xl text-xs sm:text-sm font-bold shadow-xs transition-colors active:scale-[0.98]"
        >
          <span>
            {currentAyahIndex === sessionAyahs.length - 1 ? 'إتمام الجلسة' : 'الآية التالية'}
          </span>
          <ChevronLeft className="w-4 h-4 shrink-0" />
        </button>
      </div>
    </div>
  );
};
