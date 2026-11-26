import { ALL_SURAHS } from '../data/quranMeta';
import { getJuzAyahRanges, mergeMemorizedRanges, type MemorizedAyahRange } from './memorizedRangeService';
import { buildQuranAudioDownloadPlan } from './offlineQuranAudioDownload';
import type { EngineGeneratedPlan } from './planningEngine';
import { buildQuranAyahAudioUrl, FALLBACK_QURAN_RECITERS } from './ruqyahAudioService';
import { createSecureId } from './secureId';

export const OFFLINE_AUDIO_DB_NAME = 'wird-offline-audio';
export const OFFLINE_AUDIO_DB_VERSION = 1;
export const OFFLINE_AUDIO_CACHE_NAME = 'wird-offline-quran-audio-v1';
export const MAX_AUDIO_FILE_BYTES = 8 * 1024 * 1024;
export const APP_STORAGE_RESERVE_BYTES = 25 * 1024 * 1024;
export const DEFAULT_AUDIO_DOWNLOAD_CONCURRENCY = 6;

export const STORE_AUDIO_JOBS = 'jobs';
export const STORE_AUDIO_FILES = 'files';
export const STORE_AUDIO_JOB_ITEMS = 'jobItems';

export type OfflineAudioJobStatus =
  | 'queued'
  | 'downloading'
  | 'paused'
  | 'partial'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type OfflineAudioJobScopeKind = 'surah' | 'juz' | 'plan' | 'range' | 'ruqyah';

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

