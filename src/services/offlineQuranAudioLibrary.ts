import { ALL_SURAHS } from '../data/quranMeta';
import { getJuzAyahRanges, mergeMemorizedRanges, type MemorizedAyahRange } from './memorizedRangeService';
import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import type { EngineGeneratedPlan } from './planningEngine';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS } from './ruqyahAudioService';
import { createSecureId } from './secureId';

export const OFFLINE_AUDIO_DB_NAME = 'wird-offline-audio';
export const OFFLINE_AUDIO_DB_VERSION = 4;
export const OFFLINE_AUDIO_CACHE_NAME = 'wird-offline-quran-audio-v1';
export const MAX_AUDIO_FILE_BYTES = 8 * 1024 * 1024;
export const APP_STORAGE_RESERVE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_AUDIO_DOWNLOAD_CONCURRENCY = 2;

export const STORE_AUDIO_JOBS = 'jobs';
export const STORE_AUDIO_FILES = 'files';
export const STORE_AUDIO_JOB_ITEMS = 'jobItems';
export const STORE_AUDIO_LOCKS = 'locks';
export const STORE_AUDIO_STAGING = 'staging';
export const DEFAULT_AUDIO_LOCK_LEASE_MS = 60_000;
export const DEFAULT_AUDIO_LOCK_POLL_INTERVAL_MS = 50;
export const DEFAULT_AUDIO_LOCK_WAIT_TIMEOUT_MS = 120_000;
export const DEFAULT_AUDIO_STAGING_GRACE_MS = 5 * 60 * 1000;
export const DEFAULT_AUDIO_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;

export type OfflineAudioJobStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'partial'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OfflineAudioJobScopeKind = 'surah' | 'juz' | 'plan' | 'range';

export interface OfflineAudioJob {
  jobId: string;
  scopeKind: OfflineAudioJobScopeKind;
  labelAr: string;
  reciterId: string;
  ranges: MemorizedAyahRange[];
  status: OfflineAudioJobStatus;
  totalItems: number;
  completedItems: number;
  failedItems: number;
  totalBytes: number;
  requestFingerprint: string;
  createdAtMs: number;
  updatedAtMs: number;
  lastError?: string;
  schemaVersion: 1;
}

export interface OfflineAudioFileRecord {
  fileKey: string; // `${reciterId}:${globalAyahNumber}`
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
  cacheGenerationId: string;
  byteLength: number;
  contentType: string;
  available: boolean;
  pinned: boolean;
  deletionPending: boolean;
  verifiedAtMs: number;
  schemaVersion: 1;
}

export type OfflineAudioItemStatus = 'queued' | 'downloading' | 'verified' | 'failed' | 'cancelled';

export interface OfflineAudioJobItem {
  itemKey: string; // `${jobId}:${fileKey}`
  jobId: string;
  fileKey: string;
  reciterId: string;
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
  ordinal: number;
  status: OfflineAudioItemStatus;
  cacheGenerationId?: string;
  lastError?: string;
  schemaVersion: 1;
}

export interface CacheStorageLike {
  open(cacheName: string): Promise<{
    put(request: Request | string, response: Response): Promise<void>;
    match(request: Request | string): Promise<Response | undefined>;
    delete(request: Request | string): Promise<boolean>;
    keys?(request?: Request | string): Promise<readonly Request[]>;
  }>;
}

export interface OfflineAudioStagingRecord {
  cacheKey: string;
  kind: 'download' | 'orphan';
  fileKey?: string;
  reciterId?: string;
  globalAyahNumber?: number;
  cacheGenerationId?: string;
  jobId?: string;
  createdAtMs: number;
  schemaVersion: 1;
}

export interface OfflineAudioLockRecord {
  lockName: string;
  ownerId: string;
  leaseToken: string;
  expiresAtMs: number;
  schemaVersion: 1;
}

type OfflineAudioCrossTabMessage = { type: 'changed' | 'pause' | 'cancel'; sourceId: string; jobId?: string };

export interface OfflineAudioLockManagerLike {
  request<T>(name: string, options: { mode: 'exclusive' }, callback: () => Promise<T>): Promise<T>;
}

export interface OfflineAudioLibraryDeps {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
  cacheStorageFactory?: CacheStorageLike;
  cacheName?: string;
  fetchFn?: typeof fetch;
  storageEstimateFn?: () => Promise<StorageEstimate>;
  lockRunner?: <T>(name: string, task: () => Promise<T>) => Promise<T>;
  lockManager?: OfflineAudioLockManagerLike | null;
  lockLeaseMs?: number;
  lockPollIntervalMs?: number;
  lockWaitTimeoutMs?: number;
  stagingGraceMs?: number;
  orphanGraceMs?: number;
  concurrency?: number;
}

export interface QuotaPreflightResult {
  allowed: boolean;
  estimatedBytes: number;
  usageBytes: number | null;
  quotaBytes: number | null;
  availableBytes: number | null;
  messageAr?: string;
}

export interface OfflineAudioLibraryStats {
  jobCount: number;
  availableFilesCount: number;
  totalBytes: number;
}

export interface ResolvedLocalAudioPlayback {
  sourceKind: 'local-cache' | 'network';
  src: string;
  revoke?: () => void;
}

const APPROVED_RECITER_IDS = new Set(FALLBACK_QURAN_RECITERS.map(r => r.id));

export function buildCanonicalAudioFileKey(reciterId: string, globalAyahNumber: number): string {
  return `${reciterId}:${globalAyahNumber}`;
}

export function buildCacheGenerationKey(
  reciterId: string,
  globalAyahNumber: number,
  cacheGenerationId: string
): string {
  return `https://wird.local/offline-audio/${encodeURIComponent(reciterId)}/${globalAyahNumber}/${encodeURIComponent(cacheGenerationId)}.mp3`;
}

export function estimateAudioDownloadBytes(reciterId: string, totalAyahs: number): number {
  const reciter = FALLBACK_QURAN_RECITERS.find(r => r.id === reciterId);
  const bitrate = reciter?.bitrate ?? 128;
  const approxPerAyahBytes = Math.round((bitrate / 128) * 58_000);
  return Math.max(0, totalAyahs) * approxPerAyahBytes;
}

export function extractEnginePlanAudioRanges(plan: EngineGeneratedPlan): MemorizedAyahRange[] {
  const ranges: MemorizedAyahRange[] = [];
  for (const day of plan.schedule) {
    if (day.isRestDay) continue;
    if (day.memorizationTask) {
      ranges.push({
        surahNumber: day.memorizationTask.surahNumber,
        startAyah: day.memorizationTask.startAyah,
        endAyah: day.memorizationTask.endAyah
      });
    }
    for (const rev of [day.minorRevisionTask, day.majorRevisionTask]) {
      if (rev && rev.surahNumber && rev.startAyah && rev.endAyah) {
        ranges.push({
          surahNumber: rev.surahNumber,
          startAyah: rev.startAyah,
          endAyah: rev.endAyah
        });
      }
    }
  }
  return mergeMemorizedRanges(ranges);
}

export function buildMultiRangeDownloadItems(
  reciterId: string,
  ranges: MemorizedAyahRange[]
): Array<{
  surahNumber: number;
  ayahNumber: number;
  globalAyahNumber: number;
  url: string;
  fileKey: string;
}> {
  if (!APPROVED_RECITER_IDS.has(reciterId)) {
    throw new Error('المقرئ المختار غير معتمد للتخزين دون إنترنت.');
  }
  const merged = mergeMemorizedRanges(ranges);
  if (merged.length === 0) {
    throw new Error('لم يتم العثور على آيات صالحة داخل النطاق المحدد للتنزيل.');
  }
  const seen = new Set<string>();
  const result: Array<{
    surahNumber: number;
    ayahNumber: number;
    globalAyahNumber: number;
    url: string;
    fileKey: string;
  }> = [];

  for (const range of merged) {
    const plan = buildQuranAudioDownloadPlan({
      reciterId,
      surahNumber: range.surahNumber,
      startAyah: range.startAyah,
      endAyah: range.endAyah
    });
    for (const item of plan.items) {
      const fileKey = buildCanonicalAudioFileKey(reciterId, item.globalAyahNumber);
      if (seen.has(fileKey)) continue;
      seen.add(fileKey);
      result.push({ ...item, fileKey });
    }
  }
  return result;
}

