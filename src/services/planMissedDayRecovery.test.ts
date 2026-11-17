import { PlanningEngine, type EngineGeneratedPlan } from './planningEngine';
import { PlanLifecycle } from './planLifecycle';

function buildTestPlan(): EngineGeneratedPlan {
  // 2026-11-10 is Tuesday (dayOfWeek = 2). Active days Mon-Thu & Sat-Sun (Friday=5 is rest day).
  return PlanningEngine.generatePlan({
    title: 'خطة اختبار تدارك الأيام الفائتة',
    startSurah: 67,
    startAyah: 1,
    endSurah: 67,
    endAyah: 12,
    startDate: '2026-11-10',
    level: 'intermediate',
    dailyAvailableMinutes: 30,
    dailyRevisionMinutes: 20,
    paceType: 'verses_per_day',
    paceQuantity: 3,
    activeDays: [0, 1, 2, 3, 4, 6],
    restDays: [5],
    schedulePreference: 'single_session'
  });
}

export function runPlanMissedDayRecoveryTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const test = (name: string, fn: () => void) => {
    try {
      fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  test('detectMissedDays counts uncompleted past study days and ignores completed, paused, and rest days', () => {
    const plan = buildTestPlan();
    // Day 0 (2026-11-10): completed
    // Day 1 (2026-11-11): missed (3 verses + revision)
    // Day 2 (2026-11-12): missed (3 verses + revision)
    // Day 3 (2026-11-13 = Friday rest day): ignored
    let updated = PlanLifecycle.updateTask(plan, plan.schedule[0].id, {
      status: 'completed',
      memorizationTask: plan.schedule[0].memorizationTask
        ? { ...plan.schedule[0].memorizationTask, completed: true, completedAt: '2026-11-10T10:00:00Z' }
        : undefined,
      minorRevisionTask: plan.schedule[0].minorRevisionTask
        ? { ...plan.schedule[0].minorRevisionTask, completed: true }
        : undefined
    });

    const summary = PlanLifecycle.detectMissedDays(updated, '2026-11-14');
    assert(summary.hasMissedDays === true, 'Expected missed days on 2026-11-11 and 2026-11-12');
    assert(summary.missedDaysCount === 2, `Expected 2 missed days, got ${summary.missedDaysCount}`);
    assert(summary.missedMemorizationVerses === 6, `Expected 6 missed verses, got ${summary.missedMemorizationVerses}`);
    assert(!summary.missedDates.includes('2026-11-13'), 'Rest day must never be flagged as a missed day');

    const pausedPlan = { ...updated, isPaused: true };
    const pausedSummary = PlanLifecycle.detectMissedDays(pausedPlan, '2026-11-14');
    assert(pausedSummary.hasMissedDays === false && pausedSummary.missedDaysCount === 0,
      'Paused plans must report zero missed days');
  });

  test('shiftMissedForward preserves completed history 100% and shifts pending tasks starting today honoring rest days', () => {
    let plan = buildTestPlan();
    plan = PlanLifecycle.updateTask(plan, plan.schedule[0].id, {
      status: 'completed',
      memorizationTask: plan.schedule[0].memorizationTask
        ? { ...plan.schedule[0].memorizationTask, completed: true, completedAt: '2026-11-10T10:00:00Z' }
        : undefined,
      minorRevisionTask: plan.schedule[0].minorRevisionTask
        ? { ...plan.schedule[0].minorRevisionTask, completed: true }
        : undefined
    });

    const result = PlanLifecycle.shiftMissedForward(plan, '2026-11-14');
    assert(result.changed === true, 'shiftMissedForward must report changed=true');

    const completedDay = result.plan.schedule.find(d => d.date === '2026-11-10');
    assert(completedDay?.status === 'completed' && completedDay.memorizationTask?.completed === true,
      'Completed historical task must remain completely intact');

    const uncompletedBeforeToday = result.plan.schedule.filter(
      d => d.date < '2026-11-14' && !d.isRestDay && d.status !== 'completed'
    );
    assert(uncompletedBeforeToday.length === 0, 'No pending tasks should remain dated before today after shift');

    const futureStart = result.plan.schedule.find(d => !d.isRestDay && d.date >= '2026-11-14');
    assert(futureStart?.date === '2026-11-14' && futureStart.memorizationTask?.startAyah === 4,
      `Expected shifted first uncompleted range to start at 2026-11-14 with ayah 4, got ${futureStart?.date} ayah ${futureStart?.memorizationTask?.startAyah}`);

    const postCheck = PlanLifecycle.detectMissedDays(result.plan, '2026-11-14');
    assert(postCheck.hasMissedDays === false, 'Zero missed days should remain after shifting forward');
  });

  test('scheduleLightRecoveryDay dedicates today to light revision and resumes new memorization tomorrow', () => {
    let plan = buildTestPlan();
    plan = PlanLifecycle.updateTask(plan, plan.schedule[0].id, {
      status: 'completed',
      memorizationTask: plan.schedule[0].memorizationTask
        ? { ...plan.schedule[0].memorizationTask, completed: true }
        : undefined,
      minorRevisionTask: plan.schedule[0].minorRevisionTask
        ? { ...plan.schedule[0].minorRevisionTask, completed: true }
        : undefined
    });

    const result = PlanLifecycle.scheduleLightRecoveryDay(plan, '2026-11-14');
    assert(result.changed === true, 'scheduleLightRecoveryDay must report changed=true');

    const todayEntry = result.plan.schedule.find(d => d.date === '2026-11-14');
    assert(Boolean(todayEntry && !todayEntry.memorizationTask && todayEntry.minorRevisionTask?.type === 'minor'),
      'Today must hold a lightweight minor revision task with no new memorization load');

    const nextMemDay = result.plan.schedule.find(d => d.date > '2026-11-14' && d.memorizationTask);
    assert(Boolean(nextMemDay && nextMemDay.memorizationTask?.startAyah === 4),
      'Pending memorization must resume from the next active study day after today');

    const completedDay = result.plan.schedule.find(d => d.date === '2026-11-10');
    assert(completedDay?.status === 'completed', 'Completed history must stay intact');
  });

  test('rebalanceRemainingPlan redistributes unmemorized ayahs evenly from today without losing completed history', () => {
    let plan = buildTestPlan();
    plan = PlanLifecycle.updateTask(plan, plan.schedule[0].id, {
      status: 'completed',
      memorizationTask: plan.schedule[0].memorizationTask
        ? { ...plan.schedule[0].memorizationTask, completed: true }
        : undefined,
      minorRevisionTask: plan.schedule[0].minorRevisionTask
        ? { ...plan.schedule[0].minorRevisionTask, completed: true }
        : undefined
    });

    const result = PlanLifecycle.rebalanceRemainingPlan(plan, '2026-11-14');
    assert(result.changed === true, 'rebalanceRemainingPlan must produce a rebalanced schedule');

    const postCheck = PlanLifecycle.detectMissedDays(result.plan, '2026-11-14');
    assert(postCheck.hasMissedDays === false, 'Zero missed days should remain after rebalancing');

    const allMemVerses = result.plan.schedule
      .filter(d => !d.isRestDay && d.memorizationTask)
      .reduce((sum, d) => sum + (d.memorizationTask?.versesCount || 0), 0);
    assert(allMemVerses === 12, `Expected total memorized + planned verses to equal 12, got ${allMemVerses}`);
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('planMissedDayRecovery.test')) {
  const res = runPlanMissedDayRecoveryTests();
  console.log(`Plan Missed-Day Recovery Tests: ${res.passed} passed, ${res.failed} failed`);
  if (res.failed > 0) process.exit(1);
}
