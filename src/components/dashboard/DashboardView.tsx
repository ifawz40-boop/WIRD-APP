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
  AlertTriangle
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
import { getDailySessionSelection, getUnifiedDailyHubSummary } from '../../services/dailySessionSelection';
import { readReadingKhatma } from '../../services/readingKhatmaService';
import { getPagesForAyahRange } from '../../services/pageProgressService';
import { QuranText } from '../shared/QuranText';
import { WirdIslamicPattern } from '../brand/WirdPattern';
import { WirdSymbol } from '../brand/WirdLogo';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';

interface DashboardViewProps {
  profile: UserProfile;
  plans: MemorizationPlan[];
  enginePlans?: EngineGeneratedPlan[];
  revisionItems: RevisionItem[];
  logs: DailyLog[];
  onNavigate: (tab: NavTabId) => void;
  onStartSession: (surahNumber?: number, startAyah?: number, endAyah?: number, mode?: 'memorize' | 'review', enginePlanId?: string, enginePlanDate?: string) => void;
  onUpdateEnginePlans?: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  profile,
  plans,
  enginePlans = [],
  revisionItems,
  logs,
  onNavigate,
  onStartSession,
  onUpdateEnginePlans,
  onToast
}) => {
  const [dailyPreviewText, setDailyPreviewText] = useState('جارٍ تحميل نص الآية...');
  const [pendingRecoveryMode, setPendingRecoveryMode] = useState<'shift' | 'light' | 'rebalance' | null>(null);
  const [isApplyingRecovery, setIsApplyingRecovery] = useState(false);
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
  const readingKhatma = readReadingKhatma();
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
  // Aggregate defensively in case more than one log exists for a date.
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
            { id: 'dashboard-metrics-grid', label: 'الإحصائيات' },
            { id: 'dashboard-quick-actions', label: 'إجراءات سريعة' }
          ].map(anchor => (
            <button
              key={anchor.id}
              type="button"
              onClick={() => scrollToDashboardSection(anchor.id)}
              className="min-h-11 shrink-0 snap-start px-3.5 py-2 rounded-xl bg-white/90 dark:bg-[#111F36]/85 border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 text-xs font-bold text-[#142421] dark:text-[#F5F1E8] hover:border-[#C59B27] transition-colors"
            >
              {anchor.label}
            </button>
          ))}
        </HorizontalScrollRail>
      </div>

      {/* 1. Personalized Welcome & Daily Ayah Banner with Master Visual Identity */}
      <section aria-labelledby="dashboard-welcome-title" className="relative bg-gradient-to-l from-[#0B132B] via-[#0E1E38] to-[#1C4E46] text-white rounded-3xl p-6 md:p-8 shadow-md overflow-hidden border border-[#C59B27]/35">
        {/* Authentic Islamic geometric watermark */}
        <WirdIslamicPattern opacity={0.06} variant="gold" />

        <div className="relative z-10">
          <div className="space-y-2 max-w-4xl text-right">
            <div className="flex items-center gap-2 text-[#F2EDE2] text-xs font-semibold">
              <span className="w-6 h-6 rounded-lg bg-[#C59B27]/20 border border-[#C59B27]/30 flex items-center justify-center shrink-0">
                <WirdSymbol size={16} variant="gold" />
              </span>
              <span>وِردك القرآني اليومي رِفعةٌ لدرجاتك في الجنة</span>
            </div>
            <h2 id="dashboard-welcome-title" className="text-2xl md:text-3xl font-extrabold tracking-tight font-quran text-[#F5F1E8] leading-tight">
              السلام عليكم ورحمة الله، {profile.name}
            </h2>
            <p className="text-[#F2EDE2]/90 text-sm md:text-base leading-relaxed font-quran pt-1">
              «وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ» — استعن بالله وابدأ وِردك ليظل كتاب الله غضاً طرياً في صدرك.
            </p>
          </div>
        </div>
      </section>

      {/* 1.5 Missed-Day Recovery Shortcut Alert (across all active non-paused plans) */}
      {activeEnginePlan && missedSummary?.hasMissedDays && onUpdateEnginePlans && (
        <section
          aria-label="تدارك الأيام الفائتة في الخطة"
          className="wird-card rounded-2xl p-4 sm:p-5 border border-[#C59B27]/45 dark:border-[#E0A96D]/35 bg-[#C59B27]/8 dark:bg-[#111F36] space-y-3 text-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <h3 className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8]">
                  يوجد {missedSummary.missedDaysCount} {missedSummary.missedDaysCount === 1 ? 'يوم فائت' : 'أيام فائتة'} في خطتك ({activeEnginePlan.input?.title || activeEnginePlan.title})
                </h3>
                <p className="text-[#5B6F6B] dark:text-[#8B9E9B] leading-relaxed tabular-nums">
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
                  className="min-h-11 px-3 py-1.5 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] font-semibold text-xs"
                >
                  {activePlansWithMissed.map(item => (
                    <option key={item.plan.id} value={item.plan.id}>
                      {item.plan.input?.title || item.plan.title} ({item.missed.missedDaysCount} يوم)
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => onNavigate('plans')}
                className="min-h-11 px-3 py-1.5 rounded-xl border border-[#1C4E46]/20 dark:border-[#E0A96D]/25 bg-white dark:bg-[#0B132B] text-[#1C4E46] dark:text-[#E0A96D] font-bold hover:border-[#C59B27] whitespace-nowrap transition-colors"
              >
                تفاصيل الجدول
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPendingRecoveryMode('shift')}
              className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                pendingRecoveryMode === 'shift'
                  ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] border-[#C59B27]'
                  : 'bg-white dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/20 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
              }`}
            >
              ترحيل الورد بدءاً من اليوم
            </button>
            <button
              type="button"
              onClick={() => setPendingRecoveryMode('light')}
              className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                pendingRecoveryMode === 'light'
                  ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] border-[#C59B27]'
                  : 'bg-white dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/20 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
              }`}
            >
              تثبيت ومراجعة خفيفة اليوم
            </button>
            <button
              type="button"
              onClick={() => setPendingRecoveryMode('rebalance')}
              className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                pendingRecoveryMode === 'rebalance'
                  ? 'bg-[#1C4E46] dark:bg-[#E0A96D] text-white dark:text-[#0B132B] border-[#C59B27]'
                  : 'bg-white dark:bg-[#0B132B] text-[#142421] dark:text-[#F5F1E8] border-[#1C4E46]/20 dark:border-[#E0A96D]/25 hover:border-[#C59B27]'
              }`}
            >
              إعادة توزيع المتبقي
            </button>
          </div>

          {pendingRecoveryMode && (
            <div className="p-3 rounded-xl bg-white dark:bg-[#0B132B]/85 border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-[#142421] dark:text-[#F5F1E8] leading-relaxed">
                {pendingRecoveryMode === 'shift' && 'سيُرحّل جدول الأوراد غير المكتملة للأمام بدءاً من اليوم مع الحفاظ على سجل إنجازك السابق كاملاً.'}
                {pendingRecoveryMode === 'light' && 'سيُخصص اليوم لتثبيت ومراجعة ما فات دون حفظ جديد، ويُستأنف الحفظ من اليوم الدراسي التالي.'}
                {pendingRecoveryMode === 'rebalance' && 'سيُعاد توزيع الآيات المتبقية بتوازن على الأيام الدراسية المتاحة نحو تاريخ الختم المستهدف.'}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={isApplyingRecovery}
                  onClick={() => setPendingRecoveryMode(null)}
                  className="min-h-11 px-3 py-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/20 text-[#5B6F6B] dark:text-[#8B9E9B] font-semibold"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  disabled={isApplyingRecovery}
                  onClick={handleApplyMissedRecovery}
                  className="wird-btn-primary min-h-11 px-4 py-1.5 text-xs font-bold whitespace-nowrap"
                >
                  {isApplyingRecovery ? 'جارٍ التحديث...' : 'تأكيد تطبيق الخيار'}
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. Unified Daily Hub ("وردك اليوم") & Revision Card */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* UNIFIED DAILY WIRD CARD (وردك اليوم الموحدة لجميع الخطط النشطة) */}
        <section id="dashboard-daily-wird" aria-label="وردك اليوم" className="wird-card p-6 flex flex-col justify-between scroll-mt-20">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#1C4E46]/10 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center border border-[#C59B27]/25">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#142421] dark:text-[#F5F1E8]">
                    {dailyTask.source === 'blocked' ? 'وردك اليوم — تحتاج خطتك إلى نطاق محدد' : dailyTask.mode === 'review' ? 'وردك اليوم — المراجعة المستحقة' : 'وردك اليوم (الحفظ والخطط النشطة)'}
                  </h3>
                  <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                    {dailyTask.label}
                  </p>
                </div>
              </div>

              <span className="text-xs font-semibold text-[#5B6F6B] dark:text-[#8B9E9B] whitespace-nowrap tabular-nums">
                {hub.dueEngineItems.length > 1 ? `${hub.dueEngineItems.length} خطط نشطة` : 'مستهدف اليوم'}
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">السورة والآيات</div>
                  <div className="text-lg font-bold text-[#1C4E46] dark:text-[#E0A96D] font-quran">
                    {dailyTask.source === 'blocked' ? dailyTask.label : `سورة ${dailyTask.surahName} · الآيات (${dailyTask.startAyah} - ${dailyTask.endAyah})`}
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">الكمية المقررة</div>
                  <div className="text-sm font-bold text-[#142421] dark:text-[#F5F1E8] font-mono tabular-nums">
                    {dailyTask.source === 'blocked' ? '—' : dailyTask.mode === 'review' ? `${dailyTask.versesCount} آيات · ${dailyTask.pagesCount} صفحات` : `${dailyTask.versesCount} آيات · صفحة ${dailyTask.pageNumber}`}
                  </div>
                </div>
              </div>

              <div className="text-[#142421] dark:text-[#F5F1E8] font-quran text-base md:text-lg leading-loose bg-[#F9F6EE] dark:bg-[#0B132B]/65 p-4 rounded-xl text-right">
                <QuranText>{dailyPreviewText}</QuranText>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-[#5B6F6B] dark:text-[#8B9E9B] gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#C59B27] dark:text-[#E0A96D]" />
                <span>المدة: <strong className="text-[#142421] dark:text-[#F5F1E8]">تختلف حسب مقدار الورد وسرعة التسميع</strong></span>
              </div>
              <div>
                <span>طريقة الجلسة: <strong className="text-[#1C4E46] dark:text-[#E0A96D]">{dailyTask.source === 'blocked' ? 'لا توجد جلسة تلقائية' : dailyTask.mode === 'review' ? 'مراجعة وتسميع وتثبيت' : `التكرار ${profile.repetitionTarget} مرات مع الربط`}</strong></span>
              </div>
            </div>

            {/* Unified Multi-Plan Queue inside وردك اليوم (all active plans & completed-today status) */}
            {(hub.dueEngineItems.length > 0 || (hub.dueEngineItems.length === 0 && hub.presetItems.length > 0) || hub.completedTodayItems.length > 0) && (
              <div className="pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 space-y-2.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#142421] dark:text-[#F5F1E8]">
                    مهام الخطط النشطة اليوم
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('plans')}
                    className="text-[#1C4E46] dark:text-[#E0A96D] font-bold hover:underline"
                  >
                    عرض كل الخطط
                  </button>
                </div>

                <div role="list" aria-label="مهام الخطط النشطة اليوم" className="divide-y divide-[#1C4E46]/10 dark:divide-[#E0A96D]/15">
                  {hub.dueEngineItems.map((item) => (
                    <div
                      key={`${item.planId}-${item.taskId}`}
                      role="listitem"
                      className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5 text-right">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">
                            {item.planTitle}
                          </span>
                          <span className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                            · {item.isOverdue ? `مستحق من ${item.scheduledDate}` : 'مهمة اليوم'}
                          </span>
                        </div>
                        <div className="text-[#142421] dark:text-[#F5F1E8] font-quran">
                          سورة {item.task.surahName} ({item.task.startAyah}–{item.task.endAyah}) · {item.task.versesCount} آيات
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onStartSession(item.task.surahNumber, item.task.startAyah, item.task.endAyah, 'memorize', item.planId, item.scheduledDate)}
                        className="min-h-11 px-3.5 py-1.5 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#1C4E46] dark:hover:bg-[#1E4A47] text-[#142421] dark:text-[#F5F1E8] hover:text-white font-bold transition-colors shrink-0"
                      >
                        متابعة الحفظ
                      </button>
                    </div>
                  ))}

                  {hub.dueEngineItems.length === 0 && hub.presetItems.map((preset) => (
                    <div
                      key={preset.planId}
                      role="listitem"
                      className="py-2.5 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="min-w-0 space-y-0.5 text-right">
                        <div className="font-bold text-[#1C4E46] dark:text-[#E0A96D]">{preset.planTitle}</div>
                        <div className="text-[#5B6F6B] dark:text-[#8B9E9B]">
                          {preset.range
                            ? `سورة ${ALL_SURAHS.find(s => s.number === preset.range!.surahNumber)?.name || preset.range.surahNumber} (${preset.range.startAyah}–${preset.range.endAyah})`
                            : preset.blockedMessageAr || 'مكتمل'}
                        </div>
                      </div>
                      {preset.range ? (
                        <button
                          type="button"
                          onClick={() => onStartSession(preset.range!.surahNumber, preset.range!.startAyah, preset.range!.endAyah, 'memorize')}
                          className="min-h-11 px-3.5 py-1.5 rounded-xl bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#1C4E46] dark:hover:bg-[#1E4A47] text-[#142421] dark:text-[#F5F1E8] hover:text-white font-bold transition-colors shrink-0"
                        >
                          متابعة الحفظ
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onNavigate('plans')}
                          className="min-h-11 px-3 py-1.5 rounded-xl border border-[#1C4E46]/15 dark:border-[#E0A96D]/25 text-[#1C4E46] dark:text-[#E0A96D] font-bold shrink-0"
                        >
                          تفاصيل الخطة
                        </button>
                      )}
                    </div>
                  ))}

                  {hub.completedTodayItems.map((done) => (
                    <div
                      key={`done-${done.planId}-${done.scheduledDate}`}
                      role="listitem"
                      className="py-2 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]"
                    >
                      <span className="font-semibold text-[#1C4E46] dark:text-[#6EE7B7]">
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

          <div className="pt-5 mt-4 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              disabled={dailyTask.source === 'blocked'}
              onClick={() => { if (dailyTask.source === 'blocked') return; onStartSession(dailyTask.surahNumber, dailyTask.startAyah, dailyTask.endAyah, dailyTask.mode, dailyTask.enginePlanId, dailyTask.enginePlanDate); }}
              className="flex-1 w-full min-h-12 flex items-center justify-center gap-2 py-3 px-4 bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#235D59] text-white font-bold text-xs md:text-sm rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed ring-1 ring-[#C59B27]/35"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>{dailyTask.source === 'blocked' ? 'اختر نطاق الخطة' : dailyTask.mode === 'review' ? 'بدء جلسة المراجعة التفاعلية' : 'بدء جلسة الحفظ التفاعلية'}</span>
            </button>
            <button
              onClick={() => onNavigate('library')}
              className="w-full sm:w-auto min-h-11 px-4 py-3 bg-[#F2EDE2] hover:bg-[#e5decb] dark:bg-[#162744] dark:hover:bg-[#1e355c] text-[#142421] dark:text-[#F5F1E8] font-semibold text-xs md:text-sm rounded-xl transition-colors border border-[#1C4E46]/12 dark:border-[#E0A96D]/20 whitespace-nowrap"
              title="تصفح المصحف واختيار سورة أخرى يدوياً"
            >
              سورة أخرى
            </button>
          </div>
        </section>

        {/* REVISION & WEAK VERSES CARD (المراجعة والتثبيت) */}
        <div id="dashboard-revision-card" className="wird-card p-6 flex flex-col justify-between scroll-mt-20">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center border border-[#C59B27]/30">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#142421] dark:text-[#F5F1E8]">
                    المراجعة والتثبيت (التكرار المتباعد)
                  </h3>
                  <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                    المراجعة الصغرى (الحديثة) والكبرى (التراكمية) ومواضع التعثر
                  </p>
                </div>
              </div>

              <span className="text-xs font-bold text-[#9A7512] dark:text-[#E0A96D] tabular-nums whitespace-nowrap">
                {totalDueCount} مهام مستحقة
              </span>
            </div>

            <div className="divide-y divide-[#1C4E46]/10 dark:divide-[#E0A96D]/15">
              {displayedQueuePortions.slice(0, 3).map((item) => (
                <div 
                  key={item.id}
                  className="py-3 first:pt-1 last:pb-1 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 text-right min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#142421] dark:text-[#F5F1E8] text-sm font-quran">
                        سورة {item.surahName}
                      </span>
                      <span className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                        · {item.revisionType === 'major' ? 'مراجعة كبرى' : 'مراجعة صغرى'}
                      </span>
                    </div>
                    <div className="text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
                      الآيات ({item.startAyah} - {item.endAyah}) {item.pageNumber && `· صفحة ${item.pageNumber}`}
                    </div>
                  </div>

                  <button
                    onClick={() => onNavigate('revision')}
                    className="min-h-11 px-3.5 py-1.5 bg-[#F2EDE2] dark:bg-[#162744] hover:bg-[#1C4E46] dark:hover:bg-[#1E4A47] text-[#142421] dark:text-[#F5F1E8] hover:text-white rounded-xl font-bold transition-colors shrink-0"
                  >
                    مراجعة
                  </button>
                </div>
              ))}

              {displayedQueuePortions.length === 0 && (
                <div className="text-center py-6 text-[#5B6F6B] dark:text-[#8B9E9B] text-xs space-y-1">
                  <Check className="w-6 h-6 text-[#1C4E46] dark:text-[#E0A96D] mx-auto" />
                  <p>{totalDueCount > 0 ? 'جلسة اليوم تعرض المراجعة ذات الأولوية؛ لا توجد مهام أخرى في القائمة.' : 'أتممت جميع مهام المراجعة لليوم، بارك الله فيك!'}</p>
                </div>
              )}
            </div>

            {hub.urgentWeakVerses.length > 0 && (
              <div className="pt-3 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-rose-800 dark:text-rose-300">
                    مواضع تعثر تتطلب التثبيت ({weakVerses.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('revision')}
                    className="text-[#9A7512] dark:text-[#E0A96D] font-bold hover:underline"
                  >
                    مراجعة المتعثرة
                  </button>
                </div>
                {hub.urgentWeakVerses.slice(0, 2).map(wv => (
                  <div key={wv.id} className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-quran text-[#142421] dark:text-[#F5F1E8] truncate">
                      سورة {wv.surahName} · آية {wv.ayahNumber} (تعثر ×{wv.mistakeCount})
                    </span>
                    <button
                      type="button"
                      onClick={() => onStartSession(wv.surahNumber, wv.ayahNumber, wv.ayahNumber, 'review')}
                      className="min-h-11 px-2.5 py-1 rounded-lg bg-[#F2EDE2] dark:bg-[#162744] text-[#142421] dark:text-[#F5F1E8] font-bold shrink-0"
                    >
                      تثبيت الآية
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#1C4E46]/10 dark:border-[#E0A96D]/15 flex items-center justify-between text-xs">
            <span className="text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums">
              صغرى: {minorRevisionsCount} · كبرى: {majorRevisionsCount}
            </span>
            <button
              onClick={() => onNavigate('revision')}
              className="min-h-11 px-2 text-[#C59B27] dark:text-[#E0A96D] font-bold hover:underline flex items-center gap-1"
            >
              <span>فتح مركز المراجعة الكامل</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Five Clearly Separated Metrics (New Memorized / Reviewed / Mastered / Weak / Reading Khatma Pages) */}
      <div id="dashboard-metrics-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 scroll-mt-20">
        {/* Metric 1: New Memorized & Cumulative Balance */}
        <div className="wird-card p-5">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mb-1">الآيات المحفوظة (الجديد والتراكمي)</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums font-mono">
              {totalMemorizedAyahs}
            </span>
            <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums font-mono">من {TOTAL_QURAN_VERSES}</span>
          </div>
          <div role="progressbar" aria-label="نسبة الآيات المحفوظة" aria-valuemin={0} aria-valuemax={TOTAL_QURAN_VERSES} aria-valuenow={totalMemorizedAyahs} className="w-full bg-[#F2EDE2] dark:bg-[#0E1A2F] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#1C4E46] dark:bg-[#1E4A47] h-full rounded-full" style={{ width: `${versesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[#1C4E46] dark:text-[#E0A96D] mt-1.5 font-medium tabular-nums">
            {versesPercentage}% · المتقن الراسخ: {masteredPortionsCount} مقطع
          </div>
        </div>

        {/* Metric 2: Memorized Pages vs Reviewed/Weak */}
        <div className="wird-card p-5">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mb-1">الصفحات المحفوظة بالكامل</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums font-mono">
              {totalMemorizedPages}
            </span>
            <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] tabular-nums font-mono">من {TOTAL_QURAN_PAGES} صفحة</span>
          </div>
          <div role="progressbar" aria-label="نسبة الصفحات المحفوظة بالكامل" aria-valuemin={0} aria-valuemax={TOTAL_QURAN_PAGES} aria-valuenow={totalMemorizedPages} className="w-full bg-[#F2EDE2] dark:bg-[#0E1A2F] h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-[#C59B27] dark:bg-[#E0A96D] h-full rounded-full" style={{ width: `${pagesPercentage}%` }} />
          </div>
          <div className="text-[11px] text-[#C59B27] dark:text-[#E0A96D] mt-1.5 font-medium tabular-nums">
            المراجعات المنجزة: {retentionMetrics.totalReviewsCompleted} · الآيات الضعيفة: {retentionMetrics.weakVersesCount}
          </div>
        </div>

        {/* Metric 3: Weekly Activity */}
        <div className="wird-card p-5">
          <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mb-1">نشاط الحفظ والمراجعة أسبوعياً</div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-[#142421] dark:text-[#F5F1E8] tabular-nums font-mono">
              {totalWeeklyMinutes}
            </span>
            <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">دقيقة حفظ ومراجعة</span>
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] mt-3 font-medium tabular-nums">
            حفظ جديد: <strong className="text-[#1C4E46] dark:text-[#E0A96D]">{totalWeeklyAyahs} آية</strong> · مراجعة: <strong>{totalWeeklyReviewedPages} ص</strong>
          </div>
        </div>

        {/* Metric 4: Streak + Separate Reading Khatma Pages */}
        <div className="wird-card p-5 flex flex-col justify-between">
          <div>
            <div className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mb-1 flex items-center justify-between">
              <span>سلسلة الالتزام والختمة</span>
              <Flame className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D] fill-[#C59B27]/30" />
            </div>
            <div className="text-2xl font-bold text-[#C59B27] dark:text-[#E0A96D] tabular-nums font-mono">
              {profile.streakDays} يوماً متواصلاً
            </div>
          </div>
          <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B] mt-2 space-y-0.5 tabular-nums">
            <div>مستوى التثبيت: <strong className="text-[#142421] dark:text-[#F5F1E8]">{retentionStatusLabel}</strong></div>
            <div>ختمة القراءة (منفصلة): <strong className="text-[#1C4E46] dark:text-[#6EE7B7]">{readingKhatmaPagesCount} / {TOTAL_QURAN_PAGES} صفحة</strong></div>
          </div>
        </div>
      </div>

      {/* 4. Weekly Activity Chart & Quick Action Hub */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Chart */}
        <div className="lg:col-span-2 wird-card p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8]">
                سجل النشاط الأسبوعي (الدقائق والآيات)
              </h3>
              <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
                انتظامك اليومي هو سر رسوخ المحفوظ في الصدر
              </p>
            </div>
            <span className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] font-mono">آخر 7 أيام</span>
          </div>

          <div role="list" aria-label="النشاط الأسبوعي" className="flex items-end justify-between gap-3 h-40 pt-4 border-b border-[#1C4E46]/10 dark:border-[#E0A96D]/15">
            {last7Logs.map((log, idx) => {
              const maxMinutes = 50;
              const heightPercent = Math.min(100, Math.round((log.minutesSpent / maxMinutes) * 100));
              const [year, month, day] = log.date.split('-').map(Number);
              const dayName = new Date(year, month - 1, day).toLocaleDateString('ar-SA', { weekday: 'short' });

              return (
                <div key={idx} role="listitem" aria-label={`${dayName}: ${log.minutesSpent} دقيقة، ${log.memorizedAyahsCount} آية`} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 bg-[#0B132B] text-[#F5F1E8] text-[10px] py-1 px-2 rounded-md whitespace-nowrap pointer-events-none z-20 font-mono border border-[#E0A96D]/30">
                    {log.minutesSpent}د · {log.memorizedAyahsCount} آيات
                  </div>

                  <div className="text-[10px] text-[#5B6F6B] dark:text-[#8B9E9B] font-mono tabular-nums">
                    {log.minutesSpent}د
                  </div>
                  <div role="progressbar" aria-label={`دقائق الحفظ والمراجعة يوم ${dayName}`} aria-valuemin={0} aria-valuemax={50} aria-valuenow={Math.min(50, log.minutesSpent)} className="w-full max-w-[32px] bg-[#F2EDE2] dark:bg-[#0E1A2F] rounded-t-lg overflow-hidden h-full flex items-end">
                    <div 
                      className="w-full bg-[#1C4E46] hover:bg-[#28665B] dark:bg-[#1E4A47] dark:hover:bg-[#E0A96D] rounded-t-lg transition-all duration-300"
                      style={{ height: `${heightPercent}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold text-[#5B6F6B] dark:text-[#8B9E9B]">
                    {dayName}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-4 text-xs text-[#5B6F6B] dark:text-[#8B9E9B]">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#1C4E46] dark:bg-[#E0A96D] inline-block" />
              <span>جلسات الحفظ والمراجعة (بالدقائق)</span>
            </div>
            <button
              onClick={() => onNavigate('progress')}
              className="min-h-11 px-2 text-[#1C4E46] dark:text-[#E0A96D] font-semibold hover:underline flex items-center gap-1"
            >
              <span>عرض تفاصيل المصحف والتقارير</span>
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Quick Actions Hub */}
        <div id="dashboard-quick-actions" className="wird-card p-6 flex flex-col justify-between scroll-mt-20">
          <div>
            <h3 className="font-bold text-sm text-[#142421] dark:text-[#F5F1E8] mb-1">
              إجراءات سريعة
            </h3>
            <p className="text-xs text-[#5B6F6B] dark:text-[#8B9E9B] mb-4">
              أدوات تفاعلية لدعم رحلة حفظك
            </p>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onNavigate('tests')}
                className="w-full min-h-16 flex items-center justify-between p-3 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 hover:bg-[#F2EDE2] dark:hover:bg-[#162744] border border-[#1C4E46]/10 dark:border-[#E0A96D]/20 transition-colors text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#1C4E46]/12 dark:bg-[#1E4A47]/60 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center">
                    <CheckCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">اختبر حفظك الآن</div>
                    <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">أكمل الآية، المتشابهات اللفظية</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('library')}
                className="w-full min-h-16 flex items-center justify-between p-3 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 hover:bg-[#F2EDE2] dark:hover:bg-[#162744] border border-[#1C4E46]/10 dark:border-[#E0A96D]/20 transition-colors text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#C59B27] dark:text-[#E0A96D] flex items-center justify-center">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">تصفح المصحف والمكتبة</div>
                    <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">114 سورة مع الاستماع والتفسير</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('plans')}
                className="w-full min-h-16 flex items-center justify-between p-3 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 hover:bg-[#F2EDE2] dark:hover:bg-[#162744] border border-[#1C4E46]/10 dark:border-[#E0A96D]/20 transition-colors text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#28665B]/15 dark:bg-[#1E4A47]/60 text-[#28665B] dark:text-[#E0A96D] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">إدارة خطط الحفظ</div>
                    <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">إنشاء خطة مخصصة أو تفعيل نموذج</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate('advisor')}
                className="w-full min-h-16 flex items-center justify-between p-3 rounded-xl bg-[#F9F6EE] dark:bg-[#0B132B]/70 hover:bg-[#F2EDE2] dark:hover:bg-[#162744] border border-[#1C4E46]/10 dark:border-[#E0A96D]/20 transition-colors text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C59B27]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-[#C59B27]/15 dark:bg-[#E0A96D]/15 text-[#1C4E46] dark:text-[#E0A96D] flex items-center justify-center">
                    <Compass className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#142421] dark:text-[#F5F1E8]">المستشار القرآني</div>
                    <div className="text-[11px] text-[#5B6F6B] dark:text-[#8B9E9B]">نصائح التثبيت وعلاج التفلت</div>
                  </div>
                </div>
                <ArrowLeft className="w-4 h-4 text-[#C59B27] dark:text-[#E0A96D]" />
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
