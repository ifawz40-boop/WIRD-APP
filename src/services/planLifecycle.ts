import {
  EngineGeneratedPlan,
  ScheduledDayPlan,
  PlanningEngine
} from './planningEngine';
import { QuranMath } from './quranMath';

const DAY_NAMES_AR = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

type PendingTaskBundle = Pick<
  ScheduledDayPlan,
  'memorizationTask' | 'minorRevisionTask' | 'majorRevisionTask' | 'notes'
>;

function splitDayTasks(day: ScheduledDayPlan): {
  historical?: ScheduledDayPlan;
  pending?: PendingTaskBundle;
} {
  const dayMarkedComplete = day.status === 'completed';
  const completedMemorization = day.memorizationTask &&
    (day.memorizationTask.completed || dayMarkedComplete)
    ? { ...day.memorizationTask, completed: true }
    : undefined;
  const completedMinorRevision = day.minorRevisionTask &&
    (day.minorRevisionTask.completed || dayMarkedComplete)
    ? { ...day.minorRevisionTask, completed: true }
    : undefined;
  const completedMajorRevision = day.majorRevisionTask &&
    (day.majorRevisionTask.completed || dayMarkedComplete)
    ? { ...day.majorRevisionTask, completed: true }
    : undefined;

  const pendingMemorization = day.memorizationTask && !completedMemorization
    ? day.memorizationTask
    : undefined;
  const pendingMinorRevision = day.minorRevisionTask && !completedMinorRevision
    ? day.minorRevisionTask
    : undefined;
  const pendingMajorRevision = day.majorRevisionTask && !completedMajorRevision
    ? day.majorRevisionTask
    : undefined;

  const hasCompletedTask = Boolean(
    completedMemorization || completedMinorRevision || completedMajorRevision
  );
  const hasPendingTask = Boolean(
    pendingMemorization || pendingMinorRevision || pendingMajorRevision
  );

  const historical = hasCompletedTask || dayMarkedComplete
    ? {
        ...day,
        memorizationTask: completedMemorization,
        minorRevisionTask: completedMinorRevision,
        majorRevisionTask: completedMajorRevision,
        isRestDay: false,
        status: hasPendingTask ? 'partially_completed' as const : 'completed' as const
      }
    : undefined;

  const pending = hasPendingTask
    ? {
        memorizationTask: pendingMemorization,
        minorRevisionTask: pendingMinorRevision,
        majorRevisionTask: pendingMajorRevision,
        notes: day.notes
      }
    : undefined;

  return { historical, pending };
}

function hasSchedulableDay(input: EngineGeneratedPlan['input']): boolean {
  const activeDays = Array.isArray(input.activeDays) ? input.activeDays : [];
  const restDays = Array.isArray(input.restDays) ? input.restDays : [];
  return activeDays.some(day =>
    Number.isSafeInteger(day) && day >= 0 && day <= 6 && !restDays.includes(day)
  );
}

