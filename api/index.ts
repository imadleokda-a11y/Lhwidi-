import express, { type Express, type Request, type Response } from 'express';
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const ROOT_DIR = process.cwd();
const IS_VERCEL = Boolean(process.env.VERCEL);
const MAX_TRIALS = 10;
const ADMIN_PIN = 'lhwidi999';

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

interface KeyPoolState {
  currentIdx: number;
  keyCooldownUntil: Map<string, number>;
  modelCooldownByKey: Map<string, Record<string, number>>;
}

const mainKeyPool: KeyPoolState = {
  currentIdx: 0,
  keyCooldownUntil: new Map(),
  modelCooldownByKey: new Map(),
};

const ttsKeyPool: KeyPoolState = {
  currentIdx: 0,
  keyCooldownUntil: new Map(),
  modelCooldownByKey: new Map(),
};

function getGeminiKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const addKey = (raw: string | undefined) => {
    const val = (raw || '').trim();
    if (!val || val === 'MY_GEMINI_API_KEY' || seen.has(val)) return;
    seen.add(val);
    keys.push(val);
  };

  const numbered: Array<{ num: number; val: string }> = [];
  for (const [envName, envVal] of Object.entries(process.env)) {
    const match = /^GEMINI_API_KEY_(\d+)$/i.exec(envName);
    if (match && envVal) {
      numbered.push({ num: Number(match[1]), val: envVal });
    }
  }
  numbered.sort((a, b) => a.num - b.num);

  addKey(process.env.GEMINI_API_KEY);
  for (const item of numbered) {
    addKey(item.val);
  }

  if (process.env.GEMINI_API_KEYS) {
    for (const part of process.env.GEMINI_API_KEYS.split(/[\s,;]+/)) {
      addKey(part);
    }
  }

  return keys;
}

function getOrderedKeyIndices(pool: KeyPoolState, keys: string[]): number[] {
  const n = keys.length;
  if (n === 0) return [];
  const now = Date.now();
  const start = ((pool.currentIdx % n) + n) % n;

  const ready: number[] = [];
  for (let offset = 0; offset < n; offset++) {
    const idx = (start + offset) % n;
    const until = pool.keyCooldownUntil.get(keys[idx]) || 0;
    if (until <= now) {
      ready.push(idx);
    }
  }

  if (ready.length > 0) {
    return ready;
  }

  // All keys hit cooldown -> wrap around cleanly back to Key 1 (index 0)
  for (const k of keys) {
    pool.keyCooldownUntil.delete(k);
    pool.modelCooldownByKey.delete(k);
  }
  pool.currentIdx = 0;
  return Array.from({ length: n }, (_, i) => i);
}

function getModelCooldownMap(pool: KeyPoolState, apiKey: string): Record<string, number> {
  let map = pool.modelCooldownByKey.get(apiKey);
  if (!map) {
    map = {};
    pool.modelCooldownByKey.set(apiKey, map);
  }
  return map;
}

function markKeyCooldown(
  pool: KeyPoolState,
  keys: string[],
  keyIdx: number,
  cooldownMs: number
) {
  const key = keys[keyIdx];
  if (!key) return;
  pool.keyCooldownUntil.set(key, Date.now() + cooldownMs);
  pool.currentIdx = keys.length > 0 ? (keyIdx + 1) % keys.length : 0;
}

