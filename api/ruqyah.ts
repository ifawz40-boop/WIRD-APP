import { ALL_SURAHS } from '../src/data/quranMeta.ts';

const API_BASE = 'https://islamicapi.com/api/v1/ruqyah/';
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const MAX_RATE_LIMIT_BUCKETS = 1000;
const MAX_UPSTREAM_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_EXTERNAL_INDEX_ID = 999_999_999;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

const ALLOWED_TYPES = new Set(['instant', 'topic-category', 'topic']);
const ALLOWED_TOPICS = new Set([
  'introduction-to-ruqyah', 'protect-yourself-from-jinn', 'black-magic-sihr',
  'evil-eye-and-envy', 'about-raqi', 'types-of-hijamah-bloodletting',
  'ruqyah-materials', '7-day-detoxification-program', 'waswasah-whisperings',
  'the-ruqyah-bath-against-sihr', 'other-diseases',
  'treatment-for-general-problems', 'full-ruqyah-program'
]);
const ALLOWED_PROGRAMS = new Set(['brief-ruqya', 'a-medium-ruqya', 'a-long-ruqya']);
// Only use the external API as an index for Quran references. Hadith/dua text
// from third-party payloads is not trusted or rendered in WIRD.
const ALLOWED_SOURCES = new Set(['from-quran']);


function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readQueryValue(value: unknown): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  return typeof candidate === 'string' ? candidate.trim() : '';
}

interface QuranIndexCoordinates {
  surahNumber: number;
  startAyah: number;
  endAyah: number;
}

function parseQuranIndexTitle(value: unknown): QuranIndexCoordinates | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const digitMap = '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹';
  const normalized = value.replace(/[٠-٩۰-۹]/g, digit => {
    const index = digitMap.indexOf(digit);
    return String(index % 10);
  });
  const normalizedTitle = normalized.trim();
  const match = normalizedTitle.match(/^[^0-9+−﹣－＋-]*?([0-9]{1,3}) *: *([0-9]{1,3})(?: *[-–—] *([0-9]{1,3}))?[^0-9+−﹣－＋-]*$/);
  if (match) {
    const surahNumber = Number(match[1]);
    const startAyah = Number(match[2]);
    const endAyah = match[3] === undefined ? startAyah : Number(match[3]);
    const surah = ALL_SURAHS.find(item => item.number === surahNumber);
    if (!surah || !Number.isSafeInteger(startAyah) || !Number.isSafeInteger(endAyah) ||
        startAyah < 1 || endAyah < startAyah || endAyah > surah.versesCount) return null;
    return { surahNumber, startAyah, endAyah };
  }

  // Some verified provider entries refer to an entire Surah by its canonical
  // name and number (e.g. "الأعلى ٨٧"). Expand only an exact local metadata
  // match; never infer ranges from provider-authored Quran text.
  const wholeSurahMatch = normalizedTitle.match(/^(.+?)\s+([0-9]{1,3})$/);
  if (!wholeSurahMatch) return null;
  const surahNumber = Number(wholeSurahMatch[2]);
  const surah = ALL_SURAHS.find(item => item.number === surahNumber);
  const suppliedName = wholeSurahMatch[1].trim();
  if (!surah || (suppliedName !== surah.name && suppliedName !== surah.englishName)) return null;
  return { surahNumber, startAyah: 1, endAyah: surah.versesCount };
}

function sanitizeQuranIndexData(data: unknown): unknown {
  const rows = Array.isArray(data) ? data : [data];
  const sanitized = rows.map(row => {
    const record = row as Record<string, unknown>;
    const coordinates = parseQuranIndexTitle(record.title);
    if (!coordinates) throw new Error('Invalid Quran index coordinates');
    const { surahNumber, startAyah, endAyah } = coordinates;
    return {
      id: record.id,
      title: `${surahNumber}:${startAyah}-${endAyah}`
    };
  });
  return Array.isArray(data) ? sanitized : sanitized[0];
}

function isSafeProviderId(value: unknown): value is number | string {
  return (typeof value === 'number' && Number.isSafeInteger(value) && value > 0 && value <= MAX_EXTERNAL_INDEX_ID) ||
    (typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value));
}

function boundedText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length <= maxLength;
}

function sanitizeTopicCategories(data: unknown): unknown[] {
  if (!Array.isArray(data) || data.length > 13) throw new Error('Invalid topic categories');
  return data.map(category => {
    if (!isRecord(category) || !boundedText(category.title, 160) || !Array.isArray(category.subcategories) ||
        category.subcategories.length > 2) throw new Error('Invalid topic category');
    return {
      title: category.title,
      subcategories: category.subcategories.map(subcategory => {
        if (!isRecord(subcategory) || !boundedText(subcategory.subcategory, 160) ||
            typeof subcategory['subcategory-slug'] !== 'string' ||
            !ALLOWED_TOPICS.has(subcategory['subcategory-slug']) || !Array.isArray(subcategory.ruqyah) ||
            subcategory.ruqyah.length > 100) throw new Error('Invalid topic subcategory');
        return {
          subcategory: subcategory.subcategory,
          'subcategory-slug': subcategory['subcategory-slug'],
          ruqyah: subcategory.ruqyah.map(article => {
            if (!isRecord(article) || !isSafeProviderId(article.id) || !boundedText(article.title, 300)) {
              throw new Error('Invalid topic article index');
            }
            return { id: article.id, title: article.title };
          })
        };
      })
    };
  });
}