function schedulePendingBundles(
  bundles: PendingTaskBundle[],
  startDate: Date,
  input: EngineGeneratedPlan['input'],
  idPrefix: string
): ScheduledDayPlan[] {
  if (!hasSchedulableDay(input)) {
    throw new Error('لا توجد أيام دراسة نشطة لإعادة جدولة المهام المعلقة؛ تم الحفاظ على الخطة دون تغيير.');
  }
  const schedule: ScheduledDayPlan[] = [];
  const currentDate = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  let pendingIndex = 0;

  while (pendingIndex < bundles.length) {
    const dateStr = PlanningEngine.formatDate(currentDate);
    const dayOfWeek = currentDate.getDay();
    const isRest = input.restDays.includes(dayOfWeek) || !input.activeDays.includes(dayOfWeek);

    if (isRest) {
      schedule.push({
        id: idPrefix + '-rest-' + dateStr,
        date: dateStr,
        dayOfWeek,
        dayNameAr: DAY_NAMES_AR[dayOfWeek],
        isRestDay: true,
        status: 'pending',
        notes: 'استراحة أسبوعية'
      });
    } else {
      const bundle = bundles[pendingIndex];
      schedule.push({
        id: idPrefix + '-' + dateStr + '-' + (pendingIndex + 1),
        date: dateStr,
        dayOfWeek,
        dayNameAr: DAY_NAMES_AR[dayOfWeek],
        isRestDay: false,
        memorizationTask: bundle.memorizationTask,
        minorRevisionTask: bundle.minorRevisionTask,
        majorRevisionTask: bundle.majorRevisionTask,
        status: 'pending',
        notes: bundle.notes
      });
      pendingIndex++;
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schedule;
}

function getLastScheduledWorkDate(schedule: ScheduledDayPlan[], fallback: string): string {
  const workDays = schedule.filter(day =>
    !day.isRestDay && Boolean(day.memorizationTask || day.minorRevisionTask || day.majorRevisionTask)
  );
  return workDays.length ? workDays[workDays.length - 1].date : fallback;
}

function addDaysToDateStr(dateStr: string, days: number): string {
  const date = PlanningEngine.parseDate(dateStr);
  date.setDate(date.getDate() + days);
  return PlanningEngine.formatDate(date);
}

export interface MissedDaySummary {
  hasMissedDays: boolean;
  missedDaysCount: number;
  missedMemorizationVerses: number;
  missedRevisionTasksCount: number;
  missedDates: string[];
  firstMissedRangeLabelAr?: string;
}

export interface MissedDayRecoveryResult {
  changed: boolean;
  plan: EngineGeneratedPlan;
  summary: MissedDaySummary;
  actionLabelAr: string;
}

export const PlanLifecycle = {
  /**
   * Detect uncompleted non-rest study days strictly earlier than `todayStr`.
   * Paused plans are never flagged as having active missed days.
   */
  detectMissedDays(
    plan: EngineGeneratedPlan,
    todayStr?: string
  ): MissedDaySummary {
    if (!plan || plan.isPaused || !Array.isArray(plan.schedule)) {
      return {
        hasMissedDays: false,
        missedDaysCount: 0,
        missedMemorizationVerses: 0,
        missedRevisionTasksCount: 0,
        missedDates: []
      };
    }

    const today = todayStr || PlanningEngine.formatDate(new Date());
    const missedDates: string[] = [];
    let missedMemorizationVerses = 0;
    let missedRevisionTasksCount = 0;
    let firstLabel: string | undefined;

    for (const day of plan.schedule) {
      if (day.date >= today || day.isRestDay || day.status === 'completed') continue;
      const pendingMem = day.memorizationTask && !day.memorizationTask.completed ? day.memorizationTask : undefined;
      const pendingMinor = day.minorRevisionTask && !day.minorRevisionTask.completed ? day.minorRevisionTask : undefined;
      const pendingMajor = day.majorRevisionTask && !day.majorRevisionTask.completed ? day.majorRevisionTask : undefined;
      if (!pendingMem && !pendingMinor && !pendingMajor) continue;

      missedDates.push(day.date);
      if (pendingMem) {
        missedMemorizationVerses += pendingMem.versesCount;
        if (!firstLabel) {
          firstLabel = `سورة ${pendingMem.surahName} (${pendingMem.startAyah}-${pendingMem.endAyah})`;
        }
      }
      if (pendingMinor) missedRevisionTasksCount += 1;
      if (pendingMajor) missedRevisionTasksCount += 1;
    }

    return {
      hasMissedDays: missedDates.length > 0,
      missedDaysCount: missedDates.length,
      missedMemorizationVerses,
      missedRevisionTasksCount,
      missedDates,
      firstMissedRangeLabelAr: firstLabel
    };
  },

  /**
   * Recovery Action 1: Shift all uncompleted tasks forward starting from `todayStr`
   * while preserving 100% of completed historical tasks untouched.
   */
  shiftMissedForward(
    plan: EngineGeneratedPlan,
    todayStr?: string
  ): MissedDayRecoveryResult {
    const today = todayStr || PlanningEngine.formatDate(new Date());
    const summary = this.detectMissedDays(plan, today);
    if (!summary.hasMissedDays || !hasSchedulableDay(plan.input)) {
      return {
        changed: false,
        plan,
        summary,
        actionLabelAr: 'لا توجد أيام فائتة تحتاج للترحيل.'
      };
    }

    const historical: ScheduledDayPlan[] = [];
    const pendingBundles: PendingTaskBundle[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date < today) historical.push(day);
        continue;
      }
      const split = splitDayTasks(day);
      if (split.historical) historical.push(split.historical);
      if (split.pending) pendingBundles.push(split.pending);
    }

    if (pendingBundles.length === 0) {
      return {
        changed: false,
        plan,
        summary,
        actionLabelAr: 'جميع المهام السابقة مكتملة.'
      };
    }

    const rescheduled = schedulePendingBundles(
      pendingBundles,
      PlanningEngine.parseDate(today),
      plan.input,
      'shift'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan = this.refreshActualVsPlanned({
      ...plan,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    });

    return {
      changed: true,
      plan: updatedPlan,
      summary,
      actionLabelAr: 'تم ترحيل الأوراد الفائتة بدءاً من اليوم دون المساس بسجلك المكتمل.'
    };
  },

  /**
   * Recovery Action 2: Dedicate `todayStr` as a light consolidation/revision day
   * covering the missed material without new memorization load today, then resume
   * pending memorization from the next active study day after `todayStr`.
   */
  scheduleLightRecoveryDay(
    plan: EngineGeneratedPlan,
    todayStr?: string
  ): MissedDayRecoveryResult {
    const today = todayStr || PlanningEngine.formatDate(new Date());
    const summary = this.detectMissedDays(plan, today);
    if (!summary.hasMissedDays || !hasSchedulableDay(plan.input)) {
      return {
        changed: false,
        plan,
        summary,
        actionLabelAr: 'لا توجد أيام فائتة تحتاج ليوم تثبيت خفيف.'
      };
    }

    const historical: ScheduledDayPlan[] = [];
    const pendingBundles: PendingTaskBundle[] = [];
    const missedLabels: string[] = [];
    let firstMissedMem: ScheduledDayPlan['memorizationTask'] | undefined;

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date < today) historical.push(day);
        continue;
      }
      const split = splitDayTasks(day);
      if (split.historical) historical.push(split.historical);
      if (split.pending) {
        if (day.date < today && split.pending.memorizationTask) {
          if (!firstMissedMem) firstMissedMem = split.pending.memorizationTask;
          missedLabels.push(
            `${split.pending.memorizationTask.surahName} (${split.pending.memorizationTask.startAyah}-${split.pending.memorizationTask.endAyah})`
          );
        }
        pendingBundles.push(split.pending);
      }
    }

    if (pendingBundles.length === 0) {
      return {
        changed: false,
        plan,
        summary,
        actionLabelAr: 'جميع المهام السابقة مكتملة.'
      };
    }

    const todayDate = PlanningEngine.parseDate(today);
    const todayDow = todayDate.getDay();
    const recoveryDescription = missedLabels.length > 0
      ? `تثبيت ومراجعة خفيفة لما فات (${missedLabels.slice(0, 3).join('، ')}${missedLabels.length > 3 ? '…' : ''})`
      : 'يوم مراجعة وتثبيت خفيف لتدارك الأيام الفائتة';

    const recoveryDay: ScheduledDayPlan = {
      id: `light-recovery-${today}`,
      date: today,
      dayOfWeek: todayDow,
      dayNameAr: DAY_NAMES_AR[todayDow],
      isRestDay: false,
      minorRevisionTask: {
        description: recoveryDescription,
        surahNumber: firstMissedMem?.surahNumber,
        startAyah: firstMissedMem?.startAyah,
        endAyah: firstMissedMem?.endAyah,
        versesCount: firstMissedMem
          ? Math.max(1, firstMissedMem.endAyah - firstMissedMem.startAyah + 1)
          : Math.max(1, summary.missedMemorizationVerses),
        type: 'minor',
        estimatedMinutes: Math.max(10, Math.min(30, Math.max(1, summary.missedMemorizationVerses) * 2)),
        completed: false
      },
      status: 'pending',
      notes: 'يوم تثبيت خفيف بدون ضغط حفظ جديد؛ يُستأنف الحفظ الجديد من اليوم الدراسي التالي'
    };

    const tomorrowStr = addDaysToDateStr(today, 1);
    const rescheduledFuture = schedulePendingBundles(
      pendingBundles,
      PlanningEngine.parseDate(tomorrowStr),
      plan.input,
      'light-rec'
    );

    const newSchedule = [...historical, recoveryDay, ...rescheduledFuture].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan = this.refreshActualVsPlanned({
      ...plan,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    });

    return {
      changed: true,
      plan: updatedPlan,
      summary,
      actionLabelAr: 'تم تخصيص اليوم كمراجعة وتثبيت خفيف واستئناف الحفظ بدءاً من الغد.'
    };
  },

  /**
   * Recovery Action 3: Rebalance all remaining unmemorized verses evenly starting
   * from `todayStr` toward targetEndDate (or projectedEndDate if later), preserving
   * all completed history and pending revisions.
   */
  rebalanceRemainingPlan(
    plan: EngineGeneratedPlan,
    todayStr?: string
  ): MissedDayRecoveryResult {
    const today = todayStr || PlanningEngine.formatDate(new Date());
    const summary = this.detectMissedDays(plan, today);
    if (!hasSchedulableDay(plan.input)) {
      return {
        changed: false,
        plan,
        summary,
        actionLabelAr: 'لا توجد أيام دراسة نشطة لإعادة توزيع الخطة.'
      };
    }

    const historical: ScheduledDayPlan[] = [];
    const pendingRevisionBundles: PendingTaskBundle[] = [];
    const completedMemorizationTasks: ScheduledDayPlan[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date < today) historical.push(day);
        continue;
      }

      const split = splitDayTasks(day);
      if (split.historical) {
        historical.push(split.historical);
        if (split.historical.memorizationTask?.completed) {
          completedMemorizationTasks.push(split.historical);
        }
      }
      if (split.pending && (split.pending.minorRevisionTask || split.pending.majorRevisionTask)) {
        pendingRevisionBundles.push({
          minorRevisionTask: split.pending.minorRevisionTask,
          majorRevisionTask: split.pending.majorRevisionTask,
          notes: split.pending.notes
        });
      }
    }

    const planStartIndex = QuranMath.getAbsoluteAyahIndex(
      plan.meta.startCoordinate.surahNumber,
      plan.meta.startCoordinate.ayahNumber
    );
    const planEndIndex = QuranMath.getAbsoluteAyahIndex(
      plan.meta.endCoordinate.surahNumber,
      plan.meta.endCoordinate.ayahNumber
    );
    const completedIndexes = new Set<number>();

    for (const day of completedMemorizationTasks) {
      const task = day.memorizationTask;
      if (!task) continue;
      const taskStart = QuranMath.getAbsoluteAyahIndex(task.surahNumber, task.startAyah);
      const taskEnd = QuranMath.getAbsoluteAyahIndex(task.surahNumber, task.endAyah);
      const boundedStart = Math.max(planStartIndex, taskStart);
      const boundedEnd = Math.min(planEndIndex, taskEnd);
      if (boundedEnd < boundedStart) continue;
      for (let index = boundedStart; index <= boundedEnd; index++) {
        completedIndexes.add(index);
      }
    }

    const remainingRanges: Array<{ startIndex: number; endIndex: number }> = [];
    let rangeStart: number | null = null;
    for (let index = planStartIndex; index <= planEndIndex; index++) {
      if (!completedIndexes.has(index)) {
        if (rangeStart === null) rangeStart = index;
      } else if (rangeStart !== null) {
        remainingRanges.push({ startIndex: rangeStart, endIndex: index - 1 });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) {
      remainingRanges.push({ startIndex: rangeStart, endIndex: planEndIndex });
    }

    const remainingVerses = remainingRanges.reduce(
      (total, range) => total + range.endIndex - range.startIndex + 1,
      0
    );

    if (remainingVerses === 0 && pendingRevisionBundles.length === 0) {
      return {
        changed: false,
        plan: this.refreshActualVsPlanned(plan),
        summary,
        actionLabelAr: 'الخطة مكتملة بالفعل.'
      };
    }

    let pace = Math.max(1, plan.input.paceQuantity || 5);
    const targetCandidate = plan.input.targetEndDate || plan.meta.projectedEndDate;
    if (targetCandidate && targetCandidate > today && remainingVerses > 0) {
      const activeDays = PlanningEngine.countActiveDaysBetween(
        today,
        targetCandidate,
        plan.input.activeDays,
        plan.input.restDays
      );
      if (activeDays > 0) {
        pace = Math.max(1, Math.ceil(remainingVerses / activeDays));
      }
    }

    const chunks = remainingRanges.flatMap(range =>
      QuranMath.sliceRangeIntoChunks(
        QuranMath.getCoordinateFromAbsoluteIndex(range.startIndex),
        QuranMath.getCoordinateFromAbsoluteIndex(range.endIndex),
        pace
      )
    );

    const workBundles: PendingTaskBundle[] = [];
    const workCount = Math.max(chunks.length, pendingRevisionBundles.length);
    for (let index = 0; index < workCount; index++) {
      const chunk = chunks[index];
      const revisionBundle = pendingRevisionBundles[index];
      let memorizationTask: ScheduledDayPlan['memorizationTask'];
      if (chunk) {
        const surah = QuranMath.getSurah(chunk.start.surahNumber);
        memorizationTask = {
          surahNumber: chunk.start.surahNumber,
          surahName: surah?.name || '',
          startAyah: chunk.start.ayahNumber,
          endAyah: chunk.end.ayahNumber,
          versesCount: chunk.totalVerses,
          estimatedMinutes: QuranMath.estimateMemorizationMinutes(
            chunk.totalVerses,
            plan.input.level
          ),
          completed: false
        };
      }
      workBundles.push({
        memorizationTask,
        minorRevisionTask: revisionBundle?.minorRevisionTask,
        majorRevisionTask: revisionBundle?.majorRevisionTask,
        notes: revisionBundle?.notes
      });
    }

    const rescheduled = schedulePendingBundles(
      workBundles,
      PlanningEngine.parseDate(today),
      plan.input,
      'rebal'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan = this.refreshActualVsPlanned({
      ...plan,
      input: {
        ...plan.input,
        paceQuantity: pace
      },
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    });

    return {
      changed: true,
      plan: updatedPlan,
      summary,
      actionLabelAr: `تمت إعادة توزيع المتبقي (${remainingVerses} آية) بمعدل ${pace} آيات/يوم بدءاً من اليوم.`
    };
  },

  /**
   * Mark a task as completed or update individual properties.
   * Completion timestamps are preserved once written.
   */
  updateTask(
    plan: EngineGeneratedPlan,
    taskId: string,
    updates: Partial<ScheduledDayPlan>
  ): EngineGeneratedPlan {
    const updatedSchedule = plan.schedule.map(day => {
      if (day.id !== taskId) return day;

      const merged = { ...day, ...updates };
      if (merged.memorizationTask?.completed && !merged.memorizationTask.completedAt) {
        merged.memorizationTask.completedAt = new Date().toISOString();
      }
      return merged;
    });

    return this.refreshActualVsPlanned({ ...plan, schedule: updatedSchedule });
  },

  refreshActualVsPlanned(plan: EngineGeneratedPlan): EngineGeneratedPlan {
    const today = PlanningEngine.formatDate(new Date());
    let plannedToDate = 0;
    let actualCompleted = 0;

    for (const day of plan.schedule) {
      if (day.isRestDay || !day.memorizationTask) continue;
      if (day.date <= today) plannedToDate += day.memorizationTask.versesCount;
      if (day.memorizationTask.completed) actualCompleted += day.memorizationTask.versesCount;
    }

    const variance = actualCompleted - plannedToDate;
    let status: 'ahead' | 'on_track' | 'behind' = 'on_track';
    if (variance > 5) status = 'ahead';
    else if (variance < -5) status = 'behind';

    return {
      ...plan,
      actualVsPlanned: {
        plannedVersesToDate: plannedToDate,
        actualVersesMemorized: actualCompleted,
        varianceVerses: variance,
        status
      }
    };
  },

  pausePlan(plan: EngineGeneratedPlan, pauseDate?: string): EngineGeneratedPlan {
    const pDate = pauseDate || PlanningEngine.formatDate(new Date());
    return { ...plan, isPaused: true, pausedAt: pDate };
  },

  /**
   * Resume all unfinished work, including revision-only tasks. Completed task
   * components remain on their original dates; only unfinished components move.
   */
  resumePlan(plan: EngineGeneratedPlan, resumeDateStr?: string): EngineGeneratedPlan {
    const rDateStr = resumeDateStr || PlanningEngine.formatDate(new Date());
    if (!plan.isPaused && !plan.pausedAt) return plan;

    const historical: ScheduledDayPlan[] = [];
    const pendingBundles: PendingTaskBundle[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date < rDateStr) historical.push(day);
        continue;
      }

      const split = splitDayTasks(day);
      if (split.historical) historical.push(split.historical);
      if (split.pending) pendingBundles.push(split.pending);
    }

    if (pendingBundles.length === 0) {
      return { ...plan, isPaused: false, pausedAt: undefined };
    }
    if (!hasSchedulableDay(plan.input)) return plan;

    const rescheduled = schedulePendingBundles(
      pendingBundles,
      PlanningEngine.parseDate(rDateStr),
      plan.input,
      'resume'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      isPaused: false,
      pausedAt: undefined,
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    };

    return this.refreshActualVsPlanned(updatedPlan);
  },

  /**
   * Recalculate future memorization chunks while preserving completed
   * memorization/revision history and rescheduling unfinished revision tasks.
   */
  recalculatePlan(
    plan: EngineGeneratedPlan,
    newPaceVerses?: number,
    newTargetEndDate?: string
  ): EngineGeneratedPlan {
    const todayStr = PlanningEngine.formatDate(new Date());
    const historical: ScheduledDayPlan[] = [];
    const pendingRevisionBundles: PendingTaskBundle[] = [];
    const completedMemorizationTasks: ScheduledDayPlan[] = [];

    for (const day of plan.schedule) {
      if (day.isRestDay) {
        if (day.date <= todayStr) historical.push(day);
        continue;
      }

      const split = splitDayTasks(day);
      if (split.historical) {
        historical.push(split.historical);
        if (split.historical.memorizationTask?.completed) {
          completedMemorizationTasks.push(split.historical);
        }
      }
      if (split.pending) {
        const pendingRevision = {
          minorRevisionTask: split.pending.minorRevisionTask,
          majorRevisionTask: split.pending.majorRevisionTask,
          notes: split.pending.notes
        };
        if (pendingRevision.minorRevisionTask || pendingRevision.majorRevisionTask) {
          pendingRevisionBundles.push(pendingRevision);
        }
      }
    }

    const planStartIndex = QuranMath.getAbsoluteAyahIndex(
      plan.meta.startCoordinate.surahNumber,
      plan.meta.startCoordinate.ayahNumber
    );
    const planEndIndex = QuranMath.getAbsoluteAyahIndex(
      plan.meta.endCoordinate.surahNumber,
      plan.meta.endCoordinate.ayahNumber
    );
    const completedIndexes = new Set<number>();

    for (const day of completedMemorizationTasks) {
      const task = day.memorizationTask;
      if (!task) continue;
      const taskStart = QuranMath.getAbsoluteAyahIndex(task.surahNumber, task.startAyah);
      const taskEnd = QuranMath.getAbsoluteAyahIndex(task.surahNumber, task.endAyah);
      const boundedStart = Math.max(planStartIndex, taskStart);
      const boundedEnd = Math.min(planEndIndex, taskEnd);
      if (boundedEnd < boundedStart) continue;
      for (let index = boundedStart; index <= boundedEnd; index++) {
        completedIndexes.add(index);
      }
    }

    // Preserve every gap, including work before a later task completed out of order.
    const remainingRanges: Array<{ startIndex: number; endIndex: number }> = [];
    let rangeStart: number | null = null;
    for (let index = planStartIndex; index <= planEndIndex; index++) {
      if (!completedIndexes.has(index)) {
        if (rangeStart === null) rangeStart = index;
      } else if (rangeStart !== null) {
        remainingRanges.push({ startIndex: rangeStart, endIndex: index - 1 });
        rangeStart = null;
      }
    }
    if (rangeStart !== null) {
      remainingRanges.push({ startIndex: rangeStart, endIndex: planEndIndex });
    }

    const remainingVerses = remainingRanges.reduce(
      (total, range) => total + range.endIndex - range.startIndex + 1,
      0
    );

    if (remainingVerses === 0 && pendingRevisionBundles.length === 0) {
      return this.refreshActualVsPlanned(plan);
    }

    let pace = Number.isInteger(newPaceVerses) && (newPaceVerses || 0) > 0
      ? newPaceVerses as number
      : plan.input.paceQuantity;

    if (newTargetEndDate) {
      const activeDays = PlanningEngine.countActiveDaysBetween(
        todayStr,
        newTargetEndDate,
        plan.input.activeDays,
        plan.input.restDays
      );
      if (activeDays > 0) pace = Math.max(1, Math.ceil(remainingVerses / activeDays));
    }

    const chunks = remainingRanges.flatMap(range =>
      QuranMath.sliceRangeIntoChunks(
        QuranMath.getCoordinateFromAbsoluteIndex(range.startIndex),
        QuranMath.getCoordinateFromAbsoluteIndex(range.endIndex),
        pace
      )
    );
    const workBundles: PendingTaskBundle[] = [];
    const workCount = Math.max(chunks.length, pendingRevisionBundles.length);

    for (let index = 0; index < workCount; index++) {
      const chunk = chunks[index];
      const revisionBundle = pendingRevisionBundles[index];
      let memorizationTask: ScheduledDayPlan['memorizationTask'];

      if (chunk) {
        const surah = QuranMath.getSurah(chunk.start.surahNumber);
        memorizationTask = {
          surahNumber: chunk.start.surahNumber,
          surahName: surah?.name || '',
          startAyah: chunk.start.ayahNumber,
          endAyah: chunk.end.ayahNumber,
          versesCount: chunk.totalVerses,
          estimatedMinutes: QuranMath.estimateMemorizationMinutes(
            chunk.totalVerses,
            plan.input.level
          ),
          completed: false
        };
      }

      workBundles.push({
        memorizationTask,
        minorRevisionTask: revisionBundle?.minorRevisionTask,
        majorRevisionTask: revisionBundle?.majorRevisionTask,
        notes: revisionBundle?.notes
      });
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 1);
    if (workBundles.length > 0 && !hasSchedulableDay(plan.input)) return plan;
    const rescheduled = schedulePendingBundles(
      workBundles,
      startDate,
      plan.input,
      'recalc'
    );
    const newSchedule = [...historical, ...rescheduled].sort((a, b) =>
      a.date.localeCompare(b.date) || a.id.localeCompare(b.id)
    );
    const updatedPlan: EngineGeneratedPlan = {
      ...plan,
      input: {
        ...plan.input,
        paceQuantity: pace,
        targetEndDate: newTargetEndDate || plan.input.targetEndDate
      },
      schedule: newSchedule,
      meta: {
        ...plan.meta,
        projectedEndDate: getLastScheduledWorkDate(newSchedule, plan.meta.projectedEndDate)
      }
    };

    return this.refreshActualVsPlanned(updatedPlan);
  }
};