function createAiClientForKey(apiKey: string, apiVersion?: string): GoogleGenAI {
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

function normalizeBlueprintAnalysis(raw: Record<string, unknown>) {
  const isBlueprint = raw.isBlueprint !== false;
  const roomsRaw = Array.isArray(raw.rooms) ? raw.rooms : [];
  const materialsRaw = Array.isArray(raw.materials) ? raw.materials : [];
  const phasesRaw = Array.isArray(raw.phases) ? raw.phases : [];
  const warningsRaw = Array.isArray(raw.warnings) ? raw.warnings : [];

  const rooms = roomsRaw.map((r: unknown) => {
    const item = (r && typeof r === 'object' ? r : {}) as Record<string, unknown>;
    return {
      name: String(item.name || 'فضاء / غرفة'),
      dimensions: String(item.dimensions || 'حسب المخطط'),
      areaSqm: String(item.areaSqm || '-'),
      notes: item.notes ? String(item.notes) : undefined,
    };
  });

  const materials = materialsRaw.map((m: unknown) => {
    const item = (m && typeof m === 'object' ? m : {}) as Record<string, unknown>;
    return {
      name: String(item.name || 'مادة بناء'),
      quantity: String(item.quantity || '-'),
      unit: String(item.unit || ''),
      notes: item.notes ? String(item.notes) : undefined,
    };
  });

  const phases = phasesRaw.map((p: unknown, idx: number) => {
    const item = (p && typeof p === 'object' ? p : {}) as Record<string, unknown>;
    return {
      stepNumber: Number(item.stepNumber) || idx + 1,
      phaseName: String(item.phaseName || `المرحلة ${idx + 1}`),
      explanationDarija: String(item.explanationDarija || ''),
    };
  });

  const warnings = warningsRaw.map((w: unknown) => String(w || '')).filter(Boolean);
  const darijaSummary = String(
    raw.darijaSummary ||
      raw.audioScript ||
      (isBlueprint
        ? 'تمت قراءة المخطط الهندسي واستخراج التفاصيل الأساسية بالدارجة.'
        : 'هادي ماشي صورة ديال بلان البناء، عافاك صور المخطط بشكل واضح.')
  );
  const audioScript = String(raw.audioScript || darijaSummary);

  return {
    isBlueprint,
    title: String(raw.title || (isBlueprint ? 'تحليل مخطط البناء' : 'صورة غير مطابقة للبلان')),
    buildingType: String(raw.buildingType || (isBlueprint ? 'مشروع بناء' : '-')),
    totalAreaSqm: String(raw.totalAreaSqm || '-'),
    roomsCount: Number(raw.roomsCount) || rooms.length,
    darijaSummary,
    audioScript,
    structuralNotes: raw.structuralNotes ? String(raw.structuralNotes) : '',
    rooms,
    materials,
    phases,
    warnings,
  };
}

function normalizeCrackDiagnosis(raw: Record<string, unknown>) {
  const sevRaw = String(raw.severity || 'moderate').toLowerCase();
  const severity: 'surface' | 'moderate' | 'structural' =
    sevRaw === 'surface' || sevRaw === 'structural' ? sevRaw : 'moderate';
  const repairSteps = Array.isArray(raw.repairSteps)
    ? raw.repairSteps.map((s) => String(s || '')).filter(Boolean)
    : [];
  const diagnosisDarija = String(
    raw.diagnosisDarija || 'تشخيص أولي للشق فالحيط أو الضالة حسب الصورة المرسلة.'
  );
  return {
    severity,
    severityLabelDarija: String(
      raw.severityLabelDarija ||
        (severity === 'surface'
          ? 'شق سطحي بسيط'
          : severity === 'structural'
            ? 'شق إنشائي خطير'
            : 'شق متوسط خاصو مراقبة')
    ),
    diagnosisDarija,
    causeDarija: String(raw.causeDarija || 'تفاوت الحرارة أو حركة خفيفة فالبني أو المرطوب.'),
    repairSteps:
      repairSteps.length > 0
        ? repairSteps
        : ['نظف الشق مزيان من الغبرة', 'عالج الشق بمادة السيكافليكس أو مورطي مناسب', 'عاود المرطوب والصباغة بعد النشوف'],
    audioScript: String(raw.audioScript || diagnosisDarija),
  };
}

function formatGeminiError(err: unknown, fallback: string): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err || fallback);
  const name = err instanceof Error ? err.name : '';
  if (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    raw.includes('aborted') ||
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('high demand')
  ) {
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

function classifyGeminiFailure(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  const name = err instanceof Error ? err.name : '';
  const is503 = msg.includes('503') || msg.includes('UNAVAILABLE') || msg.includes('high demand');
  const isDailyQuota =
    msg.includes('PerDay') ||
    msg.includes('GenerateRequestsPerDay') ||
    msg.includes('quota_metric') ||
    msg.includes('exceeded your current quota');
  const isQuota =
    isDailyQuota ||
    msg.includes('429') ||
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.toLowerCase().includes('quota');
  const isAuthError =
    msg.includes('401') ||
    msg.includes('403') ||
    msg.includes('API_KEY_INVALID') ||
    msg.includes('PERMISSION_DENIED') ||
    msg.toLowerCase().includes('api key not valid') ||
    msg.toLowerCase().includes('api key expired');
  const isNotFound = msg.includes('404') || msg.includes('NOT_FOUND');
  const isTimeout = name === 'TimeoutError' || name === 'AbortError' || msg.includes('aborted');
  const shouldFallback =
    isTimeout ||
    is503 ||
    isQuota ||
    isAuthError ||
    isNotFound ||
    msg.includes('500') ||
    msg.includes('INTERNAL') ||
    msg.includes('fetch failed');
  return { msg, is503, isQuota, isDailyQuota, isAuthError, isNotFound, shouldFallback };
}

class KeyRotationSignal extends Error {
  originalError: unknown;
  isDailyQuota: boolean;
  isAuthError: boolean;
  constructor(originalError: unknown, isDailyQuota: boolean, isAuthError: boolean) {
    super('KEY_ROTATE');
    this.originalError = originalError;
    this.isDailyQuota = isDailyQuota;
    this.isAuthError = isAuthError;
  }
}

async function generateForSingleKey(
  ai: GoogleGenAI,
  apiKey: string,
  hasOtherKeys: boolean,
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
    timeoutMs: number;
    deadlineMs: number;
    hedgeDelayMs: number;
    requireText: boolean;
  }
) {
  const defaultModels = [
    'gemini-3.5-flash-lite',
    'gemini-3.1-flash-lite',
    'gemini-3.6-flash',
    'gemini-3-flash-preview',
    'gemini-3.5-flash',
  ];
  const modelCooldowns = getModelCooldownMap(mainKeyPool, apiKey);
  const perCallTimeout = params.timeoutMs;
  const hedgeDelayMs = params.hedgeDelayMs;
  const requireText = params.requireText;
  const MAX_IN_FLIGHT = 2;

  let lastErr: unknown;
  let lastTransient503Err: unknown;

  const runControlledPool = async (candidates: string[]) => {
    const remainingBudget = params.deadlineMs - Date.now();
    if (remainingBudget < 1600 || candidates.length === 0) {
      throw lastTransient503Err || lastErr || new Error('انتهت مهلة الطلب مؤقتاً، عاود حاول.');
    }

    return new Promise<Awaited<ReturnType<typeof ai.models.generateContent>>>((resolve, reject) => {
      let settled = false;
      let nextIdx = 0;
      let activeCount = 0;
      const controllers: AbortController[] = [];
      let hedgeTimer: ReturnType<typeof setTimeout> | null = null;

      const clearTimers = () => {
        if (hedgeTimer !== null) {
          clearTimeout(hedgeTimer);
          hedgeTimer = null;
        }
      };

      const abortAll = () => {
        for (const c of controllers) {
          try {
            c.abort();
          } catch {
            // ignore
          }
        }
      };

      const scheduleHedge = (delay: number) => {
        clearTimers();
        if (settled || nextIdx >= candidates.length || activeCount >= MAX_IN_FLIGHT) return;
        hedgeTimer = setTimeout(() => {
          hedgeTimer = null;
          if (!settled && nextIdx < candidates.length && activeCount < MAX_IN_FLIGHT) {
            launchNext();
          }
        }, delay);
      };

      const launchNext = () => {
        if (settled) return;
        if (nextIdx >= candidates.length) {
          if (activeCount === 0) {
            clearTimers();
            settled = true;
            reject(lastTransient503Err || lastErr);
          }
          return;
        }
        if (activeCount >= MAX_IN_FLIGHT) return;

        const now = Date.now();
        const remaining = params.deadlineMs - now;
        if (remaining < 1400) {
          if (activeCount === 0) {
            clearTimers();
            settled = true;
            reject(lastTransient503Err || lastErr || new Error('انتهت مهلة الطلب مؤقتاً، عاود حاول.'));
          }
          return;
        }

        const model = candidates[nextIdx++];
        activeCount += 1;

        const ctrl = new AbortController();
        controllers.push(ctrl);

        const callTimeout = Math.max(3500, Math.min(perCallTimeout, remaining));
        const timeoutId = setTimeout(() => {
          try {
            ctrl.abort();
          } catch {
            // ignore
          }
        }, callTimeout);

        const baseConfig: Record<string, unknown> = { ...(params.config || {}) };
        if (model === 'gemini-3.6-flash' && baseConfig.thinkingConfig) {
          delete baseConfig.thinkingConfig;
        } else if (model === 'gemini-3.1-flash-lite' && baseConfig.thinkingConfig) {
          baseConfig.thinkingConfig = { thinkingLevel: ThinkingLevel.MINIMAL };
        }

        if (nextIdx < candidates.length && activeCount < MAX_IN_FLIGHT) {
          scheduleHedge(hedgeDelayMs);
        }

        ai.models
          .generateContent({
            model,
            contents: params.contents as never,
            config: {
              ...baseConfig,
              abortSignal: ctrl.signal,
            } as never,
          })
          .then((res) => {
            clearTimeout(timeoutId);
            activeCount -= 1;
            if (settled) return;

            if (requireText && (!res || !String(res.text || '').trim())) {
              lastErr = new Error('رد فارغ من النموذج');
              if (nextIdx < candidates.length) {
                launchNext();
              } else if (activeCount === 0) {
                clearTimers();
                settled = true;
                reject(lastTransient503Err || lastErr);
              }
              return;
            }

            settled = true;
            clearTimers();
            abortAll();
            resolve(res);
          })
          .catch((err: unknown) => {
            clearTimeout(timeoutId);
            activeCount -= 1;
            if (settled) return;

            const { is503, isQuota, isDailyQuota, isAuthError, isNotFound, shouldFallback } =
              classifyGeminiFailure(err);
            lastErr = err;
            if (is503) lastTransient503Err = err;

            if (hasOtherKeys && (isQuota || isAuthError)) {
              settled = true;
              clearTimers();
              abortAll();
              reject(new KeyRotationSignal(err, isDailyQuota, isAuthError));
              return;
            }

            if (isNotFound) {
              modelCooldowns[model] = Date.now() + 600_000;
            } else if (isQuota) {
              modelCooldowns[model] = Date.now() + 15_000;
            }

            if (!shouldFallback) {
              settled = true;
              clearTimers();
              abortAll();
              reject(err);
              return;
            }

            if (nextIdx < candidates.length) {
              launchNext();
            } else if (activeCount === 0) {
              clearTimers();
              settled = true;
              reject(lastTransient503Err || lastErr);
            }
          });
      };

      launchNext();
    });
  };

  const now = Date.now();
  const active = defaultModels.filter((m) => (modelCooldowns[m] || 0) <= now);
  const candidates = (active.length > 0 ? active : ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite']).slice(
    0,
    5
  );

  return runControlledPool(candidates);
}

