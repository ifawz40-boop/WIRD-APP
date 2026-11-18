import { StorageService } from './storageService';

export type CumulativeWindowMode = 'from_start' | 'last_n';
export type CumulativeWindowSize = 3 | 5 | 7 | 10;
export type AyahMemorizationStage =
  | 'listen_repeat'
  | 'conceal_recall'
  | 'cumulative_bridge'
  | 'connected_loop'
  | 'mastered';

export const CUMULATIVE_WINDOW_SIZES: readonly CumulativeWindowSize[] = [3, 5, 7, 10] as const;

export interface CumulativeSessionProgress {
  version: 1;
  scopeKey: string;
  surahNumber: number;
  startAyah: number;
  endAyah: number;
  currentIndex: number;
  stageByIndex: Record<number, AyahMemorizationStage>;
  listenCompletedIndices: number[];
  recallVerifiedIndices: number[];
  masteredIndices: number[];
  windowMode: CumulativeWindowMode;
  windowSize: CumulativeWindowSize;
  finalSegmentConfirmed: boolean;
  updatedAt: string;
}

const PROGRESS_STORAGE_KEY_PREFIX = 'wird_cumulative_session_v1_';

export function buildCumulativeScopeKey(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): string {
  return `${surahNumber}:${startAyah}:${endAyah}`;
}

export function normalizeCumulativeWindowSize(value: unknown): CumulativeWindowSize {
  const num = typeof value === 'number' ? value : Number(value);
  return (CUMULATIVE_WINDOW_SIZES as readonly number[]).includes(num)
    ? (num as CumulativeWindowSize)
    : 5;
}

export function createInitialCumulativeProgress(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): CumulativeSessionProgress {
  return {
    version: 1,
    scopeKey: buildCumulativeScopeKey(surahNumber, startAyah, endAyah),
    surahNumber,
    startAyah,
    endAyah,
    currentIndex: 0,
    stageByIndex: { 0: 'listen_repeat' },
    listenCompletedIndices: [],
    recallVerifiedIndices: [],
    masteredIndices: [],
    windowMode: 'from_start',
    windowSize: 5,
    finalSegmentConfirmed: false,
    updatedAt: new Date().toISOString()
  };
}

export function getCumulativeLinkSliceStart(
  targetIndex: number,
  windowMode: CumulativeWindowMode,
  windowSize: CumulativeWindowSize = 5
): number {
  const safeTarget = Math.max(0, Math.trunc(targetIndex));
  if (windowMode === 'from_start') return 0;
  const normalizedSize = normalizeCumulativeWindowSize(windowSize);
  return Math.max(0, safeTarget - normalizedSize + 1);
}

export function getCumulativeLinkSliceIndices(
  targetIndex: number,
  totalAyahs: number,
  windowMode: CumulativeWindowMode,
  windowSize: CumulativeWindowSize = 5
): number[] {
  if (totalAyahs <= 0) return [];
  const boundedTarget = Math.min(Math.max(0, Math.trunc(targetIndex)), totalAyahs - 1);
  const start = getCumulativeLinkSliceStart(boundedTarget, windowMode, windowSize);
  const result: number[] = [];
  for (let i = start; i <= boundedTarget; i++) {
    result.push(i);
  }
  return result;
}

function addUniqueSortedIndex(list: number[], index: number): number[] {
  if (list.includes(index)) return list;
  return [...list, index].sort((a, b) => a - b);
}

/**
 * Audio playback (single ayah or cumulative bridge) advances the acoustic familiarity
 * stage ONLY and strictly NEVER verifies recall or auto-marks an ayah as mastered.
 */
