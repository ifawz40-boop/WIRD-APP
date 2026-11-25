import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  buildAudioRuqyahSessionQueue,
  getRuqyahAudioQueueForItems,
  getRuqyahAyahs
} from '../../services/ruqyahContentService';
import type { RuqyahSessionAudioEntry } from '../../services/ruqyahContentService';
import type { Ayah } from '../../types/quran';
import { QuranText } from '../shared/QuranText';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS, fetchQuranReciters } from '../../services/ruqyahAudioService';
import { requestOfflineAudioCache } from '../../services/audioService';
import { getRuqyahProgressDeviceId, loadRuqyahProgress } from '../../services/ruqyahProgressService';
import { adjustRuqyahProgressCounter, createEmptyRuqyahProgressSnapshot, migrateRuqyahProgressSnapshot, resetRuqyahProgressCounter } from '../../services/ruqyahProgressSchema';
import type { RuqyahProgressSnapshotV2 } from '../../services/ruqyahProgressSchema';
import { persistRuqyahProgressSnapshot } from '../../services/journaledSnapshotService';
import { STORAGE_KEYS, StorageService } from '../../services/storageService';
import {
  getSavedPlaybackRate,
  getSavedRuqyahReciterId,
  savePlaybackRate,
  savePreferredReciter,
  subscribeAudioPreferences
} from '../../services/audioPreferences';
import { globalAudioCoordinator } from '../../services/globalAudioCoordinator';
import { RuqyahApiLibrary } from './RuqyahApiLibrary';
import { RuqyahCountdownRing } from './RuqyahCountdownRing';
import { AudioRuqyahStudio } from './AudioRuqyahStudio';
import {
  ShieldCheck,
  Volume2,
  Play,
  Pause,
  Square,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  BookOpen,
  Heart,
  Info,
  Headphones,
  Eye,
  EyeOff,
  Copy,
  Check,
  Search,
  X,
  Home,
  CloudMoon,
  Shield
} from 'lucide-react';
import {
  AUDIO_RUQYAH_SESSIONS,
  RUQYAH_CATEGORIES,
  RUQYAH_GUIDELINES,
  RUQYAH_ITEMS,
  getRuqyahCategoryMeta,
  getRuqyahItemsByCategory
} from '../../data/ruqyahData';
import type { RuqyahAudioSession, RuqyahCategory, RuqyahItem } from '../../data/ruqyahData';
import { WirdIslamicPattern, WirdMihrabArch } from '../brand/WirdPattern';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { READING_PAGE_WIDTH_CLASSES } from '../../services/readingDisplayPreferences';

interface RuqyahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

type RuqyahWorkspaceMode = 'interactive' | 'audio_studio' | 'guidelines' | 'api_library';

const RUQYAH_SHOW_NOTES_STORAGE_KEY = 'wird.ruqyah.showNotes.v1';

const RECITATION_CATEGORIES = RUQYAH_CATEGORIES.filter(cat => cat.id !== 'guidelines');

function renderCategoryIcon(catId: RuqyahCategory, className = 'w-4 h-4') {
  switch (catId) {
    case 'brief':
      return <Sparkles className={className} />;
    case 'medium':
      return <BookOpen className={className} />;
    case 'full':
      return <ShieldCheck className={className} />;
    case 'eye_envy':
      return <Heart className={className} />;
    case 'illness':
      return <Sparkles className={className} />;
    case 'magic_protection':
      return <Shield className={className} />;
    case 'children_home':
      return <Home className={className} />;
    case 'anxiety_sleep':
      return <CloudMoon className={className} />;
    case 'guidelines':
    default:
      return <Info className={className} />;
  }
}

type ManagedQueueEntry = {
  globalAyahNumber: number;
  itemId: string;
  title: string;
  surahNumber?: number;
  ayahNumber?: number;
  ayahText?: string;
  surahName?: string;
  passageIndex?: number;
};

