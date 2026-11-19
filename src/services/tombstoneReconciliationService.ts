import { QuranMath } from './quranMath';

export type TombstoneSupportedCollection =
  | 'plans'
  | 'enginePlans'
  | 'weakVerses'
  | 'portions';

export interface CollectionTombstoneRecordV2 {
  schemaVersion: 2;
  collection: TombstoneSupportedCollection;
  recordId: string;
  baseRevision: number;
  deletedAtRevision: number;
  deletedAtServerSeq: number;
  deletedByDeviceId: string;
  deletedAtIso: string;
}

export interface RevisionedRecordEnvelope<T> {
  recordId: string;
  revision: number;
  baseRevision: number;
  updatedByDeviceId: string;
  explicitRestore?: boolean;
  data: T;
}

export interface RecordConflictDescriptor<T> {
  recordId: string;
  localRecord: RevisionedRecordEnvelope<T>;
  remoteRecord: RevisionedRecordEnvelope<T>;
  reason: 'concurrent_divergent_edit' | 'delete_vs_concurrent_edit';
}

export interface TombstoneReconciliationResult<T> {
  activeRecords: RevisionedRecordEnvelope<T>[];
  activeTombstones: CollectionTombstoneRecordV2[];
  suppressedResurrectionIds: string[];
  restoredRecordIds: string[];
  conflicts: RecordConflictDescriptor<T>[];
}

const SAFE_ID_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return '[' + value.map(stableSerialize).join(',') + ']';
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + stableSerialize(obj[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value) ?? 'null';
}

export function isValidCollectionTombstoneV2(
  candidate: unknown
): candidate is CollectionTombstoneRecordV2 {
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return false;
  const rec = candidate as Record<string, unknown>;
  const validCollections = new Set<TombstoneSupportedCollection>([
    'plans',
    'enginePlans',
    'weakVerses',
    'portions',
  ]);
  return (
    rec.schemaVersion === 2 &&
    typeof rec.collection === 'string' &&
    validCollections.has(rec.collection as TombstoneSupportedCollection) &&
    typeof rec.recordId === 'string' &&
    SAFE_ID_PATTERN.test(rec.recordId) &&
    Number.isSafeInteger(rec.baseRevision) &&
    Number(rec.baseRevision) >= 0 &&
    Number.isSafeInteger(rec.deletedAtRevision) &&
    Number(rec.deletedAtRevision) > Number(rec.baseRevision) &&
    Number.isSafeInteger(rec.deletedAtServerSeq) &&
    Number(rec.deletedAtServerSeq) >= 1 &&
    typeof rec.deletedByDeviceId === 'string' &&
    SAFE_ID_PATTERN.test(rec.deletedByDeviceId) &&
    typeof rec.deletedAtIso === 'string' &&
    rec.deletedAtIso.length >= 10
  );
}

/**
 * Deterministic, clock-independent multi-device record & tombstone reconciliation:
 * - Never relies on client wall-clock timestamps to pick a winner.
 * - Prevents stale offline snapshots (revision <= tombstone.deletedAtRevision) from resurrecting deleted records.
 * - Allows explicit restore (explicitRestore === true && revision > tombstone.deletedAtRevision) to supersede an older tombstone.
 * - Flags concurrent divergent edits or concurrent edit vs delete at a higher revision as explicit conflicts (fail-closed).
 */