export function recordListeningProgress(
  state: CumulativeSessionProgress,
  index: number,
  isCumulativeBridge = false
): CumulativeSessionProgress {
  const existingStage = state.stageByIndex[index] || 'listen_repeat';
  const nextStage: AyahMemorizationStage = existingStage === 'mastered'
    ? 'mastered'
    : isCumulativeBridge && state.recallVerifiedIndices.includes(index)
      ? 'connected_loop'
      : existingStage === 'listen_repeat'
        ? 'conceal_recall'
        : existingStage;

  return {
    ...state,
    listenCompletedIndices: addUniqueSortedIndex(state.listenCompletedIndices, index),
    stageByIndex: {
      ...state.stageByIndex,
      [index]: nextStage
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Explicit learner recall check (e.g. completing masked/blank recall check or explicit
 * confirmation that the learner recited from memory cleanly).
 */
export function recordRecallVerification(
  state: CumulativeSessionProgress,
  index: number
): CumulativeSessionProgress {
  const existingStage = state.stageByIndex[index] || 'listen_repeat';
  const nextStage: AyahMemorizationStage = existingStage === 'mastered'
    ? 'mastered'
    : index > 0
      ? 'cumulative_bridge'
      : 'connected_loop';

  return {
    ...state,
    recallVerifiedIndices: addUniqueSortedIndex(state.recallVerifiedIndices, index),
    stageByIndex: {
      ...state.stageByIndex,
      [index]: nextStage
    },
    updatedAt: new Date().toISOString()
  };
}

/**
 * Final mastery confirmation MUST require prior explicit recall verification
 * (`recallVerifiedIndices`). Never permit skipping recall verification via audio/next.
 */
export function confirmAyahMastery(
  state: CumulativeSessionProgress,
  index: number
): { state: CumulativeSessionProgress; confirmed: boolean; reasonAr?: string } {
  if (!state.recallVerifiedIndices.includes(index)) {
    return {
      state,
      confirmed: false,
      reasonAr: 'يرجى التحقق من الاسترجاع بدون نظر أولاً قبل تثبيت إتقان هذه الآية.'
    };
  }
  return {
    confirmed: true,
    state: {
      ...state,
      masteredIndices: addUniqueSortedIndex(state.masteredIndices, index),
      stageByIndex: {
        ...state.stageByIndex,
        [index]: 'mastered'
      },
      updatedAt: new Date().toISOString()
    }
  };
}

export function confirmFinalSegmentMastery(
  state: CumulativeSessionProgress
): CumulativeSessionProgress {
  return {
    ...state,
    finalSegmentConfirmed: true,
    updatedAt: new Date().toISOString()
  };
}

export function resetAyahStageForReview(
  state: CumulativeSessionProgress,
  index: number
): CumulativeSessionProgress {
  return {
    ...state,
    masteredIndices: state.masteredIndices.filter(i => i !== index),
    recallVerifiedIndices: state.recallVerifiedIndices.filter(i => i !== index),
    stageByIndex: {
      ...state.stageByIndex,
      [index]: 'conceal_recall'
    },
    finalSegmentConfirmed: false,
    updatedAt: new Date().toISOString()
  };
}

function getStorageKey(scopeKey: string): string {
  const scope = StorageService.getStorageScope() || 'guest';
  return `${PROGRESS_STORAGE_KEY_PREFIX}${scope}:${scopeKey}`;
}

export function loadCumulativeSessionProgress(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): CumulativeSessionProgress {
  const fallback = createInitialCumulativeProgress(surahNumber, startAyah, endAyah);
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(getStorageKey(fallback.scopeKey));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<CumulativeSessionProgress>;
    if (!parsed || parsed.scopeKey !== fallback.scopeKey) return fallback;
    const total = Math.max(1, endAyah - startAyah + 1);
    const validIndex = (i: unknown): i is number =>
      typeof i === 'number' && Number.isInteger(i) && i >= 0 && i < total;

    const recallVerifiedIndices = Array.isArray(parsed.recallVerifiedIndices)
      ? Array.from(new Set(parsed.recallVerifiedIndices.filter(validIndex))).sort((a, b) => a - b)
      : [];
    const recallSet = new Set(recallVerifiedIndices);
    const masteredIndices = Array.isArray(parsed.masteredIndices)
      ? Array.from(new Set(parsed.masteredIndices.filter(i => validIndex(i) && recallSet.has(i)))).sort((a, b) => a - b)
      : [];
    const listenCompletedIndices = Array.isArray(parsed.listenCompletedIndices)
      ? Array.from(new Set(parsed.listenCompletedIndices.filter(validIndex))).sort((a, b) => a - b)
      : [];

    const stageByIndex: Record<number, AyahMemorizationStage> = {};
    if (parsed.stageByIndex && typeof parsed.stageByIndex === 'object') {
      for (const [k, v] of Object.entries(parsed.stageByIndex)) {
        const idx = Number(k);
        if (
          validIndex(idx) &&
          (v === 'listen_repeat' || v === 'conceal_recall' || v === 'cumulative_bridge' || v === 'connected_loop' || v === 'mastered')
        ) {
          stageByIndex[idx] = v === 'mastered' && !recallSet.has(idx) ? 'conceal_recall' : v;
        }
      }
    }

    return {
      version: 1,
      scopeKey: fallback.scopeKey,
      surahNumber,
      startAyah,
      endAyah,
      currentIndex: validIndex(parsed.currentIndex) ? parsed.currentIndex : 0,
      stageByIndex,
      listenCompletedIndices,
      recallVerifiedIndices,
      masteredIndices,
      windowMode: parsed.windowMode === 'last_n' ? 'last_n' : 'from_start',
      windowSize: normalizeCumulativeWindowSize(parsed.windowSize),
      finalSegmentConfirmed: Boolean(parsed.finalSegmentConfirmed),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : fallback.updatedAt
    };
  } catch {
    return fallback;
  }
}

export function saveCumulativeSessionProgress(state: CumulativeSessionProgress): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getStorageKey(state.scopeKey), JSON.stringify(state));
  } catch {
    // Graceful no-op if quota or private browsing blocks storage
  }
}

export type SessionStudyMethod = 'free' | 'cumulative_linking';
const STUDY_METHOD_KEY_PREFIX = 'wird_study_method_v1_';

function getStudyMethodKey(surahNumber: number, startAyah: number, endAyah: number): string {
  const scope = StorageService.getStorageScope() || 'guest';
  return `${STUDY_METHOD_KEY_PREFIX}${scope}:${buildCumulativeScopeKey(surahNumber, startAyah, endAyah)}`;
}

export function getSavedStudyMethod(
  surahNumber: number,
  startAyah: number,
  endAyah: number
): SessionStudyMethod {
  if (typeof localStorage !== 'undefined') {
    try {
      const saved = localStorage.getItem(getStudyMethodKey(surahNumber, startAyah, endAyah));
      if (saved === 'cumulative_linking' || saved === 'free') {
        return saved;
      }
    } catch {
      // Fall through to progress inspection
    }
  }
  const progress = loadCumulativeSessionProgress(surahNumber, startAyah, endAyah);
  if (progress.masteredIndices.length > 0 || progress.recallVerifiedIndices.length > 0) {
    return 'cumulative_linking';
  }
  return 'free';
}

export function saveStudyMethod(
  surahNumber: number,
  startAyah: number,
  endAyah: number,
  method: SessionStudyMethod
): SessionStudyMethod {
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(getStudyMethodKey(surahNumber, startAyah, endAyah), method);
    } catch {
      // Ignore storage quota errors
    }
  }
  return method;
}

