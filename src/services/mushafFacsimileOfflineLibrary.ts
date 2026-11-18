import {
  getMushafFacsimilePageUrls,
  MUSHAF_FACSIMILE_COMMIT,
  MUSHAF_OFFLINE_CACHE_NAME,
  parseMushafAyahCoordinates,
  parseMushafViewBox,
  matchMushafAyahAreas,
  sanitizeMushafSvgMarkup
} from './mushafFacsimileService';
import { loadSurahVerses } from '../data/quranDataLoader';

export const MUSHAF_OFFLINE_PAGE_COUNT = 604;
const STORAGE_RESERVE_BYTES = 32 * 1024 * 1024;
const QUOTA_ESTIMATE_SAFETY_FACTOR = 1.35;
const PREFLIGHT_SAMPLE_PAGES = [1, 300, 604] as const;

export interface MushafOfflinePackageStatus {
  cached: number;
  total: number;
  missing: number;
}

export interface MushafOfflinePackageProgress extends MushafOfflinePackageStatus {
  currentPage: number | null;
}

export function estimateMushafOfflinePackageBytes(samplePageBytes: number[], remainingPages = MUSHAF_OFFLINE_PAGE_COUNT): number {
  const valid = samplePageBytes.filter(value => Number.isSafeInteger(value) && value > 0);
  if (valid.length === 0) throw new Error('تعذر تقدير حجم صفحات المصحف قبل التنزيل.');
  if (!Number.isSafeInteger(remainingPages) || remainingPages < 0 || remainingPages > MUSHAF_OFFLINE_PAGE_COUNT) {
    throw new Error('عدد صفحات المصحف المتبقية غير صالح.');
  }
  const average = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  return Math.ceil(average * remainingPages * QUOTA_ESTIMATE_SAFETY_FACTOR);
}

export function hasMushafOfflineQuota(
  requiredBytes: number,
  usageBytes: number,
  quotaBytes: number
): boolean {
  if (![requiredBytes, usageBytes, quotaBytes].every(Number.isFinite) ||
      requiredBytes < 0 || usageBytes < 0 || quotaBytes <= 0 || usageBytes > quotaBytes) return false;
  const available = quotaBytes - usageBytes;
  const reserve = Math.max(STORAGE_RESERVE_BYTES, quotaBytes * 0.15);
  return available - reserve >= requiredBytes;
}

function assertCacheSupport(): void {
  if (typeof caches === 'undefined') {
    throw new Error('هذا المتصفح لا يدعم حفظ صفحات المصحف المصوّر محليًا.');
  }
}

