import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Info,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { ALL_SURAHS } from '../../data/quranMeta';
import {
  EngineGeneratedPlan,
  PlanGenerationInput,
  PlanningEngine,
  ScheduledDayPlan,
} from '../../services/planningEngine';
import { PlanLifecycle } from '../../services/planLifecycle';
import { QuranMath } from '../../services/quranMath';
import {
  ALL_JUZ_DEFINITIONS,
  countTotalMemorizedVerses,
  MemorizedAyahRange,
  mergeMemorizedRanges,
} from '../../services/memorizedRangeService';
import { SurahPickerControl } from '../shared/SurahPickerControl';
import { DirectOptionGroup } from '../shared/DirectOptionGroup';
import { HorizontalScrollRail } from '../shared/HorizontalScrollRail';
import { ExistingMemorizedPicker } from './ExistingMemorizedPicker';
import { getLocalDateString } from '../../services/unifiedPortionService';

interface PlanningEngineWizardProps {
  enginePlans: EngineGeneratedPlan[];
  onUpdateEnginePlans: (plans: EngineGeneratedPlan[]) => boolean | Promise<boolean>;
  onStartSession: (surahNumber: number, startAyah: number, endAyah: number) => void;
  onOpenAdvisor?: () => void;
  onToast?: (message: string, type?: 'success' | 'warn' | 'error' | 'info') => void;
}

const WEEK_DAYS = [
  { id: 6, label: 'السبت' },
  { id: 0, label: 'الأحد' },
  { id: 1, label: 'الإثنين' },
  { id: 2, label: 'الثلاثاء' },
  { id: 3, label: 'الأربعاء' },
  { id: 4, label: 'الخميس' },
  { id: 5, label: 'الجمعة' },
];

const LEVEL_OPTIONS: Array<{ value: PlanGenerationInput['level']; label: string; hint: string }> = [
  { value: 'beginner', label: 'مبتدئ', hint: 'تكرار مكثف وتأنٍ' },
  { value: 'intermediate', label: 'متوسط', hint: 'حفظ مستمر منتظم' },
  { value: 'advanced', label: 'متقدم', hint: 'استيعاب أسرع' },
  { value: 'hafiz', label: 'حافظ', hint: 'تثبيت وضبط متقن' },
];

const DAILY_MINUTES_OPTIONS = [
  { value: 15, label: '15 د' },
  { value: 30, label: '30 د', hint: 'موصى به' },
  { value: 45, label: '45 د' },
  { value: 60, label: 'ساعة' },
  { value: 90, label: '90 د' },
];

const REVISION_MINUTES_OPTIONS = [
  { value: 10, label: '10 د', hint: 'صغرى' },
  { value: 15, label: '15 د', hint: 'موصى به' },
  { value: 25, label: '25 د', hint: 'صغرى وكبرى' },
  { value: 40, label: '40 د', hint: 'مكثف' },
];

type WizardStep = 1 | 2 | 3 | 4;

const WIZARD_STEPS: Array<{ step: WizardStep; title: string; subtitle: string }> = [
  { step: 1, title: 'نطاق الحفظ', subtitle: 'الهدف والسور' },
  { step: 2, title: 'الوتيرة والأيام', subtitle: 'الكمية والوقت' },
  { step: 3, title: 'المحفوظ السابق', subtitle: 'سور أو أجزاء' },
  { step: 4, title: 'المعاينة والاعتماد', subtitle: 'الجدول النهائي' },
];

