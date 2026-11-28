import type {
  DailyLog,
  MemorizationPlan,
  TestResult,
  UserProfile,
  WeakVerseItem,
  WirdPortion,
} from '../types/quran';
import {
  PlanningEngine,
  type EngineGeneratedPlan,
  type PlanGenerationInput,
  type ScheduledDayPlan,
} from './planningEngine';
import {
  applyMergedAuxiliaryDomainSnapshot,
  captureAuxiliaryDomainSnapshot,
  isValidAuxiliaryDomainSnapshot,
  mergeAuxiliaryDomainSnapshots,
  type AuxiliaryDomainSnapshotV1,
} from './auxiliaryDomainsSchema';
import {
  areRuqyahLegacyBaselinesCompatible,
  isValidRuqyahProgressSnapshotV2,
  mergeRuqyahProgressSnapshots,
  type RuqyahProgressSnapshot,
} from './ruqyahProgressSchema';
import {
  getItemUpsertTimestamp,
  isItemDeletedInLedger,
  mergeSyncTombstoneLedgers,
  readSyncTombstoneLedger,
  withApplyingRemoteSyncGuard,
  writeSyncTombstoneLedger,
  type SyncTombstoneLedgerV1,
} from './syncTombstoneRegistry';
import { RetentionService } from './retentionService';
import { StorageService, isValidEngineGeneratedPlan } from './storageService';
import { mergeCanonicalPortionRecords } from './unifiedPortionService';
import { commitEnginePlansArchiveRevision } from './enginePlanArchive';

export const ACCOUNT_CLOUD_VAULT_DOC_ID = 'accountCloudVaultV4';

type ScheduledDayStatus = ScheduledDayPlan['status'];

export interface CompactDayOverrideV4 {
  date?: string;
  status: ScheduledDayStatus;
  memDone?: boolean;
  memAt?: string;
  memDate?: string;
  minorDone?: boolean;
  majorDone?: boolean;
}

export interface CompactEnginePlanV4 {
  id: string;
  title: string;
  createdAt: string;
  isActive: boolean;
  isPaused?: boolean;
  pausedAt?: string;
  actualVsPlanned: EngineGeneratedPlan['actualVsPlanned'];
  input: PlanGenerationInput;
  dayOverrides: Record<string, CompactDayOverrideV4>;
}

export interface AccountCloudBundleV4 {
  format: 'wird_account_cloud_v4';
  schemaVersion: 4;
  updatedAtMs: number;
  tombstoneLedger: SyncTombstoneLedgerV1;
  profile: UserProfile;
  plans: MemorizationPlan[];
  enginePlans?: EngineGeneratedPlan[];
  compactEnginePlans?: CompactEnginePlanV4[];
  unifiedPortions: WirdPortion[];
  weakVerses: WeakVerseItem[];
  tests: TestResult[];
  logs: DailyLog[];
  ruqyahProgress: RuqyahProgressSnapshot | null;
  auxiliary: AuxiliaryDomainSnapshotV1;
}

