import {
  AUXILIARY_SYNC_DOCUMENT_ID,
  captureAuxiliaryDomainSnapshot,
} from './auxiliaryDomainsSchema';
import { persistJournaledSnapshot } from './journaledSnapshotService';
import { StorageService } from './storageService';

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let lastEnqueuedSerialized = '';

function canScheduleCloudJournalWrite(): boolean {
  const scope = StorageService.getStorageScope();
  return (
    scope.startsWith('user:') &&
    typeof window !== 'undefined' &&
    typeof indexedDB !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'locks' in navigator
  );
}

/**
 * Flushes the latest auxiliary worship domains snapshot (`Khatmas`, `Ribbons`, `Bookmarks`,
 * `Adhkar`, `Seerah`, `Video Series`) into the durable IndexedDB sync journal (`syncMeta/auxiliaryDomainsV1`).
 */
export async function flushAuxiliaryCloudSyncNow(): Promise<boolean> {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (!canScheduleCloudJournalWrite()) return false;

  const expectedScope = StorageService.getStorageScope();
  const snapshot = captureAuxiliaryDomainSnapshot((key) => StorageService.getRawItem(key), Date.now());
  const contentFingerprint = JSON.stringify({
    ...snapshot,
    updatedAtMs: 0,
    lastPage: snapshot.lastPage ? { page: snapshot.lastPage.page } : null,
  });

  if (contentFingerprint === lastEnqueuedSerialized) {
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
    lastEnqueuedSerialized = contentFingerprint;
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
