import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  OfflineQuranAudioLibrary,
  STORE_AUDIO_FILES,
  STORE_AUDIO_JOB_ITEMS,
  STORE_AUDIO_JOBS,
  STORE_AUDIO_LOCKS,
  STORE_AUDIO_STAGING,
  OFFLINE_AUDIO_CACHE_NAME,
  buildCacheGenerationKey,
  type CacheStorageLike
} from './offlineQuranAudioLibrary';
import { computeGlobalAyahNumber } from './audioService';

function createMockCacheStorage(options: { rejectWrites?: boolean } = {}) {
  const stores = new Map<string, Map<string, { body: Uint8Array; status: number; contentType: string }>>();

  const ensureStore = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };

  const factory: CacheStorageLike = {
    async open(cacheName: string) {
      const store = ensureStore(cacheName);
      return {
        async put(req: Request | string, res: Response) {
          if (options.rejectWrites) throw new Error('Simulated cache write failure');
          const key = typeof req === 'string' ? req : req.url;
          const bytes = new Uint8Array(await res.arrayBuffer());
          store.set(key, {
            body: bytes,
            status: res.status,
            contentType: res.headers.get('content-type') || 'audio/mpeg'
          });
        },
        async match(req: Request | string) {
          const key = typeof req === 'string' ? req : req.url;
          const entry = store.get(key);
          if (!entry) return undefined;
          const payload = new Uint8Array(entry.body.byteLength);
          payload.set(entry.body);
          return new Response(payload.buffer, {
            status: entry.status,
            headers: {
              'Content-Type': entry.contentType,
              'Content-Length': String(payload.byteLength)
            }
          });
        },
        async delete(req: Request | string) {
          const key = typeof req === 'string' ? req : req.url;
          return store.delete(key);
        },
        async keys() {
          return Array.from(store.keys()).map(key => new Request(key));
        }
      };
    }
  };

  return { factory, stores, ensureStore };
}

