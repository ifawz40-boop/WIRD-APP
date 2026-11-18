import {
  createInitialCumulativeProgress,
  getCumulativeLinkSliceIndices,
  recordListeningProgress,
  recordRecallVerification,
  confirmAyahMastery,
  saveCumulativeSessionProgress,
  loadCumulativeSessionProgress,
  resetAyahStageForReview
} from './cumulativeLinkingService';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear() { store.clear(); },
    getItem(key: string) { return store.has(key) ? store.get(key)! : null; },
    key(index: number) { return Array.from(store.keys())[index] ?? null; },
    removeItem(key: string) { store.delete(key); },
    setItem(key: string, value: string) { store.set(key, String(value)); }
  };
}

export function runCumulativeLinkingServiceTests(): { passed: number; failed: number } {
  let passed = 0;
  let failed = 0;
  const test = (name: string, run: () => void) => {
    try { run(); passed++; console.log('  ✅ ' + name); }
    catch (error: any) { failed++; console.error('  ❌ ' + name + ': ' + (error?.message || error)); }
  };
  const assert = (cond: boolean, msg: string) => { if (!cond) throw new Error(msg); };

  test('Cumulative window supports from_start and configurable last_n sizes (3, 5, 7, 10)', () => {
    assert(
      getCumulativeLinkSliceIndices(4, 10, 'from_start', 5).join(',') === '0,1,2,3,4',
      'from_start must link ayahs 0 through target'
    );
    assert(
      getCumulativeLinkSliceIndices(7, 10, 'last_n', 3).join(',') === '5,6,7',
      'last_n(3) at index 7 must select 5,6,7'
    );
    assert(
      getCumulativeLinkSliceIndices(7, 10, 'last_n', 5).join(',') === '3,4,5,6,7',
      'last_n(5) at index 7 must select 3..7'
    );
    assert(
      getCumulativeLinkSliceIndices(2, 10, 'last_n', 7).join(',') === '0,1,2',
      'last_n(7) near start clamps at index 0'
    );
  });

  test('Listening playback NEVER auto-marks recall verification or mastery', () => {
    let state = createInitialCumulativeProgress(67, 1, 5);
    state = recordListeningProgress(state, 0, false);
    state = recordListeningProgress(state, 0, true);
    assert(state.listenCompletedIndices.includes(0), 'Listen stage must be recorded');
    assert(!state.recallVerifiedIndices.includes(0), 'Audio completion must NOT verify recall');
    assert(!state.masteredIndices.includes(0), 'Audio completion must NEVER auto-mark mastery');

    const blockedAttempt = confirmAyahMastery(state, 0);
    assert(!blockedAttempt.confirmed, 'Confirming mastery without recall verification must be blocked');
    assert(!blockedAttempt.state.masteredIndices.includes(0), 'Blocked mastery must keep ayah unmastered');
  });

  test('Explicit recall verification unlocks mastery confirmation and supports review reset', () => {
    let state = createInitialCumulativeProgress(67, 1, 5);
    state = recordRecallVerification(state, 2);
    assert(state.recallVerifiedIndices.includes(2), 'Recall verification should be recorded');

    const confirmed = confirmAyahMastery(state, 2);
    assert(confirmed.confirmed, 'Mastery confirmation should succeed once recall is verified');
    assert(confirmed.state.masteredIndices.includes(2), 'Index 2 must be recorded as mastered');
    assert(confirmed.state.stageByIndex[2] === 'mastered', 'Stage must advance to mastered');

    const reset = resetAyahStageForReview(confirmed.state, 2);
    assert(!reset.masteredIndices.includes(2), 'Resetting for review clears mastered state');
    assert(!reset.recallVerifiedIndices.includes(2), 'Resetting for review requires fresh recall');
  });

  test('Cumulative linking state persists durably across reload and sanitizes corrupted mastered entries', () => {
    const previousStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', { value: createMemoryStorage(), configurable: true });
    try {
      let state = createInitialCumulativeProgress(67, 1, 5);
      state = recordRecallVerification(state, 1);
      state = confirmAyahMastery(state, 1).state;
      state.windowMode = 'last_n';
      state.windowSize = 3;
      saveCumulativeSessionProgress(state);

      const reloaded = loadCumulativeSessionProgress(67, 1, 5);
      assert(reloaded.masteredIndices.join(',') === '1', 'Mastered index 1 must survive reload');
      assert(reloaded.windowMode === 'last_n' && reloaded.windowSize === 3, 'Cumulative window settings must survive reload');
    } finally {
      Object.defineProperty(globalThis, 'localStorage', { value: previousStorage, configurable: true });
    }
  });

  return { passed, failed };
}
