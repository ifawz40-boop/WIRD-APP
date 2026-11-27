const APPROVED_RECITERS = [
  { id: 'ar.husary', cdnEdition: 'ar.husary', name: 'Mahmoud Khalil Al-Husary', arabicName: 'محمود خليل الحصري', style: 'Murattal', bitrate: 128 },
  { id: 'ar.minshawi', cdnEdition: 'ar.minshawi', name: 'Mohamed Siddiq al-Minshawi', arabicName: 'محمد صديق المنشاوي', style: 'Murattal', bitrate: 128 },
  { id: 'ar.abdulbasit', cdnEdition: 'ar.abdulbasitmurattal', name: 'Abdul Basit Abdul Samad', arabicName: 'عبد الباسط عبد الصمد', style: 'Murattal', bitrate: 192 },
  { id: 'ar.sudais', cdnEdition: 'ar.abdurrahmaansudais', name: 'Abdul Rahman Al-Sudais', arabicName: 'عبدالرحمن السديس', style: 'Murattal', bitrate: 192 },
  { id: 'ar.shuraim', cdnEdition: 'ar.saoodshuraym', name: 'Saud Al-Shuraim', arabicName: 'سعود الشريم', style: 'Murattal', bitrate: 64 },
  { id: 'ar.ajamy', cdnEdition: 'ar.ahmedajamy', name: 'Ahmed ibn Ali al-Ajamy', arabicName: 'أحمد بن علي العجمي', style: 'Murattal', bitrate: 64 },
  { id: 'ar.alafasy', cdnEdition: 'ar.alafasy', name: 'Mishary Rashid Alafasy', arabicName: 'مشاري راشد العفاسي', style: 'Murattal', bitrate: 128 }
] as const;

function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

const MAX_AUDIO_PROXY_BYTES = 8 * 1024 * 1024;
const AUDIO_PROXY_TIMEOUT_MS = 15_000;

/**
 * Curated Al Quran Cloud audio editions + same-origin offline download proxy.
 * The browser never supplies an upstream URL or arbitrary reciter identifier.
 * Recitation audio is strictly allowlisted to APPROVED_RECITERS and ayahs 1..6236.
 */
export default async function handler(req: any, res: any) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(204).end();
  }
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return send(res, 405, { error: 'METHOD_NOT_ALLOWED' });
  }

  const rawType = req.query?.type;
  if (Array.isArray(rawType) && rawType.length !== 1) return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });
  const type = String(Array.isArray(rawType) ? rawType[0] : rawType || '');

  if (type === 'reciters') {
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return send(res, 200, {
      provider: 'Al Quran Cloud',
      source: 'https://alquran.cloud/cdn',
      reciters: APPROVED_RECITERS
    });
  }

  if (type === 'ayah') {
    const rawReciter = req.query?.reciter;
    const rawAyah = req.query?.ayah;
    if (Array.isArray(rawReciter) || Array.isArray(rawAyah)) {
      return send(res, 400, { error: 'INVALID_AUDIO_AYAH_QUERY' });
    }
    const reciterId = String(rawReciter || '').trim();
    const ayahStr = String(rawAyah || '').trim();
    const reciter = APPROVED_RECITERS.find(r => r.id === reciterId);
    if (!reciter || !/^[1-9][0-9]{0,3}$/.test(ayahStr)) {
      return send(res, 400, { error: 'INVALID_AUDIO_AYAH_QUERY' });
    }
    const ayahNumber = Number(ayahStr);
    if (!Number.isSafeInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > 6236) {
      return send(res, 400, { error: 'INVALID_AUDIO_AYAH_QUERY' });
    }

    const upstreamUrl = `https://cdn.islamic.network/quran/audio/${reciter.bitrate}/${reciter.cdnEdition}/${ayahNumber}.mp3`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUDIO_PROXY_TIMEOUT_MS);
    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'GET',
        redirect: 'error',
        signal: controller.signal
      });
      if (upstream.status !== 200) {
        return send(res, 502, { error: 'UPSTREAM_AUDIO_UNAVAILABLE', status: upstream.status });
      }
      const buffer = await upstream.arrayBuffer();
      if (buffer.byteLength === 0 || buffer.byteLength > MAX_AUDIO_PROXY_BYTES) {
        return send(res, 502, { error: 'UPSTREAM_AUDIO_INVALID_SIZE' });
      }
      const bytes = Buffer.from(buffer);
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Length', String(bytes.byteLength));
      res.setHeader('Cache-Control', 'public, s-maxage=31536000, max-age=31536000, immutable');
      res.status(200);
      if (typeof res.send === 'function') {
        return res.send(bytes);
      }
      return res.end(bytes);
    } catch {
      return send(res, 502, { error: 'UPSTREAM_AUDIO_FETCH_FAILED' });
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return send(res, 400, { error: 'INVALID_AUDIO_CATALOG_QUERY' });
}
