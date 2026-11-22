import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Loader2, Square, Volume2, VolumeX } from 'lucide-react';
import type { VoiceSettings } from '../types';

const VOICE_SETTINGS_KEY = 'fahem_blan_voice_settings_v2';
const SELECTED_VOICE_KEY = 'selectedVoice';
const TTS_LS_CACHE_KEY = 'fahem_tts_audio_cache_v3';
const TTS_IDB_NAME = 'fahem_tts_audio_db_v2';
const TTS_IDB_STORE = 'clips';
const TTS_MODEL_NAME = 'gemini-3.8-flash-lite-tts';

const DEFAULT_SETTINGS: VoiceSettings = {
  voiceEnabled: true,
  voiceGender: 'female',
  speechRate: 0.95,
};

interface CachedAudioClip {
  b64: string;
  mime: string;
  ts: number;
}

const memoryClipCache = new Map<string, { b64: string; mime: string }>();

function openTtsDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(TTS_IDB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(TTS_IDB_STORE)) {
          db.createObjectStore(TTS_IDB_STORE);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function getFromIdb(key: string): Promise<CachedAudioClip | null> {
  const db = await openTtsDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(TTS_IDB_STORE, 'readonly').objectStore(TTS_IDB_STORE).get(key);
      req.onsuccess = () => resolve((req.result as CachedAudioClip) || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function saveToIdb(key: string, clip: CachedAudioClip): Promise<void> {
  const db = await openTtsDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(TTS_IDB_STORE, 'readwrite');
      tx.objectStore(TTS_IDB_STORE).put(clip, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}

function getFromLocalStorageCache(key: string): CachedAudioClip | null {
  try {
    const direct = localStorage.getItem(`tts_v3_${key}`);
    if (direct) return JSON.parse(direct) as CachedAudioClip;
    const bulk = localStorage.getItem(TTS_LS_CACHE_KEY);
    if (bulk) {
      const parsed = JSON.parse(bulk) as Record<string, CachedAudioClip>;
      if (parsed?.[key]?.b64) return parsed[key];
    }
  } catch {
    // ignore
  }
  return null;
}

function storeClipInCaches(key: string, b64: string, mime: string) {
  if (!b64) return;
  if (memoryClipCache.size >= 100) {
    const oldest = memoryClipCache.keys().next().value;
    if (oldest) memoryClipCache.delete(oldest);
  }
  memoryClipCache.set(key, { b64, mime });

  const clip: CachedAudioClip = { b64, mime, ts: Date.now() };
  void saveToIdb(key, clip);

  if (b64.length > 750_000) return;
  try {
    try {
      localStorage.setItem(`tts_v3_${key}`, JSON.stringify(clip));
    } catch {
      const keys: Array<{ k: string; ts: number }> = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('tts_v3_') || k.startsWith('tts_'))) {
          try {
            const item = JSON.parse(localStorage.getItem(k) || '{}');
            keys.push({ k, ts: Number(item.ts) || 0 });
          } catch {
            keys.push({ k, ts: 0 });
          }
        }
      }
      keys.sort((a, b) => a.ts - b.ts);
      for (const item of keys.slice(0, Math.max(1, Math.ceil(keys.length / 2)))) {
        localStorage.removeItem(item.k);
      }
      try {
        localStorage.setItem(`tts_v3_${key}`, JSON.stringify(clip));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeDarijaForSpeech(raw: string): string {
  return raw
    .replace(/مرحبا بكم?/g, 'مرحبا بيك')
    .replace(/ف\s*تطبيق/g, 'ف فاهم بلان')
    .replace(/في\s+تطبيق/g, 'ف فاهم بلان')
    .replace(/كيف\s+حالك/g, 'كيداير؟')
    .replace(/كيف\s+الأحوال/g, 'لاباس عليك؟')
    .replace(/أهلا\s+بك/g, 'مرحبا بيك')
    .replace(/من\s+فضلك|الرجاء/g, 'عافاك')
    .replace(/شكرا\s+لك/g, 'بارك الله فيك')
    .replace(/[*#_`~•]/g, ' ')
    .replace(/م²|m²|m2/gi, ' متر مربع ')
    .replace(/م³|m³|m3/gi, ' متر مكعب ')
    .replace(/Ø|Φ/g, ' قطر ')
    .replace(/\bcm\b|سم/gi, ' سنتيم ')
    .replace(/\bmm\b|مم/gi, ' ميليمتر ')
    .replace(/R\+(\d+)/gi, ' سفلي و $1 طوابق ')
    .replace(/%/g, ' في المئة ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickArabicVoice(
  voices: SpeechSynthesisVoice[],
  preferFemale: boolean
): { voice: SpeechSynthesisVoice | null; matchedGender: boolean } {
  const arVoices = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith('ar'));
  if (arVoices.length === 0) return { voice: null, matchedGender: false };

  const femaleRx =
    /salma|sana|laila|leila|hoda|zariyah|fatima|amina|noura|mariam|maryam|rana|amira|samira|kenza|nour|female|woman|wavenet-a|wavenet-d|standard-a|standard-d|neural2-a|neural2-d/i;
  const maleRx =
    /shakir|maged|majed|tarik|tariq|naayf|hamed|hamdan|omar|ali|ahmed|ahmad|karim|male|man|wavenet-b|wavenet-c|standard-b|standard-c|neural2-b|neural2-c/i;

  const score = (v: SpeechSynthesisVoice) => {
    const lang = (v.lang || '').toLowerCase();
    const name = (v.name || '').toLowerCase();
    let s = 0;
    if (name.includes('natural') || name.includes('online') || name.includes('google')) s += 4;
    if (lang === 'ar-ma') s += 3;
    else if (lang === 'ar-eg' || lang === 'ar-sa') s += 2;
    else s += 1;
    return s;
  };

  const sorted = [...arVoices].sort((a, b) => score(b) - score(a));
  if (preferFemale) {
    const match = sorted.find((v) => femaleRx.test(v.name || ''));
    return match
      ? { voice: match, matchedGender: true }
      : { voice: sorted.find((v) => !maleRx.test(v.name || '')) || sorted[0], matchedGender: false };
  }
  const match = sorted.find((v) => maleRx.test(v.name || ''));
  return match
    ? { voice: match, matchedGender: true }
    : { voice: sorted.find((v) => !femaleRx.test(v.name || '')) || sorted[0], matchedGender: false };
}

function splitSpeechChunks(text: string, maxLen = 155): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  if (cleaned.length <= maxLen) return [cleaned];

  const sentences = cleaned.split(/(?<=[.،,!؟?\n])\s+/);
  const chunks: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (!s) continue;
    if (`${cur} ${s}`.trim().length <= maxLen) {
      cur = `${cur} ${s}`.trim();
    } else {
      if (cur) chunks.push(cur);
      if (s.length <= maxLen) {
        cur = s;
      } else {
        const words = s.split(' ');
        let wBuf = '';
        for (const w of words) {
          if (`${wBuf} ${w}`.trim().length <= maxLen) {
            wBuf = `${wBuf} ${w}`.trim();
          } else {
            if (wBuf) chunks.push(wBuf);
            wBuf = w;
          }
        }
        cur = wBuf;
      }
    }
  }
  if (cur) chunks.push(cur);
  return chunks;
}

interface SpeakOptions {
  id?: string;
  forcePlay?: boolean;
  useCloudTts?: boolean;
  voiceGender?: 'male' | 'female';
  speechRate?: number;
}

interface SpeakResult {
  ok: boolean;
  usedFallback?: boolean;
  stopped?: boolean;
  reason?: string;
  message?: string;
}

interface SpeechContextValue {
  settings: VoiceSettings;
  updateSettings: (patch: Partial<VoiceSettings>) => void;
  isSpeaking: boolean;
  isLoadingAudio: boolean;
  activeSpeechId: string | null;
  previewVoice: 'boy' | 'girl' | null;
  isConfirmingVoice: boolean;
  previewVoiceSelection: (
    voice: 'boy' | 'girl',
    sampleText: string,
    id: string,
    useCloudTts?: boolean
  ) => void;
  confirmVoiceSelection: (useCloudTts?: boolean) => Promise<'boy' | 'girl' | null>;
  speakPro: (text: string, options?: SpeakOptions) => Promise<SpeakResult>;
  unlockAudio: () => void;
  stop: () => void;
}

const SpeechContext = createContext<SpeechContextValue | null>(null);

export const SpeechProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const savedVoice = localStorage.getItem(SELECTED_VOICE_KEY);
      const raw = localStorage.getItem(VOICE_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          voiceEnabled: typeof parsed.voiceEnabled === 'boolean' ? parsed.voiceEnabled : true,
          voiceGender:
            savedVoice === 'boy'
              ? 'male'
              : savedVoice === 'girl'
                ? 'female'
                : parsed.voiceGender === 'male'
                  ? 'male'
                  : 'female',
          speechRate: typeof parsed.speechRate === 'number' ? parsed.speechRate : 0.95,
        };
      }
      if (savedVoice === 'boy') return { ...DEFAULT_SETTINGS, voiceGender: 'male' };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [activeSpeechId, setActiveSpeechId] = useState<string | null>(null);
  const [previewVoice, setPreviewVoice] = useState<'boy' | 'girl' | null>(null);
  const [isConfirmingVoice, setIsConfirmingVoice] = useState(false);
  const [toast, setToast] = useState<{ text: string; tone: 'ok' | 'err' } | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const bufferSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const quotaCooldownUntilRef = useRef<number>(0);
  const requestSeqRef = useRef(0);

  const showToast = useCallback((text: string, tone: 'ok' | 'err') => {
    setToast({ text, tone });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3000);
  }, []);

  const audioUnlockedRef = useRef(false);

  const ensureAudioContext = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioCtx();
      audioUnlockedRef.current = false;
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
    }
    if (!audioUnlockedRef.current) {
      try {
        const buf = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(ctx.destination);
        src.start(0);
        audioUnlockedRef.current = true;
      } catch {
        // ignore
      }
    }
    return ctx;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onGesture = () => {
      ensureAudioContext();
    };
    window.addEventListener('pointerdown', onGesture, { capture: true, passive: true });
    window.addEventListener('touchstart', onGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onGesture, { capture: true, passive: true });
    return () => {
      window.removeEventListener('pointerdown', onGesture, { capture: true });
      window.removeEventListener('touchstart', onGesture, { capture: true });
      window.removeEventListener('keydown', onGesture, { capture: true });
    };
  }, [ensureAudioContext]);

  const updateSettings = useCallback((patch: Partial<VoiceSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const stop = useCallback(() => {
    requestSeqRef.current += 1;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (bufferSourceRef.current) {
      try {
        bufferSourceRef.current.onended = null;
        bufferSourceRef.current.stop();
        bufferSourceRef.current.disconnect();
      } catch {
        // ignore
      }
      bufferSourceRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.removeAttribute('src');
      } catch {
        // ignore
      }
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
    setIsSpeaking(false);
    setIsLoadingAudio(false);
    setActiveSpeechId(null);
  }, []);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  const playBase64Audio = useCallback(
    async (b64: string, mimeType: string, speechId: string, seq: number, rate: number): Promise<boolean> => {
      if (requestSeqRef.current !== seq) return false;
      const clampedRate = Math.min(1.3, Math.max(0.75, Number(rate) || 0.95));
      const bytes = base64ToBytes(b64);
      const wavBuffer = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(wavBuffer).set(bytes);

      // 1) Try already-unlocked AudioContext first (immune to async fetch autoplay blocks inside iframes)
      const ctx = ensureAudioContext();
      if (ctx) {
        try {
          if (ctx.state === 'suspended') {
            await Promise.race([
              ctx.resume().catch(() => undefined),
              new Promise<void>((r) => setTimeout(r, 350)),
            ]);
          }
          if (ctx.state === 'running') {
            const decoded = await ctx.decodeAudioData(wavBuffer.slice(0));
            if (requestSeqRef.current !== seq) return false;

            const src = ctx.createBufferSource();
            src.buffer = decoded;
            src.playbackRate.value = clampedRate;
            src.connect(ctx.destination);
            bufferSourceRef.current = src;
            setIsLoadingAudio(false);
            setIsSpeaking(true);
            setActiveSpeechId(speechId);

            await new Promise<void>((resolve) => {
              let done = false;
              const finish = () => {
                if (done) return;
                done = true;
                if (bufferSourceRef.current === src) bufferSourceRef.current = null;
                if (requestSeqRef.current === seq) {
                  setIsSpeaking(false);
                  setActiveSpeechId(null);
                }
                resolve();
              };
              src.onended = finish;
              src.start(0);
              const expectedMs = Math.max(1500, Math.ceil((decoded.duration / clampedRate) * 1000) + 800);
              setTimeout(finish, expectedMs);
            });
            return true;
          }
        } catch {
          // fall through to HTMLAudioElement
        }
      }

      if (requestSeqRef.current !== seq) return false;

      // 2) Fallback: HTMLAudioElement with Blob URL
      const blob = new Blob([wavBuffer], {
        type: mimeType || 'audio/wav',
      });
      const blobUrl = URL.createObjectURL(blob);
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = blobUrl;

      try {
        const audio = new Audio(blobUrl);
        audioRef.current = audio;
        audio.playbackRate = clampedRate;
        setIsLoadingAudio(false);
        setIsSpeaking(true);
        setActiveSpeechId(speechId);

        const played = await new Promise<boolean>((resolve) => {
          let settled = false;
          const finish = (ok: boolean) => {
            if (settled) return;
            settled = true;
            if (audioRef.current === audio) audioRef.current = null;
            if (ok && requestSeqRef.current === seq) {
              setIsSpeaking(false);
              setActiveSpeechId(null);
            }
            resolve(ok);
          };
          audio.onended = () => finish(true);
          audio.onerror = () => finish(false);
          audio.play().catch(() => finish(false));
        });

        if (played || requestSeqRef.current !== seq) return played;
      } catch {
        // ignore
      }

      if (requestSeqRef.current === seq) {
        setIsLoadingAudio(false);
        setIsSpeaking(false);
        setActiveSpeechId(null);
      }
      return false;
    },
    [ensureAudioContext]
  );

  const speakWithBrowser = useCallback(
    async (cleanText: string, preferFemale: boolean, rate: number, seq: number): Promise<SpeakResult> => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window) || requestSeqRef.current !== seq) {
        setIsSpeaking(false);
        setIsLoadingAudio(false);
        setActiveSpeechId(null);
        return { ok: false, usedFallback: true, message: 'المتصفح لا يدعم الصوت.' };
      }

      try {
        window.speechSynthesis.cancel();
        let voices = window.speechSynthesis.getVoices();
        if (voices.length === 0) {
          await new Promise<void>((resolve) => {
            let done = false;
            const finish = () => {
              if (!done) {
                done = true;
                resolve();
              }
            };
            window.speechSynthesis.addEventListener?.('voiceschanged', finish, { once: true });
            setTimeout(finish, 180);
          });
          voices = window.speechSynthesis.getVoices();
        }
        if (requestSeqRef.current !== seq) return { ok: false, stopped: true };

        const { voice, matchedGender } = pickArabicVoice(voices, preferFemale);
        const chunks = splitSpeechChunks(cleanText, 155);
        if (chunks.length === 0) return { ok: false, usedFallback: true };

        setIsLoadingAudio(false);
        setIsSpeaking(true);

        const clampedRate = Math.min(1.15, Math.max(0.8, Number(rate) || 0.95));
        const pitch = matchedGender ? 1 : preferFemale ? 1.08 : 0.92;

        window.speechSynthesis.resume?.();
        for (const chunk of chunks) {
          if (requestSeqRef.current !== seq) return { ok: false, stopped: true };
          const ok = await new Promise<boolean>((resolve) => {
            let done = false;
            const settle = (val: boolean) => {
              if (done) return;
              done = true;
              resolve(val);
            };
            const utter = new SpeechSynthesisUtterance(chunk);
            utter.lang = voice?.lang || 'ar-MA';
            if (voice) utter.voice = voice;
            utter.rate = clampedRate;
            utter.pitch = pitch;
            utter.onend = () => settle(true);
            utter.onerror = () => settle(false);
            window.speechSynthesis.speak(utter);
            setTimeout(() => settle(false), Math.max(4500, chunk.length * 140));
          });
          if (!ok || requestSeqRef.current !== seq) break;
        }

        if (requestSeqRef.current === seq) {
          setIsSpeaking(false);
          setActiveSpeechId(null);
        }
        return { ok: true, usedFallback: true };
      } catch {
        if (requestSeqRef.current === seq) {
          setIsSpeaking(false);
          setIsLoadingAudio(false);
          setActiveSpeechId(null);
        }
        return { ok: false, usedFallback: true };
      }
    },
    []
  );

  const speakPro = useCallback(
    async (text: string, options: SpeakOptions = {}): Promise<SpeakResult> => {
      const cleanText = normalizeDarijaForSpeech(text);
      if (!cleanText) return { ok: false };

      const speechId = options.id || `speech-${Date.now()}`;
      if (!options.forcePlay && (isSpeaking || isLoadingAudio) && activeSpeechId === speechId) {
        stop();
        return { ok: true, stopped: true };
      }

      if (!settings.voiceEnabled && !options.forcePlay) {
        updateSettings({ voiceEnabled: true });
      }

      stop();
      // Unlock AudioContext immediately while still inside the user click gesture!
      ensureAudioContext();

      const seq = requestSeqRef.current;
      const gender = options.voiceGender || settings.voiceGender;
      const voiceName = gender === 'male' ? 'Charon' : 'Kore';
      const rate = options.speechRate || settings.speechRate;
      const shouldTryCloud = options.useCloudTts !== false;

      setActiveSpeechId(speechId);

      if (!shouldTryCloud) {
        return await speakWithBrowser(cleanText, gender === 'female', rate, seq);
      }

      const clippedText = cleanText.slice(0, 1400);
      const cacheKey = `${TTS_MODEL_NAME}::${voiceName}::${clippedText}`;

      // 1) Check instant memory, localStorage, and IndexedDB caches
      const memHit = memoryClipCache.get(cacheKey);
      if (memHit) {
        const played = await playBase64Audio(memHit.b64, memHit.mime, speechId, seq, rate);
        if (played) return { ok: true };
      }
      const lsHit = getFromLocalStorageCache(cacheKey);
      if (lsHit?.b64) {
        memoryClipCache.set(cacheKey, { b64: lsHit.b64, mime: lsHit.mime || 'audio/wav' });
        const played = await playBase64Audio(lsHit.b64, lsHit.mime || 'audio/wav', speechId, seq, rate);
        if (played) return { ok: true };
      }
      const idbHit = await getFromIdb(cacheKey);
      if (requestSeqRef.current !== seq) return { ok: false, stopped: true };
      if (idbHit?.b64) {
        memoryClipCache.set(cacheKey, { b64: idbHit.b64, mime: idbHit.mime || 'audio/wav' });
        const played = await playBase64Audio(idbHit.b64, idbHit.mime || 'audio/wav', speechId, seq, rate);
        if (played) return { ok: true };
      }

      const inQuotaCooldown = Date.now() < quotaCooldownUntilRef.current;
      if (!inQuotaCooldown && (typeof navigator === 'undefined' || navigator.onLine)) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setIsLoadingAudio(true);

        try {
          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: clippedText,
              voiceGender: gender,
              voiceId: voiceName,
              voiceType: voiceName,
            }),
            signal: controller.signal,
          });
          if (requestSeqRef.current !== seq) {
            return { ok: false, stopped: true };
          }
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.ok && data.audioBase64) {
            quotaCooldownUntilRef.current = 0;
            const mime = data.mimeType || 'audio/wav';
            storeClipInCaches(cacheKey, data.audioBase64, mime);
            const played = await playBase64Audio(data.audioBase64, mime, speechId, seq, rate);
            if (played) return { ok: true };
          } else {
            if (res.status === 429 || data.quotaExhausted) {
              quotaCooldownUntilRef.current = Date.now() + 15_000;
            }
            showToast(data.message || 'تعذر تشغيل الصوت السحابي، خدام بصوت المتصفح', 'err');
          }
        } catch (err) {
          if (controller.signal.aborted || requestSeqRef.current !== seq) {
            return { ok: false, stopped: true };
          }
          console.info('[Speech] Cloud TTS fallback:', err);
          showToast('تعذر الاتصال بسيرفر الصوت، خدام بصوت المتصفح', 'err');
        }
      }

      if (requestSeqRef.current !== seq) return { ok: false, stopped: true };
      setIsLoadingAudio(false);
      return await speakWithBrowser(cleanText, gender === 'female', rate, seq);
    },
    [
      isSpeaking,
      isLoadingAudio,
      activeSpeechId,
      settings.voiceEnabled,
      settings.voiceGender,
      settings.speechRate,
      updateSettings,
      stop,
      ensureAudioContext,
      playBase64Audio,
      speakWithBrowser,
      showToast,
    ]
  );

  const previewVoiceSelection = useCallback(
    (voice: 'boy' | 'girl', sampleText: string, id: string, useCloudTts = true) => {
      const changed = previewVoice !== voice;
      setPreviewVoice(voice);
      void speakPro(sampleText, {
        id,
        forcePlay: changed,
        useCloudTts,
        voiceGender: voice === 'girl' ? 'female' : 'male',
      });
    },
    [previewVoice, speakPro]
  );

  const confirmVoiceSelection = useCallback(
    async (useCloudTts = true) => {
      if (!previewVoice || isConfirmingVoice) return null;
      setIsConfirmingVoice(true);
      const chosen = previewVoice;
      try {
        localStorage.setItem(SELECTED_VOICE_KEY, chosen);
      } catch {
        // ignore
      }
      const nextGender = chosen === 'girl' ? 'female' : 'male';
      updateSettings({ voiceGender: nextGender, voiceEnabled: true });
      setPreviewVoice(null);
      await speakPro(chosen === 'girl' ? 'تم اختيار صوت البنت' : 'تم اختيار صوت الولد', {
        id: `confirm-${chosen}`,
        forcePlay: true,
        useCloudTts,
        voiceGender: nextGender,
      });
      setIsConfirmingVoice(false);
      showToast('تم حفظ الصوت', 'ok');
      return chosen;
    },
    [previewVoice, isConfirmingVoice, updateSettings, speakPro, showToast]
  );

  return (
    <SpeechContext.Provider
      value={{
        settings,
        updateSettings,
        isSpeaking,
        isLoadingAudio,
        activeSpeechId,
        previewVoice,
        isConfirmingVoice,
        previewVoiceSelection,
        confirmVoiceSelection,
        speakPro,
        unlockAudio: () => {
          ensureAudioContext();
        },
        stop,
      }}
    >
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 rounded-xl border px-4 py-2.5 text-sm font-extrabold shadow-xl ${
            toast.tone === 'ok'
              ? 'border-emerald-500/40 bg-[#11182c] text-emerald-300'
              : 'border-red-500/40 bg-[#11182c] text-red-300'
          }`}
        >
          {toast.text}
        </div>
      )}
    </SpeechContext.Provider>
  );
};

export function useDarijaSpeech(): SpeechContextValue {
  const ctx = useContext(SpeechContext);
  if (!ctx) throw new Error('useDarijaSpeech must be used inside SpeechProvider');
  return ctx;
}

export const VoiceGenderSwitch: React.FC<{ className?: string; useCloudTts?: boolean }> = ({
  className = '',
  useCloudTts = true,
}) => {
  const { settings, previewVoice, isConfirmingVoice, previewVoiceSelection, confirmVoiceSelection } =
    useDarijaSpeech();
  const active = previewVoice ?? (settings.voiceGender === 'female' ? 'girl' : 'boy');

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-xl border border-white/10 bg-[#11182c] p-1 ${className}`}
      role="group"
      aria-label="اختيار صوت بنت أو ولد"
    >
      <button
        type="button"
        onClick={() =>
          previewVoiceSelection(
            'boy',
            'مرحبا بيك أخويا ف فاهم بلان، كيداير؟ صوت الولد المعلم خدام دابا.',
            'gender-switch-male',
            useCloudTts
          )
        }
        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
          active === 'boy' ? 'bg-[#ff7a1a] text-[#0a0f1e]' : 'text-slate-300 hover:text-white'
        }`}
      >
        ولد
      </button>
      <button
        type="button"
        onClick={() =>
          previewVoiceSelection(
            'girl',
            'مرحبا بيك ف فاهم بلان، كيداير؟ أنا سلمى المهندسة، صوت البنت خدام دابا.',
            'gender-switch-female',
            useCloudTts
          )
        }
        className={`min-h-[36px] px-2.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
          active === 'girl' ? 'bg-[#ff7a1a] text-[#0a0f1e]' : 'text-slate-300 hover:text-white'
        }`}
      >
        بنت
      </button>
      {previewVoice && (
        <button
          type="button"
          disabled={isConfirmingVoice}
          onClick={() => void confirmVoiceSelection(useCloudTts)}
          title="Confirm Selection"
          aria-label="Confirm Selection"
          className="min-h-[36px] px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-[#0a0f1e] text-xs font-extrabold transition-colors whitespace-nowrap"
        >
          {isConfirmingVoice ? '...' : 'تم'}
        </button>
      )}
    </div>
  );
};

export const SpeakButton: React.FC<{
  text: string;
  id: string;
  label?: string;
  compact?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
  useCloudTts?: boolean;
}> = ({
  text,
  id,
  label = 'سمع بالدارجة',
  compact = false,
  variant = 'secondary',
  className = '',
  useCloudTts = true,
}) => {
  const { speakPro, stop, isSpeaking, isLoadingAudio, activeSpeechId, settings } = useDarijaSpeech();
  const isThisSpeaking = isSpeaking && activeSpeechId === id;
  const isThisLoading = isLoadingAudio && activeSpeechId === id;

  const handleClick = () => {
    if (isThisSpeaking || isThisLoading) {
      stop();
    } else {
      void speakPro(text, { id, useCloudTts });
    }
  };

  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 whitespace-nowrap shrink-0 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] active:scale-[0.98]';
  const styles =
    variant === 'primary'
      ? 'bg-[#ff7a1a] text-[#0a0f1e] hover:bg-[#ff8d3b] px-5 py-2.5 text-sm shadow-lg shadow-[#ff7a1a]/15'
      : variant === 'ghost'
        ? 'bg-white/5 text-slate-200 hover:bg-white/10 border border-white/10 px-3.5 py-2 text-xs'
        : 'bg-[#16203a] text-[#ff7a1a] hover:bg-[#1e2b4d] border border-[#ff7a1a]/30 px-4 py-2 text-sm';

  if (!settings.voiceEnabled) {
    return (
      <button
        type="button"
        onClick={handleClick}
        title="ورك باش تشغل الصوت"
        className={`${base} bg-white/5 text-slate-400 border border-white/10 px-3.5 py-2 text-xs ${className}`}
      >
        <VolumeX className="w-4 h-4 shrink-0" />
        {!compact && <span>الصوت موقف</span>}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={isThisSpeaking ? 'حبس الصوت' : label}
      className={`${base} ${styles} ${
        isThisSpeaking ? 'ring-2 ring-[#ff7a1a] bg-[#ff7a1a] text-[#0a0f1e]' : ''
      } ${compact ? 'min-w-[44px] px-3' : ''} ${className}`}
    >
      {isThisLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          {!compact && <span>جاري...</span>}
        </>
      ) : isThisSpeaking ? (
        <>
          <Square className="w-4 h-4 fill-current shrink-0" />
          {!compact && <span>حبس الصوت</span>}
        </>
      ) : (
        <>
          <Volume2 className="w-4 h-4 shrink-0" />
          {!compact && <span>{label}</span>}
        </>
      )}
    </button>
  );
};
