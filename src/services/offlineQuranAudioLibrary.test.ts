import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import {
  OfflineQuranAudioLibrary,
  STORE_AUDIO_FILES,
  STORE_AUDIO_JOBS,
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
          return Array.from(store.keys()).map(url => new Request(url));
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

  await test('Bounded concurrency (<=2), redirect:error, host/mime verification, and local-first ObjectURL playback', async () => {
    const mockCache = createMockCacheStorage();
    let inFlight = 0;
    let maxInFlight = 0;
    const fetchedUrls: string[] = [];

    const fetchFn: typeof fetch = async (input, init) => {
      assert(init?.redirect === 'error', 'Download fetch must fail closed on redirects (redirect: error)');
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      assert(new URL(url).hostname === 'cdn.islamic.network', 'Download host must be cdn.islamic.network');
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

  await test('Cross-tab per-job worker lock prevents duplicate network fetches and reconcileLibrary sweeps unindexed Cache Storage orphans', async () => {
    const mockCache = createMockCacheStorage();
    const sharedIdb = new IDBFactory();
    const dbName = `wird-audio-test-${++dbCounter}`;
    const lockChains = new Map<string, Promise<unknown>>();
    const serializeLock = async <T>(name: string, task: () => Promise<T>): Promise<T> => {
      const prev = lockChains.get(name) ?? Promise.resolve();
      const next = prev.catch(() => undefined).then(() => task());
      lockChains.set(name, next);
      return next;
    };

    let networkFetches = 0;
    const fetchFn: typeof fetch = async () => {
      networkFetches++;
      await new Promise(r => setTimeout(r, 10));
      const bytes = new Uint8Array([0x11, 0x22, 0x33]);
      return new Response(bytes.buffer, {
        status: 200,
        headers: { 'Content-Type': 'audio/mpeg', 'Content-Length': '3' }
      });
    };

    const tabA = new OfflineQuranAudioLibrary({
      indexedDBFactory: sharedIdb,
      databaseName: dbName,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockRunner: serializeLock,
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });
    const tabB = new OfflineQuranAudioLibrary({
      indexedDBFactory: sharedIdb,
      databaseName: dbName,
      cacheStorageFactory: mockCache.factory,
      fetchFn,
      lockRunner: serializeLock,
      storageEstimateFn: async () => ({ usage: 0, quota: 200_000_000 })
    });

    const job = await tabA.enqueueDownloadJob({
      scopeKind: 'surah',
      labelAr: 'العصر',
      reciterId: 'ar.alafasy',
      ranges: [{ surahNumber: 103, startAyah: 1, endAyah: 3 }],
      autoStart: false
    });

    // Both tabs concurrently attempt to run the same jobId
    await Promise.all([tabA.startOrResumeJob(job.jobId), tabB.startOrResumeJob(job.jobId)]);
    assert(networkFetches === 3, `Expected per-job cross-tab lock to prevent duplicate network fetches (expected 3, got ${networkFetches})`);

    // Inject an unindexed orphan entry directly into Cache Storage
    const rawCache = await mockCache.factory.open('wird-offline-quran-audio-v1');
    await rawCache.put(
      'https://wird.local/offline-audio/ar.alafasy/99999/orphan-gen-1.mp3',
      new Response(new Uint8Array([1, 2]), { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
    );
    assert(mockCache.ensureStore('wird-offline-quran-audio-v1').size === 4, 'Expected 3 active + 1 orphan cache entry');

    const recon = await tabA.reconcileLibrary();
    assert(recon.cleanedOrphansCount === 1, `Expected 1 unindexed Cache Storage orphan swept, got ${recon.cleanedOrphansCount}`);
    assert(mockCache.ensureStore('wird-offline-quran-audio-v1').size === 3, 'Expected only the 3 active entries to remain in Cache Storage');
  });

  return { passed, failed };
}

if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('offlineQuranAudioLibrary.test')) {
  runOfflineQuranAudioLibraryTests().then(res => {
    console.log(`Offline Audio Library Tests: ${res.passed} passed, ${res.failed} failed`);
    if (res.failed > 0) process.exit(1);
  });
}
