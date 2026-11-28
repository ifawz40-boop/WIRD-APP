import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  BookOpen,
  Heart,
  RotateCcw,
  Star,
  Search,
  ShieldCheck,
  ArrowRight,
  Clock,
  BedDouble,
  Sunrise,
  Droplets,
  Landmark,
  Home,
  Utensils,
  Compass,
  CloudRain,
  Stethoscope,
  Users,
  HandHeart,
  Eye,
  EyeOff,
  CheckCircle2,
  SlidersHorizontal,
  X
} from 'lucide-react';
import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  getAdhkarCategoriesByGroup,
  getAdhkarItemsByCategory,
  getAdhkarRepeatTarget,
  getRecommendedAdhkarCategoryForHour,
  type AdhkarCategory,
  type AdhkarCategoryMeta,
  type AdhkarItem
} from '../../data/adhkarData';
import {
  getAdhkarCategoryProgressSummary,
  getAdhkarRemainingCount,
  getOverallDailyAdhkarSummary,
  incrementAdhkarItemCount,
  incrementFreeTasbihCount,
  readAdhkarProgressStore,
  resetAdhkarCategoryCounts,
  resetAdhkarItemCount,
  resetFreeTasbihCount,
  selectFreeTasbihPreset,
  setFreeTasbihTarget,
  toggleAdhkarFavorite,
  updateAdhkarReadingPrefs,
  type AdhkarFontScale,
  type AdhkarProgressStore
} from '../../services/adhkarProgressService';
import { loadSurahVerses } from '../../data/quranDataLoader';
import {
  RECITERS,
  computeGlobalAyahNumber,
  formatAyahAudioUrl,
  getLicensedAyahAudioUrl,
  requestOfflineAudioCache,
  resolveApprovedOfflineReciterId
} from '../../services/audioService';
import {
  getSavedPlaybackRate,
  getSavedPreferredReciter,
  savePreferredReciter,
  subscribeAudioPreferences
} from '../../services/audioPreferences';
import { QuranAudioQueueController } from '../../services/audioQueueController';
import { globalAudioCoordinator } from '../../services/globalAudioCoordinator';
import { offlineQuranAudioLibrary } from '../../services/offlineQuranAudioLibrary';
import { getLocalDateString } from '../../services/unifiedPortionService';
import type { Ayah, ReciterId } from '../../types/quran';
import { WirdIslamicPattern, WirdMihrabArch } from '../brand/WirdPattern';
import { AdhkarCard } from './AdhkarCard';
import { TasbihStudioPanel } from './TasbihStudioPanel';

type AdhkarWorkspaceTab = 'adhkar' | 'duas' | 'tasbih' | 'favorites';

interface AdhkarViewProps {
  preferredReciter?: ReciterId;
  onOpenRuqyah?: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
}

const FONT_SCALE_ORDER: AdhkarFontScale[] = ['sm', 'md', 'lg', 'xl'];
const FONT_SCALE_LABELS: Record<AdhkarFontScale, string> = {
  sm: 'صغير',
  md: 'متوسط',
  lg: 'كبير',
  xl: 'أكبر'
};

