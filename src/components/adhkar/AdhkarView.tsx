import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Sun,
  Moon,
  Sparkles,
  BookOpen,
  Heart,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  CheckCircle2,
  Star,
  Copy,
  Check,
  Search,
  ShieldCheck,
  Flame
} from 'lucide-react';
import {
  ADHKAR_CATEGORIES,
  ADHKAR_ITEMS,
  FREE_TASBIH_PRESETS,
  getAdhkarItemsByCategory,
  getRecommendedAdhkarCategoryForHour,
  type AdhkarCategory,
  type AdhkarItem
} from '../../data/adhkarData';
import {
  getAdhkarCategoryProgressSummary,
  incrementAdhkarItemCount,
  incrementFreeTasbihCount,
  readAdhkarProgressStore,
  resetAdhkarCategoryCounts,
  resetAdhkarItemCount,
  resetFreeTasbihCount,
  selectFreeTasbihPreset,
  toggleAdhkarFavorite,
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
import { QuranText } from '../shared/QuranText';
import { WirdIslamicPattern, WirdMihrabArch } from '../brand/WirdPattern';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';

interface AdhkarViewProps {
  preferredReciter?: ReciterId;
  onOpenRuqyah?: () => void;
  onToast?: (message: string, type?: 'success' | 'info' | 'warn' | 'error') => void;
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
  const [activeCategory, setActiveCategory] = useState<AdhkarCategory>(recommendedCategory);
  const [filterMode, setFilterMode] = useState<'all' | 'favorites' | 'quran_audio'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [store, setStore] = useState<AdhkarProgressStore>(() => readAdhkarProgressStore());
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

  // Load verified local Quran chunks for Quranic Adhkar & Duas
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
          // Canonical text on item remains available if chunk load is interrupted
        }
      })
    );
    return () => { active = false; };
  }, []);

  const countsForToday = store.countsByDate[todayStr] || {};
  const categorySummary = useMemo(
    () => getAdhkarCategoryProgressSummary(activeCategory, countsForToday),
    [activeCategory, countsForToday]
  );

  const visibleItems = useMemo(() => {
    const base = filterMode === 'favorites'
      ? ADHKAR_ITEMS.filter(item => store.favoriteIds.includes(item.id))
      : getAdhkarItemsByCategory(activeCategory);

    const byAudio = filterMode === 'quran_audio'
      ? base.filter(item => item.kind === 'quran')
      : base;

    const query = searchQuery.trim();
    if (!query) return byAudio;
    return byAudio.filter(item =>
      item.title.includes(query) ||
      item.text.includes(query) ||
      item.source.includes(query) ||
      item.virtue.includes(query)
    );
  }, [activeCategory, filterMode, searchQuery, store.favoriteIds]);

  const handleTapCount = (item: AdhkarItem) => {
    const result = incrementAdhkarItemCount(item.id, todayStr);
    setStore(result.store);

    if (result.justCompleted && autoAdvance) {
      const currentIdx = visibleItems.findIndex(entry => entry.id === item.id);
      const nextUnfinished = visibleItems.slice(currentIdx + 1).find(
        entry => (result.store.countsByDate[todayStr]?.[entry.id] ?? 0) < entry.repeatTarget
      );
      if (nextUnfinished) {
        window.setTimeout(() => {
          document.getElementById(`adhkar-card-${nextUnfinished.id}`)?.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          });
        }, 220);
      } else {
        onToast?.(`أتممت جميع أذكار «${ADHKAR_CATEGORIES.find(c => c.id === activeCategory)?.label}» تقبل الله منك!`, 'success');
      }
    }
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
      ? resolvedAyahs.map(a => a.text).join(' ۝ ')
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

  const activeCategoryMeta = ADHKAR_CATEGORIES.find(c => c.id === activeCategory) || ADHKAR_CATEGORIES[0];
  const activeTasbihPreset = FREE_TASBIH_PRESETS.find(p => p.id === store.freeTasbih.presetId) || FREE_TASBIH_PRESETS[0];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Architectural Hero Banner */}
      <section
        aria-labelledby="adhkar-hero-title"
        className="wird-hero-surface relative p-6 md:p-8 overflow-hidden"
      >
        <WirdIslamicPattern opacity={0.06} variant="gold" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="wird-section-badge">
                <Sparkles className="w-3.5 h-3.5" />
                <span>حصن المسلم والورد اليومي الموثق</span>
              </span>
              <span className="text-xs font-semibold text-[#F2EDE2]/80">
                · مقترح الوقت الحالي: {ADHKAR_CATEGORIES.find(c => c.id === recommendedCategory)?.label}
              </span>
            </div>
            <h2 id="adhkar-hero-title" className="text-2xl md:text-3xl font-extrabold font-quran text-[#F5F1E8]">
              الأذكار والأدعية اليومية والباقيات الصالحات
            </h2>
            <p className="text-xs md:text-sm text-[#F2EDE2]/90 leading-relaxed">
              ﴿ أَلَا بِذِكْرِ اللَّهِ تَطْمَئِنُّ الْقُلُوبُ ﴾ — أذكار الصباح والمساء وأدبار الصلوات والنوم والأدعية القرآنية والنبوية بتخريج موثق وعدّاد تفاعلي وتلاوة قرآنية متكاملة.
            </p>
          </div>

          <div className="flex items-center gap-4 self-start md:self-center">
            {onOpenRuqyah && (
              <button
                type="button"
                onClick={onOpenRuqyah}
                className="min-h-11 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F5F1E8] border border-[#E0A96D]/35 text-xs font-bold flex items-center gap-2 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-[#E0A96D]" />
                <span>الانتقال إلى الرقية الشرعية</span>
              </button>
            )}
            <WirdMihrabArch size={84} variant="gold" className="hidden sm:block shrink-0" />
          </div>
        </div>
      </section>

      {/* 2. Category Selector Rail */}
      <div className="wird-card p-4 sm:p-5 space-y-4">
        <HorizontalScrollRail ariaLabel="أقسام الأذكار والأدعية اليومية">
          {ADHKAR_CATEGORIES.map(cat => {
            const summary = getAdhkarCategoryProgressSummary(cat.id, countsForToday);
            const isActive = activeCategory === cat.id && filterMode !== 'favorites';
            return (
              <button
                key={cat.id}
                type="button"
                aria-pressed={isActive}
                onClick={() => {
                  stopAdhkarAudio();
                  setFilterMode('all');
                  setActiveCategory(cat.id);
                }}
                className={`min-h-12 shrink-0 snap-start px-4 py-2.5 rounded-2xl border text-xs font-bold transition-all flex items-center gap-2.5 ${
                  isActive
                    ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27] dark:border-[#E0A96D] shadow-sm'
                    : 'bg-[#F9F6EE] dark:bg-[#0B132B]/70 text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20 hover:border-[#C59B27]'
                }`}
              >
                {cat.id === 'morning' || cat.id === 'waking_up' ? (
                  <Sun className={`w-4 h-4 ${isActive ? 'text-[#E0A96D]' : 'text-[#C59B27]'}`} />
                ) : cat.id === 'evening' || cat.id === 'sleeping' ? (
                  <Moon className={`w-4 h-4 ${isActive ? 'text-[#E0A96D]' : 'text-[#1C4E46] dark:text-[#E0A96D]'}`} />
                ) : cat.id === 'quranic_duas' ? (
                  <BookOpen className="w-4 h-4 text-[#C59B27]" />
                ) : (
                  <Sparkles className="w-4 h-4 text-[#C59B27]" />
                )}
                <span>{cat.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
                    summary.isComplete
                      ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                      : isActive
                      ? 'bg-white/15 text-white'
                      : 'bg-[#1C4E46]/10 dark:bg-white/10 text-[#5B6F6B] dark:text-[#98ADAA]'
                  }`}
                >
                  {summary.completedItems}/{summary.totalItems}
                </span>
              </button>
            );
          })}
        </HorizontalScrollRail>

        {/* Controls Bar: Search, Filter, Reciter Picker, Category Progress */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-2 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-[#5B6F6B] dark:text-[#98ADAA] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="البحث في الأذكار والأدعية"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="ابحث في نص الذكر، العنوان، الفضل، أو المصدر..."
                className="w-full min-h-11 pr-10 pl-3 py-2 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-xs text-[#142421] dark:text-[#F5F1E8] focus:outline-none focus:ring-2 focus:ring-[#C59B27]"
              />
            </div>

            <button
              type="button"
              aria-pressed={filterMode === 'favorites'}
              onClick={() => setFilterMode(prev => (prev === 'favorites' ? 'all' : 'favorites'))}
              className={`min-h-11 px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                filterMode === 'favorites'
                  ? 'bg-[#C59B27] text-[#0B132B] border-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>المفضلة ({store.favoriteIds.length})</span>
            </button>

            <button
              type="button"
              aria-pressed={filterMode === 'quran_audio'}
              onClick={() => setFilterMode(prev => (prev === 'quran_audio' ? 'all' : 'quran_audio'))}
              className={`min-h-11 px-3.5 py-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-colors ${
                filterMode === 'quran_audio'
                  ? 'bg-[#1C4E46] text-white border-[#C59B27]'
                  : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>الأذكار القرآنية الصوتية</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs font-semibold text-[#5B6F6B] dark:text-[#98ADAA]">
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
                className="min-h-11 px-3 py-1.5 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-xs font-bold text-[#142421] dark:text-[#F5F1E8]"
              >
                {RECITERS.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => {
                setStore(resetAdhkarCategoryCounts(activeCategory, todayStr));
                onToast?.(`تمت إعادة ضبط عدّاد «${activeCategoryMeta.label}» لليوم.`, 'info');
              }}
              className="min-h-11 px-3 py-1.5 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] border border-transparent flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير القسم</span>
            </button>
          </div>
        </div>

        {/* Category Progress Summary Bar */}
        <div className="p-3.5 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div>
              <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">{activeCategoryMeta.label}</span>
              <span className="text-[#5B6F6B] dark:text-[#98ADAA]"> · {activeCategoryMeta.recommendedTimeAr}</span>
            </div>
            <div className="font-mono font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums">
              {categorySummary.completedItems} / {categorySummary.totalItems} ذكر مكتمل ({categorySummary.percent}%)
            </div>
          </div>
          <div
            role="progressbar"
            aria-label={`تقدم ${activeCategoryMeta.label}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={categorySummary.percent}
            className="w-full h-2 rounded-full bg-[#E5DEC9] dark:bg-[#162744] overflow-hidden"
          >
            <div
              className="h-full rounded-full bg-gradient-to-l from-[#1C4E46] to-[#C59B27] transition-all duration-300"
              style={{ width: `${categorySummary.percent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 3. Adhkar & Duas Cards List */}
      <div className="space-y-4">
        {visibleItems.map(item => {
          const currentCount = countsForToday[item.id] ?? 0;
          const isCompleted = currentCount >= item.repeatTarget;
          const isFavorite = store.favoriteIds.includes(item.id);
          const isThisPlaying = playingItemId === item.id && isAudioPlaying;
          const isThisPaused = playingItemId === item.id && isAudioPaused;
          const resolvedAyahs = verifiedQuranAyahsById[item.id];
          const progressPercent = Math.min(100, Math.round((currentCount / item.repeatTarget) * 100));

          return (
            <article
              key={item.id}
              id={`adhkar-card-${item.id}`}
              className={`wird-card p-5 md:p-6 space-y-4 transition-all ${
                isCompleted
                  ? 'border-emerald-600/35 dark:border-emerald-400/35 bg-emerald-50/40 dark:bg-emerald-950/15'
                  : ''
              }`}
            >
              {/* Card Header */}
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base md:text-lg font-bold font-quran text-[#142421] dark:text-[#F5F1E8]">
                      {item.title}
                    </h3>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                        item.kind === 'quran'
                          ? 'bg-[#1C4E46]/12 text-[#1C4E46] dark:bg-[#1E4A47]/50 dark:text-[#6EE7B7] border-[#1C4E46]/25'
                          : 'bg-[#C59B27]/12 text-[#9A7415] dark:bg-[#E0A96D]/15 dark:text-[#E0A96D] border-[#C59B27]/30'
                      }`}
                    >
                      {item.grade}
                    </span>
                    <span className="text-[11px] font-bold text-[#5B6F6B] dark:text-[#98ADAA] font-mono tabular-nums">
                      التكرار المسنون: {item.repeatTarget === 1 ? 'مرة واحدة' : `${item.repeatTarget} مرات`}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5B6F6B] dark:text-[#98ADAA]">
                    المصدر: {item.source}
                  </p>
                </div>

                {/* Action Tools: Audio (for Quranic items), Favorite, Copy, Reset */}
                <div className="flex items-center gap-1.5">
                  {item.kind === 'quran' && (
                    <button
                      type="button"
                      onClick={() => void handlePlayQuranicDhikr(item)}
                      className={`min-h-11 px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors ${
                        isThisPlaying
                          ? 'bg-[#C59B27] text-[#0B132B]'
                          : 'bg-[#1C4E46] hover:bg-[#28665B] text-white'
                      }`}
                    >
                      {isThisPlaying ? (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          <span>إيقاف مؤقت</span>
                        </>
                      ) : isThisPaused ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          <span>استئناف التلاوة</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>استماع للتلاوة</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    aria-label={isFavorite ? `إزالة ${item.title} من المفضلة` : `إضافة ${item.title} إلى المفضلة`}
                    aria-pressed={isFavorite}
                    onClick={() => setStore(toggleAdhkarFavorite(item.id))}
                    className={`min-h-11 min-w-11 flex items-center justify-center rounded-xl border transition-colors ${
                      isFavorite
                        ? 'bg-[#C59B27]/15 border-[#C59B27] text-[#C59B27] dark:text-[#E0A96D]'
                        : 'bg-[#F9F6EE] dark:bg-[#0B132B] border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#98ADAA]'
                    }`}
                  >
                    <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>

                  <button
                    type="button"
                    aria-label={`نسخ ${item.title}`}
                    onClick={() => handleCopyDhikr(item)}
                    className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#98ADAA] hover:text-[#1C4E46] dark:hover:text-[#E0A96D]"
                  >
                    {copiedId === item.id ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </button>

                  {currentCount > 0 && (
                    <button
                      type="button"
                      aria-label={`تصفير عداد ${item.title}`}
                      onClick={() => setStore(resetAdhkarItemCount(item.id, todayStr))}
                      className="min-h-11 min-w-11 flex items-center justify-center rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B] border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#98ADAA] hover:text-rose-600"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Vocalized Text Body */}
              <div className="p-4 md:p-5 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/75 border border-[#1C4E46]/10 dark:border-[#E0A96D]/18">
                {item.kind === 'quran' ? (
                  <p className="font-quran text-lg md:text-2xl leading-[2.35] text-[#142421] dark:text-[#F5F1E8] text-right">
                    {resolvedAyahs && resolvedAyahs.length > 0 ? (
                      resolvedAyahs.map(ayah => (
                        <React.Fragment key={ayah.number}>
                          <QuranText>{ayah.text}</QuranText>
                          <span className="ayah-number">{ayah.numberInSurah}</span>
                        </React.Fragment>
                      ))
                    ) : (
                      <QuranText>{item.text}</QuranText>
                    )}
                  </p>
                ) : (
                  <p className="hadith-matn text-[#142421] dark:text-[#F5F1E8]">
                    {item.text}
                  </p>
                )}
              </div>

              {/* Virtue Note & Interactive Counter Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] leading-relaxed flex-1">
                  <strong className="text-[#1C4E46] dark:text-[#E0A96D]">الفضل والبيان: </strong>
                  {item.virtue}
                </p>

                <button
                  type="button"
                  onClick={() => handleTapCount(item)}
                  aria-label={`تكرار ${item.title} (${currentCount} من ${item.repeatTarget})`}
                  className={`min-h-12 px-6 py-3 rounded-2xl font-bold text-xs md:text-sm flex items-center justify-center gap-3 shrink-0 transition-all active:scale-95 ${
                    isCompleted
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#235D59] text-white ring-1 ring-[#C59B27]/45 shadow-sm'
                  }`}
                >
                  {isCompleted ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-[#F6D78B]" />
                      <span>مكتمل ({currentCount} / {item.repeatTarget})</span>
                    </>
                  ) : (
                    <>
                      <span>اضغط للعدّ</span>
                      <span className="px-2.5 py-0.5 rounded-lg bg-black/20 font-mono text-sm tabular-nums">
                        {currentCount} / {item.repeatTarget}
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* Subtle Item Progress Line */}
              {item.repeatTarget > 1 && (
                <div className="w-full h-1 rounded-full bg-[#E5DEC9] dark:bg-[#162744] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1C4E46] dark:bg-[#E0A96D] transition-all duration-200"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}
            </article>
          );
        })}

        {visibleItems.length === 0 && (
          <div className="wird-card p-10 text-center space-y-2">
            <Heart className="w-8 h-8 text-[#C59B27] dark:text-[#E0A96D] mx-auto" />
            <h3 className="text-base font-bold text-[#142421] dark:text-[#F5F1E8]">
              لا توجد أذكار مطابقة للبحث أو التصفية الحالية
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA]">
              جرّب عرض جميع الأذكار أو تغيير كلمة البحث.
            </p>
          </div>
        )}
      </div>

      {/* 4. Interactive Free Tasbih Counter (المسبحة الإلكترونية والذكر المفتوح) */}
      <section
        aria-labelledby="free-tasbih-title"
        className="wird-card p-6 md:p-8 space-y-5 border border-[#C59B27]/35 dark:border-[#E0A96D]/30"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="free-tasbih-title" className="text-lg font-bold font-quran text-[#1C4E46] dark:text-[#F5F1E8] flex items-center gap-2">
              <Flame className="w-5 h-5 text-[#C59B27] dark:text-[#E0A96D]" />
              <span>المسبحة الإلكترونية والذكر المفتوح</span>
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA] mt-0.5">
              عدّاد تسبيح واستغفار مفتوح يُحفظ تلقائياً في حسابك مع إجمالي تسبيحاتك التراكمية
            </p>
          </div>
          <span className="wird-section-badge font-mono tabular-nums">
            إجمالي التسبيحات: {store.freeTasbih.totalLifetimeCount}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          {FREE_TASBIH_PRESETS.map(preset => {
            const isSelected = store.freeTasbih.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setStore(selectFreeTasbihPreset(preset.id))}
                className={`min-h-11 px-3.5 py-2 rounded-xl border text-xs font-bold transition-all ${
                  isSelected
                    ? 'bg-[#1C4E46] dark:bg-[#1E4A47] text-white border-[#C59B27]'
                    : 'bg-[#F9F6EE] dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/15 dark:border-[#E0A96D]/20'
                }`}
              >
                {preset.phrase}
              </button>
            );
          })}
        </div>

        <div className="p-6 rounded-2xl bg-[#F9F6EE] dark:bg-[#0B132B]/80 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-right">
            <div className="text-xl md:text-2xl font-bold font-quran text-[#1C4E46] dark:text-[#E0A96D]">
              {activeTasbihPreset.phrase}
            </div>
            <p className="text-xs text-[#5B6F6B] dark:text-[#98ADAA]">
              {activeTasbihPreset.virtue}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStore(incrementFreeTasbihCount())}
              aria-label="تسبيحة جديدة في المسبحة الإلكترونية"
              className="min-h-16 px-8 py-4 rounded-2xl bg-gradient-to-l from-[#1C4E46] to-[#28665B] hover:brightness-105 text-white font-bold text-base shadow-md ring-2 ring-[#C59B27]/50 flex items-center gap-3 active:scale-95 transition-all"
            >
              <span>سبِّح</span>
              <span className="px-3 py-1 rounded-xl bg-black/25 font-mono text-lg tabular-nums">
                {store.freeTasbih.currentCount} / {store.freeTasbih.targetCount}
              </span>
            </button>

            <button
              type="button"
              aria-label="تصفير عداد المسبحة الحالي"
              onClick={() => setStore(resetFreeTasbihCount())}
              className="min-h-12 min-w-12 flex items-center justify-center rounded-xl bg-white dark:bg-[#111F36] border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 text-[#5B6F6B] dark:text-[#98ADAA] hover:text-rose-600"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};