export function reconcileRecordsWithTombstones<T>(params: {
  collection: TombstoneSupportedCollection;
  localRecords: readonly RevisionedRecordEnvelope<T>[];
  remoteRecords: readonly RevisionedRecordEnvelope<T>[];
  localTombstones: readonly CollectionTombstoneRecordV2[];
  remoteTombstones: readonly CollectionTombstoneRecordV2[];
}): TombstoneReconciliationResult<T> {
  // 1. Merge tombstone ledger by recordId, keeping highest deletedAtRevision (tie-broken by deletedAtServerSeq)
  const tombstoneByRecordId = new Map<string, CollectionTombstoneRecordV2>();
  for (const candidate of [...params.localTombstones, ...params.remoteTombstones]) {
    if (!isValidCollectionTombstoneV2(candidate)) {
      throw new Error('INVALID_TOMBSTONE_RECORD');
    }
    if (candidate.collection !== params.collection) {
      throw new Error('TOMBSTONE_COLLECTION_MISMATCH');
    }
    const existing = tombstoneByRecordId.get(candidate.recordId);
    if (
      !existing ||
      candidate.deletedAtRevision > existing.deletedAtRevision ||
      (candidate.deletedAtRevision === existing.deletedAtRevision &&
        candidate.deletedAtServerSeq > existing.deletedAtServerSeq)
    ) {
      tombstoneByRecordId.set(candidate.recordId, candidate);
    }
  }

  const localById = new Map<string, RevisionedRecordEnvelope<T>>();
  for (const rec of params.localRecords) {
    localById.set(rec.recordId, rec);
  }
  const remoteById = new Map<string, RevisionedRecordEnvelope<T>>();
  for (const rec of params.remoteRecords) {
    remoteById.set(rec.recordId, rec);
  }

  const allRecordIds = new Set<string>([
    ...localById.keys(),
    ...remoteById.keys(),
  ]);

  const activeRecords: RevisionedRecordEnvelope<T>[] = [];
  const suppressedResurrectionIds: string[] = [];
  const restoredRecordIds: string[] = [];
  const conflicts: RecordConflictDescriptor<T>[] = [];

  for (const recordId of [...allRecordIds].sort()) {
    const localRec = localById.get(recordId);
    const remoteRec = remoteById.get(recordId);
    const tombstone = tombstoneByRecordId.get(recordId);

    // Pick candidate winner or detect concurrent edit conflict between local and remote
    let winningCandidate: RevisionedRecordEnvelope<T> | null = null;
    if (localRec && remoteRec) {
      const samePayload = stableSerialize(localRec.data) === stableSerialize(remoteRec.data);
      if (samePayload) {
        winningCandidate = localRec.revision >= remoteRec.revision ? localRec : remoteRec;
      } else if (remoteRec.revision > localRec.revision && remoteRec.baseRevision >= localRec.revision) {
        winningCandidate = remoteRec;
      } else if (localRec.revision > remoteRec.revision && localRec.baseRevision >= remoteRec.revision) {
        winningCandidate = localRec;
      } else {
        // Concurrent divergent edits on the same record without causal lineage -> fail closed!
        conflicts.push({
          recordId,
          localRecord: localRec,
          remoteRecord: remoteRec,
          reason: 'concurrent_divergent_edit',
        });
        // Preserve local record in active view while conflict is open so user data is never lost
        winningCandidate = localRec;
      }
    } else {
      winningCandidate = localRec ?? remoteRec ?? null;
    }

    if (!winningCandidate) continue;

    if (tombstone) {
      if (winningCandidate.revision <= tombstone.deletedAtRevision) {
        // Anti-resurrection guard: record is older than or equal to the tombstone revision
        suppressedResurrectionIds.push(recordId);
        continue;
      }
      if (winningCandidate.explicitRestore === true) {
        // Explicit restore at a higher revision supersedes the tombstone
        tombstoneByRecordId.delete(recordId);
        restoredRecordIds.push(recordId);
        activeRecords.push(winningCandidate);
        continue;
      }
      // A non-restore edit with a higher revision than a concurrent tombstone is a delete-vs-edit conflict
      if (localRec && remoteRec) {
        conflicts.push({
          recordId,
          localRecord: localRec,
          remoteRecord: remoteRec,
          reason: 'delete_vs_concurrent_edit',
        });
      }
      suppressedResurrectionIds.push(recordId);
      continue;
    }

    activeRecords.push(winningCandidate);
  }

  return {
    activeRecords,
    activeTombstones: [...tombstoneByRecordId.values()].sort((a, b) =>
      a.recordId.localeCompare(b.recordId)
    ),
    suppressedResurrectionIds,
    restoredRecordIds,
    conflicts,
  };
}

export interface RevisionedWeakVerseV2 {
  coordinateKey: string; // `${surahNumber}:${ayahNumber}`
  surahNumber: number;
  ayahNumber: number;
  surahName: string;
  ayahText: string;
  baseMistakeCount: number;
  deviceMistakeDeltas: Record<string, number>;
  revision: number;
  resolvedAtRevision: number | null;
}