export interface MergeBundleStats {
  addedCount: number;
  deletedCount: number;
  domainsMerged: string[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function parseIsoMs(iso: unknown): number {
  if (typeof iso !== 'string' || !iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function byteLengthUtf8(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function compactSingleEnginePlan(plan: EngineGeneratedPlan): CompactEnginePlanV4 {
  const baseline = PlanningEngine.generatePlan(plan.input);
  const dayOverrides: Record<string, CompactDayOverrideV4> = {};

  for (let idx = 0; idx < plan.schedule.length; idx++) {
    const day = plan.schedule[idx];
    const baseDay = baseline.schedule[idx];
    const memDone = Boolean(day.memorizationTask?.completed);
    const minorDone = Boolean(day.minorRevisionTask?.completed);
    const majorDone = Boolean(day.majorRevisionTask?.completed);
    const dateChanged = !baseDay || baseDay.date !== day.date;
    if (day.status !== 'pending' || memDone || minorDone || majorDone || dateChanged) {
      dayOverrides[String(idx)] = {
        ...(dateChanged ? { date: day.date } : {}),
        status: day.status,
        ...(memDone
          ? {
              memDone: true,
              memAt: day.memorizationTask?.completedAt,
              memDate: day.memorizationTask?.completedDate,
            }
          : {}),
        ...(minorDone ? { minorDone: true } : {}),
        ...(majorDone ? { majorDone: true } : {}),
      };
    }
  }

  return {
    id: plan.id,
    title: plan.title,
    createdAt: plan.createdAt,
    isActive: plan.isActive,
    ...(plan.isPaused !== undefined ? { isPaused: plan.isPaused } : {}),
    ...(plan.pausedAt !== undefined ? { pausedAt: plan.pausedAt } : {}),
    actualVsPlanned: { ...plan.actualVsPlanned },
    input: JSON.parse(JSON.stringify(plan.input)) as PlanGenerationInput,
    dayOverrides,
  };
}

export function expandCompactEnginePlan(compact: CompactEnginePlanV4): EngineGeneratedPlan | null {
  try {
    if (!compact || !isPlainRecord(compact) || typeof compact.id !== 'string' || !compact.input) {
      return null;
    }
    const generated = PlanningEngine.generatePlan(compact.input);
    const schedule: ScheduledDayPlan[] = generated.schedule.map((day, idx) => {
      const ov = compact.dayOverrides?.[String(idx)];
      if (!ov) return day;
      return {
        ...day,
        date: typeof ov.date === 'string' ? ov.date : day.date,
        status: ov.status || day.status,
        memorizationTask: day.memorizationTask
          ? {
              ...day.memorizationTask,
              completed: Boolean(ov.memDone),
              ...(ov.memAt ? { completedAt: ov.memAt } : {}),
              ...(ov.memDate ? { completedDate: ov.memDate } : {}),
            }
          : undefined,
        minorRevisionTask: day.minorRevisionTask
          ? {
              ...day.minorRevisionTask,
              completed: Boolean(ov.minorDone),
            }
          : undefined,
        majorRevisionTask: day.majorRevisionTask
          ? {
              ...day.majorRevisionTask,
              completed: Boolean(ov.majorDone),
            }
          : undefined,
      };
    });

    const actualVersesMemorized = schedule.reduce(
      (sum, d) => sum + (d.memorizationTask?.completed ? d.memorizationTask.versesCount : 0),
      0
    );
    const candidate: EngineGeneratedPlan = {
      ...generated,
      id: compact.id,
      title: compact.title || generated.title,
      createdAt: compact.createdAt || generated.createdAt,
      isActive: Boolean(compact.isActive),
      isPaused: Boolean(compact.isPaused),
      ...(compact.pausedAt ? { pausedAt: compact.pausedAt } : {}),
      actualVsPlanned: {
        ...(compact.actualVsPlanned || generated.actualVsPlanned),
        actualVersesMemorized,
      },
      schedule,
    };
    return isValidEngineGeneratedPlan(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function extractBundleEnginePlans(bundle: AccountCloudBundleV4): EngineGeneratedPlan[] {
  if (Array.isArray(bundle.enginePlans) && bundle.enginePlans.length > 0) {
    return bundle.enginePlans.filter(isValidEngineGeneratedPlan);
  }
  if (Array.isArray(bundle.compactEnginePlans) && bundle.compactEnginePlans.length > 0) {
    const expanded: EngineGeneratedPlan[] = [];
    for (const item of bundle.compactEnginePlans) {
      const plan = expandCompactEnginePlan(item);
      if (plan) expanded.push(plan);
    }
    return expanded;
  }
  return [];
}

export function isValidAccountCloudBundle(value: unknown): value is AccountCloudBundleV4 {
  if (!isPlainRecord(value)) return false;
  if (value.format !== 'wird_account_cloud_v4' || value.schemaVersion !== 4) return false;
  if (typeof value.updatedAtMs !== 'number' || !Number.isFinite(value.updatedAtMs) || value.updatedAtMs < 0) {
    return false;
  }
  if (!isPlainRecord(value.profile) || typeof value.profile.name !== 'string') return false;
  if (!Array.isArray(value.plans)) return false;
  if (!Array.isArray(value.unifiedPortions)) return false;
  if (!Array.isArray(value.weakVerses)) return false;
  if (!Array.isArray(value.tests)) return false;
  if (!Array.isArray(value.logs)) return false;
  if (!isValidAuxiliaryDomainSnapshot(value.auxiliary)) return false;
  return true;
}

export function captureAccountCloudBundle(nowMs: number = Date.now()): AccountCloudBundleV4 {
  const safeNow = Math.max(0, Math.trunc(nowMs));
  const tombstoneLedger = readSyncTombstoneLedger();
  const profile = StorageService.getProfile();
  const plans = StorageService.getPlans();
  const rawEnginePlans = StorageService.getEnginePlans();
  const unifiedPortions = StorageService.getUnifiedPortions();
  let weakVerses: WeakVerseItem[] = [];
  try {
    weakVerses = RetentionService.getWeakVerses();
  } catch {
    weakVerses = [];
  }
  const tests = StorageService.getTests().slice(0, 50);
  let logs: DailyLog[] = [];
  try {
    logs = StorageService.getLogs()
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-180);
  } catch {
    logs = [];
  }
  let ruqyahProgress: RuqyahProgressSnapshot | null = null;
  try {
    ruqyahProgress = StorageService.getRuqyahProgressSnapshot();
  } catch {
    ruqyahProgress = null;
  }
  const auxiliary = captureAuxiliaryDomainSnapshot((key) => StorageService.getRawItem(key), safeNow);
  auxiliary.tombstoneLedger = tombstoneLedger;

  const engineSerializedBytes = byteLengthUtf8(JSON.stringify(rawEnginePlans));
  const useCompact = engineSerializedBytes > 36_000;

  return {
    format: 'wird_account_cloud_v4',
    schemaVersion: 4,
    updatedAtMs: Math.max(safeNow, tombstoneLedger.updatedAtMs),
    tombstoneLedger,
    profile,
    plans,
    ...(useCompact
      ? { compactEnginePlans: rawEnginePlans.slice(0, 40).map(compactSingleEnginePlan) }
      : { enginePlans: rawEnginePlans }),
    unifiedPortions,
    weakVerses,
    tests,
    logs,
    ruqyahProgress,
    auxiliary,
  };
}

function mergeEnginePlanPair(
  localPlan: EngineGeneratedPlan,
  remotePlan: EngineGeneratedPlan,
  remoteIsPrimary: boolean
): EngineGeneratedPlan {
  const primary = remoteIsPrimary ? remotePlan : localPlan;
  const secondary = remoteIsPrimary ? localPlan : remotePlan;

  const sameScope =
    primary.input.startSurah === secondary.input.startSurah &&
    primary.input.startAyah === secondary.input.startAyah &&
    primary.input.endSurah === secondary.input.endSurah &&
    primary.input.endAyah === secondary.input.endAyah &&
    primary.schedule.length === secondary.schedule.length;

  if (!sameScope) {
    return primary;
  }

  const mergedSchedule: ScheduledDayPlan[] = primary.schedule.map((pDay, idx) => {
    const sDay = secondary.schedule[idx];
    if (!sDay) return pDay;
    const memCompleted = Boolean(pDay.memorizationTask?.completed || sDay.memorizationTask?.completed);
    const minorCompleted = Boolean(pDay.minorRevisionTask?.completed || sDay.minorRevisionTask?.completed);
    const majorCompleted = Boolean(pDay.majorRevisionTask?.completed || sDay.majorRevisionTask?.completed);

    const memorizationTask = pDay.memorizationTask
      ? {
          ...pDay.memorizationTask,
          completed: memCompleted,
          ...(memCompleted
            ? {
                completedAt:
                  pDay.memorizationTask.completedAt ||
                  sDay.memorizationTask?.completedAt ||
                  new Date().toISOString(),
                completedDate:
                  pDay.memorizationTask.completedDate || sDay.memorizationTask?.completedDate,
              }
            : {}),
        }
      : undefined;

    const minorRevisionTask = pDay.minorRevisionTask
      ? { ...pDay.minorRevisionTask, completed: minorCompleted }
      : undefined;
    const majorRevisionTask = pDay.majorRevisionTask
      ? { ...pDay.majorRevisionTask, completed: majorCompleted }
      : undefined;

    const hasTasks = Boolean(memorizationTask || minorRevisionTask || majorRevisionTask);
    const allDone =
      hasTasks &&
      (!memorizationTask || memorizationTask.completed) &&
      (!minorRevisionTask || minorRevisionTask.completed) &&
      (!majorRevisionTask || majorRevisionTask.completed);
    const anyDone =
      Boolean(memorizationTask?.completed) ||
      Boolean(minorRevisionTask?.completed) ||
      Boolean(majorRevisionTask?.completed);

    const status: ScheduledDayStatus = allDone
      ? 'completed'
      : anyDone
        ? 'partially_completed'
        : pDay.status;

    return {
      ...pDay,
      status,
      memorizationTask,
      minorRevisionTask,
      majorRevisionTask,
    };
  });

  const actualVersesMemorized = mergedSchedule.reduce(
    (sum, d) => sum + (d.memorizationTask?.completed ? d.memorizationTask.versesCount : 0),
    0
  );
  return {
    ...primary,
    actualVsPlanned: {
      ...primary.actualVsPlanned,
      actualVersesMemorized,
    },
    schedule: mergedSchedule,
  };
}

/**
 * Deterministic, commutative/idempotent LWW-Element-Set CRDT merge across the entire account:
 * - Preserves concurrent additions across devices.
 * - Propagates deletions/unmarks via `SyncTombstoneLedgerV1` and prevents resurrection.
 * - Restores items cleanly when re-added at a strictly higher HLC timestamp.
 */
export function mergeAccountCloudBundles(
  local: AccountCloudBundleV4,
  remote: AccountCloudBundleV4,
  nowMs: number = Date.now()
): { merged: AccountCloudBundleV4; stats: MergeBundleStats } {
  const mergedLedger = mergeSyncTombstoneLedgers(
    mergeSyncTombstoneLedgers(local.tombstoneLedger, remote.tombstoneLedger),
    mergeSyncTombstoneLedgers(local.auxiliary?.tombstoneLedger, remote.auxiliary?.tombstoneLedger)
  );

  let addedCount = 0;
  let deletedCount = 0;
  const domainsMerged: string[] = [];

  // 1. Profile
  const remoteProfileNewer =
    remote.tombstoneLedger.profileUpdatedAtMs > local.tombstoneLedger.profileUpdatedAtMs ||
    (remote.tombstoneLedger.profileUpdatedAtMs === local.tombstoneLedger.profileUpdatedAtMs &&
      remote.updatedAtMs >= local.updatedAtMs);
  const primaryProfile = remoteProfileNewer ? remote.profile : local.profile;
  const secondaryProfile = remoteProfileNewer ? local.profile : remote.profile;
  const latestActiveDate =
    (primaryProfile.lastActiveDate || '') >= (secondaryProfile.lastActiveDate || '')
      ? primaryProfile.lastActiveDate
      : secondaryProfile.lastActiveDate;
  const mergedStreak =
    primaryProfile.lastActiveDate === secondaryProfile.lastActiveDate
      ? Math.max(primaryProfile.streakDays || 0, secondaryProfile.streakDays || 0)
      : latestActiveDate === primaryProfile.lastActiveDate
        ? primaryProfile.streakDays
        : secondaryProfile.streakDays;
  const mergedProfile: UserProfile = {
    ...secondaryProfile,
    ...primaryProfile,
    lastActiveDate: latestActiveDate,
    streakDays: mergedStreak,
  };

  // 2. Preset Memorization Plans
  const localPlanMap = new Map(local.plans.map((p) => [p.id, p]));
  const remotePlanMap = new Map(remote.plans.map((p) => [p.id, p]));
  const mergedPlans: MemorizationPlan[] = [];
  for (const id of new Set([...localPlanMap.keys(), ...remotePlanMap.keys()])) {
    if (isItemDeletedInLedger(mergedLedger, 'plans', id)) {
      if (localPlanMap.has(id)) deletedCount++;
      continue;
    }
    const lp = localPlanMap.get(id);
    const rp = remotePlanMap.get(id);
    if (!lp && rp) {
      addedCount++;
      mergedPlans.push(rp);
    } else if (lp && !rp) {
      mergedPlans.push(lp);
    } else if (lp && rp) {
      const rUp = getItemUpsertTimestamp(remote.tombstoneLedger, 'plans', id);
      const lUp = getItemUpsertTimestamp(local.tombstoneLedger, 'plans', id);
      const primary = rUp >= lUp ? rp : lp;
      mergedPlans.push({
        ...primary,
        completedUnits: Math.max(lp.completedUnits, rp.completedUnits),
      });
    }
  }
  if (mergedPlans.length !== local.plans.length) domainsMerged.push('plans');

  // 3. Smart Engine Plans
  const localEngineList = extractBundleEnginePlans(local);
  const remoteEngineList = extractBundleEnginePlans(remote);
  const localEngineMap = new Map(localEngineList.map((p) => [p.id, p]));
  const remoteEngineMap = new Map(remoteEngineList.map((p) => [p.id, p]));
  const mergedEnginePlans: EngineGeneratedPlan[] = [];
  for (const id of new Set([...localEngineMap.keys(), ...remoteEngineMap.keys()])) {
    const lp = localEngineMap.get(id);
    const rp = remoteEngineMap.get(id);
    const createdMs = Math.max(parseIsoMs(lp?.createdAt), parseIsoMs(rp?.createdAt));
    if (isItemDeletedInLedger(mergedLedger, 'enginePlans', id, createdMs)) {
      if (lp) deletedCount++;
      continue;
    }
    if (!lp && rp) {
      addedCount++;
      mergedEnginePlans.push(rp);
    } else if (lp && !rp) {
      mergedEnginePlans.push(lp);
    } else if (lp && rp) {
      const rUp = getItemUpsertTimestamp(remote.tombstoneLedger, 'enginePlans', id, parseIsoMs(rp.createdAt));
      const lUp = getItemUpsertTimestamp(local.tombstoneLedger, 'enginePlans', id, parseIsoMs(lp.createdAt));
      mergedEnginePlans.push(mergeEnginePlanPair(lp, rp, rUp >= lUp));
    }
  }
  if (mergedEnginePlans.length !== localEngineList.length) domainsMerged.push('enginePlans');

  // 4. Canonical Memorized Portions
  const localPortionMap = new Map(local.unifiedPortions.map((p) => [p.id, p]));
  const remotePortionMap = new Map(remote.unifiedPortions.map((p) => [p.id, p]));
  const mergedPortions: WirdPortion[] = [];
  const seenCoordinates = new Set<string>();
  for (const id of new Set([...localPortionMap.keys(), ...remotePortionMap.keys()])) {
    if (isItemDeletedInLedger(mergedLedger, 'portions', id)) {
      if (localPortionMap.has(id)) deletedCount++;
      continue;
    }
    const lp = localPortionMap.get(id);
    const rp = remotePortionMap.get(id);
    let chosen: WirdPortion | null = null;
    if (!lp && rp) {
      addedCount++;
      chosen = rp;
    } else if (lp && !rp) {
      chosen = lp;
    } else if (lp && rp) {
      chosen = mergeCanonicalPortionRecords(lp, rp, 'AccountCloudBundleV4.merge');
    }
    if (chosen) {
      const coord = `${chosen.surahNumber}:${chosen.startAyah}:${chosen.endAyah}`;
      if (!seenCoordinates.has(coord)) {
        seenCoordinates.add(coord);
        mergedPortions.push(chosen);
      }
    }
  }
  if (mergedPortions.length !== local.unifiedPortions.length) domainsMerged.push('portions');

  // 5. Weak Verses (anti-resurrection by both ID and coordinate `${surah}:${ayah}`)
  const localWeakByCoord = new Map(
    local.weakVerses.map((w) => [`${w.surahNumber}:${w.ayahNumber}`, w])
  );
  const remoteWeakByCoord = new Map(
    remote.weakVerses.map((w) => [`${w.surahNumber}:${w.ayahNumber}`, w])
  );
  const mergedWeakVerses: WeakVerseItem[] = [];
  for (const coord of new Set([...localWeakByCoord.keys(), ...remoteWeakByCoord.keys()])) {
    const lw = localWeakByCoord.get(coord);
    const rw = remoteWeakByCoord.get(coord);
    const candidateId = rw?.id || lw?.id || `weak-${coord.replace(':', '-')}`;
    if (
      isItemDeletedInLedger(mergedLedger, 'weakVerses', coord) ||
      isItemDeletedInLedger(mergedLedger, 'weakVerses', candidateId)
    ) {
      if (lw) deletedCount++;
      continue;
    }
    if (!lw && rw) {
      addedCount++;
      mergedWeakVerses.push(rw);
    } else if (lw && !rw) {
      mergedWeakVerses.push(lw);
    } else if (lw && rw) {
      const remoteNewer = (rw.lastFailedDate || '') >= (lw.lastFailedDate || '');
      const primary = remoteNewer ? rw : lw;
      mergedWeakVerses.push({
        ...primary,
        id: lw.id || rw.id,
        mistakeCount: Math.max(lw.mistakeCount, rw.mistakeCount),
      });
    }
  }
  if (mergedWeakVerses.length !== local.weakVerses.length) domainsMerged.push('weakVerses');

  // 6. Test Results
  const testMap = new Map<string, TestResult>();
  for (const t of [...local.tests, ...remote.tests]) {
    if (!t?.id || isItemDeletedInLedger(mergedLedger, 'tests', t.id)) continue;
    if (!local.tests.some((lt) => lt.id === t.id) && !testMap.has(t.id)) {
      addedCount++;
    }
    if (!testMap.has(t.id)) {
      testMap.set(t.id, t);
    }
  }
  const mergedTests = [...testMap.values()]
    .sort((a, b) => parseIsoMs(b.date) - parseIsoMs(a.date))
    .slice(0, 50);

  // 7. Daily Activity Logs
  const logByDate = new Map<string, DailyLog>();
  for (const log of local.logs) {
    if (log?.date) {
      logByDate.set(log.date, { ...log, completedTasks: [...(log.completedTasks || [])] });
    }
  }
  for (const rLog of remote.logs) {
    if (!rLog?.date) continue;
    const existing = logByDate.get(rLog.date);
    if (!existing) {
      logByDate.set(rLog.date, { ...rLog, completedTasks: [...(rLog.completedTasks || [])] });
    } else {
      logByDate.set(rLog.date, {
        date: rLog.date,
        memorizedAyahsCount: Math.max(existing.memorizedAyahsCount, rLog.memorizedAyahsCount),
        reviewedPagesCount: Math.max(existing.reviewedPagesCount, rLog.reviewedPagesCount),
        minutesSpent: Math.max(existing.minutesSpent, rLog.minutesSpent),
        completedTasks: [...new Set([...existing.completedTasks, ...(rLog.completedTasks || [])])].slice(0, 50),
      });
    }
  }
  const mergedLogs = [...logByDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-180);

  // 8. Ruqyah Progress (V2 PN-Counter merge)
  let mergedRuqyah: RuqyahProgressSnapshot | null = local.ruqyahProgress ?? remote.ruqyahProgress ?? null;
  if (
    local.ruqyahProgress &&
    remote.ruqyahProgress &&
    isValidRuqyahProgressSnapshotV2(local.ruqyahProgress) &&
    isValidRuqyahProgressSnapshotV2(remote.ruqyahProgress) &&
    areRuqyahLegacyBaselinesCompatible(local.ruqyahProgress, remote.ruqyahProgress)
  ) {
    mergedRuqyah = mergeRuqyahProgressSnapshots(
      local.ruqyahProgress,
      remote.ruqyahProgress,
      Math.max(local.updatedAtMs, remote.updatedAtMs)
    );
  } else if (remote.ruqyahProgress && !local.ruqyahProgress) {
    mergedRuqyah = remote.ruqyahProgress;
  }

  // 9. Auxiliary Worship Domains (Khatmas, Bookmarks, Ribbons, Adhkar, Seerah, Video Series)
  const mergedAuxiliary = mergeAuxiliaryDomainSnapshots(local.auxiliary, remote.auxiliary, mergedLedger);
  if (mergedAuxiliary.pageBookmarks.length !== local.auxiliary.pageBookmarks.length) {
    domainsMerged.push('bookmarks');
  }

  const engineSerializedBytes = byteLengthUtf8(JSON.stringify(mergedEnginePlans));
  const useCompact = engineSerializedBytes > 36_000;
  const effectiveUpdatedAtMs = Math.max(
    local.updatedAtMs,
    remote.updatedAtMs,
    mergedLedger.updatedAtMs,
    Math.trunc(nowMs)
  );

  const merged: AccountCloudBundleV4 = {
    format: 'wird_account_cloud_v4',
    schemaVersion: 4,
    updatedAtMs: effectiveUpdatedAtMs,
    tombstoneLedger: mergedLedger,
    profile: mergedProfile,
    plans: mergedPlans,
    ...(useCompact
      ? { compactEnginePlans: mergedEnginePlans.slice(0, 40).map(compactSingleEnginePlan) }
      : { enginePlans: mergedEnginePlans }),
    unifiedPortions: mergedPortions,
    weakVerses: mergedWeakVerses,
    tests: mergedTests,
    logs: mergedLogs,
    ruqyahProgress: mergedRuqyah,
    auxiliary: mergedAuxiliary,
  };

  return {
    merged,
    stats: {
      addedCount,
      deletedCount,
      domainsMerged,
    },
  };
}

/**
 * Computes a deterministic content fingerprint (ignoring ephemeral `updatedAtMs`)
 * so sync only writes to cloud storage when real user data or tombstones changed.
 */
export function fingerprintAccountCloudBundle(bundle: AccountCloudBundleV4): string {
  const enginePlans = extractBundleEnginePlans(bundle);
  return JSON.stringify({
    tombstones: {
      profileUpdatedAtMs: bundle.tombstoneLedger.profileUpdatedAtMs,
      upsertedAtMs: bundle.tombstoneLedger.upsertedAtMs,
      deletedAtMs: bundle.tombstoneLedger.deletedAtMs,
    },
    profile: bundle.profile,
    plans: bundle.plans,
    enginePlans: enginePlans.map((p) => ({
      id: p.id,
      title: p.title,
      isActive: p.isActive,
      isPaused: p.isPaused,
      completedDays: p.schedule.filter((d) => d.status === 'completed').length,
    })),
    portions: bundle.unifiedPortions,
    weakVerses: bundle.weakVerses,
    tests: bundle.tests,
    logs: bundle.logs,
    ruqyahCounts: bundle.ruqyahProgress?.counts ?? null,
    aux: {
      pageBookmarks: bundle.auxiliary.pageBookmarks,
      ribbons: bundle.auxiliary.ribbons,
      lastPage: bundle.auxiliary.lastPage?.page ?? null,
      readingKhatmasRaw: bundle.auxiliary.readingKhatmasRaw,
      adhkarProgressRaw: bundle.auxiliary.adhkarProgressRaw,
      seerahV2Raw: bundle.auxiliary.seerahV2Raw,
      videoSeriesRaw: bundle.auxiliary.videoSeriesRaw,
    },
  });
}

/**
 * Applies a converged `AccountCloudBundleV4` atomically to local storage + IndexedDB EnginePlan archive,
 * guarded by `withApplyingRemoteSyncGuard` so remote projections never emit spurious local tombstones,
 * then dispatches `wird:cloud-sync-applied` & `wird:auxiliary-sync-applied` for instant React UI re-hydration.
 */
export async function applyAccountCloudBundleToLocal(bundle: AccountCloudBundleV4): Promise<boolean> {
  if (!isValidAccountCloudBundle(bundle)) return false;

  return withApplyingRemoteSyncGuard(async () => {
    const scope = StorageService.getStorageScope();
    const expandedEnginePlans = extractBundleEnginePlans(bundle);

    writeSyncTombstoneLedger(bundle.tombstoneLedger);
    StorageService.saveProfile(bundle.profile);
    StorageService.savePlans(bundle.plans);
    StorageService.saveEnginePlans(expandedEnginePlans);

    if (typeof indexedDB !== 'undefined' && (scope === 'guest' || scope.startsWith('user:'))) {
      try {
        const archiveMeta = await commitEnginePlansArchiveRevision(scope, expandedEnginePlans);
        if (StorageService.getStorageScope() === scope) {
          StorageService.setHydratedEnginePlansSnapshot(
            scope,
            archiveMeta.records,
            archiveMeta.revision,
            archiveMeta.fingerprint
          );
        }
      } catch {
        // Fallback localStorage projection already updated above for <= 100 plans.
      }
    }

    StorageService.saveUnifiedPortions(bundle.unifiedPortions, true, true);
    RetentionService.saveWeakVerses(bundle.weakVerses);
    StorageService.saveTests(bundle.tests);
    StorageService.saveLogs(bundle.logs);
    if (bundle.ruqyahProgress) {
      StorageService.saveRuqyahProgressSnapshot(bundle.ruqyahProgress);
    }
    applyMergedAuxiliaryDomainSnapshot(bundle.auxiliary, (key, value) =>
      StorageService.setRawItem(key, value)
    );

    if (
      typeof window !== 'undefined' &&
      typeof window.dispatchEvent === 'function' &&
      typeof CustomEvent === 'function'
    ) {
      window.dispatchEvent(new CustomEvent('wird:auxiliary-sync-applied'));
      window.dispatchEvent(new CustomEvent('wird:cloud-sync-applied'));
    }
    return true;
  });
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = typeof btoa === 'function' ? btoa(binary) : Buffer.from(bytes).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  if (typeof atob === 'function') {
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      out[i] = binary.charCodeAt(i);
    }
    return out;
  }
  return new Uint8Array(Buffer.from(padded, 'base64'));
}

/**
 * Encodes an `AccountCloudBundleV4` into a compact, copy-pasteable `WIRD4:...` capsule
 * using native gzip compression when available.
 */
export async function encodeCompactSyncCapsule(bundle: AccountCloudBundleV4): Promise<string> {
  const jsonBytes = new TextEncoder().encode(JSON.stringify(bundle));
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new CompressionStream('gzip');
      const writer = cs.writable.getWriter();
      void writer.write(jsonBytes as unknown as BufferSource);
      void writer.close();
      const compressedBuffer = await new Response(cs.readable).arrayBuffer();
      return 'WIRD4Z:' + bytesToBase64Url(new Uint8Array(compressedBuffer));
    } catch {
      // Fallback to raw base64url below
    }
  }
  return 'WIRD4R:' + bytesToBase64Url(jsonBytes);
}

export async function decodeCompactSyncCapsule(capsule: string): Promise<AccountCloudBundleV4> {
  const trimmed = capsule.trim();
  if (!trimmed.startsWith('WIRD4Z:') && !trimmed.startsWith('WIRD4R:')) {
    throw new Error('صيغة كبسولة المزامنة غير معروفة؛ تأكد من نسخ الرمز كاملاً يبدأ بـ WIRD4.');
  }
  const isGzip = trimmed.startsWith('WIRD4Z:');
  const rawBytes = base64UrlToBytes(trimmed.slice(7));
  if (rawBytes.byteLength > 512_000) {
    throw new Error('حجم كبسولة المزامنة يتجاوز الحد الآمن.');
  }

  let jsonText: string;
  if (isGzip) {
    if (typeof DecompressionStream !== 'function') {
      throw new Error('فك ضغط كبسولة المزامنة غير مدعوم في هذه البيئة.');
    }
    const ds = new DecompressionStream('gzip');
    const writer = ds.writable.getWriter();
    void writer.write(rawBytes as unknown as BufferSource);
    void writer.close();
    const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
    if (decompressedBuffer.byteLength > 2_000_000) {
      throw new Error('بيانات الكبسولة بعد فك الضغط تتجاوز الحد المسموح.');
    }
    jsonText = new TextDecoder().decode(decompressedBuffer);
  } else {
    jsonText = new TextDecoder().decode(rawBytes);
  }

  const parsed = JSON.parse(jsonText);
  if (!isValidAccountCloudBundle(parsed)) {
    throw new Error('محتوى كبسولة المزامنة غير صالح أو تالف.');
  }
  return parsed;
}