async function generateWithModelFallback(
  params: {
    contents: unknown;
    config?: Record<string, unknown>;
    timeoutMs?: number;
    budgetMs?: number;
    hedgeDelayMs?: number;
    requireText?: boolean;
  }
) {
  const keys = getGeminiKeys();
  if (keys.length === 0) {
    throw new Error('مفتاح Gemini AI غير مهيأ حالياً في الخادم.');
  }

  const startMs = Date.now();
  const budgetMs = params.budgetMs ?? 20000;
  const deadlineMs = startMs + budgetMs;
  const perCallTimeout = params.timeoutMs ?? 10000;
  const hedgeDelayMs = params.hedgeDelayMs ?? 4500;
  const requireText = params.requireText !== false;

  const order = getOrderedKeyIndices(mainKeyPool, keys);
  let lastErr: unknown;
  let lastTransient503Err: unknown;

  for (let i = 0; i < order.length; i++) {
    if (Date.now() >= deadlineMs - 1200) break;
    const keyIdx = order[i];
    const apiKey = keys[keyIdx];
    const hasOtherKeys = i + 1 < order.length || keys.length > 1;
    const ai = createAiClientForKey(apiKey);

    try {
      const res = await generateForSingleKey(ai, apiKey, hasOtherKeys, {
        contents: params.contents,
        config: params.config,
        timeoutMs: perCallTimeout,
        deadlineMs,
        hedgeDelayMs,
        requireText,
      });
      mainKeyPool.currentIdx = keyIdx;
      return res;
    } catch (err: unknown) {
      if (err instanceof KeyRotationSignal) {
        lastErr = err.originalError;
        const cooldownMs = err.isDailyQuota || err.isAuthError ? 900_000 : 60_000;
        markKeyCooldown(mainKeyPool, keys, keyIdx, cooldownMs);
        continue;
      }

      lastErr = err;
      const { is503, isQuota, isDailyQuota, isAuthError, shouldFallback } =
        classifyGeminiFailure(err);
      if (is503) lastTransient503Err = err;

      if (!shouldFallback) {
        throw err;
      }

      if (isQuota || isAuthError) {
        markKeyCooldown(mainKeyPool, keys, keyIdx, isDailyQuota || isAuthError ? 900_000 : 60_000);
        continue;
      }

      if (i + 1 < order.length && Date.now() < deadlineMs - 3000) {
        continue;
      }
      break;
    }
  }

  // If single-key or all keys exhausted within budget, try one brief wrap-around retry when single-key 503
  if (keys.length === 1 && Date.now() + 3500 < deadlineMs) {
    await new Promise((r) => setTimeout(r, 400));
    const ai = createAiClientForKey(keys[0]);
    try {
      return await generateForSingleKey(ai, keys[0], false, {
        contents: params.contents,
        config: params.config,
        timeoutMs: perCallTimeout,
        deadlineMs,
        hedgeDelayMs,
        requireText,
      });
    } catch (retryErr: unknown) {
      lastErr = retryErr;
    }
  }

  throw lastTransient503Err || lastErr;
}

