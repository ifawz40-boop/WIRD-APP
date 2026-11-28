import {
  AUXILIARY_SYNC_DOCUMENT_ID,
  captureAuxiliaryDomainSnapshot,
} from './auxiliaryDomainsSchema';
import { persistJournaledSnapshot } from './journaledSnapshotService';
import { StorageService } from './storageService';
import { isApplyingRemoteSync } from './syncTombstoneRegistry';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastEnqueuedByScope = new Map<string, string>();

function canScheduleCloudJournalWrite(): boolean {
  if (isApplyingRemoteSync()) return false;
  const scope = StorageService.getStorageScope();
  return (
    scope.startsWith('user:') &&
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'locks' in navigator
  );
}

export function computeAuxiliaryFingerprint(snapshot: ReturnType<typeof captureAuxiliaryDomainSnapshot>): string {
  return JSON.stringify({
    pageBookmarks: snapshot.pageBookmarks,
    ribbons: snapshot.ribbons,
    lastPage: snapshot.lastPage ? snapshot.lastPage.page : null,
    lastReadingPositionRaw: snapshot.lastReadingPositionRaw,
    readingKhatmasRaw: snapshot.readingKhatmasRaw,
    adhkarProgressRaw: snapshot.adhkarProgressRaw,
    seerahV2Raw: snapshot.seerahV2Raw,
    videoSeriesRaw: snapshot.videoSeriesRaw,
    tombstones: snapshot.tombstoneLedger
      ? {
          upsertedAtMs: snapshot.tombstoneLedger.upsertedAtMs,
          deletedAtMs: snapshot.tombstoneLedger.deletedAtMs,
        }
      : null,
  });
}

export function markAuxiliaryBaselineSynced(scope = StorageService.getStorageScope()): void {
  if (!scope.startsWith('user:')) return;
  const snapshot = captureAuxiliaryDomainSnapshot((key) => StorageService.getRawItem(key), Date.now());
  lastEnqueuedByScope.set(scope, computeAuxiliaryFingerprint(snapshot));
}

/**
 * Flushes the latest auxiliary worship domains snapshot (`Khatmas`, `Ribbons`, `Bookmarks`,
 * `Adhkar`, `Seerah`, `Video Series`, `Tombstones`) into the durable IndexedDB sync journal (`syncMeta/auxiliaryDomainsV1`)
 * only when user auxiliary state has genuinely changed since the last known baseline.
 */
export async function flushAuxiliaryCloudSyncNow(): Promise<boolean> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!canScheduleCloudJournalWrite()) return false;

  const expectedScope = StorageService.getStorageScope();
  const snapshot = captureAuxiliaryDomainSnapshot((key) => StorageService.getRawItem(key), Date.now());
  const contentFingerprint = computeAuxiliaryFingerprint(snapshot);

  if (lastEnqueuedByScope.get(expectedScope) === contentFingerprint) {
    return true;
  }

  const result = await persistJournaledSnapshot(
    {
      collection: 'syncMeta',
      documentId: AUXILIARY_SYNC_DOCUMENT_ID,
      payload: { auxiliarySnapshot: snapshot },
    },
    () => true,
    { expectedStorageScope: expectedScope }
  );

  if (result.success) {
    lastEnqueuedByScope.set(expectedScope, contentFingerprint);
  }
  return result.success;
}

/**
 * Debounces auxiliary domain changes (1.2s) so rapid Tasbih taps, Mushaf page flips,
 * or Seerah scroll saves coalesce into a single revisioned Firestore sync mutation.
 */
export function scheduleAuxiliaryCloudSync(delayMs = 1200): void {
  if (!canScheduleCloudJournalWrite()) return;
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void flushAuxiliaryCloudSyncNow().catch(() => undefined);
  }, delayMs);
}
