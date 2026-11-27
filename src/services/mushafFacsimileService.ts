export const MUSHAF_FACSIMILE_VERSION = 'v1.1.1';
export const MUSHAF_FACSIMILE_COMMIT = '3ff27b46cecb0c0519d77531d9c868a579d1f623';
export const MUSHAF_FACSIMILE_EDITION = 'hafs-kfqc';
export const PINNED_MUSHAF_OFFLINE_CACHE_NAME = 'wird-app-mushaf-pinned-v1';
const MUSHAF_FACSIMILE_BASE_URL = `https://raw.githubusercontent.com/quran-ws/quran-svg/${MUSHAF_FACSIMILE_COMMIT}/mushafs/hafs/kfqc/svg`;

const MAX_PARSED_MUSHAF_RAM_CACHE = 20;
const parsedPageMemoryCache = new Map<number, MushafFacsimilePageData>();
const inflightPageRequests = new Map<number, Promise<MushafFacsimilePageData>>();

function rememberParsedMushafPage(page: number, data: MushafFacsimilePageData): void {
  if (parsedPageMemoryCache.has(page)) {
    parsedPageMemoryCache.delete(page);
  }
  parsedPageMemoryCache.set(page, data);
  while (parsedPageMemoryCache.size > MAX_PARSED_MUSHAF_RAM_CACHE) {
    const oldest = parsedPageMemoryCache.keys().next().value;
    if (typeof oldest !== 'number') break;
    parsedPageMemoryCache.delete(oldest);
  }
}

export function getCachedMushafFacsimilePageSync(page: number): MushafFacsimilePageData | null {
  return parsedPageMemoryCache.get(page) ?? null;
}

export interface MushafViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
  raw: string;
}

export interface MushafAyahCoordinate {
  surahNumber: number;
  ayahNumber: number;
}

export interface MushafFacsimilePageData {
  page: number;
  svgUrl: string;
  svgMarkup: string;
  viewBox: MushafViewBox;
  ayahAreas: MushafAyahCoordinate[];
}

export interface MushafLocalAyahCoordinate {
  surahNumber: number;
  numberInSurah: number;
}

const ALLOWED_SVG_ELEMENTS = new Set(['svg', 'g', 'path']);
const ALLOWED_SVG_ATTRIBUTES = new Set([
  'xmlns', 'xmlns:ayah', 'version', 'viewBox', 'xml:space',
  'transform', 'id', 'class', 'd', 'fill', 'fill-rule', 'fill-opacity',
  'ayah:x', 'ayah:y', 'number', 'ayah', 'surah'
]);

export function getMushafFacsimilePageUrls(page: number): { svgUrl: string } {
  if (!Number.isInteger(page) || page < 1 || page > 604) {
    throw new Error('رقم صفحة المصحف غير صالح.');
  }
  const filename = String(page).padStart(3, '0');
  return { svgUrl: `${MUSHAF_FACSIMILE_BASE_URL}/${filename}.svg` };
}

