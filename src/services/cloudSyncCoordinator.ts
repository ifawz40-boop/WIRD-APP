import {
  getDocs,
  getDoc,
  doc,
  onSnapshot,
  collection,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  type Unsubscribe,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { db, auth, isFirebaseConfigured } from '../lib/firebase';
import { LocalSyncOutbox } from './localSyncOutbox';
import type { RemoteInboxEventInput } from './indexedDbSyncJournal';
import { StorageService } from './storageService';
import { writeRevisionedRemoteMutation } from './revisionedRemoteMutation';
import { projectRemoteInboxBatch } from './remoteInboxProjector';
import { flushAuxiliaryCloudSyncNow, markAuxiliaryBaselineSynced } from './auxiliaryCloudSyncService';
import {
  ACCOUNT_CLOUD_VAULT_DOC_ID,
  applyAccountCloudBundleToLocal,
  captureAccountCloudBundle,
  fingerprintAccountCloudBundle,
  fitBundleForFirestoreVault,
  isValidAccountCloudBundle,
  mergeAccountCloudBundles,
} from './accountCloudBundleService';
import { RetentionService } from './retentionService';
import {
  countActiveTombstones,
  readSyncTombstoneLedger,
  subscribeLocalSyncMutation,
} from './syncTombstoneRegistry';
import { createSecureId } from './secureId';

function isSyncScopeChanged(error: unknown): boolean {
  return error instanceof Error && error.message === 'SYNC_SCOPE_CHANGED';
}

function assertActiveSyncScope(uid: string): void {
  const currentUser = auth?.currentUser;
  if (
    !currentUser ||
    currentUser.uid !== uid ||
    !currentUser.emailVerified ||
    StorageService.getStorageScope() !== `user:${uid}`
  ) {
    throw new Error('SYNC_SCOPE_CHANGED');
  }
}

export const LEGACY_REMOTE_STATE_COLLECTIONS = [
  'profile',
  'plans',
  'enginePlans',
  'portions',
  'weakVerses',
  'tests',
  'activityEvents',
  'ruqyahProgress',
  'syncMeta',
] as const;

export type CloudSyncStatus =
  | 'idle'
  | 'syncing'
  | 'synced'
  | 'partial'
  | 'offline'
  | 'unverified'
  | 'guest'
  | 'error';

export type RemoteProjectionBlockReason =
  | 'projection_disabled'
  | 'legacy_remote_state'
  | 'events_pending'
  | 'import_failed'
  | 'blocked_pending_local'
  | 'blocked_base_revision'
  | 'blocked_tombstone'
  | 'projection_failed';

export interface ProjectionConflictSummary {
  eventId: string;
  serverSequence: number;
  collection: string;
  documentId: string;
  reason: string;
  createdAtMs: number;
}

export interface CloudSyncState {
  status: CloudSyncStatus;
  lastSyncAtMs: number | null;
  pendingCount: number;
  remoteInboxPendingCount: number;
  remoteCursor: number;
  remoteProjectionCursor: number;
  remoteProjectionBlockReason: RemoteProjectionBlockReason | null;
  remoteProjectionBlockedAtSequence: number | null;
  projectionConflictCount: number;
  latestProjectionConflict: ProjectionConflictSummary | null;
  errorMessage: string | null;
  isOnline: boolean;
  realtimeConnected: boolean;
  activeTombstonesCount: number;
}

type SyncListener = (state: CloudSyncState) => void;

/** Revision-enforcing Firestore rules are active; allow explicit 'false' kill-switch only if needed. */
export function isRevisionedSyncEnabled(): boolean {
  return import.meta.env.VITE_WIRD_REVISIONED_SYNC_ENABLED !== 'false';
}

/** Remote projection is enabled by default with durable conflict archiving; disable only if explicitly 'false'. */
export function isRemoteProjectionEnabled(): boolean {
  return import.meta.env.VITE_WIRD_REMOTE_PROJECTION_ENABLED !== 'false';
}

/** Full sync requires durable remote import and local projection, not just upload success. */
export function getCloudSyncCompletionStatus(
  pendingCount: number,
  remoteReconciled: boolean
): CloudSyncStatus {
  if (!Number.isSafeInteger(pendingCount) || pendingCount < 0) return 'error';
  if (pendingCount > 0) return 'error';
  return remoteReconciled ? 'synced' : 'partial';
}

function checkIsOnline(): boolean {
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

function getOrCreateSyncDeviceId(): string {
  try {
    if (typeof localStorage !== 'undefined') {
      const existing = localStorage.getItem('wird_sync_device_id_v4');
      if (existing && existing.length <= 64) return existing;
      const created = 'dev-' + createSecureId().slice(0, 24);
      localStorage.setItem('wird_sync_device_id_v4', created);
      return created;
    }
  } catch {
    // Fallback ephemeral ID
  }
  return 'dev-' + createSecureId().slice(0, 24);
}

function utf8PayloadBytes(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload) || '').byteLength;
  } catch {
    return Number.MAX_SAFE_INTEGER;
  }
}

function buildAuthoritativeSingleDocPayload(
  collectionName: string,
  documentId: string
): Record<string, unknown> | null {
  try {
    if (collectionName === 'profile' && documentId === 'main') {
      return { profile: StorageService.getProfile() };
    }
    if (collectionName === 'plans' && documentId === 'snapshot') {
      return { records: StorageService.getPlans() };
    }
    if (collectionName === 'portions' && documentId === 'snapshot') {
      return { records: StorageService.getUnifiedPortions() };
    }
    if (collectionName === 'weakVerses' && documentId === 'snapshot') {
      return { records: RetentionService.getWeakVerses() };
    }
    if (collectionName === 'ruqyahProgress' && documentId === 'snapshot') {
      const snap = StorageService.getRuqyahProgressSnapshot();
      if (snap && snap.schemaVersion === 2) {
        return { snapshot: snap };
      }
    }
  } catch {
    return null;
  }
  return null;
}