export const PlanningEngineWizard: React.FC<PlanningEngineWizardProps> = ({
  enginePlans,
  onUpdateEnginePlans,
  onStartSession,
  onOpenAdvisor,
  onToast,
}) => {
  const [selectedPlanId, setSelectedPlanId] = useState<string>(enginePlans[0]?.id || '');
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [wizardStep, setWizardStep] = useState<WizardStep>(1);
  const [scheduleViewMode, setScheduleViewMode] = useState<'weekly' | 'all'>('weekly');
  const [showRecalculateConfirm, setShowRecalculateConfirm] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [previewPlan, setPreviewPlan] = useState<EngineGeneratedPlan | null>(null);
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [pendingRecoveryMode, setPendingRecoveryMode] = useState<'shift' | 'light' | 'rebalance' | null>(null);
  const [isApplyingRecovery, setIsApplyingRecovery] = useState(false);
  const recalculateDialogRef = useRef<HTMLDivElement>(null);
  const cancelRecalculateRef = useRef<HTMLButtonElement>(null);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const cancelDeleteRef = useRef<HTMLButtonElement>(null);
  const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const activeDialog = showRecalculateConfirm
      ? recalculateDialogRef
      : planToDelete
      ? deleteDialogRef
      : null;
    if (!activeDialog) return;

    const trigger = modalTriggerRef.current;
    if (showRecalculateConfirm) {
      cancelRecalculateRef.current?.focus();
    } else if (planToDelete) {
      cancelDeleteRef.current?.focus();
    }

    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showRecalculateConfirm) setShowRecalculateConfirm(false);
        if (planToDelete) setPlanToDelete(null);
        return;
      }
      if (event.key !== 'Tab') return;

      const dialog = activeDialog.current;
      if (!dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleDialogKeyDown);
    return () => {
      document.removeEventListener('keydown', handleDialogKeyDown);
      trigger?.focus();
    };
  }, [showRecalculateConfirm, planToDelete]);

  const activePlan = enginePlans.find(p => p.id === selectedPlanId) || enginePlans[0];

  // Form State for new Plan Generation
  const [planTitle, setPlanTitle] = useState('');
  const [startSurah, setStartSurah] = useState<number>(67);
  const [startAyah, setStartAyah] = useState<number>(1);
  const [endSurah, setEndSurah] = useState<number>(67);
  const [endAyah, setEndAyah] = useState<number>(30);
  const [selectedTargetJuz, setSelectedTargetJuz] = useState<string>('');
  const [startDate] = useState(PlanningEngine.formatDate(new Date()));
  const [targetEndDate, setTargetEndDate] = useState('');
  const [level, setLevel] = useState<PlanGenerationInput['level']>('intermediate');
  const [dailyAvailableMinutes, setDailyAvailableMinutes] = useState<number>(30);
  const [dailyRevisionMinutes, setDailyRevisionMinutes] = useState<number>(15);
  const [paceType, setPaceType] = useState<PlanGenerationInput['paceType']>('verses_per_day');
  const [paceQuantity, setPaceQuantity] = useState<number>(5);
  const [activeDays, setActiveDays] = useState<number[]>([0, 1, 2, 3, 4, 6]);
  const [restDays, setRestDays] = useState<number[]>([5]);
  const [existingMemorizedRanges, setExistingMemorizedRanges] = useState<MemorizedAyahRange[]>([]);

  const startSurahMeta = ALL_SURAHS.find(s => s.number === startSurah);
  const endSurahMeta = ALL_SURAHS.find(s => s.number === endSurah);

  const liveTotalVerses = QuranMath.countVersesBetween(
    { surahNumber: startSurah, ayahNumber: startAyah },
    { surahNumber: endSurah, ayahNumber: endAyah }
  );

  const existingMemorizedCount = useMemo(
    () => countTotalMemorizedVerses(existingMemorizedRanges),
    [existingMemorizedRanges]
  );

  const safePaceQuantity =
    paceType === 'pages_per_day'
      ? (Number.isFinite(paceQuantity) && paceQuantity > 0 ? Math.min(5, Math.max(0.5, paceQuantity)) : 0.5)
      : (Number.isFinite(paceQuantity) && paceQuantity > 0 ? Math.min(100, Math.max(1, Math.round(paceQuantity))) : 1);

  const liveDailyPaceVerses =
    paceType === 'pages_per_day'
      ? Math.max(1, Math.round(safePaceQuantity * 15))
      : paceType === 'by_target_date'
      ? Math.max(
          1,
          Math.ceil(
            liveTotalVerses /
              Math.max(
                1,
                PlanningEngine.countActiveDaysBetween(
                  startDate,
                  targetEndDate && targetEndDate > startDate ? targetEndDate : startDate,
                  activeDays,
                  restDays
                )
              )
          )
        )
      : safePaceQuantity;

  const liveFeasibility = PlanningEngine.assessFeasibility(
    liveDailyPaceVerses,
    level,
    dailyAvailableMinutes,
    dailyRevisionMinutes
  );

  const handleToggleActiveDay = (dayId: number) => {
    if (activeDays.includes(dayId)) {
      if (activeDays.length > 1) {
        setActiveDays(activeDays.filter(d => d !== dayId));
        if (!restDays.includes(dayId)) {
          setRestDays([...restDays, dayId]);
        }
      }
    } else {
      setActiveDays([...activeDays, dayId]);
      setRestDays(restDays.filter(d => d !== dayId));
    }
  };

  const handleApplyFullSurahTarget = () => {
    const meta = startSurahMeta || ALL_SURAHS[0];
    setSelectedTargetJuz('');
    setStartAyah(1);
    setEndSurah(meta.number);
    setEndAyah(meta.versesCount);
    if (!planTitle.trim()) {
      setPlanTitle(`خطة حفظ سورة ${meta.name}`);
    }
  };

  const handleApplyJuzTarget = (juzValue: string) => {
    setSelectedTargetJuz(juzValue);
    if (!juzValue) return;
    const juzNum = Number(juzValue);
    const def = ALL_JUZ_DEFINITIONS.find(item => item.juzNumber === juzNum);
    if (!def) return;
    setStartSurah(def.startSurahNumber);
    setStartAyah(def.startAyah);
    setEndSurah(def.endSurahNumber);
    setEndAyah(def.endAyah);
    setPlanTitle(`خطة حفظ ${def.name}`);
  };

  const buildPlanInput = (): PlanGenerationInput => {
    const normalizedExisting = mergeMemorizedRanges(existingMemorizedRanges);
    const safeTargetEndDate =
      paceType === 'by_target_date' && targetEndDate && targetEndDate.trim()
        ? targetEndDate.trim()
        : undefined;

    return {
      title: planTitle.trim() || `خطة حفظ سورة ${startSurahMeta?.name || 'القرآن'}`,
      startSurah,
      startAyah,
      endSurah,
      endAyah,
      startDate,
      targetEndDate: safeTargetEndDate,
      level,
      dailyAvailableMinutes,
      dailyRevisionMinutes,
      paceType,
      paceQuantity: paceType === 'by_target_date' ? paceQuantity || 1 : paceQuantity,
      activeDays,
      restDays,
      schedulePreference: 'single_session',
      existingMemorized: normalizedExisting,
    };
  };

  const generatePreviewSafely = (): boolean => {
    try {
      if (liveTotalVerses <= 0) {
        onToast?.('نطاق الحفظ المحدد غير صالح؛ تأكد أن نقطة النهاية بعد البداية.', 'error');
        setWizardStep(1);
        return false;
      }
      if (paceType !== 'by_target_date' && (!Number.isFinite(paceQuantity) || paceQuantity <= 0)) {
        onToast?.('يرجى إدخال مقدار حفظ يومي صحيح أكبر من صفر.', 'error');
        setWizardStep(2);
        return false;
      }
      if (paceType === 'by_target_date') {
        if (!targetEndDate || !targetEndDate.trim()) {
          onToast?.('يرجى تحديد تاريخ الختم المستهدف أولاً في خطوة الوتيرة والأيام.', 'error');
          setWizardStep(2);
          return false;
        }
        if (targetEndDate.trim() <= startDate) {
          onToast?.('تاريخ الختم المستهدف يجب أن يكون بعد تاريخ البداية.', 'error');
          setWizardStep(2);
          return false;
        }
      }
      const generated = PlanningEngine.generatePlan(buildPlanInput());
      setPreviewPlan(generated);
      return true;
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر إعداد المعاينة. راجع المدخلات وحاول مجدداً.',
        'error'
      );
      return false;
    }
  };

  const handleGoToStep = (nextStep: WizardStep) => {
    if (nextStep > 1 && liveTotalVerses <= 0) {
      onToast?.('حدد نطاق حفظ صحيح أولاً قبل المتابعة.', 'error');
      setWizardStep(1);
      return;
    }
    if (nextStep === 4) {
      const ok = generatePreviewSafely();
      if (!ok) return;
    }
    setWizardStep(nextStep);
  };

  const handlePreviewPlan = (e: React.FormEvent) => {
    e.preventDefault();
    if (generatePreviewSafely()) {
      setWizardStep(4);
      onToast?.('تم إعداد المعاينة للجدول الزمني. يمكنك مراجعتها قبل الاعتماد.', 'info');
    }
  };

  const handleSaveConfirmedPlan = async (planToSave: EngineGeneratedPlan) => {
    if (isGeneratingPlan) return;
    setIsGeneratingPlan(true);

    try {
      const updated = [planToSave, ...enginePlans.filter(plan => plan.id !== planToSave.id)];
      if (!(await onUpdateEnginePlans(updated))) return;
      setSelectedPlanId(planToSave.id);
      setIsCreatingNew(false);
      setPreviewPlan(null);
      setWizardStep(1);
      onToast?.('تم حفظ الخطة الذكية وتفعيلها بنجاح.', 'success');
    } catch (error) {
      onToast?.(
        error instanceof Error ? error.message : 'تعذر حفظ الخطة. حاول مجدداً.',
        'error'
      );
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleConfirmDeletePlan = async () => {
    if (!planToDelete) return;
    const remaining = enginePlans.filter(p => p.id !== planToDelete);
    if (!(await onUpdateEnginePlans(remaining))) return;
    setSelectedPlanId(remaining[0]?.id || '');
    setPlanToDelete(null);
    onToast?.('تم حذف الخطة من قائمتك بنجاح.', 'info');
  };

  const handleTogglePause = async () => {
    if (!activePlan) return;
    const updated: EngineGeneratedPlan = activePlan.isPaused
      ? PlanLifecycle.resumePlan(activePlan)
      : PlanLifecycle.pausePlan(activePlan);
    if (!(await onUpdateEnginePlans(enginePlans.map(p => (p.id === activePlan.id ? updated : p))))) return;
    onToast?.(
      activePlan.isPaused ? 'تم استئناف الخطة بنجاح' : 'تم إيقاف الخطة مؤقتاً',
      activePlan.isPaused ? 'success' : 'info'
    );
  };

  const handleConfirmRecalculate = async () => {
    if (!activePlan) return;
    const updated = PlanLifecycle.recalculatePlan(activePlan);
    if (!(await onUpdateEnginePlans(enginePlans.map(p => (p.id === activePlan.id ? updated : p))))) return;
    setShowRecalculateConfirm(false);
    onToast?.('تمت إعادة جدولة المهام القادمة بنجاح مع الاحتفاظ بكامل سجلاتك المنجزة.', 'success');
  };

  const todayStr = getLocalDateString();
  const activePlanMissedSummary = useMemo(
    () => (activePlan ? PlanLifecycle.detectMissedDays(activePlan, todayStr) : null),
    [activePlan, todayStr]
  );

  const handleConfirmMissedRecovery = async () => {
    if (!activePlan || !pendingRecoveryMode || isApplyingRecovery) return;
    setIsApplyingRecovery(true);
    try {
      const outcome =
        pendingRecoveryMode === 'shift'
          ? PlanLifecycle.shiftMissedForward(activePlan, todayStr)
          : pendingRecoveryMode === 'light'
          ? PlanLifecycle.scheduleLightRecoveryDay(activePlan, todayStr)
          : PlanLifecycle.rebalanceRemainingPlan(activePlan, todayStr);
      if (!outcome.changed) {
        onToast?.(outcome.actionLabelAr, 'info');
        setPendingRecoveryMode(null);
        return;
      }
      const nextPlans = enginePlans.map(p => (p.id === activePlan.id ? outcome.plan : p));
      if (await onUpdateEnginePlans(nextPlans)) {
        onToast?.(outcome.actionLabelAr, 'success');
        setPendingRecoveryMode(null);
      }
    } finally {
      setIsApplyingRecovery(false);
    }
  };

  const resetAndOpenCreator = () => {
    setPreviewPlan(null);
    setWizardStep(1);
    setIsCreatingNew(true);
  };

  const resolvedTitlePreview = planTitle.trim() || `خطة حفظ سورة ${startSurahMeta?.name || 'القرآن'}`;
  const feasibilityLabel =
    liveFeasibility.cognitiveLoadScore === 'optimal'
      ? 'مثالي ومتوازن'
      : liveFeasibility.cognitiveLoadScore === 'light'
      ? 'خفيف وميسر'
      : liveFeasibility.cognitiveLoadScore === 'strenuous'
      ? 'مكثف ويتطلب التزاماً'
      : 'غير واقعي ومجهد';

  return (
    <div className="space-y-6">
      {/* 1. Single Clean Header Toolbar & Plan Switcher */}
      <div className="wird-card p-5 sm:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--wird-text)] flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[var(--wird-accent)] shrink-0" />
              <span>{isCreatingNew ? 'إنشاء خطة حفظ مخصصة' : 'خططك الذكية وجدول الحفظ'}</span>
            </h2>
            <p className="text-xs text-[var(--wird-muted)] mt-1">
              {isCreatingNew
                ? 'اضبط هدفك القرآني وحدد محفوظك السابق في أربع خطوات متدرجة واضحة'
                : 'توزيع يومي متزن للحفظ الجديد والمراجعة الصغرى والكبرى وفق طاقتك'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onOpenAdvisor && !isCreatingNew && (
              <button
                type="button"
                onClick={onOpenAdvisor}
                className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:border-[var(--wird-accent)] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <Compass className="w-4 h-4 text-[var(--wird-accent)]" />
                <span>اقتراح عبر المستشار</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isCreatingNew) {
                  setIsCreatingNew(false);
                  setPreviewPlan(null);
                } else {
                  resetAndOpenCreator();
                }
              }}
              className="wird-btn-primary min-h-11 px-4 py-2 text-xs whitespace-nowrap"
            >
              {isCreatingNew ? 'العودة إلى الخطط' : '+ إنشاء خطة جديدة'}
            </button>
          </div>
        </div>

        {enginePlans.length > 0 && !isCreatingNew && (
          <HorizontalScrollRail
            ariaLabel="الخطط الذكية المحفوظة"
            activeKey={activePlan?.id || selectedPlanId}
            className="pt-2 border-t border-[var(--wird-border)]"
          >
            {enginePlans.map(p => {
              const isSelected = p.id === (activePlan?.id || selectedPlanId);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlanId(p.id)}
                  aria-pressed={isSelected}
                  className={`min-h-11 shrink-0 snap-start px-3.5 py-2 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isSelected
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  <span>{p.title}</span>
                  {p.isPaused && <span className="text-[10px] opacity-75">· موقفة</span>}
                </button>
              );
            })}
          </HorizontalScrollRail>
        )}
      </div>

      {/* Empty State when user has no Engine Plans yet */}
      {!isCreatingNew && enginePlans.length === 0 && (
        <div className="wird-card border-dashed px-6 py-12 text-center space-y-3">
          <Calendar className="mx-auto h-10 w-10 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
          <h3 className="text-base font-bold text-[var(--wird-text)]">
            لا توجد خطة مخصصة نشطة بعد
          </h3>
          <p className="mx-auto max-w-md text-xs leading-6 text-[var(--wird-muted)]">
            أنشئ خطتك الأولى باختيار السور أو الأجزاء المستهدفة وتحديد ما تحفظه مسبقاً ليحسب لك النظام جدولاً متزناً للحفظ والمراجعة.
          </p>
          <button
            type="button"
            onClick={resetAndOpenCreator}
            className="wird-btn-primary mt-2 min-h-11 px-5 py-2.5 text-xs"
          >
            + بدء إنشاء خطة جديدة
          </button>
        </div>
      )}

      {/* 2. Stepped Plan Generation Wizard + Sticky Summary */}
      {isCreatingNew && (
        <form onSubmit={handlePreviewPlan} className="space-y-5 text-xs">
          {/* Numbered Step Bar */}
          <nav
            aria-label="خطوات إعداد الخطة"
            className="wird-card p-2.5 grid grid-cols-2 lg:grid-cols-4 gap-2"
          >
            {WIZARD_STEPS.map(item => {
              const isCurrent = wizardStep === item.step;
              const isDone = wizardStep > item.step;
              return (
                <button
                  key={item.step}
                  type="button"
                  onClick={() => handleGoToStep(item.step)}
                  aria-current={isCurrent ? 'step' : undefined}
                  className={`min-h-12 px-3 py-2 rounded-xl border text-right flex items-center gap-2.5 transition-colors ${
                    isCurrent
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)]'
                      : isDone
                      ? 'bg-[var(--wird-primary-soft)] text-[var(--wird-text)] border-[var(--wird-border-strong)]'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] border-[var(--wird-border)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  <span
                    className={`w-7 h-7 rounded-lg font-mono font-bold tabular-nums text-xs flex items-center justify-center shrink-0 ${
                      isCurrent
                        ? 'bg-[var(--wird-accent)] text-[var(--wird-accent-ink)]'
                        : isDone
                        ? 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] text-white dark:text-[var(--wird-accent-ink)]'
                        : 'bg-[var(--wird-surface)] text-[var(--wird-text)]'
                    }`}
                  >
                    {isDone ? <Check className="w-3.5 h-3.5" /> : item.step}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-bold truncate">{item.title}</span>
                    <span
                      className={`block text-[10px] truncate ${
                        isCurrent ? 'text-white/80' : 'opacity-75'
                      }`}
                    >
                      {item.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Main 2-Column Split: Active Step Form + Sticky Live Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* Active Step Container (8 cols) */}
            <div className="lg:col-span-8 wird-card p-5 sm:p-6 space-y-6">
              {/* STEP 1: Target Scope */}
              {wizardStep === 1 && (
                <div className="space-y-5">
                  <div className="pb-3 border-b border-[var(--wird-border)]">
                    <h3 className="font-bold text-base text-[var(--wird-text)]">
                      1. تحديد نطاق الحفظ والهدف
                    </h3>
                    <p className="text-[var(--wird-muted)] mt-0.5">
                      اختر نقطة البداية والنهاية، أو استخدم التحديد السريع لسورة أو جزء كامل
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="wird-plan-title"
                      className="block font-semibold text-[var(--wird-text)] mb-1.5"
                    >
                      عنوان الخطة (اختياري):
                    </label>
                    <input
                      id="wird-plan-title"
                      type="text"
                      value={planTitle}
                      onChange={e => setPlanTitle(e.target.value)}
                      placeholder="مثال: خطة حفظ سورة الكهف بتثبيت أسبوعي..."
                      className="w-full min-h-11 px-3.5 py-2.5 bg-[var(--wird-surface-muted)] border border-[var(--wird-border-strong)] rounded-xl text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-ring)]"
                    />
                  </div>

                  {/* Quick Scope Helpers */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-xl bg-[var(--wird-surface-muted)] border border-[var(--wird-border)]">
                    <button
                      type="button"
                      onClick={handleApplyFullSurahTarget}
                      className="min-h-11 px-3.5 py-2 rounded-xl bg-[var(--wird-surface)] border border-[var(--wird-border-strong)] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] hover:border-[var(--wird-accent)] font-bold text-xs whitespace-nowrap transition-colors"
                    >
                      تحديد سورة {startSurahMeta?.name || 'البداية'} كاملة
                    </button>

                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <label
                        htmlFor="wird-quick-juz-target"
                        className="font-semibold text-[var(--wird-muted)] whitespace-nowrap"
                      >
                        أو استهدف جزءاً كاملاً:
                      </label>
                      <select
                        id="wird-quick-juz-target"
                        value={selectedTargetJuz}
                        onChange={e => handleApplyJuzTarget(e.target.value)}
                        className="flex-1 min-w-0 min-h-11 px-3 py-2 bg-[var(--wird-surface)] border border-[var(--wird-border-strong)] rounded-xl text-xs font-semibold text-[var(--wird-text)] focus:outline-none focus:ring-2 focus:ring-[var(--wird-ring)]"
                      >
                        <option value="">— اختر جزءاً من القرآن —</option>
                        {ALL_JUZ_DEFINITIONS.map(def => (
                          <option key={def.juzNumber} value={String(def.juzNumber)}>
                            {def.name} ({def.startSurahName} {def.startAyah} ← {def.endSurahName} {def.endAyah})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SurahPickerControl
                      label="نقطة البداية"
                      ariaLabel="اختيار سورة البداية"
                      value={startSurah}
                      onChange={s => {
                        setSelectedTargetJuz('');
                        setStartSurah(s);
                        setStartAyah(1);
                        if (s > endSurah) {
                          setEndSurah(s);
                          const adjustedEndSurah = ALL_SURAHS.find(item => item.number === s);
                          setEndAyah(adjustedEndSurah?.versesCount || 1);
                        }
                      }}
                      ayahLabel="من الآية"
                      ayahValue={startAyah}
                      onAyahChange={val => {
                        setSelectedTargetJuz('');
                        setStartAyah(val);
                      }}
                      maxAyah={startSurahMeta?.versesCount || 286}
                      showQuickPopular
                    />

                    <SurahPickerControl
                      label="نقطة النهاية"
                      ariaLabel="اختيار سورة النهاية"
                      value={endSurah}
                      onChange={s => {
                        setSelectedTargetJuz('');
                        setEndSurah(s);
                        const targetS = ALL_SURAHS.find(item => item.number === s);
                        setEndAyah(targetS ? targetS.versesCount : 10);
                      }}
                      ayahLabel="إلى الآية"
                      ayahValue={endAyah}
                      onAyahChange={val => {
                        setSelectedTargetJuz('');
                        setEndAyah(val);
                      }}
                      maxAyah={endSurahMeta?.versesCount || 286}
                      showQuickPopular
                    />
                  </div>
                </div>
              )}

              {/* STEP 2: Level, Time Budget, Pace & Study Days */}
              {wizardStep === 2 && (
                <div className="space-y-5">
                  <div className="pb-3 border-b border-[var(--wird-border)]">
                    <h3 className="font-bold text-base text-[var(--wird-text)]">
                      2. الوتيرة والوقت وأيام الدراسة
                    </h3>
                    <p className="text-[var(--wird-muted)] mt-0.5">
                      حدد وقتك المتاح يومياً والكمية المناسبة لتوزيع المهام دون إرهاق
                    </p>
                  </div>

                  <div>
                    <span className="block font-semibold text-[var(--wird-text)] mb-2">
                      المستوى القرآني:
                    </span>
                    <DirectOptionGroup
                      ariaLabel="المستوى القرآني"
                      layout="grid-4"
                      size="sm"
                      options={LEVEL_OPTIONS}
                      value={level}
                      onChange={setLevel}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="block font-semibold text-[var(--wird-text)] mb-2">
                        وقت الحفظ الجديد يومياً:
                      </span>
                      <DirectOptionGroup
                        ariaLabel="وقت الحفظ الجديد يومياً"
                        layout="scroll"
                        size="sm"
                        options={DAILY_MINUTES_OPTIONS}
                        value={dailyAvailableMinutes}
                        onChange={setDailyAvailableMinutes}
                      />
                    </div>

                    <div>
                      <span className="block font-semibold text-[var(--wird-text)] mb-2">
                        وقت المراجعة اليومي:
                      </span>
                      <DirectOptionGroup
                        ariaLabel="وقت المراجعة اليومي"
                        layout="scroll"
                        size="sm"
                        options={REVISION_MINUTES_OPTIONS}
                        value={dailyRevisionMinutes}
                        onChange={setDailyRevisionMinutes}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-[var(--wird-border)]">
                    <div>
                      <span className="block font-semibold text-[var(--wird-text)] mb-2">
                        طريقة تحديد وتيرة الحفظ:
                      </span>
                      <div className="grid grid-cols-1 gap-2">
                        {(
                          [
                            {
                              id: 'verses_per_day' as const,
                              title: 'عدد آيات ثابت',
                              detail: 'تحدد مقداراً واضحاً في كل يوم حفظ',
                            },
                            {
                              id: 'pages_per_day' as const,
                              title: 'عدد صفحات ثابت',
                              detail: 'تقدير تقريبي بمتوسط 15 آية للصفحة',
                            },
                            {
                              id: 'by_target_date' as const,
                              title: 'موعد ختم مستهدف',
                              detail: 'يوزع المقدار تلقائياً على أيامك النشطة',
                            },
                          ] as const
                        ).map(option => {
                          const selected = paceType === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setPaceType(option.id)}
                              className={`flex min-h-11 items-center justify-between gap-3 text-right rounded-xl border p-3 transition-colors ${
                                selected
                                  ? 'bg-[var(--wird-primary-soft)] border-[var(--wird-primary)] dark:border-[var(--wird-accent)] text-[var(--wird-text)]'
                                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border)] text-[var(--wird-muted)]'
                              }`}
                            >
                              <span className="min-w-0">
                                <span className="block text-xs font-bold">{option.title}</span>
                                <span className="block text-[11px] opacity-80 mt-0.5">{option.detail}</span>
                              </span>
                              <span
                                className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                                  selected ? 'border-[var(--wird-primary)] dark:border-[var(--wird-accent)]' : 'border-[var(--wird-border-strong)]'
                                }`}
                              >
                                {selected && (
                                  <span className="w-2 h-2 rounded-full bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)]" />
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {paceType === 'verses_per_day' && (
                        <div className="space-y-2">
                          <label className="block font-semibold text-[var(--wird-text)]">
                            عدد الآيات في كل يوم دراسة:
                          </label>
                          <DirectOptionGroup
                            ariaLabel="اختيارات سريعة لعدد الآيات اليومي"
                            layout="scroll"
                            size="sm"
                            options={[
                              { value: 3, label: '3 آيات' },
                              { value: 5, label: '5 آيات' },
                              { value: 8, label: '8 آيات' },
                              { value: 10, label: '10 آيات' },
                              { value: 15, label: '15 آية' },
                            ]}
                            value={paceQuantity}
                            onChange={setPaceQuantity}
                          />
                          <input
                            type="number"
                            min="1"
                            max="100"
                            aria-label="عدد الآيات اليومي المخصص"
                            value={Number.isFinite(paceQuantity) && paceQuantity > 0 ? paceQuantity : ''}
                            onChange={e => setPaceQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
                            onBlur={() => setPaceQuantity(safePaceQuantity)}
                            className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border-strong)] rounded-xl font-mono font-bold tabular-nums text-[var(--wird-text)]"
                          />
                        </div>
                      )}

                      {paceType === 'pages_per_day' && (
                        <div className="space-y-2">
                          <label className="block font-semibold text-[var(--wird-text)]">
                            عدد الصفحات يومياً (تقديري):
                          </label>
                          <DirectOptionGroup
                            ariaLabel="اختيارات سريعة لعدد الصفحات اليومي"
                            layout="scroll"
                            size="sm"
                            options={[
                              { value: 0.5, label: 'نصف وجه' },
                              { value: 1, label: 'وجه واحد' },
                              { value: 1.5, label: 'وجه ونصف' },
                              { value: 2, label: 'وجهان' },
                            ]}
                            value={paceQuantity}
                            onChange={setPaceQuantity}
                          />
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="5"
                            aria-label="عدد الصفحات اليومي المخصص"
                            value={Number.isFinite(paceQuantity) && paceQuantity > 0 ? paceQuantity : ''}
                            onChange={e => setPaceQuantity(e.target.value === '' ? 0 : Number(e.target.value))}
                            onBlur={() => setPaceQuantity(safePaceQuantity)}
                            className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border-strong)] rounded-xl font-mono font-bold tabular-nums text-[var(--wird-text)]"
                          />
                        </div>
                      )}

                      {paceType === 'by_target_date' && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="font-semibold text-[var(--wird-text)]">
                              تاريخ الختم المستهدف:
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                const rec = PlanningEngine.estimateRecommendedEndDate(
                                  startDate,
                                  liveTotalVerses,
                                  level,
                                  activeDays,
                                  restDays
                                );
                                setTargetEndDate(rec);
                                onToast?.(
                                  'تم ضبط تاريخ الختم الموصى به تلقائياً بما يضمن استقرار الحفظ.',
                                  'info'
                                );
                              }}
                              className="min-h-11 text-[11px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] font-bold hover:underline"
                            >
                              اقتراح موعد ملائم لطاقتك
                            </button>
                          </div>
                          <input
                            type="date"
                            required
                            value={targetEndDate}
                            onChange={e => setTargetEndDate(e.target.value)}
                            className="w-full min-h-11 px-3 py-2 bg-[var(--wird-surface-muted)] border border-[var(--wird-border-strong)] rounded-xl font-mono text-[var(--wird-text)]"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--wird-border)]">
                    <span className="block font-semibold text-[var(--wird-text)] mb-2">
                      أيام الدراسة النشطة أسبوعياً (انقر لتعيين يوم الاستراحة):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {WEEK_DAYS.map(day => {
                        const isActive = activeDays.includes(day.id);
                        return (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => handleToggleActiveDay(day.id)}
                            aria-pressed={isActive}
                            className={`min-h-11 py-2 px-3.5 rounded-xl border font-semibold transition-all whitespace-nowrap ${
                              isActive
                                ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)] border-[var(--wird-accent)] shadow-xs'
                                : 'bg-[var(--wird-surface-muted)] text-[var(--wird-muted)] border-[var(--wird-border)]'
                            }`}
                          >
                            {day.label} {isActive ? '✓' : '· راحة'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: Unified Pre-Memorized Portions Selector */}
              {wizardStep === 3 && (
                <div className="space-y-4">
                  <div className="pb-3 border-b border-[var(--wird-border)]">
                    <h3 className="font-bold text-base text-[var(--wird-text)]">
                      3. تحديد المحفوظ السابق (للمراجعة الكبرى)
                    </h3>
                    <p className="text-[var(--wird-muted)] mt-0.5">
                      حدّد أكثر من سورة دفعة واحدة، أو أجزاء كاملة، أو عدداً محدداً من آيات أي سورة، أو استورد سجل حفظك الحالي
                    </p>
                  </div>

                  <ExistingMemorizedPicker
                    value={existingMemorizedRanges}
                    onChange={setExistingMemorizedRanges}
                    onToast={onToast}
                  />
                </div>
              )}

              {/* STEP 4: Review, Live Preview & Save */}
              {wizardStep === 4 && (
                <div className="space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[var(--wird-border)]">
                    <div>
                      <h3 className="font-bold text-base text-[var(--wird-text)]">
                        4. معاينة الجدول الزمني واعتماد الخطة
                      </h3>
                      <p className="text-[var(--wird-muted)] mt-0.5">
                        راجع توزيع الأيام الأولى والمراجعة الكبرى قبل حفظ الخطة وتفعيلها
                      </p>
                    </div>
                    <button
                      type="submit"
                      className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border-strong)] bg-[var(--wird-surface-muted)] text-[var(--wird-text)] font-bold inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Eye className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                      <span>تحديث المعاينة</span>
                    </button>
                  </div>

                  {previewPlan && (
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[var(--wird-primary-soft)] p-4 rounded-2xl border border-[var(--wird-border-strong)]">
                        <div>
                          <h4 className="font-bold text-sm text-[var(--wird-text)]">
                            {previewPlan.title}
                          </h4>
                          <p className="text-[11px] text-[var(--wird-muted)] mt-0.5 tabular-nums">
                            {previewPlan.meta.totalVerses} آية · {previewPlan.meta.activeStudyDaysCount} يوماً نشطاً · {previewPlan.meta.restDaysCount} يوم استراحة · الختم المتوقع: {previewPlan.meta.projectedEndDate}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSaveConfirmedPlan(previewPlan)}
                          disabled={isGeneratingPlan}
                          className="wird-btn-accent min-h-11 px-5 py-2.5 text-xs whitespace-nowrap self-stretch sm:self-auto"
                        >
                          {isGeneratingPlan ? 'جارٍ الحفظ والتفعيل...' : 'اعتماد وحفظ الخطة'}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <span className="font-bold text-[var(--wird-text)] block text-xs">
                          توزيع الأيام الأولى في الجدول:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                          {previewPlan.schedule.slice(0, 6).map(day => (
                            <div
                              key={day.id}
                              className={`p-3 rounded-xl border text-xs ${
                                day.isRestDay
                                  ? 'bg-[var(--wird-surface-muted)]/70 border-[var(--wird-border)] text-[var(--wird-muted)]'
                                  : 'bg-[var(--wird-surface-muted)] border-[var(--wird-border-strong)]'
                              }`}
                            >
                              <div className="flex items-center justify-between font-bold mb-1">
                                <span className="text-[var(--wird-text)]">
                                  {day.dayNameAr} ({day.date})
                                </span>
                                {day.isRestDay ? (
                                  <span className="text-[10px]">استراحة</span>
                                ) : (
                                  <span className="text-[10px] text-[var(--wird-primary)] dark:text-[var(--wird-accent)] tabular-nums">
                                    {day.memorizationTask?.versesCount} آيات
                                  </span>
                                )}
                              </div>
                              {day.memorizationTask && (
                                <p className="text-[11px] text-[var(--wird-muted)]">
                                  {day.memorizationTask.surahName} ({day.memorizationTask.startAyah}-{day.memorizationTask.endAyah})
                                </p>
                              )}
                              {day.minorRevisionTask && (
                                <p className="text-[10px] text-[var(--wird-muted)] mt-1">
                                  {day.minorRevisionTask.description}
                                </p>
                              )}
                              {day.majorRevisionTask && (
                                <p className="text-[10px] text-[var(--wird-accent)] mt-0.5">
                                  كبرى: {day.majorRevisionTask.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Wizard Footer Navigation */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[var(--wird-border)]">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setPreviewPlan(null);
                    }}
                    className="min-h-11 px-4 py-2 bg-[var(--wird-surface-muted)] hover:opacity-90 text-[var(--wird-text)] rounded-xl font-semibold"
                  >
                    إلغاء
                  </button>

                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep((wizardStep - 1) as WizardStep)}
                      className="min-h-11 px-4 py-2 rounded-xl border border-[var(--wird-border-strong)] text-[var(--wird-text)] font-bold inline-flex items-center gap-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                      <span>السابق</span>
                    </button>
                  )}
                </div>

                {wizardStep < 4 ? (
                  <button
                    type="button"
                    onClick={() => handleGoToStep((wizardStep + 1) as WizardStep)}
                    disabled={liveTotalVerses <= 0}
                    className="wird-btn-primary min-h-11 px-5 py-2.5 disabled:opacity-50"
                  >
                    <span>{wizardStep === 3 ? 'معاينة الجدول المقترح' : 'التالي'}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                ) : (
                  previewPlan && (
                    <button
                      type="button"
                      onClick={() => handleSaveConfirmedPlan(previewPlan)}
                      disabled={isGeneratingPlan}
                      className="wird-btn-accent min-h-11 px-5 py-2.5"
                    >
                      <Check className="w-4 h-4" />
                      <span>{isGeneratingPlan ? 'جارٍ الحفظ...' : 'اعتماد وحفظ الخطة'}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Sticky Live Plan Summary Column (4 cols) */}
            <aside
              aria-label="ملخص الخطة المباشر"
              className="lg:col-span-4 lg:sticky lg:top-20 wird-card p-5 space-y-4"
            >
              <div className="pb-3 border-b border-[var(--wird-border)]">
                <span className="text-[11px] font-semibold text-[var(--wird-muted)]">
                  ملخص الخطة المباشر
                </span>
                <h4 className="font-bold text-sm text-[var(--wird-text)] mt-0.5 truncate">
                  {resolvedTitlePreview}
                </h4>
              </div>

              <dl className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--wird-muted)]">النطاق المستهدف</dt>
                  <dd className="font-bold text-[var(--wird-text)] text-left tabular-nums">
                    {startSurahMeta?.name} ({startAyah}) ← {endSurahMeta?.name} ({endAyah})
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--wird-muted)]">إجمالي آيات الهدف</dt>
                  <dd className="font-mono font-bold tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                    {liveTotalVerses} آية
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--wird-muted)]">المقدار اليومي التقريبي</dt>
                  <dd className="font-mono font-bold tabular-nums text-[var(--wird-text)]">
                    {liveDailyPaceVerses} آية / يوم
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--wird-muted)]">الأيام النشطة أسبوعياً</dt>
                  <dd className="font-mono font-bold tabular-nums text-[var(--wird-text)]">
                    {activeDays.length} من 7 أيام
                  </dd>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[var(--wird-muted)]">المحفوظ للمراجعة الكبرى</dt>
                  <dd className="font-mono font-bold tabular-nums text-[var(--wird-accent)]">
                    {existingMemorizedCount} آية
                  </dd>
                </div>
              </dl>

              {/* Feasibility Indicator */}
              <div
                className={`p-3.5 rounded-xl border ${
                  liveFeasibility.cognitiveLoadScore === 'impossible'
                    ? 'bg-rose-50 dark:bg-rose-950/45 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                    : liveFeasibility.cognitiveLoadScore === 'strenuous'
                    ? 'bg-[var(--wird-accent-soft)] border-[var(--wird-border-gold)] text-[var(--wird-text)]'
                    : 'bg-[var(--wird-primary-soft)] border-[var(--wird-border-strong)] text-[var(--wird-text)]'
                }`}
              >
                <div className="flex items-center gap-2 font-bold">
                  {liveFeasibility.cognitiveLoadScore === 'impossible' && (
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                  )}
                  {liveFeasibility.cognitiveLoadScore === 'strenuous' && (
                    <Info className="w-4 h-4 text-[var(--wird-accent)] shrink-0" />
                  )}
                  {(liveFeasibility.cognitiveLoadScore === 'optimal' ||
                    liveFeasibility.cognitiveLoadScore === 'light') && (
                    <CheckCircle className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)] shrink-0" />
                  )}
                  <span>التوازن الذهني: {feasibilityLabel}</span>
                </div>
                {liveFeasibility.warningMessage && (
                  <p className="text-[11px] leading-relaxed mt-1.5 opacity-90">
                    {liveFeasibility.warningMessage}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </form>
      )}

      {/* 3. Active Plan Dashboard & Schedule Execution */}
      {activePlan && !isCreatingNew && (
        <div className="space-y-6">
          <div className="wird-card p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-[var(--wird-text)]">
                    {activePlan.title}
                  </h3>
                  <span
                    className={`text-[11px] font-bold ${
                      activePlan.isPaused
                        ? 'text-[var(--wird-accent)]'
                        : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                    }`}
                  >
                    · {activePlan.isPaused ? 'متوقفة مؤقتاً' : 'نشطة وتعمل'}
                  </span>
                </div>
                <p className="text-xs text-[var(--wird-muted)] mt-1 tabular-nums">
                  تاريخ البدء: <span className="font-mono">{activePlan.input.startDate}</span> · الختم المتوقع:{' '}
                  <span className="font-mono font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                    {activePlan.meta.projectedEndDate}
                  </span>
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleTogglePause}
                  className={`flex min-h-11 items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                    activePlan.isPaused
                      ? 'wird-btn-primary'
                      : 'bg-[var(--wird-surface-muted)] text-[var(--wird-text)] hover:opacity-90'
                  }`}
                >
                  {activePlan.isPaused ? <Play className="w-3.5 h-3.5 fill-white" /> : <Pause className="w-3.5 h-3.5" />}
                  <span>{activePlan.isPaused ? 'استئناف الخطة' : 'إيقاف مؤقت'}</span>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    modalTriggerRef.current = event.currentTarget;
                    setShowRecalculateConfirm(true);
                  }}
                  className="flex min-h-11 items-center gap-1.5 px-3.5 py-2 bg-[var(--wird-surface-muted)] hover:border-[var(--wird-accent)] text-[var(--wird-text)] rounded-xl text-xs font-semibold border border-[var(--wird-border)] whitespace-nowrap transition-colors"
                  title="إعادة جدولة المهام القادمة بناءً على التقدم الفعلي"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                  <span>إعادة ضبط المتبقي</span>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    modalTriggerRef.current = event.currentTarget;
                    setPlanToDelete(activePlan.id);
                  }}
                  aria-label={`حذف الخطة الذكية ${activePlan.title}`}
                  className="flex min-h-11 min-w-11 items-center justify-center px-3 py-2 text-[var(--wird-muted)] hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl text-xs font-semibold transition-colors"
                  title="حذف هذه الخطة الذكية"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--wird-border)] text-xs space-y-1.5">
              <div className="font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] flex items-center gap-1.5">
                <Info className="w-4 h-4 shrink-0" />
                <span>الأساس المنهجي لتوزيع الخطة</span>
              </div>
              <p className="text-[var(--wird-muted)] leading-relaxed text-[11px]">
                {activePlan.rationale}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--wird-border)] text-xs">
              <div>
                <span className="text-[var(--wird-muted)]">إجمالي الآيات</span>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--wird-text)] mt-0.5">
                  {activePlan.meta.totalVerses} آية
                </div>
              </div>

              <div>
                <span className="text-[var(--wird-muted)]">المستهدف حتى اليوم</span>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--wird-text)] mt-0.5">
                  {activePlan.actualVsPlanned.plannedVersesToDate} آية
                </div>
              </div>

              <div>
                <span className="text-[var(--wird-muted)]">المحفوظ الفعلي</span>
                <div className="text-lg font-bold font-mono tabular-nums text-[var(--wird-primary)] dark:text-[var(--wird-accent)] mt-0.5">
                  {activePlan.actualVsPlanned.actualVersesMemorized} آية
                </div>
              </div>

              <div>
                <span className="text-[var(--wird-muted)]">حالة المسار</span>
                <div className="flex items-center gap-1.5 font-bold mt-1">
                  {activePlan.actualVsPlanned.status === 'on_track' && (
                    <Check className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                  )}
                  {activePlan.actualVsPlanned.status === 'ahead' && (
                    <TrendingUp className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                  )}
                  {activePlan.actualVsPlanned.status === 'behind' && (
                    <AlertTriangle className="w-4 h-4 text-[var(--wird-accent)]" />
                  )}
                  <span
                    className={
                      activePlan.actualVsPlanned.status === 'behind'
                        ? 'text-[var(--wird-accent)]'
                        : 'text-[var(--wird-primary)] dark:text-[var(--wird-accent)]'
                    }
                  >
                    {activePlan.actualVsPlanned.status === 'ahead'
                      ? 'متقدم على الخطة'
                      : activePlan.actualVsPlanned.status === 'behind'
                      ? 'متأخر قليلاً'
                      : 'منضبط مع الخطة'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {activePlanMissedSummary?.hasMissedDays && (
            <section
              aria-label="خيارات معالجة الأيام الفائتة"
              className="wird-card p-5 border border-[var(--wird-border-gold)] bg-[var(--wird-accent-soft)] dark:bg-[var(--wird-surface)] space-y-3 text-xs"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-[var(--wird-accent)] shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-[var(--wird-text)]">
                    رصد {activePlanMissedSummary.missedDaysCount}{' '}
                    {activePlanMissedSummary.missedDaysCount === 1 ? 'يوم فائت' : 'أيام فائتة'} في هذه الخطة
                  </h3>
                  <p className="text-[var(--wird-muted)] leading-relaxed tabular-nums">
                    مجموع الآيات غير المكتملة قبل اليوم: {activePlanMissedSummary.missedMemorizationVerses} آية
                    {activePlanMissedSummary.missedRevisionTasksCount > 0
                      ? ` · ${activePlanMissedSummary.missedRevisionTasksCount} مهام مراجعة`
                      : ''}.{' '}
                    {activePlanMissedSummary.firstMissedRangeLabelAr
                      ? `أول موضع متبقٍ: ${activePlanMissedSummary.firstMissedRangeLabelAr}.`
                      : ''}{' '}
                    لن يُغيّر التطبيق جدولك تلقائياً دون موافقتك؛ اختر آلية المعالجة المناسبة:
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingRecoveryMode('shift')}
                  className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                    pendingRecoveryMode === 'shift'
                      ? 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] text-white dark:text-[var(--wird-accent-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  ترحيل الورد للأمام
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRecoveryMode('light')}
                  className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                    pendingRecoveryMode === 'light'
                      ? 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] text-white dark:text-[var(--wird-accent-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  تثبيت ومراجعة خفيفة اليوم
                </button>
                <button
                  type="button"
                  onClick={() => setPendingRecoveryMode('rebalance')}
                  className={`min-h-11 px-3.5 py-2 rounded-xl font-bold border transition-colors whitespace-nowrap ${
                    pendingRecoveryMode === 'rebalance'
                      ? 'bg-[var(--wird-primary)] dark:bg-[var(--wird-accent)] text-white dark:text-[var(--wird-accent-ink)] border-[var(--wird-accent)]'
                      : 'bg-[var(--wird-surface)] text-[var(--wird-text)] border-[var(--wird-border-strong)] hover:border-[var(--wird-accent)]'
                  }`}
                >
                  إعادة توزيع المتبقي
                </button>
              </div>

              {pendingRecoveryMode && (
                <div className="p-3.5 rounded-xl bg-[var(--wird-surface)]/85 border border-[var(--wird-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-[var(--wird-text)] leading-relaxed">
                    {pendingRecoveryMode === 'shift' && 'تأكيد ترحيل جميع المهام غير المكتملة للأمام بدءاً من اليوم مع الإبقاء التام على الأوراد المكتملة.'}
                    {pendingRecoveryMode === 'light' && 'تأكيد تخصيص اليوم كمراجعة وتثبيت خفيف لما فات، واستئناف الحفظ الجديد من اليوم الدراسي التالي.'}
                    {pendingRecoveryMode === 'rebalance' && 'تأكيد إعادة توزيع المتبقي بالتساوي على الأيام النشطة المتاحة مع الاحتفاظ بكامل السجلات المكتملة.'}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isApplyingRecovery}
                      onClick={() => setPendingRecoveryMode(null)}
                      className="min-h-11 px-3.5 py-2 rounded-xl border border-[var(--wird-border)] text-[var(--wird-muted)] font-semibold"
                    >
                      تراجع
                    </button>
                    <button
                      type="button"
                      disabled={isApplyingRecovery}
                      onClick={handleConfirmMissedRecovery}
                      className="wird-btn-primary min-h-11 px-4 py-2 text-xs font-bold whitespace-nowrap"
                    >
                      {isApplyingRecovery ? 'جارٍ التحديث...' : 'تأكيد المعالجة'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* 4. Schedule View Modes & Task List */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="font-bold text-sm text-[var(--wird-text)] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[var(--wird-primary)] dark:text-[var(--wird-accent)]" />
                <span className="tabular-nums">
                  جدول المهام اليومية الموزعة ({activePlan.schedule.length} يوماً)
                </span>
              </h3>

              <div className="wird-segmented-track inline-flex items-center gap-1 p-1 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('weekly')}
                  aria-pressed={scheduleViewMode === 'weekly'}
                  className={`min-h-11 px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    scheduleViewMode === 'weekly'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : 'text-[var(--wird-muted)]'
                  }`}
                >
                  أول أسبوعين
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleViewMode('all')}
                  aria-pressed={scheduleViewMode === 'all'}
                  className={`min-h-11 px-3 py-1 rounded-lg transition-colors whitespace-nowrap ${
                    scheduleViewMode === 'all'
                      ? 'bg-[var(--wird-primary)] text-[var(--wird-primary-ink)]'
                      : 'text-[var(--wird-muted)]'
                  }`}
                >
                  الجدول كاملاً
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {activePlan.schedule
                .slice(0, scheduleViewMode === 'weekly' ? 14 : activePlan.schedule.length)
                .map((day: ScheduledDayPlan) => {
                  const isDone = day.memorizationTask?.completed;

                  if (day.isRestDay) {
                    return (
                      <div
                        key={day.id}
                        className="p-4 rounded-2xl border border-[var(--wird-border)] bg-[var(--wird-surface-muted)] dark:bg-[var(--wird-bg)]/85 flex items-center justify-between text-xs text-[var(--wird-muted)]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono tabular-nums">{day.date}</span>
                          <span className="font-bold text-[var(--wird-text)]">
                            ({day.dayNameAr})
                          </span>
                          <span>{day.notes || 'استراحة أسبوعية'}</span>
                        </div>
                        <span className="text-[11px] font-semibold">راحة الذاكرة</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={day.id}
                      className={`wird-card p-5 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                        isDone ? 'border-[var(--wird-border-strong)] dark:border-[var(--wird-border-gold)]' : ''
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 text-xs">
                          <span className="font-mono font-bold tabular-nums text-[var(--wird-muted)]">
                            {day.date}
                          </span>
                          <span className="font-bold text-[var(--wird-text)]">
                            ({day.dayNameAr})
                          </span>
                          <span className="text-[var(--wird-muted)]">·</span>
                          {isDone ? (() => {
                            const task = day.memorizationTask!;
                            const completedDate = task.completedDate || (typeof task.completedAt === 'string' ? task.completedAt.slice(0, 10) : day.date);
                            const timing = task.completionTiming || (completedDate < day.date ? 'completed_early' : completedDate === day.date ? 'completed_on_time' : 'completed_late');
                            const timingLabel = timing === 'completed_early'
                              ? 'تم الحفظ مبكراً'
                              : timing === 'completed_late'
                                ? 'تم الحفظ متأخراً'
                                : 'تم الحفظ في موعده';
                            return (
                              <span className="text-[11px] font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)] inline-flex items-center gap-1">
                                <Check className="w-3.5 h-3.5" /> {timingLabel}
                              </span>
                            );
                          })() : (
                            <span className="text-[11px] text-[var(--wird-muted)]">
                              قيد الإنجاز
                            </span>
                          )}
                        </div>

                        {day.memorizationTask && (
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-bold text-base font-quran text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                              سورة {day.memorizationTask.surahName} · الآيات ({day.memorizationTask.startAyah} - {day.memorizationTask.endAyah})
                            </span>
                            <span className="text-xs text-[var(--wird-muted)] font-mono tabular-nums">
                              ({day.memorizationTask.versesCount} آيات · ~{day.memorizationTask.estimatedMinutes}د)
                            </span>
                          </div>
                        )}

                        {day.minorRevisionTask && (
                          <div className="text-[11px] text-[var(--wird-muted)]">
                            المراجعة الصغرى: {day.minorRevisionTask.description}
                          </div>
                        )}

                        {day.majorRevisionTask && (
                          <div className="text-[11px] text-[var(--wird-accent)]">
                            المراجعة الكبرى: {day.majorRevisionTask.description}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {day.memorizationTask && !isDone && (
                          <button
                            type="button"
                            onClick={() =>
                              onStartSession(
                                day.memorizationTask!.surahNumber,
                                day.memorizationTask!.startAyah,
                                day.memorizationTask!.endAyah
                              )
                            }
                            className="wird-btn-primary min-h-11 flex items-center gap-1.5 px-4 py-2 text-xs whitespace-nowrap"
                          >
                            <Play className="w-3.5 h-3.5 fill-white" />
                            <span>تدريب</span>
                          </button>
                        )}

                        {day.memorizationTask && isDone && (
                          <span className="text-xs font-bold text-[var(--wird-primary)] dark:text-[var(--wird-accent)]">
                            ✓ مكتملة في الجدول
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>
      )}

      {/* In-app Recalculate Confirmation Modal */}
      {showRecalculateConfirm && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={recalculateDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wird-engine-recalculate-title"
            className="bg-[var(--wird-surface)] rounded-3xl p-6 max-w-md w-full border border-[var(--wird-border-gold)] shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[var(--wird-accent-soft)] text-[var(--wird-accent)] flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 id="wird-engine-recalculate-title" className="font-bold text-[var(--wird-text)] text-base">
                  إعادة جدولة المهام القادمة
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  إعادة موازنة الجدول بدءاً من اليوم
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--wird-text)] leading-relaxed bg-[var(--wird-surface)]/70 p-3.5 rounded-xl border border-[var(--wird-border)]">
              ستُعاد جدولة المهام المتبقية بناءً على تاريخ اليوم ومعدل تقدمك، مع <strong>الحفاظ الكامل على جميع الأوراد المكتملة وسجل إنجازك دون أي مساس</strong>.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                ref={cancelRecalculateRef}
                onClick={() => setShowRecalculateConfirm(false)}
                className="min-h-11 px-4 py-2 text-xs font-semibold text-[var(--wird-muted)] hover:bg-[var(--wird-surface-hover)] rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmRecalculate}
                className="wird-btn-primary min-h-11 px-5 py-2 text-xs"
              >
                تأكيد إعادة الجدولة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* In-app Plan Delete Confirmation Modal */}
      {planToDelete && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            ref={deleteDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wird-engine-delete-title"
            className="bg-[var(--wird-surface)] rounded-3xl p-6 max-w-md w-full border border-[var(--wird-border-gold)] shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="wird-engine-delete-title" className="font-bold text-[var(--wird-text)] text-base">
                  حذف الخطة الذكية
                </h3>
                <p className="text-xs text-[var(--wird-muted)]">
                  تأكيد إزالة الخطة من قائمة الأهداف
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--wird-text)] leading-relaxed bg-[var(--wird-surface)]/70 p-3.5 rounded-xl border border-[var(--wird-border)]">
              هل أنت متأكد من حذف هذه الخطة؟ <strong>لن يؤثر الحذف إطلاقاً على الآيات والمقاطع التي أتممت حفظها في المصحف وسجل التكرار والمراجعة</strong>؛ سيتم فقط حذف جدول الخطة المستقبلي.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                ref={cancelDeleteRef}
                onClick={() => setPlanToDelete(null)}
                className="min-h-11 px-4 py-2 text-xs font-semibold text-[var(--wird-muted)] hover:bg-[var(--wird-surface-hover)] rounded-xl transition-colors"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeletePlan}
                className="min-h-11 px-5 py-2 text-xs font-bold text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-xs transition-colors"
              >
                تأكيد حذف الخطة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
