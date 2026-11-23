import React, { useEffect, useState } from 'react';
import {
  Play,
  Repeat,
  CheckCircle,
  Flame,
  Calendar,
  ArrowLeft,
  BookOpen,
  Check,
  Compass,
  Clock,
  AlertTriangle,
  Tv
} from 'lucide-react';
import {
  UserProfile,
  MemorizationPlan,
  RevisionItem,
  DailyLog
} from '../../types/quran';
import { TOTAL_QURAN_VERSES, TOTAL_QURAN_PAGES, ALL_SURAHS } from '../../data/quranMeta';
import { NavTabId } from '../layout/Sidebar';
import { RetentionService } from '../../services/retentionService';
import { type EngineGeneratedPlan } from '../../services/planningEngine';
import { PlanLifecycle } from '../../services/planLifecycle';
import { loadAyahByCoordinate, getAyahDisplayText } from '../../data/quranDataLoader';
import { getLocalDateString } from '../../services/unifiedPortionService';
import { getUnifiedDailyHubSummary } from '../../services/dailySessionSelection';
import { getReadingKhatmaProgress, readAllReadingKhatmas } from '../../services/readingKhatmaService';
import { getPagesForAyahRange } from '../../services/pageProgressService';
import { QuranText } from '../shared/QuranText';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { WirdSymbol } from '../brand/WirdLogo';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { WirdButton, WirdCard, WirdMetadataRow } from '../ui/WirdPrimitives';
import {
  PRAYER_CITY_PRESETS,
  PRAYER_LABELS_AR,
  buildOfflineFallbackSchedule,
  fetchDailyPrayerSchedule,
  getNextPrayerSummary,
  getPrayerCityPresetById,
  getSelectedPrayerCityId,
  setSelectedPrayerCityId,
  type DailyPrayerSchedule,
  type PrayerTimingKey,
} from '../../services/prayerTimesService';
import { DailyVideoSuggestionCard } from '../series/DailyVideoSuggestionCard';