function sanitizeTopicArticles(data: unknown): unknown {
  const rows = Array.isArray(data) ? data : [data];
  if (rows.length > 100) throw new Error('Too many topic articles');
  const sanitized = rows.map(article => {
    if (!isRecord(article) || !isSafeProviderId(article.sub_id) || !boundedText(article.title, 300) ||
        !boundedText(article.category, 160) ||
        (article.section_title !== undefined && !boundedText(article.section_title, 300)) ||
        !Array.isArray(article.content) || article.content.length > 100) {
      throw new Error('Invalid topic article');
    }
    let totalTextLength = 0;
    const content = article.content.map(block => {
      if (!isRecord(block) ||
          !['text', 'arabic', 'translation', 'header', 'transliteration'].includes(String(block.type)) ||
          !boundedText(block.content, 12_000)) throw new Error('Invalid topic content block');
      totalTextLength += block.content.length;
      if (totalTextLength > 60_000) throw new Error('Topic article too large');
      return { type: block.type, content: block.content };
    });
    return {
      sub_id: article.sub_id,
      title: article.title,
      ...(article.section_title ? { section_title: article.section_title } : {}),
      category: article.category,
      content
    };
  });
  return Array.isArray(data) ? sanitized : sanitized[0];
}

function isAllowedType(type: string): boolean {
  return ALLOWED_TYPES.has(type);
}

function getClientIp(req: any): string {
  // On Vercel, x-real-ip is set by the trusted edge. Do not trust the
  // client-controlled leftmost x-forwarded-for value for rate-limit identity.
  const realIp = req.headers?.['x-real-ip'];
  const candidate = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  const remoteAddress = req.socket?.remoteAddress;
  return typeof remoteAddress === 'string' && remoteAddress.trim() ? remoteAddress.trim() : 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, record] of rateLimits.entries()) {
      if (now >= record.resetAt) rateLimits.delete(key);
    }
    while (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = rateLimits.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      rateLimits.delete(oldestKey);
    }
  }
  const current = rateLimits.get(ip);
  if (!current || now >= current.resetAt) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT_MAX;
}

function validPayload(payload: unknown): boolean {
  if (!isRecord(payload) || payload.status !== 'success' || !('data' in payload)) return false;
  const rawData = payload.data;
  const rawRows: unknown[] = Array.isArray(rawData) ? rawData : [rawData];
  if (rawRows.length > 500) return false;
  const rows = rawRows.filter(isRecord);
  if (rows.length !== rawRows.length) return false;
  return !rows.some(row =>
    !((typeof row.id === 'number' && Number.isSafeInteger(row.id) && row.id > 0 && row.id <= MAX_EXTERNAL_INDEX_ID) ||
      (typeof row.id === 'string' && /^[1-9][0-9]{0,8}$/.test(row.id))) ||
    parseQuranIndexTitle(row.title) === null
  );
}

function parseUpstreamJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('<')) return null;
  try { return JSON.parse(trimmed) as unknown; } catch { return null; }
}

async function fetchRuqyahSourceWithRetry(url: string): Promise<Response> {
  let response: Response | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000)
    });
    if (![502, 503, 504].includes(response.status) || attempt === 1) return response;
    await response.body?.cancel().catch(() => undefined);
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!response) throw new Error('RUQYAH_SOURCE_NO_RESPONSE');
  return response;
}

async function readBoundedUpstreamText(response: Response): Promise<string | null> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      totalBytes += result.value.byteLength;
      if (totalBytes > MAX_UPSTREAM_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(result.value);
    }
    const combined = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return new TextDecoder().decode(combined);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    try { reader.releaseLock(); } catch { /* stream already cancelled or closed */ }
  }
}

/**
 * Server-side IslamicAPI proxy. Quran locator responses are reduced to canonical
 * numeric coordinates; topic articles use a bounded, allowlisted text-block schema.
 * The API key is never sent to the browser.
 */