export class CloudSyncCoordinator {
  private listeners = new Set<SyncListener>();
  private syncInProgress = false;
  private syncRequestedWhileRunning = false;
  private legacyCheckUid: string | null = null;
  private legacyDataDetected: boolean | null = null;
  private autoSyncInterval: ReturnType<typeof setInterval> | null = null;
  private retryTimeout: ReturnType<typeof setTimeout> | null = null;
  private debounceSyncTimeout: ReturnType<typeof setTimeout> | null = null;
  private realtimeUnsubscribe: Unsubscribe | null = null;
  private realtimeBoundUid: string | null = null;
  private lastVaultMutationId: string | null = null;
  private lastUploadedVaultFingerprintByUid = new Map<string, string>();
  private consecutiveFailures = 0;

  private state: CloudSyncState = {
    status: 'idle',
    lastSyncAtMs: null,
    pendingCount: 0,
    remoteInboxPendingCount: 0,
    remoteCursor: 0,
    remoteProjectionCursor: 0,
    remoteProjectionBlockReason: null,
    remoteProjectionBlockedAtSequence: null,
    projectionConflictCount: 0,
    latestProjectionConflict: null,
    errorMessage: null,
    isOnline: checkIsOnline(),
    realtimeConnected: false,
    activeTombstonesCount: 0,
  };

  constructor() {
    this.setupNetworkListeners();
    this.setupStorageScopeListener();
    this.setupAuthAndMutationListeners();
  }