export function parseMushafViewBox(svgMarkup: string): MushafViewBox {
  if (typeof svgMarkup !== 'string' || svgMarkup.length < 100 || svgMarkup.length > 2_000_000) {
    throw new Error('ملف رسم صفحة المصحف غير صالح أو يتجاوز الحد الآمن.');
  }
  const root = svgMarkup.match(/<svg\b[^>]*>/i)?.[0];
  if (!root || !/xmlns=["']http:\/\/www\.w3\.org\/2000\/svg["']/i.test(root)) {
    throw new Error('تعذر التحقق من صيغة رسم صفحة المصحف.');
  }
  const raw = root.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
  if (!raw) throw new Error('ملف صفحة المصحف لا يحدد مساحة العرض.');
  const values = raw.trim().split(/[\s,]+/).map(Number);
  if (values.length !== 4 || !values.every(Number.isFinite) || values[2] <= 0 || values[3] <= 0) {
    throw new Error('أبعاد صفحة المصحف غير صالحة.');
  }
  return { x: values[0], y: values[1], width: values[2], height: values[3], raw: raw.trim() };
}

function readSvgAttribute(tag: string, attribute: 'surah' | 'ayah'): string | null {
  return tag.match(new RegExp(attribute + '="([^"]*)"', 'i'))?.[1] ?? null;
}

export function parseMushafAyahCoordinates(svgMarkup: string): MushafAyahCoordinate[] {
  const tags = [...svgMarkup.matchAll(/<path\b[^>]*class=["'][^"']*\bayahPolygon\b[^"']*["'][^>]*>/gi)].map(match => match[0]);
  if (tags.length === 0 || tags.length > 100) {
    throw new Error('لم يتم العثور على طبقة مواضع الآيات الكاملة في صفحة المصحف.');
  }
  const seen = new Set<string>();
  return tags.map(tag => {
    const surahNumber = Number(readSvgAttribute(tag, 'surah'));
    const ayahNumber = Number(readSvgAttribute(tag, 'ayah'));
    if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114 ||
        !Number.isInteger(ayahNumber) || ayahNumber < 1) {
      throw new Error('تحتوي طبقة مواضع الآيات على إحداثيات غير صالحة.');
    }
    const key = `${surahNumber}:${ayahNumber}`;
    if (seen.has(key)) throw new Error('تكرر موضع الآية داخل صفحة المصحف.');
    seen.add(key);
    return { surahNumber, ayahNumber };
  });
}

/**
 * The upstream files contain only vector paths. Keep a strict element/attribute
 * allowlist before inserting them into the DOM; reject text, scripts and links.
 */
export function sanitizeMushafSvgMarkup(svgMarkup: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    throw new Error('هذا المتصفح لا يدعم عرض صفحة المصحف المتجهية.');
  }
  const document = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('تعذر تحليل ملف صفحة المصحف.');
  const root = document.documentElement;
  if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg') {
    throw new Error('جذر ملف المصحف ليس عنصر SVG موثوقًا.');
  }

  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    if (!ALLOWED_SVG_ELEMENTS.has(element.localName) ||
        element.namespaceURI !== 'http://www.w3.org/2000/svg') {
      throw new Error('يحتوي ملف المصحف على عنصر رسومي غير مسموح.');
    }
    for (const attribute of Array.from(element.attributes)) {
      if (!ALLOWED_SVG_ATTRIBUTES.has(attribute.name)) {
        element.removeAttributeNode(attribute);
        continue;
      }
      const value = attribute.value;
      if (/javascript:|data:|https?:|url\s*\(/i.test(value) &&
          attribute.name !== 'xmlns' && attribute.name !== 'xmlns:ayah') {
        throw new Error('يحتوي ملف المصحف على مرجع خارجي غير مسموح.');
      }
    }
  }

  const paths = root.querySelectorAll('path.ayahPolygon');
  if (paths.length === 0) throw new Error('ملف الصفحة لا يحتوي على طبقة تفاعلية للآيات.');
  return new XMLSerializer().serializeToString(root);
}

/**
 * The vector artwork supplies geometry only. Quran text, audio, tafsir and
 * progress always resolve through WIRD's own local ayah records.
 */
export function matchMushafAyahAreas<T extends MushafLocalAyahCoordinate>(
  areas: MushafAyahCoordinate[],
  localAyahs: T[]
): Array<{ area: MushafAyahCoordinate; ayah: T }> {
  const local = new Map(localAyahs.map(ayah => [`${ayah.surahNumber}:${ayah.numberInSurah}`, ayah]));
  if (local.size !== localAyahs.length || local.size !== areas.length) {
    throw new Error('عدد الآيات في تخطيط الصفحة لا يطابق نص وِرد المحلي.');
  }
  const matched = areas.map(area => {
    const ayah = local.get(`${area.surahNumber}:${area.ayahNumber}`);
    if (!ayah) throw new Error('إحداثيات تخطيط المصحف لا تطابق آيات الصفحة في وِرد.');
    return { area, ayah };
  });
  if (new Set(matched.map(item => item.ayah)).size !== localAyahs.length) {
    throw new Error('تعذر مطابقة جميع آيات الصفحة دون تكرار.');
  }
  return matched;
}

export async function loadMushafFacsimilePage(
  page: number,
  signal?: AbortSignal
): Promise<MushafFacsimilePageData> {
  const { svgUrl } = getMushafFacsimilePageUrls(page);
  const memCached = parsedPageMemoryCache.get(page);
  if (memCached) {
    rememberParsedMushafPage(page, memCached);
    return memCached;
  }

  if (!signal && inflightPageRequests.has(page)) {
    return inflightPageRequests.get(page)!;
  }

  const runFetch = async (): Promise<MushafFacsimilePageData> => {
    // Check permanent user-downloaded offline Mushaf cache first when available
    if (typeof caches !== 'undefined') {
      try {
        const pinnedCache = await caches.open(PINNED_MUSHAF_OFFLINE_CACHE_NAME);
        const pinnedMatch = await pinnedCache.match(svgUrl);
        if (pinnedMatch && pinnedMatch.ok) {
          const cachedMarkup = await pinnedMatch.text();
          const viewBox = parseMushafViewBox(cachedMarkup);
          const ayahAreas = parseMushafAyahCoordinates(cachedMarkup);
          const safeSvgMarkup = sanitizeMushafSvgMarkup(cachedMarkup);
          const built = { page, svgUrl, svgMarkup: safeSvgMarkup, viewBox, ayahAreas };
          rememberParsedMushafPage(page, built);
          return built;
        }
      } catch {
        // Fall through to normal fetch / SW cache
      }
    }

    const response = await fetch(svgUrl, {
      signal,
      mode: 'cors',
      credentials: 'omit',
      headers: { Accept: 'image/svg+xml' }
    });
    if (!response.ok) {
      throw new Error('تعذر تحميل الصفحة المطبوعة؛ يمكنك متابعة القراءة بالعرض المرن.');
    }
    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.includes('image/svg+xml')) {
      throw new Error('نوع ملف صفحة المصحف لا يطابق صيغة SVG المتوقعة.');
    }
    const svgMarkup = await response.text();
    const viewBox = parseMushafViewBox(svgMarkup);
    const ayahAreas = parseMushafAyahCoordinates(svgMarkup);
    const safeSvgMarkup = sanitizeMushafSvgMarkup(svgMarkup);
    const built = { page, svgUrl, svgMarkup: safeSvgMarkup, viewBox, ayahAreas };
    rememberParsedMushafPage(page, built);
    return built;
  };

  if (signal) {
    return runFetch();
  }
  const p = runFetch().finally(() => {
    inflightPageRequests.delete(page);
  });
  inflightPageRequests.set(page, p);
  return p;
}

