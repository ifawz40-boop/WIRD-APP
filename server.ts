import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import tafsirHandler from './api/tafsir';
import ruqyahHandler from './api/ruqyah';
import quranAudioHandler from './api/quran-audio';
import hadithReferencesHandler from './api/hadith-references';
import youtubePlaylistHandler from './api/youtube-playlist';
import seerahTtsHandler from './api/seerah-tts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '1mb' }));

// Keep the same read-only tafsir endpoint available in Google AI Studio/Vite
// development and in the production Express server. Register before Vite's SPA fallback.
app.all('/api/tafsir', (req: Request, res: Response) => {
  void tafsirHandler(req, res);
});

// Quran Foundation verse-to-hadith references. Credentials remain server-side.
app.all('/api/hadith-references', (req: Request, res: Response) => {
  void hadithReferencesHandler(req, res);
});

// Secure Arabic Ruqyah data proxy; the upstream API key remains server-side.
app.all('/api/ruqyah', (req: Request, res: Response) => {
  void ruqyahHandler(req, res);
});

// Read-only catalog proxy for Al Furqan's verified Quran reciter directory.
app.all('/api/quran-audio', (req: Request, res: Response) => {
  void quranAudioHandler(req, res);
});

// Read-only YouTube playlist metadata proxy for extensible learning series.
app.all('/api/youtube-playlist', (req: Request, res: Response) => {
  void youtubePlaylistHandler(req, res);
});

// Expressive classical Arabic TTS proxy for Seerah book chapters & biographies.
app.all('/api/seerah-tts', (req: Request, res: Response) => {
  void seerahTtsHandler(req, res);
});

// In-memory rate limiter for Gemini Free Tier (15 requests/minute)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const MAX_RATE_LIMIT_BUCKETS = 1000;
const ALLOWED_ADVISOR_KEYS = new Set(['contextType', 'userData', 'query', 'message', 'history']);
const rateLimitMap = new Map<string, RateLimitRecord>();

function getClientIp(req: Request): string {
  const realIp = req.headers?.['x-real-ip'];
  const candidate = Array.isArray(realIp) ? realIp[0] : realIp;
  if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  if (typeof req.ip === 'string' && req.ip.trim()) return req.ip.trim();
  const remoteAddress = req.socket?.remoteAddress;
  return typeof remoteAddress === 'string' && remoteAddress.trim() ? remoteAddress.trim() : 'global';
}

function validateAdvisorBody(rawBody: unknown): { ok: true; body: Record<string, unknown> } | { ok: false; code: string; message: string } {
  const candidate = rawBody ?? {};
  if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'الطلب يجب أن يكون كائن JSON صالحاً.' };
  }
  const body = candidate as Record<string, unknown>;
  let bodyStr = '';
  try {
    bodyStr = JSON.stringify(body);
  } catch {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'تعذر قراءة بيانات الطلب.' };
  }
  if (Buffer.byteLength(bodyStr, 'utf8') > 4096) {
    return { ok: false, code: 'PAYLOAD_TOO_LARGE', message: 'حجم الطلب يتجاوز الحد المسموح به (الحد الأقصى 4 كيلوبايت).' };
  }
  if (Object.keys(body).some(key => !ALLOWED_ADVISOR_KEYS.has(key))) {
    return { ok: false, code: 'INVALID_PAYLOAD', message: 'الطلب يتضمن حقولاً غير مسموح بها.' };
  }
  const promptText = String(body.message || body.query || '').trim();
  if (promptText.length > 500) {
    return { ok: false, code: 'INPUT_TOO_LONG', message: 'النص المدخل طويل جداً (الحد الأقصى 500 حرف).' };
  }
  return { ok: true, body };
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 1000) {
    for (const [key, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) rateLimitMap.delete(key);
    }
    while (rateLimitMap.size > MAX_RATE_LIMIT_BUCKETS) {
      const oldestKey = rateLimitMap.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      rateLimitMap.delete(oldestKey);
    }
  }
  const record = rateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (record.count >= 15) {
    return false;
  }
  record.count += 1;
  return true;
}

// Initialize Gemini client strictly using server-side secret and Free Tier model
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
}

// Strict Quranic Safety System Instruction
const PRIMARY_ADVISOR_MODEL = 'gemini-4-hydrogen';
const FALLBACK_ADVISOR_MODEL = 'gemini-3.5-flash-lite';

