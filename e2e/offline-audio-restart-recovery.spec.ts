import { expect, test } from '@playwright/test';

const TEST_DB = 'wird-e2e-audio-restart-recovery-v1';
const TEST_CACHE = 'wird-e2e-audio-restart-cache-v1';

test.describe('offline Quran audio durable download recovery', () => {
  test.use({ serviceWorkers: 'block' });

  test('a failed ayah download resumes after reload, persists in Cache Storage, and resolves offline', async ({ page }) => {
    let requests = 0;
    await page.route('**/api/quran-audio-download?reciter=ar.alafasy&ayah=1', async route => {
      requests += 1;
      if (requests === 1) {
        await route.fulfill({ status: 503, contentType: 'text/plain', body: 'simulated temporary upstream failure' });
        return;
      }
      // The library validates audio MIME, byte length and a readable Cache Storage round-trip.
      await route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x10, 0x54, 0x45, 0x53, 0x54])
      });
    });

    await page.goto('/');
    await expect.poll(() => page.evaluate(() => typeof (window as any).__WIRD_E2E__?.OfflineQuranAudioLibrary === 'function')).toBe(true);
    const firstAttempt = await page.evaluate(async ({ databaseName, cacheName }) => {
      const OfflineQuranAudioLibrary = (window as any).__WIRD_E2E__?.OfflineQuranAudioLibrary;
      if (typeof OfflineQuranAudioLibrary !== 'function') throw new Error('CI-only offline audio test bridge is unavailable.');
      const library = new OfflineQuranAudioLibrary({
        databaseName,
        cacheName,
        storageEstimateFn: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 })
      });
      const job = await library.enqueueDownloadJob({
        scopeKind: 'surah',
        labelAr: 'اختبار استعادة تنزيل التلاوة',
        reciterId: 'ar.alafasy',
        ranges: [{ surahNumber: 1, startAyah: 1, endAyah: 1 }],
        autoStart: false
      });
      const result = await library.startOrResumeJob(job.jobId);
      const items = await library.getJobItems(job.jobId);
      return { jobId: job.jobId, status: result?.status, itemStatus: items[0]?.status };
    }, { databaseName: TEST_DB, cacheName: TEST_CACHE });

    expect(firstAttempt.status).toBe('failed');
    expect(firstAttempt.itemStatus).toBe('failed');
    expect(requests).toBe(1);

    // A real page reload creates a new JS realm and library instance while retaining IndexedDB + Cache Storage.
    await page.reload();
    await expect.poll(() => page.evaluate(() => typeof (window as any).__WIRD_E2E__?.OfflineQuranAudioLibrary === 'function')).toBe(true);
    const recovered = await page.evaluate(async ({ databaseName, cacheName, jobId }) => {
      const OfflineQuranAudioLibrary = (window as any).__WIRD_E2E__?.OfflineQuranAudioLibrary;
      if (typeof OfflineQuranAudioLibrary !== 'function') throw new Error('CI-only offline audio test bridge is unavailable.');
      const library = new OfflineQuranAudioLibrary({
        databaseName,
        cacheName,
        storageEstimateFn: async () => ({ usage: 0, quota: 1024 * 1024 * 1024 })
      });
      const before = (await library.listJobs()).find(job => job.jobId === jobId);
      const result = await library.startOrResumeJob(jobId);
      const stats = await library.getStats();
      const items = await library.getJobItems(jobId);
      const playback = await library.resolvePlaybackSource('ar.alafasy', 1, 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3');
      playback.revoke?.();
      return {
        beforeStatus: before?.status,
        status: result?.status,
        itemStatus: items[0]?.status,
        stats,
        sourceKind: playback.sourceKind
      };
    }, { databaseName: TEST_DB, cacheName: TEST_CACHE, jobId: firstAttempt.jobId });

    expect(recovered.beforeStatus).toBe('failed');
    expect(recovered.status).toBe('completed');
    expect(recovered.itemStatus).toBe('verified');
    expect(recovered.stats.availableFilesCount).toBe(1);
    expect(recovered.sourceKind).toBe('local-cache');
    expect(requests).toBe(2);

    await page.context().setOffline(true);
    const offlinePlayback = await page.evaluate(async ({ databaseName, cacheName }) => {
      const OfflineQuranAudioLibrary = (window as any).__WIRD_E2E__?.OfflineQuranAudioLibrary;
      if (typeof OfflineQuranAudioLibrary !== 'function') throw new Error('CI-only offline audio test bridge is unavailable.');
      const library = new OfflineQuranAudioLibrary({ databaseName, cacheName });
      const playback = await library.resolvePlaybackSource('ar.alafasy', 1, 'https://cdn.islamic.network/quran/audio/128/ar.alafasy/1.mp3');
      const isBlob = playback.src.startsWith('blob:');
      playback.revoke?.();
      return { sourceKind: playback.sourceKind, isBlob };
    }, { databaseName: TEST_DB, cacheName: TEST_CACHE });
    expect(offlinePlayback).toEqual({ sourceKind: 'local-cache', isBlob: true });
  });
});