export function buildJuzAudioRanges(juzNumber: number): MemorizedAyahRange[] {
  return getJuzAyahRanges(juzNumber);
}

function buildRequestFingerprint(
  scopeKind: OfflineAudioJobScopeKind,
  reciterId: string,
  items: Array<{ globalAyahNumber: number }>
): string {
  // A count + first/last tuple is not unique for disjoint ranges. Persist the
  // exact ordered global-ayah sequence so two different plans cannot collide.
  const exactAyahSequence = items.map(item => item.globalAyahNumber).join(',');
  return `${scopeKind}:${reciterId}:${exactAyahSequence}`;
}

function idbReq<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('فشلت قراءة قاعدة الصوتيات المحلية.'));
  });
}

function idbTx(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onabort = () => {
      const err = tx.error;
      if (err && typeof err === 'object' && 'name' in err && (err as { name?: string }).name === 'QuotaExceededError') {
        reject(new Error('مساحة التخزين المحلية ممتلئة؛ لم يتم إكمال حفظ ملف التلاوة.'));
        return;
      }
      reject(err instanceof Error ? err : new Error('توقفت معاملة الصوتيات المحلية.'));
    };
    tx.onerror = () => { /* handled via onabort */ };
  });
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function isApprovedCdnAudioUrl(rawUrl: string, expectedGlobalAyahNumber: number, reciterId: string): boolean {
  try {
    const expectedUrl = buildQuranAyahAudioUrl(reciterId, expectedGlobalAyahNumber);
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'cdn.islamic.network' &&
      !parsed.search &&
      !parsed.hash &&
      rawUrl === expectedUrl;
  } catch {
    return false;
  }
}

export class OfflineQuranAudioLibrary {
  private readonly factory?: IDBFactory;
  private readonly databaseName: string;
  private readonly cacheStorageFactory?: CacheStorageLike;
  private readonly cacheName: string;
  private readonly fetchFn?: typeof fetch;
  private readonly storageEstimateFn?: () => Promise<StorageEstimate>;
  private readonly lockRunner?: <T>(name: string, task: () => Promise<T>) => Promise<T>;
  private readonly lockManager: OfflineAudioLockManagerLike | null;
  private readonly lockLeaseMs: number;
  private readonly lockPollIntervalMs: number;
  private readonly lockWaitTimeoutMs: number;
  private readonly stagingGraceMs: number;
  private readonly orphanGraceMs: number;
  private readonly instanceId: string;
  private readonly activeLeaseTokens = new Map<string, string>();
  private readonly broadcastChannel: BroadcastChannel | null;
  private readonly concurrency: number;
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activeControllers = new Map<string, Set<AbortController>>();
  private pausedJobs = new Set<string>();
  private cancelledJobs = new Set<string>();
  private runningWorkers = new Map<string, Promise<void>>();
  private listeners = new Set<() => void>();