async function handleRuqyahRequest(req: any, res: any) {
  // The proxy is consumed by WIRD through same-origin requests; do not grant cross-origin access.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const query = req.query || {};
  const type = readQueryValue(query.type);
  if (!isAllowedType(type)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
  if ((type === 'topic' || type === 'topic-category') && process.env.RUQYAH_TOPICS_ENABLED !== 'true') {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 404, { error: 'RUQYAH_TOPICS_DISABLED' });
  }

  const params = new URLSearchParams({ type, lang: 'ar' });
  if (type === 'instant') {
    const program = readQueryValue(query.program);
    const source = readQueryValue(query.source);
    if (!ALLOWED_PROGRAMS.has(program) || !ALLOWED_SOURCES.has(source)) {
      return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    }
    params.set('program', program);
    params.set('source', source);
    const id = readQueryValue(query.id);
    if (id) {
      if (!/^[1-9]\d{0,4}$/.test(id)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
      params.set('id', id);
    }
    const random = readQueryValue(query.random);
    if (random && random !== 'true' && random !== 'false') {
      return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    }
    if (random) params.set('random', random);
  } else if (type === 'topic') {
    const topic = readQueryValue(query.topic);
    if (!ALLOWED_TOPICS.has(topic)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    params.set('topic', topic);
    const id = readQueryValue(query.id);
    if (id) {
      if (!/^[1-9]\d{0,8}$/.test(id)) return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
      params.set('id', id);
    }
    const random = readQueryValue(query.random);
    if (random && random !== 'true' && random !== 'false') {
      return send(res, 400, { error: 'INVALID_RUQYAH_QUERY' });
    }
    if (random) params.set('random', random);
  }

  const apiKey = process.env.ISLAMICAPI_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 503, { error: 'RUQYAH_API_KEY_NOT_CONFIGURED' });
  }

  const ip = getClientIp(req);
  if (isRateLimited(ip)) {
    res.setHeader('Retry-After', '60');
    return send(res, 429, { error: 'RATE_LIMITED' });
  }

  params.set('api_key', apiKey.trim());
  try {
    const upstream = await fetchRuqyahSourceWithRetry(API_BASE + '?' + params.toString());
    const contentType = upstream.headers.get('content-type') || '';
    const declaredLengthHeader = upstream.headers.get('content-length');
    const declaredLength = declaredLengthHeader === null ? null : Number(declaredLengthHeader);
    if (declaredLength !== null && Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }
    const raw = await readBoundedUpstreamText(upstream);
    if (raw === null) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }
    const payload = /application\/(?:[a-z0-9.+-]*\+)?json/i.test(contentType)
      ? parseUpstreamJson(raw)
      : null;

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      if (upstream.status === 401) {
        return send(res, 502, { error: 'RUQYAH_API_KEY_REJECTED' });
      }
      if (upstream.status === 429) {
        const retryAfter = upstream.headers.get('retry-after');
        if (retryAfter && /^\d{1,4}$/.test(retryAfter)) res.setHeader('Retry-After', retryAfter);
        return send(res, 503, { error: 'RUQYAH_SOURCE_RATE_LIMITED' });
      }
      return send(res, 502, { error: 'RUQYAH_SOURCE_UNAVAILABLE' });
    }
    if (!isRecord(payload) || payload.status !== 'success' || !('data' in payload)) {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }

    let sanitizedData: unknown;
    try {
      if (type === 'instant') {
        if (!validPayload(payload)) throw new Error('Invalid Quran locator payload');
        sanitizedData = sanitizeQuranIndexData(payload.data);
      } else if (type === 'topic-category') {
        sanitizedData = sanitizeTopicCategories(payload.data);
      } else {
        sanitizedData = sanitizeTopicArticles(payload.data);
      }
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return send(res, 502, { error: 'INVALID_RUQYAH_SOURCE_RESPONSE' });
    }

    res.setHeader('Cache-Control', type === 'instant'
      ? 'public, s-maxage=3600, stale-while-revalidate=86400'
      : 'no-store');
    return send(res, 200, {
      status: 'success',
      data: sanitizedData,
      source: 'IslamicAPI',
      language: 'ar',
      type
    });
  } catch (error: any) {
    res.setHeader('Cache-Control', 'no-store');
    return send(res, 502, {
      error: 'RUQYAH_SOURCE_ERROR',
      message: error?.name === 'TimeoutError' ? 'SOURCE_TIMEOUT' : 'SOURCE_ERROR'
    });
  }
}


/** Catch unexpected failures outside the upstream request block as a sanitized JSON response. */
export default async function handler(req: any, res: any) {
  try {
    return await handleRuqyahRequest(req, res);
  } catch (error) {
    // Never log the error message or URL: upstream fetch errors may contain the API key query parameter.
    const errorType = error instanceof Error ? 'Error' : 'UnknownError';
    const method = req?.method === 'GET' || req?.method === 'POST' || req?.method === 'OPTIONS'
      ? req.method
      : 'OTHER';
    console.error('[WIRD Ruqyah] Unhandled proxy failure', { method, errorType });
    try { res.setHeader('Cache-Control', 'no-store'); } catch { /* response may already be unusable */ }
    return send(res, 502, { error: 'RUQYAH_INTERNAL_ERROR' });
  }
}