const SYSTEM_INSTRUCTION = `أنت «المستشار القرآني» في تطبيق «وِرد | WIRD» لحفظ ومراجعة القرآن الكريم.
مهمتك: تحليل وتيرة الحفظ والمراجعة وفهم أسئلة المستخدم بعمق (بالفصحى أو العامية) وتقديم خطوات عملية رصينة وموثوقة وفق منهجيات أئمة الإقراء والتكرار المتباعد.

القواعد القرآنية والأمنية الإلزامية:
1. لا تقم أبداً بتأليف أو اختلاق أو اقتباس نص آية قرآنية أو حديث نبوي من ذاكرتك؛ اكتفِ بذكر اسم السورة ورقم الآية عند الحاجة.
2. لا تعدل على أي نص قرآني ولا تصدر فتاوى فقهية أو تفسيراً بالرأي؛ وجّه بأدب لقسم التفسير الموثق في التطبيق وأهل العلم.
3. لا تدعِ التحقق الصوتي من التجويد أو مخارج الحروف.
4. استند في نصائحك إلى المؤشرات الفعلية للمستخدم وسياق حفظه دون اختلاق أرقام.
5. تحدث بلغة عربية فصيحة رصينة وواضحة وخالية من الإيموجيز والحشو الروبوتي، وقسّم الرد إلى تشخيص موجز متبوع بخطوات عملية محددة.`;

async function runExpressGeminiGenerate(ai: GoogleGenAI, contents: string): Promise<string> {
  try {
    const res = await ai.models.generateContent({
      model: PRIMARY_ADVISOR_MODEL,
      contents,
      config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.35 }
    });
    if (res.text) return res.text;
  } catch (err: any) {
    const status = err?.status;
    const msg = String(err?.message || '');
    if (status === 429 || msg.includes('RESOURCE_EXHAUSTED') || status === 403 || msg.includes('API_KEY')) {
      throw err;
    }
  }
  const fallback = await ai.models.generateContent({
    model: FALLBACK_ADVISOR_MODEL,
    contents,
    config: { systemInstruction: SYSTEM_INSTRUCTION, temperature: 0.35 }
  });
  return fallback.text || '';
}

// 1. Health and AI Availability Endpoint
app.get('/api/advisor/status', (_req: Request, res: Response) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const apiKey = process.env.GEMINI_API_KEY;
  const isKeyConfigured = Boolean(apiKey && apiKey !== 'MY_GEMINI_API_KEY');

  res.json({
    available: isKeyConfigured,
    model: PRIMARY_ADVISOR_MODEL,
    tier: 'free',
    message: isKeyConfigured
      ? 'خدمة الذكاء الاصطناعي متاحة (Gemini 4 Hydrogen)'
      : 'يعمل النظام في وضع التوصيات الحتمية المحلي (بدون استهلاك رصيد)'
  });
});

// 2. Analyze User Progress & Workload
app.post('/api/advisor/analyze', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'تم تجاوز الحد الأقصى للطلبات المجانية (15 طلب/دقيقة). يرجى الانتظار قليلاً أو الاعتماد على المحلل الذاتي المدمج.'
    });
    return;
  }

  const validation = validateAdvisorBody(req.body);
  if (validation.ok === false) {
    res.status(400).json({ success: false, code: validation.code, message: validation.message });
    return;
  }
  const { contextType, userData, query } = validation.body as {
    contextType?: unknown;
    userData?: Record<string, unknown>;
    query?: unknown;
  };

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      success: false,
      code: 'KEY_MISSING',
      message: 'مفتاح الذكاء الاصطناعي غير متوفر في البيئة الحالية. يتم تشغيل المحلل الحتمي الداخلي.'
    });
    return;
  }

  // Construct structured prompt grounded strictly in anonymous learning metrics
  let userContextSummary = '';
  if (userData && typeof userData === 'object') {
    const memorizedCount = Number(userData.memorizedAyahsCount) || 0;
    const weakCount = Number(userData.weakVersesCount) || 0;
    const retentionScore = Number(userData.retentionScore) || 0;
    const dueCount = Number(userData.dueRevisionsCount) || 0;
    const safeGoal = typeof userData.goal === 'string' ? userData.goal.slice(0, 80) : 'حفظ وإتقان القرآن';
    const safePlan = typeof userData.activePlanTitle === 'string' ? userData.activePlanTitle.slice(0, 50) : 'خطة الحفظ الحالية';

    userContextSummary = `
[المؤشرات الرقمية لتقدم الحافظ]:
- الهدف القرآني: ${safeGoal}
- الخطة الحالية: ${safePlan}
- عدد الآيات المنجزة: ${memorizedCount} آية
- الآيات المتعثرة الملتبسة: ${weakCount} آيات
- مؤشر جودة الرسوخ: %${retentionScore}
- المقاطع المستحقة للمراجعة اليوم: ${dueCount} مقطع
`;
  }

  const cleanQuery = typeof query === 'string' ? query.slice(0, 500) : '';
  const userPrompt = `
نوع التحليل المطلوب: ${contextType ? String(contextType).slice(0, 30) : 'تحليل عام'}
${userContextSummary}
طلب أو استشارة الحافظ: ${cleanQuery || 'حلل أدائي القرآني وقدم لي أهم 3 نصائح عملية ومحددة لتعزيز رسوخ الحفظ وتنظيم المراجعة.'}
`;

  try {
    const replyText = (await runExpressGeminiGenerate(ai, userPrompt)) || 'لم يتم استلام رد، استعن بنصائح التكرار المتباعد المدمجة.';
    res.json({
      success: true,
      model: PRIMARY_ADVISOR_MODEL,
      text: replyText
    });
  } catch (error: any) {
    console.error('Gemini API call failed:', error?.message || error);
    const isQuota = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isKeyIssue = error?.status === 403 || error?.status === 400 || error?.message?.includes('API_KEY');
    
    res.json({
      success: false,
      code: isQuota ? 'QUOTA_EXHAUSTED' : isKeyIssue ? 'KEY_INVALID' : 'API_ERROR',
      message: isQuota 
        ? 'تم استنفاذ الحصة المجانية الحالية لمزود الذكاء الاصطناعي. يعمل المستشار الآن في النمط الذاتي الحتمي المدمج.' 
        : 'تعذر الاتصال بمزود الذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي المدمج.'
    });
  }
});

