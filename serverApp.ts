import express, { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const ROOT_DIR = process.cwd();
const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_TRIALS = 10;
const ADMIN_PIN = process.env.ADMIN_PIN || '2026';

const DATA_DIR = IS_VERCEL
  ? path.join('/tmp', 'fahem-blan-data')
  : path.resolve(ROOT_DIR, 'data');
const CODES_FILE = path.join(DATA_DIR, 'codes.json');

export interface ServerCodeRecord {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
  trials: number;
  createdAtMs: number;
  updatedAtMs: number;
}

const DEFAULT_CODES: ServerCodeRecord[] = [
  {
    id: 'default_vip',
    name: 'كود الافتتاح VIP',
    code: 'FAHEM2026',
    isActive: true,
    trials: 0,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
  },
];

function ensureCodesFile(): ServerCodeRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(CODES_FILE)) {
      fs.writeFileSync(CODES_FILE, JSON.stringify(DEFAULT_CODES, null, 2), 'utf8');
      return [...DEFAULT_CODES];
    }
    const raw = fs.readFileSync(CODES_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn('Could not read codes file, using default in-memory store:', err);
  }
  return [...DEFAULT_CODES];
}

let codesStore: ServerCodeRecord[] = ensureCodesFile();

function persistCodes() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CODES_FILE, JSON.stringify(codesStore, null, 2), 'utf8');
  } catch (err) {
    console.warn('Failed to persist codes:', err);
  }
}

function getAiClient(apiVersion?: string): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseCleanJson<T>(rawText: string | undefined): T {
  const cleaned = (rawText || '{}')
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned || '{}') as T;
  } catch {
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first !== -1 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1)) as T;
    }
    throw new Error('تعذر قراءة نتيجة التحليل، عاود حاول.');
  }
}

function formatGeminiError(err: unknown, fallback: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('high demand')) {
    return {
      status: 503,
      message: 'السيرفر ديال الذكاء الاصطناعي عليه ضغط مؤقت دابا، تسنا ثواني وعاود جرب.',
    };
  }
  if (raw.includes('429') || raw.toLowerCase().includes('quota') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message: 'وصلنا للحد المؤقت ديال الطلبات، عاود حاول من بعد شوية.',
    };
  }
  return { status: 500, message: raw || fallback };
}

const TTS_CACHE_DIR = path.join(DATA_DIR, 'tts-cache');
const ttsMemCache = new Map<string, string>();
const ttsCooldownUntil: Record<string, number> = {};

function ttsCacheKey(voiceName: string, text: string): string {
  return createHash('sha256').update(`${voiceName}::${text}`).digest('hex');
}

