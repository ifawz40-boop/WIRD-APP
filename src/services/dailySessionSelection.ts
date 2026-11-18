import { ALL_SURAHS } from '../data/quranMeta';
import type { MemorizationPlan, WeakVerseItem, WirdPortion } from '../types/quran';
import type { EngineGeneratedPlan, ScheduledDayPlan, ScheduledTaskUnit } from './planningEngine';
import { findNextUnmemorizedRange, getPrioritizedRevisionQueue } from './unifiedPortionService';

export interface DailyMemorizationRange {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

export interface UnifiedEngineDueTaskItem {
  planId: string;
  planTitle: string;
  taskId: string;
  scheduledDate: string;
  isOverdue: boolean;
  task: ScheduledTaskUnit;
}

export interface UnifiedPlanCompletedTodayItem {
  planId: string;
  planTitle: string;
  scheduledDate: string;
  completionTiming: 'completed_early' | 'completed_on_time' | 'completed_late';
  task: ScheduledTaskUnit;
}

export interface UnifiedPresetTaskItem {
  planId: string;
  planTitle: string;
  supported: boolean;
  range: DailyMemorizationRange | null;
  blockedMessageAr?: string;
}

export interface UnifiedDailyHubSummary {
  dueEngineItems: UnifiedEngineDueTaskItem[];
  completedTodayItems: UnifiedPlanCompletedTodayItem[];
  presetItems: UnifiedPresetTaskItem[];
  dueRevisions: WirdPortion[];
  urgentWeakVerses: WeakVerseItem[];
  primarySelection: DailySessionSelection;
  totalActionableCount: number;
}

export type DailySessionSelection =
  | {
      kind: 'session';
      mode: 'memorize' | 'review';
      source: 'engine_plan' | 'preset_plan' | 'revision' | 'default';
      surahNumber: number;
      startAyah: number;
      endAyah: number;
      label: string;
      planId?: string;
      enginePlanId?: string;
      enginePlanDate?: string;
    }
  | {
      kind: 'blocked';
      mode: 'memorize';
      source: 'blocked';
      messageAr: string;
    };

/**
 * Return only an engine-plan task due today or overdue.
 * Future tasks must never be started early by the dashboard quick-start.
 */
/**
 * Collect every incomplete memorization task due today or overdue across all
 * active, non-paused engine plans. Completed day state is authoritative.
 */
export interface DueEngineTask {
  planId: string;
  planTitle: string;
  date: string;
  taskId: string;
  task: ScheduledTaskUnit;
}

export function getDueEngineTasks(plans: EngineGeneratedPlan[], todayStr: string): DueEngineTask[] {
  return plans.flatMap(plan => {
    if (!plan.isActive || plan.isPaused || !Array.isArray(plan.schedule)) return [];
    return plan.schedule.flatMap(day => {
      const task = day.memorizationTask;
      if (typeof day.date !== 'string' || day.date > todayStr || day.status === 'completed' || !task || task.completed) return [];
      return [{ planId: plan.id, planTitle: plan.input?.title || plan.title || 'خطة الحفظ', date: day.date, taskId: day.id, task }];
    });
  }).sort((a, b) =>
    a.date.localeCompare(b.date) ||
    a.planTitle.localeCompare(b.planTitle, 'ar') ||
    a.planId.localeCompare(b.planId) ||
    a.taskId.localeCompare(b.taskId)
  );
}

export interface DueEnginePlanTaskMatch {
  plan: EngineGeneratedPlan;
  day: ScheduledDayPlan;
  task: ScheduledTaskUnit;
}

/** Resolve completion to the exact plan and scheduled date that launched it. */
export function findMatchingDueEnginePlanTask(
  plans: EngineGeneratedPlan[],
  todayStr: string,
  target: { surahNumber: number; startAyah: number; endAyah: number; enginePlanId?: string | null; enginePlanDate?: string | null }
): DueEnginePlanTaskMatch | null {
  const matches = plans.flatMap(plan => {
    if (!plan.isActive || plan.isPaused || !Array.isArray(plan.schedule)) return [];
    if (target.enginePlanId && plan.id !== target.enginePlanId) return [];
    return plan.schedule.flatMap(day => {
      const task = day.memorizationTask;
      const hasExactScheduleIdentity = Boolean(target.enginePlanId && target.enginePlanDate);
      if (
        typeof day.date !== 'string' || (!hasExactScheduleIdentity && day.date > todayStr) ||
        (target.enginePlanDate && day.date !== target.enginePlanDate) ||
        day.status === 'completed' || !task || task.completed ||
        task.surahNumber !== target.surahNumber ||
        task.startAyah !== target.startAyah ||
        task.endAyah !== target.endAyah
      ) return [];
      return [{ plan, day, task }];
    });
  }).sort((a, b) =>
    a.day.date.localeCompare(b.day.date) ||
    (a.plan.input?.title || a.plan.title || '').localeCompare(b.plan.input?.title || b.plan.title || '', 'ar') ||
    a.plan.id.localeCompare(b.plan.id)
  );

  // Exact plan/date launches from a plan detail may complete future tasks early.
  // Dashboard/legacy launches remain limited to due work. Never guess which
  // plan owns a duplicate ayah range; ambiguous sessions fail closed instead.
  return matches.length === 1 ? matches[0] : null;
}

/** Return the earliest due task for one plan; future work is never eligible. */
export function getNextDueEngineTask(
  plan: EngineGeneratedPlan | null | undefined,
  todayStr: string
): ScheduledTaskUnit | null {
  if (!plan || !plan.isActive || plan.isPaused) return null;
  return getDueEngineTasks([plan], todayStr)[0]?.task || null;
}

export function getAllActiveEngineTasks(
  enginePlans: EngineGeneratedPlan[],
  todayStr: string
): {
  dueItems: UnifiedEngineDueTaskItem[];
  completedTodayItems: UnifiedPlanCompletedTodayItem[];
} {
  const dueItems: UnifiedEngineDueTaskItem[] = getDueEngineTasks(enginePlans, todayStr).map(item => ({
    planId: item.planId,
    planTitle: item.planTitle,
    taskId: item.taskId,
    scheduledDate: item.date,
    isOverdue: item.date < todayStr,
    task: item.task
  }));
  const completedTodayItems: UnifiedPlanCompletedTodayItem[] = [];

  for (const plan of enginePlans) {
    if (!plan.isActive || plan.isPaused || !Array.isArray(plan.schedule)) continue;
    const planTitle = plan.input?.title || plan.title || 'خطة حفظ ذكية';
    for (const day of plan.schedule) {
      const task = day.memorizationTask;
      if (!task?.completed) continue;
      const completedDate = task.completedDate ||
        (typeof task.completedAt === 'string' ? task.completedAt.slice(0, 10) : day.date);
      if (completedDate !== todayStr) continue;
      const completionTiming = task.completionTiming ||
        (completedDate < day.date ? 'completed_early' : completedDate === day.date ? 'completed_on_time' : 'completed_late');
      completedTodayItems.push({ planId: plan.id, planTitle, scheduledDate: day.date, completionTiming, task });
    }
  }

  dueItems.sort((a, b) =>
    a.scheduledDate.localeCompare(b.scheduledDate) ||
    a.planTitle.localeCompare(b.planTitle, 'ar') ||
    a.planId.localeCompare(b.planId)
  );
  return { dueItems, completedTodayItems };
}

/**
 * Automatic quick-start is safe only for explicit whole-Surah scopes.
 * Juz/page plans need an exact coordinate resolver; never widen them to
 * entire Surahs as a fallback.
 */
export function isPresetAutoStartSupported(plan: MemorizationPlan | null | undefined): boolean {
  if (!plan || plan.unitType !== 'ayah') return false;
  if (plan.type === 'whole_quran') return true;
  return (plan.type === 'surahs' || plan.type === 'custom') &&
    Array.isArray(plan.targetSurahs) &&
    plan.targetSurahs.some(number => Number.isInteger(number) && number >= 1 && number <= 114);
}

export function getNextPresetMemorizationRange(
  plan: MemorizationPlan,
  portions: WirdPortion[],
  maxVerses: number = plan.dailyTarget || 7
): DailyMemorizationRange | null {
  if (!isPresetAutoStartSupported(plan)) return null;

  const targetSurahs = plan.type === 'whole_quran'
    ? ALL_SURAHS.map(surah => surah.number)
    : Array.from(new Set(plan.targetSurahs || [])).filter(number =>
        Number.isInteger(number) && number >= 1 && number <= 114
      );

  if (targetSurahs.length === 0) return null;
  return findNextUnmemorizedRange(portions, targetSurahs, maxVerses);
}

export function getDailySessionSelection(
  plans: MemorizationPlan[],
  enginePlans: EngineGeneratedPlan[],
  portions: WirdPortion[],
  todayStr: string
): DailySessionSelection {
  const activeEnginePlans = enginePlans.filter(plan => plan.isActive && !plan.isPaused);
  const nextDueEngineTask = getDueEngineTasks(activeEnginePlans, todayStr)[0];
  if (nextDueEngineTask) {
    return {
      kind: 'session',
      mode: 'memorize',
      source: 'engine_plan',
      surahNumber: nextDueEngineTask.task.surahNumber,
      startAyah: nextDueEngineTask.task.startAyah,
      endAyah: nextDueEngineTask.task.endAyah,
      label: `خطة: ${nextDueEngineTask.planTitle}`,
      planId: nextDueEngineTask.planId,
      enginePlanId: nextDueEngineTask.planId,
      enginePlanDate: nextDueEngineTask.date
    };
  }

  const duePortion = getPrioritizedRevisionQueue(portions, { todayStr, maxDailyLimit: 20 }).queue[0];
  if (duePortion) {
    return {
      kind: 'session',
      mode: 'review',
      source: 'revision',
      surahNumber: duePortion.surahNumber,
      startAyah: duePortion.startAyah,
      endAyah: duePortion.endAyah,
      label: 'مراجعة مستحقة ذات أولوية'
    };
  }

  const activePreset = activeEnginePlans.length > 0 ? undefined : plans.find(plan => plan.isActive);
  if (activePreset) {
    if (!isPresetAutoStartSupported(activePreset)) {
      return {
        kind: 'blocked',
        mode: 'memorize',
        source: 'blocked',
        messageAr: 'هذه الخطة تعتمد على الصفحات أو الأجزاء؛ افتح تفاصيلها لاختيار نطاق آيات دقيق قبل بدء الجلسة.'
      };
    }

    const range = getNextPresetMemorizationRange(activePreset, portions, activePreset.dailyTarget || 7);
    if (range) {
      return {
        kind: 'session',
        mode: 'memorize',
        source: 'preset_plan',
        ...range,
        label: `الخطة النشطة: ${activePreset.title}`,
        planId: activePreset.id
      };
    }

    return {
      kind: 'blocked',
      mode: 'memorize',
      source: 'blocked',
      messageAr: 'اكتمل نطاق الحفظ المحدد في خطتك الحالية؛ راجع إنجازك أو عدّل الخطة.'
    };
  }

  if (activeEnginePlans.length > 0) {
    return {
      kind: 'blocked',
      mode: 'memorize',
      source: 'blocked',
      messageAr: 'لا توجد مهمة حفظ مستحقة اليوم في خططك الحالية؛ ستظهر المهمة تلقائياً عند حلول موعدها.'
    };
  }

  const nextRange = findNextUnmemorizedRange(
    portions,
    ALL_SURAHS.map(surah => surah.number),
    7
  );
  if (nextRange) {
    return {
      kind: 'session',
      mode: 'memorize',
      source: 'default',
      ...nextRange,
      label: 'المقطع التالي غير المسجل في محفوظك'
    };
  }

  const firstMemorized = portions.find(portion => portion.status !== 'not_memorized');
  if (firstMemorized) {
    return {
      kind: 'session',
      mode: 'review',
      source: 'revision',
      surahNumber: firstMemorized.surahNumber,
      startAyah: firstMemorized.startAyah,
      endAyah: firstMemorized.endAyah,
      label: 'مراجعة محفوظك وتثبيته'
    };
  }

  return {
    kind: 'session',
    mode: 'memorize',
    source: 'default',
    surahNumber: 1,
    startAyah: 1,
    endAyah: 7,
    label: 'البداية المباركة (فاتحة الكتاب)'
  };
}

export function getUnifiedDailyHubSummary(
  plans: MemorizationPlan[],
  enginePlans: EngineGeneratedPlan[],
  portions: WirdPortion[],
  weakVerses: WeakVerseItem[],
  todayStr: string
): UnifiedDailyHubSummary {
  const { dueItems, completedTodayItems } = getAllActiveEngineTasks(enginePlans, todayStr);
  const dueRevisions = getPrioritizedRevisionQueue(portions, { todayStr, maxDailyLimit: 20 }).queue;

  const activePresets = plans.filter(p => p.isActive);
  const presetItems: UnifiedPresetTaskItem[] = activePresets.map(plan => {
    if (!isPresetAutoStartSupported(plan)) {
      return {
        planId: plan.id,
        planTitle: plan.title,
        supported: false,
        range: null,
        blockedMessageAr: 'خطة بالصفحات أو الأجزاء — اختر نطاقها من تفاصيل الخطة.'
      };
    }
    const range = getNextPresetMemorizationRange(plan, portions, plan.dailyTarget || 7);
    return {
      planId: plan.id,
      planTitle: plan.title,
      supported: true,
      range,
      blockedMessageAr: range ? undefined : 'تم إتمام نطاق هذه الخطة بالكامل.'
    };
  });

  const urgentWeakVerses = [...weakVerses]
    .sort((a, b) => b.mistakeCount - a.mistakeCount)
    .slice(0, 6);

  const primarySelection = getDailySessionSelection(plans, enginePlans, portions, todayStr);
  const actionablePresets = presetItems.filter(p => p.supported && p.range !== null).length;
  const totalActionableCount =
    dueItems.length +
    dueRevisions.length +
    (urgentWeakVerses.length > 0 ? 1 : 0) +
    (dueItems.length === 0 ? actionablePresets : 0);

  return {
    dueEngineItems: dueItems,
    completedTodayItems,
    presetItems,
    dueRevisions,
    urgentWeakVerses,
    primarySelection,
    totalActionableCount
  };
}