// 3. Interactive Chat Endpoint
app.post('/api/advisor/chat', async (req: Request, res: Response): Promise<void> => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const clientIp = getClientIp(req);
  if (!checkRateLimit(clientIp)) {
    res.status(429).json({
      success: false,
      code: 'RATE_LIMITED',
      message: 'يرجى التمهل قليلاً بين الرسائل لتجنب تجاوز حد الطلبات المجانية.'
    });
    return;
  }

  const validation = validateAdvisorBody(req.body);
  if (validation.ok === false) {
    res.status(400).json({ success: false, code: validation.code, message: validation.message });
    return;
  }
  const { message, history, userData } = validation.body as {
    message?: unknown;
    history?: unknown;
    userData?: Record<string, unknown>;
  };
  if (!message || typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ success: false, code: 'INVALID_PAYLOAD', message: 'الرسالة مطلوبة' });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.json({
      success: false,
      code: 'KEY_MISSING',
      message: 'الخدمة تعمل في وضع المحلل الحتمي.'
    });
    return;
  }

  let metricsBlock = '';
  if (userData && typeof userData === 'object' && !Array.isArray(userData)) {
    const memorizedCount = Number(userData.memorizedAyahsCount) || 0;
    const weakCount = Number(userData.weakVersesCount) || 0;
    const retentionScore = Number(userData.retentionScore) || 0;
    const dueCount = Number(userData.dueRevisionsCount) || 0;
    metricsBlock = `\n[مؤشرات الحافظ]: المحفوظ ${memorizedCount} آية · المتعثر ${weakCount} · الرسوخ %${retentionScore} · مستحق اليوم ${dueCount}\n`;
  }

  let historyContext = '';
  if (Array.isArray(history) && history.length > 0) {
    const recentTurns = history
      .slice(-6)
      .filter((item): item is { sender?: unknown; role?: unknown; text?: unknown } => Boolean(item && typeof item === 'object'))
      .map(item => {
        const roleLabel = item.sender === 'advisor' || item.role === 'model' ? 'المستشار' : 'السائل';
        const text = typeof item.text === 'string' ? item.text.trim().slice(0, 240) : '';
        return text ? `${roleLabel}: ${text}` : '';
      })
      .filter(Boolean);
    if (recentTurns.length > 0) {
      historyContext = `\n[سياق الحوار السابق]:\n${recentTurns.join('\n')}\n`;
    }
  }

  try {
    const replyText = await runExpressGeminiGenerate(
      ai,
      `${metricsBlock}${historyContext}\nسؤال المستخدم: ${message.trim()}`
    );

    res.json({
      success: true,
      model: PRIMARY_ADVISOR_MODEL,
      text: replyText
    });
  } catch (error: any) {
    console.error('Gemini chat error:', error?.message || error);
    const isQuota = error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED');
    const isKeyIssue = error?.status === 403 || error?.status === 400 || error?.message?.includes('API_KEY');
    
    res.json({
      success: false,
      code: isQuota ? 'QUOTA_EXHAUSTED' : isKeyIssue ? 'KEY_INVALID' : 'API_ERROR',
      message: isQuota
        ? 'الحصة المجانية مستنفذة مؤقتاً، يعمل المستشار في النمط الذاتي الحتمي المدمج.'
        : 'تعذر الاتصال بالذكاء الاصطناعي، تم التحويل تلقائياً للمحرك الحتمي.'
    });
  }
});

// Setup Vite in Dev or Serve Static in Production
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✨ WIRD Platform server running on http://0.0.0.0:${PORT}`);
  });
}

setupServer().catch(err => {
  console.error('Failed to start server:', err);
});