function assertQuotaEstimateSupport(): void {
  if (typeof navigator === 'undefined' || !navigator.storage ||
      typeof navigator.storage.estimate !== 'function') {
    throw new Error('لا يستطيع المتصفح تقدير مساحة التخزين بأمان؛ لن نبدأ تنزيلًا قد يملأ مساحة الجهاز.');
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('تم إيقاف تنزيل صفحات المصحف.', 'AbortError');
}

async function validatePageAgainstLocalQuran(
  page: number,
  markup: string
): Promise<void> {
  const areas = parseMushafAyahCoordinates(markup);
  const surahNumbers = [...new Set(areas.map(area => area.surahNumber))];
  const localSurahs = new Map<number, Awaited<ReturnType<typeof loadSurahVerses>>>();
  for (const surahNumber of surahNumbers) {
    localSurahs.set(surahNumber, await loadSurahVerses(surahNumber));
  }
  const localAyahs = areas.map(area => {
    const ayah = localSurahs.get(area.surahNumber)?.find(item => item.numberInSurah === area.ayahNumber);
    if (!ayah) throw new Error(`إحداثيات صفحة المصحف رقم ${page} لا تطابق نص وِرد المحلي.`);
    return ayah;
  });
  matchMushafAyahAreas(areas, localAyahs);
}

async function fetchValidatedPage(page: number, signal?: AbortSignal): Promise<{ response: Response; bytes: number }> {
  throwIfAborted(signal);
  const { svgUrl } = getMushafFacsimilePageUrls(page);
  const response = await fetch(svgUrl, {
    method: 'GET',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    headers: { Accept: 'image/svg+xml' },
    signal
  });
  if (!response.ok) throw new Error(`تعذر تنزيل صفحة المصحف رقم ${page} (HTTP ${response.status}).`);
  const contentType = (response.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('image/svg+xml')) {
    throw new Error(`نوع الملف في صفحة المصحف رقم ${page} غير موثوق.`);
  }
  const markup = await response.clone().text();
  parseMushafViewBox(markup);
  const areas = parseMushafAyahCoordinates(markup);
  if (areas.length === 0) throw new Error(`صفحة المصحف رقم ${page} لا تحتوي على مواضع آيات.`);
  const safeMarkup = sanitizeMushafSvgMarkup(markup);
  await validatePageAgainstLocalQuran(page, markup);
  return {
    response: createSanitizedSvgResponse(response, safeMarkup),
    bytes: new TextEncoder().encode(safeMarkup).byteLength
  };
}

function createSanitizedSvgResponse(original: Response, safeMarkup: string): Response {
  const headers = new Headers(original.headers);
  headers.set('content-type', 'image/svg+xml; charset=utf-8');
  headers.delete('content-length');
  headers.delete('content-encoding');
  return new Response(safeMarkup, { status: 200, statusText: 'OK', headers });
}

async function openPackageCache(): Promise<Cache> {
  assertCacheSupport();
  return caches.open(MUSHAF_OFFLINE_CACHE_NAME);
}

function isPackagePageUrl(value: string): boolean {
  return value.includes(`/quran-svg/${MUSHAF_FACSIMILE_COMMIT}/mushafs/hafs/kfqc/svg/`) &&
    /\/(?:00[1-9]|0[1-9]\d|[1-5]\d\d|60[0-4])\.svg(?:\?|$)/.test(value);
}

export async function getMushafOfflinePackageStatus(): Promise<MushafOfflinePackageStatus> {
  const cache = await openPackageCache();
  const keys = await cache.keys();
  const uniquePages = new Set(keys.map(request => request.url).filter(isPackagePageUrl));
  const cached = Math.min(uniquePages.size, MUSHAF_OFFLINE_PAGE_COUNT);
  return { cached, total: MUSHAF_OFFLINE_PAGE_COUNT, missing: MUSHAF_OFFLINE_PAGE_COUNT - cached };
}

/**
 * Downloads the pinned 604-page facsimile as an optional package. Every page is
 * parsed and sanitized before it is committed to Cache Storage. Existing pages
 * are revalidated and skipped, so interrupted downloads resume safely.
 */
export async function downloadMushafOfflinePackage(
  onProgress?: (progress: MushafOfflinePackageProgress) => void,
  signal?: AbortSignal
): Promise<MushafOfflinePackageStatus> {
  const cache = await openPackageCache();
  const sampleBytes: number[] = [];

  for (const page of PREFLIGHT_SAMPLE_PAGES) {
    throwIfAborted(signal);
    const { svgUrl } = getMushafFacsimilePageUrls(page);
    const existing = await cache.match(svgUrl);
    if (existing) {
      try {
        const markup = await existing.clone().text();
        parseMushafViewBox(markup);
        parseMushafAyahCoordinates(markup);
        const safeMarkup = sanitizeMushafSvgMarkup(markup);
        await validatePageAgainstLocalQuran(page, markup);
        if (safeMarkup !== markup) await cache.put(svgUrl, createSanitizedSvgResponse(existing, safeMarkup));
        sampleBytes.push(new TextEncoder().encode(safeMarkup).byteLength);
        continue;
      } catch {
        await cache.delete(svgUrl);
      }
    }
    const downloaded = await fetchValidatedPage(page, signal);
    await cache.put(svgUrl, downloaded.response.clone());
    sampleBytes.push(downloaded.bytes);
  }

  const packageStatus = await getMushafOfflinePackageStatus();
  if (packageStatus.missing > 0) {
    assertQuotaEstimateSupport();
    const estimate = await navigator.storage.estimate();
    const quota = Number(estimate.quota);
    const usage = Number(estimate.usage);
    const estimatedPackageBytes = estimateMushafOfflinePackageBytes(sampleBytes, packageStatus.missing);
    if (!Number.isFinite(quota) || !Number.isFinite(usage) ||
        !hasMushafOfflineQuota(estimatedPackageBytes, usage, quota)) {
      const available = Number.isFinite(quota) && Number.isFinite(usage)
        ? Math.max(0, quota - usage - Math.max(STORAGE_RESERVE_BYTES, quota * 0.15))
        : 0;
      throw new Error(`المساحة المتاحة لا تكفي لتنزيل المصحف المصوّر كاملًا بأمان. الحجم التقديري نحو ${Math.ceil(estimatedPackageBytes / (1024 * 1024))} MB، والمتاح بعد الاحتياطي نحو ${Math.floor(available / (1024 * 1024))} MB. الصفحات التي حُفظت بالفعل ستبقى ويمكنك الاستكمال بعد توفير مساحة.`);
    }
  }

  let cached = (await getMushafOfflinePackageStatus()).cached;
  onProgress?.({ cached, total: MUSHAF_OFFLINE_PAGE_COUNT, missing: MUSHAF_OFFLINE_PAGE_COUNT - cached, currentPage: null });

  for (let page = 1; page <= MUSHAF_OFFLINE_PAGE_COUNT; page++) {
    throwIfAborted(signal);
    const { svgUrl } = getMushafFacsimilePageUrls(page);
    const existing = await cache.match(svgUrl);
    if (existing) {
      try {
        const markup = await existing.clone().text();
        parseMushafViewBox(markup);
        parseMushafAyahCoordinates(markup);
        const safeMarkup = sanitizeMushafSvgMarkup(markup);
        await validatePageAgainstLocalQuran(page, markup);
        if (safeMarkup !== markup) await cache.put(svgUrl, createSanitizedSvgResponse(existing, safeMarkup));
        continue;
      } catch {
        await cache.delete(svgUrl);
        cached = Math.max(0, cached - 1);
      }
    }
    const downloaded = await fetchValidatedPage(page, signal);
    try {
      await cache.put(svgUrl, downloaded.response.clone());
    } catch {
      throw new Error(`امتلأت مساحة التخزين عند الصفحة ${page}. احتفظنا بالصفحات المكتملة ويمكنك الاستكمال بعد توفير مساحة.`);
    }
    cached++;
    onProgress?.({ cached, total: MUSHAF_OFFLINE_PAGE_COUNT, missing: MUSHAF_OFFLINE_PAGE_COUNT - cached, currentPage: page });
  }

  const finalStatus = await getMushafOfflinePackageStatus();
  if (finalStatus.missing !== 0) {
    throw new Error(`لم يكتمل التحقق من حزمة المصحف: ما زال ${finalStatus.missing} صفحة غير محفوظة.`);
  }
  return finalStatus;
}

export async function clearMushafOfflinePackage(): Promise<void> {
  if (typeof caches === 'undefined') throw new Error('التخزين المحلي غير متاح في هذا المتصفح.');
  await caches.delete(MUSHAF_OFFLINE_CACHE_NAME);
}