interface DashboardViewProps {
  profile: UserProfile;
  plans: MemorizationPlan[];
  enginePlans?: EngineGeneratedPlan[];
  revisionItems: RevisionItem[];
  logs: DailyLog[];
  onNavigate: (tab: NavTabId) => void;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number, mode?: 'memorize' | 'review') => void;
  onUpdateEnginePlans?: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onResumeReadingKhatma?: (page: number, khatmaId?: string) => void;
  onOpenSeries?: (seriesId?: string, videoId?: string) => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  plans,
  enginePlans = [],
  logs,
  onNavigate,
  onStartSession,
  onUpdateEnginePlans,
  onResumeReadingKhatma,
  onOpenSeries,
  onToast
}) => {
  const [dailyPreviewText, setDailyPreviewText] = useState('جارٍ تحميل نص الآية...');
  const [pendingRecoveryMode, setPendingRecoveryMode] = useState<'shift' | 'light' | 'rebalance' | null>(null);
  const [isApplyingRecovery, setIsApplyingRecovery] = useState(false);
  const [selectedPrayerCityId, setSelectedPrayerCityIdState] = useState<string>(() => getSelectedPrayerCityId());
  const [prayerSchedule, setPrayerSchedule] = useState<DailyPrayerSchedule>(() =>
    buildOfflineFallbackSchedule(getPrayerCityPresetById(getSelectedPrayerCityId()))
  );

  useEffect(() => {
    let active = true;
    fetchDailyPrayerSchedule({ cityId: selectedPrayerCityId })
      .then((schedule) => {
        if (active) setPrayerSchedule(schedule);
      })
      .catch(() => {
        if (active) {
          setPrayerSchedule(buildOfflineFallbackSchedule(getPrayerCityPresetById(selectedPrayerCityId)));
        }
      });
    return () => {
      active = false;
    };
  }, [selectedPrayerCityId]);

  const handleChangePrayerCity = (cityId: string) => {
    const preset = setSelectedPrayerCityId(cityId);
    setSelectedPrayerCityIdState(preset.id);
    setPrayerSchedule(buildOfflineFallbackSchedule(preset));
  };
  const nextPrayer = getNextPrayerSummary(prayerSchedule.timings);

  // Choose one truthful task from the active plan, due revisions, or next uncovered range.
  const todayStr = getLocalDateString();
  const queueDetails = RetentionService.getDailyRevisionQueueDetails(todayStr);
  const queuePortions = queueDetails.queue;
  const totalDueCount = queueDetails.totalDueCount;
  const minorRevisionsCount = queuePortions.filter(p => (p.revisionType || 'minor') === 'minor').length;
  const majorRevisionsCount = queuePortions.filter(p => p.revisionType === 'major').length;

  // 1. Truthful overall statistics (computed from real memorized portions)
  const retentionMetrics = RetentionService.getRetentionDashboardMetrics();
  const totalMemorizedAyahs = retentionMetrics.totalMemorizedAyahs;
  const totalMemorizedPages = retentionMetrics.totalMemorizedPages;
  const versesPercentage = TOTAL_QURAN_VERSES > 0 ? ((totalMemorizedAyahs / TOTAL_QURAN_VERSES) * 100).toFixed(1) : '0.0';
  const pagesPercentage = TOTAL_QURAN_PAGES > 0 ? ((totalMemorizedPages / TOTAL_QURAN_PAGES) * 100).toFixed(1) : '0.0';
  const retentionScore = retentionMetrics.retentionScorePercentage;
  const retentionStatusLabel = retentionScore >= 80
    ? `ممتاز (${retentionScore}%)`
    : retentionScore >= 50
      ? `جيد (${retentionScore}%)`
      : `قيد البناء (${retentionScore}%)`;

  const portions = RetentionService.getPortions();
  const weakVerses = (() => {
    try { return RetentionService.getWeakVerses(); } catch { return []; }
  })();
  const hub = getUnifiedDailyHubSummary(plans, enginePlans, portions, weakVerses, todayStr);
  const selection = hub.primarySelection;
  const readingKhatmaStore = readAllReadingKhatmas();
  const activeReadingKhatmas = readingKhatmaStore.khatmas.filter(item => !item.completedAt);
  const readingKhatma =
    readingKhatmaStore.khatmas.find(item => item.id === readingKhatmaStore.activeKhatmaId) ||
    activeReadingKhatmas[0] ||
    null;
  const readingKhatmaPagesCount = readingKhatma ? new Set(readingKhatma.completedPages).size : 0;
  const masteredPortionsCount = retentionMetrics.statusBreakdown.stable;

  const activePlansWithMissed = enginePlans
    .filter(p => p.isActive && !p.isPaused)
    .map(p => ({ plan: p, missed: PlanLifecycle.detectMissedDays(p, todayStr) }))
    .filter(item => item.missed.hasMissedDays);
  const [selectedMissedPlanId, setSelectedMissedPlanId] = useState<string | null>(null);
  const activeMissedEntry =
    activePlansWithMissed.find(item => item.plan.id === selectedMissedPlanId) ||
    activePlansWithMissed[0] ||
    null;
  const activeEnginePlan = activeMissedEntry?.plan || null;
  const missedSummary = activeMissedEntry?.missed || null;

  const handleApplyMissedRecovery = async () => {
    if (!activeEnginePlan || !pendingRecoveryMode || !onUpdateEnginePlans || isApplyingRecovery) return;
    setIsApplyingRecovery(true);
    try {
      const outcome =
        pendingRecoveryMode === 'shift'
          ? PlanLifecycle.shiftMissedForward(activeEnginePlan, todayStr)
          : pendingRecoveryMode === 'light'
            ? PlanLifecycle.scheduleLightRecoveryDay(activeEnginePlan, todayStr)
            : PlanLifecycle.rebalanceRemainingPlan(activeEnginePlan, todayStr);
      if (!outcome.changed) {
        onToast?.(outcome.actionLabelAr, 'info');
        setPendingRecoveryMode(null);
        return;
      }
      const nextPlans = enginePlans.map(p => (p.id === activeEnginePlan.id ? outcome.plan : p));
      const saved = await onUpdateEnginePlans(nextPlans);
      if (saved) {
        onToast?.(outcome.actionLabelAr, 'success');
        setPendingRecoveryMode(null);
      }
    } finally {
      setIsApplyingRecovery(false);
    }
  };

  const selectedPages = selection.kind === 'session'
    ? getPagesForAyahRange(selection.surahNumber, selection.startAyah, selection.endAyah)
    : [];
  const dailyTask = selection.kind === 'session'
    ? {
        ...selection,
        surahName: ALL_SURAHS.find(surah => surah.number === selection.surahNumber)?.name || `سورة ${selection.surahNumber}`,
        versesCount: selection.endAyah - selection.startAyah + 1,
        pageNumber: selectedPages[0] || 1,
        pagesCount: selectedPages.length
      }
    : {
        kind: 'blocked' as const,
        mode: 'memorize' as const,
        source: 'blocked' as const,
        surahNumber: 1,
        surahName: '—',
        startAyah: 1,
        endAyah: 1,
        versesCount: 0,
        pageNumber: 0,
        pagesCount: 0,
        label: selection.messageAr
      };

  // The selected review is already shown as today's primary task; avoid listing it twice.
  const displayedQueuePortions = dailyTask.source === 'revision'
    ? queuePortions.filter(item => !(
        item.surahNumber === dailyTask.surahNumber &&
        item.startAyah === dailyTask.startAyah &&
        item.endAyah === dailyTask.endAyah
      ))
    : queuePortions;

  useEffect(() => {
    let cancelled = false;
    if (dailyTask.source === 'blocked') {
      setDailyPreviewText(dailyTask.label);
      return () => { cancelled = true; };
    }
    setDailyPreviewText('جارٍ تحميل نص الآية...');
    loadAyahByCoordinate(dailyTask.surahNumber, dailyTask.startAyah)
      .then(ayah => {
        if (cancelled) return;
        if (!ayah?.text) { setDailyPreviewText('تعذر تحميل معاينة الآية حالياً.'); return; }
        getAyahDisplayText(ayah)
          .then(simpleText => { if (!cancelled) setDailyPreviewText('«' + simpleText + '»'); })
          .catch(() => { if (!cancelled) setDailyPreviewText('تعذر تحميل النص الإملائي المعتمد حالياً.'); });
      })
      .catch(error => {
        if (!cancelled) {
          console.warn('[WIRD Dashboard] Could not load ayah preview:', error);
          setDailyPreviewText('تعذر تحميل معاينة الآية حالياً.');
        }
      });
    return () => { cancelled = true; };
  }, [dailyTask.source, dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.label]);

  // Show the actual seven calendar days, including quiet days as zero activity.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last7Logs = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() - (6 - index));
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const matchingLogs = logs.filter(log => log.date === dateKey);
    return {
      date: dateKey,
      minutesSpent: matchingLogs.reduce((sum, log) => sum + log.minutesSpent, 0),
      memorizedAyahsCount: matchingLogs.reduce((sum, log) => sum + log.memorizedAyahsCount, 0),
      reviewedPagesCount: matchingLogs.reduce((sum, log) => sum + log.reviewedPagesCount, 0)
    };
  });
  const totalWeeklyMinutes = last7Logs.reduce((acc, curr) => acc + curr.minutesSpent, 0);
  const totalWeeklyAyahs = last7Logs.reduce((acc, curr) => acc + curr.memorizedAyahsCount, 0);
  const totalWeeklyReviewedPages = last7Logs.reduce((acc, curr) => acc + curr.reviewedPagesCount, 0);

  const scrollToDashboardSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      {/* Mobile/Tablet Horizontal Section Anchor Strip */}
      <div className="lg:hidden">
        <HorizontalScrollRail ariaLabel="روابط أقسام الرئيسية السريعة" showArrowsOnDesktop={false}>
          {[
            { id: 'dashboard-daily-wird', label: 'ورد اليوم' },
            { id: 'dashboard-revision-card', label: 'المراجعة والتثبيت' },
            { id: 'dashboard-daily-series', label: 'درس اليوم المرئي' },
            { id: 'dashboard-metrics-grid', label: 'الإحصائيات' },
            { id: 'dashboard-prayer-card', label: 'مواقيت الصلاة' },
            { id: 'dashboard-quick-actions', label: 'إجراءات سريعة' }
          ].map(anchor => (
            <button
              key={anchor.id}
              type="button"
              onClick={() => scrollToDashboardSection(anchor.id)}
              className="min-h-11 shrink-0 snap-start px-3.5 py-2 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface)] border border-[var(--wird-border)] text-xs font-bold text-[var(--wird-text)] hover:border-[var(--wird-accent)] transition-colors"
            >
              {anchor.label}
            </button>
          ))}
        </HorizontalScrollRail>
      </div>

      {/* 1. Calm Editorial Welcome Anchor (Adapts to all 4 Design × Mode variants) */}
      <section
        aria-labelledby="dashboard-welcome-title"
        className="wird-hero-surface relative rounded-[var(--wird-radius-card)] p-5 md:p-6 overflow-hidden"
      >
        <WirdIslamicPattern opacity={0.055} variant="gold" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl text-right">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#F6F1E6]/90">
              <span className="w-6 h-6 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
                <WirdSymbol size={15} variant="gold" />
              </span>
              <span>{prayerSchedule.hijriDateAr}</span>
              <span aria-hidden="true" className="opacity-50">·</span>
              <span>الصلاة القادمة: {nextPrayer.labelAr} ({nextPrayer.time24})</span>
            </div>
            <h2
              id="dashboard-welcome-title"
              className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#F9F6EE] leading-snug wird-headline-balance"
            >
              السلام عليكم ورحمة الله، {profile.name}
            </h2>
            <p className="text-[#F6F1E6]/88 text-xs sm:text-sm leading-relaxed">
              <span className="font-quran text-[1.05rem] text-[#F9F6EE]">«وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ»</span> — استعن بالله وابدأ وِردك ليظل كتاب الله غضاً طرياً في صدرك.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="min-h-11 inline-flex items-center gap-2 px-4 py-2.5 rounded-[var(--wird-radius-control)] bg-white/12 hover:bg-white/20 border border-white/20 text-[#F9F6EE] text-xs font-bold transition-colors whitespace-nowrap"
            >
              <BookOpen className="w-4 h-4 text-[#E6B85C]" />
              <span>فتح المصحف المطبوع</span>
            </button>
            <button
              type="button"
              disabled={dailyTask.source === 'blocked'}
              onClick={() => onStartSession(dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.mode)}
              className="wird-btn-accent min-h-11 inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold disabled:opacity-50 whitespace-nowrap"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{dailyTask.mode === 'review' ? 'ابدأ مراجعة اليوم' : 'ابدأ ورد اليوم'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* 1.5 Missed-Day Recovery Shortcut Alert (across all active non-paused plans) */}
      {activeEnginePlan && missedSummary?.hasMissedDays && onUpdateEnginePlans && (
        <WirdCard
          accent
          aria-label="تدارك الأيام الفائتة في الخطة"
          className="space-y-3 text-xs bg-[var(--wird-accent-soft)]/55"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[var(--wird-accent)] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-[var(--wird-text)]">
                  يوجد {missedSummary.missedDaysCount} {missedSummary.missedDaysCount === 1 ? 'يوم فائت' : 'أيام فائتة'} في خطتك ({activeEnginePlan.input?.title || activeEnginePlan.title})
                </h3>
                <p className="text-[var(--wird-muted)] leading-relaxed tabular-nums">
                  إجمالي المتبقي تداركه: {missedSummary.missedMemorizationVerses} آية
                  {missedSummary.missedRevisionTasksCount > 0 ? ` · ${missedSummary.missedRevisionTasksCount} مهام مراجعة` : ''}.
                  اختر طريقة الاستئناف الأنسب دون فقدان إنجازك السابق:
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
              {activePlansWithMissed.length > 1 && (
                <select
                  aria-label="اختيار الخطة الفائتة"
                  value={activeEnginePlan.id}
                  onChange={(e) => { setSelectedMissedPlanId(e.target.value); setPendingRecoveryMode(null); }}
                  className="min-h-11 px-3 py-1.5 rounded-[var(--wird-radius-control)] border border-[var(--wird-border-strong)] bg-[var(--wird-surface)] text-[var(--wird-text)] font-semibold text-xs"
                >
                  {activePlansWithMissed.map(item => (
                    <option key={item.plan.id} value={item.plan.id}>
                      {item.plan.input?.title || item.plan.title} ({item.missed.missedDaysCount} يوم)
                    </option>
                  ))}
                </select>
              )}
              <WirdButton variant="secondary" size="sm" onClick={() => onNavigate('plans')}>
                تفاصيل الجدول
              </WirdButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {([
              { mode: 'shift', label: 'ترحيل الورد بدءاً من اليوم' },
              { mode: 'light', label: 'تثبيت ومراجعة خفيفة اليوم' },
              { mode: 'rebalance', label: 'إعادة توزيع المتبقي' }
            ] as const).map(opt => (
              <button
                key={opt.mode}
                type="button"
                onClick={() => setPendingRecoveryMode(opt.mode)}
                className={`min-h-11 px-3.5 py-2 rounded-[var(--wird-radius-control)] font-bold border transition-colors whitespace-nowrap ${
                  pendingRecoveryMode === opt.mode
                    ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                    : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {pendingRecoveryMode && (
            <div className="p-3 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface)] border border-[var(--wird-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[var(--wird-text)] leading-relaxed">
                {pendingRecoveryMode === 'shift' && 'سيُرحّل جدول الأوراد غير المكتملة للأمام بدءاً من اليوم مع الحفاظ على سجل إنجازك السابق كاملاً.'}
                {pendingRecoveryMode === 'light' && 'سيُخصص اليوم لتثبيت ومراجعة ما فات دون حفظ جديد، ويُستأنف الحفظ من اليوم الدراسي التالي.'}
                {pendingRecoveryMode === 'rebalance' && 'سيُعاد توزيع الآيات المتبقية بتوازن على الأيام الدراسية المتاحة نحو تاريخ الختم المستهدف.'}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <WirdButton variant="ghost" size="sm" disabled={isApplyingRecovery} onClick={() => setPendingRecoveryMode(null)}>
                  تراجع
                </WirdButton>
                <WirdButton variant="primary" size="sm" disabled={isApplyingRecovery} onClick={handleApplyMissedRecovery}>
                  {isApplyingRecovery ? 'جارٍ التحديث...' : 'تأكيد تطبيق الخيار'}
                </WirdButton>
              </div>
            </div>
          )}
        </WirdCard>
      )}

      {/* 2. Unified Daily Hub ("وردك اليوم") & Revision Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UNIFIED DAILY WIRD CARD */}
        <section
          id="dashboard-daily-wird"
          aria-label="وردك اليوم"
          className="wird-card p-6 flex flex-col justify-between scroll-mt-20"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--wird-border)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center border border-[var(--wird-border-gold)] shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-[var(--wird-text)] truncate">
                    {dailyTask.source === 'blocked'
                      ? 'وردك اليوم — تحتاج خطتك إلى نطاق محدد'
                      : dailyTask.mode === 'review'
                        ? 'وردك اليوم — المراجعة المستحقة'
                        : 'وردك اليوم (الحفظ والخطط النشطة)'}
                  </h3>
                  <p className="text-xs text-[var(--wird-muted)] truncate">
                    {dailyTask.label}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-[var(--wird-muted)] whitespace-nowrap tabular-nums shrink-0">
                {hub.dueEngineItems.length > 1 ? `${hub.dueEngineItems.length} خطط نشطة` : 'مستهدف اليوم'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[11px] font-medium text-[var(--wird-muted)]">السورة والآيات</div>
                  <div className="text-lg font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-quran">
                    {dailyTask.source === 'blocked'
                      ? dailyTask.label
                      : `سورة ${dailyTask.surahName} · الآيات (${dailyTask.startAyah} - ${dailyTask.endAyah})`}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-[11px] font-medium text-[var(--wird-muted)]">الكمية المقررة</div>
                  <div className="text-sm font-bold text-[var(--wird-text)] font-mono tabular-nums">
                    {dailyTask.source === 'blocked'
                      ? '—'
                      : dailyTask.mode === 'review'
                        ? `${dailyTask.versesCount} آيات · ${dailyTask.pagesCount} صفحات`
                        : `${dailyTask.versesCount} آيات · صفحة ${dailyTask.pageNumber}`}
                  </div>
                </div>
              </div>

              <div className="text-[var(--wird-text)] font-quran text-base md:text-lg leading-loose bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] p-4 rounded-xl text-right">
                <QuranText>{dailyPreviewText}</QuranText>
              </div>
            </div>

            <WirdMetadataRow
              items={[
                'المدة: حسب مقدار الورد وسرعة التسميع',
                dailyTask.source === 'blocked'
                  ? 'لا توجد جلسة تلقائية'
                  : dailyTask.mode === 'review'
                    ? 'الطريقة: مراجعة وتسميع وتثبيت'
                    : `الطريقة: التكرار ${profile.repetitionTarget} مرات مع الربط`
              ]}
            />

            {/* Unified Multi-Plan Queue inside وردك اليوم */}
            {(hub.dueEngineItems.length > 0 || (hub.dueEngineItems.length === 0 && hub.presetItems.length > 0) || hub.completedTodayItems.length > 0) && (
              <div className="pt-3 border-t border-[var(--wird-border)] space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--wird-text)]">
                    مهام الخطط النشطة اليوم
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('plans')}
                    className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold hover:underline"
                  >
                    عرض كل الخطط
                  </button>
                </div>

                <div className="divide-y divide-[var(--wird-border)]">
                  {hub.dueEngineItems.map((item) => (
                    <div
                      key={`${item.planId}-${item.taskId}`}
                      className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5 text-right">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                            {item.planTitle}
                          </span>
                          <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
                            · {item.isOverdue ? `مستحق من ${item.scheduledDate}` : 'مهمة اليوم'}
                          </span>
                        </div>
                        <div className="text-[var(--wird-text)] font-quran">
                          سورة {item.task.surahName} ({item.task.startAyah}–{item.task.endAyah}) · {item.task.versesCount} آيات
                        </div>
                      </div>
                      <WirdButton
                        variant="secondary"
                        size="sm"
                        onClick={() => onStartSession(item.task.surahNumber, item.task.startAyah, item.task.endAyah, 'memorize')}
                      >
                        متابعة الحفظ
                      </WirdButton>
                    </div>
                  ))}

                  {hub.dueEngineItems.length === 0 && hub.presetItems.map((preset) => (
                    <div
                      key={preset.planId}
                      className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5 text-right">
                        <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">{preset.planTitle}</div>
                        <div className="text-[var(--wird-muted)]">
                          {preset.range
                            ? `سورة ${ALL_SURAHS.find(s => s.number === preset.range!.surahNumber)?.name || preset.range.surahNumber} (${preset.range.startAyah}–${preset.range.endAyah})`
                            : preset.blockedMessageAr || 'مكتمل'}
                        </div>
                      </div>
                      {preset.range ? (
                        <WirdButton
                          variant="secondary"
                          size="sm"
                          onClick={() => onStartSession(preset.range!.surahNumber, preset.range!.startAyah, preset.range!.endAyah, 'memorize')}
                        >
                          متابعة الحفظ
                        </WirdButton>
                      ) : (
                        <WirdButton variant="secondary" size="sm" onClick={() => onNavigate('plans')}>
                          تفاصيل الخطة
                        </WirdButton>
                      )}
                    </div>
                  ))}

                  {hub.completedTodayItems.map((done) => (
                    <div
                      key={`done-${done.planId}-${done.scheduledDate}`}
                      className="py-2 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-[11px] text-[var(--wird-muted)]"
                    >
                      <span className="font-semibold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                        ✓ {done.planTitle}: سورة {done.task.surahName} ({done.task.startAyah}–{done.task.endAyah})
                      </span>
                      <span className="font-mono tabular-nums">
                        {done.completionTiming === 'completed_early'
                          ? 'مُنجز مبكراً'
                          : done.completionTiming === 'completed_late'
                            ? 'مُنجز متأخراً'
                            : 'أُنجز في موعده'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-5 mt-4 border-t border-[var(--wird-border)] flex flex-col sm:flex-row items-center gap-2.5">
            <WirdButton
              variant="primary"
              size="lg"
              disabled={dailyTask.source === 'blocked'}
              onClick={() => onStartSession(dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.mode)}
              className="flex-1 w-full"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>
                {dailyTask.source === 'blocked'
                  ? 'اختر نطاق الخطة'
                  : dailyTask.mode === 'review'
                    ? 'بدء جلسة المراجعة التفاعلية'
                    : 'بدء جلسة الحفظ التفاعلية'}
              </span>
            </WirdButton>
            <WirdButton
              variant="secondary"
              size="md"
              onClick={() => onNavigate('library')}
              title="تصفح المصحف واختيار سورة أخرى يدوياً"
              className="w-full sm:w-auto"
            >
              سورة أخرى
            </WirdButton>
          </div>
        </section>

        {/* REVISION & WEAK VERSES CARD */}
        <section
          id="dashboard-revision-card"
          aria-label="المراجعة والتثبيت"
          className="wird-card p-6 flex flex-col justify-between scroll-mt-20"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3.5 border-b border-[var(--wird-border)]">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] flex items-center justify-center border border-[var(--wird-border-gold)] shrink-0">
                  <Repeat className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-[var(--wird-text)] truncate">
                    المراجعة والتثبيت (التكرار المتباعد)
                  </h3>
                  <p className="text-xs text-[var(--wird-muted)] truncate">
                    المراجعة الصغرى (الحديثة) والكبرى (التراكمية) ومواضع التعثر
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-[var(--wird-accent)] tabular-nums whitespace-nowrap shrink-0">
                {totalDueCount} مهام مستحقة
              </span>
            </div>

            <div className="divide-y divide-[var(--wird-border)]">
              {displayedQueuePortions.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 text-right min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[var(--wird-text)] text-sm font-quran">
                        سورة {item.surahName}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
                        · {item.revisionType === 'major' ? 'مراجعة كبرى' : 'مراجعة صغرى'}
                      </span>
                    </div>
                    <div className="text-[var(--wird-muted)] tabular-nums">
                      الآيات ({item.startAyah} - {item.endAyah}) {item.pageNumber && `· صفحة ${item.pageNumber}`}
                    </div>
                  </div>

                  <WirdButton variant="secondary" size="sm" onClick={() => onNavigate('revision')}>
                    مراجعة
                  </WirdButton>
                </div>
              ))}

              {displayedQueuePortions.length === 0 && (
                <div className="text-center py-6 text-[var(--wird-muted)] text-xs space-y-1.5">
                  <Check className="w-6 h-6 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] mx-auto" />
                  <p>
                    {totalDueCount > 0
                      ? 'جلسة اليوم تعرض المراجعة ذات الأولوية؛ لا توجد مهام أخرى في القائمة.'
                      : 'أتممت جميع مهام المراجعة لليوم، بارك الله فيك!'}
                  </p>
                </div>
              )}
            </div>

            {hub.urgentWeakVerses.length > 0 && (
              <div className="pt-3 border-t border-[var(--wird-border)] space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[var(--wird-danger)]">
                    مواضع تعثر تتطلب التثبيت ({weakVerses.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('revision')}
                    className="text-[var(--wird-accent)] font-bold hover:underline"
                  >
                    مراجعة المتعثرة
                  </button>
                </div>
                {hub.urgentWeakVerses.slice(0, 2).map(wv => (
                  <div key={wv.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-quran text-[var(--wird-text)] truncate">
                      سورة {wv.surahName} · آية {wv.ayahNumber} (تعثر ×{wv.mistakeCount})
                    </span>
                    <WirdButton
                      variant="secondary"
                      size="sm"
                      onClick={() => onStartSession(wv.surahNumber, wv.ayahNumber, wv.ayahNumber, 'review')}
                    >
                      تثبيت الآية
                    </WirdButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 mt-4 border-t border-[var(--wird-border)] flex items-center justify-between text-xs">
            <span className="text-[var(--wird-muted)] tabular-nums">
              صغرى: {minorRevisionsCount} · كبرى: {majorRevisionsCount}
            </span>
            <button
              type="button"
              onClick={() => onNavigate('revision')}
              className="min-h-11 px-2 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold hover:underline flex items-center gap-1"
            >
              <span>فتح مركز المراجعة الكامل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </section>
      </div>

      {/* 2A. Daily Suggested Video Lesson from Curated / Custom Series */}
      <DailyVideoSuggestionCard
        onOpenSeriesLibrary={(seriesId, videoId) => {
          if (onOpenSeries) onOpenSeries(seriesId, videoId);
          else onNavigate('series');
        }}
        onToast={onToast}
      />

      {/* 2B. Quick-Resume Multi-Khatma Reading Strip */}
      {activeReadingKhatmas.length > 0 && (
        <WirdCard aria-label="ختمات القراءة المتعددة والاستكمال السريع" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
              <h3 className="font-bold text-sm text-[var(--wird-text)]">
                ختمات القراءة والاستكمال السريع ({activeReadingKhatmas.length})
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('library')}
              className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:underline"
            >
              إدارة الختمات
            </button>
          </div>
          <div className="divide-y divide-[var(--wird-border)]">
            {activeReadingKhatmas.map(item => {
              const itemProgress = getReadingKhatmaProgress(item);
              const isSelectedKhatma = readingKhatma?.id === item.id;
              return (
                <div key={item.id} className="py-2.5 first:pt-1 last:pb-1 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[var(--wird-text)]">
                        {item.title || 'ختمة القراءة'}
                      </span>
                      {isSelectedKhatma && (
                        <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">· نشطة</span>
                      )}
                      <span className="text-[11px] text-[var(--wird-muted)] tabular-nums">
                        {itemProgress.completedPages} / {itemProgress.totalScopePages} صفحة ({itemProgress.percent}%) · ورد اليوم {itemProgress.pagesReadToday}/{itemProgress.pagesPerDay}
                      </span>
                    </div>
                    <div className="w-full max-w-md bg-[var(--wird-surface-muted)] h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[var(--wird-primary)] h-full rounded-full transition-all" style={{ width: `${itemProgress.percent}%` }} />
                    </div>
                  </div>
                  <WirdButton
                    variant="primary"
                    size="sm"
                    className="tabular-nums"
                    onClick={() => {
                      if (onResumeReadingKhatma) onResumeReadingKhatma(itemProgress.resumePage, item.id);
                      else onNavigate('library');
                    }}
                  >
                    استكمال · ص {itemProgress.resumePage}
                  </WirdButton>
                </div>
              );
            })}
          </div>
        </WirdCard>
      )}

      {/* 3. Truthful KPI Metrics Grid */}
      <div id="dashboard-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-20">
        {/* Metric 1: New Memorized & Cumulative Balance */}
        <WirdCard>
          <div className="text-xs text-[var(--wird-muted)] mb-1">الآيات المحفوظة (الجديد والتراكمي)</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--wird-text)] tabular-nums font-mono">
              {totalMemorizedAyahs}
            </span>
            <span className="text-xs text-[var(--wird-muted)] tabular-nums font-mono">من {TOTAL_QURAN_VERSES}</span>
          </div>
          <div
            role="progressbar"
            aria-label="نسبة الآيات المحفوظة"
            aria-valuemin={0}
            aria-valuemax={TOTAL_QURAN_VERSES}
            aria-valuenow={totalMemorizedAyahs}
            className="w-full bg-[var(--wird-surface-muted)] h-1.5 rounded-full mt-3 overflow-hidden"
          >
            <div className="bg-[var(--wird-primary)] h-full rounded-full" style={{ width: `${versesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] mt-1.5 font-semibold tabular-nums">
            {versesPercentage}% · المتقن الراسخ: {masteredPortionsCount} مقطع
          </div>
        </WirdCard>

        {/* Metric 2: Memorized Pages vs Reviewed/Weak */}
        <WirdCard>
          <div className="text-xs text-[var(--wird-muted)] mb-1">الصفحات المحفوظة بالكامل</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--wird-text)] tabular-nums font-mono">
              {totalMemorizedPages}
            </span>
            <span className="text-xs text-[var(--wird-muted)] tabular-nums font-mono">من {TOTAL_QURAN_PAGES} صفحة</span>
          </div>
          <div
            role="progressbar"
            aria-label="نسبة الصفحات المحفوظة بالكامل"
            aria-valuemin={0}
            aria-valuemax={TOTAL_QURAN_PAGES}
            aria-valuenow={totalMemorizedPages}
            className="w-full bg-[var(--wird-surface-muted)] h-1.5 rounded-full mt-3 overflow-hidden"
          >
            <div className="bg-[var(--wird-accent)] h-full rounded-full" style={{ width: `${pagesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[var(--wird-muted)] mt-1.5 font-medium tabular-nums">
            المراجعات المنجزة: <strong className="text-[var(--wird-text)]">{retentionMetrics.totalReviewsCompleted}</strong> · المتعثرة: <strong className="text-[var(--wird-text)]">{retentionMetrics.weakVersesCount}</strong>
          </div>
        </WirdCard>

        {/* Metric 3: Weekly Activity */}
        <WirdCard>
          <div className="text-xs text-[var(--wird-muted)] mb-1">نشاط الحفظ والمراجعة أسبوعياً</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[var(--wird-text)] tabular-nums font-mono">
              {totalWeeklyMinutes}
            </span>
            <span className="text-xs text-[var(--wird-muted)]">دقيقة حفظ ومراجعة</span>
          </div>
          <div className="text-[11px] text-[var(--wird-muted)] mt-3 font-medium tabular-nums">
            حفظ جديد: <strong className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">{totalWeeklyAyahs} آية</strong> · مراجعة: <strong className="text-[var(--wird-text)]">{totalWeeklyReviewedPages} ص</strong>
          </div>
        </WirdCard>

        {/* Metric 4: Streak + Separate Reading Khatma Pages */}
        <WirdCard className="flex flex-col justify-between">
          <div>
            <div className="text-xs text-[var(--wird-muted)] mb-1 flex items-center justify-between">
              <span>سلسلة الالتزام والختمة</span>
              <Flame className="w-4 h-4 text-[var(--wird-accent)]" />
            </div>
            <div className="text-2xl font-bold text-[var(--wird-accent)] tabular-nums font-mono">
              {profile.streakDays} يوماً متواصلاً
            </div>
          </div>
          <div className="text-[11px] text-[var(--wird-muted)] mt-2 space-y-0.5 tabular-nums">
            <div>مستوى التثبيت: <strong className="text-[var(--wird-text)]">{retentionStatusLabel}</strong></div>
            <div>ختمة القراءة (منفصلة): <strong className="text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">{readingKhatmaPagesCount} / {TOTAL_QURAN_PAGES} صفحة</strong></div>
          </div>
        </WirdCard>
      </div>

      {/* 4. Weekly Activity Chart, Prayer Times & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left/Main 2 Columns: Weekly Chart + Prayer Times & Qibla */}
        <div className="lg:col-span-2 space-y-6">
          {/* Weekly Chart */}
          <WirdCard className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-sm text-[var(--wird-text)]">
                  سجل النشاط الأسبوعي (الدقائق والآيات)
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  انتظامك اليومي هو سر رسوخ المحفوظ في الصدر
                </p>
              </div>
              <span className="text-xs text-[var(--wird-muted)] font-mono">آخر 7 أيام</span>
            </div>

            <div role="list" aria-label="النشاط الأسبوعي" className="flex items-end justify-between gap-3 h-40 pt-4 border-b border-[var(--wird-border)]">
              {last7Logs.map((log, idx) => {
                const maxMinutes = 50;
                const heightPercent = Math.min(100, Math.round((log.minutesSpent / maxMinutes) * 100));
                const [year, month, day] = log.date.split('-').map(Number);
                const dayName = new Date(year, month - 1, day).toLocaleDateString('ar-SA', { weekday: 'short' });

                return (
                  <div
                    key={idx}
                    role="listitem"
                    aria-label={`${dayName}: ${log.minutesSpent} دقيقة، ${log.memorizedAyahsCount} آية`}
                    className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative"
                  >
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] text-[10px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-20 font-mono">
                      {log.minutesSpent}د · {log.memorizedAyahsCount} آيات
                    </div>

                    <div className="text-[10px] text-[var(--wird-muted)] font-mono tabular-nums">
                      {log.minutesSpent}د
                    </div>
                    <div
                      role="progressbar"
                      aria-label={`دقائق الحفظ والمراجعة يوم ${dayName}`}
                      aria-valuemin={0}
                      aria-valuemax={50}
                      aria-valuenow={Math.min(50, log.minutesSpent)}
                      className="w-full max-w-[32px] bg-[var(--wird-surface-muted)] rounded-t-lg overflow-hidden h-full flex items-end"
                    >
                      <div
                        className="w-full bg-[var(--wird-primary)] hover:bg-[var(--wird-accent)] rounded-t-lg transition-all duration-300"
                        style={{ height: `${heightPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
                      {dayName}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between pt-4 text-xs text-[var(--wird-muted)]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-xs bg-[var(--wird-primary)] inline-block" />
                <span>جلسات الحفظ والمراجعة (بالدقائق)</span>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('progress')}
                className="min-h-11 px-2 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-semibold hover:underline flex items-center gap-1"
              >
                <span>عرض تفاصيل المصحف والتقارير</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            </div>
          </WirdCard>

          {/* Prayer Times, Hijri Calendar & Qibla Card (Separate Sibling Card — Zero Nesting) */}
          <WirdCard
            id="dashboard-prayer-card"
            className="p-6 space-y-4 scroll-mt-20"
            aria-label="مواقيت الصلاة والتاريخ الهجري واتجاه القبلة"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[var(--wird-surface-muted)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center justify-center border border-[var(--wird-border)]">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-[var(--wird-text)]">
                    مواقيت الصلاة والتاريخ الهجري والقبلة
                  </h3>
                  <p className="text-[11px] text-[var(--wird-muted)]">
                    {prayerSchedule.hijriDateAr} · القبلة: {prayerSchedule.qiblaDirectionAr}
                  </p>
                </div>
              </div>
              <label className="sr-only" htmlFor="dashboard-prayer-city-select">
                اختر المدينة لمواقيت الصلاة
              </label>
              <select
                id="dashboard-prayer-city-select"
                value={selectedPrayerCityId}
                onChange={(e) => handleChangePrayerCity(e.target.value)}
                className="min-h-10 text-xs font-bold px-3 py-1.5 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface-muted)] border border-[var(--wird-border-strong)] text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-accent)]"
              >
                {PRAYER_CITY_PRESETS.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.nameAr}
                  </option>
                ))}
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[11px] text-[var(--wird-muted)]">
                  الصلاة القادمة ({prayerSchedule.cityNameAr})
                </div>
                <div className="text-sm font-bold text-[var(--wird-text)] mt-0.5">
                  {nextPrayer.labelAr} · <span className="tabular-nums font-mono">{nextPrayer.time24}</span>
                </div>
              </div>
              <span className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
                {nextPrayer.remainingLabelAr}
              </span>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center">
              {(['Fajr', 'Sunrise', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'] as PrayerTimingKey[]).map((key) => {
                const isNext = nextPrayer.prayerId === key;
                return (
                  <div
                    key={key}
                    className={`p-2.5 rounded-xl border text-xs transition-colors ${
                      isNext
                        ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] font-bold'
                        : 'bg-[var(--wird-surface-muted)]/70 border-[var(--wird-border)] text-[var(--wird-text)]'
                    }`}
                  >
                    <div className={`text-[11px] ${isNext ? 'opacity-85' : 'text-[var(--wird-muted)]'}`}>
                      {PRAYER_LABELS_AR[key]}
                    </div>
                    <div className="font-mono tabular-nums mt-0.5">{prayerSchedule.timings[key]}</div>
                  </div>
                );
              })}
            </div>
          </WirdCard>
        </div>

        {/* Right Column: Quick Actions Hub */}
        <WirdCard id="dashboard-quick-actions" className="p-6 scroll-mt-20">
          <h3 className="font-bold text-sm text-[var(--wird-text)] mb-1">
            إجراءات سريعة
          </h3>
          <p className="text-xs text-[var(--wird-muted)] mb-4">
            أدوات تفاعلية لدعم رحلة حفظك وعبادتك اليومية
          </p>

          <div className="space-y-2">
            {[
              {
                tab: 'library' as NavTabId,
                title: 'المصحف المطبوع والمكتبة',
                subtitle: '604 صفحة مع التفسير المقابل والاستماع',
                icon: BookOpen
              },
              {
                tab: 'tests' as NavTabId,
                title: 'اختبر حفظك الآن',
                subtitle: 'أكمل الآية، المتشابهات اللفظية',
                icon: CheckCircle
              },
              {
                tab: 'plans' as NavTabId,
                title: 'إدارة خطط الحفظ',
                subtitle: 'إنشاء خطة مخصصة أو تفعيل نموذج',
                icon: Calendar
              },
              {
                tab: 'adhkar' as NavTabId,
                title: 'الأذكار والأدعية اليومية',
                subtitle: 'أذكار الصباح والمساء والمسبحة',
                icon: Flame
              },
              {
                tab: 'seerah' as NavTabId,
                title: 'السيرة النبوية الشريفة',
                subtitle: 'كتاب سردي متصل بمصادر محققة',
                icon: BookOpen
              },
              {
                tab: 'series' as NavTabId,
                title: 'السلاسل المرئية والدروس',
                subtitle: 'سلسلة بناء النفس المطمئنة وسلاسل متجددة',
                icon: Tv
              },
              {
                tab: 'advisor' as NavTabId,
                title: 'المستشار القرآني',
                subtitle: 'نصائح التثبيت وعلاج التفلت',
                icon: Compass
              }
            ].map(action => {
              const Icon = action.icon;
              return (
                <button
                  key={action.tab}
                  type="button"
                  onClick={() => onNavigate(action.tab)}
                  className="w-full min-h-14 flex items-center justify-between p-3 rounded-[var(--wird-radius-control)] bg-[var(--wird-surface-muted)]/65 hover:bg-[var(--wird-surface-muted)] border border-[var(--wird-border)] hover:border-[var(--wird-border-gold)] transition-colors text-right wird-focus-ring"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-[var(--wird-surface)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] border border-[var(--wird-border)] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-[var(--wird-text)] truncate">{action.title}</div>
                      <div className="text-[11px] text-[var(--wird-muted)] truncate">{action.subtitle}</div>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
                </button>
              );
            })}
          </div>
        </WirdCard>
      </div>
    </div>
  );
};