  constructor(deps: OfflineAudioLibraryDeps = {}) {
    this.factory = deps.indexedDBFactory ?? globalThis.indexedDB;
    this.databaseName = deps.databaseName ?? OFFLINE_AUDIO_DB_NAME;
    this.cacheStorageFactory = deps.cacheStorageFactory ??
      (typeof caches !== 'undefined' ? (caches as unknown as CacheStorageLike) : undefined);
    this.cacheName = deps.cacheName ?? OFFLINE_AUDIO_CACHE_NAME;
    this.fetchFn = deps.fetchFn ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
    this.storageEstimateFn = deps.storageEstimateFn ??
      (typeof navigator !== 'undefined' && navigator.storage?.estimate
        ? () => navigator.storage.estimate()
        : undefined);
    this.lockRunner = deps.lockRunner;
    this.lockManager = deps.lockManager !== undefined
      ? deps.lockManager
      : (typeof navigator !== 'undefined'
        ? (navigator as unknown as { locks?: OfflineAudioLockManagerLike }).locks ?? null
        : null);
    this.lockLeaseMs = Math.max(1_000, deps.lockLeaseMs ?? DEFAULT_AUDIO_LOCK_LEASE_MS);
    this.lockPollIntervalMs = Math.max(10, deps.lockPollIntervalMs ?? DEFAULT_AUDIO_LOCK_POLL_INTERVAL_MS);
    this.lockWaitTimeoutMs = Math.max(1_000, deps.lockWaitTimeoutMs ?? DEFAULT_AUDIO_LOCK_WAIT_TIMEOUT_MS);
    this.stagingGraceMs = Math.max(1, deps.stagingGraceMs ?? DEFAULT_AUDIO_STAGING_GRACE_MS);
    this.orphanGraceMs = Math.max(1, deps.orphanGraceMs ?? DEFAULT_AUDIO_ORPHAN_GRACE_MS);
    this.instanceId = createSecureId();
    let channel: BroadcastChannel | null = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        channel = new BroadcastChannel('wird-offline-quran-audio-v1');
        channel.onmessage = (event: MessageEvent<OfflineAudioCrossTabMessage>) => {
          const message = event.data;
          if (!message || message.sourceId === this.instanceId) return;
          if (message.type === 'pause' && message.jobId) {
            this.pausedJobs.add(message.jobId);
            const controllers = this.activeControllers.get(message.jobId);
            if (controllers) for (const controller of controllers) controller.abort();
          } else if (message.type === 'cancel' && message.jobId) {
            this.cancelledJobs.add(message.jobId);
            const controllers = this.activeControllers.get(message.jobId);
            if (controllers) for (const controller of controllers) controller.abort();
          }
          this.notifyListeners(false);
        };
      } catch {
        channel = null;
      }
    }
    this.broadcastChannel = channel;
    const requestedConcurrency = deps.concurrency ?? DEFAULT_AUDIO_DOWNLOAD_CONCURRENCY;
    this.concurrency = Math.max(1, Math.min(2, requestedConcurrency));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(broadcast = true): void {
    if (broadcast) {
      try { this.broadcastChannel?.postMessage({ type: 'changed', sourceId: this.instanceId } satisfies OfflineAudioCrossTabMessage); } catch { /* best-effort cross-tab UI refresh */ }
    }
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore listener errors */ }
    }
  }

  private broadcastJobSignal(type: 'pause' | 'cancel', jobId: string): void {
    try { this.broadcastChannel?.postMessage({ type, jobId, sourceId: this.instanceId } satisfies OfflineAudioCrossTabMessage); } catch { /* DB state remains authoritative */ }
  }

  private async getPersistedJobStatus(jobId: string): Promise<OfflineAudioJobStatus | null> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_JOBS], 'readonly');
    const done = idbTx(tx);
    const job = (await idbReq(tx.objectStore(STORE_AUDIO_JOBS).get(jobId))) as OfflineAudioJob | undefined;
    await done;
    return job?.status ?? null;
  }

  private async runWithLock<T>(lockName: string, task: () => Promise<T>): Promise<T> {
    if (this.lockRunner) return this.lockRunner(lockName, task);
    if (this.lockManager) {
      return this.lockManager.request(lockName, { mode: 'exclusive' }, () =>
        lockName.startsWith('wird-offline-audio-worker:')
          ? this.runWithIndexedDbLease(lockName, task)
          : task()
      );
    }
    return this.runWithIndexedDbLease(lockName, task);
  }

  /**
   * Cross-tab lock fallback for browsers without the Web Locks API.
   * IndexedDB read/write transactions serialize lease acquisition atomically.
   */
  private async runWithIndexedDbLease<T>(lockName: string, task: () => Promise<T>): Promise<T> {
    const db = await this.openDatabase();
    const leaseToken = createSecureId();
    const deadline = Date.now() + this.lockWaitTimeoutMs;
    let acquired = false;

    while (!acquired) {
      const tx = db.transaction([STORE_AUDIO_LOCKS], 'readwrite');
      const done = idbTx(tx);
      const store = tx.objectStore(STORE_AUDIO_LOCKS);
      const current = (await idbReq(store.get(lockName))) as OfflineAudioLockRecord | undefined;
      const now = Date.now();
      if (!current || current.expiresAtMs <= now) {
        store.put({
          lockName,
          ownerId: this.instanceId,
          leaseToken,
          expiresAtMs: now + this.lockLeaseMs,
          schemaVersion: 1
        } satisfies OfflineAudioLockRecord);
        acquired = true;
      }
      await done;

      if (!acquired) {
        if (Date.now() >= deadline) {
          throw new Error('هناك عملية تنزيل أخرى تعمل في تبويب آخر؛ أعد المحاولة بعد لحظة.');
        }
        await new Promise(resolve => setTimeout(resolve, this.lockPollIntervalMs));
      }
    }

    this.activeLeaseTokens.set(lockName, leaseToken);
    let renewal = Promise.resolve();
    const heartbeat = setInterval(() => {
      renewal = renewal.then(() => this.renewIndexedDbLease(lockName, leaseToken)).catch(() => undefined);
    }, Math.max(250, Math.floor(this.lockLeaseMs / 3)));

    try {
      return await task();
    } finally {
      clearInterval(heartbeat);
      await renewal.catch(() => undefined);
      this.activeLeaseTokens.delete(lockName);
      await this.releaseIndexedDbLease(lockName, leaseToken).catch(() => undefined);
    }
  }

  private async renewIndexedDbLease(lockName: string, leaseToken: string): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_LOCKS], 'readwrite');
    const done = idbTx(tx);
    const store = tx.objectStore(STORE_AUDIO_LOCKS);
    const current = (await idbReq(store.get(lockName))) as OfflineAudioLockRecord | undefined;
    if (current?.ownerId === this.instanceId && current.leaseToken === leaseToken) {
      store.put({ ...current, expiresAtMs: Date.now() + this.lockLeaseMs });
    }
    await done;
  }

  private async releaseIndexedDbLease(lockName: string, leaseToken: string): Promise<void> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_LOCKS], 'readwrite');
    const done = idbTx(tx);
    const store = tx.objectStore(STORE_AUDIO_LOCKS);
    const current = (await idbReq(store.get(lockName))) as OfflineAudioLockRecord | undefined;
    if (current?.ownerId === this.instanceId && current.leaseToken === leaseToken) store.delete(lockName);
    await done;
  }

  private async hasCurrentLease(lockName: string): Promise<boolean> {
    const leaseToken = this.activeLeaseTokens.get(lockName);
    if (!leaseToken) return true; // Native Web Lock or injected test lock.
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_LOCKS], 'readonly');
    const done = idbTx(tx);
    const current = (await idbReq(tx.objectStore(STORE_AUDIO_LOCKS).get(lockName))) as OfflineAudioLockRecord | undefined;
    await done;
    return current?.ownerId === this.instanceId &&
      current.leaseToken === leaseToken && current.expiresAtMs > Date.now();
  }

  private openDatabase(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;
    if (!this.factory) {
      return Promise.reject(new Error('IndexedDB غير متاح لإدارة التلاوات المحلية.'));
    }
    this.dbPromise = new Promise((resolve, reject) => {
      let req: IDBOpenDBRequest;
      try {
        req = this.factory!.open(this.databaseName, OFFLINE_AUDIO_DB_VERSION);
      } catch (err) {
        reject(err instanceof Error ? err : new Error('تعذر فتح قاعدة التلاوات المحلية.'));
        return;
      }

      req.onupgradeneeded = (event) => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_AUDIO_JOBS)) {
          const jobs = db.createObjectStore(STORE_AUDIO_JOBS, { keyPath: 'jobId' });
          jobs.createIndex('status', 'status', { unique: false });
          jobs.createIndex('createdAtMs', 'createdAtMs', { unique: false });
          jobs.createIndex('requestFingerprint', 'requestFingerprint', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_FILES)) {
          const files = db.createObjectStore(STORE_AUDIO_FILES, { keyPath: 'fileKey' });
          files.createIndex('reciterId', 'reciterId', { unique: false });
          files.createIndex('available', 'available', { unique: false });
          files.createIndex('deletionPending', 'deletionPending', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_JOB_ITEMS)) {
          const items = db.createObjectStore(STORE_AUDIO_JOB_ITEMS, { keyPath: 'itemKey' });
          items.createIndex('jobId', 'jobId', { unique: false });
          items.createIndex('fileKey', 'fileKey', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_LOCKS)) {
          db.createObjectStore(STORE_AUDIO_LOCKS, { keyPath: 'lockName' });
        }
        if (!db.objectStoreNames.contains(STORE_AUDIO_STAGING)) {
          db.createObjectStore(STORE_AUDIO_STAGING, { keyPath: 'cacheKey' });
        }

        // Migrate legacy count/endpoint fingerprints to the exact ordered ayah sequence.
        // Keep this inside the version-change transaction so active/paused jobs cannot
        // be mistaken for a different disjoint range after an app upgrade.
        if (event.oldVersion < 4 && req.transaction) {
          const jobsStore = req.transaction.objectStore(STORE_AUDIO_JOBS);
          const itemsStore = req.transaction.objectStore(STORE_AUDIO_JOB_ITEMS);
          const jobsRequest = jobsStore.getAll();
          jobsRequest.onsuccess = () => {
            const itemsRequest = itemsStore.getAll();
            itemsRequest.onsuccess = () => {
              const itemsByJob = new Map<string, OfflineAudioJobItem[]>();
              for (const item of itemsRequest.result as OfflineAudioJobItem[]) {
                const group = itemsByJob.get(item.jobId) || [];
                group.push(item);
                itemsByJob.set(item.jobId, group);
              }
              for (const job of jobsRequest.result as OfflineAudioJob[]) {
                const items = (itemsByJob.get(job.jobId) || []).sort((a, b) => a.ordinal - b.ordinal);
                if (items.length > 0) {
                  jobsStore.put({
                    ...job,
                    requestFingerprint: buildRequestFingerprint(job.scopeKind, job.reciterId, items)
                  });
                }
              }
            };
          };
        }
      };

      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        this.dbPromise = null;
        reject(req.error || new Error('فشل فتح قاعدة التلاوات المحلية.'));
      };
      req.onblocked = () => {
        this.dbPromise = null;
        reject(new Error('قاعدة التلاوات المحلية مفتوحة في تبويب آخر؛ أعد المحاولة بعد لحظة.'));
      };
    });
    return this.dbPromise;
  }

  close(): void {
    for (const controllers of this.activeControllers.values()) {
      for (const c of controllers) c.abort();
    }
    this.activeControllers.clear();
    this.broadcastChannel?.close();
    if (this.dbPromise) {
      void this.dbPromise.then(db => db.close()).catch(() => undefined);
      this.dbPromise = null;
    }
  }

  private async openAudioCache() {
    if (!this.cacheStorageFactory) {
      throw new Error('ذاكرة Cache Storage غير متاحة في هذا المتصفح لحفظ التلاوات.');
    }
    return this.cacheStorageFactory.open(this.cacheName);
  }

  async preflightQuota(reciterId: string, totalAyahs: number): Promise<QuotaPreflightResult> {
    const estimatedBytes = estimateAudioDownloadBytes(reciterId, totalAyahs);
    if (!this.storageEstimateFn) {
      return {
        allowed: true,
        estimatedBytes,
        usageBytes: null,
        quotaBytes: null,
        availableBytes: null
      };
    }
    try {
      const est = await this.storageEstimateFn();
      const usageBytes = typeof est.usage === 'number' && Number.isFinite(est.usage) ? est.usage : null;
      const quotaBytes = typeof est.quota === 'number' && Number.isFinite(est.quota) ? est.quota : null;
      if (usageBytes === null || quotaBytes === null) {
        return { allowed: true, estimatedBytes, usageBytes, quotaBytes, availableBytes: null };
      }
      const availableBytes = Math.max(0, quotaBytes - usageBytes - APP_STORAGE_RESERVE_BYTES);
      const allowed = estimatedBytes <= availableBytes;
      return {
        allowed,
        estimatedBytes,
        usageBytes,
        quotaBytes,
        availableBytes,
        ...(!allowed
          ? {
              messageAr: `المساحة المتاحة (${Math.round(availableBytes / (1024 * 1024))} م.ب بعد هامش الأمان) لا تكفي للحجم التقديري المطلوب (${Math.max(1, Math.round(estimatedBytes / (1024 * 1024)))} م.ب).`
            }
          : {})
      };
    } catch {
      return { allowed: true, estimatedBytes, usageBytes: null, quotaBytes: null, availableBytes: null };
    }
  }

  /** Write audio bytes to Cache Storage and verify exact readback before returning. */
  private async writeAndVerifyCacheEntry(
    reciterId: string,
    globalAyahNumber: number,
    cacheGenerationId: string,
    bytes: Uint8Array,
    contentType: string
  ): Promise<void> {
    const cache = await this.openAudioCache();
    const cacheKey = buildCacheGenerationKey(reciterId, globalAyahNumber, cacheGenerationId);
    const payload = new Uint8Array(bytes.byteLength);
    payload.set(bytes);
    const response = new Response(payload.buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength)
      }
    });
    await cache.put(cacheKey, response);
    const readback = await cache.match(cacheKey);
    if (!readback || readback.status !== 200 || readback.type === 'opaque') {
      await cache.delete(cacheKey).catch(() => undefined);
      throw new Error('تعذر التحقق من قراءة ملف التلاوة المحفوظ في الذاكرة.');
    }
    const readbackBytes = new Uint8Array(await readback.arrayBuffer());
    if (!bytesEqual(readbackBytes, bytes)) {
      await cache.delete(cacheKey).catch(() => undefined);
      throw new Error('عدم تطابق بايتات التلاوة بعد الكتابة في الذاكرة المحلية.');
    }
  }

  private async verifyCacheEntry(file: OfflineAudioFileRecord): Promise<boolean> {
    if (!file.available || file.deletionPending || !file.cacheGenerationId) return false;
    if (!this.cacheStorageFactory) return false;
    try {
      const cache = await this.openAudioCache();
      const cacheKey = buildCacheGenerationKey(file.reciterId, file.globalAyahNumber, file.cacheGenerationId);
      const match = await cache.match(cacheKey);
      if (!match || match.status !== 200 || match.type === 'opaque') return false;
      const ct = (match.headers.get('content-type') || '').toLowerCase();
      if (!ct.startsWith('audio/')) return false;
      const buf = await match.arrayBuffer();
      return buf.byteLength > 0 && buf.byteLength === file.byteLength;
    } catch {
      return false;
    }
  }

  private async deleteCacheGeneration(
    reciterId: string,
    globalAyahNumber: number,
    cacheGenerationId: string
  ): Promise<boolean> {
    if (!this.cacheStorageFactory || !cacheGenerationId) return true;
    try {
      const cache = await this.openAudioCache();
      const cacheKey = buildCacheGenerationKey(reciterId, globalAyahNumber, cacheGenerationId);
      await cache.delete(cacheKey);
      return true;
    } catch {
      return false;
    }
  }

  private async putStagingRecord(record: OfflineAudioStagingRecord): Promise<void> {
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_STAGING], 'readwrite');
      const done = idbTx(tx);
      tx.objectStore(STORE_AUDIO_STAGING).put(record);
      await done;
    });
  }

  private async deleteStagingRecord(cacheKey: string): Promise<void> {
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_STAGING], 'readwrite');
      const done = idbTx(tx);
      tx.objectStore(STORE_AUDIO_STAGING).delete(cacheKey);
      await done;
    });
  }

  async listJobs(): Promise<OfflineAudioJob[]> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_JOBS], 'readonly');
    const done = idbTx(tx);
    const jobs = (await idbReq(tx.objectStore(STORE_AUDIO_JOBS).getAll())) as OfflineAudioJob[];
    await done;
    return jobs.sort((a, b) => b.createdAtMs - a.createdAtMs);
  }

  async getJobItems(jobId: string): Promise<OfflineAudioJobItem[]> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_JOB_ITEMS], 'readonly');
    const done = idbTx(tx);
    const items = (await idbReq(
      tx.objectStore(STORE_AUDIO_JOB_ITEMS).index('jobId').getAll(IDBKeyRange.only(jobId))
    )) as OfflineAudioJobItem[];
    await done;
    return items.sort((a, b) => a.ordinal - b.ordinal);
  }

  async getStats(): Promise<OfflineAudioLibraryStats> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_FILES], 'readonly');
    const done = idbTx(tx);
    const [jobs, files] = await Promise.all([
      idbReq(tx.objectStore(STORE_AUDIO_JOBS).getAll()) as Promise<OfflineAudioJob[]>,
      idbReq(tx.objectStore(STORE_AUDIO_FILES).getAll()) as Promise<OfflineAudioFileRecord[]>
    ]);
    await done;
    const availableFiles = files.filter(f => f.available && !f.deletionPending);
    return {
      jobCount: jobs.length,
      availableFilesCount: availableFiles.length,
      totalBytes: availableFiles.reduce((sum, f) => sum + f.byteLength, 0)
    };
  }

  async enqueueDownloadJob(params: {
    scopeKind: OfflineAudioJobScopeKind;
    labelAr: string;
    reciterId: string;
    ranges: MemorizedAyahRange[];
    autoStart?: boolean;
  }): Promise<OfflineAudioJob> {
    const itemsSpec = buildMultiRangeDownloadItems(params.reciterId, params.ranges);
    const requestFingerprint = buildRequestFingerprint(params.scopeKind, params.reciterId, itemsSpec);
    const quota = await this.preflightQuota(params.reciterId, itemsSpec.length);
    if (!quota.allowed) {
      throw new Error(quota.messageAr || 'المساحة التخزينية المتاحة على الجهاز غير كافية.');
    }

    const job = await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const txRead = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_FILES], 'readonly');
      const txReadDone = idbTx(txRead);
      const [existingJobs, existingFiles] = await Promise.all([
        idbReq(
          txRead.objectStore(STORE_AUDIO_JOBS).index('requestFingerprint').getAll(IDBKeyRange.only(requestFingerprint))
        ) as Promise<OfflineAudioJob[]>,
        idbReq(txRead.objectStore(STORE_AUDIO_FILES).getAll()) as Promise<OfflineAudioFileRecord[]>
      ]);
      await txReadDone;

      const activeExisting = existingJobs.find(
        j => j.status === 'queued' || j.status === 'downloading' || j.status === 'paused' || j.status === 'partial'
      );
      if (activeExisting) {
        return activeExisting;
      }

      const fileMap = new Map(existingFiles.map(f => [f.fileKey, f]));
      const verifiedFileChecks = new Map<string, OfflineAudioFileRecord>();
      for (const spec of itemsSpec) {
        const candidate = fileMap.get(spec.fileKey);
        if (candidate && candidate.available && !candidate.deletionPending) {
          const validInCache = await this.verifyCacheEntry(candidate);
          if (validInCache) verifiedFileChecks.set(spec.fileKey, candidate);
        }
      }

      const now = Date.now();
      const jobId = `audjob-${createSecureId()}`;
      let completedItems = 0;
      let totalBytes = 0;

      const jobItems: OfflineAudioJobItem[] = itemsSpec.map((spec, ordinal) => {
        const cached = verifiedFileChecks.get(spec.fileKey);
        if (cached) {
          completedItems++;
          totalBytes += cached.byteLength;
        }
        return {
          itemKey: `${jobId}:${spec.fileKey}`,
          jobId,
          fileKey: spec.fileKey,
          reciterId: params.reciterId,
          surahNumber: spec.surahNumber,
          ayahNumber: spec.ayahNumber,
          globalAyahNumber: spec.globalAyahNumber,
          url: spec.url,
          ordinal,
          status: cached ? 'verified' : 'queued',
          cacheGenerationId: cached?.cacheGenerationId,
          schemaVersion: 1
        };
      });

      const initialStatus: OfflineAudioJobStatus =
        completedItems === itemsSpec.length ? 'completed' : 'queued';

      const newJob: OfflineAudioJob = {
        jobId,
        scopeKind: params.scopeKind,
        labelAr: params.labelAr,
        reciterId: params.reciterId,
        ranges: mergeMemorizedRanges(params.ranges),
        status: initialStatus,
        totalItems: itemsSpec.length,
        completedItems,
        failedItems: 0,
        totalBytes,
        requestFingerprint,
        createdAtMs: now,
        updatedAtMs: now,
        schemaVersion: 1
      };

      const txWrite = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      txWrite.objectStore(STORE_AUDIO_JOBS).put(newJob);
      const itemStore = txWrite.objectStore(STORE_AUDIO_JOB_ITEMS);
      for (const item of jobItems) {
        itemStore.put(item);
      }
      await idbTx(txWrite);
      return newJob;
    });

    this.notifyListeners();
    if (params.autoStart !== false && job.status !== 'completed') {
      void this.startOrResumeJob(job.jobId);
    }
    return job;
  }

  async pauseJob(jobId: string): Promise<void> {
    this.pausedJobs.add(jobId);
    const controllers = this.activeControllers.get(jobId);
    if (controllers) {
      for (const c of controllers) c.abort();
      controllers.clear();
    }

    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status === 'completed' || job.status === 'cancelled') {
        await idbTx(tx);
        return;
      }
      const items = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      for (const item of items) {
        if (item.status === 'downloading') {
          itemsStore.put({ ...item, status: 'queued' });
        }
      }
      jobsStore.put({ ...job, status: 'paused', updatedAtMs: Date.now() });
      await idbTx(tx);
    });
    this.broadcastJobSignal('pause', jobId);
    this.notifyListeners();
  }

  async cancelJob(jobId: string): Promise<void> {
    this.cancelledJobs.add(jobId);
    const controllers = this.activeControllers.get(jobId);
    if (controllers) {
      for (const c of controllers) c.abort();
      controllers.clear();
    }

    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status === 'completed' || job.status === 'cancelled') {
        await idbTx(tx);
        return;
      }
      const items = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      for (const item of items) {
        if (item.status === 'queued' || item.status === 'downloading' || item.status === 'failed') {
          itemsStore.put({ ...item, status: 'cancelled' });
        }
      }
      jobsStore.put({ ...job, status: 'cancelled', updatedAtMs: Date.now() });
      await idbTx(tx);
    });
    this.broadcastJobSignal('cancel', jobId);
    this.notifyListeners();
  }

  /**
   * Delete a job and any unreferenced audio files safely:
   * - Files still referenced by another job or pinned remain intact.
   * - Orphans are marked deletionPending, deleted from Cache Storage by exact cacheGenerationId,
   *   and finalized in IndexedDB only if not replaced by a newer generation.
   */
  async deleteJob(jobId: string): Promise<void> {
    this.cancelledJobs.add(jobId);
    const controllers = this.activeControllers.get(jobId);
    if (controllers) {
      for (const c of controllers) c.abort();
      controllers.clear();
    }

    const pendingOrphans: Array<{ fileKey: string; reciterId: string; globalAyahNumber: number; cacheGenerationId: string }> = [];

    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_FILES], 'readwrite');
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const filesStore = tx.objectStore(STORE_AUDIO_FILES);

      const jobItems = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      const candidateFileKeys = Array.from(new Set(jobItems.map(i => i.fileKey)));

      for (const item of jobItems) {
        itemsStore.delete(item.itemKey);
      }
      jobsStore.delete(jobId);

      // Check which files no longer have any jobItems pointing to them
      for (const fileKey of candidateFileKeys) {
        const remainingRefs = (await idbReq(
          itemsStore.index('fileKey').getAll(IDBKeyRange.only(fileKey))
        )) as OfflineAudioJobItem[];
        const stillReferenced = remainingRefs.some(ref => ref.jobId !== jobId);
        if (stillReferenced) continue;

        const file = (await idbReq(filesStore.get(fileKey))) as OfflineAudioFileRecord | undefined;
        if (!file || file.pinned) continue;

        filesStore.put({
          ...file,
          available: false,
          deletionPending: true
        } satisfies OfflineAudioFileRecord);
        pendingOrphans.push({
          fileKey: file.fileKey,
          reciterId: file.reciterId,
          globalAyahNumber: file.globalAyahNumber,
          cacheGenerationId: file.cacheGenerationId
        });
      }
      await idbTx(tx);
    });

    for (const orphan of pendingOrphans) {
      await this.finalizeOrphanDeletion(orphan);
    }
    this.broadcastJobSignal('cancel', jobId);
    this.notifyListeners();
  }

  private async finalizeOrphanDeletion(orphan: {
    fileKey: string;
    reciterId: string;
    globalAyahNumber: number;
    cacheGenerationId: string;
  }): Promise<void> {
    const cacheDeleted = await this.deleteCacheGeneration(
      orphan.reciterId,
      orphan.globalAyahNumber,
      orphan.cacheGenerationId
    );
    if (!cacheDeleted) return;

    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_FILES, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      const filesStore = tx.objectStore(STORE_AUDIO_FILES);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const current = (await idbReq(filesStore.get(orphan.fileKey))) as OfflineAudioFileRecord | undefined;
      if (!current) {
        await idbTx(tx);
        return;
      }
      const refs = (await idbReq(itemsStore.index('fileKey').getAll(IDBKeyRange.only(orphan.fileKey)))) as OfflineAudioJobItem[];
      if (current.deletionPending &&
          current.cacheGenerationId === orphan.cacheGenerationId &&
          !current.pinned &&
          refs.length === 0) {
        filesStore.delete(orphan.fileKey);
      }
      await idbTx(tx);
    });
    await this.deleteStagingRecord(buildCacheGenerationKey(
      orphan.reciterId, orphan.globalAyahNumber, orphan.cacheGenerationId
    )).catch(() => undefined);
  }

  async startOrResumeJob(jobId: string): Promise<OfflineAudioJob | null> {
    if (this.runningWorkers.has(jobId)) {
      await this.runningWorkers.get(jobId);
      const list = await this.listJobs();
      return list.find(j => j.jobId === jobId) ?? null;
    }

    this.pausedJobs.delete(jobId);
    this.cancelledJobs.delete(jobId);

    const workerPromise = this.runWithLock(`wird-offline-audio-worker:${jobId}`, () =>
      this.executeJobWorkerLocked(jobId, `wird-offline-audio-worker:${jobId}`)
    ).finally(() => {
      this.runningWorkers.delete(jobId);
      this.activeControllers.delete(jobId);
      this.notifyListeners();
    });
    this.runningWorkers.set(jobId, workerPromise);
    await workerPromise;

    const list = await this.listJobs();
    return list.find(j => j.jobId === jobId) ?? null;
  }

  private async executeJobWorkerLocked(jobId: string, workerLockName: string): Promise<void> {
    if (!this.fetchFn) {
      throw new Error('واجهة الشبكة غير متاحة لتحميل التلاوات.');
    }

    const db = await this.openDatabase();
    let initialJob: OfflineAudioJob | undefined;
    let itemsToRun: OfflineAudioJobItem[] = [];

    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      initialJob = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!initialJob || initialJob.status === 'completed' || initialJob.status === 'cancelled') {
        await idbTx(tx);
        return;
      }
      const allItems = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      itemsToRun = allItems
        .filter(item => item.status === 'queued' || item.status === 'failed' || item.status === 'downloading')
        .sort((a, b) => a.ordinal - b.ordinal);
      jobsStore.put({ ...initialJob, status: 'downloading', failedItems: 0, lastError: undefined, updatedAtMs: Date.now() });
      for (const item of itemsToRun) {
        if (item.status !== 'queued') itemsStore.put({ ...item, status: 'queued', lastError: undefined });
      }
      await idbTx(tx);
    });
    this.notifyListeners();

    if (!initialJob || initialJob.status === 'completed' || initialJob.status === 'cancelled') return;
    if (itemsToRun.length === 0) {
      await this.recomputeJobProgress(jobId);
      return;
    }

    const controllers = new Set<AbortController>();
    this.activeControllers.set(jobId, controllers);
    let cursor = 0;

    const runOne = async (): Promise<void> => {
      while (cursor < itemsToRun.length) {
        if (this.pausedJobs.has(jobId) || this.cancelledJobs.has(jobId)) return;
        if ((await this.getPersistedJobStatus(jobId)) !== 'downloading') return;
        if (!(await this.hasCurrentLease(workerLockName))) return;
        const item = itemsToRun[cursor++];
        if (!item) return;

        // Check if file already cached by another concurrent/previous job
        const existingValid = await this.checkReusableFile(item.fileKey);
        if (existingValid) {
          const committed = await this.markJobItemVerified(jobId, item, existingValid, existingValid.byteLength);
          if (!committed) return;
          this.notifyListeners();
          continue;
        }

        if (!isApprovedCdnAudioUrl(item.url, item.globalAyahNumber, item.reciterId)) {
          await this.markJobItemFailed(jobId, item, 'رابط التلاوة خارج النطاق المعتمد.');
          this.notifyListeners();
          continue;
        }

        const controller = new AbortController();
        controllers.add(controller);
        try {
          // Read audio through WIRD's same-origin relay. The upstream CDN is suitable for
          // <audio> streaming, but browser fetch() may be blocked when CORS headers are absent.
          const downloadUrl = '/api/quran-audio-download?reciter=' +
            encodeURIComponent(item.reciterId) + '&ayah=' + String(item.globalAyahNumber);
          const response = await this.fetchFn!(downloadUrl, {
            method: 'GET',
            redirect: 'error',
            credentials: 'same-origin',
            cache: 'no-store',
            signal: controller.signal
          });
          if (response.status !== 200 || response.type === 'opaque') {
            throw new Error(`استجابة غير صالحة من مصدر التلاوة (${response.status}).`);
          }
          const contentType = (response.headers.get('content-type') || '').toLowerCase();
          if (!contentType.startsWith('audio/')) {
            throw new Error('نوع الملف المستلم ليس ملفاً صوتياً معتمداً.');
          }
          const declaredLength = response.headers.get('content-length');
          if (declaredLength !== null && declaredLength !== '') {
            const numericDeclared = Number(declaredLength);
            if (!Number.isFinite(numericDeclared) || numericDeclared <= 0 || numericDeclared > MAX_AUDIO_FILE_BYTES) {
              throw new Error('حجم ملف التلاوة يتجاوز الحد الأقصى المسموح (8 م.ب).');
            }
          }
          const buffer = await response.arrayBuffer();
          const bytes = new Uint8Array(buffer);
          if (bytes.byteLength === 0 || bytes.byteLength > MAX_AUDIO_FILE_BYTES) {
            throw new Error('حجم ملف التلاوة المستلم فارغ أو يتجاوز الحد المسموح.');
          }
          if (declaredLength !== null && declaredLength !== '' && Number(declaredLength) !== bytes.byteLength) {
            throw new Error('حجم بايتات التلاوة لا يطابق Content-Length.');
          }
          if ((await this.getPersistedJobStatus(jobId)) !== 'downloading') return;
          if (!(await this.hasCurrentLease(workerLockName))) return;

          const cacheGenerationId = createSecureId();
          const cacheKey = buildCacheGenerationKey(item.reciterId, item.globalAyahNumber, cacheGenerationId);
          await this.putStagingRecord({
            cacheKey,
            kind: 'download',
            fileKey: item.fileKey,
            reciterId: item.reciterId,
            globalAyahNumber: item.globalAyahNumber,
            cacheGenerationId,
            jobId,
            createdAtMs: Date.now(),
            schemaVersion: 1
          });
          try {
            await this.writeAndVerifyCacheEntry(
              item.reciterId,
              item.globalAyahNumber,
              cacheGenerationId,
              bytes,
              contentType
            );
            if ((await this.getPersistedJobStatus(jobId)) !== 'downloading' || !(await this.hasCurrentLease(workerLockName))) {
              const deleted = await this.deleteCacheGeneration(item.reciterId, item.globalAyahNumber, cacheGenerationId);
              if (deleted) await this.deleteStagingRecord(cacheKey).catch(() => undefined);
              return;
            }
          } catch (cacheErr) {
            const deleted = await this.deleteCacheGeneration(item.reciterId, item.globalAyahNumber, cacheGenerationId);
            if (deleted) await this.deleteStagingRecord(cacheKey).catch(() => undefined);
            throw cacheErr;
          }

          const verifiedRecord: OfflineAudioFileRecord = {
            fileKey: item.fileKey,
            reciterId: item.reciterId,
            surahNumber: item.surahNumber,
            ayahNumber: item.ayahNumber,
            globalAyahNumber: item.globalAyahNumber,
            url: item.url,
            cacheGenerationId,
            byteLength: bytes.byteLength,
            contentType,
            available: true,
            pinned: false,
            deletionPending: false,
            verifiedAtMs: Date.now(),
            schemaVersion: 1
          };

          try {
            const committed = await this.markJobItemVerified(jobId, item, verifiedRecord, bytes.byteLength);
            if (!committed) {
              const deleted = await this.deleteCacheGeneration(item.reciterId, item.globalAyahNumber, cacheGenerationId);
              if (deleted) await this.deleteStagingRecord(cacheKey).catch(() => undefined);
              return;
            }
            await this.deleteStagingRecord(cacheKey).catch(() => undefined);
          } catch (idbErr) {
            // Roll back only the unreferenced cache entry we just wrote; keep staging if deletion fails.
            const deleted = await this.deleteCacheGeneration(item.reciterId, item.globalAyahNumber, cacheGenerationId);
            if (deleted) await this.deleteStagingRecord(cacheKey).catch(() => undefined);
            throw idbErr;
          }
          this.notifyListeners();
        } catch (err) {
          if (this.pausedJobs.has(jobId) || this.cancelledJobs.has(jobId) ||
              (err instanceof Error && err.name === 'AbortError')) {
            return;
          }
          await this.markJobItemFailed(
            jobId,
            item,
            err instanceof Error ? err.message : 'تعذر تحميل الآية.'
          );
          this.notifyListeners();
        } finally {
          controllers.delete(controller);
        }
      }
    };

    const workers = Array.from({ length: Math.min(this.concurrency, itemsToRun.length) }, () => runOne());
    await Promise.all(workers);

    if (!this.pausedJobs.has(jobId) && !this.cancelledJobs.has(jobId) &&
        (await this.getPersistedJobStatus(jobId)) === 'downloading') {
      await this.recomputeJobProgress(jobId);
    }
  }

  private async checkReusableFile(fileKey: string): Promise<OfflineAudioFileRecord | null> {
    const db = await this.openDatabase();
    const tx = db.transaction([STORE_AUDIO_FILES], 'readonly');
    const done = idbTx(tx);
    const file = (await idbReq(tx.objectStore(STORE_AUDIO_FILES).get(fileKey))) as OfflineAudioFileRecord | undefined;
    await done;
    if (!file || !file.available || file.deletionPending) return null;
    const verified = await this.verifyCacheEntry(file);
    return verified ? file : null;
  }

  private async markJobItemVerified(
    jobId: string,
    item: OfflineAudioJobItem,
    fileRecord: OfflineAudioFileRecord,
    _byteLength: number
  ): Promise<boolean> {
    let committed = false;
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_FILES, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_JOBS], 'readwrite');
      const filesStore = tx.objectStore(STORE_AUDIO_FILES);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);

      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status !== 'downloading') {
        await idbTx(tx);
        return;
      }
      filesStore.put(fileRecord);
      itemsStore.put({
        ...item,
        status: 'verified',
        cacheGenerationId: fileRecord.cacheGenerationId,
        lastError: undefined
      } satisfies OfflineAudioJobItem);

      const allItems = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      const completed = allItems.filter(i => i.itemKey === item.itemKey ? true : i.status === 'verified').length;
      const failed = allItems.filter(i => i.itemKey === item.itemKey ? false : i.status === 'failed').length;
      jobsStore.put({
        ...job,
        completedItems: completed,
        failedItems: failed,
        totalBytes: await this.sumJobVerifiedBytes(itemsStore, filesStore, jobId, item.itemKey, fileRecord.byteLength),
        updatedAtMs: Date.now()
      } satisfies OfflineAudioJob);
      await idbTx(tx);
      committed = true;
    });
    return committed;
  }

  private async sumJobVerifiedBytes(
    itemsStore: IDBObjectStore,
    filesStore: IDBObjectStore,
    jobId: string,
    justVerifiedItemKey: string,
    justVerifiedBytes: number
  ): Promise<number> {
    const items = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
    let sum = 0;
    for (const entry of items) {
      if (entry.itemKey === justVerifiedItemKey) {
        sum += justVerifiedBytes;
      } else if (entry.status === 'verified') {
        const file = (await idbReq(filesStore.get(entry.fileKey))) as OfflineAudioFileRecord | undefined;
        if (file) sum += file.byteLength;
      }
    }
    return sum;
  }

  private async markJobItemFailed(jobId: string, item: OfflineAudioJobItem, errorMsg: string): Promise<void> {
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_JOBS], 'readwrite');
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status === 'cancelled' || job.status === 'paused') {
        await idbTx(tx);
        return;
      }
      itemsStore.put({
        ...item,
        status: 'failed',
        lastError: errorMsg
      } satisfies OfflineAudioJobItem);
      jobsStore.put({
        ...job,
        failedItems: job.failedItems + 1,
        lastError: errorMsg,
        updatedAtMs: Date.now()
      } satisfies OfflineAudioJob);
      await idbTx(tx);
    });
  }

  private async recomputeJobProgress(jobId: string): Promise<void> {
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_FILES], 'readwrite');
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const filesStore = tx.objectStore(STORE_AUDIO_FILES);

      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status === 'cancelled' || job.status === 'paused') {
        await idbTx(tx);
        return;
      }
      const items = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
      let completed = 0;
      let failed = 0;
      let totalBytes = 0;
      for (const item of items) {
        if (item.status === 'verified') {
          const f = (await idbReq(filesStore.get(item.fileKey))) as OfflineAudioFileRecord | undefined;
          if (f && f.available && !f.deletionPending) {
            completed++;
            totalBytes += f.byteLength;
          } else {
            itemsStore.put({ ...item, status: 'queued' });
          }
        } else if (item.status === 'failed') {
          failed++;
        }
      }

      let nextStatus: OfflineAudioJobStatus;
      if (completed === items.length) nextStatus = 'completed';
      else if (completed > 0 && failed > 0) nextStatus = 'partial';
      else if (failed === items.length) nextStatus = 'failed';
      else if (completed > 0) nextStatus = 'partial';
      else nextStatus = 'queued';

      jobsStore.put({
        ...job,
        status: nextStatus,
        completedItems: completed,
        failedItems: failed,
        totalBytes,
        updatedAtMs: Date.now()
      } satisfies OfflineAudioJob);
      await idbTx(tx);
    });
  }

  /**
   * Startup / post-eviction reconciliation:
   * - Verifies every available canonical file still exists in Cache Storage.
   * - Marks evicted entries unavailable without silent data fabrication.
   * - Re-queues evicted items and recovers jobs interrupted by a closed/crashed tab.
   * - Retries pending orphan deletions.
   */
  async reconcileLibrary(): Promise<{ evictedCount: number; cleanedOrphansCount: number }> {
    let evictedCount = 0;
    let cleanedStagedOrphansCount = 0;
    const orphansToFinalize: Array<{
      fileKey: string;
      reciterId: string;
      globalAyahNumber: number;
      cacheGenerationId: string;
    }> = [];

    const db = await this.openDatabase();
    const txRead = db.transaction([STORE_AUDIO_FILES, STORE_AUDIO_STAGING, STORE_AUDIO_LOCKS, STORE_AUDIO_JOBS], 'readonly');
    const filesDone = idbTx(txRead);
    const [allFiles, allStaging, allLocks, allJobs] = await Promise.all([
      idbReq(txRead.objectStore(STORE_AUDIO_FILES).getAll()) as Promise<OfflineAudioFileRecord[]>,
      idbReq(txRead.objectStore(STORE_AUDIO_STAGING).getAll()) as Promise<OfflineAudioStagingRecord[]>,
      idbReq(txRead.objectStore(STORE_AUDIO_LOCKS).getAll()) as Promise<OfflineAudioLockRecord[]>,
      idbReq(txRead.objectStore(STORE_AUDIO_JOBS).getAll()) as Promise<OfflineAudioJob[]>
    ]);
    await filesDone;

    const missingGenerationByKey = new Map<string, string>();
    for (const file of allFiles) {
      if (file.deletionPending) {
        orphansToFinalize.push({
          fileKey: file.fileKey,
          reciterId: file.reciterId,
          globalAyahNumber: file.globalAyahNumber,
          cacheGenerationId: file.cacheGenerationId
        });
        continue;
      }
      if (file.available) {
        const ok = await this.verifyCacheEntry(file);
        if (!ok) missingGenerationByKey.set(file.fileKey, file.cacheGenerationId);
      }
    }

    if (missingGenerationByKey.size > 0) {
      await this.runWithLock('wird-offline-audio-jobs', async () => {
        const tx = db.transaction([STORE_AUDIO_FILES, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_JOBS], 'readwrite');
        const filesStore = tx.objectStore(STORE_AUDIO_FILES);
        const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
        const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
        const touchedJobIds = new Set<string>();

        for (const [fileKey, scannedGen] of missingGenerationByKey) {
          const latest = (await idbReq(filesStore.get(fileKey))) as OfflineAudioFileRecord | undefined;
          // Race guard: never mark a newer replacement generation unavailable
          if (!latest || latest.cacheGenerationId !== scannedGen) continue;
          filesStore.put({ ...latest, available: false });
          evictedCount++;
          const refs = (await idbReq(itemsStore.index('fileKey').getAll(IDBKeyRange.only(fileKey)))) as OfflineAudioJobItem[];
          for (const ref of refs) {
            const job = (await idbReq(jobsStore.get(ref.jobId))) as OfflineAudioJob | undefined;
            if (job && job.status !== 'completed' && job.status !== 'cancelled' && ref.status === 'verified') {
              itemsStore.put({ ...ref, status: 'queued' });
              touchedJobIds.add(ref.jobId);
            }
          }
        }

        for (const jobId of touchedJobIds) {
          const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
          if (!job) continue;
          const items = (await idbReq(itemsStore.index('jobId').getAll(IDBKeyRange.only(jobId)))) as OfflineAudioJobItem[];
          const completed = items.filter(i => i.status === 'verified').length;
          jobsStore.put({
            ...job,
            completedItems: completed,
            status: completed > 0 ? 'partial' : 'queued',
            updatedAtMs: Date.now()
          });
        }
        await idbTx(tx);
      });
    }

    // A hard browser/tab close can leave a durable job in "downloading" with
    // one item marked "downloading". Acquire that job's worker lock before
    // normalizing it: this waits for a genuinely active tab to finish, while
    // allowing a crashed worker's expired lease to be recovered safely.
    const interruptedJobs = allJobs.filter(job => job.status === 'downloading');
    for (const interruptedJob of interruptedJobs) {
      const workerLockName = `wird-offline-audio-worker:${interruptedJob.jobId}`;
      await this.runWithLock(workerLockName, async () => {
        await this.runWithLock('wird-offline-audio-jobs', async () => {
          const recoveryDb = await this.openDatabase();
          const tx = recoveryDb.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_FILES], 'readwrite');
          const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);
          const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
          const filesStore = tx.objectStore(STORE_AUDIO_FILES);
          const latestJob = (await idbReq(jobsStore.get(interruptedJob.jobId))) as OfflineAudioJob | undefined;
          if (!latestJob || latestJob.status !== 'downloading') {
            await idbTx(tx);
            return;
          }

          const items = (await idbReq(itemsStore.index('jobId').getAll(
            IDBKeyRange.only(interruptedJob.jobId)
          ))) as OfflineAudioJobItem[];
          let completedItems = 0;
          let failedItems = 0;
          let totalBytes = 0;

          for (const item of items) {
            if (item.status === 'downloading') {
              itemsStore.put({ ...item, status: 'queued' });
              continue;
            }
            if (item.status === 'failed') {
              failedItems++;
              continue;
            }
            if (item.status !== 'verified') continue;

            const file = (await idbReq(filesStore.get(item.fileKey))) as OfflineAudioFileRecord | undefined;
            if (file && file.available && !file.deletionPending) {
              completedItems++;
              totalBytes += file.byteLength;
            } else {
              itemsStore.put({ ...item, status: 'queued', cacheGenerationId: undefined });
            }
          }

          let recoveredStatus: OfflineAudioJobStatus;
          if (completedItems === items.length) recoveredStatus = 'completed';
          else if (completedItems > 0) recoveredStatus = 'partial';
          else if (failedItems === items.length) recoveredStatus = 'failed';
          else recoveredStatus = 'queued';

          jobsStore.put({
            ...latestJob,
            status: recoveredStatus,
            completedItems,
            failedItems,
            totalBytes,
            lastError: failedItems > 0 ? latestJob.lastError : undefined,
            updatedAtMs: Date.now()
          } satisfies OfflineAudioJob);
          await idbTx(tx);
        });
      });
    }

    for (const orphan of orphansToFinalize) {
      await this.finalizeOrphanDeletion(orphan);
    }

    const fileByCacheKey = new Map(allFiles.map(file => [
      buildCacheGenerationKey(file.reciterId, file.globalAyahNumber, file.cacheGenerationId),
      file
    ]));
    const stagedCacheKeys = new Set(allStaging.map(record => record.cacheKey));
    const knownCacheKeys = new Set(fileByCacheKey.keys());
    const activeWorkerLocks = new Set(allLocks
      .filter(lock => lock.expiresAtMs > Date.now())
      .map(lock => lock.lockName));

    if (this.cacheStorageFactory) {
      const cache = await this.openAudioCache();
      const now = Date.now();
      for (const record of allStaging) {
        const file = fileByCacheKey.get(record.cacheKey);
        if (file && file.available && !file.deletionPending &&
            record.cacheGenerationId && file.cacheGenerationId === record.cacheGenerationId) {
          await this.deleteStagingRecord(record.cacheKey).catch(() => undefined);
          stagedCacheKeys.delete(record.cacheKey);
          continue;
        }
        if (file?.deletionPending) continue; // handled by the reference-aware deletion journal above
        if (record.kind === 'download' && record.jobId &&
            activeWorkerLocks.has(`wird-offline-audio-worker:${record.jobId}`)) continue;
        const graceMs = record.kind === 'download' ? this.stagingGraceMs : this.orphanGraceMs;
        if (now - record.createdAtMs < graceMs) continue;
        try {
          await cache.delete(record.cacheKey);
          const remaining = await cache.match(record.cacheKey);
          if (!remaining) {
            await this.deleteStagingRecord(record.cacheKey);
            stagedCacheKeys.delete(record.cacheKey);
            cleanedStagedOrphansCount++;
          }
        } catch {
          // Keep the durable staging record; the next reconciliation retries safely.
        }
      }

      // Discover pre-v3 orphan keys that have no file metadata or staging record.
      // They are staged now and deleted only after the conservative orphan grace period.
      if (cache.keys) {
        try {
          const cacheKeys = await cache.keys();
          for (const request of cacheKeys) {
            const cacheKey = typeof request === 'string' ? request : request.url;
            if (knownCacheKeys.has(cacheKey) || stagedCacheKeys.has(cacheKey)) continue;
            await this.putStagingRecord({ cacheKey, kind: 'orphan', createdAtMs: now, schemaVersion: 1 });
            stagedCacheKeys.add(cacheKey);
          }
        } catch {
          // Enumeration is best-effort; explicit staging records remain recoverable.
        }
      }
    }

    this.notifyListeners();
    return { evictedCount, cleanedOrphansCount: orphansToFinalize.length + cleanedStagedOrphansCount };
  }

  /**
   * Local-first playback resolver:
   * Checks canonical verified file + Cache Storage generation and returns a revocable ObjectURL;
   * falls back to the provided approved network URL if absent or evicted.
   */
  async resolvePlaybackSource(
    approvedReciterId: string | null,
    globalAyahNumber: number,
    fallbackNetworkUrl: string
  ): Promise<ResolvedLocalAudioPlayback> {
    if (!approvedReciterId || !this.factory || !this.cacheStorageFactory) {
      return { sourceKind: 'network', src: fallbackNetworkUrl };
    }
    try {
      const fileKey = buildCanonicalAudioFileKey(approvedReciterId, globalAyahNumber);
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_FILES], 'readonly');
      const done = idbTx(tx);
      const file = (await idbReq(tx.objectStore(STORE_AUDIO_FILES).get(fileKey))) as OfflineAudioFileRecord | undefined;
      await done;

      if (file && file.available && !file.deletionPending && file.cacheGenerationId) {
        const cache = await this.openAudioCache();
        const cacheKey = buildCacheGenerationKey(file.reciterId, file.globalAyahNumber, file.cacheGenerationId);
        const match = await cache.match(cacheKey);
        if (match && match.status === 200 && match.type !== 'opaque') {
          const blob = await match.blob();
          if (blob.size > 0 && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
            const objectUrl = URL.createObjectURL(blob);
            return {
              sourceKind: 'local-cache',
              src: objectUrl,
              revoke: () => {
                try { URL.revokeObjectURL(objectUrl); } catch { /* ignore */ }
              }
            };
          }
        }
      }
    } catch {
      // Fall back safely to network playback when local cache lookup fails
    }

    return { sourceKind: 'network', src: fallbackNetworkUrl };
  }
}

export const offlineQuranAudioLibrary = new OfflineQuranAudioLibrary();

export function getSurahEstimatedSizeLabel(reciterId: string, surahNumber: number): string {
  const surah = ALL_SURAHS[surahNumber - 1];
  const verses = surah?.versesCount ?? 0;
  const mb = estimateAudioDownloadBytes(reciterId, verses) / (1024 * 1024);
  return mb < 1 ? `${Math.max(100, Math.round(mb * 1024))} ك.ب` : `${mb.toFixed(1)} م.ب`;
}
