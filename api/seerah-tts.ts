const ALLOWED_VOICES = new Set(['Charon', 'Kore', 'Puck', 'Orus']);
const PRIMARY_TTS_MODEL = 'gemini-3.8-flash-tts';
const FALLBACK_TTS_MODEL = 'gemini-3.8-flash-lite-tts';

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 24;
const MAX_BUCKETS = 1000;
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function sendJson(res: any, statusCode: number, payload: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.status(statusCode).json(payload);
}

function getClientIp(req: any): string {
  const realIp = req?.headers?.['x-real-ip'];
  const realCandidate = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof realCandidate === 'string' && realCandidate.trim()) return realCandidate.trim();
  if (typeof req?.ip === 'string' && req.ip.trim()) return req.ip.trim();
  const remote = req?.socket?.remoteAddress;
  return typeof remote === 'string' && remote.trim() ? remote.trim() : 'local';
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateBuckets.size > MAX_BUCKETS) {
    for (const [k, v] of rateBuckets.entries()) {
      if (now >= v.resetAt) rateBuckets.delete(k);
    }
  }
  const existing = rateBuckets.get(ip);
  if (!existing || now >= existing.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (existing.count >= RATE_LIMIT_MAX) return false;
  existing.count += 1;
  return true;
}

function expandHonorificsForTts(input: string): string {
  return input
    .replace(/ﷺ/g, ' صلى الله عليه وسلم ')
    .replace(/ﷻ/g, ' جل جلاله ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBase64AudioFromInteraction(data: unknown): { base64: string; mimeType: string } | null {
  if (!data || typeof data !== 'object') return null;
  const obj = data as Record<string, unknown>;
  if (obj.output_audio && typeof obj.output_audio === 'object') {
    const out = obj.output_audio as Record<string, unknown>;
    if (typeof out.data === 'string' && out.data.length > 32) {
      return {
        base64: out.data,
        mimeType: typeof out.mime_type === 'string' ? out.mime_type : 'audio/wav',
      };
    }
  }
  if (Array.isArray(obj.steps)) {
    for (let i = obj.steps.length - 1; i >= 0; i--) {
      const step = obj.steps[i];
      if (!step || typeof step !== 'object') continue;
      const stepRec = step as Record<string, unknown>;
      if (stepRec.type !== 'model_output' || !Array.isArray(stepRec.content)) continue;
      for (let j = stepRec.content.length - 1; j >= 0; j--) {
        const part = stepRec.content[j];
        if (part && typeof part === 'object') {
          const p = part as Record<string, unknown>;
          if (p.type === 'audio' && typeof p.data === 'string' && p.data.length > 32) {
            return {
              base64: p.data,
              mimeType: typeof p.mime_type === 'string' ? p.mime_type : 'audio/wav',
            };
          }
        }
      }
    }
  }
  return null;
}

async function synthesizeWithGeminiModel(
  apiKey: string,
  model: string,
  text: string,
  voice: string
): Promise<{ ok: true; audioBuffer: Buffer; mimeType: string } | { ok: false; status: number; message: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: {
        'x-goog-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        store: false,
        input: [
          {
            type: 'user_input',
            content: [
              {
                type: 'text',
                text,
                annotations: [
                  {
                    type: 'speech_metadata',
                    style:
                      'reverent, warm, articulate classical Arabic historical audiobook narration with clear diacritics and calm measured pauses',
                  },
                ],
              },
            ],
          },
        ],
        response_format: {
          type: 'audio',
        },
        generation_config: {
          speech_config: [{ voice }],
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        message: `Upstream TTS returned HTTP ${response.status}`,
      };
    }

    const json = (await response.json()) as unknown;
    const extracted = extractBase64AudioFromInteraction(json);
    if (!extracted) {
      return { ok: false, status: 502, message: 'No audio payload returned by TTS model' };
    }
    return {
      ok: true,
      audioBuffer: Buffer.from(extracted.base64, 'base64'),
      mimeType: extracted.mimeType,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 504,
      message: err?.name === 'AbortError' ? 'TTS synthesis timed out' : 'TTS network error',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function seerahTtsHandler(req: any, res: any) {
  const method = String(req?.method || 'GET').toUpperCase();
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  if (method === 'GET') {
    const statusQuery = req?.query?.status;
    if (statusQuery === '1' || statusQuery === 'true') {
      return sendJson(res, 200, {
        available: isKeyConfigured,
        model: PRIMARY_TTS_MODEL,
        fallbackModel: FALLBACK_TTS_MODEL,
        voices: ['Charon', 'Kore'],
      });
    }
    return sendJson(res, 400, {
      error: 'INVALID_REQUEST',
      message: 'يرجى إرسال نص السرد عبر طلب POST صالح أو الاستعلام عن الحالة عبر status=1.',
    });
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'METHOD_NOT_ALLOWED', message: 'الطريقة غير مدعومة.' });
  }

  const ip = getClientIp(req);
  if (!checkRateLimit(ip)) {
    return sendJson(res, 429, {
      error: 'RATE_LIMITED',
      message: 'تم الوصول للحد المؤقت لتوليد الصوت السحابي؛ سيكمل القارئ بالصوت المحلي تلقائياً.',
    });
  }

  const rawBody = req?.body;
  if (!rawBody || typeof rawBody !== 'object' || Array.isArray(rawBody)) {
    return sendJson(res, 400, { error: 'INVALID_PAYLOAD', message: 'بيانات طلب القراءة الصوتية غير صالحة.' });
  }

  const rawText = typeof rawBody.text === 'string' ? rawBody.text.trim() : '';
  if (!rawText || rawText.length < 2 || rawText.length > 1400) {
    return sendJson(res, 400, {
      error: 'INVALID_TEXT_LENGTH',
      message: 'طول الفقرة النصية يجب أن يكون بين حرفين و1400 حرف.',
    });
  }

  const requestedVoice = typeof rawBody.voice === 'string' ? rawBody.voice.trim() : 'Charon';
  const voice = ALLOWED_VOICES.has(requestedVoice) ? requestedVoice : 'Charon';

  if (!isKeyConfigured || !apiKey) {
    return sendJson(res, 503, {
      available: false,
      code: 'TTS_KEY_MISSING',
      message: 'مفتاح الصوت السحابي غير مهيأ؛ يتم التشغيل عبر القارئ العربي المحلي.',
    });
  }

  const spokenText = expandHonorificsForTts(rawText);
  let result = await synthesizeWithGeminiModel(apiKey, PRIMARY_TTS_MODEL, spokenText, voice);
  if (!result.ok && (result.status === 429 || result.status >= 500 || result.status === 404)) {
    result = await synthesizeWithGeminiModel(apiKey, FALLBACK_TTS_MODEL, spokenText, voice);
  }

  if (!result.ok) {
    return sendJson(res, result.status >= 400 && result.status < 600 ? result.status : 502, {
      available: false,
      code: 'TTS_UPSTREAM_FAILED',
      message: result.message,
    });
  }

  res.setHeader('Content-Type', result.mimeType);
  res.setHeader('Content-Length', String(result.audioBuffer.byteLength));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (typeof res.send === 'function') {
    return res.status(200).send(result.audioBuffer);
  }
  res.status(200);
  res.end(result.audioBuffer);
  return res;
}
