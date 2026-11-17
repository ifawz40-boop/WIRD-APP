import {
  getDailySessionSelection,
  getDueEngineTasks,
  findMatchingDueEnginePlanTask,
  getNextDueEngineTask,
  getNextPresetMemorizationRange,
  isPresetAutoStartSupported
} from './dailySessionSelection';
import type { EngineGeneratedPlan, ScheduledDayPlan, ScheduledTaskUnit } from './planningEngine';
import type { MemorizationPlan, WirdPortion } from '../types/quran';
import { ALL_SURAHS } from '../data/quranMeta';

export function runDailySessionSelectionTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, fn: () => void) => {
    try { fn(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (condition: boolean, message: string) => { if (!condition) throw new Error(message); };

  const makeTask = (surahNumber: number, completed = false): ScheduledTaskUnit => ({
    surahNumber,
    surahName: ALL_SURAHS.find(surah => surah.number === surahNumber)?.name || '',
    startAyah: 1,
    endAyah: 5,
    versesCount: 5,
    estimatedMinutes: 10,
    completed
  });

  const makeDay = (date: string, task?: ScheduledTaskUnit): ScheduledDayPlan => ({
    id: date,
    date,
    dayOfWeek: 0,
    dayNameAr: 'الأحد',
    isRestDay: !task,
    memorizationTask: task,
    status: task?.completed ? 'completed' : 'pending'
  });

  const makeEnginePlan = (schedule: ScheduledDayPlan[], overrides: Partial<EngineGeneratedPlan> = {}): EngineGeneratedPlan => ({
    id: 'engine-plan-test',
    title: 'اختبار',
    input: { title: 'خطة الاختبار' } as EngineGeneratedPlan['input'],
    meta: {} as EngineGeneratedPlan['meta'],
    feasibility: {} as EngineGeneratedPlan['feasibility'],
    rationale: '',
    schedule,
    actualVsPlanned: {} as EngineGeneratedPlan['actualVsPlanned'],
    isActive: true,
    isPaused: false,
    createdAt: '2026-11-01T00:00:00.000Z',
    ...overrides
  });

  const makePreset = (overrides: Partial<MemorizationPlan> = {}): MemorizationPlan => ({
    id: 'preset-test',
    title: 'اختبار',
    description: '',
    type: 'whole_quran',
    totalUnits: 0,
    completedUnits: 0,
    unitType: 'ayah',
    dailyTarget: 5,
    memorizationDaysPerWeek: 5,
    revisionDaysPerWeek: 2,
    startDate: '2026-11-01',
    targetEndDate: '2027-01-01',
    isActive: true,
    ...overrides
  });

  const portion = (surahNumber: number, startAyah: number, endAyah: number, status: WirdPortion['status']): WirdPortion => ({
    id: `portion-${surahNumber}-${startAyah}-${endAyah}`,
    type: 'passage',
    surahNumber,
    surahName: ALL_SURAHS.find(surah => surah.number === surahNumber)?.name || '',
    startAyah,
    endAyah,
    status,
    nextDueDate: '2026-11-05',
    intervalDays: 1,
    easeFactor: 2.5,
    repetitionCount: 0
  });

  test('All active engine plans contribute every due task in deterministic date order', () => {
    const first = makeEnginePlan([
      makeDay('2026-11-04', makeTask(2)),
      makeDay('2026-11-05', makeTask(3)),
      makeDay('2026-11-08', makeTask(4))
    ], { id: 'plan-a', title: 'الخطة الأولى', input: { title: 'الخطة الأولى' } as EngineGeneratedPlan['input'] });
    const second = makeEnginePlan([
      makeDay('2026-11-05', makeTask(5)),
      makeDay('2026-11-06', makeTask(6))
    ], { id: 'plan-b', title: 'الخطة الثانية', input: { title: 'الخطة الثانية' } as EngineGeneratedPlan['input'] });
    const third = makeEnginePlan([
      makeDay('2026-11-05', makeTask(7))
    ], { id: 'plan-c', title: 'الخطة الثالثة', input: { title: 'الخطة الثالثة' } as EngineGeneratedPlan['input'] });
    const due = getDueEngineTasks([first, second, third], '2026-11-05');
    assert(due.length === 4, 'All overdue and today tasks from all plans should be returned');
    assert(due[0].task.surahNumber === 2, 'Oldest overdue task should be first');
    assert(due.some(item => item.planId === 'plan-b' && item.task.surahNumber === 5), 'Second plan task must be retained');
    assert(due.some(item => item.planId === 'plan-c' && item.task.surahNumber === 7), 'Third plan task must be retained');
    assert(!due.some(item => item.task.surahNumber === 4 || item.task.surahNumber === 6), 'Future tasks must remain excluded');
    const primary = getDailySessionSelection([], [first, second, third], [], '2026-11-05');
    assert(primary.kind === 'session' && primary.enginePlanId === 'plan-a', 'The primary dashboard session must retain the exact source plan identity');
  });

  test('Session completion resolves duplicate ayah ranges to the originating plan ID', () => {
    const first = makeEnginePlan([makeDay('2026-11-05', makeTask(67))], {
      id: 'plan-a', title: 'الخطة الأولى', input: { title: 'الخطة الأولى' } as EngineGeneratedPlan['input']
    });
    const second = makeEnginePlan([makeDay('2026-11-05', makeTask(67))], {
      id: 'plan-b', title: 'الخطة الثانية', input: { title: 'الخطة الثانية' } as EngineGeneratedPlan['input']
    });
    const target = { surahNumber: 67, startAyah: 1, endAyah: 5, enginePlanId: 'plan-b' };
    const exact = findMatchingDueEnginePlanTask([first, second], '2026-11-05', target);
    assert(exact?.plan.id === 'plan-b', 'A persisted originating plan ID must win when ayah ranges are duplicated');
    const deterministic = findMatchingDueEnginePlanTask([second, first], '2026-11-05', { ...target, enginePlanId: null });
    assert(deterministic?.plan.id === 'plan-a', 'Missing plan context falls back to deterministic title/date ordering');
    const missing = findMatchingDueEnginePlanTask([first, second], '2026-11-05', { ...target, enginePlanId: 'plan-missing' });
    assert(missing === null, 'An unknown originating plan ID must not update a different plan');
  });

  test('All-plan due queue excludes paused, inactive, completed tasks and completed days', () => {
    const active = makeEnginePlan([
      makeDay('2026-11-05', makeTask(2, true)),
      { ...makeDay('2026-11-05', makeTask(3)), status: 'completed' }
    ], { id: 'active' });
    const paused = makeEnginePlan([makeDay('2026-11-05', makeTask(4))], { id: 'paused', isPaused: true });
    const inactive = makeEnginePlan([makeDay('2026-11-05', makeTask(5))], { id: 'inactive', isActive: false });
    assert(getDueEngineTasks([active, paused, inactive], '2026-11-05').length === 0, 'Only incomplete tasks in active non-paused days should be due');
  });

  test('Engine quick-start chooses the oldest overdue task before today', () => {
    const plan = makeEnginePlan([
      makeDay('2026-11-04', makeTask(2)),
      makeDay('2026-11-05', makeTask(3)),
      makeDay('2026-11-06', makeTask(4))
    ]);
    const task = getNextDueEngineTask(plan, '2026-11-05');
    assert(task?.surahNumber === 2, 'The oldest due task should be selected first');
  });

  test('Engine quick-start never starts a future task early', () => {
    const plan = makeEnginePlan([makeDay('2026-11-06', makeTask(4))]);
    assert(getNextDueEngineTask(plan, '2026-11-05') === null, 'Future tasks must remain pending');
    const selection = getDailySessionSelection([], [plan], [], '2026-11-05');
    assert(selection.kind === 'blocked', 'A future-only engine plan must not start early');
  });

  test('Engine quick-start ignores paused, inactive, and completed tasks', () => {
    const task = makeTask(4);
    const paused = makeEnginePlan([makeDay('2026-11-05', task)], { isPaused: true });
    const inactive = makeEnginePlan([makeDay('2026-11-05', task)], { isActive: false });
    const completed = makeEnginePlan([makeDay('2026-11-05', makeTask(4, true))]);
    assert(getNextDueEngineTask(paused, '2026-11-05') === null, 'Paused plan must be ignored');
    assert(getNextDueEngineTask(inactive, '2026-11-05') === null, 'Inactive plan must be ignored');
    assert(getNextDueEngineTask(completed, '2026-11-05') === null, 'Completed task must be ignored');
  });

  test('Whole-Quran ayah preset resolves from the beginning of the canonical Surah order', () => {
    const range = getNextPresetMemorizationRange(makePreset(), [], 5);
    assert(range?.surahNumber === 1 && range.startAyah === 1 && range.endAyah === 5, 'Whole-Quran plan should begin at Al-Fatihah');
  });

  test('Surah/custom ayah presets stay inside their explicit Surah scope', () => {
    const plan = makePreset({ type: 'surahs', targetSurahs: [67] });
    const range = getNextPresetMemorizationRange(plan, [], 4);
    assert(range?.surahNumber === 67 && range.startAyah === 1 && range.endAyah === 4, 'Selected-Surah plan must not jump outside its scope');
  });

  test('Juz and page presets are not silently widened to whole Surahs', () => {
    const juzPlan = makePreset({ type: 'juz', targetJuz: [29] });
    const pagePlan = makePreset({ unitType: 'page', startPage: 562, endPage: 563 });
    assert(!isPresetAutoStartSupported(juzPlan), 'Juz scope needs an exact coordinate resolver');
    assert(!isPresetAutoStartSupported(pagePlan), 'Page scope needs an exact coordinate resolver');
    assert(getNextPresetMemorizationRange(juzPlan, [], 5) === null, 'Juz scope must not start a broad Surah range');
    assert(getNextPresetMemorizationRange(pagePlan, [], 5) === null, 'Page scope must not start a broad Surah range');
  });

  test('Invalid or missing Surah scopes are rejected', () => {
    const invalid = makePreset({ type: 'custom', targetSurahs: [0, 115] });
    const missing = makePreset({ type: 'custom' });
    assert(!isPresetAutoStartSupported(invalid), 'Invalid Surah numbers must be rejected');
    assert(!isPresetAutoStartSupported(missing), 'Custom plan without an explicit scope must be rejected');
  });

  test('Due revision takes precedence over fallback memorization when no plan is active', () => {
    const due = portion(2, 1, 5, 'weak');
    const selection = getDailySessionSelection([], [], [due], '2026-11-05');
    assert(selection.kind === 'session' && selection.mode === 'review', 'A due portion must open review mode');
    assert(selection.kind === 'session' && selection.source === 'revision', 'The selection must be labelled as revision');
  });

  test('Due revision takes precedence over an active preset memorization range', () => {
    const due = portion(2, 1, 5, 'weak');
    const preset = makePreset({ type: 'surahs', targetSurahs: [67] });
    const selection = getDailySessionSelection([preset], [], [due], '2026-11-05');
    assert(selection.kind === 'session' && selection.mode === 'review', 'Overdue revision must be offered before a new memorization range');
    assert(selection.kind === 'session' && selection.surahNumber === 2, 'The due revision portion must be selected');
  });

  test('Preset scope resumes at the first uncovered ayah', () => {
    const plan = makePreset({ type: 'surahs', targetSurahs: [1], dailyTarget: 3 });
    const saved = { ...portion(1, 1, 2, 'stable'), nextDueDate: '2026-11-06' };
    const selection = getDailySessionSelection([plan], [], [saved], '2026-11-05');
    assert(selection.kind === 'session' && selection.mode === 'memorize', 'Preset plan should select memorization');
    assert(selection.kind === 'session' && selection.startAyah === 3 && selection.endAyah === 5, 'Preset should continue after the saved range');
  });

  test('No plan and no progress starts the canonical first range', () => {
    const selection = getDailySessionSelection([], [], [], '2026-11-05');
    assert(selection.kind === 'session' && selection.surahNumber === 1 && selection.startAyah === 1 && selection.endAyah === 7, 'New user should start at Al-Fatihah');
  });

  test('Unsupported active plan is blocked rather than starting outside its scope', () => {
    const plan = makePreset({ type: 'juz', targetJuz: [29] });
    const selection = getDailySessionSelection([plan], [], [], '2026-11-05');
    assert(selection.kind === 'blocked', 'Unsupported Juz plan must not silently start an unrelated range');
  });

  return { passed, failed };
}
