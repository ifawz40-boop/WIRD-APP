import {
  applyAccountCloudBundleToLocal,
  captureAccountCloudBundle,
  compactSingleEnginePlan,
  decodeCompactSyncCapsule,
  encodeCompactSyncCapsule,
  expandCompactEnginePlan,
  fitBundleForFirestoreVault,
  mergeAccountCloudBundles,
  type AccountCloudBundleV4,
} from '../services/accountCloudBundleService';
import { IndexedDbSyncJournal } from '../services/indexedDbSyncJournal';
import { IDBFactory } from 'fake-indexeddb';
import {
  mergeInstantSyncCapsule,
  mergeSmartCloudVaultJson,
  syncWithGoogleDrivePersonalCloud,
} from '../services/personalCloudSyncService';
import { StorageService, buildDemoEnginePlan } from '../services/storageService';
import { RetentionService } from '../services/retentionService';
import {
  createReadingKhatma,
  deleteReadingKhatmaById,
  markReadingPagesRange,
  readAllReadingKhatmas,
  unmarkReadingPages,
} from '../services/readingKhatmaService';
import { placeMushafRibbon, readMushafRibbons } from '../services/mushafRibbonBookmarksService';
import {
  readAdhkarProgressStore,
  toggleAdhkarFavorite,
} from '../services/adhkarProgressService';
import { ADHKAR_ITEMS } from '../data/adhkarData';
import {
  readSeerahProgress,
  setSeerahChapterReadState,
} from '../services/seerahBookService';
import {
  addCustomSeries,
  readVideoSeriesStore,
  removeCustomSeries,
} from '../services/videoSeriesService';
import {
  recordSyncDeletion,
  recordSyncUpsert,
} from '../services/syncTombstoneRegistry';
import type { MemorizationPlan } from '../types/quran';
import type { SuiteResult } from './runAllTests';

function cloneBundle(bundle: AccountCloudBundleV4): AccountCloudBundleV4 {
  return JSON.parse(JSON.stringify(bundle)) as AccountCloudBundleV4;
}

function makePresetPlan(id: string, title: string, isActive = false): MemorizationPlan {
  return {
    id,
    title,
    description: 'خطة اختبار المزامنة السحابية',
    type: 'juz',
    targetJuz: [30],
    unitType: 'ayah',
    dailyTarget: 5,
    memorizationDaysPerWeek: 5,
    revisionDaysPerWeek: 2,
    totalUnits: 30,
    completedUnits: 3,
    startDate: '2026-11-01',
    targetEndDate: '2026-12-01',
    isActive,
  };
}

