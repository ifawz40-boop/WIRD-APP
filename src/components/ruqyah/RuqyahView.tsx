import React, { useState, useEffect, useRef } from 'react';
import { getRuqyahAudioQueueForItems, getRuqyahAyahs } from '../../services/ruqyahContentService';
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
  savePreferredReciter,
  subscribeAudioPreferences
} from '../../services/audioPreferences';
import { globalAudioCoordinator } from '../../services/globalAudioCoordinator';
import { RuqyahApiLibrary } from './RuqyahApiLibrary';
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
} from 'lucide-react';
import { getRuqyahItemsByCategory } from '../../data/ruqyahData';
import type { RuqyahCategory, RuqyahItem } from '../../data/ruqyahData';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { ReadingDisplaySettingsMenu, useReadingDisplayPreferences } from '../shared/DisplaySettingsMenu';
import { READING_PAGE_WIDTH_CLASSES } from '../../services/readingDisplayPreferences';

interface RuqyahViewProps {
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

const CATEGORY_TABS: { id: RuqyahCategory; label: string; iconName: string; duration: string }[] = [
  { id: 'brief', label: 'الرقية المختصرة', iconName: 'Sparkles', duration: 'مختصر' },
  { id: 'medium', label: 'الرقية المتوسطة', iconName: 'BookOpen', duration: 'متوسط' },
  { id: 'full', label: 'الرقية المطولة الكاملة', iconName: 'ShieldCheck', duration: 'مطول' },
  { id: 'eye_envy', label: 'رقية العين والحسد', iconName: 'Heart', duration: 'حسب المحتوى' },
  { id: 'illness', label: 'رقية المرض والألم', iconName: 'Sparkles', duration: 'حسب المحتوى' },
  { id: 'guidelines', label: 'آداب وإرشادات الرقية', iconName: 'Info', duration: 'إرشادات' },
];

export const RuqyahView: React.FC<RuqyahViewProps> = ({ onToast }) => {
  const currentStorageScope = StorageService.getStorageScope();
  const {
    preferences: displayPreferences,
    updatePreferences: updateDisplayPreferences,
    resetPreferences: resetDisplayPreferences,
  } = useReadingDisplayPreferences('ruqyah');
  const [activeCategory, setActiveCategory] = useState<RuqyahCategory>('brief');
  const [viewMode, setViewMode] = useState<'interactive' | 'api_library'>('interactive');
  
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
  const [reciters, setReciters] = useState(FALLBACK_QURAN_RECITERS);
  const [selectedReciterId, setSelectedReciterId] = useState<string>(() => getSavedRuqyahReciterId('ar.husary'));
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
  const [quranAyahsByItem, setQuranAyahsByItem] = useState<Record<string, Ayah[]>>({});
  const [quranLoadingItems, setQuranLoadingItems] = useState<Record<string, boolean>>({});
  const [quranErrors, setQuranErrors] = useState<Record<string, string>>({});
  const [quranRetryNonce, setQuranRetryNonce] = useState(0);
  const [isOnline, setIsOnline] = useState(() => typeof navigator === 'undefined' || navigator.onLine);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const selectedReciterIdRef = useRef(selectedReciterId);
  const stopRuqyahAudioRef = useRef<() => void>(() => {});
  const audioQueueRef = useRef<Array<{ globalAyahNumber: number; itemId: string; title: string }>>([]);
  const audioQueueIndexRef = useRef(0);
  const audioRequestIdRef = useRef(0);
  const audioBuildRequestIdRef = useRef(0);
  const autoAdvanceTimerRef = useRef<number | null>(null);

  const currentItems = getRuqyahItemsByCategory(activeCategory);

  useEffect(() => {
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

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
      globalAudioCoordinator.releaseFocus('ruqyah');
    }
  };

  const startRuqyahAudio = async (item?: RuqyahItem) => {
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
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
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
      setAudioQueueLabel(item ? item.title : 'آيات قسم ' + CATEGORY_TABS.find(tab => tab.id === activeCategory)?.label);
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

  const stopRuqyahAudio = () => {
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
    setAudioIsPlaying(false);
    setAudioIsLoading(false);
    setAudioQueueLength(0);
    setAudioQueuePosition(0);
    setAudioCurrentItemId(null);
    setAudioCurrentItemTitle('');
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
        globalAudioCoordinator.releaseFocus('ruqyah');
      });
    }
  };

  const handleAudioReciterChange = (reciterId: string) => {
    stopRuqyahAudio();
    setSelectedReciterId(reciterId);
    savePreferredReciter(reciterId);
  };

  const toggleItemAudio = (item: RuqyahItem) => {
    if (audioCurrentItemId === item.id && audioIsPlaying) {
      audioRef.current?.pause();
      setAudioIsPlaying(false);
      globalAudioCoordinator.releaseFocus('ruqyah');
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
      globalAudioCoordinator.releaseFocus('ruqyah');
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
      const currentIndex = currentItems.findIndex(i => i.id === item.id);
      if (currentIndex !== -1 && currentIndex < currentItems.length - 1) {
        const nextId = currentItems[currentIndex + 1].id;
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
  const completedCount = trackedItems.filter(item => item.repeatTarget === null ? (counts[item.id] || 0) > 0 : (counts[item.id] || 0) >= item.repeatTarget).length;
  const progressPercent = trackedItems.length > 0 ? Math.round((completedCount / trackedItems.length) * 100) : 0;

  const ruqyahListSpacing =
    displayPreferences.spacing === 'compact'
      ? 'space-y-3'
      : displayPreferences.spacing === 'relaxed'
      ? 'space-y-6'
      : 'space-y-4';
  const ruqyahCardPadding =
    displayPreferences.spacing === 'compact'
      ? 'p-3.5 sm:p-5'
      : displayPreferences.spacing === 'relaxed'
      ? 'p-6 sm:p-8 md:p-9'
      : 'p-4 sm:p-6 md:p-7';
  const ruqyahLineHeight =
    displayPreferences.spacing === 'compact'
      ? 2.0
      : displayPreferences.spacing === 'relaxed'
      ? 2.75
      : 2.35;

  return (
    <div
      className={`space-y-6 md:space-y-8 pb-20 ${READING_PAGE_WIDTH_CLASSES[displayPreferences.pageWidth]} mx-auto px-1 sm:px-2 overflow-x-hidden transition-all`}
      dir="rtl"
    >
      {progressCorrupt && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/40 bg-[#C59B27]/10 dark:bg-[#E0A96D]/10 p-4">
          <p className="text-sm text-[#142421] dark:text-[#F5F1E8] leading-relaxed">
            تعذر قراءة تقدم الرقية المحفوظ. احتفظنا بالبيانات الأصلية دون استبدالها؛ يمكنك متابعة القراءة دون حفظ حتى تختار إعادة ضبط هذا السجل.
          </p>
          <button type="button" onClick={handleRecoverProgress} className="min-h-11 shrink-0 rounded-xl bg-[#C59B27] dark:bg-[#E0A96D] px-4 py-2 text-xs font-bold text-[#0B132B]">
            إعادة ضبط سجل الرقية
          </button>
        </div>
      )}
      {/* Top Banner / Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#0B132B] via-[#1C4E46] to-[#0B132B] text-white rounded-3xl p-5 sm:p-6 md:p-8 shadow-xl border border-[#C59B27]/35">
        <WirdIslamicPattern opacity={0.07} className="text-[#E0A96D]" />
        <div className="absolute top-0 left-0 -translate-x-1/4 -translate-y-1/4 w-72 h-72 bg-[#C59B27]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0B132B]/70 text-[#E0A96D] border border-[#C59B27]/40 rounded-lg text-xs font-bold">
              <ShieldCheck className="w-4 h-4 text-[#C59B27]" />
              <span>الرقية من القرآن والسنة</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight font-quran leading-relaxed text-[#F5F1E8]">
              الرقية الشرعية الكاملة من القرآن والسنة
            </h1>

            <p className="text-xs md:text-sm text-[#E8DFC9]/90 leading-relaxed font-sans">
              آيات من القرآن وأدعية ثابتة من السنة. التقسيمات المختصرة والمتوسطة والمطولة تنظيمية للتيسير، وليست ترتيبًا نبويًا أو عددًا لازمًا.
            </p>
          </div>

          {/* Mode Switch Controls */}
          <div role="group" aria-label="طرق استخدام الرقية" className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 bg-[#0B132B]/80 rounded-2xl border border-[#C59B27]/35 shadow-inner w-full md:w-auto md:min-w-[320px]">
            <button
              type="button"
              aria-pressed={viewMode === 'interactive'}
              onClick={() => { setShowResetConfirmation(false); setViewMode('interactive'); }}
              className={`flex items-center justify-center gap-2 px-4 py-3 min-h-12 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0A96D] ${
                viewMode === 'interactive'
                  ? 'bg-gradient-to-r from-[#E0A96D] to-[#C59B27] text-[#0B132B] shadow-md'
                  : 'text-[#CBD5E1] hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>القراءة والعداد</span>
            </button>

            <button
              type="button"
              aria-pressed={viewMode === 'api_library'}
              onClick={() => { stopRuqyahAudio(); setShowResetConfirmation(false); setViewMode('api_library'); }}
              className={`flex items-center justify-center gap-2 px-4 py-3 min-h-12 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E0A96D] ${
                viewMode === 'api_library'
                  ? 'bg-gradient-to-r from-[#E0A96D] to-[#C59B27] text-[#0B132B] shadow-md'
                  : 'text-[#CBD5E1] hover:text-white hover:bg-white/10'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>المكتبة الموسعة</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Mode 1: Interactive Reading with Counter */}
      {viewMode === 'interactive' && (
        <div className="space-y-6" onKeyDown={(event) => { if (showResetConfirmation && event.key === 'Escape') { event.preventDefault(); closeResetConfirmation(); } }}>
          <div className="wird-card flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl p-4">
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">مصدر الآيات والتلاوة</p>
              <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mt-1">نصوص الآيات من مصحف وِرد المعتمد، والتلاوة الصوتية تُحمّل من خدمة القرآن المحددة داخل المشغل.</p>
            </div>
            <div className="sm:min-w-52 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 bg-[#F9F6EE] dark:bg-[#0B132B]/70 px-3 py-2 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]" role="status">
              المتاح هنا تلاوة الآيات القرآنية فقط، وليس تسجيلًا كاملًا يضم الأدعية
            </div>
          </div>

          {/* Category Tabs Bar (Horizontal Scrollable Rail for Effortless Mobile & Desktop Browsing) */}
          <HorizontalScrollRail ariaLabel="تصنيفات الرقية" activeKey={activeCategory}>
            {CATEGORY_TABS.map(tab => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => { stopRuqyahAudio(); setShowResetConfirmation(false); setActiveCategory(tab.id); }}
                  className={`shrink-0 snap-start flex items-center gap-2 px-4 py-2.5 min-h-12 rounded-2xl text-xs font-bold transition-all border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
                    isActive
                      ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-sm'
                      : 'bg-white dark:bg-[#111F36] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:bg-[#F2EDE2] dark:hover:bg-[#162744]'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.duration !== 'إرشادات' && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                      isActive ? 'bg-[#C59B27]/25 text-[#F5E6C4]' : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#5B6F6B] dark:text-[#8B9E9B]'
                    }`}>
                      {tab.duration}
                    </span>
                  )}
                </button>
              );
            })}
          </HorizontalScrollRail>

          <ReadingDisplaySettingsMenu
            viewLabel="الرقية الشرعية"
            preferences={displayPreferences}
            onUpdate={updateDisplayPreferences}
            onReset={resetDisplayPreferences}
            fontLabel="حجم خط الآيات والأدعية"
          />

          <div className="space-y-6" style={{ zoom: displayPreferences.uiScale / 100 }}>
          {activeCategory !== 'guidelines' && (
            <section aria-label="مشغل تلاوة آيات الرقية" className="wird-card rounded-2xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 p-4 md:p-5 space-y-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-[#142421] dark:text-[#F5F1E8]">تلاوة آيات الرقية</h2>
                  <p className="mt-1 text-xs leading-relaxed text-[#5B6F6B] dark:text-[#8B9E9B]">تشغيل متتابع للآيات القرآنية المعروضة، مع إبقاء نص المصحف من نسخة وِرد المعتمدة. لا تُحتسب التلاوة تلقائيًا ضمن عدادات القراءة.</p>
                </div>
                <div className="flex flex-wrap items-end gap-2">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-[#142421] dark:text-[#F5F1E8] min-w-0 flex-1 sm:flex-initial">
                    <span>القارئ</span>
                    <select aria-label="اختيار قارئ الرقية" value={selectedReciterId} onChange={event => handleAudioReciterChange(event.target.value)} className="min-h-11 w-full sm:min-w-48 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2 text-xs text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                      {reciters.map(reciter => <option key={reciter.id} value={reciter.id}>{reciter.arabicName}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={() => startRuqyahAudio()} disabled={audioIsLoading || !currentItems.some(item => item.type === 'quran')} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1C4E46] hover:bg-[#143b35] dark:bg-[#E0A96D] dark:hover:bg-[#f0b97e] px-4 py-2.5 text-xs font-bold text-white dark:text-[#0B132B] disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                    <Play className="w-4 h-4" />
                    <span>تشغيل آيات القسم</span>
                  </button>
                  {audioQueueLength > 0 && (
                    <>
                      <button type="button" onClick={toggleAudioPlayback} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                        {audioIsPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        <span>{audioIsPlaying ? 'إيقاف مؤقت' : 'استكمال'}</span>
                      </button>
                      <button type="button" onClick={stopRuqyahAudio} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-[#F9F6EE] dark:bg-[#0B132B] px-3 py-2.5 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">
                        <Square className="w-3.5 h-3.5" />
                        <span>إيقاف</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
              {audioQueueLength > 0 && (
                <div className="space-y-2.5 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/80 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <p role="status" aria-live="polite" className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                      {audioIsLoading ? 'جارٍ تحميل التلاوة...' : audioIsPlaying ? 'يتم التشغيل: ' + audioCurrentItemTitle : 'متوقف مؤقتًا: ' + audioCurrentItemTitle}
                    </p>
                    <span className="font-mono tabular-nums text-[#5B6F6B] dark:text-[#8B9E9B]">{audioQueuePosition} / {audioQueueRef.current.length} — {audioQueueLabel}</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="تقدم قائمة التلاوة"
                    aria-valuemin={0}
                    aria-valuemax={audioQueueRef.current.length}
                    aria-valuenow={audioQueuePosition}
                    aria-valuetext={`الآية ${audioQueuePosition} من ${audioQueueRef.current.length}`}
                    className="h-2 overflow-hidden rounded-full bg-[#E6DFD0] dark:bg-[#162744]"
                  >
                    <div className="h-full rounded-full bg-[#1C4E46] dark:bg-[#E0A96D] transition-[width]" style={{ width: `${audioQueueLength ? (audioQueuePosition / audioQueueRef.current.length) * 100 : 0}%` }} />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <input type="range" min="0" max={audioDuration || 0} step="0.1" value={Math.min(audioCurrentTime, audioDuration || 0)} disabled={!audioDuration} aria-label="موضع التلاوة الصوتية" onChange={event => { const nextTime = Number(event.target.value); setAudioCurrentTime(nextTime); if (audioRef.current) audioRef.current.currentTime = nextTime; }} className="min-h-11 w-full accent-[#1C4E46] dark:accent-[#E0A96D] disabled:opacity-50" />
                    <span className="shrink-0 font-mono tabular-nums text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">{formatAudioTime(audioCurrentTime)} / {formatAudioTime(audioDuration)}</span>
                    <label className="flex shrink-0 items-center gap-2 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">
                      <Volume2 className="w-4 h-4" />
                      <span>الصوت</span>
                      <input type="range" min="0" max="1" step="0.05" value={audioVolume} aria-label="مستوى صوت التلاوة" onChange={event => setAudioVolume(Number(event.target.value))} className="min-h-11 w-20 accent-[#1C4E46] dark:accent-[#E0A96D]" />
                    </label>
                  </div>
                </div>
              )}
              {audioError && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{audioError}</p>}
              {audioStatusMessage && <p role="status" className="text-xs text-[#1C4E46] dark:text-[#E0A96D]">{audioStatusMessage}</p>}
              <p className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B]">المصدر الصوتي: Al Quran Cloud — تلاوات الآيات من القراء المعتمدين في القائمة. التسجيلات الكاملة التي تتضمن الأدعية لا تزال قيد التحقق.</p>
            </section>
          )}

          {/* Progress Header & Settings Control */}
          {activeCategory !== 'guidelines' && (
            <div className="wird-card rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="w-12 h-12 rounded-2xl bg-[#1C4E46]/10 dark:bg-[#E0A96D]/15 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center font-bold text-sm tabular-nums shrink-0 border border-[#C59B27]/30">
                  {progressPercent}%
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] mb-1.5">
                    <span>نسبة إنجاز رقية القسم الحالي</span>
                    <span className="text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">{completedCount} من {trackedItems.length} عناصر</span>
                  </div>
                  <div role="progressbar" aria-label="نسبة إنجاز رقية القسم الحالي" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent} className="w-full bg-[#F2EDE2] dark:bg-[#162744] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#1C4E46] dark:bg-[#E0A96D] h-full transition-all duration-500 rounded-full"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 self-end md:self-auto">
                <label className="flex items-center gap-2 text-xs font-medium text-[#5B6F6B] dark:text-[#CBD5E1] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoAdvance}
                    onChange={(e) => setAutoAdvance(e.target.checked)}
                    className="w-4 h-4 rounded text-[#1C4E46] focus:ring-[#C59B27] dark:bg-[#0B132B] dark:border-[#E0A96D]/30"
                  />
                  <span>الانتقال التلقائي للبطاقة التالية عند الإكمال</span>
                </label>

                <button
                  type="button"
                  ref={resetTriggerRef}
                  onClick={() => setShowResetConfirmation(true)}
                  disabled={!progressHydrated || progressCorrupt || !progressDeviceId}
                  aria-expanded={showResetConfirmation}
                  aria-controls="ruqyah-reset-confirmation"
                  className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#e7dfd0] dark:hover:bg-[#1e3357] disabled:opacity-50 disabled:cursor-not-allowed text-[#142421] dark:text-[#F5F1E8] rounded-xl text-xs font-semibold transition-colors border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                  title={progressCorrupt ? "أعد ضبط سجل الرقية التالف من رسالة الاسترداد أعلاه" : "إعادة ضبط عداد القسم"}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>إعادة الضبط</span>
                </button>
              </div>
            </div>
          )}

          {showResetConfirmation && (
            <div id="ruqyah-reset-confirmation" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-[#C59B27]/50 dark:border-[#E0A96D]/40 bg-[#C59B27]/10 dark:bg-[#E0A96D]/10 p-4" role="group" aria-labelledby="ruqyah-reset-confirmation-title" aria-describedby="ruqyah-reset-confirmation-description" aria-live="polite">
              <div className="min-w-0">
                <p id="ruqyah-reset-confirmation-title" className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">تأكيد إعادة ضبط القسم</p>
                <p id="ruqyah-reset-confirmation-description" className="mt-1 text-xs leading-relaxed text-[#5B6F6B] dark:text-[#CBD5E1]">سيتم تصفير عدادات هذا القسم فقط. لن تتغير نصوص القرآن أو الأدعية أو بيانات الأقسام الأخرى.</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button type="button" onClick={closeResetConfirmation} className="min-h-11 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#111F36] px-3.5 py-2 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">إلغاء</button>
                <button type="button" onClick={handleResetCategoryCounts} disabled={!progressHydrated || progressCorrupt || !progressDeviceId} className="min-h-11 rounded-xl bg-[#C59B27] hover:bg-[#b1891f] dark:bg-[#E0A96D] dark:hover:bg-[#f0b97e] px-4 py-2 text-xs font-bold text-[#0B132B] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]">تأكيد إعادة الضبط</button>
              </div>
            </div>
          )}

          {/* Cards List */}
          <div className={ruqyahListSpacing}>
            {currentItems.map((item, idx) => {
              const currentCount = counts[item.id] || 0;
              const isCompleted = item.type !== 'guideline' && (item.repeatTarget === null ? currentCount > 0 : currentCount >= item.repeatTarget);

              return (
                <article
                  key={item.id}
                  id={`ruqyah-card-${item.id}`}
                  className={`group relative wird-card rounded-3xl ${ruqyahCardPadding} border transition-all duration-300 ${
                    isCompleted
                      ? 'border-[#1C4E46]/60 dark:border-[#E0A96D]/60 bg-[#1C4E46]/[0.04] dark:bg-[#1E4A47]/20 shadow-xs'
                      : 'border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27]/55 dark:hover:border-[#E0A96D]/50 hover:shadow-md'
                  }`}
                >
                  {/* Card Top Row: Number, Type badge, Title, Audio Button */}
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <span className="w-7 h-7 shrink-0 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-[#1C4E46] dark:text-[#E0A96D] font-bold text-xs flex items-center justify-center font-mono tabular-nums">
                        {idx + 1}
                      </span>

                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8]">
                            {item.title}
                          </h3>
                          {item.surahName && (
                            <span className="text-[11px] text-[#1C4E46] dark:text-[#E0A96D] bg-[#1C4E46]/10 dark:bg-[#E0A96D]/15 border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 px-2 py-0.5 rounded-md font-semibold tabular-nums">
                              سورة {item.surahName} [{item.verseRange}]
                            </span>
                          )}
                        </div>
                        {item.source && (
                          <p className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] mt-0.5">
                            المصدر: {item.source}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Audio Play Button for Verse */}
                    {item.type === 'quran' && (
                      <button
                        type="button"
                        onClick={() => toggleItemAudio(item)}
                        aria-pressed={audioCurrentItemId === item.id && audioIsPlaying}
                        aria-label={audioCurrentItemId === item.id && audioIsPlaying ? 'إيقاف تلاوة ' + item.title : 'تشغيل تلاوة ' + item.title}
                        className={`flex min-h-11 shrink-0 items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27] ${
                          audioCurrentItemId === item.id && audioIsPlaying
                            ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B]'
                            : 'text-[#1C4E46] dark:text-[#E0A96D] bg-[#F2EDE2] dark:bg-[#162744] border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 hover:bg-[#e7dfd0] dark:hover:bg-[#1d3257]'
                        }`}
                      >
                        {audioCurrentItemId === item.id && audioIsPlaying ? <Pause className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                        <span>{audioCurrentItemId === item.id && audioIsPlaying ? 'إيقاف مؤقت' : 'استمع للآيات'}</span>
                      </button>
                    )}
                  </div>

                  {/* Text Content */}
                  <div className="my-4 p-4 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20">
                    <p
                      className={`text-[#142421] dark:text-[#F5F1E8] text-center font-quran ${
                        item.type === 'quran' ? 'tracking-normal' : 'font-sans font-medium'
                      }`}
                      style={{
                        fontSize: `${item.type === 'quran' ? displayPreferences.fontSize : Math.max(16, displayPreferences.fontSize - 3)}px`,
                        lineHeight: ruqyahLineHeight,
                      }}
                    >
                      {item.type === 'quran'
                        ? quranLoadingItems[item.id]
                          ? <span role="status" className="text-sm font-sans text-stone-500">جارٍ تحميل الآيات من المصحف المحلي المعتمد…</span>
                          : quranErrors[item.id]
                            ? <span role="alert" className="text-sm font-sans text-red-700 dark:text-red-300">
                              {quranErrors[item.id]}
                              {!isOnline && <span className="block mt-1">أنت غير متصل بالإنترنت. أعد المحاولة بعد استعادة الاتصال.</span>}
                              <button type="button" onClick={() => setQuranRetryNonce(value => value + 1)} disabled={!isOnline}
                                aria-label={`إعادة تحميل آيات ${item.title}`}
                                className="mt-2 inline-flex min-h-9 items-center rounded-lg border border-current/30 px-3 py-1 text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed">
                                إعادة المحاولة
                              </button>
                            </span>
                            : quranAyahsByItem[item.id]
                              ? quranAyahsByItem[item.id].map(ayah => <React.Fragment key={ayah.number}><QuranText surahNumber={ayah.surahNumber} ayahNumber={ayah.numberInSurah}>{ayah.text}</QuranText>{' ۞ '}</React.Fragment>)
                              : <span role="status" className="text-sm font-sans text-stone-500">لم يتم تحميل نص الآيات بعد.</span>
                        : item.text}
                    </p>
                  </div>

                  {/* Explanation Note */}
                  {item.explanation && (
                    <div className="flex items-start gap-2 text-xs text-[#5B6F6B] dark:text-[#CBD5E1] bg-[#F9F6EE]/80 dark:bg-[#0B132B]/45 p-3 rounded-xl border border-[#1C4E46]/10 dark:border-[#E0A96D]/15 mb-4">
                      <Info className="w-4 h-4 text-[#1C4E46] dark:text-[#E0A96D] shrink-0 mt-0.5" />
                      <p className="leading-relaxed">{item.explanation}</p>
                    </div>
                  )}

                  {/* Card Bottom Row: Counter Controls */}
                  {item.type !== 'guideline' && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
                      <div className="flex items-center gap-2">
                        {isCompleted ? (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#1C4E46] dark:text-[#E0A96D] bg-[#1C4E46]/10 dark:bg-[#E0A96D]/15 px-3 py-1 rounded-xl tabular-nums">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{item.repeatTarget === null ? 'تم تسجيل القراءة' : `اكتمل التكرار المحدد (${item.repeatTarget})`}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-medium">
                            {item.repeatTarget === null ? 'لا يوجد عدد ثابت؛ سجّل كل قراءة على حدة' : 'سجّل القراءة بعد إتمامها'}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleItemClick(item)}
                        disabled={!progressDeviceId || currentCount >= 1_000_000 || (item.repeatTarget !== null && currentCount >= item.repeatTarget)}
                        aria-label={item.repeatTarget === null
                          ? `تسجيل قراءة جديدة لـ ${item.title}. العدد الحالي ${currentCount}`
                          : `تسجيل قراءة ${item.title}`}
                        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#1C4E46] hover:bg-[#143b35] dark:bg-[#E0A96D] dark:hover:bg-[#f0b97e] disabled:bg-[#E6DFD0] disabled:text-[#5B6F6B] dark:disabled:bg-[#162744] dark:disabled:text-[#8B9E9B] text-white dark:text-[#0B132B] px-4 py-2 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{item.repeatTarget !== null && isCompleted ? 'اكتمل' : currentCount > 0 ? 'تسجيل قراءة أخرى' : 'سجل قراءة'}</span>
                      </button>

                      {/* Repetition Counter Badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">{item.repeatTarget === null ? 'عدد القراءات:' : 'المتبقي:'}</span>
                        <div
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          aria-label={item.repeatTarget === null
                            ? `عدد القراءات: ${currentCount}`
                            : `المتبقي: ${Math.max(0, item.repeatTarget - currentCount)} من ${item.repeatTarget}`}
                          className={`px-4 py-2 rounded-2xl font-mono tabular-nums text-sm font-bold transition-all ${
                          isCompleted
                            ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] shadow-xs'
                            : 'bg-[#F2EDE2] dark:bg-[#162744] text-[#1C4E46] dark:text-[#E0A96D] border border-[#1C4E46]/15 dark:border-[#E0A96D]/25'
                        }`}>
                          {item.repeatTarget === null ? currentCount + ' قراءة' : Math.max(0, item.repeatTarget - currentCount) + ' / ' + item.repeatTarget}
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          </div>
        </div>
      )}

      {viewMode === 'api_library' && (
        <div style={{ zoom: displayPreferences.uiScale / 100 }}>
          <RuqyahApiLibrary />
        </div>
      )}
    </div>
  );
};