function renderCategoryIcon(categoryId: AdhkarCategory, className = 'w-5 h-5') {
  switch (categoryId) {
    case 'morning':
      return <Sun className={className} />;
    case 'evening':
      return <Moon className={className} />;
    case 'after_prayer':
      return <Clock className={className} />;
    case 'sleeping':
      return <BedDouble className={className} />;
    case 'waking_up':
      return <Sunrise className={className} />;
    case 'istighfar':
      return <Sparkles className={className} />;
    case 'wudu_adhan':
      return <Droplets className={className} />;
    case 'mosque_prayer':
      return <Landmark className={className} />;
    case 'home_entry':
      return <Home className={className} />;
    case 'food_clothing':
      return <Utensils className={className} />;
    case 'travel':
      return <Compass className={className} />;
    case 'distress_relief':
      return <HandHeart className={className} />;
    case 'weather_nature':
      return <CloudRain className={className} />;
    case 'illness_condolence':
      return <Stethoscope className={className} />;
    case 'gathering_etiquette':
      return <Users className={className} />;
    case 'quranic_duas':
      return <BookOpen className={className} />;
    case 'prophetic_duas':
      return <Heart className={className} />;
    case 'istikhara_rizq':
      return <Sparkles className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export const AdhkarView: React.FC<AdhkarViewProps> = ({
  preferredReciter = 'alafasy',
  onOpenRuqyah,
  onToast
}) => {
  const todayStr = getLocalDateString();
  const recommendedCategory = useMemo(
    () => getRecommendedAdhkarCategoryForHour(new Date().getHours()),
    []
  );

  // Separated top-level workspaces: Adhkar Directory | Duas Directory | Electronic Tasbih | Favorites
  const [activeTab, setActiveTab] = useState<AdhkarWorkspaceTab>('adhkar');
  // null => Directory Hub view; AdhkarCategory => Focused Reader screen for that category
  const [selectedCategory, setSelectedCategory] = useState<AdhkarCategory | null>(null);
  const [hubSearchQuery, setHubSearchQuery] = useState('');
  const [readerSearchQuery, setReaderSearchQuery] = useState('');
  const [store, setStore] = useState<AdhkarProgressStore>(() => readAdhkarProgressStore());

  useEffect(() => {
    const handleRemoteSync = () => {
      setStore(readAdhkarProgressStore());
    };
    window.addEventListener('wird:cloud-sync-applied', handleRemoteSync);
    window.addEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    return () => {
      window.removeEventListener('wird:cloud-sync-applied', handleRemoteSync);
      window.removeEventListener('wird:auxiliary-sync-applied', handleRemoteSync);
    };
  }, []);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [verifiedQuranAyahsById, setVerifiedQuranAyahsById] = useState<Record<string, Ayah[]>>({});

  // Audio playback state for Quranic Adhkar & Duas
  const [activeReciter, setActiveReciter] = useState<ReciterId>(() =>
    getSavedPreferredReciter(preferredReciter)
  );
  const [playingItemId, setPlayingItemId] = useState<string | null>(null);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const audioQueueRef = useRef<QuranAudioQueueController | null>(null);
  const playbackRequestSeqRef = useRef(0);
  const activeObjectUrlRevokersRef = useRef<Set<() => void>>(new Set());

  const revokeAllActiveAudioUrls = () => {
    for (const revoke of activeObjectUrlRevokersRef.current) {
      try { revoke(); } catch { /* ignore */ }
    }
    activeObjectUrlRevokersRef.current.clear();
  };

  const stopAdhkarAudio = () => {
    playbackRequestSeqRef.current += 1;
    audioQueueRef.current?.stop();
    audioQueueRef.current = null;
    revokeAllActiveAudioUrls();
    setPlayingItemId(null);
    setIsAudioPlaying(false);
    setIsAudioPaused(false);
    globalAudioCoordinator.releaseFocus('adhkar');
  };

  useEffect(() => {
    const unregAudio = globalAudioCoordinator.register('adhkar', stopAdhkarAudio);
    const unsubPrefs = subscribeAudioPreferences(prefs => {
      setActiveReciter(prefs.preferredReciter);
      audioQueueRef.current?.setPlaybackRate(prefs.playbackRate);
    });
    return () => {
      unregAudio();
      unsubPrefs();
      stopAdhkarAudio();
    };
  }, []);

  // Load verified local Quran chunks for all Quranic Adhkar & Duas
  useEffect(() => {
    let active = true;
    const quranItems = ADHKAR_ITEMS.filter(
      item => item.kind === 'quran' && item.surahNumber && item.startAyah && item.endAyah
    );
    void Promise.all(
      quranItems.map(async item => {
        try {
          const surahVerses = await loadSurahVerses(item.surahNumber!);
          const slice = surahVerses.filter(
            ayah => ayah.numberInSurah >= item.startAyah! && ayah.numberInSurah <= item.endAyah!
          );
          if (active && slice.length > 0) {
            setVerifiedQuranAyahsById(prev => ({ ...prev, [item.id]: slice }));
          }
        } catch {
          // Canonical vocalized text on item remains available if chunk load fails
        }
      })
    );
    return () => { active = false; };
  }, []);

  const countsForToday = store.countsByDate[todayStr] || {};
  const overallSummary = useMemo(
    () => getOverallDailyAdhkarSummary(countsForToday),
    [countsForToday]
  );

  const dailyCategories = useMemo(() => getAdhkarCategoriesByGroup('daily_adhkar'), []);
  const occasionCategories = useMemo(() => getAdhkarCategoriesByGroup('occasion_adhkar'), []);
  const duaCategories = useMemo(() => getAdhkarCategoriesByGroup('duas'), []);

  const recommendedMeta = useMemo(
    () => ADHKAR_CATEGORIES.find(c => c.id === recommendedCategory) || ADHKAR_CATEGORIES[0],
    [recommendedCategory]
  );
  const recommendedSummary = useMemo(
    () => getAdhkarCategoryProgressSummary(recommendedCategory, countsForToday),
    [recommendedCategory, countsForToday]
  );

  const selectedCategoryMeta = useMemo(
    () => (selectedCategory ? ADHKAR_CATEGORIES.find(c => c.id === selectedCategory) || null : null),
    [selectedCategory]
  );

  const selectedCategorySummary = useMemo(
    () => (selectedCategory ? getAdhkarCategoryProgressSummary(selectedCategory, countsForToday) : null),
    [selectedCategory, countsForToday]
  );

  const readerItems = useMemo(() => {
    if (!selectedCategory) return [];
    const items = getAdhkarItemsByCategory(selectedCategory);
    const query = readerSearchQuery.trim();
    if (!query) return items;
    return items.filter(
      item =>
        item.title.includes(query) ||
        item.text.includes(query) ||
        item.virtue.includes(query) ||
        item.source.includes(query)
    );
  }, [selectedCategory, readerSearchQuery]);

  const readerHasQuranItems = useMemo(
    () => readerItems.some(item => item.kind === 'quran'),
    [readerItems]
  );

  const favoriteItems = useMemo(
    () => ADHKAR_ITEMS.filter(item => store.favoriteIds.includes(item.id)),
    [store.favoriteIds]
  );

  const hubSearchResults = useMemo(() => {
    const query = hubSearchQuery.trim();
    if (!query) return null;
    const matchingCategories = ADHKAR_CATEGORIES.filter(
      cat => cat.label.includes(query) || cat.description.includes(query)
    );
    const matchingItems = ADHKAR_ITEMS.filter(
      item =>
        item.title.includes(query) ||
        item.text.includes(query) ||
        item.virtue.includes(query) ||
        item.source.includes(query)
    ).slice(0, 24);
    return { matchingCategories, matchingItems };
  }, [hubSearchQuery]);

  const handleOpenCategory = (catId: AdhkarCategory) => {
    stopAdhkarAudio();
    const meta = ADHKAR_CATEGORIES.find(c => c.id === catId);
    if (meta?.group === 'duas') {
      setActiveTab('duas');
    } else {
      setActiveTab('adhkar');
    }
    setReaderSearchQuery('');
    setSelectedCategory(catId);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSwitchTab = (tab: AdhkarWorkspaceTab) => {
    stopAdhkarAudio();
    setActiveTab(tab);
    setSelectedCategory(null);
    setReaderSearchQuery('');
  };

  const handleTapCount = (item: AdhkarItem, listContext: AdhkarItem[], category?: AdhkarCategory) => {
    const result = incrementAdhkarItemCount(item.id, todayStr, localStorage, category);
    setStore(result.store);

    if (result.justCompleted && store.readingPrefs.autoAdvance) {
      const currentIdx = listContext.findIndex(entry => entry.id === item.id);
      const nextUnfinished = listContext.slice(currentIdx + 1).find(
        entry =>
          (result.store.countsByDate[todayStr]?.[entry.id] ?? 0) <
          getAdhkarRepeatTarget(entry, category)
      );
      if (nextUnfinished) {
        window.setTimeout(() => {
          document.getElementById(`adhkar-card-${nextUnfinished.id}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 200);
      } else if (category) {
        const label = ADHKAR_CATEGORIES.find(c => c.id === category)?.label;
        onToast?.(`أتممت جميع أذكار «${label}» — تقبل الله منك!`, 'success');
      }
    }
  };

  const handleStepFontScale = (direction: -1 | 1) => {
    const idx = FONT_SCALE_ORDER.indexOf(store.readingPrefs.fontScale);
    const nextIdx = Math.max(0, Math.min(FONT_SCALE_ORDER.length - 1, idx + direction));
    if (nextIdx !== idx) {
      setStore(updateAdhkarReadingPrefs({ fontScale: FONT_SCALE_ORDER[nextIdx] }));
    }
  };

  const handleToggleVirtueAndSource = () => {
    setStore(
      updateAdhkarReadingPrefs({
        showVirtueAndSource: !store.readingPrefs.showVirtueAndSource
      })
    );
  };

  const handlePlayQuranicDhikr = async (item: AdhkarItem) => {
    if (item.kind !== 'quran' || !item.surahNumber || !item.startAyah || !item.endAyah) return;

    if (playingItemId === item.id && audioQueueRef.current?.getState().active) {
      if (audioQueueRef.current.getState().paused) {
        globalAudioCoordinator.claimFocus('adhkar');
        audioQueueRef.current.resume();
        setIsAudioPaused(false);
        setIsAudioPlaying(true);
      } else {
        audioQueueRef.current.pause();
        setIsAudioPaused(true);
        setIsAudioPlaying(false);
        globalAudioCoordinator.releaseFocus('adhkar');
      }
      return;
    }

    stopAdhkarAudio();
    globalAudioCoordinator.claimFocus('adhkar');
    const requestSeq = ++playbackRequestSeqRef.current;
    const approvedReciterId = resolveApprovedOfflineReciterId(activeReciter);

    const ayahNumbers: number[] = [];
    for (let a = item.startAyah; a <= item.endAyah; a++) {
      ayahNumbers.push(a);
    }

    requestOfflineAudioCache(
      ayahNumbers.map(ayahNum => getLicensedAyahAudioUrl(item.surahNumber!, ayahNum, activeReciter).url)
    );

    const tracks = await Promise.all(
      ayahNumbers.map(async ayahNum => {
        const fallbackUrl = formatAyahAudioUrl(item.surahNumber!, ayahNum, activeReciter);
        const globalAyah = computeGlobalAyahNumber(item.surahNumber!, ayahNum);
        const resolved = await offlineQuranAudioLibrary.resolvePlaybackSource(
          approvedReciterId,
          globalAyah,
          fallbackUrl
        );
        if (resolved.revoke) activeObjectUrlRevokersRef.current.add(resolved.revoke);
        return {
          id: `${item.id}-${ayahNum}`,
          url: resolved.src
        };
      })
    );

    if (requestSeq !== playbackRequestSeqRef.current) {
      revokeAllActiveAudioUrls();
      return;
    }

    const controller = new QuranAudioQueueController({
      onPlaying: () => {
        setPlayingItemId(item.id);
        setIsAudioPlaying(true);
        setIsAudioPaused(false);
      },
      onPaused: () => {
        setIsAudioPlaying(false);
        setIsAudioPaused(true);
      },
      onComplete: () => {
        if (audioQueueRef.current !== controller) return;
        audioQueueRef.current = null;
        revokeAllActiveAudioUrls();
        setPlayingItemId(null);
        setIsAudioPlaying(false);
        setIsAudioPaused(false);
        globalAudioCoordinator.releaseFocus('adhkar');
      },
      onError: () => {
        if (audioQueueRef.current !== controller) return;
        audioQueueRef.current = null;
        revokeAllActiveAudioUrls();
        setPlayingItemId(null);
        setIsAudioPlaying(false);
        setIsAudioPaused(false);
        globalAudioCoordinator.releaseFocus('adhkar');
        onToast?.('تعذر تشغيل التلاوة الصوتية؛ تحقق من الاتصال أو تنزيل السورة للعمل دون إنترنت.', 'warn');
      }
    });

    audioQueueRef.current = controller;
    try {
      controller.start({
        tracks,
        startIndex: 0,
        endIndex: tracks.length - 1,
        ayahRepeatCount: 1,
        repeatCount: 1,
        playbackRate: getSavedPlaybackRate()
      });
      setPlayingItemId(item.id);
      setIsAudioPlaying(true);
      setIsAudioPaused(false);
    } catch {
      stopAdhkarAudio();
    }
  };

  const handleCopyDhikr = (item: AdhkarItem) => {
    const resolvedAyahs = verifiedQuranAyahsById[item.id];
    const bodyText = resolvedAyahs && resolvedAyahs.length > 0
      ? resolvedAyahs.map(a => `${a.text} ﴿${a.numberInSurah}﴾`).join(' ')
      : item.text;
    const formatted = `${item.title}\n${bodyText}\n— المصدر: ${item.source} (${item.grade})`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(formatted);
      setCopiedId(item.id);
      window.setTimeout(() => {
        setCopiedId(prev => (prev === item.id ? null : prev));
      }, 2000);
      onToast?.('تم نسخ الذكر مع تخريجه الموثق.', 'info');
    }
  };

  const renderCategoryCard = (cat: AdhkarCategoryMeta) => {
    const summary = getAdhkarCategoryProgressSummary(cat.id, countsForToday);
    const isRecommendedNow = cat.id === recommendedCategory;
    return (
      <button
        key={cat.id}
        type="button"
        onClick={() => handleOpenCategory(cat.id)}
        className={`wird-card text-right p-5 flex flex-col justify-between gap-4 transition-all duration-150 hover:border-[var(--wird-border-gold)] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--wird-accent)] ${
          summary.isComplete
            ? 'border-emerald-600/35 dark:border-emerald-400/35'
            : ''
        }`}
      >
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center shrink-0">
              {renderCategoryIcon(cat.id, 'w-5 h-5')}
            </div>

            <div className="text-left text-xs font-mono tabular-nums text-[var(--wird-muted)]">
              {summary.isComplete ? (
                <span className="inline-flex items-center gap-1 font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>مكتمل</span>
                </span>
              ) : (
                <span>
                  {summary.completedItems} / {summary.totalItems}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold font-quran text-[var(--wird-text)] leading-snug">
              {cat.label}
            </h4>
            <p className="text-xs text-[var(--wird-muted)] leading-relaxed line-clamp-2">
              {cat.description}
            </p>
          </div>
        </div>

        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-[11px] text-[var(--wird-muted)] tabular-nums">
            <span>
              {summary.totalItems} ذكراً
              {isRecommendedNow ? ' · مقترح الآن' : ''}
            </span>
            <span className="font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
              {summary.percent}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                summary.isComplete
                  ? 'bg-emerald-600 dark:bg-emerald-400'
                  : 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)]'
              }`}
              style={{ width: `${summary.percent}%` }}
            />
          </div>
        </div>
      </button>
    );
  };

  const renderReadingToolbar = (showReciter: boolean, onResetAll?: () => void) => {
    const scaleIdx = FONT_SCALE_ORDER.indexOf(store.readingPrefs.fontScale);
    return (
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-3 border-t border-[var(--wird-border)]">
        {/* Font Size Control + Virtue/Source Toggle */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="التحكم بحجم خط الذكر"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]"
          >
            <button
              type="button"
              onClick={() => handleStepFontScale(-1)}
              disabled={scaleIdx <= 0}
              aria-label="تصغير حجم خط الذكر"
              className="min-h-9 min-w-9 px-2 rounded-lg text-xs font-bold text-[var(--wird-text)] hover:bg-[var(--wird-surface)] disabled:opacity-35 transition-colors whitespace-nowrap"
            >
              أ-
            </button>
            <span className="px-2 text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap">
              الخط: {FONT_SCALE_LABELS[store.readingPrefs.fontScale]}
            </span>
            <button
              type="button"
              onClick={() => handleStepFontScale(1)}
              disabled={scaleIdx >= FONT_SCALE_ORDER.length - 1}
              aria-label="تكبير حجم خط الذكر"
              className="min-h-9 min-w-9 px-2 rounded-lg text-xs font-bold text-[var(--wird-text)] hover:bg-[var(--wird-surface)] disabled:opacity-35 transition-colors whitespace-nowrap"
            >
              أ+
            </button>
          </div>

          <button
            type="button"
            aria-pressed={store.readingPrefs.showVirtueAndSource}
            onClick={handleToggleVirtueAndSource}
            className={`min-h-11 px-3.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap ${
              store.readingPrefs.showVirtueAndSource
                ? 'bg-[var(--wird-accent-soft)] border-[var(--wird-border-gold)] text-[var(--wird-text)]'
                : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)]'
            }`}
          >
            {store.readingPrefs.showVirtueAndSource ? (
              <Eye className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            <span>
              {store.readingPrefs.showVirtueAndSource ? 'إخفاء الفضل والتخريج' : 'إظهار الفضل والتخريج'}
            </span>
          </button>
        </div>

        {/* Secondary Controls: Reciter + Reset */}
        <div className="flex flex-wrap items-center gap-2">
          {showReciter && (
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap">
              <span>القارئ:</span>
              <select
                aria-label="اختيار قارئ الأذكار القرآنية"
                value={activeReciter}
                onChange={e => {
                  const next = e.target.value as ReciterId;
                  stopAdhkarAudio();
                  setActiveReciter(next);
                  savePreferredReciter(next);
                }}
                className="min-h-11 px-3 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)]"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
          )}

          {onResetAll && (
            <button
              type="button"
              onClick={onResetAll}
              className="min-h-11 px-3.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير القسم</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderItemCard = (item: AdhkarItem, idx: number, listContext: AdhkarItem[], category?: AdhkarCategory) => {
    const targetCount = getAdhkarRepeatTarget(item, category);
    const currentCount = countsForToday[item.id] ?? 0;
    const remainingCount = getAdhkarRemainingCount(currentCount, targetCount);
    const isCompleted = remainingCount === 0;

    return (
      <AdhkarCard
        key={item.id}
        item={item}
        indexNumber={idx + 1}
        currentCount={Math.min(currentCount, targetCount)}
        targetCount={targetCount}
        remainingCount={remainingCount}
        isCompleted={isCompleted}
        isFavorite={store.favoriteIds.includes(item.id)}
        isCopied={copiedId === item.id}
        isPlaying={playingItemId === item.id && isAudioPlaying}
        isPaused={playingItemId === item.id && isAudioPaused}
        resolvedAyahs={verifiedQuranAyahsById[item.id]}
        fontScale={store.readingPrefs.fontScale}
        showVirtueAndSource={store.readingPrefs.showVirtueAndSource}
        onTapCount={() => handleTapCount(item, listContext, category)}
        onPlayAudio={() => void handlePlayQuranicDhikr(item)}
        onToggleFavorite={() => setStore(toggleAdhkarFavorite(item.id))}
        onCopy={() => handleCopyDhikr(item)}
        onResetItem={() => setStore(resetAdhkarItemCount(item.id, todayStr))}
      />
    );
  };

  const tabs: Array<{ id: AdhkarWorkspaceTab; label: string; countText: string }> = [
    { id: 'adhkar', label: 'الأذكار اليومية والمناسبات', countText: `${dailyCategories.length + occasionCategories.length}` },
    { id: 'duas', label: 'الأدعية المأثورة', countText: `${duaCategories.length}` },
    { id: 'tasbih', label: 'المسبحة الإلكترونية', countText: `${store.freeTasbih.currentCount}` },
    { id: 'favorites', label: 'المفضلة', countText: `${store.favoriteIds.length}` }
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Compact Architectural Header (Shown in Directory / Tasbih / Favorites; hidden inside Focused Reader to save space) */}
      {!selectedCategory && (
        <section
          aria-labelledby="adhkar-hero-title"
          className="wird-hero-surface relative p-6 md:p-7 overflow-hidden"
        >
          <WirdIslamicPattern opacity={0.05} variant="gold" />
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-2xl">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs font-semibold text-[#F2EDE2]/85">
                <span className="text-[#E9C176] font-bold">موسوعة حصن المسلم الموثّقة</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{ADHKAR_CATEGORIES.length} قسماً</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{ADHKAR_ITEMS.length} ذكراً ودعاءً</span>
                {overallSummary.totalRepetitionsToday > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums text-[#E9C176]">
                      تسبيحات اليوم: {overallSummary.totalRepetitionsToday}
                    </span>
                  </>
                )}
              </div>

              <h2 id="adhkar-hero-title" className="text-2xl md:text-3xl font-extrabold font-quran text-[#F5F1E8] text-balance">
                الأذكار والأدعية اليومية والمسبحة الإلكترونية
              </h2>
              <p className="text-xs md:text-sm text-[#F2EDE2]/90 leading-relaxed">
                ﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾ — دليل شامل ومنظّم لأذكار اليوم والليلة والمناسبات والأدعية القرآنية والنبوية بتخريج صحيح وعدّاد تنازلي تفاعلي.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start lg:self-center">
              <button
                type="button"
                onClick={() => handleOpenCategory(recommendedCategory)}
                className="min-h-12 px-5 py-2.5 rounded-xl bg-[var(--wird-accent)] hover:bg-[var(--wird-accent-hover)] text-[var(--wird-accent-ink)] text-xs sm:text-sm font-extrabold flex items-center gap-2 transition-colors whitespace-nowrap shadow-xs"
              >
                {renderCategoryIcon(recommendedCategory, 'w-4 h-4')}
                <span>
                  {recommendedMeta.label} الآن ({recommendedSummary.completedItems}/{recommendedSummary.totalItems})
                </span>
              </button>

              {onOpenRuqyah && (
                <button
                  type="button"
                  onClick={onOpenRuqyah}
                  className="min-h-12 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5F1E8] border border-[#E0A96D]/35 text-xs font-bold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <ShieldCheck className="w-4 h-4 text-[#E0A96D]" />
                  <span>الرقية الشرعية</span>
                </button>
              )}

              <WirdMihrabArch size={76} variant="gold" className="hidden xl:block shrink-0" />
            </div>
          </div>
        </section>
      )}

      {/* 2. Separated Top-Level Workspace Tabs */}
      <nav
        aria-label="الأقسام الرئيسية لصفحة الأذكار"
        className="wird-card p-1.5 grid grid-cols-2 lg:flex items-center gap-1.5"
      >
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              aria-pressed={isActive}
              onClick={() => handleSwitchTab(tab.id)}
              className={`min-h-11 px-3 sm:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-1.5 text-center lg:flex-1 transition-colors ${
                isActive
                  ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] shadow-xs'
                  : 'text-[var(--wird-text)] hover:bg-[var(--wird-surface-muted)]'
              }`}
            >
              <span className="truncate">{tab.label}</span>
              <span
                className={`text-[11px] font-mono tabular-nums shrink-0 ${
                  isActive ? 'opacity-85' : 'text-[var(--wird-muted)]'
                }`}
              >
                ({tab.countText})
              </span>
            </button>
          );
        })}
      </nav>

      {/* 3A. DEDICATED ELECTRONIC TASBIH TAB */}
      {activeTab === 'tasbih' && (
        <TasbihStudioPanel
          tasbih={store.freeTasbih}
          onIncrement={() => setStore(incrementFreeTasbihCount())}
          onResetCurrent={() => {
            setStore(resetFreeTasbihCount());
            onToast?.('تم تصفير عدّاد الدورة الحالية مع حفظ الإجمالي التراكمي.', 'info');
          }}
          onSelectPreset={presetId => setStore(selectFreeTasbihPreset(presetId))}
          onSelectTarget={target => setStore(setFreeTasbihTarget(target))}
        />
      )}

      {/* 3B. FAVORITES TAB */}
      {activeTab === 'favorites' && (
        <section aria-label="الأذكار والأدعية المفضلة" className="space-y-4">
          <div className="wird-card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold font-quran text-[var(--wird-text)]">
                  المفضلة المحفوظة
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  الأذكار والأدعية التي اخترتها للوصول السريع اليومي مع عدّادها التنازلي.
                </p>
              </div>
              <span className="text-xs font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                <span className="font-mono">{favoriteItems.length}</span> محفوظات
              </span>
            </div>
            {favoriteItems.length > 0 && renderReadingToolbar(favoriteItems.some(i => i.kind === 'quran'))}
          </div>

          {favoriteItems.length > 0 ? (
            <div className="space-y-4">
              {favoriteItems.map((item, idx) => renderItemCard(item, idx, favoriteItems))}
            </div>
          ) : (
            <div className="wird-card p-10 text-center space-y-2.5">
              <Star className="w-8 h-8 text-[var(--wird-accent)] mx-auto" />
              <h4 className="text-base font-bold text-[var(--wird-text)]">
                لا توجد أذكار في المفضلة بعد
              </h4>
              <p className="text-xs text-[var(--wird-muted)] max-w-md mx-auto">
                اضغط على أيقونة النجمة بجانب أي ذكر أو دعاء ليظهر هنا في قائمتك الخاصة.
              </p>
            </div>
          )}
        </section>
      )}

      {/* 3C. FOCUSED CATEGORY READER (When a category is selected inside Adhkar or Duas) */}
      {(activeTab === 'adhkar' || activeTab === 'duas') && selectedCategory && selectedCategoryMeta && selectedCategorySummary && (
        <section aria-labelledby="focused-category-heading" className="space-y-5">
          {/* Focused Reader Header & Reading Controls */}
          <div className="wird-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <button
                  type="button"
                  onClick={() => {
                    stopAdhkarAudio();
                    setSelectedCategory(null);
                    setReaderSearchQuery('');
                  }}
                  className="min-h-11 px-3.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] text-xs font-bold text-[var(--wird-text)] flex items-center gap-1.5 shrink-0 transition-colors whitespace-nowrap"
                >
                  <ArrowRight className="w-4 h-4" />
                  <span>الفهرس</span>
                </button>

                <div className="sm:hidden text-xs font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">
                  <span className="font-mono">
                    {selectedCategorySummary.completedItems} / {selectedCategorySummary.totalItems}
                  </span>{' '}
                  مكتمل (<span className="font-mono">{selectedCategorySummary.percent}%</span>)
                </div>
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h3
                  id="focused-category-heading"
                  className="text-xl md:text-2xl font-extrabold font-quran text-[var(--wird-text)] leading-snug"
                >
                  {selectedCategoryMeta.label}
                </h3>
                <p className="text-xs text-[var(--wird-muted)] leading-relaxed">
                  {selectedCategoryMeta.recommendedTimeAr}
                </p>
              </div>

              <div className="hidden sm:block text-left text-xs sm:text-sm font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0">
                <span className="font-mono">
                  {selectedCategorySummary.completedItems} / {selectedCategorySummary.totalItems}
                </span>{' '}
                مكتمل (<span className="font-mono">{selectedCategorySummary.percent}%</span>)
              </div>
            </div>

            {/* Category Progress Bar */}
            <div
              role="progressbar"
              aria-label={`تقدم ${selectedCategoryMeta.label}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={selectedCategorySummary.percent}
              className="w-full h-2 rounded-full bg-[var(--wird-surface-muted)] overflow-hidden"
            >
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  selectedCategorySummary.isComplete
                    ? 'bg-emerald-600 dark:bg-emerald-400'
                    : 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)]'
                }`}
                style={{ width: `${selectedCategorySummary.percent}%` }}
              />
            </div>

            {/* Search inside category (helpful for 25+ Morning/Evening adhkar) */}
            {selectedCategorySummary.totalItems > 8 && (
              <div className="relative">
                <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  aria-label={`البحث داخل ${selectedCategoryMeta.label}`}
                  value={readerSearchQuery}
                  onChange={e => setReaderSearchQuery(e.target.value)}
                  placeholder={`ابحث داخل ${selectedCategoryMeta.label}...`}
                  className="w-full min-h-11 pr-10 pl-9 py-2 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
                />
                {readerSearchQuery && (
                  <button
                    type="button"
                    aria-label="مسح البحث"
                    onClick={() => setReaderSearchQuery('')}
                    className="absolute left-2 top-1/2 -translate-y-1/2 min-h-8 min-w-8 flex items-center justify-center text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Font size, Virtue/Source visibility, Reciter & Category Reset */}
            {renderReadingToolbar(readerHasQuranItems, () => {
              setStore(resetAdhkarCategoryCounts(selectedCategory, todayStr));
              onToast?.(`تمت إعادة ضبط عدّاد «${selectedCategoryMeta.label}» لليوم.`, 'info');
            })}
          </div>

          {/* Interactive Countdown Cards List */}
          <div className="space-y-4">
            {readerItems.map((item, idx) => renderItemCard(item, idx, readerItems, selectedCategory))}

            {readerItems.length === 0 && (
              <div className="wird-card p-10 text-center space-y-2">
                <SlidersHorizontal className="w-7 h-7 text-[var(--wird-accent)] mx-auto" />
                <h4 className="text-base font-bold text-[var(--wird-text)]">
                  لا توجد أذكار مطابقة للبحث داخل هذا القسم
                </h4>
                <button
                  type="button"
                  onClick={() => setReaderSearchQuery('')}
                  className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline"
                >
                  عرض جميع أذكار القسم
                </button>
              </div>
            )}
          </div>

          {/* Completion Banner at bottom of Reader */}
          {selectedCategorySummary.isComplete && (
            <div className="wird-card p-6 text-center space-y-3 border-emerald-600/35 dark:border-emerald-400/35">
              <CheckCircle2 className="w-9 h-9 text-emerald-600 dark:text-emerald-400 mx-auto" />
              <h4 className="text-lg font-bold font-quran text-[var(--wird-text)]">
                تقبّل الله منك — أتممت {selectedCategoryMeta.label} بالكامل
              </h4>
              <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    stopAdhkarAudio();
                    setSelectedCategory(null);
                  }}
                  className="min-h-11 px-5 rounded-xl bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] text-xs font-bold whitespace-nowrap"
                >
                  العودة إلى فهرس الأقسام
                </button>
                <button
                  type="button"
                  onClick={() => setStore(resetAdhkarCategoryCounts(selectedCategory, todayStr))}
                  className="min-h-11 px-4 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] whitespace-nowrap"
                >
                  قراءة القسم مجدداً
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 3D. DIRECTORY HUB VIEW (Adhkar Tab or Duas Tab when no specific category is open) */}
      {(activeTab === 'adhkar' || activeTab === 'duas') && !selectedCategory && (
        <div className="space-y-6">
          {/* Global Encyclopedia Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-[var(--wird-muted)] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="البحث الشامل في موسوعة الأذكار والأدعية"
              value={hubSearchQuery}
              onChange={e => setHubSearchQuery(e.target.value)}
              placeholder="ابحث في جميع الأذكار والأدعية والأقسام (مثل: السفر، المطر، الاستخارة، الكرب، آية الكرسي)..."
              className="w-full min-h-12 pr-11 pl-10 py-2.5 rounded-2xl bg-[var(--wird-surface)] border border-[var(--wird-border)] text-sm text-[var(--wird-text)] shadow-2xs focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
            />
            {hubSearchQuery && (
              <button
                type="button"
                aria-label="مسح البحث الشامل"
                onClick={() => setHubSearchQuery('')}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 min-h-9 min-w-9 flex items-center justify-center text-[var(--wird-muted)] hover:text-[var(--wird-text)]"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Search Results Mode */}
          {hubSearchResults ? (
            <div className="space-y-6">
              {hubSearchResults.matchingCategories.length > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-bold text-[var(--wird-text)]">
                    الأقسام المطابقة ({hubSearchResults.matchingCategories.length})
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {hubSearchResults.matchingCategories.map(renderCategoryCard)}
                  </div>
                </section>
              )}

              <section className="space-y-3">
                <h3 className="text-sm font-bold text-[var(--wird-text)]">
                  الأذكار والأدعية المطابقة ({hubSearchResults.matchingItems.length})
                </h3>
                {hubSearchResults.matchingItems.length > 0 ? (
                  <div className="space-y-4">
                    {hubSearchResults.matchingItems.map((item, idx) =>
                      renderItemCard(item, idx, hubSearchResults.matchingItems)
                    )}
                  </div>
                ) : (
                  <div className="wird-card p-8 text-center text-xs text-[var(--wird-muted)]">
                    لم يتم العثور على أذكار مطابقة لعبارة البحث «{hubSearchQuery}».
                  </div>
                )}
              </section>
            </div>
          ) : activeTab === 'adhkar' ? (
            /* Adhkar Directory: Daily Fixed Adhkar (6) + Hisn al-Muslim Occasions (9) */
            <div className="space-y-8">
              <section aria-labelledby="daily-adhkar-group-heading" className="space-y-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3
                      id="daily-adhkar-group-heading"
                      className="text-lg font-bold font-quran text-[var(--wird-text)]"
                    >
                      الأذكار اليومية الثابتة
                    </h3>
                    <p className="text-xs text-[var(--wird-muted)]">
                      أوراد اليوم والليلة الأساسية التي يلازمها المسلم كل يوم
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--wird-muted)]">
                    <span className="font-mono">{dailyCategories.length}</span> أقسام
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dailyCategories.map(renderCategoryCard)}
                </div>
              </section>

              <section aria-labelledby="occasion-adhkar-group-heading" className="space-y-3.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <h3
                      id="occasion-adhkar-group-heading"
                      className="text-lg font-bold font-quran text-[var(--wird-text)]"
                    >
                      أذكار المناسبات والأحوال (حصن المسلم)
                    </h3>
                    <p className="text-xs text-[var(--wird-muted)]">
                      الأذكار المأثورة للوضوء والأذان والمسجد والمنزل والطعام والسفر والكرب والمطر والعيادة والمجالس
                    </p>
                  </div>
                  <span className="text-xs font-semibold tabular-nums text-[var(--wird-muted)]">
                    <span className="font-mono">{occasionCategories.length}</span> أقسام
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {occasionCategories.map(renderCategoryCard)}
                </div>
              </section>
            </div>
          ) : (
            /* Duas Directory: Quranic, Prophetic & Istikhara/Rizq/Salawat (3) */
            <section aria-labelledby="duas-group-heading" className="space-y-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3
                    id="duas-group-heading"
                    className="text-lg font-bold font-quran text-[var(--wird-text)]"
                  >
                    مكتبة الأدعية القرآنية والنبوية المأثورة
                  </h3>
                  <p className="text-xs text-[var(--wird-muted)]">
                    جوامع الدعاء من كتاب الله وسنة نبيه ﷺ مع التلاوة الصوتية للآيات القرآنية
                  </p>
                </div>
                <span className="text-xs font-semibold tabular-nums text-[var(--wird-muted)]">
                  <span className="font-mono">{duaCategories.length}</span> أقسام
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {duaCategories.map(renderCategoryCard)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
};