  private setupNetworkListeners(): void {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;

    window.addEventListener('online', () => {
      this.updateState({ isOnline: true });
      this.ensureRealtimeSubscription();
      void this.triggerSync();
    });

    window.addEventListener('offline', () => {
      this.updateState({ isOnline: false, status: 'offline', realtimeConnected: false });
    });

    const syncWhenActive = () => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
      if (checkIsOnline()) {
        this.ensureRealtimeSubscription();
        void this.triggerSync();
      }
    };
    window.addEventListener('focus', syncWhenActive);
    window.addEventListener('pageshow', syncWhenActive);
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', syncWhenActive);
    }
  }

  private setupStorageScopeListener(): void {
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('storage', () => {
        void this.refreshPendingCount();
      });
    }
  }

  private setupAuthAndMutationListeners(): void {
    subscribeLocalSyncMutation(() => {
      if (StorageService.getStorageScope().startsWith('user:')) {
        this.scheduleDebouncedSync(1400);
      }
    });

    if (typeof window !== 'undefined' && isFirebaseConfigured() && auth) {
      try {
        onAuthStateChanged(auth, (user) => {
          if (!user || !user.emailVerified) {
            this.teardownRealtimeSubscription();
            if (!user) {
              this.updateState({ status: 'guest', realtimeConnected: false, errorMessage: null });
            }
            return;
          }
          if (StorageService.getStorageScope() === `user:${user.uid}`) {
            this.ensureRealtimeSubscription();
            this.scheduleDebouncedSync(300);
          }
        });
      } catch {
        // Safe no-op in mocked environments where auth is not a full Firebase Auth instance.
      }
    }
  }

  public notifyStorageScopeChanged(): void {
    const scope = StorageService.getStorageScope();
    if (!scope.startsWith('user:')) {
      this.teardownRealtimeSubscription();
      this.updateState({
        status: scope === 'guest' ? 'guest' : 'idle',
        realtimeConnected: false,
        errorMessage: null,
      });
      return;
    }
    this.ensureRealtimeSubscription();
    void this.refreshPendingCount().then(() => {
      void this.triggerSync();
    });
  }

  public scheduleDebouncedSync(delayMs: number = 1400): void {
    if (typeof window === 'undefined') return;
    if (this.debounceSyncTimeout) {
      clearTimeout(this.debounceSyncTimeout);
    }
    this.debounceSyncTimeout = setTimeout(() => {
      this.debounceSyncTimeout = null;
      if (checkIsOnline() && StorageService.getStorageScope().startsWith('user:')) {
        void this.triggerSync();
      }
    }, delayMs);
  }

  private teardownRealtimeSubscription(): void {
    if (this.realtimeUnsubscribe) {
      try {
        this.realtimeUnsubscribe();
      } catch {
        // Ignore teardown errors
      }
      this.realtimeUnsubscribe = null;
    }
    this.realtimeBoundUid = null;
    if (this.state.realtimeConnected) {
      this.updateState({ realtimeConnected: false });
    }
  }

  private ensureRealtimeSubscription(): void {
    if (typeof window === 'undefined' || !isFirebaseConfigured() || !db || !auth) return;
    const currentUser = auth.currentUser;
    const scope = StorageService.getStorageScope();
    if (!currentUser || !currentUser.emailVerified || scope !== `user:${currentUser.uid}`) {
      this.teardownRealtimeSubscription();
      return;
    }
    if (this.realtimeBoundUid === currentUser.uid && this.realtimeUnsubscribe) {
      return;
    }

    this.teardownRealtimeSubscription();
    const uid = currentUser.uid;
    this.realtimeBoundUid = uid;

    try {
      const sequenceRef = doc(db, 'users', uid, 'syncSystem', 'remoteReplication');
      this.realtimeUnsubscribe = onSnapshot(
        sequenceRef,
        (snapshot) => {
          if (StorageService.getStorageScope() !== `user:${uid}`) return;
          this.updateState({ realtimeConnected: true });
          if (!snapshot.exists()) return;
          const data = snapshot.data();
          const remoteSeq = typeof data?.sequence === 'number' ? data.sequence : 0;
          const lastMutationId = typeof data?.mutationId === 'string' ? data.mutationId : '';
          if (
            remoteSeq > this.state.remoteCursor &&
            (!lastMutationId || lastMutationId !== this.lastVaultMutationId)
          ) {
            this.scheduleDebouncedSync(250);
          }
        },
        () => {
          this.updateState({ realtimeConnected: false });
        }
      );
    } catch {
      this.realtimeBoundUid = null;
    }
  }

  public subscribe(listener: SyncListener): () => void {
    this.listeners.add(listener);
    listener({ ...this.state });
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getState(): CloudSyncState {
    return { ...this.state };
  }

  private updateState(partial: Partial<CloudSyncState>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener({ ...this.state });
    }
  }

  public async refreshPendingCount(): Promise<number> {
    try {
      const scope = StorageService.getStorageScope();
      const activeTombstonesCount = countActiveTombstones(readSyncTombstoneLedger());
      if (!scope.startsWith('user:')) {
        this.updateState({
          pendingCount: 0,
          remoteInboxPendingCount: 0,
          remoteCursor: 0,
          remoteProjectionCursor: 0,
          remoteProjectionBlockReason: null,
          remoteProjectionBlockedAtSequence: null,
          projectionConflictCount: 0,
          latestProjectionConflict: null,
          activeTombstonesCount,
        });
        return 0;
      }
      const [snapshot, remoteCursor, remoteProjectionCursor, conflictCount, latestConflicts] =
        await Promise.all([
          LocalSyncOutbox.getSnapshot(),
          LocalSyncOutbox.getRemoteCursor(),
          LocalSyncOutbox.getRemoteProjectionCursor(),
          LocalSyncOutbox.getProjectionConflictCount(),
          LocalSyncOutbox.listProjectionConflicts(1),
        ]);
      const latest = latestConflicts[0];
      this.updateState({
        pendingCount: snapshot.pendingCount,
        remoteCursor,
        remoteProjectionCursor,
        remoteInboxPendingCount: Math.max(0, remoteCursor - remoteProjectionCursor),
        projectionConflictCount: conflictCount,
        activeTombstonesCount,
        latestProjectionConflict: latest
          ? {
              eventId: latest.event.eventId,
              serverSequence: latest.event.serverSequence,
              collection: latest.event.collection,
              documentId: latest.event.documentId,
              reason: latest.reason,
              createdAtMs: latest.createdAtMs,
            }
          : null,
      });
      return snapshot.pendingCount;
    } catch {
      return this.state.pendingCount;
    }
  }

  private lastReconcileSummary = {
    acknowledgedCount: 0,
    inboxAdvancedCount: 0,
    resolvedConflictCount: 0,
  };

  /**
   * Direct CRDT + HLC Tombstone Vault V4 reconciliation (`users/{uid}/syncMeta/accountCloudVaultV4`).
   * Synchronizes BOTH additions and deletions across all user worship domains without deadlocking
   * on stale base revisions, retrying once on concurrent contention.
   */
  private async reconcileAccountVaultV4(
    uid: string,
    allowUpload: boolean,
    forceVerifyRemote: boolean = false
  ): Promise<{ converged: boolean; durablySyncedOnRemote: boolean }> {
    if (!db || !isRevisionedSyncEnabled() || !isRemoteProjectionEnabled()) {
      return { converged: false, durablySyncedOnRemote: false };
    }
    assertActiveSyncScope(uid);

    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const vaultRef = doc(db, 'users', uid, 'syncMeta', ACCOUNT_CLOUD_VAULT_DOC_ID);
        const vaultSnap = await getDoc(vaultRef);
        assertActiveSyncScope(uid);

        const localBundle = captureAccountCloudBundle(Date.now());
        const localFp = fingerprintAccountCloudBundle(localBundle);

        let remoteRevision = 0;
        let remoteFp: string | null = null;
        let targetBundle = localBundle;

        if (vaultSnap.exists()) {
          const docData = vaultSnap.data();
          remoteRevision = Number.isSafeInteger(docData.revision) ? Number(docData.revision) : 0;
          const rawRemoteBundle = docData.payload?.vaultBundle;
          if (isValidAccountCloudBundle(rawRemoteBundle)) {
            remoteFp = fingerprintAccountCloudBundle(rawRemoteBundle);
            if (remoteFp !== localFp) {
              const { merged } = mergeAccountCloudBundles(localBundle, rawRemoteBundle, Date.now());
              const mergedFp = fingerprintAccountCloudBundle(merged);
              if (mergedFp !== localFp) {
                await applyAccountCloudBundleToLocal(merged);
                markAuxiliaryBaselineSynced(`user:${uid}`);
                assertActiveSyncScope(uid);
              }
              targetBundle = merged;
            } else {
              markAuxiliaryBaselineSynced(`user:${uid}`);
              this.lastUploadedVaultFingerprintByUid.set(uid, remoteFp);
            }
            await LocalSyncOutbox.setRemoteRevisionFromRemote(
              'syncMeta',
              ACCOUNT_CLOUD_VAULT_DOC_ID,
              remoteRevision
            ).catch(() => false);
          }
        }

        if (!allowUpload) {
          return { converged: true, durablySyncedOnRemote: vaultSnap.exists() && remoteFp === localFp };
        }

        const boundedBundle = fitBundleForFirestoreVault(targetBundle);
        const finalFp = fingerprintAccountCloudBundle(boundedBundle);
        const hasMeaningfulLocalData =
          vaultSnap.exists() ||
          boundedBundle.plans.length > 0 ||
          (boundedBundle.enginePlans?.length ?? 0) > 0 ||
          (boundedBundle.compactEnginePlans?.length ?? 0) > 0 ||
          boundedBundle.unifiedPortions.length > 0 ||
          boundedBundle.weakVerses.length > 0 ||
          boundedBundle.tests.length > 0 ||
          boundedBundle.logs.length > 0 ||
          boundedBundle.ruqyahProgress !== null ||
          boundedBundle.auxiliary.pageBookmarks.length > 0 ||
          boundedBundle.auxiliary.readingKhatmasRaw !== null ||
          boundedBundle.auxiliary.adhkarProgressRaw !== null ||
          boundedBundle.auxiliary.seerahV2Raw !== null ||
          boundedBundle.auxiliary.videoSeriesRaw !== null ||
          boundedBundle.tombstoneLedger.updatedAtMs > 0;

        if (!hasMeaningfulLocalData && !vaultSnap.exists()) {
          return { converged: true, durablySyncedOnRemote: true };
        }

        if (
          vaultSnap.exists() &&
          finalFp === remoteFp &&
          (!forceVerifyRemote || remoteFp !== null)
        ) {
          this.lastUploadedVaultFingerprintByUid.set(uid, finalFp);
          markAuxiliaryBaselineSynced(`user:${uid}`);
          return { converged: true, durablySyncedOnRemote: true };
        }

        if (
          forceVerifyRemote ||
          finalFp !== remoteFp ||
          this.lastUploadedVaultFingerprintByUid.get(uid) !== finalFp
        ) {
          const mutationId = 'vault4-' + createSecureId();
          this.lastVaultMutationId = mutationId;
          const writeRes = await writeRevisionedRemoteMutation(db, {
            uid,
            collection: 'syncMeta',
            documentId: ACCOUNT_CLOUD_VAULT_DOC_ID,
            operation: 'upsert',
            schemaVersion: 1,
            mutationId,
            eventId: mutationId,
            deviceId: getOrCreateSyncDeviceId(),
            clientUpdatedAtMs: Date.now(),
            baseRevision: remoteRevision,
            payload: { vaultBundle: boundedBundle },
          });
          assertActiveSyncScope(uid);
          this.lastUploadedVaultFingerprintByUid.set(uid, finalFp);
          markAuxiliaryBaselineSynced(`user:${uid}`);
          await LocalSyncOutbox.setRemoteRevisionFromRemote(
            'syncMeta',
            ACCOUNT_CLOUD_VAULT_DOC_ID,
            writeRes.revision
          ).catch(() => false);
          return { converged: true, durablySyncedOnRemote: true };
        }

        return { converged: true, durablySyncedOnRemote: vaultSnap.exists() };
      } catch (error) {
        if (isSyncScopeChanged(error)) throw error;
        if (
          attempt === 0 &&
          error instanceof Error &&
          error.message === 'REMOTE_REVISION_CONFLICT'
        ) {
          continue;
        }
        console.warn('[WIRD CloudSync] Vault V4 reconciliation warning:', error);
        return { converged: false, durablySyncedOnRemote: false };
      }
    }
    return { converged: false, durablySyncedOnRemote: false };
  }

  /**
   * Explicit 1-click self-healing reconciliation invoked from Settings (and safe to call anytime):
   * wakes backoff-delayed outbox items, forces an authoritative Firestore Vault V4 merge + verify,
   * and atomically clears superseded outbox entries, blocked inbox events, and open conflicts.
   */
  public async reconcileStuckOperations(): Promise<{
    success: boolean;
    acknowledgedCount: number;
    inboxAdvancedCount: number;
    resolvedConflictCount: number;
  }> {
    this.consecutiveFailures = 0;
    this.lastReconcileSummary = {
      acknowledgedCount: 0,
      inboxAdvancedCount: 0,
      resolvedConflictCount: 0,
    };
    const currentUser = auth?.currentUser;
    if (currentUser?.uid) {
      this.lastUploadedVaultFingerprintByUid.delete(currentUser.uid);
    }
    const ok = await this.triggerSync({ manual: true, forceVaultVerify: true });
    return {
      success: ok,
      ...this.lastReconcileSummary,
    };
  }

  /**
   * Main synchronization cycle:
   * 1. Check network, auth, and verified email status.
   * 2. Pull & merge Vault V4 + remote events first so fresh devices learn remote state and deletions.
   * 3. Wake backoff-delayed entries and drain pending local outbox mutations (healing stale revisions
   *    and deferring >120 KB uncompacted snapshots to Vault V4 supersession).
   * 4. Push converged Vault V4 bundle (additions + tombstones) and atomically finalize converged
   *    outbox, inbox, and conflict records once Firestore Vault V4 durability is confirmed.
   */
  public async triggerSync(options?: {
    manual?: boolean;
    forceVaultVerify?: boolean;
  }): Promise<boolean> {
    if (this.syncInProgress) {
      this.syncRequestedWhileRunning = true;
      return false;
    }

    if (!checkIsOnline()) {
      this.updateState({ status: 'offline', errorMessage: 'الجهاز غير متصل بالإنترنت حالياً.' });
      return false;
    }

    if (!isFirebaseConfigured() || !db || !auth) {
      const scope = StorageService.getStorageScope();
      if (scope.startsWith('user:')) {
        this.updateState({ status: 'idle', errorMessage: null });
      } else {
        this.updateState({ status: 'guest', errorMessage: null });
      }
      return false;
    }

    const currentUser = auth.currentUser;
    const scope = StorageService.getStorageScope();

    if (!currentUser || scope === 'guest') {
      this.updateState({ status: 'guest', errorMessage: null });
      return false;
    }

    if (!currentUser.emailVerified) {
      this.updateState({
        status: 'unverified',
        errorMessage: 'يتطلب حفظ التغييرات سحابياً تفعيل البريد الإلكتروني.',
      });
      return false;
    }

    const uid = currentUser.uid;
    const expectedScope = `user:${uid}`;
    if (scope !== expectedScope) {
      this.updateState({
        status: 'error',
        errorMessage: 'نطاق التخزين المحلي غير متطابق مع هوية المستخدم المسجل.',
      });
      return false;
    }

    this.ensureRealtimeSubscription();
    const revisionedSyncEnabled = isRevisionedSyncEnabled();
    this.syncInProgress = true;
    this.updateState({ status: 'syncing', errorMessage: null });

    try {
      // 1. Pull & CRDT-merge Vault V4 first so additions AND deletions from other devices
      // apply immediately without colliding with stale local baseRevision: 0 writes.
      const preVault = await this.reconcileAccountVaultV4(uid, false);
      assertActiveSyncScope(uid);

      // Wake any outbox mutations hidden behind earlier exponential backoff timers.
      if (options?.manual || preVault.converged) {
        await LocalSyncOutbox.resetPendingBackoff(Date.now(), uid).catch(() => 0);
        assertActiveSyncScope(uid);
      }

      const existingOutbox = await LocalSyncOutbox.listReadyEntries(Date.now(), 1, uid);
      assertActiveSyncScope(uid);
      if (existingOutbox.length === 0) {
        await this.pullRemoteReconciliation(uid, preVault.converged, false);
        assertActiveSyncScope(uid);
      }

      await flushAuxiliaryCloudSyncNow().catch(() => undefined);
      let hasMore = true;
      let firstPushError: string | null = null;
      const deferredVaultSuperseded: Array<{
        mutationId: string;
        resolvedRevision?: number;
        fallbackError: string;
      }> = [];
      const seenDeferredIds = new Set<string>();

      while (hasMore && revisionedSyncEnabled) {
        assertActiveSyncScope(uid);
        const readyEntries = (await LocalSyncOutbox.listReadyEntries(Date.now(), 25, uid)).filter(
          (item) => !seenDeferredIds.has(item.mutationId)
        );
        assertActiveSyncScope(uid);
        if (readyEntries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of readyEntries) {
          assertActiveSyncScope(uid);
          const entryBytes = utf8PayloadBytes(entry.payload);

          // Oversize uncompacted EnginePlan / grouped transaction snapshots (>120 KB) or legacy
          // tombstones cannot pass `writeRevisionedRemoteMutation` (128 KB cap / upsert-only rules),
          // whereas `AccountCloudBundleV4` compacts them losslessly (<40 KB) with HLC tombstones.
          if (entry.operation === 'tombstone' || entryBytes > 120_000) {
            seenDeferredIds.add(entry.mutationId);
            deferredVaultSuperseded.push({
              mutationId: entry.mutationId,
              fallbackError:
                'تعذر رفع حزمة كبيرة مباشرة؛ ستُرفع مضغوطة عبر خزنة الحساب السحابية تلقائياً.',
            });
            continue;
          }

          try {
            let baseRevision = entry.baseRevision;
            const cachedRevision = await LocalSyncOutbox.getRemoteRevision(
              entry.collection,
              entry.documentId,
              uid
            );
            assertActiveSyncScope(uid);
            if (cachedRevision && baseRevision < cachedRevision.revision) {
              try {
                const rebased = await LocalSyncOutbox.rebasePendingMutation(
                  entry.mutationId,
                  baseRevision,
                  cachedRevision.revision,
                  uid
                );
                assertActiveSyncScope(uid);
                if (rebased) {
                  baseRevision = cachedRevision.revision;
                }
              } catch {
                // Sequence <= cached.localSequence means a newer remote revision arrived;
                // handled safely via Vault V4 convergence below without aborting sync.
              }
            }

            assertActiveSyncScope(uid);
            const result = await writeRevisionedRemoteMutation(db, {
              uid,
              collection: entry.collection,
              documentId: entry.documentId,
              operation: entry.operation,
              schemaVersion: entry.schemaVersion,
              mutationId: entry.mutationId,
              eventId: entry.eventId || entry.mutationId,
              deviceId: entry.deviceId,
              clientUpdatedAtMs: entry.clientUpdatedAtMs,
              baseRevision,
              payload: entry.payload,
            });

            assertActiveSyncScope(uid);
            await LocalSyncOutbox.acknowledgeRemoteMutation(
              entry.mutationId,
              result.revision,
              Date.now(),
              uid
            );
            assertActiveSyncScope(uid);
          } catch (writeError: any) {
            if (isSyncScopeChanged(writeError)) throw writeError;
            assertActiveSyncScope(uid);

            const errMessage = typeof writeError?.message === 'string' ? writeError.message : '';
            const isRevisionOrEnvelopeConflict =
              errMessage === 'REMOTE_REVISION_CONFLICT' ||
              errMessage === 'REMOTE_EVENT_ID_COLLISION' ||
              errMessage === 'INVALID_REVISIONED_MUTATION';

            if (isRevisionOrEnvelopeConflict) {
              let resolvedRev: number | undefined;
              try {
                const liveStateSnap = await getDoc(
                  doc(db, 'users', uid, entry.collection, entry.documentId)
                );
                assertActiveSyncScope(uid);
                const liveRev =
                  liveStateSnap.exists() && Number.isSafeInteger(liveStateSnap.data().revision)
                    ? Number(liveStateSnap.data().revision)
                    : 0;
                if (liveRev > 0) {
                  resolvedRev = liveRev;
                  // Best-effort refresh of canonical single-doc state using post-Vault-merge local data
                  const freshPayload = buildAuthoritativeSingleDocPayload(
                    entry.collection,
                    entry.documentId
                  );
                  if (freshPayload && utf8PayloadBytes(freshPayload) <= 120_000) {
                    const healId = 'heal4-' + createSecureId();
                    const healRes = await writeRevisionedRemoteMutation(db, {
                      uid,
                      collection: entry.collection,
                      documentId: entry.documentId,
                      operation: 'upsert',
                      schemaVersion: 1,
                      mutationId: healId,
                      eventId: healId,
                      deviceId: getOrCreateSyncDeviceId(),
                      clientUpdatedAtMs: Date.now(),
                      baseRevision: liveRev,
                      payload: freshPayload,
                    }).catch(() => null);
                    if (healRes) {
                      resolvedRev = healRes.revision;
                    }
                  }
                }
              } catch (healErr) {
                if (isSyncScopeChanged(healErr)) throw healErr;
              }

              seenDeferredIds.add(entry.mutationId);
              deferredVaultSuperseded.push({
                mutationId: entry.mutationId,
                resolvedRevision: resolvedRev,
                fallbackError: errMessage || 'REMOTE_REVISION_CONFLICT',
              });
              continue;
            }

            console.warn(
              '[WIRD CloudSync] Mutation write failed, scheduling retry:',
              entry.mutationId,
              writeError
            );
            const errCode = writeError?.code || errMessage || 'firestore-write-error';
            if (!firstPushError) {
              firstPushError =
                errMessage || 'تعذر رفع بعض التغييرات؛ ستظل محفوظة محلياً وستتم إعادة المحاولة.';
            }
            await LocalSyncOutbox.markFailed(
              entry.mutationId,
              String(errCode).slice(0, 64),
              Date.now(),
              uid
            );
            assertActiveSyncScope(uid);
          }
        }

        if (readyEntries.length < 25) {
          hasMore = false;
        }
      }

      // 4. Push converged Vault V4 (including all latest additions + tombstones)
      assertActiveSyncScope(uid);
      const forceVaultVerify =
        Boolean(options?.forceVaultVerify) || deferredVaultSuperseded.length > 0;
      const postVault = await this.reconcileAccountVaultV4(uid, true, forceVaultVerify);
      assertActiveSyncScope(uid);

      let ackedByVault = 0;
      if (postVault.durablySyncedOnRemote && deferredVaultSuperseded.length > 0) {
        const outboxRec = await LocalSyncOutbox.reconcileVaultConvergedState(
          {
            supersededMutations: deferredVaultSuperseded.map((item) => ({
              mutationId: item.mutationId,
              resolvedRevision: item.resolvedRevision,
            })),
            advanceInboxToCursor: false,
            resolveOpenConflicts: false,
            nowMs: Date.now(),
          },
          uid
        );
        ackedByVault = outboxRec.acknowledgedCount;
        assertActiveSyncScope(uid);
      } else if (!postVault.durablySyncedOnRemote && deferredVaultSuperseded.length > 0) {
        for (const item of deferredVaultSuperseded) {
          if (!firstPushError) firstPushError = item.fallbackError;
          await LocalSyncOutbox.markFailed(
            item.mutationId,
            item.fallbackError.slice(0, 64),
            Date.now(),
            uid
          );
        }
        assertActiveSyncScope(uid);
      }

      const remoteReconciled = await this.pullRemoteReconciliation(
        uid,
        preVault.converged || postVault.converged,
        postVault.durablySyncedOnRemote
      );
      assertActiveSyncScope(uid);

      this.lastReconcileSummary = {
        acknowledgedCount: ackedByVault + this.lastReconcileSummary.acknowledgedCount,
        inboxAdvancedCount: this.lastReconcileSummary.inboxAdvancedCount,
        resolvedConflictCount: this.lastReconcileSummary.resolvedConflictCount,
      };

      const finalCount = await this.refreshPendingCount();
      assertActiveSyncScope(uid);
      const status = getCloudSyncCompletionStatus(finalCount, remoteReconciled);
      this.updateState({
        status,
        lastSyncAtMs: status === 'synced' ? Date.now() : this.state.lastSyncAtMs,
        errorMessage:
          status === 'synced'
            ? null
            : firstPushError ||
              (!revisionedSyncEnabled && finalCount > 0
                ? 'الرفع السحابي الآمن متوقف مؤقتاً حتى نشر قواعد Firestore ومصالحة البيانات القديمة. بياناتك المحلية محفوظة ولم يتم إرسال كتابة قد تستبدل بيانات أحدث.'
                : status === 'error'
                  ? 'بعض التغييرات لم تُرفع بعد؛ احتفظنا بها محلياً وسنعيد المحاولة.'
                  : status === 'partial'
                    ? 'تم حفظ الأحداث المستقبلة في صندوق محلي دائم، لكن تطبيقها ودمجها مع البيانات المحلية لم يكتمل بعد.'
                    : null),
      });

      if (status === 'synced') {
        this.consecutiveFailures = 0;
        if (this.retryTimeout) {
          clearTimeout(this.retryTimeout);
          this.retryTimeout = null;
        }
      } else if (status === 'error' && revisionedSyncEnabled && typeof window !== 'undefined') {
        this.scheduleBackoffRetry();
      }

      return status === 'synced';
    } catch (syncError: any) {
      if (isSyncScopeChanged(syncError)) {
        this.updateState({ status: 'idle', errorMessage: null });
        return false;
      }
      console.error('[WIRD CloudSync] Cloud sync failed:', syncError);
      this.updateState({
        status: 'error',
        errorMessage: syncError?.message || 'تعذر استكمال المزامنة السحابية.',
      });
      if (typeof window !== 'undefined') {
        this.scheduleBackoffRetry();
      }
      return false;
    } finally {
      this.syncInProgress = false;
      await this.refreshPendingCount();
      if (this.syncRequestedWhileRunning) {
        this.syncRequestedWhileRunning = false;
        void Promise.resolve().then(() => this.triggerSync());
      }
    }
  }

  private async hasLegacyRemoteState(uid: string): Promise<boolean> {
    assertActiveSyncScope(uid);
    if (this.legacyCheckUid === uid && this.legacyDataDetected === false) return false;
    if (!db) return true;
    try {
      let hasAnyStateDocument = false;
      for (const collectionName of LEGACY_REMOTE_STATE_COLLECTIONS) {
        const snapshot = await getDocs(collection(db, 'users', uid, collectionName));
        assertActiveSyncScope(uid);
        const stateDocuments = snapshot.docs.filter(
          (item) => !(collectionName === 'syncMeta' && item.id === 'remoteReplication')
        );
        if (stateDocuments.length > 0) hasAnyStateDocument = true;
        const hasUnversionedDocument = stateDocuments.some((item) => {
          const data = item.data();
          return !Number.isSafeInteger(data.revision) || !Number.isSafeInteger(data.baseRevision);
        });
        if (hasUnversionedDocument) {
          this.legacyCheckUid = uid;
          this.legacyDataDetected = true;
          return true;
        }
      }
      if (!hasAnyStateDocument) {
        const legacyEvents = await getDocs(
          query(
            collection(db, 'users', uid, 'events'),
            where('schemaVersion', '==', 1),
            firestoreLimit(1)
          )
        );
        assertActiveSyncScope(uid);
        if (!legacyEvents.empty) {
          this.legacyCheckUid = uid;
          this.legacyDataDetected = true;
          return true;
        }
      }
      this.legacyCheckUid = uid;
      this.legacyDataDetected = false;
      return false;
    } catch (error) {
      if (isSyncScopeChanged(error)) throw error;
      console.warn(
        '[WIRD CloudSync] Could not verify legacy remote documents; projection remains blocked.',
        error
      );
      return true;
    }
  }

  /**
   * Import server-ordered events, then project. When `vaultDurablySynced` is true,
   * all domain state across every collection is already merged and persisted in
   * `users/{uid}/syncMeta/accountCloudVaultV4`, so blocked historical inbox events,
   * stale projection intents, and open projection conflicts are atomically marked
   * reconciled while preserving conflict archive evidence.
   */
  private async pullRemoteReconciliation(
    uid: string,
    vaultConverged: boolean = false,
    vaultDurablySynced: boolean = false
  ): Promise<boolean> {
    if (!db) return false;
    assertActiveSyncScope(uid);
    try {
      const eventsRef = collection(db, 'users', uid, 'events');
      for (let page = 0; page < 10; page++) {
        const cursor = await LocalSyncOutbox.getRemoteCursor(uid);
        assertActiveSyncScope(uid);
        const eventsQuery = query(
          eventsRef,
          where('serverSequence', '>', cursor),
          orderBy('serverSequence', 'asc'),
          firestoreLimit(100)
        );
        const snapshot = await getDocs(eventsQuery);
        assertActiveSyncScope(uid);
        if (snapshot.empty) break;
        const remoteEvents = snapshot.docs.map((item) => item.data()) as unknown as RemoteInboxEventInput[];
        await LocalSyncOutbox.importRemotePage(remoteEvents, uid);
        assertActiveSyncScope(uid);
        if (snapshot.size < 100) break;
      }

      if (!isRemoteProjectionEnabled()) {
        this.updateState({
          remoteProjectionBlockReason: 'projection_disabled',
          remoteProjectionBlockedAtSequence: null,
        });
        return false;
      }
      assertActiveSyncScope(uid);
      if (!vaultDurablySynced && (await this.hasLegacyRemoteState(uid))) {
        this.updateState({
          remoteProjectionBlockReason: 'legacy_remote_state',
          remoteProjectionBlockedAtSequence: null,
        });
        return false;
      }

      assertActiveSyncScope(uid);
      let projection = await projectRemoteInboxBatch(100);
      assertActiveSyncScope(uid);
      let batchPages = 1;
      while (!projection.reason && projection.projectedCount === 100 && batchPages < 15) {
        batchPages++;
        projection = await projectRemoteInboxBatch(100);
        assertActiveSyncScope(uid);
      }

      // Self-heal first-sync `blocked_base_revision` when Vault V4 has already merged
      // both local and remote collections losslessly without overwriting user data.
      let healPasses = 0;
      while (
        vaultConverged &&
        projection.reason === 'blocked_base_revision' &&
        projection.blockedAtSequence !== null &&
        healPasses < 50
      ) {
        healPasses += 1;
        const pendingEvents = await LocalSyncOutbox.listRemoteInboxAfter(
          projection.blockedAtSequence - 1,
          1
        );
        const blockedEvt = pendingEvents[0];
        if (!blockedEvt || blockedEvt.serverSequence !== projection.blockedAtSequence) break;
        await LocalSyncOutbox.setRemoteRevisionFromRemote(
          blockedEvt.collection,
          blockedEvt.documentId,
          blockedEvt.revision
        );
        const advanced = await LocalSyncOutbox.markRemoteProjected(blockedEvt.serverSequence).catch(
          () => false
        );
        if (!advanced) break;
        projection = await projectRemoteInboxBatch(100);
        assertActiveSyncScope(uid);
      }

      // When Vault V4 is durably synced on Firestore (`vaultDurablySynced === true`) and zero
      // pending local outbox mutations remain, any residual blocked historical inbox events or
      // previously-archived open projection conflicts have already had their domain data merged
      // losslessly into `accountCloudVaultV4`. Atomically advance the cursor and mark open
      // conflicts as `resolved/reconciled` while preserving conflict archive snapshots.
      if (vaultDurablySynced) {
        const [outboxSnap, preRemoteCursor, preProjCursor, openConflicts] = await Promise.all([
          LocalSyncOutbox.getSnapshot(),
          LocalSyncOutbox.getRemoteCursor(uid),
          LocalSyncOutbox.getRemoteProjectionCursor(uid),
          LocalSyncOutbox.getProjectionConflictCount(),
        ]);
        assertActiveSyncScope(uid);
        if (
          outboxSnap.pendingCount === 0 &&
          (Boolean(projection.reason) || preRemoteCursor !== preProjCursor || openConflicts > 0)
        ) {
          const rec = await LocalSyncOutbox.reconcileVaultConvergedState(
            {
              supersededMutations: [],
              advanceInboxToCursor: Boolean(projection.reason) || preRemoteCursor !== preProjCursor,
              resolveOpenConflicts: openConflicts > 0,
              nowMs: Date.now(),
            },
            uid
          );
          this.lastReconcileSummary = {
            acknowledgedCount: this.lastReconcileSummary.acknowledgedCount,
            inboxAdvancedCount: this.lastReconcileSummary.inboxAdvancedCount + rec.inboxAdvancedCount,
            resolvedConflictCount:
              this.lastReconcileSummary.resolvedConflictCount + rec.resolvedConflictCount,
          };
          projection = { projectedCount: projection.projectedCount, blockedAtSequence: null, reason: null };
          assertActiveSyncScope(uid);
        }
      }

      if (projection.reason) {
        console.warn(
          '[WIRD CloudSync] Remote projection paused without advancing its cursor.',
          projection
        );
        this.updateState({
          remoteProjectionBlockReason: projection.reason,
          remoteProjectionBlockedAtSequence: projection.blockedAtSequence,
        });
        return false;
      }
      const [remoteCursor, projectionCursor] = await Promise.all([
        LocalSyncOutbox.getRemoteCursor(),
        LocalSyncOutbox.getRemoteProjectionCursor(),
      ]);
      if (remoteCursor !== projectionCursor) {
        this.updateState({
          remoteProjectionBlockReason: 'events_pending',
          remoteProjectionBlockedAtSequence: null,
        });
        return false;
      }
      this.updateState({
        remoteProjectionBlockReason: null,
        remoteProjectionBlockedAtSequence: null,
      });
      return true;
    } catch (error) {
      if (isSyncScopeChanged(error)) throw error;
      console.warn(
        '[WIRD CloudSync] Remote inbox import/projection is incomplete; durable cursors were preserved.',
        error
      );
      this.updateState({
        remoteProjectionBlockReason: 'import_failed',
        remoteProjectionBlockedAtSequence: null,
      });
      return false;
    }
  }

  public notifyMutationEnqueued(): void {
    void this.refreshPendingCount().then(() => {
      void this.triggerSync();
    });
  }

  public startPeriodicSync(intervalMs: number = 45_000): void {
    this.ensureRealtimeSubscription();
    if (this.autoSyncInterval) return;
    void this.refreshPendingCount().then(() => this.triggerSync());
    this.autoSyncInterval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void this.triggerSync();
      }
    }, intervalMs);
  }

  private scheduleBackoffRetry(): void {
    if (this.retryTimeout || !checkIsOnline()) return;
    this.consecutiveFailures = Math.min(6, this.consecutiveFailures + 1);
    const delayMs = Math.min(120_000, 10_000 * Math.pow(2, this.consecutiveFailures - 1));
    this.retryTimeout = setTimeout(() => {
      this.retryTimeout = null;
      if (checkIsOnline()) {
        void this.triggerSync();
      }
    }, delayMs);
    if (typeof this.retryTimeout === 'object' && this.retryTimeout && 'unref' in this.retryTimeout) {
      (this.retryTimeout as any).unref();
    }
  }

  public stopPeriodicSync(): void {
    this.teardownRealtimeSubscription();
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
    }
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
      this.retryTimeout = null;
    }
    if (this.debounceSyncTimeout) {
      clearTimeout(this.debounceSyncTimeout);
      this.debounceSyncTimeout = null;
    }
  }
}

export const cloudSyncCoordinator = new CloudSyncCoordinator();