export interface OfflineAudioLibraryDeps {
  indexedDBFactory?: IDBFactory;
  databaseName?: string;
  cacheStorageFactory?: CacheStorageLike;
  cacheName?: string;
  fetchFn?: typeof fetch;
  storageEstimateFn?: () => Promise<StorageEstimate>;
  lockRunner?: <T>(name: string, task: () => Promise<T>) => Promise<T>;
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
  const first = items[0]?.globalAyahNumber ?? 0;
  const last = items[items.length - 1]?.globalAyahNumber ?? 0;
  return `${scopeKind}:${reciterId}:${items.length}:${first}:${last}`;
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
    const requestedConcurrency = deps.concurrency ?? DEFAULT_AUDIO_DOWNLOAD_CONCURRENCY;
    this.concurrency = Math.max(1, Math.min(6, requestedConcurrency));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch { /* ignore listener errors */ }
    }
  }

  private async runWithLock<T>(lockName: string, task: () => Promise<T>): Promise<T> {
    if (this.lockRunner) return this.lockRunner(lockName, task);
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
      return navigator.locks.request(lockName, { mode: 'exclusive' }, task);
    }
    return task();
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

      req.onupgradeneeded = () => {
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

  /** Fast lookup of all verified offline globalAyahNumbers for a given reciter. */
  async getAvailableGlobalAyahsForReciter(reciterId: string): Promise<Set<number>> {
    if (!reciterId || !this.factory) return new Set();
    try {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_FILES], 'readonly');
      const done = idbTx(tx);
      const files = (await idbReq(
        tx.objectStore(STORE_AUDIO_FILES).index('reciterId').getAll(IDBKeyRange.only(reciterId))
      )) as OfflineAudioFileRecord[];
      await done;
      const result = new Set<number>();
      for (const f of files) {
        if (f.available && !f.deletionPending) {
          result.add(f.globalAyahNumber);
        }
      }
      return result;
    } catch {
      return new Set();
    }
  }

  /** Automatically resume interrupted (queued / partial / failed) jobs when network connectivity returns. */
  async resumeInterruptedJobsOnReconnect(): Promise<number> {
    if (!this.factory) return 0;
    try {
      const jobs = await this.listJobs();
      const candidates = jobs.filter(
        j =>
          (j.status === 'partial' || j.status === 'failed' || j.status === 'queued') &&
          !this.pausedJobs.has(j.jobId) &&
          !this.cancelledJobs.has(j.jobId) &&
          !this.runningWorkers.has(j.jobId)
      );
      for (const job of candidates) {
        void this.startOrResumeJob(job.jobId).catch(() => undefined);
      }
      return candidates.length;
    } catch {
      return 0;
    }
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
  }

  async startOrResumeJob(jobId: string): Promise<OfflineAudioJob | null> {
    if (this.runningWorkers.has(jobId)) {
      await this.runningWorkers.get(jobId);
      const list = await this.listJobs();
      return list.find(j => j.jobId === jobId) ?? null;
    }

    this.pausedJobs.delete(jobId);
    this.cancelledJobs.delete(jobId);

    const workerPromise = this.runWithLock(`wird-offline-audio-job-worker:${jobId}`, () =>
      this.executeJobWorker(jobId)
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

  private async executeJobWorker(jobId: string): Promise<void> {
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
        const item = itemsToRun[cursor++];
        if (!item) return;

        // Check if file already cached by another concurrent/previous job
        const existingValid = await this.checkReusableFile(item.fileKey);
        if (existingValid) {
          await this.markJobItemVerified(jobId, item, existingValid, existingValid.byteLength);
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
          let response: Response | null = null;
          let lastNetErr: unknown = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              response = await this.fetchFn!(item.url, {
                method: 'GET',
                mode: 'cors',
                redirect: 'error',
                credentials: 'omit',
                cache: 'no-store',
                signal: controller.signal
              });
              if (response.status >= 500 && attempt === 0) {
                await new Promise(r => setTimeout(r, 320));
                continue;
              }
              break;
            } catch (fetchErr) {
              lastNetErr = fetchErr;
              if (
                this.pausedJobs.has(jobId) ||
                this.cancelledJobs.has(jobId) ||
                (fetchErr instanceof Error && fetchErr.name === 'AbortError')
              ) {
                throw fetchErr;
              }
              if (attempt === 0) {
                await new Promise(r => setTimeout(r, 320));
              }
            }
          }
          if (!response) {
            throw lastNetErr instanceof Error ? lastNetErr : new Error('تعذر الاتصال بمصدر التلاوة.');
          }
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

          const cacheGenerationId = createSecureId();
          await this.writeAndVerifyCacheEntry(
            item.reciterId,
            item.globalAyahNumber,
            cacheGenerationId,
            bytes,
            contentType
          );

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
            await this.markJobItemVerified(jobId, item, verifiedRecord, bytes.byteLength);
          } catch (idbErr) {
            // Roll back only the unreferenced cache entry we just wrote
            await this.deleteCacheGeneration(item.reciterId, item.globalAyahNumber, cacheGenerationId);
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

    if (!this.pausedJobs.has(jobId) && !this.cancelledJobs.has(jobId)) {
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
  ): Promise<void> {
    let displacedGenerationId: string | null = null;
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const db = await this.openDatabase();
      const tx = db.transaction([STORE_AUDIO_FILES, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_JOBS], 'readwrite');
      const filesStore = tx.objectStore(STORE_AUDIO_FILES);
      const itemsStore = tx.objectStore(STORE_AUDIO_JOB_ITEMS);
      const jobsStore = tx.objectStore(STORE_AUDIO_JOBS);

      const job = (await idbReq(jobsStore.get(jobId))) as OfflineAudioJob | undefined;
      if (!job || job.status === 'cancelled') {
        await idbTx(tx);
        return;
      }
      const existingFile = (await idbReq(filesStore.get(fileRecord.fileKey))) as OfflineAudioFileRecord | undefined;
      if (existingFile && existingFile.cacheGenerationId && existingFile.cacheGenerationId !== fileRecord.cacheGenerationId) {
        displacedGenerationId = existingFile.cacheGenerationId;
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
    });

    if (displacedGenerationId) {
      await this.deleteCacheGeneration(fileRecord.reciterId, fileRecord.globalAyahNumber, displacedGenerationId);
    }
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
   * - Re-queues evicted items for non-terminal jobs; retries pending orphan deletions.
   */
  async reconcileLibrary(): Promise<{ evictedCount: number; cleanedOrphansCount: number }> {
    let evictedCount = 0;
    const orphansToFinalize: Array<{
      fileKey: string;
      reciterId: string;
      globalAyahNumber: number;
      cacheGenerationId: string;
    }> = [];

    const db = await this.openDatabase();
    const txRead = db.transaction([STORE_AUDIO_FILES], 'readonly');
    const filesDone = idbTx(txRead);
    const allFiles = (await idbReq(txRead.objectStore(STORE_AUDIO_FILES).getAll())) as OfflineAudioFileRecord[];
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

    let cleanedOrphansCount = orphansToFinalize.length;
    for (const orphan of orphansToFinalize) {
      await this.finalizeOrphanDeletion(orphan);
    }

    // Recover jobs stuck in 'downloading' from a previous closed tab/reload where no worker is active
    await this.runWithLock('wird-offline-audio-jobs', async () => {
      const txStale = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS], 'readwrite');
      const jobsStore = txStale.objectStore(STORE_AUDIO_JOBS);
      const itemsStore = txStale.objectStore(STORE_AUDIO_JOB_ITEMS);
      const allJobs = (await idbReq(jobsStore.getAll())) as OfflineAudioJob[];
      for (const job of allJobs) {
        if (job.status === 'downloading' && !this.runningWorkers.has(job.jobId)) {
          const items = (await idbReq(
            itemsStore.index('jobId').getAll(IDBKeyRange.only(job.jobId))
          )) as OfflineAudioJobItem[];
          let verifiedCount = 0;
          for (const it of items) {
            if (it.status === 'verified') verifiedCount++;
            else if (it.status === 'downloading') {
              itemsStore.put({ ...it, status: 'queued' });
            }
          }
          jobsStore.put({
            ...job,
            completedItems: verifiedCount,
            status: verifiedCount === items.length && items.length > 0
              ? 'completed'
              : verifiedCount > 0
                ? 'partial'
                : 'queued',
            updatedAtMs: Date.now()
          });
        }
      }
      await idbTx(txStale);
    });

    // Sweep any unindexed Cache Storage generation entries not referenced by active STORE_AUDIO_FILES
    if (this.cacheStorageFactory) {
      try {
        const cache = await this.openAudioCache();
        if (typeof cache.keys === 'function') {
          const txVerify = db.transaction([STORE_AUDIO_FILES], 'readonly');
          const verifyDone = idbTx(txVerify);
          const remainingFiles = (await idbReq(
            txVerify.objectStore(STORE_AUDIO_FILES).getAll()
          )) as OfflineAudioFileRecord[];
          await verifyDone;

          const activeCacheKeys = new Set(
            remainingFiles
              .filter(f => f.available && !f.deletionPending && Boolean(f.cacheGenerationId))
              .map(f => buildCacheGenerationKey(f.reciterId, f.globalAyahNumber, f.cacheGenerationId))
          );

          const cachedRequests = await cache.keys();
          for (const req of cachedRequests) {
            const rawKey = typeof req === 'string' ? req : req.url;
            if (
              rawKey.startsWith('https://wird.local/offline-audio/') &&
              !activeCacheKeys.has(rawKey)
            ) {
              const deleted = await cache.delete(rawKey);
              if (deleted) cleanedOrphansCount++;
            }
          }
        }
      } catch {
        // Ignore non-fatal Cache Storage enumeration errors
      }
    }

    this.notifyListeners();
    return { evictedCount, cleanedOrphansCount };
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
