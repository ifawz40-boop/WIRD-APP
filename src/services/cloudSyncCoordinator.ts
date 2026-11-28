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
  isValidAccountCloudBundle,
  mergeAccountCloudBundles,
} from './accountCloudBundleService';
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

  /**
   * Direct CRDT + HLC Tombstone Vault V4 reconciliation (`users/{uid}/syncMeta/accountCloudVaultV4`).
   * Synchronizes BOTH additions and deletions across all user worship domains without deadlocking
   * on stale base revisions.
   */
  private async reconcileAccountVaultV4(
    uid: string,
    allowUpload: boolean
  ): Promise<{ converged: boolean }> {
    if (!db || !isRevisionedSyncEnabled() || !isRemoteProjectionEnabled()) {
      return { converged: false };
    }
    assertActiveSyncScope(uid);
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
        return { converged: true };
      }

      const finalFp = fingerprintAccountCloudBundle(targetBundle);
      const hasMeaningfulLocalData =
        vaultSnap.exists() ||
        targetBundle.plans.length > 0 ||
        (targetBundle.enginePlans?.length ?? 0) > 0 ||
        (targetBundle.compactEnginePlans?.length ?? 0) > 0 ||
        targetBundle.unifiedPortions.length > 0 ||
        targetBundle.weakVerses.length > 0 ||
        targetBundle.tests.length > 0 ||
        targetBundle.logs.length > 0 ||
        targetBundle.auxiliary.pageBookmarks.length > 0 ||
        targetBundle.auxiliary.readingKhatmasRaw !== null ||
        targetBundle.auxiliary.adhkarProgressRaw !== null ||
        targetBundle.auxiliary.seerahV2Raw !== null ||
        targetBundle.auxiliary.videoSeriesRaw !== null ||
        targetBundle.tombstoneLedger.updatedAtMs > 0;

      if (
        hasMeaningfulLocalData &&
        finalFp !== remoteFp &&
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
          payload: { vaultBundle: targetBundle },
        });
        assertActiveSyncScope(uid);
        this.lastUploadedVaultFingerprintByUid.set(uid, finalFp);
        markAuxiliaryBaselineSynced(`user:${uid}`);
        await LocalSyncOutbox.setRemoteRevisionFromRemote(
          'syncMeta',
          ACCOUNT_CLOUD_VAULT_DOC_ID,
          writeRes.revision
        ).catch(() => false);
      }

      return { converged: true };
    } catch (error) {
      if (isSyncScopeChanged(error)) throw error;
      console.warn('[WIRD CloudSync] Vault V4 reconciliation warning:', error);
      return { converged: false };
    }
  }

  /**
   * Main synchronization cycle:
   * 1. Check network, auth, and verified email status.
   * 2. Pull & merge Vault V4 + remote events first so fresh devices learn remote state and deletions.
   * 3. Drain pending local outbox mutations to Firestore (with live server-revision self-healing).
   * 4. Push converged Vault V4 bundle (additions + tombstones) and finalize remote projection cursors.
   */
  public async triggerSync(): Promise<boolean> {
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

      const existingOutbox = await LocalSyncOutbox.listReadyEntries(Date.now(), 1, uid);
      assertActiveSyncScope(uid);
      if (existingOutbox.length === 0) {
        await this.pullRemoteReconciliation(uid, preVault.converged);
        assertActiveSyncScope(uid);
      }

      await flushAuxiliaryCloudSyncNow().catch(() => undefined);
      let hasMore = true;
      let firstPushError: string | null = null;

      while (hasMore && revisionedSyncEnabled) {
        assertActiveSyncScope(uid);
        const readyEntries = await LocalSyncOutbox.listReadyEntries(Date.now(), 25, uid);
        assertActiveSyncScope(uid);
        if (readyEntries.length === 0) {
          hasMore = false;
          break;
        }

        for (const entry of readyEntries) {
          assertActiveSyncScope(uid);
          try {
            let baseRevision = entry.baseRevision;
            const cachedRevision = await LocalSyncOutbox.getRemoteRevision(
              entry.collection,
              entry.documentId,
              uid
            );
            assertActiveSyncScope(uid);
            if (cachedRevision && baseRevision < cachedRevision.revision) {
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
            }

            assertActiveSyncScope(uid);
            let result;
            try {
              result = await writeRevisionedRemoteMutation(db, {
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
            } catch (initialWriteErr: any) {
              // Self-heal stale baseRevision when Vault V4 has already merged local & remote data safely
              if (
                preVault.converged &&
                initialWriteErr instanceof Error &&
                initialWriteErr.message === 'REMOTE_REVISION_CONFLICT'
              ) {
                const liveStateSnap = await getDoc(
                  doc(db, 'users', uid, entry.collection, entry.documentId)
                );
                assertActiveSyncScope(uid);
                const liveRev = liveStateSnap.exists() && Number.isSafeInteger(liveStateSnap.data().revision)
                  ? Number(liveStateSnap.data().revision)
                  : 0;
                if (liveRev > baseRevision) {
                  await LocalSyncOutbox.setRemoteRevisionFromRemote(
                    entry.collection,
                    entry.documentId,
                    liveRev
                  ).catch(() => false);
                  const rebasedLive = await LocalSyncOutbox.rebasePendingMutation(
                    entry.mutationId,
                    baseRevision,
                    liveRev,
                    uid
                  );
                  if (rebasedLive) {
                    result = await writeRevisionedRemoteMutation(db, {
                      uid,
                      collection: entry.collection,
                      documentId: entry.documentId,
                      operation: entry.operation,
                      schemaVersion: entry.schemaVersion,
                      mutationId: entry.mutationId,
                      eventId: entry.eventId || entry.mutationId,
                      deviceId: entry.deviceId,
                      clientUpdatedAtMs: entry.clientUpdatedAtMs,
                      baseRevision: liveRev,
                      payload: entry.payload,
                    });
                  } else {
                    throw initialWriteErr;
                  }
                } else {
                  throw initialWriteErr;
                }
              } else {
                throw initialWriteErr;
              }
            }

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
            console.warn(
              '[WIRD CloudSync] Mutation write failed, scheduling retry:',
              entry.mutationId,
              writeError
            );
            const errCode = writeError?.code || writeError?.message || 'firestore-write-error';
            if (!firstPushError) {
              firstPushError =
                typeof writeError?.message === 'string'
                  ? writeError.message
                  : 'تعذر رفع بعض التغييرات؛ ستظل محفوظة محلياً وستتم إعادة المحاولة.';
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

      // Push converged Vault V4 (including all latest additions + tombstones)
      assertActiveSyncScope(uid);
      const postVault = await this.reconcileAccountVaultV4(uid, true);
      assertActiveSyncScope(uid);

      const remoteReconciled = await this.pullRemoteReconciliation(
        uid,
        preVault.converged || postVault.converged
      );
      assertActiveSyncScope(uid);
      const finalCount = await this.refreshPendingCount();
      assertActiveSyncScope(uid);
      const status = getCloudSyncCompletionStatus(finalCount, remoteReconciled);
      this.updateState({
        status,
        lastSyncAtMs: status === 'synced' ? Date.now() : this.state.lastSyncAtMs,
        errorMessage:
          firstPushError ||
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
      this.legacyCheckUid = uid;
      this.legacyDataDetected = true;
      return true;
    }
  }

  /**
   * Import server-ordered events, then project. When `vaultConverged` is true,
   * first-sync uninitialized collection events whose data was already merged via
   * `AccountCloudBundleV4` advance their baseline cleanly instead of deadlocking.
   */
  private async pullRemoteReconciliation(
    uid: string,
    vaultConverged: boolean = false
  ): Promise<boolean> {
    if (!db) return false;
    assertActiveSyncScope(uid);
    try {
      const eventsRef = collection(db, 'users', uid, 'events');
      for (let page = 0; page < 5; page++) {
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
      if (await this.hasLegacyRemoteState(uid)) {
        this.updateState({
          remoteProjectionBlockReason: 'legacy_remote_state',
          remoteProjectionBlockedAtSequence: null,
        });
        return false;
      }

      assertActiveSyncScope(uid);
      let projection = await projectRemoteInboxBatch(100);
      assertActiveSyncScope(uid);

      // Self-heal first-sync `blocked_base_revision` when Vault V4 has already merged
      // both local and remote collections losslessly without overwriting user data.
      let healPasses = 0;
      while (
        vaultConverged &&
        projection.reason === 'blocked_base_revision' &&
        projection.blockedAtSequence !== null &&
        healPasses < 25
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
        const advanced = await LocalSyncOutbox.markRemoteProjected(blockedEvt.serverSequence);
        if (!advanced) break;
        projection = await projectRemoteInboxBatch(100);
        assertActiveSyncScope(uid);
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