function resolveImagePart(
  imageBase64OrUrl: string,
  fallbackMime = 'image/jpeg'
): { mimeType: string; data: string } | null {
  if (!imageBase64OrUrl) return null;

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
  const pin = String(req.headers['x-admin-pin'] || '').trim();
  return pin === ADMIN_PIN;
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '25mb' }));

  app.use((req, res, next) => {
    // Restore original /api/... path if Vercel rewrite forwards /api/index or /api/index.ts
    if (req.url === '/api/index' || req.url.startsWith('/api/index.ts') || req.url.startsWith('/api/index?')) {
      const origHeader =
        req.headers['x-vercel-original-url'] ||
        req.headers['x-forwarded-uri'] ||
        req.headers['x-invoke-path'];
      const orig = Array.isArray(origHeader) ? origHeader[0] : origHeader;
      if (typeof orig === 'string' && orig.startsWith('/api/') && !orig.startsWith('/api/index')) {
        req.url = orig;
      }
    }
    if (req.url.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    }
    next();
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    const keys = getGeminiKeys();
    res.json({
      ok: true,
      aiConfigured: keys.length > 0,
      keysCount: keys.length,
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
    const bodyCode = String(req.body?.code || '').trim().toUpperCase();
    const bodyName = String(req.body?.name || '').trim() || 'مشترك';
    let idx = codesStore.findIndex(
      (c) => c.id === id || (bodyCode && c.code.toUpperCase() === bodyCode)
    );
    if (idx === -1) {
      if (!bodyCode) {
        return res.status(404).json({ error: 'الكود غير موجود' });
      }
      const restored: ServerCodeRecord = {
        id: id || `code_${Date.now()}`,
        name: bodyName,
        code: bodyCode,
        isActive: typeof req.body?.isActive === 'boolean' ? req.body.isActive : true,
        trials: typeof req.body?.trials === 'number' ? Math.max(0, Math.round(req.body.trials)) : 0,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
      };
      codesStore = [restored, ...codesStore];
      persistCodes();
      return res.json({ ok: true, code: restored });
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
    if (getGeminiKeys().length === 0) {
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

      const prompt = `أنت "المعلم الذكي" — مهندس ومقاول مغربي خبير فـ قراءة مخططات البناء (بلان الدار، الفيلات، السواري، الضالة، الحديد).
حلل الصورة بإيجاز عملي وواضح بالدارجة المغربية بالحروف العربية فقط (باستثناء رموز مثل R+1 أو T10/T12).
${finalNotes ? `ملاحظة صاحب البلان: ${finalNotes}` : ''}

القواعد:
- إذا لم تكن الصورة مخطط بناء (وجه أو طبيعة أو صورة عادية)، ضع "isBlueprint": false واشرح ذلك بجملة بالدارجة.
- إذا كانت بلان بناء أو حديد: استخرج بإيجاز أهم الغرف أو العناصر (حتى 5)، وأهم 4 مواد بناء، و3 مراحل عمل مركزة، وتنبيهين مهمين، مع "darijaSummary" و "audioScript" من 2 إلى 3 جمل واضحة ومفيدة.

أرجع كائن JSON فقط بهذا الشكل:
{
  "isBlueprint": true,
  "title": "عنوان المشروع",
  "buildingType": "نوع البناء",
  "totalAreaSqm": "المساحة م²",
  "roomsCount": 4,
  "darijaSummary": "ملخص مختصر بالدارجة",
  "audioScript": "شرح صوتي طبيعي بالدارجة",
  "structuralNotes": "ملاحظات السواري والحديد",
  "rooms": [{"name": "الغرفة", "dimensions": "الأبعاد", "areaSqm": "المساحة"}],
  "materials": [{"name": "المادة", "quantity": "الكمية", "unit": "الوحدة"}],
  "phases": [{"stepNumber": 1, "phaseName": "المرحلة", "explanationDarija": "الشرح"}],
  "warnings": ["تنبيه"]
}`;

      const response = await generateWithModelFallback({
        contents: {
          parts: [
            { inlineData: imagePart },
            { text: prompt },
          ],
        },
        timeoutMs: 24000,
        budgetMs: 45000,
        hedgeDelayMs: 3200,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsedRaw = parseCleanJson<Record<string, unknown>>(response.text);
      const normalized = normalizeBlueprintAnalysis(parsedRaw);
      return res.json({ success: true, analysis: normalized });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'وقع خطأ أثناء تحليل البلان.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Gemini Vision + Chat: Smart Maâlem Follow-Up Q&A ---
  app.post('/api/chat-plan', async (req: Request, res: Response) => {
    if (getGeminiKeys().length === 0) {
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

      const compactContext = analysisContext
        ? JSON.stringify(analysisContext).slice(0, 3500)
        : '{}';

      const promptText = `أنت "المعلم الذكي" فـ تطبيق فاهم بلان. كتجاوب على أسئلة البناي وصاحب الدار بالدارجة المغربية الواضحة والمختصرة والعملية بالحروف العربية فقط (3 إلى 5 جمل مفيدة ومباشرة).
معلومات التحليل السابق للبلان:
${compactContext}

المحادثة السابقة:
${historyText}

سؤال المستعمل دابا: ${finalQuestion}

جاوب مباشرة بالدارجة المغربية بأسلوب معلم خبير واضح ومفيد (بدون مقدمات طويلة).`;

      parts.push({ text: promptText });

      let response;
      try {
        response = await generateWithModelFallback({
          contents: { parts },
          timeoutMs: 18000,
          budgetMs: 36000,
          hedgeDelayMs: parts.length > 1 ? 3000 : 2100,
        });
      } catch (visionChatErr: unknown) {
        if (parts.length > 1 && analysisContext) {
          response = await generateWithModelFallback({
            contents: { parts: [{ text: promptText }] },
            timeoutMs: 15000,
            budgetMs: 28000,
            hedgeDelayMs: 1800,
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
    if (getGeminiKeys().length === 0) {
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

      const crackPrompt = `أنت مهندس مدني مغربي مختص فتشخيص تشققات المباني (الحيوط، السواري، الضالة، المرطوب).
عاين هذه الصورة وحدد واش الشق سطحي (surface)، متوسط (moderate)، ولا إنشائي خطير (structural)، وشرح السبب وخطوات الإصلاح بالترتيب بالدارجة المغربية.
أرجع كائن JSON صحيح فقط بهذا الشكل الدقيق:
{
  "severity": "surface أو moderate أو structural",
  "severityLabelDarija": "توصيف الخطورة بالدارجة",
  "diagnosisDarija": "التشخيص بالدارجة",
  "causeDarija": "السبب المحتمل بالدارجة",
  "repairSteps": ["الخطوة 1", "الخطوة 2"],
  "audioScript": "نص الشرح الصوتي بالدارجة"
}`;

      const response = await generateWithModelFallback({
        contents: {
          parts: [
            { inlineData: imagePart },
            { text: crackPrompt },
          ],
        },
        timeoutMs: 22000,
        budgetMs: 40000,
        hedgeDelayMs: 3000,
        config: {
          responseMimeType: 'application/json',
        },
      });

      const parsedRaw = parseCleanJson<Record<string, unknown>>(response.text);
      return res.json({ success: true, diagnosis: normalizeCrackDiagnosis(parsedRaw) });
    } catch (err: unknown) {
      const formatted = formatGeminiError(err, 'وقع خطأ أثناء فحص الشق.');
      return res.status(formatted.status).json({ success: false, error: formatted.message });
    }
  });

  // --- Gemini Audio Transcription (Verbatim Darija Arabic-Script Only) ---
  app.post('/api/transcribe', async (req: Request, res: Response) => {
    const keys = getGeminiKeys();
    if (keys.length === 0) {
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

      const callTranscribeBetaWithRotation = async (): Promise<string> => {
        const order = getOrderedKeyIndices(mainKeyPool, keys);
        let lastBetaErr: unknown;
        for (const keyIdx of order) {
          const aiBeta = createAiClientForKey(keys[keyIdx], 'v1beta');
          try {
            const betaResp = await withGeminiRetry(
              () =>
                aiBeta.models.generateContent({
                  model: 'gemini-3.5-transcribe',
                  contents: { parts: audioParts },
                  config: {
                    abortSignal: AbortSignal.timeout(10000),
                  } as never,
                }),
              keys.length > 1 ? 0 : 1
            );
            mainKeyPool.currentIdx = keyIdx;
            return betaResp.text || '';
          } catch (err: unknown) {
            lastBetaErr = err;
            const { isQuota, isDailyQuota, isAuthError, shouldFallback } = classifyGeminiFailure(err);
            if (isQuota || isAuthError) {
              markKeyCooldown(mainKeyPool, keys, keyIdx, isDailyQuota || isAuthError ? 900_000 : 60_000);
              continue;
            }
            if (!shouldFallback) throw err;
          }
        }
        throw lastBetaErr;
      };

      let rawText = '';
      try {
        const response = await generateWithModelFallback({
          contents: { parts: audioParts },
          timeoutMs: 14000,
          budgetMs: 28000,
          hedgeDelayMs: 2100,
          requireText: false,
        });
        rawText = response.text || '';
      } catch {
        rawText = await callTranscribeBetaWithRotation();
      }

      if (/[\u0900-\u097F]/.test(rawText)) {
        try {
          const betaText = await callTranscribeBetaWithRotation();
          if (betaText && !/[\u0900-\u097F]/.test(betaText)) {
            rawText = betaText;
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
    if (getGeminiKeys().length === 0) {
      return res.status(503).json({ success: false, error: 'مفتاح Gemini غير مهيأ.' });
    }
    try {
      const rawIdea = String(req.body?.rawIdea || '').trim();
      if (!rawIdea) {
        return res.status(400).json({ success: false, error: 'النص فارغ.' });
      }
      const response = await generateWithModelFallback({
        contents: `رتب هاد الملاحظة الصوتية ديال الشانطي بالدارجة المغربية فـ عنوان قصير ولائحة منظمة ديال السلعة أو الخدمة المطلوبة:\n"${rawIdea}"\n\nأرجع JSON فقط بهذا الشكل: {"title":"عنوان قصير","structuredDarija":"النص المنظم بالدارجة"}`,
        timeoutMs: 14000,
        budgetMs: 28000,
        hedgeDelayMs: 2100,
        config: {
          responseMimeType: 'application/json',
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

  // --- Moroccan Darija TTS (Gemini 3.8 TTS with cache & multi-key quota rotation — voices/prompts unchanged) ---
  app.post('/api/tts', async (req: Request, res: Response) => {
    const keys = getGeminiKeys();
    if (keys.length === 0) {
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
      const order = getOrderedKeyIndices(ttsKeyPool, keys);
      let audioBase64: string | undefined;
      let lastErr: unknown;

      for (const keyIdx of order) {
        const apiKey = keys[keyIdx];
        const ai = createAiClientForKey(apiKey, 'v1beta');
        const ttsCooldownUntil = getModelCooldownMap(ttsKeyPool, apiKey);
        const retryCount = keys.length > 1 ? 0 : 1;
        let keyExhausted = false;

        for (const model of ttsModels) {
          if ((ttsCooldownUntil[model] || 0) > Date.now()) {
            continue;
          }
          try {
            let response;
            try {
              response = await withGeminiRetry(
                () =>
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
                  }),
                retryCount
              );
            } catch (innerErr: unknown) {
              const innerMsg = innerErr instanceof Error ? innerErr.message : '';
              if (innerMsg.includes('speechMetadata')) {
                response = await withGeminiRetry(
                  () =>
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
                    }),
                  retryCount
                );
              } else {
                throw innerErr;
              }
            }

            audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (audioBase64) break;
          } catch (modelErr: unknown) {
            lastErr = modelErr;
            const { is503, isQuota, isDailyQuota, isAuthError } = classifyGeminiFailure(modelErr);
            if (isQuota || isAuthError) {
              ttsCooldownUntil[model] = Date.now() + 45_000;
              if (keys.length > 1 && (isDailyQuota || isAuthError)) {
                markKeyCooldown(ttsKeyPool, keys, keyIdx, 900_000);
                keyExhausted = true;
                break;
              }
              continue;
            }
            if (is503) {
              ttsCooldownUntil[model] = Date.now() + 20_000;
              continue;
            }
            throw modelErr;
          }
        }

        if (audioBase64) {
          ttsKeyPool.currentIdx = keyIdx;
          break;
        }

        if (!keyExhausted && lastErr) {
          const { isQuota, isDailyQuota, isAuthError } = classifyGeminiFailure(lastErr);
          if (isQuota || isAuthError) {
            markKeyCooldown(
              ttsKeyPool,
              keys,
              keyIdx,
              isDailyQuota || isAuthError ? 900_000 : 60_000
            );
          }
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

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'المسار غير موجود.' });
  });

  return app;
}

const app = createApiApp();
export default app;