function getServerTtsCache(key: string): string | null {
  const mem = ttsMemCache.get(key);
  if (mem) return mem;
  try {
    const fp = path.join(TTS_CACHE_DIR, `${key}.b64`);
    if (fs.existsSync(fp)) {
      const b64 = fs.readFileSync(fp, 'utf8');
      if (b64) {
        if (ttsMemCache.size >= 80) {
          const oldest = ttsMemCache.keys().next().value;
          if (oldest) ttsMemCache.delete(oldest);
        }
        ttsMemCache.set(key, b64);
        return b64;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

function saveServerTtsCache(key: string, b64: string) {
  if (!b64) return;
  if (ttsMemCache.size >= 80) {
    const oldest = ttsMemCache.keys().next().value;
    if (oldest) ttsMemCache.delete(oldest);
  }
  ttsMemCache.set(key, b64);
  try {
    if (!fs.existsSync(TTS_CACHE_DIR)) {
      fs.mkdirSync(TTS_CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(path.join(TTS_CACHE_DIR, `${key}.b64`), b64, 'utf8');
  } catch {
    // ignore
  }
}

async function withGeminiRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isDailyQuota = msg.includes('PerDay') || msg.includes('GenerateRequestsPerDay');
      const is429Burst = !isDailyQuota && (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED'));
      const isTransient =
        is429Burst ||
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('high demand') ||
        msg.includes('500') ||
        msg.includes('INTERNAL');
      if (!isTransient || attempt === maxRetries) {
        throw err;
      }
      const delayMs = is429Burst ? 1100 : 700 * Math.pow(2, attempt);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastErr;
}

const modelCooldownUntil: Record<string, number> = {};

async function generateWithModelFallback(
  ai: GoogleGenAI,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
    timeoutMs?: number;
  }
) {
  const models = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.8-flash',
    'gemini-4-hydrogen',
  ];
  const now = Date.now();
  const activeModels = models.filter((m) => (modelCooldownUntil[m] || 0) <= now);
  const candidates = activeModels.length > 0 ? activeModels : [...models];

  let lastErr: unknown;
  let lastTransient503Err: unknown;
  for (let pass = 0; pass < 2; pass++) {
    for (const model of candidates) {
      if (pass === 1 && model === 'gemini-4-hydrogen') continue;
      if ((modelCooldownUntil[model] || 0) > Date.now()) continue;
      try {
        const baseConfig = { ...(params.config || {}) };
        if (model === 'gemini-3.1-flash-lite' && baseConfig.thinkingConfig) {
          baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
        } else if (model === 'gemini-4-hydrogen' && baseConfig.thinkingConfig) {
          baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.LOW };
        }
        return await ai.models.generateContent({
          model,
          contents: params.contents as never,
          config: {
            ...baseConfig,
            abortSignal: AbortSignal.timeout(params.timeoutMs ?? 25000),
          } as never,
        });
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        const name = err instanceof Error ? err.name : '';
        const is503 = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
        if (is503) lastTransient503Err = err;
        const shouldFallback =
          name === 'TimeoutError' ||
          name === 'AbortError' ||
          is503 ||
          msg.includes('aborted') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.toLowerCase().includes('quota') ||
          msg.includes('404') ||
          msg.includes('NOT_FOUND') ||
          msg.includes('500') ||
          msg.includes('INTERNAL');
        if (!shouldFallback) {
          throw err;
        }
        if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('PerDay')) {
          modelCooldownUntil[model] = Date.now() + 120_000;
        }
      }
    }
    if (pass === 0) {
      await new Promise((resolve) => setTimeout(resolve, 750));
    }
  }
  throw lastTransient503Err || lastErr;
}

function resolveImagePart(
  imageBase64OrUrl: string,
  fallbackMime = 'image/jpeg'
): { mimeType: string; data: string } | null {
  if (!imageBase64OrUrl) return null;

  // Case 1: Data URL
  if (imageBase64OrUrl.startsWith('data:')) {
    const b64Idx = imageBase64OrUrl.indexOf(';base64,');
    if (b64Idx !== -1) {
      const mimeMatch = imageBase64OrUrl.slice(5, b64Idx).split(';')[0]?.trim();
      const rawData = imageBase64OrUrl.slice(b64Idx + 8).replace(/\s+/g, '').trim();
      if (rawData) {
        return {
          mimeType: mimeMatch || fallbackMime,
          data: rawData,
        };
      }
    }
  }

  // Case 2: Local sample asset path like /src/assets/images/...
  if (imageBase64OrUrl.startsWith('/src/assets/') || imageBase64OrUrl.startsWith('/assets/')) {
    const relPath = imageBase64OrUrl.replace(/^\/+/, '');
    const candidates = [
      path.resolve(ROOT_DIR, relPath),
      path.resolve(ROOT_DIR, 'dist', relPath),
      path.resolve(ROOT_DIR, 'public', relPath),
    ];
    for (const filePath of candidates) {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType =
          ext === '.png'
            ? 'image/png'
            : ext === '.webp'
              ? 'image/webp'
              : 'image/jpeg';
        return {
          mimeType,
          data: buf.toString('base64'),
        };
      }
    }
  }

  // Case 3: Raw base64 string
  if (!imageBase64OrUrl.startsWith('http')) {
    const clean = imageBase64OrUrl.replace(/\s+/g, '').trim();
    if (clean) {
      return {
        mimeType: fallbackMime,
        data: clean,
      };
    }
  }

  return null;
}

function sanitizeTranscriptText(raw: string): string {
  return (raw || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[\u0900-\u097F\u4E00-\u9FFF]/g, ' ')
    .replace(/^["'«»]+|["'«»]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isAdminAuthorized(req: Request): boolean {
  const pin = String(req.headers['x-admin-pin'] || '');
  return pin === ADMIN_PIN;
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '25mb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY?.trim()),
      runtime: IS_VERCEL ? 'vercel' : 'node',
    });
  });

  // --- Subscriber Codes API ---
  app.post('/api/codes/verify', (req: Request, res: Response) => {
    const rawCode = String(req.body?.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ valid: false, message: 'دخل رمز الدخول ديالك أولا.' });
    }
    const found = codesStore.find((c) => c.code.toUpperCase() === rawCode);
    if (!found) {
      return res.status(404).json({ valid: false, message: 'هاد الكود غير صحيح أو ما كاينش.' });
    }
    if (!found.isActive) {
      return res.status(403).json({
        valid: false,
        reason: 'inactive',
        trials: found.trials,
        message: 'هاد الكود موقوف مؤقتاً من الإدارة.',
      });
    }
    if (found.trials >= MAX_TRIALS) {
      return res.status(403).json({
        valid: false,
        reason: 'limit_reached',
        trials: found.trials,
        message: 'ساليو تجارب هاد الكود (10/10).',
      });
    }
    return res.json({
      valid: true,
      id: found.id,
      name: found.name,
      code: found.code,
      trials: found.trials,
      updatedAtMs: found.updatedAtMs,
    });
  });

  app.post('/api/codes/consume', (req: Request, res: Response) => {
    const rawCode = String(req.body?.code || '').trim().toUpperCase();
    if (!rawCode) {
      return res.status(400).json({ ok: false, message: 'الكود مطلوب' });
    }
    const idx = codesStore.findIndex((c) => c.code.toUpperCase() === rawCode);
    if (idx === -1) {
      return res.status(404).json({ ok: false, message: 'الكود غير موجود' });
    }
    const record = codesStore[idx];
    if (!record.isActive) {
      return res.status(403).json({ ok: false, reason: 'inactive', trials: record.trials });
    }
    if (record.trials >= MAX_TRIALS) {
      return res.status(403).json({ ok: false, reason: 'limit_reached', trials: record.trials });
    }
    record.trials += 1;
    record.updatedAtMs = Date.now();
    persistCodes();
    return res.json({ ok: true, trials: record.trials, remaining: Math.max(0, MAX_TRIALS - record.trials) });
  });

  app.post('/api/admin/verify-pin', (req: Request, res: Response) => {
    const pin = String(req.body?.pin || '').trim();
    if (pin !== ADMIN_PIN) {
      return res.status(401).json({ ok: false, message: 'الكود السري غلط! دخل الكود الصحيح ديال الإدارة.' });
    }
    return res.json({ ok: true });
  });

  app.get('/api/codes', (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    return res.json({ codes: codesStore });
  });

  app.post('/api/codes', (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const name = String(req.body?.name || '').trim() || 'مشترك';
    const code = String(req.body?.code || '').trim().toUpperCase();
    if (!code) {
      return res.status(400).json({ error: 'المرجو إدخال الكود' });
    }
    if (codesStore.some((c) => c.code.toUpperCase() === code)) {
      return res.status(409).json({ error: 'هاد الكود ديجا موجود' });
    }
    const newRec: ServerCodeRecord = {
      id: `code_${Date.now()}`,
      name,
      code,
      isActive: true,
      trials: 0,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    codesStore = [newRec, ...codesStore];
    persistCodes();
    return res.json({ ok: true, code: newRec });
  });

  app.patch('/api/codes/:id', (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const { id } = req.params;
    const idx = codesStore.findIndex((c) => c.id === id);
    if (idx === -1) {
      return res.status(404).json({ error: 'الكود غير موجود' });
    }
    if (typeof req.body?.isActive === 'boolean') {
      codesStore[idx].isActive = req.body.isActive;
    }
    if (typeof req.body?.trials === 'number') {
      codesStore[idx].trials = Math.max(0, Math.round(req.body.trials));
    }
    codesStore[idx].updatedAtMs = Date.now();
    persistCodes();
    return res.json({ ok: true, code: codesStore[idx] });
  });

  app.delete('/api/codes/:id', (req: Request, res: Response) => {
    if (!isAdminAuthorized(req)) {
      return res.status(401).json({ error: 'غير مصرح' });
    }
    const { id } = req.params;
    codesStore = codesStore.filter((c) => c.id !== id);
    persistCodes();
    return res.json({ ok: true });
  });

  // --- Gemini Vision: Blueprint Analysis ---
  app.post('/api/analyze-plan', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({
        success: false,
        error: 'مفتاح Gemini AI غير مهيأ حالياً في الخادم (Settings > Secrets).',
      });
    }

    try {
      const { imageData, imageBase64, mimeType, userNotes, notes } = req.body as {
        imageData?: string;
        imageBase64?: string;
        mimeType?: string;
        userNotes?: string;
        notes?: string;
      };

      const rawImg = imageBase64 || imageData;
      const finalNotes = (notes ?? userNotes ?? '').trim();

      if (!rawImg) {
        return res.status(400).json({ success: false, error: 'المرجو اختيار أو تصوير صورة البلان أولا.' });
      }

      const imagePart = resolveImagePart(rawImg, mimeType || 'image/jpeg');
      if (!imagePart) {
        return res.status(400).json({ success: false, error: 'صيغة الصورة غير صالحة.' });
      }

      const prompt = `أنت "المعلم الذكي" — مهندس معماري ومقاول مغربي خبير فـ قراءة مخططات البناء (بلان ديال الدار، الفيلات، السواري، الضالة، الحديد، الكهرباء والترصيص).
قم بتحليل هذه الصورة بدقة وأجب بالدارجة المغربية الواضحة والمفهومة بالحروف العربية (بدون حروف فرنسية وسط الجمل إلا للمصطلحات الضرورية مثل R+1 أو CPJ45 أو 6/8/12).
${finalNotes ? `ملاحظة صاحب البلان: ${finalNotes}` : ''}

تأكد من:
1. إذا كانت الصورة ليست مخطط بناء أو ورقة تقنية (مثلا صورة عادية أو وجه أو طبيعة)، ضع isBlueprint = false واشرح بالدارجة بلطف أنها ليست بلان بناء.
2. إذا كانت بلان بناء أو حديد: استخرج كل الغرف والمساحات والأبعاد المكتوبة بدقة، وتفاصيل السواري والحديد إذا وجدت، وقدم تقديراً واقعياً لمواد البناء (السيما، الحديد، الرملة، الكياس، البريك)، ومراحل الخدمة بالترتيب، وتنبيهات مهمة للمعلم والزبون.
3. اكتب "audioScript" بصيغة طبيعية سلسة بالدارجة المغربية بحال يلا كتشرح بالصوت لصاحب الدار أو المعلم (باستعمال كلمات مغربية بحال: دابا، هاد البلان، السواري، الضالة، الحديد، خاصنا).`;

      const response = await generateWithModelFallback(ai, {
        contents: {
          parts: [
            { inlineData: imagePart },
            { text: prompt },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              isBlueprint: { type: Type.BOOLEAN },
              title: { type: Type.STRING },
              buildingType: { type: Type.STRING },
              totalAreaSqm: { type: Type.STRING },
              roomsCount: { type: Type.INTEGER },
              darijaSummary: { type: Type.STRING },
              audioScript: { type: Type.STRING },
              structuralNotes: { type: Type.STRING },
              rooms: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    dimensions: { type: Type.STRING },
                    areaSqm: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                },
              },
              materials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    quantity: { type: Type.STRING },
                    unit: { type: Type.STRING },
                    notes: { type: Type.STRING },
                  },
                },
              },
              phases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    stepNumber: { type: Type.INTEGER },
                    phaseName: { type: Type.STRING },
                    explanationDarija: { type: Type.STRING },
                  },
                },
              },
              warnings: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
            },
          },
        },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({ success: true, analysis: parsed });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'وقع خطأ أثناء تحليل البلان.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Gemini Vision + Chat: Smart Maâlem Follow-Up Q&A ---
  app.post('/api/chat-plan', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'مفتاح Gemini غير مهيأ.' });
    }
    try {
      const { question, message, imageData, imageBase64, mimeType, analysisContext, history } = req.body as {
        question?: string;
        message?: string;
        imageData?: string;
        imageBase64?: string;
        mimeType?: string;
        analysisContext?: unknown;
        history?: Array<{ role: string; text: string }>;
      };

      const finalQuestion = (question ?? message ?? '').trim();
      if (!finalQuestion) {
        return res.status(400).json({ success: false, error: 'السؤال فارغ.' });
      }

      const parts: Array<{ inlineData?: { mimeType: string; data: string }; text?: string }> = [];
      const rawImg = imageBase64 || imageData;
      if (rawImg) {
        const imagePart = resolveImagePart(rawImg, mimeType || 'image/jpeg');
        if (imagePart) parts.push({ inlineData: imagePart });
      }

      const historyText = Array.isArray(history)
        ? history
            .slice(-6)
            .map((h) => `${h.role === 'user' ? 'المستعمل' : 'المعلم الذكي'}: ${String(h.text || '').slice(0, 600)}`)
            .join('\n')
        : '';

      const promptText = `أنت "المعلم الذكي" فـ تطبيق فاهم بلان. كتجاوب على أسئلة البناي وصاحب الدار بالدارجة المغربية الواضحة والمختصرة والعملية بالحروف العربية فقط.
معلومات التحليل السابق للبلان:
${JSON.stringify(analysisContext || {}, null, 2)}

المحادثة السابقة:
${historyText}

سؤال المستعمل دابا: ${finalQuestion}

جاوب مباشرة بالدارجة المغربية بأسلوب معلم خبير واضح ومفيد (بدون مقدمات طويلة).`;

      parts.push({ text: promptText });

      let response;
      try {
        response = await generateWithModelFallback(ai, {
          contents: { parts },
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
      } catch (visionChatErr: unknown) {
        if (parts.length > 1 && analysisContext) {
          response = await generateWithModelFallback(ai, {
            contents: { parts: [{ text: promptText }] },
            config: {
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          });
        } else {
          throw visionChatErr;
        }
      }

      return res.json({ success: true, reply: response.text || 'ما قدرتش نقرا الجواب دابا، عاود سولني.' });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'تعذر الإجابة على السؤال.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Gemini Vision: AI Crack Detector ---
  app.post('/api/detect-cracks', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'مفتاح Gemini غير مهيأ.' });
    }
    try {
      const { imageData, imageBase64, mimeType } = req.body as {
        imageData?: string;
        imageBase64?: string;
        mimeType?: string;
      };
      const rawImg = imageBase64 || imageData;
      if (!rawImg) {
        return res.status(400).json({ success: false, error: 'المرجو رفع أو التقاط صورة الشق أولا.' });
      }
      const imagePart = resolveImagePart(rawImg, mimeType || 'image/jpeg');
      if (!imagePart) {
        return res.status(400).json({ success: false, error: 'تعذر قراءة الصورة.' });
      }

      const response = await generateWithModelFallback(ai, {
        contents: {
          parts: [
            { inlineData: imagePart },
            {
              text: `أنت مهندس مدني مغربي مختص فتشخيص تشققات المباني (الحيوط، السواري، الضالة، المرطوب).
عاين هذه الصورة وحدد واش الشق سطحي (مرطوب/صباغة)، متوسط، ولا إنشائي خطير كيحتاج تدخل مهندس، وشرح السبب وخطوات الإصلاح بالترتيب بالدارجة المغربية.`,
            },
          ],
        },
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              severity: { type: Type.STRING, description: 'surface, moderate, or structural' },
              severityLabelDarija: { type: Type.STRING },
              diagnosisDarija: { type: Type.STRING },
              causeDarija: { type: Type.STRING },
              repairSteps: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
              },
              audioScript: { type: Type.STRING },
            },
          },
        },
      });

      const parsed = parseCleanJson(response.text);
      return res.json({ success: true, diagnosis: parsed });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'وقع خطأ أثناء فحص الشق.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Gemini Audio Transcription (Verbatim Darija Arabic-Script Only) ---
  app.post('/api/transcribe', async (req: Request, res: Response) => {
    const ai = getAiClient();
    const aiBeta = getAiClient('v1beta');
    if (!ai) {
      return res.status(503).json({ success: false, error: 'مفتاح Gemini غير مهيأ.' });
    }
    try {
      const { audioBase64, mimeType } = req.body as { audioBase64?: string; mimeType?: string };
      if (!audioBase64) {
        return res.status(400).json({ success: false, error: 'لا يوجد تسجيل صوتي.' });
      }
      const b64Marker = ';base64,';
      const markerIdx = audioBase64.indexOf(b64Marker);
      const rawData =
        markerIdx !== -1
          ? audioBase64.slice(markerIdx + b64Marker.length)
          : audioBase64.replace(/^data:[^,]*,/i, '');
      const cleanBase64 = rawData.replace(/\s+/g, '').trim();
      if (!cleanBase64) {
        return res.status(400).json({ success: false, error: 'التسجيل الصوتي فارغ.' });
      }
      const headerMimeMatch = audioBase64.match(/^data:([^;,]+)/i);
      let cleanMime = ((mimeType || headerMimeMatch?.[1] || 'audio/webm').split(';')[0] || 'audio/webm')
        .trim()
        .toLowerCase();
      if (cleanMime === 'video/mp4' || cleanMime === 'audio/x-m4a' || cleanMime === 'audio/m4a') {
        cleanMime = 'audio/mp4';
      } else if (cleanMime === 'audio/x-wav') {
        cleanMime = 'audio/wav';
      }

      const transcribePrompt = `أنت أداة تفريغ صوتي حرفي (Verbatim Speech-to-Text) للهجة الدارجة المغربية والعربية.
القواعد الصارمة:
1. فرّغ الكلام المنطوق بالحرف تماماً كما سُمع باستعمال الحروف العربية فقط (مثال: اكتب "سلام" وليس "Slm"، اكتب "البلان" وليس "plan"، اكتب "واخا" وليس "wakha").
2. ممنوع تماماً كتابة أي حروف لاتينية أو هندية (ديفاناغاري) أو صينية أو ترجمة الكلام أو الإجابة على المتكلم.
3. حافظ على مصطلحات البناء المغربية بالحروف العربية (السواري، الضالة، السيما، الحديد، الكياس، الرملة، الفونداصيو، المتر، البار).
4. أعد النص المنطوق فقط بدون مقدمات أو علامات تنصيص. وإذا كان الصوت صمتاً أو ضجيجاً غير مفهوم أعد نصاً فارغاً.`;

      const audioParts = [
        {
          inlineData: {
            mimeType: cleanMime,
            data: cleanBase64,
          },
        },
        {
          text: transcribePrompt,
        },
      ];

      let rawText = '';
      try {
        const response = await generateWithModelFallback(ai, {
          contents: { parts: audioParts },
          timeoutMs: 12000,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        rawText = response.text || '';
      } catch (primaryErr: unknown) {
        if (!aiBeta) throw primaryErr;
        const betaResp = await withGeminiRetry(() =>
          aiBeta.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: { parts: audioParts },
            config: {
              abortSignal: AbortSignal.timeout(15000),
            } as never,
          })
        );
        rawText = betaResp.text || '';
      }

      // If model accidentally leaked Devanagari/foreign script, try dedicated transcribe model once
      if (/[\u0900-\u097F]/.test(rawText) && aiBeta) {
        try {
          const betaResp = await aiBeta.models.generateContent({
            model: 'gemini-3.5-transcribe',
            contents: { parts: audioParts },
            config: {
              abortSignal: AbortSignal.timeout(12000),
            } as never,
          });
          if (betaResp.text && !/[\u0900-\u097F]/.test(betaResp.text)) {
            rawText = betaResp.text;
          }
        } catch {
          // fall through to sanitizer
        }
      }

      return res.json({ success: true, text: sanitizeTranscriptText(rawText) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'تعذر تحويل الصوت لنص.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Voice Idea Summary ---
  app.post('/api/voice-idea-summary', async (req: Request, res: Response) => {
    const ai = getAiClient();
    if (!ai) {
      return res.status(503).json({ success: false, error: 'مفتاح Gemini غير مهيأ.' });
    }
    try {
      const rawIdea = String(req.body?.rawIdea || '').trim();
      if (!rawIdea) {
        return res.status(400).json({ success: false, error: 'النص فارغ.' });
      }
      const response = await generateWithModelFallback(ai, {
        contents: `رتب هاد الملاحظة الصوتية ديال الشانطي بالدارجة المغربية فـ عنوان قصير ولائحة منظمة ديال السلعة أو الخدمة المطلوبة:\n"${rawIdea}"`,
        config: {
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              structuredDarija: { type: Type.STRING },
            },
          },
        },
      });
      const parsed = parseCleanJson<{ title?: string; structuredDarija?: string }>(response.text);
      return res.json({
        success: true,
        title: parsed.title || 'ملاحظة من الشانطي',
        structuredDarija: parsed.structuredDarija || rawIdea,
      });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'تعذر تنظيم الفكرة.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Moroccan Darija TTS (Gemini 3.8 TTS with cache & quota cooldown — DO NOT ALTER) ---
  app.post('/api/tts', async (req: Request, res: Response) => {
    const ai = getAiClient('v1beta');
    if (!ai) {
      return res.status(503).json({ ok: false, reason: 'no_keys', message: 'خدمة الصوت السحابي غير مهيأة.' });
    }
    try {
      const text = String(req.body?.text || '').trim();
      const requestedVoice = String(req.body?.voiceId || req.body?.voiceType || req.body?.voiceGender || '').trim();
      const isMale =
        requestedVoice === 'male' || requestedVoice === 'boy' || requestedVoice === 'Charon';
      if (!text) {
        return res.status(400).json({ ok: false, message: 'النص فارغ.' });
      }

      const voiceName = isMale ? 'Charon' : 'Kore';
      const cacheKey = ttsCacheKey(voiceName, text);
      const cachedB64 = getServerTtsCache(cacheKey);
      if (cachedB64) {
        return res.json({
          ok: true,
          cached: true,
          audioBase64: cachedB64,
          mimeType: 'audio/wav',
        });
      }

      const stylePrompt = isMale
        ? 'Speak strictly in authentic Moroccan Darija (الدارجة المغربية), warm confident Moroccan male master builder (المعلم) accent, clear pronunciation, natural pace.'
        : 'Speak strictly in authentic Moroccan Darija (الدارجة المغربية), clear friendly Moroccan female architect engineer (سلمى المهندسة) accent, natural pace.';

      const ttsModels = ['gemini-3.8-flash-lite-tts', 'gemini-3.8-flash-tts'];
      const now = Date.now();
      let audioBase64: string | undefined;
      let lastErr: unknown;

      for (const model of ttsModels) {
        if ((ttsCooldownUntil[model] || 0) > now) {
          continue;
        }
        try {
          let response;
          try {
            response = await withGeminiRetry(() =>
              ai.models.generateContent({
                model,
                contents: [
                  {
                    role: 'user',
                    parts: [
                      {
                        text,
                        speechMetadata: {
                          style: stylePrompt,
                        },
                      },
                    ],
                  },
                ],
                config: {
                  responseModalities: ['AUDIO'],
                  speechConfig: {
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName },
                    },
                  },
                },
              })
            );
          } catch (innerErr: unknown) {
            const innerMsg = innerErr instanceof Error ? innerErr.message : '';
            if (innerMsg.includes('speechMetadata')) {
              response = await withGeminiRetry(() =>
                ai.models.generateContent({
                  model,
                  contents: [
                    {
                      role: 'user',
                      parts: [{ text: `${stylePrompt}\n\n${text}` }],
                    },
                  ],
                  config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: {
                      voiceConfig: {
                        prebuiltVoiceConfig: { voiceName },
                      },
                    },
                  },
                })
              );
            } else {
              throw innerErr;
            }
          }

          audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          if (audioBase64) break;
        } catch (modelErr: unknown) {
          lastErr = modelErr;
          const m = modelErr instanceof Error ? modelErr.message : String(modelErr);
          const isQuota =
            m.includes('429') ||
            m.toLowerCase().includes('quota') ||
            m.includes('RESOURCE_EXHAUSTED');
          if (isQuota) {
            ttsCooldownUntil[model] = Date.now() + 45_000;
            continue;
          }
          if (m.includes('503') || m.includes('UNAVAILABLE') || m.includes('high demand')) {
            ttsCooldownUntil[model] = Date.now() + 20_000;
            continue;
          }
          throw modelErr;
        }
      }

      if (!audioBase64) {
        if (lastErr) {
          throw lastErr;
        }
        return res.status(429).json({
          ok: false,
          quotaExhausted: true,
          reason: 'quota_exhausted',
          message:
            'وصلنا للحد المؤقت ديال الصوت السحابي، غادي نكمل بصوت المتصفح.',
        });
      }

      const rawBuf = Buffer.from(audioBase64, 'base64');
      if (rawBuf.length > 0 && rawBuf.subarray(0, 4).toString('ascii') !== 'RIFF') {
        const header = Buffer.alloc(44);
        header.write('RIFF', 0);
        header.writeUInt32LE(36 + rawBuf.length, 4);
        header.write('WAVE', 8);
        header.write('fmt ', 12);
        header.writeUInt32LE(16, 16);
        header.writeUInt16LE(1, 20);
        header.writeUInt16LE(1, 22);
        header.writeUInt32LE(24000, 24);
        header.writeUInt32LE(48000, 28);
        header.writeUInt16LE(2, 32);
        header.writeUInt16LE(16, 34);
        header.write('data', 36);
        header.writeUInt32LE(rawBuf.length, 40);
        audioBase64 = Buffer.concat([header, rawBuf]).toString('base64');
      }

      saveServerTtsCache(cacheKey, audioBase64);
      return res.json({
        ok: true,
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err: unknown) {
      const rawMsg = err instanceof Error ? err.message : 'TTS error';
      const isQuota =
        rawMsg.includes('429') ||
        rawMsg.toLowerCase().includes('quota') ||
        rawMsg.includes('RESOURCE_EXHAUSTED');
      if (isQuota) {
        console.info('[TTS] Free-tier quota exhausted; client falling back to browser speech.');
      } else {
        console.info('[TTS] Cloud synthesis failed:', rawMsg.slice(0, 200));
      }
      return res.status(isQuota ? 429 : 500).json({
        ok: false,
        quotaExhausted: isQuota,
        reason: isQuota ? 'quota_exhausted' : 'tts_failed',
        message: isQuota
          ? 'سالات الكوتا اليومية ديال الصوت السحابي (10/يوم). فعّل مفتاح مدفوع في Settings > Secrets أو خدام حالياً بصوت المتصفح.'
          : 'تعذر تشغيل الصوت السحابي، خدام بصوت المتصفح.',
      });
    }
  });

  return app;
}
