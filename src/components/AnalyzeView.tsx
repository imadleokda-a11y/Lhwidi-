import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BookmarkCheck,
  BookmarkPlus,
  Bot,
  Camera,
  ChevronDown,
  ChevronUp,
  Hammer,
  Loader2,
  Mic,
  MicOff,
  Pencil,
  Send,
  Sparkles,
  Upload,
  User,
} from 'lucide-react';
import type { BlueprintAnalysis } from '../types';
import { QUICK_CHAT_QUESTIONS, SAMPLE_PLANS } from '../constants';
import { SpeakButton, useDarijaSpeech, VoiceGenderSwitch } from '../contexts/SpeechContext';
import { useCodeAccess } from '../contexts/CodeContext';

const ANALYSIS_CACHE_KEY = 'fahem_plan_analysis_cache_v1';
const MAX_CACHED_PLANS = 8;
const memAnalysisCache = new Map<string, BlueprintAnalysis>();

function hashString(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `${input.length}_${(h >>> 0).toString(36)}`;
}

function getCachedAnalysis(key: string): BlueprintAnalysis | null {
  const mem = memAnalysisCache.get(key);
  if (mem) return mem;
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    const hit = Array.isArray(arr) ? arr.find((x: { k?: string }) => x?.k === key) : undefined;
    if (hit?.v) {
      memAnalysisCache.set(key, hit.v as BlueprintAnalysis);
      return hit.v as BlueprintAnalysis;
    }
  } catch {
    // ignore
  }
  return null;
}

function setCachedAnalysis(key: string, value: BlueprintAnalysis) {
  memAnalysisCache.set(key, value);
  try {
    const raw = localStorage.getItem(ANALYSIS_CACHE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const filtered = Array.isArray(arr) ? arr.filter((x: { k?: string }) => x?.k !== key) : [];
    filtered.unshift({ k: key, v: value, ts: Date.now() });
    localStorage.setItem(ANALYSIS_CACHE_KEY, JSON.stringify(filtered.slice(0, MAX_CACHED_PLANS)));
  } catch {
    // ignore
  }
}

async function prepareImageForAnalysis(
  src: string
): Promise<{ analysisDataUrl: string; thumbnailDataUrl: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const maxDim = 1024;
        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('تعذر معالجة الصورة'));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const analysisDataUrl = canvas.toDataURL('image/jpeg', 0.72);

        const thumbMax = 640;
        let tw = img.naturalWidth || img.width;
        let th = img.naturalHeight || img.height;
        if (tw > thumbMax || th > thumbMax) {
          const ratio = Math.min(thumbMax / tw, thumbMax / th);
          tw = Math.round(tw * ratio);
          th = Math.round(th * ratio);
        }
        const tCanvas = document.createElement('canvas');
        tCanvas.width = tw;
        tCanvas.height = th;
        const tCtx = tCanvas.getContext('2d');
        if (!tCtx) {
          reject(new Error('تعذر إنشاء مصغرة الصورة'));
          return;
        }
        tCtx.drawImage(img, 0, 0, tw, th);
        let thumbnailDataUrl = tCanvas.toDataURL('image/jpeg', 0.65);
        if (thumbnailDataUrl.length > 230_000) {
          thumbnailDataUrl = tCanvas.toDataURL('image/jpeg', 0.4);
        }
        resolve({ analysisDataUrl, thumbnailDataUrl, mimeType: 'image/jpeg' });
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => reject(new Error('ما قدرناش نقراو هاد الصورة'));
    img.src = src;
  });
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  imageUrl?: string;
  analysis?: BlueprintAnalysis;
}

interface AnalyzeViewProps {
  initialImageSrc: string | null;
  onClearInitialImage: () => void;
  onOpenCamera: () => void;
  onSavePlan: (analysis: BlueprintAnalysis, thumbnail?: string) => Promise<void>;
  onOpenInAnnotator: (imageSrc: string) => void;
  onBack: () => void;
}