export async function runCloudSyncAdditionsAndDeletionsTests(): Promise<SuiteResult> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.error(`  ❌ ${message}`);
      failed++;
    }
  }

  // Ensure localStorage shim exists in pure Node test runner if needed
  const hadLocalStorage = typeof globalThis.localStorage !== 'undefined';
  const backingMap = new Map<string, string>();
  if (!hadLocalStorage) {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (k: string) => backingMap.get(k) ?? null,
        setItem: (k: string, v: string) => {
          backingMap.set(k, String(v));
        },
        removeItem: (k: string) => {
          backingMap.delete(k);
        },
        clear: () => backingMap.clear(),
        key: (idx: number) => [...backingMap.keys()][idx] ?? null,
        get length() {
          return backingMap.size;
        },
      },
    });
  }

  try {
    // =========================================================================
    // 1. Multi-Device Plans & EnginePlans: Concurrent Additions + Anti-Resurrection Deletions
    // =========================================================================
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-device-a');

    const sharedPlan = makePresetPlan('plan-shared', 'خطة مشتركة للحذف', true);
    const sharedEngine = buildDemoEnginePlan();
    sharedEngine.id = 'eng-shared';
    sharedEngine.title = 'خطة ذكية مشتركة للحذف';

    StorageService.savePlans([sharedPlan]);
    StorageService.saveEnginePlans([sharedEngine]);
    const baselineBundle = cloneBundle(captureAccountCloudBundle(1000));

    // Device A deletes sharedPlan + sharedEngine, and adds planA + engA
    const planA = makePresetPlan('plan-a', 'خطة الجهاز الأول', true);
    const engA = buildDemoEnginePlan();
    engA.id = 'eng-a';
    engA.title = 'خطة ذكية من الجهاز الأول';
    StorageService.savePlans([planA]);
    StorageService.saveEnginePlans([engA]);
    const bundleA = cloneBundle(captureAccountCloudBundle(2000));

    // Simulate Device B starting from baselineBundle, keeping shared items and adding planB + engB
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-device-b');
    await applyAccountCloudBundleToLocal(baselineBundle);

    const planB = makePresetPlan('plan-b', 'خطة الجهاز الثاني', false);
    const engB = buildDemoEnginePlan();
    engB.id = 'eng-b';
    engB.title = 'خطة ذكية من الجهاز الثاني';
    StorageService.savePlans([sharedPlan, planB]);
    StorageService.saveEnginePlans([sharedEngine, engB]);
    const bundleB = cloneBundle(captureAccountCloudBundle(2100));

    // Merge A & B in both directions (commutativity check!)
    const mergeAB = mergeAccountCloudBundles(bundleB, bundleA, 3000);
    const mergeBA = mergeAccountCloudBundles(bundleA, bundleB, 3000);

    const mergedPlanIdsAB = mergeAB.merged.plans.map((p) => p.id).sort();
    const mergedPlanIdsBA = mergeBA.merged.plans.map((p) => p.id).sort();
    assert(
      JSON.stringify(mergedPlanIdsAB) === JSON.stringify(['plan-a', 'plan-b']) &&
        JSON.stringify(mergedPlanIdsBA) === JSON.stringify(['plan-a', 'plan-b']),
      'Concurrent preset plan addition + deletion keeps both new plans and prevents resurrection of deleted plan'
    );

    const mergedEngIds = (mergeAB.merged.enginePlans || []).map((p) => p.id).sort();
    assert(
      JSON.stringify(mergedEngIds) === JSON.stringify(['eng-a', 'eng-b']),
      'Concurrent smart engine plan addition + deletion keeps both new plans and suppresses deleted engine plan'
    );

    await applyAccountCloudBundleToLocal(mergeAB.merged);
    assert(
      StorageService.getPlans().length === 2 && StorageService.getEnginePlans().length === 2,
      'Applying converged V4 bundle updates Device B storage cleanly with additions and deletions'
    );

    // =========================================================================
    // 2. Reading Khatmas: Add, Unmark Pages, and Delete Last Khatma Without Resurrection
    // =========================================================================
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-khatma');

    const khatma = createReadingKhatma({ title: 'ختمة رمضان', durationDays: 30, sessionsPerDay: 2 });
    markReadingPagesRange([1, 2, 3, 4], khatma.id);
    const snapAfterMark = cloneBundle(captureAccountCloudBundle(4000));

    // Unmark pages 3 & 4, mark page 5
    unmarkReadingPages([3, 4], khatma.id);
    markReadingPagesRange([5], khatma.id);
    const snapAfterUnmark = cloneBundle(captureAccountCloudBundle(5000));

    // Merge stale snapAfterMark (which still has [1, 2, 3, 4]) into snapAfterUnmark
    const mergedPagesCheck = mergeAccountCloudBundles(snapAfterMark, snapAfterUnmark, 5500);
    await applyAccountCloudBundleToLocal(mergedPagesCheck.merged);
    const activeAfterUnmark = readAllReadingKhatmas().activeKhatma;
    assert(
      Boolean(activeAfterUnmark) &&
        JSON.stringify(activeAfterUnmark!.completedPages) === JSON.stringify([1, 2, 5]),
      'Unmarked Reading Khatma pages [3, 4] are never resurrected by a stale cloud snapshot while page [5] is kept'
    );

    // Now delete the ONLY Khatma and verify stale snapshot does not resurrect it
    deleteReadingKhatmaById(khatma.id);
    const snapAfterKhatmaDelete = cloneBundle(captureAccountCloudBundle(6000));
    const mergedKhatmaDelete = mergeAccountCloudBundles(snapAfterMark, snapAfterKhatmaDelete, 6500);
    await applyAccountCloudBundleToLocal(mergedKhatmaDelete.merged);
    assert(
      readAllReadingKhatmas().khatmas.length === 0,
      'Deleting the last Reading Khatma propagates deletion across devices without resurrection'
    );

    // =========================================================================
    // 3. Bookmarks, Ribbons, Adhkar Favorites, Seerah Chapters, Video Series + Explicit Re-Add
    // =========================================================================
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-aux');

    // Add items across all auxiliary domains
    StorageService.setRawItem('wird.quran.pageBookmarks.v1', JSON.stringify([10, 20, 30]));
    recordSyncUpsert('pageBookmarks', '10', 1000);
    recordSyncUpsert('pageBookmarks', '20', 1000);
    recordSyncUpsert('pageBookmarks', '30', 1000);
    placeMushafRibbon('hifz', 50, 'موضع الحفظ');

    const firstDhikrId = ADHKAR_ITEMS[0].id;
    toggleAdhkarFavorite(firstDhikrId);
    setSeerahChapterReadState('ch-01', true);
    setSeerahChapterReadState('ch-02', true);
    const addedSeries = addCustomSeries({
      playlistId: 'PL1234567890ABCDEF',
      title: 'سلسلة تجريبية للمزامنة',
      speaker: 'الشيخ التجريبي',
      videos: [{ videoId: 'dQw4w9WgXcQ', title: 'الدرس الأول', durationText: '15:00' }],
    });
    assert(addedSeries.ok === true, 'Custom video series added on Device A');

    const fullAuxSnap = cloneBundle(captureAccountCloudBundle(7000));

    // Delete/unmark one item from each domain
    StorageService.setRawItem('wird.quran.pageBookmarks.v1', JSON.stringify([10, 30]));
    recordSyncDeletion('pageBookmarks', '20', 8000);
    placeMushafRibbon('hifz', null);
    toggleAdhkarFavorite(firstDhikrId); // removes favorite
    setSeerahChapterReadState('ch-01', false); // unmarks ch-01
    if (addedSeries.ok) {
      removeCustomSeries(addedSeries.series.id);
    }

    const afterDeletesSnap = cloneBundle(captureAccountCloudBundle(8500));
    const convergedAux = mergeAccountCloudBundles(fullAuxSnap, afterDeletesSnap, 9000);
    await applyAccountCloudBundleToLocal(convergedAux.merged);

    assert(
      JSON.stringify(convergedAux.merged.auxiliary.pageBookmarks) === JSON.stringify([10, 30]),
      'Deleted Mushaf bookmark (page 20) stays deleted while bookmarks [10, 30] remain'
    );
    assert(
      readMushafRibbons().find((r) => r.id === 'hifz')?.page === null,
      'Cleared Mushaf silk ribbon stays cleared across cloud merge'
    );
    assert(
      !readAdhkarProgressStore().favoriteIds.includes(firstDhikrId),
      'Removed Adhkar favorite is not resurrected by stale snapshot'
    );
    assert(
      JSON.stringify(readSeerahProgress().completedChapterIds) === JSON.stringify(['ch-02']),
      'Unmarked Seerah chapter (ch-01) stays unmarked while ch-02 remains completed'
    );
    assert(
      readVideoSeriesStore().customSeries.length === 0,
      'Removed custom YouTube video series stays deleted across cloud merge'
    );

    // Explicit causal re-add after deletion (HLC restore check!)
    StorageService.setRawItem('wird.quran.pageBookmarks.v1', JSON.stringify([10, 20, 30]));
    recordSyncUpsert('pageBookmarks', '20', 7500); // Even if wall clock is slightly behind 8000, HLC bumps > 8000!
    setSeerahChapterReadState('ch-01', true);
    const reAddedSnap = cloneBundle(captureAccountCloudBundle(9500));
    const mergedRestore = mergeAccountCloudBundles(afterDeletesSnap, reAddedSnap, 9600);
    assert(
      mergedRestore.merged.auxiliary.pageBookmarks.includes(20) &&
        JSON.stringify(JSON.parse(mergedRestore.merged.auxiliary.seerahV2Raw || '{}').completedChapterIds) ===
          JSON.stringify(['ch-01', 'ch-02']),
      'Explicitly re-adding a previously deleted bookmark or Seerah chapter cleanly restores it even under clock skew'
    );

    // =========================================================================
    // 4. Weak Verses Resolution & Memorized Portions Deletion Anti-Resurrection
    // =========================================================================
    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-portions');

    const addedP1 = RetentionService.buildAddPortionSnapshot({
      type: 'passage',
      surahNumber: 67,
      surahName: 'الملك',
      startAyah: 1,
      endAyah: 10,
      pageNumber: 562,
      juzNumber: 29,
      status: 'stable',
      lastReviewedDate: '2026-11-20',
      nextDueDate: '2026-12-01',
      intervalDays: 10,
      easeFactor: 2.5,
      repetitionCount: 4,
      mistakesCount: 0,
    });
    const addedP2 = RetentionService.buildAddPortionSnapshot(
      {
        type: 'passage',
        surahNumber: 78,
        surahName: 'النبأ',
        startAyah: 1,
        endAyah: 15,
        pageNumber: 582,
        juzNumber: 30,
        status: 'recently_memorized',
        lastReviewedDate: '2026-11-20',
        nextDueDate: '2026-11-25',
        intervalDays: 5,
        easeFactor: 2.5,
        repetitionCount: 2,
        mistakesCount: 0,
      },
      addedP1.portions
    );
    StorageService.saveUnifiedPortions(addedP2.portions, true, true);
    RetentionService.saveWeakVerses([
      {
        id: 'weak-67-8',
        surahNumber: 67,
        surahName: 'الملك',
        ayahNumber: 8,
        text: 'تَكَادُ تَمَيَّزُ مِنَ الْغَيْظِ',
        mistakeCount: 2,
        lastFailedDate: '2026-11-20',
      },
    ]);
    const snapBeforeResolve = cloneBundle(captureAccountCloudBundle(10_000));

    // Resolve weak verse 67:8 and remove portion 78:1-15
    RetentionService.saveWeakVerses([]);
    StorageService.saveUnifiedPortions([addedP1.record], true, true);
    const snapAfterResolve = cloneBundle(captureAccountCloudBundle(11_000));

    const mergedPortionsWeak = mergeAccountCloudBundles(snapBeforeResolve, snapAfterResolve, 12_000);
    assert(
      mergedPortionsWeak.merged.weakVerses.length === 0 &&
        mergedPortionsWeak.merged.unifiedPortions.length === 1 &&
        mergedPortionsWeak.merged.unifiedPortions[0].surahNumber === 67,
      'Resolved weak verse and deleted memorized portion stay deleted and never resurrect from stale snapshot'
    );

    // =========================================================================
    // 5. Lossless Compact EnginePlan Codec + Compressed Sync Capsule (WIRD4) + Smart File Merge
    // =========================================================================
    const fullPlan = buildDemoEnginePlan();
    fullPlan.id = 'compact-test-plan';
    if (fullPlan.schedule[1]?.memorizationTask) {
      fullPlan.schedule[1].memorizationTask.completed = true;
      fullPlan.schedule[1].status = 'completed';
    }
    const compacted = compactSingleEnginePlan(fullPlan);
    const expanded = expandCompactEnginePlan(compacted);
    assert(
      Boolean(expanded) &&
        expanded!.id === 'compact-test-plan' &&
        expanded!.schedule[0]?.status === 'completed' &&
        expanded!.schedule[1]?.status === 'completed',
      'Compact EnginePlan V4 codec preserves completed schedule days losslessly'
    );

    const capsuleCode = await encodeCompactSyncCapsule(mergedPortionsWeak.merged);
    assert(capsuleCode.startsWith('WIRD4'), 'Sync capsule encodes with WIRD4 prefix');
    const decodedCapsule = await decodeCompactSyncCapsule(capsuleCode);
    assert(
      decodedCapsule.unifiedPortions.length === 1 && decodedCapsule.weakVerses.length === 0,
      'Sync capsule decodes losslessly with portions and tombstones intact'
    );

    StorageService.__resetStorageForTests();
    StorageService.setStorageScope('user:sync-v4-capsule-receiver');
    const capsuleApplyResult = await mergeInstantSyncCapsule(capsuleCode);
    assert(
      capsuleApplyResult.success && StorageService.getUnifiedPortions().length === 1,
      'mergeInstantSyncCapsule applies additions and deletions on a second device'
    );

    const smartFileRes = await mergeSmartCloudVaultJson(JSON.stringify(bundleA));
    assert(
      smartFileRes.success && StorageService.getPlans().some((p) => p.id === 'plan-a'),
      'mergeSmartCloudVaultJson merges cloud file additions and tombstones non-destructively'
    );

    // =========================================================================
    // 6. Personal Google Drive AppData Cloud Sync (Mocked GIS + Drive v3 REST API)
    // =========================================================================
    const prevWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const prevFetch = globalThis.fetch;
    try {
      const remoteVaultOnDrive = cloneBundle(bundleA);
      let uploadedDrivePayload: string | null = null;

      const mockWindow = Object.assign(new EventTarget(), {
        google: {
          accounts: {
            oauth2: {
              initTokenClient: (cfg: any) => ({
                requestAccessToken: () => {
                  cfg.callback({ access_token: 'mock-drive-token', expires_in: 3600 });
                },
              }),
            },
          },
        },
      });
      Object.defineProperty(globalThis, 'window', { configurable: true, value: mockWindow });

      globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.includes('googleapis.com/drive/v3/files?spaces=appDataFolder')) {
          return new Response(
            JSON.stringify({ files: [{ id: 'drive-vault-file-1', name: 'wird-account-vault-v4.json' }] }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.includes('googleapis.com/drive/v3/files/drive-vault-file-1?alt=media')) {
          return new Response(JSON.stringify(remoteVaultOnDrive), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('googleapis.com/upload/drive/v3/files/drive-vault-file-1')) {
          uploadedDrivePayload = String(init?.body || '');
          return new Response(JSON.stringify({ id: 'drive-vault-file-1' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('Not found', { status: 404 });
      }) as typeof fetch;

      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:sync-v4-gdrive');
      await applyAccountCloudBundleToLocal(bundleB); // Device has sharedPlan + planB

      const driveSyncRes = await syncWithGoogleDrivePersonalCloud({ interactive: true });
      const plansAfterDriveSync = StorageService.getPlans().map((p) => p.id).sort();
      const parsedUploaded = uploadedDrivePayload ? JSON.parse(uploadedDrivePayload) : null;

      assert(
        driveSyncRes.success &&
          JSON.stringify(plansAfterDriveSync) === JSON.stringify(['plan-a', 'plan-b']) &&
          Array.isArray(parsedUploaded?.plans) &&
          parsedUploaded.plans.length === 2,
        'Google Drive AppData Personal Cloud sync merges remote additions + deletions and uploads converged vault'
      );
    } finally {
      globalThis.fetch = prevFetch;
      if (prevWindow) Object.defineProperty(globalThis, 'window', prevWindow);
      else Reflect.deleteProperty(globalThis, 'window');
    }

    // =========================================================================
    // 7. Self-Healing Stuck Outbox Backoff, Oversize EnginePlans, Blocked Inbox & Open Conflicts
    // =========================================================================
    {
      StorageService.__resetStorageForTests();
      StorageService.setStorageScope('user:sync-v4-stuck-heal');
      const journal = new IndexedDbSyncJournal({
        indexedDBFactory: new IDBFactory(),
        databaseName: 'wird-sync-v4-stuck-heal-test',
      });

      // 7a. Enqueue two mutations (including a large EnginePlan snapshot) and simulate exponential backoff
      const bigPlan = buildDemoEnginePlan();
      const q1 = await journal.enqueue({
        mutationId: 'stuck-plans-conflict-1',
        collection: 'plans',
        documentId: 'snapshot',
        payload: { records: [{ id: 'p-1' }] },
        nowMs: 1_000,
      });
      const q2 = await journal.enqueue({
        mutationId: 'stuck-oversize-engine-2',
        collection: 'enginePlans',
        documentId: 'snapshot',
        payload: { records: [bigPlan] },
        nowMs: 1_010,
      });
      assert(
        q1.status === 'queued' && q2.status === 'queued',
        'Outbox enqueues conflict and enginePlans mutations cleanly'
      );

      // Simulate 8 prior failures pushing nextAttemptAtMs ~256s into the future
      for (let i = 0; i < 8; i++) {
        await journal.markFailed('stuck-plans-conflict-1', 'REMOTE_REVISION_CONFLICT', 2_000);
        await journal.markFailed('stuck-oversize-engine-2', 'INVALID_REVISIONED_MUTATION', 2_000);
      }
      const readyBeforeWake = await journal.listReady(5_000, 25);
      assert(
        readyBeforeWake.length === 0 && (await journal.getSnapshot()).pendingCount === 2,
        'Backoff-frozen mutations hide from listReady while keeping pendingCount = 2'
      );

      const wokenCount = await journal.resetPendingBackoff(5_000);
      const readyAfterWake = await journal.listReady(5_000, 25);
      assert(
        wokenCount === 2 && readyAfterWake.length === 2,
        'resetPendingBackoff wakes all backoff-delayed outbox mutations immediately'
      );

      // 7b. Import remote events and archive an open unsafe weakVerses conflict + prepared intent
      await journal.importRemotePage([
        {
          uid: 'sync-v4-stuck-heal',
          eventId: 'remote-evt-weak-1',
          mutationId: 'remote-evt-weak-1',
          eventType: 'domain-mutation',
          collection: 'weakVerses',
          documentId: 'snapshot',
          operation: 'upsert',
          schemaVersion: 2,
          deviceId: 'other-device',
          occurredAtMs: 3_000,
          payload: { records: [{ id: 'w-1', surahNumber: 67, ayahNumber: 2 }] },
          baseRevision: 0,
          revision: 1,
          serverSequence: 1,
        },
        {
          uid: 'sync-v4-stuck-heal',
          eventId: 'remote-evt-plans-2',
          mutationId: 'remote-evt-plans-2',
          eventType: 'domain-mutation',
          collection: 'plans',
          documentId: 'snapshot',
          operation: 'upsert',
          schemaVersion: 2,
          deviceId: 'other-device',
          occurredAtMs: 3_100,
          payload: { records: [{ id: 'p-remote' }] },
          baseRevision: 0,
          revision: 1,
          serverSequence: 2,
        },
      ]);

      const inboxBefore = await journal.listRemoteInboxAfter(0, 10);
      await journal.saveProjectionConflict(
        inboxBefore[0],
        'blocked_base_revision',
        { weakVerses: '[{"id":"w-local"}]' },
        3_200
      );
      assert(
        (await journal.getProjectionConflictCount()) === 1 &&
          (await journal.getRemoteCursor()) === 2 &&
          (await journal.getRemoteProjectionCursor()) === 0,
        'Blocked inbox event creates open conflict and leaves projection cursor at 0'
      );

      // 7c. Verify fitBundleForFirestoreVault keeps Vault V4 strictly < 120 KB
      const rawBundle = captureAccountCloudBundle(6_000);
      const fittedBundle = fitBundleForFirestoreVault({
        ...rawBundle,
        enginePlans: [bigPlan, { ...bigPlan, id: 'big-2' }, { ...bigPlan, id: 'big-3' }],
      });
      const fittedBytes = new TextEncoder().encode(
        JSON.stringify({ vaultBundle: fittedBundle })
      ).byteLength;
      assert(
        fittedBytes < 120_000 && fittedBundle.auxiliary.tombstoneLedger === undefined,
        `fitBundleForFirestoreVault keeps Firestore Vault V4 payload under 120 KB (${fittedBytes} bytes)`
      );

      // 7d. Reconcile converged state atomically once Vault V4 is durably persisted on Firestore
      const recRes = await journal.reconcileVaultConvergedState({
        supersededMutations: [
          { mutationId: 'stuck-plans-conflict-1', resolvedRevision: 3 },
          { mutationId: 'stuck-oversize-engine-2' },
        ],
        advanceInboxToCursor: true,
        resolveOpenConflicts: true,
        nowMs: 7_000,
      });

      const snapAfter = await journal.getSnapshot();
      const projCursorAfter = await journal.getRemoteProjectionCursor();
      const openConflictsAfter = await journal.getProjectionConflictCount();
      const learnedPlansRev = await journal.getRemoteRevision('plans', 'snapshot');
      const learnedWeakRev = await journal.getRemoteRevision('weakVerses', 'snapshot');

      assert(
        recRes.acknowledgedCount === 2 &&
          recRes.inboxAdvancedCount === 2 &&
          recRes.resolvedConflictCount === 1 &&
          snapAfter.pendingCount === 0 &&
          snapAfter.acknowledgedCount === 2 &&
          projCursorAfter === 2 &&
          openConflictsAfter === 0 &&
          learnedPlansRev?.revision === 3 &&
          learnedWeakRev?.revision === 1,
        'reconcileVaultConvergedState atomically clears stuck outbox, advances blocked inbox cursor, and closes open conflicts'
      );

      journal.close();
    }
  } catch (error: any) {
    assert(false, `Cloud Sync V4 additions & deletions test threw unexpectedly: ${error?.message || error}`);
  } finally {
    StorageService.__resetStorageForTests();
    if (!hadLocalStorage) {
      Reflect.deleteProperty(globalThis, 'localStorage');
    }
  }

  return { passed, failed };
}
