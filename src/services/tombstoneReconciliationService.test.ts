import {
  reconcileRecordsWithTombstones,
  reconcileWeakVerseSnapshotsV2,
  isValidCollectionTombstoneV2,
  type CollectionTombstoneRecordV2,
  type RevisionedRecordEnvelope,
  type RevisionedWeakVerseV2,
} from './tombstoneReconciliationService';
import {
  containsUnsafeFullSnapshotProjection,
  isSafeV2ReconcilablePayload,
} from './syncConflictSafety';

export async function runTombstoneReconciliationServiceTests(): Promise<{
  passed: number;
  failed: number;
}> {
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, label: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${label}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${label}`);
      failed++;
    }
  }

  // 1. Tombstone schema validation
  const validTombstone: CollectionTombstoneRecordV2 = {
    schemaVersion: 2,
    collection: 'plans',
    recordId: 'plan-alpha',
    baseRevision: 2,
    deletedAtRevision: 3,
    deletedAtServerSeq: 10,
    deletedByDeviceId: 'device-b',
    deletedAtIso: '2026-11-20T01:00:00.000Z',
  };

  assert(
    isValidCollectionTombstoneV2(validTombstone) &&
      !isValidCollectionTombstoneV2({ ...validTombstone, deletedAtRevision: 1 }),
    'CollectionTombstoneRecordV2 enforces monotonic deletedAtRevision > baseRevision and valid identifiers'
  );

  // 2. Anti-resurrection guard across Client A (offline stale revision 2) and Client B (tombstone at revision 3)
  const clientARecords: RevisionedRecordEnvelope<{ title: string }>[] = [
    {
      recordId: 'plan-alpha',
      baseRevision: 1,
      revision: 2,
      updatedByDeviceId: 'device-a',
      data: { title: 'خطة البقرة (نسخة قديمة دون اتصال)' },
    },
    {
      recordId: 'plan-beta',
      baseRevision: 0,
      revision: 1,
      updatedByDeviceId: 'device-a',
      data: { title: 'خطة جزء عم' },
    },
  ];

  const clientBRecords: RevisionedRecordEnvelope<{ title: string }>[] = [
    {
      recordId: 'plan-gamma',
      baseRevision: 0,
      revision: 1,
      updatedByDeviceId: 'device-b',
      data: { title: 'خطة تبارك' },
    },
  ];

  const antiResurrectionResult = reconcileRecordsWithTombstones({
    collection: 'plans',
    localRecords: clientARecords,
    remoteRecords: clientBRecords,
    localTombstones: [],
    remoteTombstones: [validTombstone],
  });

  assert(
    antiResurrectionResult.activeRecords.length === 2 &&
      antiResurrectionResult.activeRecords.some((r) => r.recordId === 'plan-beta') &&
      antiResurrectionResult.activeRecords.some((r) => r.recordId === 'plan-gamma') &&
      !antiResurrectionResult.activeRecords.some((r) => r.recordId === 'plan-alpha') &&
      antiResurrectionResult.suppressedResurrectionIds.includes('plan-alpha') &&
      antiResurrectionResult.activeTombstones.length === 1 &&
      antiResurrectionResult.conflicts.length === 0,
    'Anti-resurrection prevents an offline device with an older revision from reviving a tombstoned record while merging independent records'
  );

  // 3. Explicit restore at a strictly higher revision supersedes an earlier tombstone
  const restoredRecord: RevisionedRecordEnvelope<{ title: string }> = {
    recordId: 'plan-alpha',
    baseRevision: 3,
    revision: 4,
    updatedByDeviceId: 'device-a',
    explicitRestore: true,
    data: { title: 'خطة البقرة (مستعادة صراحة)' },
  };

  const restoreResult = reconcileRecordsWithTombstones({
    collection: 'plans',
    localRecords: [restoredRecord],
    remoteRecords: [],
    localTombstones: [],
    remoteTombstones: [validTombstone],
  });

  assert(
    restoreResult.activeRecords.length === 1 &&
      restoreResult.activeRecords[0].recordId === 'plan-alpha' &&
      restoreResult.restoredRecordIds.includes('plan-alpha') &&
      restoreResult.activeTombstones.length === 0,
    'Explicit restore at a higher revision supersedes the tombstone and removes it from active tombstones'
  );

  // 4. Concurrent divergent edits on the same record without causal lineage fail closed with explicit conflict
  const concurrentLocal: RevisionedRecordEnvelope<{ pace: number }> = {
    recordId: 'plan-shared',
    baseRevision: 1,
    revision: 2,
    updatedByDeviceId: 'device-a',
    data: { pace: 5 },
  };
  const concurrentRemote: RevisionedRecordEnvelope<{ pace: number }> = {
    recordId: 'plan-shared',
    baseRevision: 1,
    revision: 2,
    updatedByDeviceId: 'device-b',
    data: { pace: 10 },
  };

  const conflictResult = reconcileRecordsWithTombstones({
    collection: 'enginePlans',
    localRecords: [concurrentLocal],
    remoteRecords: [concurrentRemote],
    localTombstones: [],
    remoteTombstones: [],
  });

  assert(
    conflictResult.conflicts.length === 1 &&
      conflictResult.conflicts[0].recordId === 'plan-shared' &&
      conflictResult.conflicts[0].reason === 'concurrent_divergent_edit' &&
      conflictResult.activeRecords.length === 1 &&
      conflictResult.activeRecords[0].data.pace === 5,
    'Concurrent divergent edits at the same base revision produce an explicit conflict record and preserve local data'
  );

  // 5. Convergent Weak-Verse V2 multi-device delta aggregation & anti-resurrection
  const localWeak: RevisionedWeakVerseV2[] = [
    {
      coordinateKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      surahName: 'البقرة',
      ayahText: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
      baseMistakeCount: 1,
      deviceMistakeDeltas: { 'device-a': 2 },
      revision: 2,
      resolvedAtRevision: null,
    },
    {
      coordinateKey: '18:10',
      surahNumber: 18,
      ayahNumber: 10,
      surahName: 'الكهف',
      ayahText: 'إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ',
      baseMistakeCount: 1,
      deviceMistakeDeltas: { 'device-a': 1 },
      revision: 2,
      resolvedAtRevision: null,
    },
  ];

  const remoteWeak: RevisionedWeakVerseV2[] = [
    {
      coordinateKey: '2:255',
      surahNumber: 2,
      ayahNumber: 255,
      surahName: 'البقرة',
      ayahText: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
      baseMistakeCount: 1,
      deviceMistakeDeltas: { 'device-b': 3 },
      revision: 3,
      resolvedAtRevision: null,
    },
    {
      coordinateKey: '18:10',
      surahNumber: 18,
      ayahNumber: 10,
      surahName: 'الكهف',
      ayahText: 'إِذْ أَوَى الْفِتْيَةُ إِلَى الْكَهْفِ',
      baseMistakeCount: 1,
      deviceMistakeDeltas: { 'device-a': 1 },
      revision: 3,
      resolvedAtRevision: 3, // Resolved on Device B at revision 3
    },
  ];

  const weakMerged = reconcileWeakVerseSnapshotsV2(localWeak, remoteWeak);
  assert(
    weakMerged.activeWeakVerses.length === 1 &&
      weakMerged.activeWeakVerses[0].coordinateKey === '2:255' &&
      weakMerged.activeWeakVerses[0].totalMistakeCount === 6 && // 1 base + 2 device-a + 3 device-b
      weakMerged.resolvedCoordinates.includes('18:10'),
    'reconcileWeakVerseSnapshotsV2 converges per-device mistake deltas (1+2+3=6) and suppresses resolved weak verses against older snapshots'
  );

  // 6. V2 reconcilable payload vs V1 full-snapshot conflict safety
  assert(
    containsUnsafeFullSnapshotProjection({ collection: 'weakVerses', payload: { records: [] } }) === true &&
      isSafeV2ReconcilablePayload({
        collection: 'weakVerses',
        payload: { reconciliationSchemaVersion: 2, recordsV2: [] },
      }) === true &&
      isSafeV2ReconcilablePayload({
        collection: 'plans',
        payload: { reconciliationSchemaVersion: 2, recordsV2: [], tombstonesV2: [] },
      }) === true,
    'V2 tombstone and delta payloads are classified as safely reconcilable while legacy V1 full snapshots remain fail-closed'
  );

  return { passed, failed };
}