export const AnalyzeView: React.FC<AnalyzeViewProps> = ({
  initialImageSrc,
  onClearInitialImage,
  onOpenCamera,
  onSavePlan,
  onOpenInAnnotator,
  onBack,
}) => {
  const { stop, speakPro, unlockAudio, settings } = useDarijaSpeech();
  const { checkAllowanceBeforeAnalysis, consumeTrial } = useCodeAccess();

  const [imageSrc, setImageSrc] = useState<string | null>(initialImageSrc);
  const [compressedSrc, setCompressedSrc] = useState<string | null>(null);
  const [compressedMime, setCompressedMime] = useState('image/jpeg');
  const [thumbnailSrc, setThumbnailSrc] = useState<string | undefined>(undefined);
  const [userNotes, setUserNotes] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<BlueprintAnalysis | null>(null);
  const [showDetails, setShowDetails] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micStatus, setMicStatus] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micAudioCtxRef = useRef<AudioContext | null>(null);
  const silenceIntervalRef = useRef<number | null>(null);
  const srTimeoutRef = useRef<number | null>(null);
  const autoSendTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);
  const hasSpokenRef = useRef(false);
  const manualStopRef = useRef(false);
  const cancelledMicRef = useRef(false);
  const srTranscriptRef = useRef('');
  const srSubmittedRef = useRef(false);
  const srErrorRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastAutoAnalyzedRef = useRef<string | null>(null);
  const sendChatRef = useRef<(overrideText?: string) => Promise<void>>(async () => {});

  useEffect(() => {
    if (initialImageSrc) {
      setImageSrc(initialImageSrc);
      if (lastAutoAnalyzedRef.current !== initialImageSrc) {
        lastAutoAnalyzedRef.current = initialImageSrc;
        void runAnalysis(initialImageSrc, userNotes, false);
      }
      onClearInitialImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialImageSrc]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAnalyzing, isChatLoading]);

  const runAnalysis = async (src: string, notes: string, forceNew = true) => {
    if (!src) return;
    const allowance = await checkAllowanceBeforeAnalysis();
    if (!allowance.ok) {
      setError(allowance.message || 'ساليو التجارب ديال الكود.');
      return;
    }

    stop();
    unlockAudio();
    setError(null);
    setIsAnalyzing(true);
    setSavedSuccess(false);
    setAnalysis(null);

    setMessages([
      {
        id: `user-${Date.now()}`,
        role: 'user',
        text: notes.trim() ? `ها هي صورة البلان ديالي. ${notes.trim()}` : 'قرا ليا هاد البلان وشرحو بالدارجة عافاك.',
        imageUrl: src,
      },
    ]);

    try {
      let payloadImg = compressedSrc || src;
      let payloadMime = compressedMime || 'image/jpeg';
      try {
        const prepared = await prepareImageForAnalysis(src);
        setThumbnailSrc(prepared.thumbnailDataUrl);
        setCompressedSrc(prepared.analysisDataUrl);
        setCompressedMime(prepared.mimeType);
        payloadImg = prepared.analysisDataUrl;
        payloadMime = prepared.mimeType;
      } catch {
        // Fall back to src if canvas preparation fails (e.g., CORS on external image)
      }

      const trimmedNotes = notes.trim();
      const cacheKey = hashString(`${payloadImg}::${trimmedNotes}`);
      let result: BlueprintAnalysis | null = forceNew ? null : getCachedAnalysis(cacheKey);
      const cacheHit = !!result;

      if (!result) {
        const res = await fetch('/api/analyze-plan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: payloadImg,
            imageBase64: payloadImg,
            mimeType: payloadMime,
            userNotes: trimmedNotes,
            notes: trimmedNotes,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success || !data.analysis) {
          throw new Error(data.error || 'تعذر تحليل البلان، عاود حاول.');
        }
        result = data.analysis as BlueprintAnalysis;
        setCachedAnalysis(cacheKey, result);
      }

      setAnalysis(result);
      if (!cacheHit) {
        await consumeTrial();
      }

      const summaryText =
        result.isBlueprint === false
          ? result.darijaSummary || 'هادي ماشي صورة ديال البلان، عافاك صور بلان ديال البناء أو الحديد باش نشرحو ليك.'
          : result.darijaSummary || result.audioScript || 'تم تحليل البلان بالنجاح.';

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        text: summaryText,
        analysis: result,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (settings.voiceEnabled && (result.audioScript || summaryText)) {
        void speakPro(result.audioScript || summaryText, { id: assistantMsg.id, useCloudTts: true });
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'وقع خطأ أثناء تحليل الصورة.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImageSrc(reader.result);
        void runAnalysis(reader.result, userNotes, true);
      }
    };
    reader.readAsDataURL(file);
  };

  const sendChatQuestion = async (overrideText?: string) => {
    const question = (overrideText ?? chatInput).trim();
    if (!question || isChatLoading || isAnalyzing) return;

    unlockAudio();
    setChatInput('');
    setMicError(null);

    const userMsg: ChatMessage = {
      id: `q-${Date.now()}`,
      role: 'user',
      text: question,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/chat-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question,
          imageData: compressedSrc || imageSrc,
          mimeType: compressedMime,
          analysisContext: analysis,
          history: messages.map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر الرد دابا.');
      }
      const replyMsg: ChatMessage = {
        id: `r-${Date.now()}`,
        role: 'assistant',
        text: data.reply,
      };
      setMessages((prev) => [...prev, replyMsg]);
      if (settings.voiceEnabled) {
        void speakPro(data.reply, { id: replyMsg.id, useCloudTts: true });
      }
    } catch (err: unknown) {
      setMicError(err instanceof Error ? err.message : 'تعذر إرسال السؤال.');
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    sendChatRef.current = sendChatQuestion;
  });

  const SILENCE_STOP_MS = 1500;

  const cleanupMicAudio = () => {
    if (silenceIntervalRef.current !== null) {
      window.clearInterval(silenceIntervalRef.current);
      silenceIntervalRef.current = null;
    }
    if (micAudioCtxRef.current) {
      const ctx = micAudioCtxRef.current;
      micAudioCtxRef.current = null;
      ctx.close().catch(() => undefined);
    }
    if (micStreamRef.current) {
      const s = micStreamRef.current;
      micStreamRef.current = null;
      s.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
    }
  };

  const cleanupAllMic = (cancelRecording = false) => {
    if (srTimeoutRef.current !== null) {
      window.clearTimeout(srTimeoutRef.current);
      srTimeoutRef.current = null;
    }
    if (autoSendTimerRef.current !== null) {
      window.clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    cleanupMicAudio();
    if (mediaRecorderRef.current) {
      const rec = mediaRecorderRef.current;
      mediaRecorderRef.current = null;
      if (cancelRecording) {
        cancelledMicRef.current = true;
        rec.ondataavailable = null;
        rec.onstop = null;
        rec.onerror = null;
      }
      if (rec.state !== 'inactive') {
        try {
          rec.stop();
        } catch {
          // ignore
        }
      }
    }
    if (recognitionRef.current) {
      const r = recognitionRef.current;
      recognitionRef.current = null;
      try {
        r.stop();
      } catch {
        // ignore
      }
    }
    setIsRecording(false);
  };

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      cleanupAllMic(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('تعذر قراءة التسجيل الصوتي'));
        }
      };
      reader.onerror = () => reject(new Error('تعذر قراءة التسجيل الصوتي'));
      reader.readAsDataURL(blob);
    });

  const deliverTranscriptAndSend = (rawText: string) => {
    const clean = rawText.replace(/\s+/g, ' ').trim();
    if (!clean) {
      setMicStatus(null);
      setMicError('ما سمعت حتى كلمة واضحة، قرب شوية للميكرو وعاود هضر بالدارجة.');
      return;
    }
    setMicError(null);
    setChatInput(clean);
    setMicStatus(`سمعتك: "${clean}" — كيتصيفط دابا...`);
    if (autoSendTimerRef.current !== null) {
      window.clearTimeout(autoSendTimerRef.current);
    }
    autoSendTimerRef.current = window.setTimeout(() => {
      autoSendTimerRef.current = null;
      setMicStatus(null);
      setChatInput('');
      void sendChatRef.current(clean);
    }, 450);
  };

  const transcribeAudioBlob = async (blob: Blob, mime: string) => {
    if (blob.size < 400) {
      setMicStatus(null);
      setMicError('التسجيل قصير بزاف، عاود ضغط على الميكرو وهضر بالدارجة.');
      return;
    }
    setIsTranscribing(true);
    setMicError(null);
    setMicStatus('سمعتك، دابا كنكتب كلامك بالدارجة...');
    try {
      const audioBase64 = await readBlobAsDataUrl(blob);
      const cleanMime = (mime || blob.type || 'audio/webm').split(';')[0];
      const res = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, mimeType: cleanMime }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) {
        throw new Error(data.error || 'تعذر تحويل الصوت لكتابة، عاود حاول.');
      }
      const text = typeof data.text === 'string' ? data.text.trim() : '';
      setIsTranscribing(false);
      deliverTranscriptAndSend(text);
    } catch (err: unknown) {
      setIsTranscribing(false);
      setMicStatus(null);
      setMicError(
        err instanceof Error && err.message
          ? err.message
          : 'تعذر تحويل الصوت لكتابة، عاود جرب أو كتب سؤالك بيديك.'
      );
    }
  };

  const submitSpeechRecognitionResult = () => {
    if (srSubmittedRef.current) return;
    const text = srTranscriptRef.current.trim();
    srSubmittedRef.current = true;
    cleanupAllMic(true);
    if (text) {
      srTranscriptRef.current = '';
      deliverTranscriptAndSend(text);
    } else {
      setMicStatus(null);
    }
  };

  const scheduleSrSilenceStop = () => {
    if (!hasSpokenRef.current || srSubmittedRef.current || !srTranscriptRef.current.trim()) return;
    if (srTimeoutRef.current !== null) {
      window.clearTimeout(srTimeoutRef.current);
    }
    srTimeoutRef.current = window.setTimeout(() => {
      submitSpeechRecognitionResult();
    }, SILENCE_STOP_MS);
  };

  const startSpeechRecognitionFallback = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => Record<string, unknown>;
      webkitSpeechRecognition?: new () => Record<string, unknown>;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) {
      setMicError('المتصفح ما كيدعمش الميكروفون التلقائي، كتب سؤالك هنا.');
      return;
    }

    srTranscriptRef.current = '';
    hasSpokenRef.current = false;
    srSubmittedRef.current = false;
    manualStopRef.current = false;
    srErrorRef.current = false;
    setChatInput('');
    setMicStatus('هضر بالدارجة دابا... غير تسكت 1.5 ثانية غيتكتب ويتصيفط');

    const langs = ['ar-MA', 'ar-SA', 'ar'];
    const tryLang = (idx: number) => {
      const rec = new SR() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        maxAlternatives: number;
        onresult: ((ev: { results: ArrayLike<{ 0?: { transcript?: string } }> }) => void) | null;
        onspeechend: (() => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.lang = langs[idx];
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      rec.onresult = (ev) => {
        let joined = '';
        for (let i = 0; i < ev.results.length; i++) {
          const piece = ev.results[i]?.[0]?.transcript;
          if (piece) joined += `${piece} `;
        }
        const cleaned = joined.replace(/\s+/g, ' ').trim();
        if (cleaned) {
          hasSpokenRef.current = true;
          srTranscriptRef.current = cleaned;
          setChatInput(cleaned);
          setMicStatus(`سمعتك: "${cleaned}" — غير تسكت 1.5ث غيتصيفط`);
          scheduleSrSilenceStop();
        }
      };

      rec.onspeechend = () => {
        if (hasSpokenRef.current && srTranscriptRef.current.trim()) {
          scheduleSrSilenceStop();
        }
      };

      rec.onerror = (ev) => {
        const code = ev?.error || '';
        if (code === 'language-not-supported' && idx + 1 < langs.length) {
          rec.onresult = null;
          rec.onspeechend = null;
          rec.onerror = null;
          rec.onend = null;
          try {
            rec.stop();
          } catch {
            // ignore
          }
          tryLang(idx + 1);
          return;
        }
        if (code === 'aborted' && (manualStopRef.current || srSubmittedRef.current)) return;
        if (code === 'no-speech' && srTranscriptRef.current.trim()) {
          scheduleSrSilenceStop();
          return;
        }
        srErrorRef.current = true;
        cleanupAllMic(true);
        setMicStatus(null);
        setMicError(
          code === 'not-allowed' || code === 'service-not-allowed'
            ? 'المتصفح منع الميكروفون. عطيه الإذن (Allow) من القفل لي حدا رابط الموقع الفوق.'
            : code === 'audio-capture'
              ? 'ما لقيناش ميكروفون شغال فهاد الجهاز.'
              : code === 'no-speech'
                ? 'ما سمعت حتى كلمة فالميكرو، قرب شوية وعاود هضر بصوت واضح.'
                : 'وقع مشكل فالميكروفون، عاود ضغط على أيقونة الميكرو وهضر بالدارجة.'
        );
      };

      rec.onend = () => {
        if (srSubmittedRef.current || manualStopRef.current || srErrorRef.current) return;
        const text = srTranscriptRef.current.trim();
        if (text) {
          setIsRecording(false);
          recognitionRef.current = null;
          setMicStatus(`سمعتك: "${text}" — غادي يتصيفط بعد 1.5ث...`);
          scheduleSrSilenceStop();
        } else {
          cleanupAllMic(true);
          setMicStatus(null);
          setMicError('الميكروفون حبس قبل ما يسمع كلام واضح. عاود ضغط وهضر نيشان بالدارجة.');
        }
      };

      recognitionRef.current = rec;
      try {
        rec.start();
        setIsRecording(true);
      } catch {
        cleanupAllMic(true);
        setMicStatus(null);
        setMicError('تعذر تشغيل الميكروفون، عاود ضغط على الزر وتأكد من إذن الميكرو.');
      }
    };

    tryLang(0);
  };

  const toggleVoiceQuestion = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      manualStopRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        cleanupMicAudio();
        setIsRecording(false);
        setMicStatus('كنجمع الصوت ونكتبو...');
        try {
          mediaRecorderRef.current.stop();
        } catch {
          cleanupAllMic(true);
          setMicStatus(null);
        }
        return;
      }
      const srText = srTranscriptRef.current.trim();
      cleanupAllMic(true);
      setMicStatus(null);
      if (srText) {
        srSubmittedRef.current = true;
        srTranscriptRef.current = '';
        deliverTranscriptAndSend(srText);
      }
      return;
    }

    stop();
    setError(null);
    setMicError(null);

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === 'undefined'
    ) {
      startSpeechRecognitionFallback();
      return;
    }

    srTranscriptRef.current = '';
    hasSpokenRef.current = false;
    srSubmittedRef.current = false;
    manualStopRef.current = false;
    cancelledMicRef.current = false;
    audioChunksRef.current = [];
    setChatInput('');
    setMicStatus('كنفتح الميكروفون...');

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch (err) {
        if (
          err instanceof DOMException &&
          (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError')
        ) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } else {
          throw err;
        }
      }
    } catch (err) {
      setMicStatus(null);
      const errName = err instanceof DOMException ? err.name : '';
      setMicError(
        errName === 'NotAllowedError' || errName === 'PermissionDeniedError'
          ? 'المتصفح منع الميكروفون. عطيه الإذن (Allow) من القفل لي حدا رابط الموقع الفوق.'
          : errName === 'NotFoundError' || errName === 'DevicesNotFoundError'
            ? 'ما لقيناش ميكروفون شغال فهاد الجهاز.'
            : 'تعذر تشغيل الميكروفون، تأكد من الإذن وعاود ضغط على الزر.'
      );
      return;
    }

    micStreamRef.current = stream;
    const supportedMime =
      (typeof MediaRecorder.isTypeSupported === 'function' &&
        ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/ogg'].find((m) =>
          MediaRecorder.isTypeSupported(m)
        )) ||
      '';

    let recorder: MediaRecorder;
    try {
      const opts: MediaRecorderOptions = { audioBitsPerSecond: 32000 };
      if (supportedMime) opts.mimeType = supportedMime;
      recorder = new MediaRecorder(stream, opts);
    } catch {
      try {
        recorder = supportedMime ? new MediaRecorder(stream, { mimeType: supportedMime }) : new MediaRecorder(stream);
      } catch {
        cleanupMicAudio();
        startSpeechRecognitionFallback();
        return;
      }
    }

    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        audioChunksRef.current.push(ev.data);
      }
    };

    recorder.onerror = () => {
      if (cancelledMicRef.current) return;
      cleanupAllMic(true);
      setMicStatus(null);
      setMicError('وقع مشكل فالتسجيل، عاود ضغط على الميكرو وهضر بالدارجة.');
    };

    recorder.onstop = () => {
      const wasCancelled = cancelledMicRef.current;
      const chunks = audioChunksRef.current;
      audioChunksRef.current = [];
      mediaRecorderRef.current = null;
      cleanupMicAudio();
      setIsRecording(false);
      if (wasCancelled) return;
      if (!hasSpokenRef.current && !manualStopRef.current) {
        setMicStatus(null);
        setMicError('ما سمعت حتى صوت فالميكرو، قرب شوية وعاود هضر بصوت واضح.');
        return;
      }
      const mime = recorder.mimeType || supportedMime || 'audio/webm';
      const blob = new Blob(chunks, { type: mime });
      void transcribeAudioBlob(blob, mime);
    };

    try {
      recorder.start(250);
    } catch {
      cleanupAllMic(true);
      setMicStatus(null);
      setMicError('تعذر بدء تسجيل الصوت، عاود جرب.');
      return;
    }

    setIsRecording(true);
    setMicStatus('هضر بالدارجة دابا... غير تسكت 1.5 ثانية غيتكتب ويتصيفط');

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        micAudioCtxRef.current = ctx;
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => undefined);
        }
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);

        const samples = new Uint8Array(analyser.fftSize);
        const startedAt = Date.now();
        let lastSoundAt = startedAt;
        let speechFrames = 0;
        let noiseFloor = 0.008;

        silenceIntervalRef.current = window.setInterval(() => {
          const activeRec = mediaRecorderRef.current;
          if (!activeRec || activeRec.state === 'inactive') return;

          analyser.getByteTimeDomainData(samples);
          let sumSq = 0;
          for (let i = 0; i < samples.length; i++) {
            const normalized = (samples[i] - 128) / 128;
            sumSq += normalized * normalized;
          }
          const rms = Math.sqrt(sumSq / samples.length);
          const now = Date.now();

          if (!hasSpokenRef.current && rms < 0.035) {
            noiseFloor = noiseFloor * 0.85 + rms * 0.15;
          }
          const startThresh = Math.max(0.015, Math.min(0.05, noiseFloor * 2.4));
          const keepThresh = Math.max(0.011, startThresh * 0.72);

          if (rms >= (hasSpokenRef.current ? keepThresh : startThresh)) {
            speechFrames += 1;
            lastSoundAt = now;
            if (!hasSpokenRef.current && speechFrames >= 2) {
              hasSpokenRef.current = true;
              setMicStatus('كنسمعك... غير تسكت 1.5 ثانية غيتكتب ويتصيفط');
            }
          } else {
            speechFrames = 0;
          }

          if (hasSpokenRef.current && now - lastSoundAt >= SILENCE_STOP_MS) {
            if (silenceIntervalRef.current !== null) {
              window.clearInterval(silenceIntervalRef.current);
              silenceIntervalRef.current = null;
            }
            setMicStatus('سمعتك، كنجمع الصوت...');
            activeRec.stop();
          } else if (!hasSpokenRef.current && now - startedAt >= 9500) {
            cancelledMicRef.current = true;
            cleanupAllMic(true);
            setMicStatus(null);
            setMicError('ما سمعت حتى صوت فالميكرو، قرب شوية وعاود هضر بصوت واضح.');
          } else if (now - startedAt >= 35000) {
            if (silenceIntervalRef.current !== null) {
              window.clearInterval(silenceIntervalRef.current);
              silenceIntervalRef.current = null;
            }
            activeRec.stop();
          }
        }, 60);
      }
    } catch {
      // If WebAudio RMS monitor fails, manual tap-to-stop still works cleanly
    }
  };

  const handleSave = async () => {
    if (!analysis || isSaving || savedSuccess) return;
    setIsSaving(true);
    try {
      await onSavePlan(analysis, thumbnailSrc || compressedSrc || imageSrc || undefined);
      setSavedSuccess(true);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            stop();
            onBack();
          }}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white hover:bg-[#16203a]"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع</span>
        </button>
        <div className="flex items-center gap-2">
          <VoiceGenderSwitch useCloudTts />
          <SpeakButton
            id="analyze-guide-voice"
            variant="ghost"
            label="كيفاش كتخدم؟"
            text="صور البلان بالكاميرا ولا اختار صورة من الهاتف، والذكاء الاصطناعي غادي يقراه ويشرحو ليك بالدارجة المغربية، ومن بعد تقدر تسولو أي سؤال بالصوت ولا بالكتابة."
          />
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#11182c] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-white">
              فهم البلان بالذكاء الاصطناعي والدارجة
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              صور مخطط الدار، الفيلات، أو بلان الحديد والسواري للحصول على شرح مفصل ومواد البناء
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onOpenCamera}
            className="min-h-[48px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-5 py-2.5 text-sm font-extrabold"
          >
            <Camera className="w-4 h-4" />
            <span>صور بالكاميرا</span>
          </button>

          <label className="min-h-[48px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] hover:border-[#ff7a1a] text-white px-5 py-2.5 text-sm font-bold">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>ارفع صورة البلان</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
          </label>

          {!imageSrc &&
            SAMPLE_PLANS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setImageSrc(s.src);
                  void runAnalysis(s.src, userNotes, true);
                }}
                className="min-h-[44px] rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-slate-200"
              >
                تجربة: {s.title}
              </button>
            ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={userNotes}
            onChange={(e) => setUserNotes(e.target.value)}
            placeholder="ملاحظة اختيارية على البلان (مثلا: هادا بلان السواري والضالة، شحال خاصني ديال الحديد؟)"
            className="flex-1 min-h-[44px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#ff7a1a]"
          />
          {imageSrc && (
            <button
              type="button"
              disabled={isAnalyzing}
              onClick={() => void runAnalysis(imageSrc, userNotes, true)}
              className="min-h-[44px] rounded-xl border border-[#ff7a1a]/40 bg-[#ff7a1a]/15 hover:bg-[#ff7a1a] hover:text-[#0a0f1e] text-[#ff7a1a] px-5 py-2 text-sm font-bold whitespace-nowrap transition-colors disabled:opacity-50"
            >
              {isAnalyzing ? 'جاري التحليل...' : 'عاود قرا وحلل البلان'}
            </button>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-950/30 p-4 flex items-start gap-3 text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm leading-relaxed">{error}</div>
          <SpeakButton useCloudTts id="analyze-err-voice" compact variant="ghost" text={error} />
        </div>
      )}

      {messages.length > 0 && (
        <section className="rounded-2xl border border-[#ff7a1a]/30 bg-[#11182c] overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-white/10 bg-[#0d1426] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">
                  دردشة المعلم الذكي — شرح البلان بالدارجة
                </h2>
                <p className="text-xs text-slate-400">
                  {isAnalyzing
                    ? 'المعلم الذكي كيشوف صورة البلان وكيخرج التفاصيل...'
                    : 'سول على فين كاين الحديد، البار، المسافات، أو المواد'}
                </p>
              </div>
            </div>

            {imageSrc && (
              <button
                type="button"
                onClick={() => onOpenInAnnotator(imageSrc)}
                className="min-h-[38px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 text-xs font-bold text-slate-200"
              >
                <Pencil className="w-3.5 h-3.5 text-[#ff7a1a]" />
                <span>رسم على البلان</span>
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-4 max-h-[600px] overflow-y-auto bg-[#0a0f1e]/60">
            {messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 ${isUser ? 'flex-row' : 'flex-row-reverse'}`}
                >
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      isUser
                        ? 'bg-white/10 text-white'
                        : 'bg-[#ff7a1a]/20 border border-[#ff7a1a]/40 text-[#ff7a1a]'
                    }`}
                  >
                    {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                  </div>
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 space-y-3 ${
                      isUser
                        ? 'bg-[#16203a] border border-white/10 text-white'
                        : 'bg-[#11182c] border border-[#ff7a1a]/30 text-slate-100'
                    }`}
                  >
                    {msg.imageUrl && (
                      <img
                        src={msg.imageUrl}
                        alt="صورة البلان المرسلة"
                        referrerPolicy="no-referrer"
                        className="w-full max-w-xs max-h-56 object-contain rounded-xl bg-black border border-white/10"
                      />
                    )}
                    <p className="text-sm sm:text-base leading-relaxed whitespace-pre-line">
                      {msg.text}
                    </p>
                    {!isUser && (
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/10">
                        <SpeakButton
                          useCloudTts
                          id={msg.id}
                          variant="primary"
                          label="سمع بالدارجة"
                          text={msg.analysis?.audioScript || msg.text}
                        />
                        {msg.analysis && msg.analysis.isBlueprint !== false && (
                          <button
                            type="button"
                            disabled={isSaving || savedSuccess}
                            onClick={handleSave}
                            className={`min-h-[40px] inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-extrabold ${
                              savedSuccess
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-white/10 hover:bg-white/20 text-white'
                            }`}
                          >
                            {savedSuccess ? (
                              <>
                                <BookmarkCheck className="w-4 h-4" />
                                <span>تحفظ فالمشاريع</span>
                              </>
                            ) : (
                              <>
                                <BookmarkPlus className="w-4 h-4 text-[#ff7a1a]" />
                                <span>حفظ التحليل</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {(isAnalyzing || isChatLoading) && (
              <div className="flex items-center gap-3 flex-row-reverse">
                <div className="w-9 h-9 rounded-xl bg-[#ff7a1a]/20 border border-[#ff7a1a]/40 text-[#ff7a1a] flex items-center justify-center shrink-0">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="rounded-2xl bg-[#11182c] border border-[#ff7a1a]/25 px-4 py-3 text-sm text-slate-200">
                  {isAnalyzing
                    ? 'المعلم الذكي كيقرا البلان وكيفصل الحديد والغرف بالدارجة...'
                    : 'المعلم الذكي كيكتب ليك الجواب بالدارجة...'}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {analysis && analysis.isBlueprint !== false && (
            <div className="px-4 py-2.5 border-t border-white/10 bg-[#0d1426] flex flex-wrap gap-2">
              {QUICK_CHAT_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={isChatLoading || isAnalyzing}
                  onClick={() => void sendChatQuestion(q)}
                  className="min-h-[34px] rounded-xl border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 hover:bg-[#ff7a1a] hover:text-[#0a0f1e] text-[#ff7a1a] px-3 py-1 text-xs font-bold transition-colors disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {micStatus && (
            <div className="px-4 py-2 border-t border-red-500/30 bg-red-950/35 text-xs font-bold text-red-200 flex items-center gap-2">
              {isTranscribing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#ff7a1a] shrink-0" />
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
              )}
              <span>{micStatus}</span>
            </div>
          )}

          {micError && (
            <div className="px-4 py-2 border-t border-amber-500/35 bg-amber-950/35 text-xs font-bold text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{micError}</span>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendChatQuestion();
            }}
            className="p-3 sm:p-4 border-t border-white/10 bg-[#11182c] flex items-center gap-2"
          >
            <button
              type="button"
              onClick={() => void toggleVoiceQuestion()}
              disabled={isTranscribing || isChatLoading || isAnalyzing}
              aria-label={isRecording ? 'حبس الميكرو وصيفط' : 'سول بالصوت'}
              className={`min-h-[46px] min-w-[46px] rounded-xl flex items-center justify-center shrink-0 transition-colors disabled:opacity-50 ${
                isRecording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'border border-white/15 bg-[#0a0f1e] text-[#ff7a1a] hover:border-[#ff7a1a]'
              }`}
            >
              {isTranscribing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                if (micError) setMicError(null);
              }}
              placeholder="هضر بالميكرو ولا كتب سؤالك على البلان بالدارجة..."
              className="flex-1 min-h-[46px] rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-sm text-white placeholder:text-slate-500 focus:border-[#ff7a1a] focus:outline-none"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || isChatLoading || isAnalyzing}
              className="min-h-[46px] px-4 sm:px-5 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] font-extrabold text-sm inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">صيفط</span>
            </button>
          </form>
        </section>
      )}

      {analysis && analysis.isBlueprint !== false && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          <button
            type="button"
            onClick={() => setShowDetails((v) => !v)}
            className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#11182c] px-5 py-3 flex items-center justify-between text-sm font-bold text-white"
          >
            <span>التفاصيل الكاملة للبلان (الغرف، الحديد، المواد ومراحل العمل)</span>
            {showDetails ? (
              <ChevronUp className="w-4 h-4 text-[#ff7a1a]" />
            ) : (
              <ChevronDown className="w-4 h-4 text-[#ff7a1a]" />
            )}
          </button>

          {showDetails && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-white/10 bg-[#11182c] p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-slate-400">نوع المشروع</p>
                  <p className="text-base font-extrabold text-white mt-1">{analysis.buildingType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">المساحة الإجمالية</p>
                  <p className="text-base font-extrabold text-[#ff7a1a] font-mono-nums mt-1">
                    {analysis.totalAreaSqm}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">عدد الغرف / الأجزاء</p>
                  <p className="text-base font-extrabold text-white font-mono-nums mt-1">
                    {analysis.roomsCount}
                  </p>
                </div>
              </div>

              {analysis.structuralNotes && (
                <div className="rounded-2xl border border-white/10 bg-[#11182c] p-5 space-y-2">
                  <h3 className="text-base font-bold text-[#ff7a1a]">ملاحظات السواري والحديد</h3>
                  <p className="text-sm text-slate-200 leading-relaxed">{analysis.structuralNotes}</p>
                </div>
              )}

              {analysis.rooms?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#11182c] p-5 space-y-3">
                  <h3 className="text-base font-bold text-white">تفصيل الغرف والمساحات</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analysis.rooms.map((room, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-[#0a0f1e] p-3.5 space-y-1"
                      >
                        <p className="text-sm font-bold text-white">{room.name}</p>
                        <p className="text-xs font-mono-nums text-[#ff7a1a]">
                          {room.dimensions} · {room.areaSqm}
                        </p>
                        {room.notes && <p className="text-xs text-slate-400">{room.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.materials?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#11182c] p-5 space-y-3">
                  <h3 className="text-base font-bold text-white">تقدير مواد البناء (السلعة)</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {analysis.materials.map((mat, idx) => (
                      <div
                        key={idx}
                        className="rounded-xl border border-white/10 bg-[#0a0f1e] p-3.5 flex items-center justify-between gap-3"
                      >
                        <div>
                          <p className="text-sm font-bold text-white">{mat.name}</p>
                          {mat.notes && <p className="text-[11px] text-slate-400 mt-0.5">{mat.notes}</p>}
                        </div>
                        <span className="text-sm font-extrabold font-mono-nums text-[#ff7a1a] whitespace-nowrap">
                          {mat.quantity} {mat.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.phases?.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-[#11182c] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <Hammer className="w-4 h-4 text-[#ff7a1a]" />
                    <h3 className="text-base font-bold text-white">مراحل البناء بالترتيب</h3>
                  </div>
                  <div className="space-y-3">
                    {analysis.phases.map((phase) => (
                      <div
                        key={phase.stepNumber}
                        className="rounded-xl border border-white/10 bg-[#0a0f1e] p-4 flex items-start justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-bold text-white">
                            <span className="text-[#ff7a1a] font-mono-nums ml-1.5">
                              0{phase.stepNumber}.
                            </span>
                            {phase.phaseName}
                          </p>
                          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            {phase.explanationDarija}
                          </p>
                        </div>
                        <SpeakButton
                          id={`phase-${phase.stepNumber}`}
                          compact
                          variant="ghost"
                          text={`المرحلة ${phase.stepNumber}: ${phase.phaseName}. ${phase.explanationDarija}`}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {analysis.warnings?.length > 0 && (
                <div className="rounded-2xl border border-amber-500/35 bg-amber-950/20 p-5 space-y-2">
                  <div className="flex items-center gap-2 text-amber-300">
                    <AlertTriangle className="w-4 h-4" />
                    <h3 className="text-base font-bold">تنبيهات مهمة فالشانطي</h3>
                  </div>
                  <ul className="space-y-1.5 text-sm text-amber-100 list-disc list-inside">
                    {analysis.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
};
