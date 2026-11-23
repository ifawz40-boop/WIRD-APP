/**
 * Read-only, SSRF-safe YouTube playlist metadata resolver.
 * Strictly accepts a validated YouTube playlist ID (`^[A-Za-z0-9_-]{10,64}$`)
 * and connects exclusively to hardcoded `https://www.youtube.com` endpoints.
 */

const PLAYLIST_ID_RE = /^[A-Za-z0-9_-]{10,64}$/;
const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function send(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(statusCode).json(payload);
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseDurationToSeconds(durationText: string): number {
  const parts = durationText
    .trim()
    .split(':')
    .map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n) || n < 0)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
}

interface ParsedVideo {
  videoId: string;
  title: string;
  durationText: string;
  durationSeconds: number;
  description?: string;
  publishedAt?: string;
  speaker?: string;
}

function extractVideosFromYtInitialData(data: unknown): {
  title?: string;
  speaker?: string;
  videos: ParsedVideo[];
} {
  const videos: ParsedVideo[] = [];
  const seen = new Set<string>();
  let fallbackSpeaker = '';

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, any>;
    const renderer = obj.playlistPanelVideoRenderer || obj.playlistVideoRenderer;
    if (renderer && typeof renderer === 'object') {
      const videoId = typeof renderer.videoId === 'string' ? renderer.videoId.trim() : '';
      if (VIDEO_ID_RE.test(videoId) && !seen.has(videoId)) {
        seen.add(videoId);
        const title =
          renderer.title?.simpleText ||
          (Array.isArray(renderer.title?.runs)
            ? renderer.title.runs.map((r: any) => String(r?.text || '')).join('')
            : '') ||
          '';
        const durationText = String(renderer.lengthText?.simpleText || '—');
        const speaker = String(renderer.shortBylineText?.runs?.[0]?.text || '');
        if (speaker && !fallbackSpeaker) fallbackSpeaker = speaker;
        videos.push({
          videoId,
          title: title.trim().slice(0, 180) || `درس ${videos.length + 1}`,
          durationText,
          durationSeconds:
            Number(renderer.lengthSeconds) > 0
              ? Number(renderer.lengthSeconds)
              : parseDurationToSeconds(durationText),
          speaker: speaker.trim().slice(0, 100),
        });
      }
    }
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
    } else {
      for (const val of Object.values(obj)) walk(val);
    }
  }

  walk(data);
  const root = data as Record<string, any>;
  const playlistTitle = root?.metadata?.playlistMetadataRenderer?.title;
  return {
    title: typeof playlistTitle === 'string' ? playlistTitle.trim().slice(0, 160) : undefined,
    speaker: fallbackSpeaker || undefined,
    videos,
  };
}

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

  const rawList = req.query?.list;
  if (Array.isArray(rawList)) {
    return send(res, 400, {
      error: 'INVALID_PLAYLIST_ID',
      message: 'معرف قائمة التشغيل غير صالح.',
    });
  }
  const playlistId = typeof rawList === 'string' ? rawList.trim() : '';
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    return send(res, 400, {
      error: 'INVALID_PLAYLIST_ID',
      message: 'معرف قائمة التشغيل غير صالح.',
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6500);

  try {
    const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
    const feedRes = await fetch(feedUrl, {
      signal: controller.signal,
      redirect: 'error',
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept-Language': 'ar,en;q=0.9',
      },
    });

    if (!feedRes.ok) {
      return send(res, 502, {
        error: 'PLAYLIST_UNREACHABLE',
        message: 'تعذر الوصول إلى قائمة التشغيل. تأكد من أن القائمة عامة وليست خاصة.',
      });
    }

    const xml = await feedRes.text();
    const feedTitleMatch = xml.match(/<feed[\s\S]*?<title>([\s\S]*?)<\/title>/);
    const feedAuthorMatch = xml.match(/<feed[\s\S]*?<author>\s*<name>([\s\S]*?)<\/name>/);
    const playlistTitleFromFeed = feedTitleMatch ? decodeXmlEntities(feedTitleMatch[1]).trim() : '';
    const playlistAuthorFromFeed = feedAuthorMatch ? decodeXmlEntities(feedAuthorMatch[1]).trim() : '';

    const xmlEntries: ParsedVideo[] = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)]
      .map((m) => {
        const block = m[1];
        const get = (tag: string) =>
          (block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)) || [])[1] || '';
        const videoId = get('yt:videoId').trim();
        if (!VIDEO_ID_RE.test(videoId)) return null;
        return {
          videoId,
          title: decodeXmlEntities(get('title')).trim().slice(0, 180),
          durationText: '—',
          durationSeconds: 0,
          description: decodeXmlEntities(get('media:description')).trim().slice(0, 800),
          publishedAt: get('published').trim().slice(0, 10),
          speaker: decodeXmlEntities(
            (block.match(/<author>\s*<name>([\s\S]*?)<\/name>/) || [])[1] || ''
          ).trim(),
        } as ParsedVideo;
      })
      .filter((v): v is ParsedVideo => Boolean(v));

    if (xmlEntries.length === 0) {
      return send(res, 404, {
        error: 'PLAYLIST_EMPTY',
        message: 'لم يتم العثور على فيديوهات متاحة داخل هذه القائمة.',
      });
    }

    // Attempt to fetch exact playlist order & durations from watch panel HTML
    let finalVideos = xmlEntries;
    let finalTitle = playlistTitleFromFeed || 'سلسلة دروس علمية';
    let finalSpeaker = xmlEntries[0]?.speaker || playlistAuthorFromFeed || 'محاضر';

    try {
      const watchUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(xmlEntries[0].videoId)}&list=${encodeURIComponent(playlistId)}`;
      const watchRes = await fetch(watchUrl, {
        signal: controller.signal,
        redirect: 'error',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'ar,en;q=0.9',
        },
      });
      if (watchRes.ok) {
        const html = await watchRes.text();
        const initMatch = html.match(/var ytInitialData = (\{.*?\});<\/script>/);
        if (initMatch) {
          const parsed = extractVideosFromYtInitialData(JSON.parse(initMatch[1]));
          if (parsed.videos.length > 0) {
            const feedById = new Map(xmlEntries.map((v) => [v.videoId, v]));
            finalVideos = parsed.videos.map((v) => {
              const feedItem = feedById.get(v.videoId);
              return {
                ...v,
                description: feedItem?.description || v.description,
                publishedAt: feedItem?.publishedAt || v.publishedAt,
              };
            });
            if (parsed.title) finalTitle = parsed.title;
            if (parsed.speaker) finalSpeaker = parsed.speaker;
          }
        }
      }
    } catch {
      // Fallback cleanly to Atom feed entries
    }

    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
    return send(res, 200, {
      playlistId,
      playlistUrl: `https://www.youtube.com/playlist?list=${playlistId}`,
      title: finalTitle.slice(0, 160),
      speaker: finalSpeaker.slice(0, 100),
      videos: finalVideos.slice(0, 100),
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return send(res, 504, {
        error: 'UPSTREAM_TIMEOUT',
        message: 'انتهت مهلة الاتصال بخدمة يوتيوب. حاول مرة أخرى.',
      });
    }
    return send(res, 502, {
      error: 'PLAYLIST_FETCH_FAILED',
      message: 'تعذر جلب بيانات قائمة التشغيل حالياً.',
    });
  } finally {
    clearTimeout(timer);
  }
}
