const APPROVED_AUDIO_EDITIONS: Record<string, { edition: string; bitrate: 64 | 128 | 192 }> = {
  'ar.husary': { edition: 'ar.husary', bitrate: 128 },
  'ar.minshawi': { edition: 'ar.minshawi', bitrate: 128 },
  'ar.abdulbasit': { edition: 'ar.abdulbasitmurattal', bitrate: 192 },
  'ar.sudais': { edition: 'ar.abdurrahmaansudais', bitrate: 192 },
  'ar.shuraim': { edition: 'ar.saoodshuraym', bitrate: 64 },
  'ar.ajamy': { edition: 'ar.ahmedajamy', bitrate: 64 },
  'ar.alafasy': { edition: 'ar.alafasy', bitrate: 128 }
};

const MAX_AUDIO_FILE_BYTES = 8 * 1024 * 1024;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 300;
const MAX_RATE_LIMIT_BUCKETS = 1000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function sendError(res: any, statusCode: number, code: string) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statusCode).json({ error: code });
}

function getClientIp(req: any): string {
  const realIp = req.headers?.['x-real-ip'];
  const realCandidate = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof realCandidate === 'string' && realCandidate.trim()) return realCandidate.trim();
  if (typeof req.ip === 'string' && req.ip.trim()) return req.ip.trim();
  const remoteAddress = req.socket?.remoteAddress;
  if (typeof remoteAddress === 'string' && remoteAddress.trim()) return remoteAddress.trim();
  const forwarded = req.headers?.['x-forwarded-for'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return typeof raw === 'string' && raw.trim() ? raw.split(',')[0].trim() : 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  if (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
    for (const [key, value] of rateLimits.entries()) {
      if (now >= value.resetAt) rateLimits.delete(key);
    }
    while (rateLimits.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldest = rateLimits.keys().next().value;
      if (typeof oldest !== 'string') break;
      rateLimits.delete(oldest);
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

function oneQueryValue(value: unknown): string {
  if (Array.isArray(value)) return value.length === 1 ? String(value[0]) : '';
  return value === undefined || value === null ? '' : String(value);
}

/**
 * Same-origin, allowlisted audio relay.
 * The browser must read the response bytes to persist them in Cache Storage;
 * some CDN responses do not expose CORS headers, even though <audio> playback works.
 * The client never supplies an upstream URL, edition, or bitrate.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, 405, 'METHOD_NOT_ALLOWED');
  }

  const reciterId = oneQueryValue(req.query?.reciter);
  const globalAyahNumber = Number(oneQueryValue(req.query?.ayah));
  const edition = APPROVED_AUDIO_EDITIONS[reciterId];
  if (!edition || !Number.isSafeInteger(globalAyahNumber) ||
      globalAyahNumber < 1 || globalAyahNumber > 6236) {
    return sendError(res, 400, 'INVALID_AUDIO_REQUEST');
  }

  if (isRateLimited(getClientIp(req))) {
    res.setHeader('Retry-After', '60');
    return sendError(res, 429, 'AUDIO_DOWNLOAD_RATE_LIMITED');
  }

  const upstreamUrl = `https://cdn.islamic.network/quran/audio/${edition.bitrate}/${edition.edition}/${globalAyahNumber}.mp3`;
  try {
    const upstream = await fetch(upstreamUrl, {
      method: 'GET',
      redirect: 'error',
      headers: { Accept: 'audio/mpeg' },
      signal: AbortSignal.timeout(20_000)
    });
    if (!upstream.ok || upstream.status !== 200 || upstream.type === 'opaque') {
      return sendError(res, 502, 'AUDIO_SOURCE_UNAVAILABLE');
    }
    const contentType = (upstream.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('audio/')) {
      return sendError(res, 502, 'INVALID_AUDIO_SOURCE_RESPONSE');
    }
    const declaredLength = upstream.headers.get('content-length');
    if (declaredLength) {
      const size = Number(declaredLength);
      if (!Number.isSafeInteger(size) || size < 1 || size > MAX_AUDIO_FILE_BYTES) {
        return sendError(res, 413, 'AUDIO_FILE_SIZE_REJECTED');
      }
    }
    const bytes = new Uint8Array(await upstream.arrayBuffer());
    if (bytes.byteLength < 1 || bytes.byteLength > MAX_AUDIO_FILE_BYTES ||
        (declaredLength && Number(declaredLength) !== bytes.byteLength)) {
      return sendError(res, 502, 'INVALID_AUDIO_FILE_SIZE');
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', String(bytes.byteLength));
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Disposition', 'inline; filename="quran-ayah-' + globalAyahNumber + '.mp3"');
    return res.status(200).send(Buffer.from(bytes));
  } catch (error) {
    const name = error && typeof error === 'object' && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
    return sendError(res, name === 'TimeoutError' ? 504 : 502, 'AUDIO_SOURCE_UNAVAILABLE');
  }
}
