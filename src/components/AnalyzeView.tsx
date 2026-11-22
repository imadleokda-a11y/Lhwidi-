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
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const lastAutoAnalyzedRef = useRef<string | null>(null);

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

  const toggleVoiceQuestion = async () => {
    if (isRecording && mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError('الميكروفون ما مدعومش فهاد المتصفح، كتب سؤالك مباشرة.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size < 400) {
          setMicStatus(null);
          return;
        }
        setIsTranscribing(true);
        setMicStatus('جاري تحويل الصوت لنص بالدارجة...');
        try {
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = typeof reader.result === 'string' ? reader.result : '';
            const res = await fetch('/api/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audioBase64: base64, mimeType: blob.type || 'audio/webm' }),
            });
            const data = await res.json();
            setIsTranscribing(false);
            setMicStatus(null);
            if (res.ok && data.success && data.text) {
              void sendChatQuestion(data.text);
            } else {
              setMicError(data.error || 'تعذر تفريغ الصوت.');
            }
          };
          reader.readAsDataURL(blob);
        } catch {
          setIsTranscribing(false);
          setMicStatus(null);
          setMicError('تعذر معالجة الصوت.');
        }
      };

      recorder.start();
      setIsRecording(true);
      setMicStatus('كانسمع ليك... هضر وسول على البلان ومن بعد ورك على إيقاف.');
    } catch {
      setMicError('تأكد من السماح للميكروفون باش تسول بالصوت.');
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