/**
 * Convergent multi-device Weak Verse merger:
 * - Validates Quran coordinates strictly against QuranMath.
 * - Aggregates per-device mistake deltas without double-counting or blind last-write-wins overwrites.
 * - Enforces anti-resurrection when `resolvedAtRevision >= activeRevision` unless a new mistake occurs at a strictly higher revision.
 */
export function reconcileWeakVerseSnapshotsV2(
  localItems: readonly RevisionedWeakVerseV2[],
  remoteItems: readonly RevisionedWeakVerseV2[]
): {
  activeWeakVerses: Array<RevisionedWeakVerseV2 & { totalMistakeCount: number }>;
  resolvedCoordinates: string[];
} {
  const byCoord = new Map<string, RevisionedWeakVerseV2>();

  const validateItem = (item: RevisionedWeakVerseV2) => {
    if (
      !QuranMath.isValidCoordinate(item.surahNumber, item.ayahNumber) ||
      item.coordinateKey !== `${item.surahNumber}:${item.ayahNumber}` ||
      !Number.isSafeInteger(item.baseMistakeCount) ||
      item.baseMistakeCount < 0 ||
      !Number.isSafeInteger(item.revision) ||
      item.revision < 1
    ) {
      throw new Error(`INVALID_WEAK_VERSE_V2:${item.coordinateKey}`);
    }
  };

  for (const item of localItems) {
    validateItem(item);
    byCoord.set(item.coordinateKey, {
      ...item,
      deviceMistakeDeltas: { ...item.deviceMistakeDeltas },
    });
  }

  for (const remote of remoteItems) {
    validateItem(remote);
    const existing = byCoord.get(remote.coordinateKey);
    if (!existing) {
      byCoord.set(remote.coordinateKey, {
        ...remote,
        deviceMistakeDeltas: { ...remote.deviceMistakeDeltas },
      });
      continue;
    }

    const mergedDeltas: Record<string, number> = { ...existing.deviceMistakeDeltas };
    for (const [deviceId, count] of Object.entries(remote.deviceMistakeDeltas)) {
      if (!Number.isSafeInteger(count) || count < 0) {
        throw new Error(`INVALID_WEAK_VERSE_DEVICE_DELTA:${deviceId}`);
      }
      mergedDeltas[deviceId] = Math.max(mergedDeltas[deviceId] ?? 0, count);
    }

    const maxRevision = Math.max(existing.revision, remote.revision);
    const maxResolved =
      existing.resolvedAtRevision !== null && remote.resolvedAtRevision !== null
        ? Math.max(existing.resolvedAtRevision, remote.resolvedAtRevision)
        : existing.resolvedAtRevision ?? remote.resolvedAtRevision;

    // If a mistake was recorded at a revision strictly greater than maxResolved, the verse is active again;
    // otherwise if maxResolved >= maxRevision, it remains resolved (anti-resurrection).
    const effectiveResolvedAt =
      maxResolved !== null && maxResolved >= maxRevision ? maxResolved : null;

    byCoord.set(remote.coordinateKey, {
      ...existing,
      ayahText: remote.revision >= existing.revision ? remote.ayahText : existing.ayahText,
      baseMistakeCount: Math.max(existing.baseMistakeCount, remote.baseMistakeCount),
      deviceMistakeDeltas: mergedDeltas,
      revision: maxRevision,
      resolvedAtRevision: effectiveResolvedAt,
    });
  }

  const activeWeakVerses: Array<RevisionedWeakVerseV2 & { totalMistakeCount: number }> = [];
  const resolvedCoordinates: string[] = [];

  for (const coord of [...byCoord.keys()].sort()) {
    const entry = byCoord.get(coord)!;
    if (entry.resolvedAtRevision !== null && entry.resolvedAtRevision >= entry.revision) {
      resolvedCoordinates.push(coord);
      continue;
    }
    const deltaSum = Object.values(entry.deviceMistakeDeltas).reduce((acc, n) => acc + n, 0);
    activeWeakVerses.push({
      ...entry,
      totalMistakeCount: Math.max(1, entry.baseMistakeCount + deltaSum),
    });
  }

  return { activeWeakVerses, resolvedCoordinates };
}