export const RuqyahView: React.FC<RuqyahViewProps> = ({ onToast }) => {
  const currentStorageScope = StorageService.getStorageScope();
  const {
    preferences: displayPreferences,
    updatePreferences: updateDisplayPreferences,
    resetPreferences: resetDisplayPreferences,
  } = useReadingDisplayPreferences('ruqyah');
  const [activeCategory, setActiveCategory] = useState<RuqyahCategory>('brief');
  const [viewMode, setViewMode] = useState<RuqyahWorkspaceMode>('interactive');
  const [searchQuery, setSearchQuery] = useState('');
  const [showExplanationAndSource, setShowExplanationAndSource] = useState<boolean>(() => {
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(RUQYAH_SHOW_NOTES_STORAGE_KEY) : null;
      return saved === null ? true : saved !== 'false';
    } catch {
      return true;
    }
  });
  const [copiedItemId, setCopiedItemId] = useState<string | null>(null);

  // Counter states per item (itemId -> current count)
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [progressSnapshot, setProgressSnapshot] = useState<RuqyahProgressSnapshotV2 | null>(null);
  const [progressDeviceId, setProgressDeviceId] = useState<string | null>(null);
  const [progressHydrated, setProgressHydrated] = useState(false);
  const [progressDirty, setProgressDirty] = useState(false);
  const [progressScope, setProgressScope] = useState(currentStorageScope);
  const [progressCorrupt, setProgressCorrupt] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState<boolean>(true);
  const [showResetConfirmation, setShowResetConfirmation] = useState(false);
  const resetTriggerRef = useRef<HTMLButtonElement>(null);

  // Audio state (shared across Interactive Reader & Audio Ruqyah Studio through ONE managed <audio> element)
  const [reciters, setReciters] = useState(FALLBACK_QURAN_RECITERS);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => getSavedRuqyahReciterId('ar.husary'));
  const [playbackRate, setPlaybackRate] = useState<number>(() => getSavedPlaybackRate());
  const [audioIsPlaying, setAudioIsPlaying] = useState(false);
  const [audioIsLoading, setAudioIsLoading] = useState(false);
  const [audioError, setAudioError] = useState('');
  const [audioStatusMessage, setAudioStatusMessage] = useState('');
  const [audioQueueLabel, setAudioQueueLabel] = useState('');
  const [audioCurrentItemTitle, setAudioCurrentItemTitle] = useState('');
  const [audioCurrentItemId, setAudioCurrentItemId] = useState<string | null>(null);
  const [audioQueuePosition, setAudioQueuePosition] = useState(0);
  const [audioQueueLength, setAudioQueueLength] = useState(0);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioVolume, setAudioVolume] = useState(0.85);

  // Audio Ruqyah Studio specific state
  const [activeAudioSessionId, setActiveAudioSessionId] = useState<string | null>(null);
  const [audioCurrentAyahText, setAudioCurrentAyahText] = useState('');
  const [audioCurrentSurahName, setAudioCurrentSurahName] = useState('');
  const [audioCurrentSurahNumber, setAudioCurrentSurahNumber] = useState(1);
  const [audioCurrentAyahNumber, setAudioCurrentAyahNumber] = useState(1);
  const [audioCurrentPassageIndex, setAudioCurrentPassageIndex] = useState(0);
  const [sessionLoopEnabled, setSessionLoopEnabled] = useState(false);
  const [sleepTimerMinutes, setSleepTimerMinutes] = useState<number | null>(null);
  const [sleepTimerRemainingSec, setSleepTimerRemainingSec] = useState<number | null>(null);

  // Verified local Quran chunk loading state
  const [quranAyahsByItem, setQuranAyahsByItem] = useState<Record<string, Ayah[]>>({});
  const [quranLoadingItems, setQuranLoadingItems] = useState<Record<string, boolean>>({});
  const [quranErrors, setQuranErrors] = useState<Record<string, string>>({});
  const [quranRetryNonce, setQuranRetryNonce] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedReciterIdRef = useRef(selectedReciterId);
  const sessionLoopRef = useRef(sessionLoopEnabled);
  const activeAudioSessionIdRef = useRef<string | null>(null);
  const sessionPassageStartIndicesRef = useRef<number[]>([]);
  const stopRuqyahAudioRef = useRef<() => void>(() => {});
  const audioQueueRef = useRef<ManagedQueueEntry[]>([]);
  const audioQueueIndexRef = useRef(0);
  const audioRequestIdRef = useRef(0);
  const audioBuildRequestIdRef = useRef(0);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const currentItems = useMemo(() => getRuqyahItemsByCategory(activeCategory), [activeCategory]);
  const activeCategoryMeta = useMemo(() => getRuqyahCategoryMeta(activeCategory), [activeCategory]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) return currentItems;
    return currentItems.filter(item =>
      item.title.includes(q) ||
      item.text.includes(q) ||
      (item.surahName && item.surahName.includes(q)) ||
      (item.source && item.source.includes(q)) ||
      (item.explanation && item.explanation.includes(q))
    );
  }, [currentItems, searchQuery]);

  useEffect(() => {
    sessionLoopRef.current = sessionLoopEnabled;
  }, [sessionLoopEnabled]);

  useEffect(() => {
    activeAudioSessionIdRef.current = activeAudioSessionId;
  }, [activeAudioSessionId]);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Sleep timer countdown for Audio Ruqyah Studio
  useEffect(() => {
    if (sleepTimerRemainingSec === null) return;
    if (sleepTimerRemainingSec <= 0) {
      stopRuqyahAudioRef.current();
      setSleepTimerMinutes(null);
      setSleepTimerRemainingSec(null);
      setAudioStatusMessage('توقفت الرقية المسموعة تلقائياً بانتهاء مؤقّت النوم.');
      return;
    }
    const timer = window.setInterval(() => {
      setSleepTimerRemainingSec(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepTimerRemainingSec]);

  useEffect(() => {
    let active = true;
    const quranItems = currentItems.filter(candidate => candidate.type === 'quran');
    setQuranAyahsByItem({});
    setQuranErrors({});
    setQuranLoadingItems(Object.fromEntries(quranItems.map(candidate => [candidate.id, true])));

    void Promise.all(quranItems.map(async candidate => {
      try {
        const ayahs = await getRuqyahAyahs(candidate);
        if (active) setQuranAyahsByItem(previous => ({ ...previous, [candidate.id]: ayahs }));
      } catch (error) {
        if (active) setQuranErrors(previous => ({
          ...previous,
          [candidate.id]: error instanceof Error ? error.message : 'تعذر تحميل آيات المصحف المحلي المعتمد.'
        }));
      } finally {
        if (active) setQuranLoadingItems(previous => ({ ...previous, [candidate.id]: false }));
      }
    }));

    return () => {
      active = false;
      audioBuildRequestIdRef.current += 1;
      audioRequestIdRef.current += 1;
      if (autoAdvanceTimerRef.current !== null) {
        window.clearTimeout(autoAdvanceTimerRef.current);
        autoAdvanceTimerRef.current = null;
      }
    };
  }, [activeCategory, quranRetryNonce]);

  const formatAudioTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
  };

  const playAudioQueuePosition = async (index: number) => {
    const requestId = ++audioRequestIdRef.current;
    const audio = audioRef.current;
    const entry = audioQueueRef.current[index];
    if (!audio || !entry) return;

    audioQueueIndexRef.current = index;
    setAudioQueuePosition(index + 1);
    setAudioCurrentItemId(entry.itemId);
    setAudioCurrentItemTitle(entry.title);
    setAudioCurrentAyahText(entry.ayahText || '');
    setAudioCurrentSurahName(entry.surahName || '');
    setAudioCurrentSurahNumber(entry.surahNumber || 1);
    setAudioCurrentAyahNumber(entry.ayahNumber || 1);
    if (typeof entry.passageIndex === 'number') {
      setAudioCurrentPassageIndex(entry.passageIndex);
    }
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioIsLoading(true);
    setAudioError('');
    setAudioStatusMessage('');

    try {
      globalAudioCoordinator.claimFocus('ruqyah');
      requestOfflineAudioCache(
        audioQueueRef.current.slice(index, index + 20).map(item =>
          buildQuranAyahAudioUrl(selectedReciterIdRef.current, item.globalAyahNumber)
        )
      );
      audio.playbackRate = getSavedPlaybackRate();
      audio.src = buildQuranAyahAudioUrl(selectedReciterIdRef.current, entry.globalAyahNumber);
      audio.load();
      await audio.play();
      if (requestId !== audioRequestIdRef.current) return;
      setAudioIsPlaying(true);
      setAudioIsLoading(false);
    } catch {
      if (requestId !== audioRequestIdRef.current) return;
      setAudioIsPlaying(false);
      setAudioIsLoading(false);
      setAudioError('تعذر تشغيل التلاوة من المصدر المعتمد. تحقق من الاتصال ثم أعد المحاولة.');
    }
  };

  const startRuqyahAudio = async (item?: RuqyahItem) => {
    const buildRequestId = ++audioBuildRequestIdRef.current;
    audioRequestIdRef.current += 1;
    audioQueueRef.current = [];
    audioQueueIndexRef.current = 0;
    sessionPassageStartIndicesRef.current = [];
    setActiveAudioSessionId(null);
    const previousAudio = audioRef.current;
    if (previousAudio) {
      previousAudio.pause();
      previousAudio.removeAttribute('src');
      previousAudio.load();
    }
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
    setAudioCurrentAyahText('');
    setAudioIsPlaying(false);
    setAudioIsLoading(true);
    setAudioError('');
    try {
      const targetItems = item ? [item] : currentItems.filter(candidate => candidate.type === 'quran');
      const queue = await getRuqyahAudioQueueForItems(targetItems);
      if (buildRequestId !== audioBuildRequestIdRef.current) return;

      if (queue.length === 0) throw new Error('لا توجد آيات قرآنية صالحة للتشغيل في هذا القسم.');
      if (buildRequestId !== audioBuildRequestIdRef.current) return;
      audioQueueRef.current = queue;
      setAudioQueueLength(queue.length);
      setAudioQueuePosition(0);
      setAudioQueueLabel(item ? item.title : 'آيات قسم ' + activeCategoryMeta.label);
      setAudioError('');
      setAudioStatusMessage('');
      setAudioIsLoading(false);
      void playAudioQueuePosition(0);
    } catch (error) {
      if (buildRequestId !== audioBuildRequestIdRef.current) return;
      setAudioIsLoading(false);
      setAudioError(error instanceof Error ? error.message : 'تعذر تجهيز تلاوة آيات الرقية من المصحف المحلي المعتمد.');
    }
  };

  const startTimedAudioSession = async (session: RuqyahAudioSession, startPassageIndex = 0) => {
    const buildRequestId = ++audioBuildRequestIdRef.current;
    audioRequestIdRef.current += 1;
    audioQueueRef.current = [];
    audioQueueIndexRef.current = 0;
    const previousAudio = audioRef.current;
    if (previousAudio) {
      previousAudio.pause();
      previousAudio.removeAttribute('src');
      previousAudio.load();
    }
    setActiveAudioSessionId(session.id);
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
    setAudioCurrentAyahText('');
    setAudioIsPlaying(false);
    setAudioIsLoading(true);
    setAudioError('');
    setAudioStatusMessage('');
    try {
      const built = await buildAudioRuqyahSessionQueue(session, RUQYAH_ITEMS);
      if (buildRequestId !== audioBuildRequestIdRef.current) return;
      if (built.queue.length === 0) throw new Error('تعذر تجهيز مقاطع هذه الجلسة الصوتية.');

      audioQueueRef.current = built.queue as RuqyahSessionAudioEntry[];
      sessionPassageStartIndicesRef.current = built.passageStartIndices;
      const safePassage = Math.max(0, Math.min(startPassageIndex, built.passageStartIndices.length - 1));
      const startIndex = built.passageStartIndices[safePassage] ?? 0;

      setAudioQueueLength(built.queue.length);
      setAudioQueuePosition(startIndex);
      setAudioQueueLabel(session.title);
      setAudioIsLoading(false);
      void playAudioQueuePosition(startIndex);
    } catch (error) {
      if (buildRequestId !== audioBuildRequestIdRef.current) return;
      setAudioIsLoading(false);
      setAudioError(error instanceof Error ? error.message : 'تعذر تجهيز الجلسة الصوتية للرقية الشرعية.');
    }
  };

  const stopRuqyahAudio = () => {
    audioBuildRequestIdRef.current += 1;
    audioRequestIdRef.current += 1;
    audioQueueRef.current = [];
    audioQueueIndexRef.current = 0;
    sessionPassageStartIndicesRef.current = [];
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setActiveAudioSessionId(null);
    setAudioIsPlaying(false);
    setAudioIsLoading(false);
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
    setAudioCurrentAyahText('');
    setAudioCurrentSurahName('');
    setAudioCurrentPassageIndex(0);
    setAudioCurrentTime(0);
    setAudioDuration(0);
    setAudioQueueLabel('');
    setAudioError('');
    setAudioStatusMessage('');
    globalAudioCoordinator.releaseFocus('ruqyah');
  };
  stopRuqyahAudioRef.current = stopRuqyahAudio;

  const toggleAudioPlayback = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audioIsPlaying) {
      audio.pause();
      setAudioIsPlaying(false);
      globalAudioCoordinator.releaseFocus('ruqyah');
      return;
    }
    if (audio.src && audioQueueLength > 0) {
      globalAudioCoordinator.claimFocus('ruqyah');
      audio.playbackRate = getSavedPlaybackRate();
      setAudioIsLoading(true);
      const requestId = audioRequestIdRef.current;
      void audio.play().then(() => {
        if (requestId !== audioRequestIdRef.current) return;
        setAudioIsPlaying(true);
        setAudioIsLoading(false);
      }).catch(() => {
        if (requestId !== audioRequestIdRef.current) return;
        setAudioIsPlaying(false);
        setAudioIsLoading(false);
        setAudioError('تعذر استكمال التلاوة. تحقق من الاتصال بالإنترنت.');
      });
    }
  };

  const handleJumpSessionPassage = (delta: -1 | 1) => {
    const starts = sessionPassageStartIndicesRef.current;
    if (starts.length === 0) return;
    const targetPassage = Math.max(0, Math.min(starts.length - 1, audioCurrentPassageIndex + delta));
    const targetQueueIdx = starts[targetPassage];
    if (typeof targetQueueIdx === 'number') {
      void playAudioQueuePosition(targetQueueIdx);
    }
  };

  const handleAudioReciterChange = (reciterId: string) => {
    const activeSessionObj = activeAudioSessionId
      ? AUDIO_RUQYAH_SESSIONS.find(s => s.id === activeAudioSessionId)
      : null;
    const resumePassage = audioCurrentPassageIndex;
    const wasPlayingSession = Boolean(activeSessionObj && audioIsPlaying);

    stopRuqyahAudio();
    selectedReciterIdRef.current = reciterId;
    setSelectedReciterId(reciterId);
    savePreferredReciter(reciterId);

    if (wasPlayingSession && activeSessionObj) {
      void startTimedAudioSession(activeSessionObj, resumePassage);
    }
  };

  const handlePlaybackRateChange = (nextRate: number) => {
    setPlaybackRate(nextRate);
    savePlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSelectSleepTimer = (minutes: number | null) => {
    setSleepTimerMinutes(minutes);
    setSleepTimerRemainingSec(minutes === null ? null : minutes * 60);
    if (minutes !== null) {
      onToast?.(`تم ضبط مؤقّت النوم لإيقاف الرقية المسموعة بعد ${minutes} دقيقة.`, 'info');
    }
  };

  const toggleItemAudio = (item: RuqyahItem) => {
    if (audioCurrentItemId === item.id && audioIsPlaying && !activeAudioSessionId) {
      audioRef.current?.pause();
      setAudioIsPlaying(false);
      return;
    }
    startRuqyahAudio(item);
  };

  useEffect(() => {
    selectedReciterIdRef.current = selectedReciterId;
  }, [selectedReciterId]);

  useEffect(() => {
    const unregisterAudio = globalAudioCoordinator.register('ruqyah', () => stopRuqyahAudioRef.current());
    const unsubscribePrefs = subscribeAudioPreferences(prefs => {
      if (audioRef.current) audioRef.current.playbackRate = prefs.playbackRate;
      setPlaybackRate(prefs.playbackRate);
      setSelectedReciterId(prev => {
        if (prev !== prefs.ruqyahReciterId) {
          stopRuqyahAudioRef.current();
          return prefs.ruqyahReciterId;
        }
        return prev;
      });
    });
    return () => {
      unregisterAudio();
      unsubscribePrefs();
      globalAudioCoordinator.releaseFocus('ruqyah');
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchQuranReciters(controller.signal).then(setReciters).catch(() => {
      // The reviewed, bundled allowlist remains available when the catalogue proxy is offline.
    });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const audio = new Audio();
    // The audio element has no source until the user presses Play; once requested, buffer the ayah aggressively to reduce stalls.
    audio.preload = 'auto';
    audio.volume = audioVolume;
    audioRef.current = audio;

    const handleTimeUpdate = () => setAudioCurrentTime(Number.isFinite(audio.currentTime) ? audio.currentTime : 0);
    const handleLoadedMetadata = () => setAudioDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const handlePlay = () => { setAudioIsPlaying(true); setAudioIsLoading(false); };
    const handlePause = () => setAudioIsPlaying(false);
    const handleWaiting = () => setAudioIsLoading(true);
    const handleCanPlay = () => setAudioIsLoading(false);
    const handleEnded = () => {
      if (audioQueueRef.current.length === 0) return;
      const nextIndex = audioQueueIndexRef.current + 1;
      if (nextIndex < audioQueueRef.current.length) {
        void playAudioQueuePosition(nextIndex);
      } else if (activeAudioSessionIdRef.current && sessionLoopRef.current) {
        void playAudioQueuePosition(0);
      } else {
        setAudioIsPlaying(false);
        setAudioIsLoading(false);
        setAudioCurrentItemId(null);
        setAudioCurrentTime(0);
        setAudioQueueLength(0);
        setAudioStatusMessage('اكتملت التلاوة الصوتية للآيات المحددة.');
        globalAudioCoordinator.releaseFocus('ruqyah');
      }
    };
    const handleError = () => {
      if (audioQueueRef.current.length === 0) return;
      setAudioIsPlaying(false);
      setAudioIsLoading(false);
      setAudioError('تعذر تحميل ملف التلاوة. لم يتم استبداله بتسجيل من مصدر آخر.');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audioBuildRequestIdRef.current += 1;
      audioRequestIdRef.current += 1;
      audioQueueRef.current = [];
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      audioRef.current = null;
      audioQueueRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = audioVolume;
  }, [audioVolume]);

  useEffect(() => {
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
    setAudioQueueLabel('');
    setAudioIsPlaying(false);
    setAudioIsLoading(false);
    setActiveAudioSessionId(null);

    return () => {
      audioBuildRequestIdRef.current += 1;
      audioRequestIdRef.current += 1;
      audioQueueRef.current = [];
      audioQueueIndexRef.current = 0;
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
      }
    };
  }, [activeCategory]);

  // Hydrate progress whenever WIRD switches guest/account storage namespaces.
  useEffect(() => {
    let active = true;
    setProgressHydrated(false);
    setProgressCorrupt(false);
    setProgressDirty(false);
    setProgressSnapshot(null);
    setProgressDeviceId(null);
    const saved = loadRuqyahProgress();
    if (saved.status === 'corrupt') {
      setCounts({});
      setProgressCorrupt(true);
      if (onToast) onToast('تعذر قراءة تقدم الرقية المحفوظ؛ احتفظنا بالبيانات الأصلية ولم نستبدلها.', 'warn');
    } else {
      const snapshot = saved.status === 'loaded'
        ? migrateRuqyahProgressSnapshot(saved.snapshot)
        : createEmptyRuqyahProgressSnapshot();
      setProgressSnapshot(snapshot);
      setCounts(snapshot.counts);
      // V1 snapshots are migrated through the journal before cloud sync can replace them.
      setProgressDirty(saved.status === 'loaded' && saved.snapshot.schemaVersion === 1);
    }
    setProgressScope(currentStorageScope);
    setProgressHydrated(true);
    void getRuqyahProgressDeviceId(currentStorageScope)
      .then(deviceId => {
        if (active && StorageService.getStorageScope() === currentStorageScope) setProgressDeviceId(deviceId);
      })
      .catch(error => {
        if (active && onToast) onToast(
          error instanceof Error ? error.message : 'تعذر تحديد جهاز المزامنة لتقدم الرقية.',
          'error'
        );
      });
    return () => { active = false; };
  }, [currentStorageScope]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const progressStorageKey = currentStorageScope === 'legacy' || currentStorageScope === 'guest'
      ? STORAGE_KEYS.RUQYAH_PROGRESS
      : `wird_scope_v1:${currentStorageScope}:${STORAGE_KEYS.RUQYAH_PROGRESS}`;
    const refreshProgress = (event?: Event) => {
      if (event && 'key' in event) {
        const changedKey = (event as StorageEvent).key;
        if (changedKey !== null && changedKey !== progressStorageKey) return;
      }
      if (StorageService.getStorageScope() !== currentStorageScope) return;
      const saved = loadRuqyahProgress();
      if (saved.status === 'corrupt') {
        setCounts({});
        setProgressSnapshot(null);
        setProgressCorrupt(true);
        return;
      }
      const snapshot = saved.status === 'loaded'
        ? migrateRuqyahProgressSnapshot(saved.snapshot, Date.now())
        : createEmptyRuqyahProgressSnapshot();
      setProgressSnapshot(snapshot);
      setCounts(snapshot.counts);
      setProgressDirty(saved.status === 'loaded' && saved.snapshot.schemaVersion === 1);
    };
    window.addEventListener('wird:ruqyah-progress-updated', refreshProgress);
    window.addEventListener('storage', refreshProgress);
    return () => {
      window.removeEventListener('wird:ruqyah-progress-updated', refreshProgress);
      window.removeEventListener('storage', refreshProgress);
    };
  }, [currentStorageScope]);

  useEffect(() => {
    if (!progressHydrated || !progressDirty || progressCorrupt || !progressSnapshot ||
        !progressDeviceId || progressScope !== currentStorageScope) return;
    let active = true;
    const snapshot = progressSnapshot;
    void persistRuqyahProgressSnapshot(snapshot, { expectedStorageScope: currentStorageScope })
      .then(result => {
        if (active && !result.success && onToast) {
          onToast(result.error || 'تعذر حفظ تقدم الرقية ومزامنته.', 'error');
        }
      })
      .catch(() => {
        if (active && onToast) onToast('تعذر حفظ تقدم الرقية ومزامنته.', 'error');
      });
    return () => { active = false; };
  }, [progressSnapshot, progressDeviceId, progressHydrated, progressDirty, progressCorrupt, progressScope, currentStorageScope, onToast]);

  const handleRecoverProgress = () => {
    try {
      const emptySnapshot = createEmptyRuqyahProgressSnapshot();
      setProgressSnapshot(emptySnapshot);
      setCounts({});
      setProgressCorrupt(false);
      setProgressDirty(true);
      setProgressHydrated(true);
      if (onToast) onToast('جارٍ حفظ إعادة ضبط سجل تقدم الرقية...', 'info');
    } catch {
      if (onToast) onToast('تعذر إعادة ضبط بيانات تقدم الرقية.', 'error');
    }
  };

  const handleToggleExplanationAndSource = () => {
    setShowExplanationAndSource(prev => {
      const next = !prev;
      try {
        localStorage.setItem(RUQYAH_SHOW_NOTES_STORAGE_KEY, String(next));
      } catch {
        // ignore storage quota failure
      }
      return next;
    });
  };

  const handleStepFontSize = (delta: -2 | 2) => {
    const nextSize = Math.max(18, Math.min(34, displayPreferences.fontSize + delta));
    updateDisplayPreferences({ fontSize: nextSize });
  };

  const handleCopyItem = (item: RuqyahItem) => {
    const resolvedAyahs = quranAyahsByItem[item.id];
    const bodyText = item.type === 'quran' && resolvedAyahs && resolvedAyahs.length > 0
      ? resolvedAyahs.map(a => a.text).join(' ۞ ')
      : item.text;
    const formatted = `${item.title}\n${bodyText}${item.source ? `\n— المصدر: ${item.source}` : ''}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(formatted);
      setCopiedItemId(item.id);
      window.setTimeout(() => {
        setCopiedItemId(prev => (prev === item.id ? null : prev));
      }, 2000);
      onToast?.('تم نسخ النص مع تخريجه الموثق.', 'info');
    }
  };

  const handleResetSingleItem = (item: RuqyahItem) => {
    if (!progressHydrated || progressCorrupt || !progressDeviceId || !progressSnapshot) return;
    if ((progressSnapshot.counts[item.id] || 0) <= 0) return;
    const updatedSnapshot = resetRuqyahProgressCounter(progressSnapshot, item.id, progressDeviceId);
    setProgressSnapshot(updatedSnapshot);
    setCounts(updatedSnapshot.counts);
    setProgressDirty(true);
  };

  // Click counter handler
  const handleItemClick = (item: RuqyahItem) => {
    const current = counts[item.id] || 0;
    if (!progressDeviceId || !progressSnapshot || item.type === 'guideline' ||
        current >= 1_000_000 || (item.repeatTarget !== null && current >= item.repeatTarget)) return;

    const nextSnapshot = adjustRuqyahProgressCounter(progressSnapshot, item.id, progressDeviceId, 1);
    const next = nextSnapshot.counts[item.id] || 0;
    setProgressSnapshot(nextSnapshot);
    setCounts(nextSnapshot.counts);
    setProgressDirty(true);

    // Haptic feedback if available
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(40);
      } catch (_) {}
    }

    // Auto-scroll to next card when target reached
    if (item.repeatTarget !== null && next === item.repeatTarget && autoAdvance) {
      const currentIndex = filteredItems.findIndex(i => i.id === item.id);
      if (currentIndex !== -1 && currentIndex < filteredItems.length - 1) {
        const nextId = filteredItems[currentIndex + 1].id;
        if (autoAdvanceTimerRef.current !== null) {
          window.clearTimeout(autoAdvanceTimerRef.current);
        }
        autoAdvanceTimerRef.current = window.setTimeout(() => {
          autoAdvanceTimerRef.current = null;
          const el = document.getElementById(`ruqyah-card-${nextId}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 300);
      }
    }
  };

  const closeResetConfirmation = () => {
    setShowResetConfirmation(false);
    resetTriggerRef.current?.focus();
  };

  // Reset counters for current active category
  const handleResetCategoryCounts = () => {
    if (!progressHydrated || progressCorrupt || !progressDeviceId || !progressSnapshot) return;
    let updatedSnapshot = progressSnapshot;
    currentItems.forEach(item => {
      if ((updatedSnapshot.counts[item.id] || 0) > 0) {
        updatedSnapshot = resetRuqyahProgressCounter(updatedSnapshot, item.id, progressDeviceId);
      }
    });
    setProgressSnapshot(updatedSnapshot);
    setCounts(updatedSnapshot.counts);
    setProgressDirty(true);
    closeResetConfirmation();
    if (onToast) onToast('تم إعادة ضبط العدادات لهذه القائمة.', 'info');
  };

  // Calculate section progress
  const trackedItems = currentItems.filter(item => item.type !== 'guideline');
  const completedCount = trackedItems.filter(item =>
    item.repeatTarget === null ? (counts[item.id] || 0) > 0 : (counts[item.id] || 0) >= item.repeatTarget
  ).length;
  const progressPercent = trackedItems.length > 0 ? Math.round((completedCount / trackedItems.length) * 100) : 0;

  const ruqyahListSpacing =
    displayPreferences.spacing === 'compact'
      ? 'space-y-3'
      : displayPreferences.spacing === 'relaxed'
      ? 'space-y-6'
      : 'space-y-4';
  const ruqyahCardPadding =
    displayPreferences.spacing === 'compact'
      ? 'p-4 sm:p-5'
      : displayPreferences.spacing === 'relaxed'
      ? 'p-6 sm:p-7'
      : 'p-5 sm:p-6';
  const ruqyahLineHeight =
    displayPreferences.spacing === 'compact'
      ? 2.0
      : displayPreferences.spacing === 'relaxed'
      ? 2.7
      : 2.3;

  const workspaceTabs: Array<{ id: RuqyahWorkspaceMode; label: string; countBadge?: string }> = [
    { id: 'interactive', label: 'القراءة والعداد', countBadge: String(RECITATION_CATEGORIES.length) },
    { id: 'audio_studio', label: 'الرقية المسموعة', countBadge: String(AUDIO_RUQYAH_SESSIONS.length) },
    { id: 'guidelines', label: 'آداب وإرشادات', countBadge: String(RUQYAH_GUIDELINES.length) },
    { id: 'api_library', label: 'المكتبة الموسعة' }
  ];

  const handleSwitchMode = (nextMode: RuqyahWorkspaceMode) => {
    if (nextMode !== viewMode) {
      if (nextMode === 'api_library' || nextMode === 'guidelines') {
        stopRuqyahAudio();
      } else if (nextMode === 'interactive' && activeAudioSessionId) {
        stopRuqyahAudio();
      } else if (nextMode === 'audio_studio' && !activeAudioSessionId && audioQueueLength > 0) {
        stopRuqyahAudio();
      }
    }
    setShowResetConfirmation(false);
    setViewMode(nextMode);
  };

  return (
    <div
      className={`space-y-6 pb-20 ${READING_PAGE_WIDTH_CLASSES[displayPreferences.pageWidth]} mx-auto px-1 sm:px-2 overflow-x-hidden transition-all`}
      dir="rtl"
    >
      {progressCorrupt && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] p-4">
          <p className="text-sm text-[var(--wird-text)] leading-relaxed">
            تعذر قراءة تقدم الرقية المحفوظ. احتفظنا بالبيانات الأصلية دون استبدالها؛ يمكنك متابعة القراءة دون حفظ حتى تختار إعادة ضبط هذا السجل.
          </p>
          <button
            type="button"
            onClick={handleRecoverProgress}
            className="min-h-11 shrink-0 rounded-xl bg-[var(--wird-accent)] px-4 py-2 text-xs font-bold text-[var(--wird-accent-ink)]"
          >
            إعادة ضبط سجل الرقية
          </button>
        </div>
      )}

      {/* 1. Compact Architectural Hero Header */}
      <section className="relative overflow-hidden wird-hero-surface rounded-3xl p-5 sm:p-6 md:p-7">
        <WirdIslamicPattern opacity={0.06} variant="gold" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-[#F2EDE2]/85">
              <span className="text-[#E9C176] font-bold">الرقية من القرآن والسنة</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{RECITATION_CATEGORIES.length} أقسام مقروءة</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{RUQYAH_ITEMS.length} آية ودعاءً موثقاً</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{AUDIO_RUQYAH_SESSIONS.length} جلسات صوتية</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold font-quran leading-snug text-[#F5F1E8]">
              الرقية الشرعية الكاملة من القرآن والسنة
            </h1>

            <p className="text-xs md:text-sm text-[#E8DFC9]/90 leading-relaxed font-sans">
              آيات من القرآن وأدعية ثابتة من السنة مع عدّاد دائري تفاعلي ورقية صوتية مسموعة بمدد مختلفة. التقسيمات المختصرة والمتوسطة والمطولة تنظيمية للتيسير، وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
            <button
              type="button"
              onClick={() => handleSwitchMode(viewMode === 'audio_studio' ? 'interactive' : 'audio_studio')}
              className="min-h-12 px-5 py-2.5 rounded-xl bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] text-[var(--wird-accent-ink)] text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E9C176]"
            >
              {viewMode === 'audio_studio' ? (
                <>
                  <BookOpen className="w-4 h-4" />
                  <span>العودة للقراءة والعداد</span>
                </>
              ) : (
                <>
                  <Headphones className="w-4 h-4" />
                  <span>استمع للرقية المسموعة</span>
                </>
              )}
            </button>

            <WirdMihrabArch size={72} variant="gold" className="hidden xl:block shrink-0" />
          </div>
        </div>
      </section>

      {/* 2. Separated Top-Level Workspace Tabs (2x2 Grid on Mobile, 4-Column Bar on Desktop) */}
      <nav
        aria-label="طرق استخدام الرقية"
        className="wird-card rounded-2xl p-1.5 grid grid-cols-2 lg:flex items-center gap-1.5"
      >
        {workspaceTabs.map(tab => {
          const isActive = viewMode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSwitchMode(tab.id)}
              className={`min-h-11 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-center lg:flex-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                isActive
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs'
                  : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)]'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              {tab.countBadge && (
                <span
                  className={`text-[11px] font-mono tabular-nums shrink-0 ${
                    isActive ? 'opacity-85' : 'text-[var(--wird-muted)]'
                  }`}
                >
                  ({tab.countBadge})
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 3A. DEDICATED AUDIO RUQYAH STUDIO TAB */}
      {viewMode === 'audio_studio' && (
        <AudioRuqyahStudio
          reciters={reciters}
          selectedReciterId={selectedReciterId}
          onReciterChange={handleAudioReciterChange}
          playbackRate={playbackRate}
          onPlaybackRateChange={handlePlaybackRateChange}
          audioVolume={audioVolume}
          onAudioVolumeChange={setAudioVolume}
          loopEnabled={sessionLoopEnabled}
          onToggleLoop={() => setSessionLoopEnabled(prev => !prev)}
          sleepTimerMinutes={sleepTimerMinutes}
          sleepTimerRemainingSec={sleepTimerRemainingSec}
          onSelectSleepTimer={handleSelectSleepTimer}
          playback={{
            sessionId: activeAudioSessionId,
            isPlaying: audioIsPlaying,
            isLoading: audioIsLoading,
            currentTitle: audioCurrentItemTitle,
            currentSurahName: audioCurrentSurahName,
            currentSurahNumber: audioCurrentSurahNumber,
            currentAyahNumber: audioCurrentAyahNumber,
            currentAyahText: audioCurrentAyahText,
            currentPassageIndex: audioCurrentPassageIndex,
            queuePosition: audioQueuePosition,
            queueLength: audioQueueLength,
            currentTime: audioCurrentTime,
            duration: audioDuration,
            error: audioError,
            statusMessage: audioStatusMessage
          }}
          onPlaySession={(session, startIdx = 0) => void startTimedAudioSession(session, startIdx)}
          onTogglePlayPause={toggleAudioPlayback}
          onStop={stopRuqyahAudio}
          onPrevPassage={() => handleJumpSessionPassage(-1)}
          onNextPassage={() => handleJumpSessionPassage(1)}
          onSeek={nextTime => {
            setAudioCurrentTime(nextTime);
            if (audioRef.current) audioRef.current.currentTime = nextTime;
          }}
        />
      )}

      {/* 3B. SEPARATED SHARIAH GUIDELINES & ETIQUETTES TAB */}
      {viewMode === 'guidelines' && (
        <section aria-label="آداب وإرشادات الرقية الشرعية" className="space-y-4">
          <div className="wird-card rounded-2xl p-5 space-y-1.5">
            <h2 className="text-lg font-extrabold font-quran text-[var(--wird-text)]">
              الضوابط والآداب الشرعية للرقية
            </h2>
            <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
              توجيهات أصولية موثقة بالقرآن والسنة الصحيحة لضبط نية الرقية وهيئتها والجمع بين التوكل والأخذ بالأسباب الطبية المشروعة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {RUQYAH_GUIDELINES.map((guide, index) => (
              <article
                key={guide.id}
                className="wird-card rounded-2xl p-5 border border-[var(--wird-border)] flex flex-col justify-between gap-4"
              >
                <div className="space-y-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className="font-mono text-xs font-bold text-[var(--wird-muted)] tabular-nums mt-1">
                      {String(index + 1).padStart(2, '0')}.
                    </span>
                    <h3 className="text-base font-bold font-quran text-[var(--wird-text)] leading-snug">
                      {guide.title}
                    </h3>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--wird-text)]">
                    {guide.text}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--wird-border)] space-y-1 text-xs text-[var(--wird-muted)]">
                  {guide.explanation && (
                    <p className="leading-relaxed">
                      <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">البيان: </span>
                      {guide.explanation}
                    </p>
                  )}
                  {guide.source && (
                    <p className="text-[11px]">
                      المصدر: {guide.source}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* 3C. INTERACTIVE READING & CIRCULAR COUNTER TAB */}
      {viewMode === 'interactive' && (
        <div
          className="space-y-6"
          onKeyDown={event => {
            if (showResetConfirmation && event.key === 'Escape') {
              event.preventDefault();
              closeResetConfirmation();
            }
          }}
        >
          {/* Category Cards Hub Directory */}
          <section aria-label="تصنيفات الرقية" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold font-quran text-[var(--wird-text)]">
                  أقسام الرقية المقروءة
                </h2>
                <p className="text-xs text-[var(--wird-muted)]">
                  اختر القسم المناسب لقراءته مع العدّاد الدائري التفاعلي وتلاوة الآيات القرآنية
                </p>
              </div>
              <span className="text-xs font-semibold tabular-nums text-[var(--wird-muted)]">
                <span className="font-mono">{RECITATION_CATEGORIES.length}</span> أقسام
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {RECITATION_CATEGORIES.map(cat => {
                const isActive = activeCategory === cat.id;
                const catItems = getRuqyahItemsByCategory(cat.id);
                const catCompleted = catItems.filter(i =>
                  i.repeatTarget === null ? (counts[i.id] || 0) > 0 : (counts[i.id] || 0) >= i.repeatTarget
                ).length;
                const catPercent = catItems.length > 0 ? Math.round((catCompleted / catItems.length) * 100) : 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => {
                      stopRuqyahAudio();
                      setShowResetConfirmation(false);
                      setSearchQuery('');
                      setActiveCategory(cat.id);
                    }}
                    className={`min-h-12 text-right p-4 rounded-2xl border transition-all duration-150 flex flex-col justify-between gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                      isActive
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-border-gold)] shadow-sm'
                        : 'wird-card text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 w-full">
                      <span
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          isActive
                            ? 'bg-white/15 text-[#E9C176]'
                            : 'bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border)]'
                        }`}
                      >
                        {renderCategoryIcon(cat.id, 'w-4 h-4')}
                      </span>
                      <span
                        className={`text-[11px] font-mono tabular-nums font-bold ${
                          isActive ? 'opacity-85' : 'text-[var(--wird-muted)]'
                        }`}
                      >
                        {catCompleted}/{catItems.length}
                      </span>
                    </div>

                    <div className="space-y-0.5 w-full">
                      <span className="block text-sm font-extrabold font-quran leading-snug">
                        {cat.label}
                      </span>
                      <span
                        className={`block text-[11px] leading-snug line-clamp-1 ${
                          isActive ? 'opacity-80' : 'text-[var(--wird-muted)]'
                        }`}
                      >
                        {cat.focusHint}
                      </span>
                    </div>

                    <div className={`w-full h-1.5 rounded-full overflow-hidden ${isActive ? 'bg-white/20' : 'bg-[var(--wird-surface-muted)]'}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isActive ? 'bg-[#E9C176]' : 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)]'
                        }`}
                        style={{ width: `${catPercent}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Compact Source Disclosure & Display Settings */}
          <div className="wird-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[var(--wird-text)]">مصدر الآيات والتلاوة</p>
              <p className="text-xs text-[var(--wird-muted)] mt-0.5">
                نصوص الآيات من مصحف وِرد المعتمد، والتلاوة الصوتية تُحمّل من خدمة القرآن المحددة داخل المشغل.
              </p>
            </div>
            <div
              className="sm:min-w-52 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2 text-xs text-[var(--wird-muted)]"
              role="status"
            >
              المتاح هنا تلاوة الآيات القرآنية فقط، وليس تسجيلًا كاملًا يضم الأدعية
            </div>
          </div>

          <ReadingDisplaySettingsMenu
            viewLabel="الرقية الشرعية"
            preferences={displayPreferences}
            onUpdate={updateDisplayPreferences}
            onReset={resetDisplayPreferences}
            fontLabel="حجم خط الآيات والأدعية"
          />

          <div className="space-y-5" style={{ zoom: displayPreferences.uiScale / 100 }}>
            {/* Section Audio Player (Preserves all exact audio lock & E2E contracts) */}
            {activeCategory !== 'guidelines' && (
              <section
                aria-label="مشغل تلاوة آيات الرقية"
                className="wird-card rounded-2xl border border-[var(--wird-border)] p-4 md:p-5 space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-[var(--wird-text)]">تلاوة آيات الرقية</h2>
                    <p className="mt-1 text-xs leading-relaxed text-[var(--wird-muted)]">
                      تشغيل متتابع للآيات القرآنية المعروضة، مع إبقاء نص المصحف من نسخة وِرد المعتمدة. لا تُحتسب التلاوة تلقائيًا ضمن عدادات القراءة.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="flex flex-col gap-1 text-xs font-semibold text-[var(--wird-text)] min-w-0 flex-1 sm:flex-initial">
                      <span>القارئ</span>
                      <select
                        aria-label="اختيار قارئ الرقية"
                        value={selectedReciterId}
                        onChange={event => handleAudioReciterChange(event.target.value)}
                        className="min-h-11 w-full sm:min-w-48 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2 text-xs text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                      >
                        {reciters.map(reciter => (
                          <option key={reciter.id} value={reciter.id}>
                            {reciter.arabicName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => startRuqyahAudio()}
                      disabled={audioIsLoading || !currentItems.some(item => item.type === 'quran')}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] px-4 py-2.5 text-xs font-bold text-[var(--wird-primary-ink)] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                    >
                      <Play className="w-4 h-4" />
                      <span>تشغيل آيات القسم</span>
                    </button>
                    {audioQueueLength > 0 && !activeAudioSessionId && (
                      <>
                        <button
                          type="button"
                          onClick={toggleAudioPlayback}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-xs font-bold text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                        >
                          {audioIsPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          <span>{audioIsPlaying ? 'إيقاف مؤقت' : 'استكمال'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={stopRuqyahAudio}
                          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] px-3 py-2.5 text-xs font-bold text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                        >
                          <Square className="w-3.5 h-3.5" />
                          <span>إيقاف</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {audioQueueLength > 0 && !activeAudioSessionId && (
                  <div className="space-y-2.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <p role="status" aria-live="polite" className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                        {audioIsLoading
                          ? 'جارٍ تحميل التلاوة...'
                          : audioIsPlaying
                          ? 'يتم التشغيل: ' + audioCurrentItemTitle
                          : 'متوقف مؤقتًا: ' + audioCurrentItemTitle}
                      </p>
                      <span className="font-mono tabular-nums text-[var(--wird-muted)]">
                        {audioQueuePosition} / {audioQueueRef.current.length} — {audioQueueLabel}
                      </span>
                    </div>
                    <div
                      role="progressbar"
                      aria-label="تقدم قائمة التلاوة"
                      aria-valuemin={0}
                      aria-valuemax={audioQueueRef.current.length}
                      aria-valuenow={audioQueuePosition}
                      aria-valuetext={`الآية ${audioQueuePosition} من ${audioQueueRef.current.length}`}
                      className="h-2 overflow-hidden rounded-full bg-[var(--wird-border)]"
                    >
                      <div
                        className="h-full rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] transition-[width]"
                        style={{
                          width: `${audioQueueLength ? (audioQueuePosition / audioQueueRef.current.length) * 100 : 0}%`
                        }}
                      />
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <input
                        type="range"
                        min="0"
                        max={audioDuration || 0}
                        step="0.1"
                        value={Math.min(audioCurrentTime, audioDuration || 0)}
                        disabled={!audioDuration}
                        aria-label="موضع التلاوة الصوتية"
                        onChange={event => {
                          const nextTime = Number(event.target.value);
                          setAudioCurrentTime(nextTime);
                          if (audioRef.current) audioRef.current.currentTime = nextTime;
                        }}
                        className="min-h-11 w-full accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)] disabled:opacity-50"
                      />
                      <span className="shrink-0 font-mono tabular-nums text-[11px] text-[var(--wird-muted)]">
                        {formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}
                      </span>
                      <label className="flex shrink-0 items-center gap-2 text-[11px] text-[var(--wird-muted)]">
                        <Volume2 className="w-4 h-4" />
                        <span>الصوت</span>
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.05"
                          value={audioVolume}
                          aria-label="مستوى صوت التلاوة"
                          onChange={event => setAudioVolume(Number(event.target.value))}
                          className="min-h-11 w-20 accent-[var(--wird-primary)] dark:accent-[var(--wird-accent)]"
                        />
                      </label>
                    </div>
                  </div>
                )}
                {audioError && !activeAudioSessionId && (
                  <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">
                    {audioError}
                  </p>
                )}
                {audioStatusMessage && !activeAudioSessionId && (
                  <p role="status" className="text-xs text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                    {audioStatusMessage}
                  </p>
                )}
                <p className="text-[10px] text-[var(--wird-muted)]">
                  المصدر الصوتي: Al Quran Cloud — تلاوات الآيات من القراء المعتمدين في القائمة. التسجيلات الكاملة التي تتضمن الأدعية لا تزال قيد التحقق.
                </p>
              </section>
            )}

            {/* Focused Category Progress & Reading Ergonomics Toolbar (Matching Adhkar Redesign) */}
            {activeCategory !== 'guidelines' && (
              <div className="wird-card rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-lg font-extrabold font-quran text-[var(--wird-text)]">
                      {activeCategoryMeta.label}
                    </h3>
                    <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                      {activeCategoryMeta.description}
                    </p>
                  </div>
                  <div className="text-xs sm:text-sm font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">
                    <span className="font-mono">
                      {completedCount} / {trackedItems.length}
                    </span>{' '}
                    مكتمل (<span className="font-mono">{progressPercent}%</span>)
                  </div>
                </div>

                <div
                  role="progressbar"
                  aria-label="نسبة إنجاز رقية القسم الحالي"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progressPercent}
                  className="w-full bg-[var(--wird-surface-muted)] h-2 rounded-full overflow-hidden"
                >
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${
                      progressPercent === 100
                        ? 'bg-emerald-600 dark:bg-emerald-400'
                        : 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)]'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Search inside category */}
                {currentItems.length > 8 && (
                  <div className="relative">
                    <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="search"
                      aria-label={`البحث داخل ${activeCategoryMeta.label}`}
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder={`ابحث داخل ${activeCategoryMeta.label} (مثل: الكرسي، الشفاء، الفلق)...`}
                      className="w-full min-h-11 pr-10 pl-9 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        aria-label="مسح البحث"
                        onClick={() => setSearchQuery('')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 min-h-8 min-w-8 flex items-center justify-center text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}

                {/* Reading Controls Row: Font Size Stepper + Show/Hide Explanation & Source + Auto Advance + Reset */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--wird-border)]">
                  <div className="flex flex-wrap items-center gap-2">
                    <div
                      role="group"
                      aria-label="التحكم بحجم خط الرقية"
                      className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
                    >
                      <button
                        type="button"
                        onClick={() => handleStepFontSize(-2)}
                        disabled={displayPreferences.fontSize <= 18}
                        aria-label="تصغير حجم خط الرقية"
                        className="min-h-9 min-w-9 px-2 rounded-lg text-xs font-bold text-[var(--wird-text)] hover:bg-[var(--wird-surface)] disabled:opacity-35 transition-colors whitespace-nowrap"
                      >
                        أ-
                      </button>
                      <span className="px-2 text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap tabular-nums">
                        الخط: <span className="font-mono">{displayPreferences.fontSize}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleStepFontSize(2)}
                        disabled={displayPreferences.fontSize >= 34}
                        aria-label="تكبير حجم خط الرقية"
                        className="min-h-9 min-w-9 px-2 rounded-lg text-xs font-bold text-[var(--wird-text)] hover:bg-[var(--wird-surface)] disabled:opacity-35 transition-colors whitespace-nowrap"
                      >
                        أ+
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-pressed={showExplanationAndSource}
                      onClick={handleToggleExplanationAndSource}
                      className={`min-h-11 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                        showExplanationAndSource
                          ? 'bg-[var(--wird-accent-soft)] border-[var(--wird-border-gold)] text-[var(--wird-text)]'
                          : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)]'
                      }`}
                    >
                      {showExplanationAndSource ? (
                        <Eye className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showExplanationAndSource ? 'إخفاء البيان والتخريج' : 'إظهار البيان والتخريج'}
                      </span>
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-xs font-medium text-[var(--wird-muted)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoAdvance}
                        onChange={e => setAutoAdvance(e.target.checked)}
                        className="w-4 h-4 rounded text-[var(--wird-primary)] dark:text-[var(--wird-accent)] focus:ring-[var(--wird-accent)]"
                      />
                      <span>الانتقال التلقائي</span>
                    </label>

                    <button
                      type="button"
                      ref={resetTriggerRef}
                      onClick={() => setShowResetConfirmation(true)}
                      disabled={!progressHydrated || progressCorrupt || !progressDeviceId}
                      aria-expanded={showResetConfirmation}
                      aria-controls="ruqyah-reset-confirmation"
                      className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[var(--wird-surface-muted)] hover:border-[var(--wird-border-gold)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--wird-text)] rounded-xl text-xs font-semibold transition-colors border border-[var(--wird-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                      title={progressCorrupt ? 'أعد ضبط سجل الرقية التالف من رسالة الاسترداد أعلاه' : 'إعادة ضبط عداد القسم'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>إعادة الضبط</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {showResetConfirmation && (
              <div
                id="ruqyah-reset-confirmation"
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] p-4"
                role="group"
                aria-labelledby="ruqyah-reset-confirmation-title"
                aria-describedby="ruqyah-reset-confirmation-description"
                aria-live="polite"
              >
                <div className="min-w-0">
                  <p id="ruqyah-reset-confirmation-title" className="text-sm font-bold text-[var(--wird-text)]">
                    تأكيد إعادة ضبط القسم
                  </p>
                  <p id="ruqyah-reset-confirmation-description" className="mt-1 text-xs leading-relaxed text-[var(--wird-muted)]">
                    سيتم تصفير عدادات هذا القسم فقط. لن تتغير نصوص القرآن أو الأدعية أو بيانات الأقسام الأخرى.
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={closeResetConfirmation}
                    className="min-h-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface)] px-4 py-2 text-xs font-bold text-[var(--wird-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleResetCategoryCounts}
                    disabled={!progressHydrated || progressCorrupt || !progressDeviceId}
                    className="min-h-11 rounded-xl bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] px-4 py-2 text-xs font-bold text-[var(--wird-accent-ink)] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)]"
                  >
                    تأكيد إعادة الضبط
                  </button>
                </div>
              </div>
            )}

            {/* Redesigned Interactive Ruqyah Cards with Circular Countdown Counter */}
            <div className={ruqyahListSpacing}>
              {filteredItems.map((item, idx) => {
                const currentCount = counts[item.id] || 0;
                const isCompleted =
                  item.type !== 'guideline' &&
                  (item.repeatTarget === null ? currentCount > 0 : currentCount >= item.repeatTarget);
                const isCounterDisabled =
                  !progressDeviceId ||
                  currentCount >= 1_000_000 ||
                  (item.repeatTarget !== null && currentCount >= item.repeatTarget);
                const isPlayingThis = audioCurrentItemId === item.id && audioIsPlaying && !activeAudioSessionId;

                return (
                  <article
                    key={item.id}
                    id={`ruqyah-card-${item.id}`}
                    onClick={event => {
                      if ((event.target as HTMLElement).closest('button, a, input, select, label')) return;
                      if (!isCounterDisabled) handleItemClick(item);
                    }}
                    className={`group relative wird-card rounded-3xl ${ruqyahCardPadding} border transition-all duration-200 ${
                      !isCounterDisabled ? 'cursor-pointer' : ''
                    } ${
                      isCompleted
                        ? 'border-emerald-600/35 dark:border-emerald-400/35 bg-emerald-600/[0.03] dark:bg-emerald-400/[0.05]'
                        : 'border-[var(--wird-border)] hover:border-[var(--wird-border-gold)]'
                    }`}
                  >
                    {/* Top Row: Clean Zero-Pill Header & Utility Actions */}
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xs font-bold text-[var(--wird-muted)] tabular-nums">
                            {String(idx + 1).padStart(2, '0')}.
                          </span>
                          <h3 className="text-base font-bold font-quran text-[var(--wird-text)] leading-snug">
                            {item.title}
                          </h3>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--wird-muted)]">
                          <span className="font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                            {item.type === 'quran' ? 'قرآن كريم' : 'دعاء نبوي مأثور'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {item.repeatTarget === null
                              ? 'قراءة مفتوحة (بلا عدد مقيّد)'
                              : `التكرار المأثور: ${item.repeatTarget} مرات`}
                          </span>
                          {item.surahName && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="tabular-nums">
                                سورة {item.surahName} ({item.verseRange})
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Utility Actions (Audio, Copy, Single-Item Reset) */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.type === 'quran' && (
                          <button
                            type="button"
                            onClick={() => toggleItemAudio(item)}
                            aria-pressed={isPlayingThis}
                            aria-label={isPlayingThis ? 'إيقاف تلاوة ' + item.title : 'تشغيل تلاوة ' + item.title}
                            className={`flex min-h-11 shrink-0 items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-ring)] ${
                              isPlayingThis
                                ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                                : 'bg-[var(--wird-primary)] hover:bg-[var(--wird-primary-hover)] text-[var(--wird-primary-ink)]'
                            }`}
                          >
                            {isPlayingThis ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            <span>{isPlayingThis ? 'إيقاف مؤقت' : 'استمع للآيات'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyItem(item)}
                          aria-label={`نسخ ${item.title}`}
                          className="min-h-11 min-w-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] flex items-center justify-center transition-colors"
                        >
                          {copiedItemId === item.id ? (
                            <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>

                        {currentCount > 0 && (
                          <button
                            type="button"
                            onClick={() => handleResetSingleItem(item)}
                            aria-label={`إعادة ضبط عدّاد ${item.title}`}
                            className="min-h-11 min-w-11 rounded-xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] hover:text-[var(--wird-text)] flex items-center justify-center transition-colors"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Main Body: Text + Prominent Circular Counter Ring side by side */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-5 py-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`text-[var(--wird-text)] ${
                            item.type === 'quran' ? 'font-quran tracking-normal' : 'hadith-matn font-medium'
                          }`}
                          style={{
                            fontSize: `${item.type === 'quran' ? displayPreferences.fontSize : Math.max(16, displayPreferences.fontSize - 2)}px`,
                            lineHeight: ruqyahLineHeight,
                          }}
                        >
                          {item.type === 'quran'
                            ? quranLoadingItems[item.id]
                              ? <span role="status" className="text-sm font-sans text-[var(--wird-muted)]">جارٍ تحميل الآيات من المصحف المحلي المعتمد…</span>
                              : quranErrors[item.id]
                                ? <span role="alert" className="text-sm font-sans text-rose-700 dark:text-rose-300">
                                  {quranErrors[item.id]}
                                  {!isOnline && <span className="block mt-1">أنت غير متصل بالإنترنت. أعد المحاولة بعد استعادة الاتصال.</span>}
                                  <button
                                    type="button"
                                    onClick={() => setQuranRetryNonce(value => value + 1)}
                                    disabled={!isOnline}
                                    aria-label={`إعادة تحميل آيات ${item.title}`}
                                    className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-current/30 px-3 py-1 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    إعادة المحاولة
                                  </button>
                                </span>
                                : quranAyahsByItem[item.id]
                                  ? quranAyahsByItem[item.id].map((ayah, ayahIndex, ayahsArr) => (
                                    <React.Fragment key={ayah.number}>
                                      <QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>
                                        {ayah.text}
                                      </QuranText>
                                      {ayahIndex < ayahsArr.length - 1 ? ' ۞ ' : ''}
                                    </React.Fragment>
                                  ))
                                  : <span role="status" className="text-sm font-sans text-[var(--wird-muted)]">لم يتم تحميل نص الآيات بعد.</span>
                            : item.text}
                        </p>
                      </div>

                      {item.type !== 'guideline' && (
                        <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 pt-3 sm:pt-0 border-t sm:border-t-0 border-[var(--wird-border)] shrink-0">
                          <span className="text-[11px] text-[var(--wird-muted)] sm:text-center">
                            {isCompleted && item.repeatTarget !== null
                              ? 'اكتمل التكرار'
                              : 'اضغط على البطاقة أو الحلقة للعدّ'}
                          </span>
                          <RuqyahCountdownRing
                            title={item.title}
                            currentCount={currentCount}
                            repeatTarget={item.repeatTarget}
                            disabled={isCounterDisabled}
                            onTap={() => handleItemClick(item)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Toggleable Explanation & Primary Source Footer */}
                    {showExplanationAndSource && (item.explanation || item.source) && (
                      <div className="mt-4 pt-3 border-t border-[var(--wird-border)] space-y-1 text-xs text-[var(--wird-muted)]">
                        {item.explanation && (
                          <p className="leading-relaxed">
                            <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                              البيان والتخريج:{' '}
                            </span>
                            {item.explanation}
                          </p>
                        )}
                        {item.source && (
                          <p className="text-[11px] text-[var(--wird-muted)]">
                            المصدر: {item.source}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="wird-card rounded-2xl p-8 text-center space-y-2">
                  <p className="text-sm font-bold text-[var(--wird-text)]">
                    لا توجد عناصر مطابقة للبحث داخل هذا القسم
                  </p>
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline"
                  >
                    عرض جميع عناصر القسم
                  </button>
                </div>
              )}
            </div>

            {/* Category Completion Banner */}
            {trackedItems.length > 0 && progressPercent === 100 && (
              <div className="wird-card rounded-2xl p-6 text-center space-y-2.5 border-emerald-600/35 dark:border-emerald-400/35">
                <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold font-quran text-[var(--wird-text)]">
                  بارك الله فيك — أتممت جميع عناصر «{activeCategoryMeta.label}»
                </h4>
                <p className="text-xs text-[var(--wird-muted)]">
                  أسأل الله العظيم رب العرش العظيم أن يرزقك الشفاء والعافية والسكينة.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3D. EXTENDED VERIFIED QURAN LOCATOR LIBRARY TAB */}
      {viewMode === 'api_library' && (
        <div style={{ zoom: displayPreferences.uiScale / 100 }}>
          <RuqyahApiLibrary />
        </div>
      )}
    </div>
  );
};