export async function runOfflineQuranAudioLibraryTests(): Promise<{ passed: number; failed: number }> {
  let passed = 0;
  let failed = 0;
  let dbCounter = 0;

  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error(msg);
  };

  const test = async (name: string, fn: () => Promise<void> | void) => {
    try {
      await fn();
      passed++;
      console.log(`  ✅ ${name}`);
    } catch (error: any) {
      failed++;
      console.error(`  ❌ ${name}: ${error?.message || error}`);
    }
  };

  await test('Version-1 audio databases upgrade safely to cross-tab lock and staging stores', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-upgrade-${++dbCounter}`;
    const request = factory.open(databaseName, 1);
    const oldDb = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const db = request.result;
        const jobs = db.createObjectStore('jobs', { keyPath: 'jobId' });
        jobs.createIndex('status', 'status', { unique: false });
        jobs.createIndex('createdAtMs', 'createdAtMs', { unique: false });
        jobs.createIndex('requestFingerprint', 'requestFingerprint', { unique: false });
        const files = db.createObjectStore('files', { keyPath: 'fileKey' });
        files.createIndex('reciterId', 'reciterId', { unique: false });
        files.createIndex('available', 'available', { unique: false });
        files.createIndex('deletionPending', 'deletionPending', { unique: false });
        const items = db.createObjectStore('jobItems', { keyPath: 'itemKey' });
        items.createIndex('jobId', 'jobId', { unique: false });
        items.createIndex('fileKey', 'fileKey', { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    oldDb.close();

    const lib = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName, lockManager: null });
    await lib.getStats();
    const upgraded = await (lib as any).openDatabase() as IDBDatabase;
    assert(upgraded.objectStoreNames.contains(STORE_AUDIO_LOCKS), 'Upgrade must add the cross-tab locks store');
    assert(upgraded.objectStoreNames.contains(STORE_AUDIO_STAGING), 'Upgrade must add the crash-recovery staging store');
    upgraded.close();
  });

  await test('Different disjoint ayah ranges with identical count and endpoints never share a download-job fingerprint', async () => {
    const mockCache = createMockCacheStorage();
    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-fingerprint-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      lockManager: null,
      storageEstimateFn: async () => ({ usage: 0, quota: 500_000_000 })
    });
    const first = await lib.enqueueDownloadJob({
      scopeKind: 'range', labelAr: 'نطاق أول', reciterId: 'ar.alafasy',
      ranges: [
        { surahNumber: 2, startAyah: 1, endAyah: 2 },
        { surahNumber: 2, startAyah: 5, endAyah: 6 }
      ], autoStart: false
    });
    const second = await lib.enqueueDownloadJob({
      scopeKind: 'range', labelAr: 'نطاق ثانٍ', reciterId: 'ar.alafasy',
      ranges: [
        { surahNumber: 2, startAyah: 1, endAyah: 1 },
        { surahNumber: 2, startAyah: 4, endAyah: 6 }
      ], autoStart: false
    });
    assert(first.jobId !== second.jobId, 'Distinct exact ayah sequences must not be deduplicated as the same active job');
    const [firstItems, secondItems] = await Promise.all([
      lib.getJobItems(first.jobId), lib.getJobItems(second.jobId)
    ]);
    assert(firstItems.map(item => item.ayahNumber).join(',') === '1,2,5,6', 'First job must retain its exact disjoint ranges');
    assert(secondItems.map(item => item.ayahNumber).join(',') === '1,4,5,6', 'Second job must retain its different exact disjoint ranges');
    lib.close();
  });

  await test('Version-3 audio jobs migrate legacy fingerprints to exact ayah sequences', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-fingerprint-migration-${++dbCounter}`;
    const request = factory.open(databaseName, 3);
    const oldDb = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onupgradeneeded = () => {
        const db = request.result;
        const jobs = db.createObjectStore('jobs', { keyPath: 'jobId' });
        jobs.createIndex('status', 'status', { unique: false });
        jobs.createIndex('createdAtMs', 'createdAtMs', { unique: false });
        jobs.createIndex('requestFingerprint', 'requestFingerprint', { unique: false });
        const files = db.createObjectStore('files', { keyPath: 'fileKey' });
        files.createIndex('reciterId', 'reciterId', { unique: false });
        files.createIndex('available', 'available', { unique: false });
        files.createIndex('deletionPending', 'deletionPending', { unique: false });
        const items = db.createObjectStore('jobItems', { keyPath: 'itemKey' });
        items.createIndex('jobId', 'jobId', { unique: false });
        items.createIndex('fileKey', 'fileKey', { unique: false });
        db.createObjectStore('locks', { keyPath: 'lockName' });
        db.createObjectStore('staging', { keyPath: 'cacheKey' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = oldDb.transaction(['jobs', 'jobItems'], 'readwrite');
    const legacyFingerprint = 'range:ar.alafasy:4:6:11';
    for (const [jobId, ayahs] of [['legacy-a', [6, 7, 10, 11]], ['legacy-b', [6, 9, 10, 11]]] as const) {
      tx.objectStore('jobs').put({
        jobId, scopeKind: 'range', labelAr: jobId, reciterId: 'ar.alafasy', ranges: [],
        status: 'paused', totalItems: 4, completedItems: 0, failedItems: 0, totalBytes: 0,
        requestFingerprint: legacyFingerprint, createdAtMs: 1, updatedAtMs: 1, schemaVersion: 1
      });
      ayahs.forEach((globalAyahNumber, ordinal) => tx.objectStore('jobItems').put({
        itemKey: `${jobId}:${globalAyahNumber}`, jobId, fileKey: `ar.alafasy:${globalAyahNumber}`,
        reciterId: 'ar.alafasy', surahNumber: 2, ayahNumber: ordinal + 1, globalAyahNumber,
        url: `https://cdn.islamic.network/quran/audio/128/ar.alafasy/${globalAyahNumber}.mp3`,
        ordinal, status: 'queued', schemaVersion: 1
      }));
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Legacy fixture transaction aborted'));
    });
    oldDb.close();

    const lib = new OfflineQuranAudioLibrary({ indexedDBFactory: factory, databaseName });
    const upgraded = await (lib as any).openDatabase() as IDBDatabase;
    const read = upgraded.transaction(['jobs'], 'readonly');
    const done = new Promise<void>((resolve, reject) => {
      read.oncomplete = () => resolve();
      read.onerror = () => reject(read.error);
    });
    const jobs = await new Promise<any[]>((resolve, reject) => {
      const get = read.objectStore('jobs').getAll();
      get.onsuccess = () => resolve(get.result);
      get.onerror = () => reject(get.error);
    });
    await done;
    const first = jobs.find(job => job.jobId === 'legacy-a');
    const second = jobs.find(job => job.jobId === 'legacy-b');
    assert(first?.requestFingerprint !== second?.requestFingerprint, 'Legacy active jobs with different disjoint ranges must receive distinct migrated fingerprints');
    assert(first?.requestFingerprint.endsWith(':6,7,10,11'), 'First legacy job must migrate with its exact ordered ayah sequence');
    assert(second?.requestFingerprint.endsWith(':6,9,10,11'), 'Second legacy job must migrate with its exact ordered ayah sequence');
    assert(first?.status === 'paused' && second?.status === 'paused', 'Migration must preserve resumable job states');
    upgraded.close();
    lib.close();
  });

  await test('Staged cache generation is removed after a simulated crash before metadata commit', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-staging-crash-${++dbCounter}`;
    const mockCache = createMockCacheStorage();
    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: factory, databaseName, cacheStorageFactory: mockCache.factory,
      lockManager: null, stagingGraceMs: 1, orphanGraceMs: 1
    });
    const cache = await mockCache.factory.open(OFFLINE_AUDIO_CACHE_NAME);
    const generationId = 'crashed-generation';
    const cacheKey = buildCacheGenerationKey('ar.alafasy', 1, generationId);
    await cache.put(cacheKey, new Response(new Uint8Array([0xff, 0xfb, 0x90]).buffer, {
      status: 200, headers: { 'Content-Type': 'audio/mpeg' }
    }));
    const db = await (lib as any).openDatabase() as IDBDatabase;
    const tx = db.transaction([STORE_AUDIO_STAGING], 'readwrite');
    const done = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Staging fixture transaction aborted'));
    });
    tx.objectStore(STORE_AUDIO_STAGING).put({
      cacheKey, kind: 'download', fileKey: 'ar.alafasy:1', reciterId: 'ar.alafasy',
      globalAyahNumber: 1, cacheGenerationId: generationId, jobId: 'closed-tab-job',
      createdAtMs: Date.now() - 10_000, schemaVersion: 1
    });
    await done;

    await lib.reconcileLibrary();
    assert(!(await cache.match(cacheKey)), 'A stale staged generation without metadata must be removed');
    const read = db.transaction([STORE_AUDIO_STAGING], 'readonly');
    const readDone = new Promise<void>((resolve, reject) => {
      read.oncomplete = () => resolve();
      read.onerror = () => reject(read.error);
    });
    const remaining = await new Promise<unknown>((resolve, reject) => {
      const request = read.objectStore(STORE_AUDIO_STAGING).get(cacheKey);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await readDone;
    assert(remaining === undefined, 'Staging metadata must be removed after cache cleanup succeeds');
    db.close();
    lib.close();
  });

  await test('Unknown Cache Storage keys receive a grace record before orphan deletion', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-orphan-scan-${++dbCounter}`;
    const mockCache = createMockCacheStorage();
    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: factory, databaseName, cacheStorageFactory: mockCache.factory,
      lockManager: null, stagingGraceMs: 1, orphanGraceMs: 1
    });
    const cache = await mockCache.factory.open(OFFLINE_AUDIO_CACHE_NAME);
    const cacheKey = buildCacheGenerationKey('ar.alafasy', 2, 'legacy-untracked-generation');
    await cache.put(cacheKey, new Response(new Uint8Array([0xff, 0xfb, 0x91]).buffer, {
      status: 200, headers: { 'Content-Type': 'audio/mpeg' }
    }));

    await lib.reconcileLibrary();
    assert(!!(await cache.match(cacheKey)), 'First scan must stage an unknown key, not delete it immediately');
    const db = await (lib as any).openDatabase() as IDBDatabase;
    const update = db.transaction([STORE_AUDIO_STAGING], 'readwrite');
    const updateDone = new Promise<void>((resolve, reject) => {
      update.oncomplete = () => resolve();
      update.onerror = () => reject(update.error);
      update.onabort = () => reject(update.error || new Error('Orphan grace fixture transaction aborted'));
    });
    const stagingStore = update.objectStore(STORE_AUDIO_STAGING);
    const request = stagingStore.get(cacheKey);
    request.onsuccess = () => {
      const readRecord = request.result;
      if (!readRecord || readRecord.kind !== 'orphan') {
        update.abort();
        return;
      }
      readRecord.createdAtMs = Date.now() - 10_000;
      stagingStore.put(readRecord);
    };
    request.onerror = () => update.abort();
    await updateDone;

    await lib.reconcileLibrary();
    assert(!(await cache.match(cacheKey)), 'An unreferenced key older than the grace period must be swept');
    db.close();
    lib.close();
  });

  await test('IndexedDB lease fallback serializes the same download across two tabs', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-cross-tab-${++dbCounter}`;
    const mockCache = createMockCacheStorage();
    let networkCalls = 0;
    const fetchFn: typeof fetch = async () => {
      networkCalls++;
      await new Promise(resolve => setTimeout(resolve, 8));
      const bytes = new Uint8Array([0xff, 0xfb, 0x90, networkCalls]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.byteLength) }
      });
    };
    const makeTab = () => new OfflineQuranAudioLibrary({
      indexedDBFactory: factory,
      databaseName,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockManager: null,
      lockLeaseMs: 1_000,
      lockPollIntervalMs: 5,
      lockWaitTimeoutMs: 5_000,
      concurrency: 2,
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });
    const tabA = makeTab();
    const tabB = makeTab();
    const job = await tabA.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'اختبار تبويبين',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 3 }],
      autoStart: false
    });

    const [resultA, resultB] = await Promise.all([
      tabA.startOrResumeJob(job.jobId),
      tabB.startOrResumeJob(job.jobId)
    ]);
    assert(networkCalls === 3, `Two tabs must not fetch duplicate ayahs; expected 3 requests, got ${networkCalls}`);
    assert(resultA?.status === 'completed' || resultB?.status === 'completed', 'The shared job must complete in one of the tabs');

    const db = await (tabA as any).openDatabase() as IDBDatabase;
    const tx = db.transaction([STORE_AUDIO_LOCKS], 'readwrite');
    tx.objectStore(STORE_AUDIO_LOCKS).put({
      lockName: 'expired-test-lock', ownerId: 'closed-tab', leaseToken: 'stale-token',
      expiresAtMs: Date.now() - 1_000, schemaVersion: 1
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Expired lock fixture transaction aborted'));
    });
    let recovered = false;
    await (tabB as any).runWithLock('expired-test-lock', async () => { recovered = true; });
    assert(recovered, 'A later tab must take over a lease left by a crashed/closed owner after expiry');
    db.close();
  });

  await test('Pause and cancel from another tab stop an in-flight worker before the next ayah', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-cross-tab-control-${++dbCounter}`;
    const mockCache = createMockCacheStorage();
    let networkCalls = 0;
    const makeGate = () => {
      let release!: () => void;
      let markStarted!: () => void;
      const started = new Promise<void>(resolve => { markStarted = resolve; });
      const wait = new Promise<void>(resolve => { release = resolve; });
      const fetchFn: typeof fetch = async () => {
        networkCalls++;
        markStarted();
        await wait;
        const bytes = new Uint8Array([0xff, 0xfb, 0x90, networkCalls]);
        return new Response(bytes.buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(bytes.byteLength) }
        });
      };
      return { started, release, fetchFn };
    };
    const gateA = makeGate();
    const gateB = makeGate();
    const makeTab = (fetchFn: typeof fetch) => new OfflineQuranAudioLibrary({
      indexedDBFactory: factory,
      databaseName,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockManager: null,
      lockLeaseMs: 1_000,
      lockPollIntervalMs: 5,
      lockWaitTimeoutMs: 5_000,
      concurrency: 1,
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });
    const tabA = makeTab(gateA.fetchFn);
    const tabB = makeTab(gateB.fetchFn);
    const job = await tabA.enqueueDownloadJob({
      scopeKind: 'range', labelAr: 'اختبار إيقاف من تبويب آخر', reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 3 }], autoStart: false
    });

    const firstRun = tabA.startOrResumeJob(job.jobId);
    await gateA.started;
    await tabB.pauseJob(job.jobId);
    gateA.release();
    await firstRun;
    const paused = (await tabB.listJobs()).find(entry => entry.jobId === job.jobId);
    assert(paused?.status === 'paused', 'A pause from another tab must remain durable after the in-flight request settles');
    assert(networkCalls === 1, 'A paused cross-tab worker must not start the next ayah');

    const secondRun = tabB.startOrResumeJob(job.jobId);
    await gateB.started;
    await tabA.cancelJob(job.jobId);
    gateB.release();
    await secondRun;
    const cancelled = (await tabB.listJobs()).find(entry => entry.jobId === job.jobId);
    assert(cancelled?.status === 'cancelled', 'A cancel from another tab must remain terminal');
    assert(networkCalls === 2, 'A cancelled cross-tab worker must not start any further ayah');
    const stats = await tabA.getStats();
    assert(stats.availableFilesCount === 0, 'Paused/cancelled in-flight responses must not be committed as cached files');
    tabA.close();
    tabB.close();
  });

  await test('Bounded concurrency (<=2), redirect:error, host/mime verification, and local-first ObjectURL playback', async () => {
    const mockCache = createMockCacheStorage();
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchedUrls: string[] = [];

    const fetchFn: typeof fetch = async (input, init) => {
      assert(init?.redirect === 'error', 'Download fetch must fail closed on redirects (redirect: error)');
      assert(init?.credentials === 'same-origin', 'Protected Preview requests must retain the same-origin Vercel session without sending credentials to external hosts');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      const parsedUrl = new URL(url, 'https://wird.test');
      assert(parsedUrl.origin === 'https://wird.test' && parsedUrl.pathname === '/api/quran-audio-download',
        'Audio bytes must be fetched through the same-origin WIRD relay to avoid upstream browser CORS restrictions');
      assert(parsedUrl.searchParams.get('reciter') === 'ar.alafasy' &&
        Number(parsedUrl.searchParams.get('ayah')) >= 1 && Number(parsedUrl.searchParams.get('ayah')) <= 7,
        'Relay requests must contain only the approved reciter ID and canonical global ayah number');
      fetchedUrls.push(url);
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 8));
      inFlight--;
      const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00, fetchedUrls.length]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(bytes.byteLength)
        }
      });
    };

    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      concurrency: 2,
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 1_000_000, quota: 200_000_000 })
    });

    const job = await lib.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'سورة الفاتحة',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 1, startAyah: 1, endAyah: 7 }],
      autoStart: false
    });
    const completed = await lib.startOrResumeJob(job.jobId);
    assert(completed?.status === 'completed' && completed.completedItems === 7, 'All 7 ayahs of Al-Fatiha must download and verify');
    assert(maxInFlight <= 2, `Expected max concurrency <= 2, observed ${maxInFlight}`);

    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    let revokedCount = 0;
    (URL as any).createObjectURL = (blob: Blob) => `blob:wird-test/${blob.size}`;
    (URL as any).revokeObjectURL = () => { revokedCount++; };
    try {
      const globalAyah = computeGlobalAyahNumber(1, 1);
      const playback = await lib.resolvePlaybackSource('ar.alafasy', globalAyah, 'https://everyayah.com/fallback.mp3');
      assert(playback.sourceKind === 'local-cache' && playback.src.startsWith('blob:wird-test/'),
        'Verified cached ayah must resolve local-first via revocable blob ObjectURL');
      playback.revoke?.();
      assert(revokedCount === 1, 'Caller revoke() must release ObjectURL cleanly');
    } finally {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    }
  });

  await test('Fail closed on HTML SPA fallback response and oversized Content-Length', async () => {
    const mockCache = createMockCacheStorage();
    let mode: 'html' | 'oversize' = 'html';
    const fetchFn: typeof fetch = async () => {
      if (mode === 'html') {
        return new Response('<html>SPA fallback</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html', 'Content-Length': '23' }
        });
      }
      return new Response(new Uint8Array([1, 2, 3]), {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': String(20 * 1024 * 1024) }
      });
    };

    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const job1 = await lib.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'آية 1',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 1 }],
      autoStart: false
    });
    const res1 = await lib.startOrResumeJob(job1.jobId);
    assert(res1?.status === 'failed' && res1.completedItems === 0 && res1.failedItems === 1,
      'HTML response must fail closed and never be written as valid audio');

    mode = 'oversize';
    const job2 = await lib.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'آية 2',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 2, endAyah: 2 }],
      autoStart: false
    });
    const res2 = await lib.startOrResumeJob(job2.jobId);
    assert(res2?.status === 'failed' && res2.failedItems === 1, 'Oversized file must fail closed');
  });

  await test('Shared canonical files reuse across jobs and safe deletion preserves shared references + GC cleans orphans', async () => {
    const mockCache = createMockCacheStorage();
    let networkCalls = 0;
    const fetchFn: typeof fetch = async () => {
      networkCalls++;
      const bytes = new Uint8Array([0xaa, 0xbb, networkCalls]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' }
      });
    };

    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const jobA = await lib.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'الإخلاص (أ)',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 4 }],
      autoStart: false
    });
    await lib.startOrResumeJob(jobA.jobId);
    assert(networkCalls === 4, `Expected 4 network calls for Job A, got ${networkCalls}`);

    // Job B covers Surah 112 (shared) + Surah 113 ayahs 1-2 (new)
    const jobB = await lib.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'الإخلاص والفلق',
      reciterId: 'ar.alafasy',
      ranges: [
        { surahNumber: 112, startAyah: 1, endAyah: 4 },
        { surahNumber: 113, startAyah: 1, endAyah: 2 }
      ],
      autoStart: false
    });
    await lib.startOrResumeJob(jobB.jobId);
    assert(networkCalls === 6, `Expected only 2 additional network calls for Job B (shared 4 reused), got total ${networkCalls}`);

    // Deleting Job A must keep the 4 shared Surah 112 files intact because Job B still references them
    await lib.deleteJob(jobA.jobId);
    const statsAfterDeleteA = await lib.getStats();
    assert(statsAfterDeleteA.availableFilesCount === 6,
      `Expected all 6 files preserved while Job B references Surah 112, got ${statsAfterDeleteA.availableFilesCount}`);

    // Deleting Job B removes all remaining references and deletes Cache Storage entries
    await lib.deleteJob(jobB.jobId);
    const statsAfterDeleteB = await lib.getStats();
    assert(statsAfterDeleteB.availableFilesCount === 0 && statsAfterDeleteB.jobCount === 0,
      'Deleting last referencing job must orphan-delete all files cleanly');
    const cacheMap = mockCache.ensureStore('wird-offline-quran-audio-v1');
    assert(cacheMap.size === 0, `Expected Cache Storage empty after orphan deletion, got ${cacheMap.size} entries`);
  });

  await test('reconcileLibrary detects Cache Storage eviction, updates IDB truth, and re-queues unfinished jobs', async () => {
    const mockCache = createMockCacheStorage();
    const fetchFn: typeof fetch = async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' }
      });
    };

    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const job = await lib.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'الكوثر',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 108, startAyah: 1, endAyah: 3 }],
      autoStart: false
    });
    await lib.startOrResumeJob(job.jobId);

    // Simulate OS Cache Storage eviction of all cached audio responses
    mockCache.ensureStore('wird-offline-quran-audio-v1').clear();

    const recon = await lib.reconcileLibrary();
    assert(recon.evictedCount === 3, `Expected 3 evicted files detected, got ${recon.evictedCount}`);

    const stats = await lib.getStats();
    assert(stats.availableFilesCount === 0, 'Evicted files must not remain marked available');

    const globalAyah = computeGlobalAyahNumber(108, 1);
    const playback = await lib.resolvePlaybackSource('ar.alafasy', globalAyah, 'https://everyayah.com/fallback.mp3');
    assert(playback.sourceKind === 'network' && playback.src === 'https://everyayah.com/fallback.mp3',
      'Evicted audio must fall back cleanly to network URL');
  });

  await test('preflightQuota enforces reserve margin and blocks insufficient device storage', async () => {
    const mockCache = createMockCacheStorage();
    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn: async () => new Response(),
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 80_000_000, quota: 100_000_000 }) // only 20MB free < 25MB reserve
    });

    const check = await lib.preflightQuota('ar.alafasy', 10);
    assert(check.allowed === false && Boolean(check.messageAr),
      'Quota preflight must reject downloads when remaining quota falls below safety reserve');

    let threw = false;
    try {
      await lib.enqueueDownloadJob({
        scopeKind: 'surah',
        labelAr: 'الملك',
        reciterId: 'ar.alafasy',
        ranges: [{ surahNumber: 67, startAyah: 1, endAyah: 30 }],
        autoStart: false
      });
    } catch {
      threw = true;
    }
    assert(threw, 'enqueueDownloadJob must fail closed on insufficient quota');
  });

  await test('IDB failure after Cache write rolls back orphaned Cache entry immediately', async () => {
    const mockCache = createMockCacheStorage();
    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn: async () => {
        const bytes = new Uint8Array([9, 8, 7]);
        return new Response(bytes.buffer, {
          status: 200,
          headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' }
        });
      },
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const job = await lib.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'آية اختبار',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 1 }],
      autoStart: false
    });

    // Inject IDB write failure on markJobItemVerified
    const originalMark = (lib as any).markJobItemVerified.bind(lib);
    (lib as any).markJobItemVerified = async () => {
      throw new Error('Simulated QuotaExceededError in IDB');
    };
    const res = await lib.startOrResumeJob(job.jobId);
    (lib as any).markJobItemVerified = originalMark;

    assert(res?.status === 'failed', 'Failed IDB commit must fail the job item');
    assert(mockCache.ensureStore('wird-offline-quran-audio-v1').size === 0,
      'Cache Storage entry written before IDB failure must be rolled back cleanly');
  });

  await test('Pause and cancel stop workers and preserve resume capability', async () => {
    const mockCache = createMockCacheStorage();
    let calls = 0;
    let releaseSecondFetch!: () => void;
    const secondFetchGate = new Promise<void>(r => { releaseSecondFetch = r; });

    const fetchFn: typeof fetch = async (_url, init) => {
      calls++;
      if (calls === 2) {
        await new Promise<void>((resolve, reject) => {
          const onAbort = () => reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }));
          if (init?.signal?.aborted) return onAbort();
          init?.signal?.addEventListener('abort', onAbort, { once: true });
          releaseSecondFetch = resolve;
        });
      }
      const bytes = new Uint8Array([1, 2, 3]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' }
      });
    };

    const lib = new OfflineQuranAudioLibrary({
      indexedDBFactory: new IDBFactory(),
      databaseName: `wird-audio-test-${++dbCounter}`,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      concurrency: 1,
      lockRunner: async (_n, task) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const job = await lib.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'الناس',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 114, startAyah: 1, endAyah: 3 }],
      autoStart: false
    });

    const runPromise = lib.startOrResumeJob(job.jobId);
    await new Promise(r => setTimeout(r, 15));
    await lib.pauseJob(job.jobId);
    releaseSecondFetch?.();
    await runPromise;

    const jobsAfterPause = await lib.listJobs();
    assert(jobsAfterPause[0]?.status === 'paused', `Expected paused status, got ${jobsAfterPause[0]?.status}`);

    // Now resume without aborting
    const resumed = await lib.startOrResumeJob(job.jobId);
    assert(resumed?.status === 'completed' && resumed.completedItems === 3,
      `Expected resumed job to complete 3 items, got ${resumed?.status} (${resumed?.completedItems})`);

    // Test cancel on new job
    const job2 = await lib.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'الفلق',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 113, startAyah: 1, endAyah: 2 }],
      autoStart: false
    });
    await lib.cancelJob(job2.jobId);
    const jobsAfterCancel = await lib.listJobs();
    const cancelledJob = jobsAfterCancel.find(j => j.jobId === job2.jobId);
    assert(cancelledJob?.status === 'cancelled', `Expected cancelled status, got ${cancelledJob?.status}`);
    // Ensure stores constants referenced cleanly
    assert(STORE_AUDIO_JOBS === 'jobs' && STORE_AUDIO_FILES === 'files', 'Store names valid');
  });

  await test('A hard-crashed audio download is recovered from persisted IndexedDB and Cache Storage without re-downloading verified ayahs', async () => {
    const factory = new IDBFactory();
    const databaseName = `wird-audio-hard-restart-${++dbCounter}`;
    const mockCache = createMockCacheStorage();
    const callsByUrl = new Map<string, number>();

    const fetchFn: typeof fetch = async input => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      callsByUrl.set(url, (callsByUrl.get(url) || 0) + 1);
      return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x01]).buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' }
      });
    };

    const deps = {
      indexedDBFactory: factory,
      databaseName,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      concurrency: 1,
      lockRunner: async (_name: string, task: () => Promise<any>) => task(),
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    };

    const firstTab = new OfflineQuranAudioLibrary(deps);
    const job = await firstTab.enqueueDownloadJob({
      scopeKind: 'range',
      labelAr: 'اختبار استعادة تنزيل الصوت بعد إغلاق مفاجئ',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 112, startAyah: 1, endAyah: 3 }],
      autoStart: false
    });
    const [firstItem, interruptedItem, remainingItem] = await firstTab.getJobItems(job.jobId);
    if (!firstItem || !interruptedItem || !remainingItem) {
      throw new Error('The recovery fixture must contain exactly three ayah items');
    }

    // Seed the durable state left by a process killed mid-download:
    // ayah 1 is fully committed; ayah 2 and the job still say "downloading".
    const generationId = 'persisted-before-hard-crash';
    const cacheKey = buildCacheGenerationKey(firstItem.reciterId, firstItem.globalAyahNumber, generationId);
    const cache = await mockCache.factory.open(OFFLINE_AUDIO_CACHE_NAME);
    await cache.put(cacheKey, new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x01]).buffer, {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '4' }
    }));

    const db = await (firstTab as any).openDatabase() as IDBDatabase;
    const tx = db.transaction([STORE_AUDIO_JOBS, STORE_AUDIO_JOB_ITEMS, STORE_AUDIO_FILES], 'readwrite');
    tx.objectStore(STORE_AUDIO_FILES).put({
      fileKey: firstItem.fileKey,
      reciterId: firstItem.reciterId,
      surahNumber: firstItem.surahNumber,
      ayahNumber: firstItem.ayahNumber,
      globalAyahNumber: firstItem.globalAyahNumber,
      url: firstItem.url,
      cacheGenerationId: generationId,
      byteLength: 4,
      contentType: 'audio/mpeg',
      available: true,
      pinned: false,
      deletionPending: false,
      verifiedAtMs: Date.now(),
      schemaVersion: 1
    });
    tx.objectStore(STORE_AUDIO_JOB_ITEMS).put({
      ...firstItem,
      status: 'verified',
      cacheGenerationId: generationId
    });
    tx.objectStore(STORE_AUDIO_JOB_ITEMS).put({ ...interruptedItem, status: 'downloading' });
    tx.objectStore(STORE_AUDIO_JOBS).put({
      ...job,
      status: 'downloading',
      completedItems: 1,
      failedItems: 0,
      totalBytes: 4,
      updatedAtMs: Date.now()
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('Hard-crash fixture transaction aborted'));
    });

    // No worker is running now; closing the database simulates the browser process
    // disappearing before it could execute worker cleanup/finally handlers.
    firstTab.close();

    const restartedTab = new OfflineQuranAudioLibrary(deps);
    await restartedTab.reconcileLibrary();
    const recovered = (await restartedTab.listJobs()).find(entry => entry.jobId === job.jobId);
    assert(recovered?.status === 'partial' && recovered.completedItems === 1,
      'Startup reconciliation must turn an abandoned downloading job into a resumable partial job');

    const recoveredItems = await restartedTab.getJobItems(job.jobId);
    assert(recoveredItems.find(item => item.itemKey === firstItem.itemKey)?.status === 'verified',
      'The first ayah must remain individually verified after a hard restart');
    assert(recoveredItems.find(item => item.itemKey === interruptedItem.itemKey)?.status === 'queued',
      'The in-flight ayah must be re-queued after a hard restart');
    assert(recoveredItems.find(item => item.itemKey === remainingItem.itemKey)?.status === 'queued',
      'The not-yet-started ayah must remain queued after a hard restart');

    const completed = await restartedTab.startOrResumeJob(job.jobId);
    assert(completed?.status === 'completed' && completed.completedItems === 3,
      'The recovered job must finish after a fresh library instance resumes it');
    const relayUrlFor = (item: typeof firstItem) =>
      '/api/quran-audio-download?reciter=' + encodeURIComponent(item.reciterId) + '&ayah=' + String(item.globalAyahNumber);
    assert(callsByUrl.size === 2, 'Only the two unfinished ayah relay URLs may be requested after restart');
    assert(!callsByUrl.has(relayUrlFor(firstItem)), 'The already verified first ayah must never be downloaded again');
    assert(callsByUrl.get(relayUrlFor(interruptedItem)) === 1, 'Only the interrupted second ayah must be downloaded once after restart');
    assert(callsByUrl.get(relayUrlFor(remainingItem)) === 1, 'The third ayah must be downloaded once after restart');
    assert((await restartedTab.getStats()).availableFilesCount === 3,
      'All three verified audio files must be available in the persistent cache after recovery');
    restartedTab.close();
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('offlineQuranAudioLibrary.test')) {
  runOfflineQuranAudioLibraryTests().then(res => {
    console.log(`Offline Audio Library Tests: ${res.passed} passed, ${res.failed} failed`);
    if (res.failed > 0) process.exit(1);
  });
}