/**
 * Pre-fetch and parse adjacent Mushaf pages into RAM so RTL page-flipping
 * renders in 0ms without a loading spinner.
 */
export function preloadAdjacentMushafPages(anchorPage: number): void {
  const neighbors = [
    anchorPage + 1,
    anchorPage + 2,
    anchorPage - 1,
    anchorPage - 2,
    anchorPage + 3,
  ].filter((p) => Number.isInteger(p) && p >= 1 && p <= 604);

  for (const neighbor of neighbors) {
    if (parsedPageMemoryCache.has(neighbor) || inflightPageRequests.has(neighbor)) continue;
    void loadMushafFacsimilePage(neighbor).catch(() => {
      // Opportunistic warm-up; ignore background network misses.
    });
  }
}

export interface PinnedMushafOfflineProgress {
  completed: number;
  total: number;
  cachedBytesApprox: number;
}

export async function getPinnedMushafOfflineStatus(): Promise<{
  cachedPages: number;
  totalPages: number;
  isComplete: boolean;
}> {
  const totalPages = 604;
  if (typeof caches === 'undefined') {
    return { cachedPages: 0, totalPages, isComplete: false };
  }
  try {
    const cache = await caches.open(PINNED_MUSHAF_OFFLINE_CACHE_NAME);
    const keys = await cache.keys();
    const valid = keys.filter((req) => /\/[0-9]{3}\.svg$/.test(new URL(req.url).pathname));
    const count = Math.min(totalPages, valid.length);
    return { cachedPages: count, totalPages, isComplete: count === totalPages };
  } catch {
    return { cachedPages: 0, totalPages, isComplete: false };
  }
}

export async function downloadFullMushafForOffline(
  onProgress?: (progress: PinnedMushafOfflineProgress) => void,
  signal?: AbortSignal
): Promise<{ cachedPages: number; totalPages: number }> {
  if (typeof caches === 'undefined') {
    throw new Error('ذاكرة التخزين الدائم غير مدعومة في هذا المتصفح.');
  }
  const totalPages = 604;
  const cache = await caches.open(PINNED_MUSHAF_OFFLINE_CACHE_NAME);
  let cursor = 1;
  let completed = 0;
  let approxBytes = 0;
  const concurrency = 6;

  const worker = async () => {
    while (cursor <= totalPages) {
      if (signal?.aborted) throw new Error('تم إيقاف تنزيل صفحات المصحف مؤقتاً.');
      const pageNum = cursor++;
      if (pageNum > totalPages) return;
      const { svgUrl } = getMushafFacsimilePageUrls(pageNum);
      const request = new Request(svgUrl, {
        mode: 'cors',
        credentials: 'omit',
        headers: { Accept: 'image/svg+xml' },
      });
      const existing = await cache.match(request);
      if (existing && existing.ok) {
        completed++;
        approxBytes += 42_000;
        onProgress?.({ completed, total: totalPages, cachedBytesApprox: approxBytes });
        continue;
      }
      let response: Response | null = null;
      let lastFetchErr: unknown = null;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          response = await fetch(request, { signal });
          if (response.ok) break;
          if (response.status >= 500 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
            continue;
          }
          break;
        } catch (err) {
          lastFetchErr = err;
          if (signal?.aborted) throw new Error('تم إيقاف تنزيل صفحات المصحف مؤقتاً.');
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
          }
        }
      }
      if (!response || !response.ok) {
        throw lastFetchErr instanceof Error
          ? lastFetchErr
          : new Error(`تعذر تحميل صفحة المصحف رقم ${pageNum}.`);
      }
      const text = await response.text();
      parseMushafViewBox(text);
      parseMushafAyahCoordinates(text);
      const safeSvg = sanitizeMushafSvgMarkup(text);
      approxBytes += safeSvg.length;
      await cache.put(
        request,
        new Response(safeSvg, {
          status: 200,
          headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' },
        })
      );
      completed++;
      onProgress?.({ completed, total: totalPages, cachedBytesApprox: approxBytes });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { cachedPages: completed, totalPages };
}

export async function clearPinnedMushafOfflineCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  await caches.delete(PINNED_MUSHAF_OFFLINE_CACHE_NAME);
}
