import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Camera,
  Compass as CompassIcon,
  Download,
  Mic,
  MicOff,
  QrCode,
  RefreshCw,
  Save,
  Trash2,
  Undo2,
  Upload,
  Loader2,
} from 'lucide-react';
import type { ToolId, VoiceNote } from '../../types';
import { SAMPLE_VILLA_IMAGE } from '../../constants';
import { SpeakButton } from '../../contexts/SpeechContext';
import { postApiJson } from '../../utils/apiClient';

interface FieldSiteToolsProps {
  toolId: ToolId;
  initialDrawImage?: string | null;
  voiceNotes: VoiceNote[];
  onSaveVoiceNote: (title: string, raw: string, structured: string) => Promise<void>;
  onDeleteVoiceNote: (id: string) => Promise<void>;
}

export const FieldSiteTools: React.FC<FieldSiteToolsProps> = ({
  toolId,
  initialDrawImage,
  voiceNotes,
  onSaveVoiceNote,
  onDeleteVoiceNote,
}) => {
  // Digital Spirit Level
  const [tiltX, setTiltX] = useState(0);
  const [tiltY, setTiltY] = useState(0);
  const [hasOrient, setHasOrient] = useState(false);

  // Compass
  const [heading, setHeading] = useState(93);
  const [hasCompass, setHasCompass] = useState(false);

  // Camera Measure
  const [measureImg, setMeasureImg] = useState(SAMPLE_VILLA_IMAGE);
  const [measurePts, setMeasurePts] = useState<{ x: number; y: number }[]>([]);
  const [refMeters, setRefMeters] = useState('1.0');
  const [camLive, setCamLive] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Voice Ideas
  const [rawIdea, setRawIdea] = useState('');
  const [recording, setRecording] = useState(false);
  const [savingIdea, setSavingIdea] = useState(false);
  const [ideaErr, setIdeaErr] = useState<string | null>(null);
  const mediaRecRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Draw Annotator
  const [drawBg, setDrawBg] = useState(initialDrawImage || SAMPLE_VILLA_IMAGE);
  const [penColor, setPenColor] = useState('#ff7a1a');
  const [penWidth, setPenWidth] = useState(6);
  const [isDrawing, setIsDrawing] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const drawCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // QR Project Card
  const [qrProjectName, setQrProjectName] = useState('مشروع بناء منزل R+2');
  const [qrLocation, setQrLocation] = useState('الدار البيضاء · الحي المحمدي');
  const [qrPhone, setQrPhone] = useState('0600000000');
  const [qrNotes, setQrNotes] = useState('رخصة البناء رقم 2026/142 · المعلم حسن');
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    if (initialDrawImage) setDrawBg(initialDrawImage);
  }, [initialDrawImage]);

  useEffect(() => {
    if (toolId !== 'level' && toolId !== 'compass') return;
    const handler = (ev: DeviceOrientationEvent) => {
      if (typeof ev.gamma === 'number' && typeof ev.beta === 'number') {
        setTiltX(Math.max(-45, Math.min(45, ev.gamma)));
        setTiltY(Math.max(-45, Math.min(45, ev.beta)));
        setHasOrient(true);
      }
      const wkHeading = (ev as DeviceOrientationEvent & { webkitCompassHeading?: number })
        .webkitCompassHeading;
      if (typeof wkHeading === 'number') {
        setHeading(Math.round(wkHeading));
        setHasCompass(true);
      } else if (typeof ev.alpha === 'number') {
        setHeading(Math.round((360 - ev.alpha) % 360));
        setHasCompass(true);
      }
    };
    window.addEventListener('deviceorientation', handler);
    return () => window.removeEventListener('deviceorientation', handler);
  }, [toolId]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [toolId]);

  // Draw canvas initialization
  useEffect(() => {
    if (toolId !== 'draw') return;
    const canvas = drawCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      setUndoStack([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    };
    img.src = drawBg;
  }, [toolId, drawBg]);

  // QR generator
  useEffect(() => {
    if (toolId !== 'qr') return;
    const payload = `FAHEM BLAN PROJECT\nالمشروع: ${qrProjectName}\nالموقع: ${qrLocation}\nالهاتف: ${qrPhone}\nملاحظات: ${qrNotes}`;
    QRCode.toDataURL(payload, {
      width: 280,
      margin: 2,
      color: { dark: '#0a0f1e', light: '#ffffff' },
    })
      .then(setQrDataUrl)
      .catch(() => void 0);
  }, [toolId, qrProjectName, qrLocation, qrPhone, qrNotes]);

  if (toolId === 'level') {
    const isLevel = Math.abs(tiltX) <= 1 && Math.abs(tiltY) <= 1;
    const speech = isLevel
      ? 'السطح مقاد نيشان صفر درجة، تقدر تخدم وانت مطمئن.'
      : `كاين ميلان ديال ${tiltX.toFixed(1)} درجة، قاد التليفون حتى توصل للخضر.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">الميزان الرقمي (ميزان الماء)</h2>
            <p className="text-sm text-slate-400">عبر استواء الأرضية، الضالة، والحيوط بالدرجات</p>
          </div>
          <SpeakButton id="tool-level-voice" variant="primary" label="سمع بالدارجة" text={speech} />
        </div>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative w-56 h-56 rounded-full border-4 border-white/15 bg-[#0a0f1e] flex items-center justify-center">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#ff7a1a]/60" />
            <div
              style={{
                transform: `translate(${Math.max(-75, Math.min(75, tiltX * 2.5))}px, ${Math.max(
                  -75,
                  Math.min(75, tiltY * 2.5)
                )}px)`,
              }}
              className={`absolute w-10 h-10 rounded-full transition-transform duration-75 shadow-lg ${
                isLevel ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-[#ff7a1a] shadow-[#ff7a1a]/40'
              }`}
            />
          </div>

          <div className="text-center space-y-1">
            <p className={`text-3xl font-extrabold font-mono-nums ${isLevel ? 'text-emerald-400' : 'text-white'}`}>
              X: {tiltX.toFixed(1)}° · Y: {tiltY.toFixed(1)}°
            </p>
            <p className={`text-sm font-bold ${isLevel ? 'text-emerald-300' : 'text-amber-300'}`}>
              {isLevel ? 'مقاد 100% (Niveau OK)' : 'مازال كاين ميلان'}
            </p>
          </div>

          {!hasOrient && (
            <div className="w-full max-w-md space-y-2 rounded-xl border border-white/10 bg-[#0a0f1e] p-4">
              <p className="text-xs text-slate-300">تجربة يدوية (فالهاتف كيقرا الحساس أوتوماتيكياً):</p>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                value={tiltX}
                onChange={(e) => setTiltX(parseFloat(e.target.value))}
                className="w-full accent-[#ff7a1a]"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (toolId === 'compass') {
    const dirLabel =
      heading < 23 || heading >= 338
        ? 'الشمال (N)'
        : heading < 68
          ? 'الشمال الشرقي (NE)'
          : heading < 113
            ? 'الشرق (E) — شمس الصباح وجهة القبلة'
            : heading < 158
              ? 'الجنوب الشرقي (SE)'
              : heading < 203
                ? 'الجنوب (S) — مشمش النهار كامل'
                : heading < 248
                  ? 'الجنوب الغربي (SW)'
                  : heading < 293
                    ? 'الغرب (W) — شمس العشية'
                    : 'الشمال الغربي (NW)';

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">بوصلة الشانطي والقبلة والشمس</h2>
            <p className="text-sm text-slate-400">
              عرف واجهة الدار والقبلة واتجاه الشمس قبل ما تحط الفاصاد
            </p>
          </div>
          <SpeakButton
            id="tool-compass-voice"
            variant="primary"
            label="سمع الاتجاه بالدارجة"
            text={`الاتجاه دابا هو ${heading} درجة، يعني ${dirLabel}. فالمغرب القبلة تقريباً فـ تلاتة وتسعين درجة شرق، والواجهة اللي كتشوف للجنوب الشرقي كتدخل ليها شمس الصباح مزيان.`}
          />
        </div>

        <div className="flex flex-col items-center gap-6 py-4">
          <div className="relative w-56 h-56 rounded-full border-4 border-white/15 bg-[#0a0f1e] flex items-center justify-center">
            <span className="absolute top-2 text-xs font-bold text-[#ff7a1a]">N</span>
            <span className="absolute bottom-2 text-xs font-bold text-slate-400">S</span>
            <span className="absolute right-3 text-xs font-bold text-slate-400">E</span>
            <span className="absolute left-3 text-xs font-bold text-slate-400">W</span>
            <div
              style={{ transform: `rotate(${heading}deg)` }}
              className="w-24 h-24 flex items-center justify-center transition-transform duration-150"
            >
              <CompassIcon className="w-16 h-16 text-[#ff7a1a]" />
            </div>
          </div>

          <div className="text-center space-y-1">
            <p className="text-3xl font-extrabold font-mono-nums text-white">{heading}°</p>
            <p className="text-base font-bold text-[#ff7a1a]">{dirLabel}</p>
            <p className="text-xs text-slate-400">اتجاه القبلة فالمغرب: ~93° شرق</p>
          </div>

          {!hasCompass && (
            <div className="w-full max-w-md space-y-2 rounded-xl border border-white/10 bg-[#0a0f1e] p-4">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>تدوير البوصلة يدوياً (إلى ما كانش مستشعر):</span>
              </div>
              <input
                type="range"
                min="0"
                max="359"
                value={heading}
                onChange={(e) => setHeading(parseInt(e.target.value, 10))}
                className="w-full accent-[#ff7a1a]"
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  if (toolId === 'camera-measure') {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y);
    const refPx = measurePts.length >= 2 ? dist(measurePts[0], measurePts[1]) : 0;
    const targetPx = measurePts.length >= 4 ? dist(measurePts[2], measurePts[3]) : 0;
    const refM = Math.max(0.05, parseFloat(refMeters) || 1);
    const measured = refPx > 0 && targetPx > 0 ? (targetPx / refPx) * refM : null;

    const statusText =
      measurePts.length < 2
        ? '1. ورك على جوج نقط ديال قياس معروف (مثلا عرض باب = 1 متر)'
        : measurePts.length < 4
          ? '2. دابا ورك على جوج نقط ديال المسافة اللي باغي تعبرها'
          : `القياس التقريبي هو ${measured?.toFixed(2)} متر`;

    const toggleCam = async () => {
      if (camLive) {
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        setCamLive(false);
        return;
      }
      setCamErr(null);
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
        });
        streamRef.current = s;
        setCamLive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = s;
            void videoRef.current.play().catch(() => void 0);
          }
        }, 50);
      } catch {
        setCamErr('تعذر فتح الكاميرا، تقدر تختار صورة مباشرة.');
      }
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">القياس بالكاميرا والصورة</h2>
            <p className="text-sm text-slate-400">علم على مسافة معروفة ومن بعد عبر أي حيط ولا بلان</p>
          </div>
          <SpeakButton
            id="tool-measure-voice"
            variant="primary"
            label="سمع الشرح والنتيجة"
            text={
              measured
                ? `القياس اللي عبرتي كيساوي تقريباً ${measured.toFixed(2)} متر.`
                : 'صور الحيط أو البلان، علم على جوج نقط كتعرف الطول ديالهم بحال باب فيه متر، ومن بعد علم على البلاصة اللي باغي تعبرها.'
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => void toggleCam()}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] px-4 py-2 text-sm font-extrabold"
          >
            <Camera className="w-4 h-4" />
            <span>{camLive ? 'حبس الكاميرا' : 'شعل الكاميرا'}</span>
          </button>

          {camLive && (
            <button
              type="button"
              onClick={() => {
                const v = videoRef.current;
                if (!v) return;
                const c = document.createElement('canvas');
                c.width = v.videoWidth || 1280;
                c.height = v.videoHeight || 720;
                const ctx = c.getContext('2d');
                if (ctx) {
                  ctx.drawImage(v, 0, 0, c.width, c.height);
                  setMeasureImg(c.toDataURL('image/jpeg', 0.9));
                  if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
                  setCamLive(false);
                  setMeasurePts([]);
                }
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-[#0a0f1e] px-4 py-2 text-sm font-extrabold"
            >
              <span>التقط للقياس</span>
            </button>
          )}

          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] text-white px-4 py-2 text-sm font-bold">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>اختار صورة</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                  if (typeof r.result === 'string') {
                    setMeasureImg(r.result);
                    setMeasurePts([]);
                  }
                };
                r.readAsDataURL(f);
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>الطول المرجعي (متر):</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={refMeters}
              onChange={(e) => setRefMeters(e.target.value)}
              className="w-20 min-h-[40px] rounded-lg border border-white/15 bg-[#0a0f1e] px-2.5 text-white font-mono-nums"
            />
          </label>

          <button
            type="button"
            onClick={() => setMeasurePts([])}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
          >
            <RefreshCw className="w-4 h-4" />
            <span>مسح النقط</span>
          </button>
        </div>

        {camErr && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            {camErr}
          </div>
        )}

        <div className="rounded-xl border border-[#ff7a1a]/30 bg-[#0a0f1e] px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-bold text-[#ff7a1a]">{statusText}</span>
          {measured !== null && (
            <span className="text-xl font-extrabold font-mono-nums text-white">
              {measured.toFixed(2)} م
            </span>
          )}
        </div>

        <div
          onClick={(e) => {
            if (camLive) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setMeasurePts((prev) => (prev.length >= 4 ? [{ x, y }] : [...prev, { x, y }]));
          }}
          className="relative w-full rounded-2xl overflow-hidden border border-white/15 bg-black cursor-crosshair select-none"
        >
          {camLive ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-80 sm:h-96 object-cover" />
          ) : (
            <>
              <img
                src={measureImg}
                alt="صورة للقياس"
                referrerPolicy="no-referrer"
                className="w-full max-h-[420px] object-contain mx-auto pointer-events-none"
              />
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {measurePts.length >= 2 && (
                  <line x1={measurePts[0].x} y1={measurePts[0].y} x2={measurePts[1].x} y2={measurePts[1].y} stroke="#38bdf8" strokeWidth="0.7" />
                )}
                {measurePts.length >= 4 && (
                  <line x1={measurePts[2].x} y1={measurePts[2].y} x2={measurePts[3].x} y2={measurePts[3].y} stroke="#ff7a1a" strokeWidth="0.8" />
                )}
                {measurePts.map((pt, idx) => (
                  <circle key={idx} cx={pt.x} cy={pt.y} r="1.4" fill={idx < 2 ? '#38bdf8' : '#ff7a1a'} stroke="#0a0f1e" strokeWidth="0.4" />
                ))}
              </svg>
            </>
          )}
        </div>
      </div>
    );
  }

  if (toolId === 'voice-ideas') {
    const toggleRec = async () => {
      if (recording && mediaRecRef.current) {
        mediaRecRef.current.stop();
        setRecording(false);
        return;
      }
      setIdeaErr(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const rec = new MediaRecorder(stream);
        chunksRef.current = [];
        mediaRecRef.current = rec;
        rec.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = async () => {
            const base64 = typeof reader.result === 'string' ? reader.result : '';
            try {
              const { ok, data } = await postApiJson<{
                success?: boolean;
                text?: string;
                error?: string;
              }>(
                '/api/transcribe',
                { audioBase64: base64, mimeType: (blob.type || 'audio/webm').split(';')[0] },
                { timeoutMs: 19000, retries: 1 }
              );
              if (ok && data.success && data.text) {
                setRawIdea((prev) => `${prev} ${data.text}`.trim());
              } else {
                setIdeaErr(data.error || 'تعذر تحويل الصوت، تقدر تكتب الفكرة مباشرة.');
              }
            } catch (err: unknown) {
              setIdeaErr(
                err instanceof Error ? err.message : 'تعذر تحويل الصوت، تقدر تكتب الفكرة مباشرة.'
              );
            }
          };
          reader.readAsDataURL(blob);
        };
        rec.start();
        setRecording(true);
      } catch {
        setIdeaErr('تأكد من السماح للميكروفون ولا اكتب الفكرة مباشرة.');
      }
    };

    const handleSaveIdea = async () => {
      if (!rawIdea.trim()) return;
      setSavingIdea(true);
      setIdeaErr(null);
      try {
        const { ok, data } = await postApiJson<{
          success?: boolean;
          title?: string;
          structuredDarija?: string;
          error?: string;
        }>('/api/voice-idea-summary', { rawIdea }, { timeoutMs: 19000, retries: 1 });
        if (!ok || data.success === false) {
          throw new Error(data.error || 'تعذر تنظيم الفكرة');
        }
        await onSaveVoiceNote(
          data.title || 'ملاحظة من الشانطي',
          rawIdea,
          data.structuredDarija || rawIdea
        );
        setRawIdea('');
      } catch (err: unknown) {
        setIdeaErr(err instanceof Error ? err.message : 'وقع خطأ فـ حفظ الفكرة');
      } finally {
        setSavingIdea(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">أفكار وملاحظات صوتية للشانطي</h2>
            <p className="text-sm text-slate-400">
              سجل بالصوت أي تعديل ولا طلب ديال السلعة والذكاء كيرتبو ليك
            </p>
          </div>
          <SpeakButton
            id="tool-voice-ideas-intro"
            variant="secondary"
            label="كيفاش كتخدم؟"
            text="ورك على زر الميكروفون وهضر بالدارجة على أي حاجة خاصها فالشانطي، بحال خاصنا عشرين خنشة سيما غدا ولا نبدلو بلاصة الباب، والتطبيق غادي يرتبها ويحفظها ليك."
          />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void toggleRec()}
            className={`min-h-[48px] inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold transition-colors ${
              recording ? 'bg-red-500 text-white' : 'bg-[#ff7a1a] text-[#0a0f1e] hover:bg-[#ff8d3b]'
            }`}
          >
            {recording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            <span>{recording ? 'حبس التسجيل' : 'هضر وسجل بالصوت'}</span>
          </button>

          <textarea
            rows={4}
            value={rawIdea}
            onChange={(e) => setRawIdea(e.target.value)}
            placeholder="مثال: غدا خاصنا نوصيو على 30 خنشة ديال السيما و 2 بوطات ديال البريك 8 تقابي للكوزينة..."
            className="w-full rounded-xl border border-white/10 bg-[#0a0f1e] p-4 text-sm text-white placeholder:text-slate-500 focus:border-[#ff7a1a] focus:outline-none"
          />

          {ideaErr && <p className="text-xs text-amber-300">{ideaErr}</p>}

          <button
            type="button"
            disabled={!rawIdea.trim() || savingIdea}
            onClick={() => void handleSaveIdea()}
            className="min-h-[48px] w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white text-[#0a0f1e] hover:bg-slate-200 px-6 py-3 text-sm font-extrabold disabled:opacity-50"
          >
            {savingIdea ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>{savingIdea ? 'جاري الترتيب والحفظ...' : 'رتب بالدارجة واحفظ'}</span>
          </button>
        </div>

        {voiceNotes.length > 0 && (
          <div className="space-y-3 border-t border-white/10 pt-5">
            <h3 className="text-base font-bold text-white">الأفكار المحفوظة ({voiceNotes.length})</h3>
            <div className="space-y-3">
              {voiceNotes.map((note) => (
                <div key={note.id} className="rounded-xl border border-white/10 bg-[#0a0f1e] p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="font-bold text-[#ff7a1a]">{note.title}</h4>
                    <div className="flex items-center gap-2">
                      <SpeakButton
                        id={`vn-${note.id}`}
                        compact
                        variant="ghost"
                        text={`${note.title}. ${note.structuredDarija}`}
                      />
                      <button
                        type="button"
                        onClick={() => void onDeleteVoiceNote(note.id)}
                        aria-label="حذف الملاحظة"
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/5 text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <p className="text-sm text-slate-200 whitespace-pre-line leading-relaxed">
                    {note.structuredDarija}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (toolId === 'draw') {
    const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      const c = drawCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const rect = c.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * c.width;
      const y = ((e.clientY - rect.top) / rect.height) * c.height;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsDrawing(true);
    };

    const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const c = drawCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx) return;
      const rect = c.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * c.width;
      const y = ((e.clientY - rect.top) / rect.height) * c.height;
      ctx.lineTo(x, y);
      ctx.stroke();
    };

    const endDraw = () => {
      if (!isDrawing) return;
      setIsDrawing(false);
      const c = drawCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (c && ctx) {
        setUndoStack((prev) => [...prev.slice(-15), ctx.getImageData(0, 0, c.width, c.height)]);
      }
    };

    const handleUndo = () => {
      const c = drawCanvasRef.current;
      const ctx = c?.getContext('2d');
      if (!c || !ctx || undoStack.length <= 1) return;
      const next = undoStack.slice(0, -1);
      ctx.putImageData(next[next.length - 1], 0, 0);
      setUndoStack(next);
    };

    const handleDownload = () => {
      const c = drawCanvasRef.current;
      if (!c) return;
      const a = document.createElement('a');
      a.href = c.toDataURL('image/png');
      a.download = `fahem-blan-markup-${Date.now()}.png`;
      a.click();
    };

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">الرسم والتعديل على البلان</h2>
            <p className="text-sm text-slate-400">
              علم بالألوان فوق الصورة باش توري للمعلم فين يدوز الجعاب ولا السواري
            </p>
          </div>
          <SpeakButton
            id="tool-draw-voice"
            variant="primary"
            label="سمع الشرح"
            text="هنا تقدر ترسم بصبعك فوق البلان باش تعلم البلايص اللي بغيتي تبدل، بحال بلاصة الباب ولا الجعاب، ومن بعد تحمل الصورة وتصيفطها للمعلم."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl bg-[#16203a] border border-white/15 px-4 py-2 text-xs font-bold text-white">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>بدل الصورة</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = new FileReader();
                r.onload = () => {
                  if (typeof r.result === 'string') setDrawBg(r.result);
                };
                r.readAsDataURL(f);
              }}
            />
          </label>

          <div className="flex items-center gap-2">
            {['#ff7a1a', '#38bdf8', '#22c55e', '#ffffff'].map((col) => (
              <button
                key={col}
                type="button"
                aria-label={`لون ${col}`}
                onClick={() => setPenColor(col)}
                style={{ backgroundColor: col }}
                className={`w-9 h-9 rounded-full border-2 ${
                  penColor === col ? 'border-white scale-110' : 'border-transparent'
                }`}
              />
            ))}
          </div>

          <select
            value={penWidth}
            onChange={(e) => setPenWidth(Number(e.target.value))}
            className="min-h-[40px] rounded-lg border border-white/15 bg-[#0a0f1e] px-3 text-xs text-white"
          >
            <option value={3}>خط رقيق</option>
            <option value={6}>خط متوسط</option>
            <option value={11}>خط غليظ</option>
          </select>

          <button
            type="button"
            onClick={handleUndo}
            disabled={undoStack.length <= 1}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 px-3.5 py-2 text-xs font-semibold text-slate-200 disabled:opacity-40"
          >
            <Undo2 className="w-4 h-4" />
            <span>تراجع</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] px-4 py-2 text-xs font-extrabold"
          >
            <Download className="w-4 h-4" />
            <span>تحميل الصورة</span>
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/15 bg-black">
          <canvas
            ref={drawCanvasRef}
            width={960}
            height={680}
            onPointerDown={startDraw}
            onPointerMove={moveDraw}
            onPointerUp={endDraw}
            onPointerLeave={endDraw}
            className="w-full h-auto touch-none cursor-crosshair"
          />
        </div>
      </div>
    );
  }

  // QR project card
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">بطاقة QR لمعلومات المشروع</h2>
          <p className="text-sm text-slate-400">
            اصنع كود QR فيها سمية المشروع والهاتف والملاحظات باش تلصقها فالشانطي
          </p>
        </div>
        <SpeakButton
          id="tool-qr-voice"
          variant="primary"
          label="سمع الشرح"
          text="هنا تقدر تصاوب بطاقة فيها كود كي آر ديال المشروع ديالك، فيه العنوان ورقم الهاتف، تقدر تطبعها وتلصقها فباب الشانطي."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        <div className="md:col-span-7 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">سمية المشروع</span>
            <input
              type="text"
              value={qrProjectName}
              onChange={(e) => setQrProjectName(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-sm text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">المدينة / العنوان</span>
            <input
              type="text"
              value={qrLocation}
              onChange={(e) => setQrLocation(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-sm text-white"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">هاتف المقاول أو صاحب المشروع</span>
            <input
              type="text"
              dir="ltr"
              value={qrPhone}
              onChange={(e) => setQrPhone(e.target.value)}
              className="w-full min-h-[46px] rounded-xl border border-white/10 bg-[#0a0f1e] px-4 text-sm text-white font-mono-nums"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-slate-300">ملاحظات الورشة</span>
            <textarea
              rows={3}
              value={qrNotes}
              onChange={(e) => setQrNotes(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0a0f1e] p-3.5 text-sm text-white"
            />
          </label>
        </div>

        <div className="md:col-span-5 rounded-2xl border border-[#ff7a1a]/35 bg-[#0a0f1e] p-6 text-center space-y-4">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="QR كود المشروع"
              className="w-56 h-56 mx-auto rounded-2xl bg-white p-2"
            />
          ) : (
            <div className="w-56 h-56 mx-auto rounded-2xl bg-white/5 flex items-center justify-center">
              <QrCode className="w-12 h-12 text-[#ff7a1a]" />
            </div>
          )}
          <div className="space-y-1">
            <p className="text-sm font-bold text-white">{qrProjectName}</p>
            <p className="text-xs text-slate-400">{qrLocation}</p>
          </div>
          {qrDataUrl && (
            <a
              href={qrDataUrl}
              download={`fahem-blan-qr-${Date.now()}.png`}
              className="w-full min-h-[44px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] text-xs font-extrabold"
            >
              <Download className="w-4 h-4" />
              <span>تحميل كود QR</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
};
