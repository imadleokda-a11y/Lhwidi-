import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Magnet,
  Mic,
  MicOff,
  Ruler,
  ScanLine,
  Upload,
} from 'lucide-react';
import type { CrackDiagnosis, ToolId } from '../../types';
import { SpeakButton, useDarijaSpeech } from '../../contexts/SpeechContext';
import { useCodeAccess } from '../../contexts/CodeContext';
import { postApiJson } from '../../utils/apiClient';

export const SmartSiteTools: React.FC<{ toolId: ToolId }> = ({ toolId }) => {
  const { speakPro, unlockAudio, settings } = useDarijaSpeech();
  const { checkAllowanceBeforeAnalysis, consumeTrial } = useCodeAccess();

  // Metal detector
  const [magValue, setMagValue] = useState(46);
  const [magBaseline, setMagBaseline] = useState(46);
  const [hasMagSensor, setHasMagSensor] = useState(false);
  const [beepOn, setBeepOn] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Laser level
  const [laserMode, setLaserMode] = useState<'cross' | 'horizontal' | 'vertical'>('cross');
  const [gamma, setGamma] = useState(0);
  const [beta, setBeta] = useState(90);
  const [laserCam, setLaserCam] = useState(false);

  // AR meter
  const [arMode, setArMode] = useState<'camera' | 'photo'>('camera');
  const [arPoints, setArPoints] = useState<{ x: number; y: number }[]>([]);
  const [arRefMeters, setArRefMeters] = useState('1.0');
  const [arPhoto, setArPhoto] = useState<string | null>(null);

  // Crack detector
  const [crackImg, setCrackImg] = useState<string | null>(null);
  const [crackLoading, setCrackLoading] = useState(false);
  const [crackErr, setCrackErr] = useState<string | null>(null);
  const [crackResult, setCrackResult] = useState<CrackDiagnosis | null>(null);

  // Acoustic leak detector
  const [leakRunning, setLeakRunning] = useState(false);
  const [leakDb, setLeakDb] = useState(34);
  const [leakErr, setLeakErr] = useState<string | null>(null);
  const leakRafRef = useRef<number | null>(null);
  const leakAudioCtxRef = useRef<AudioContext | null>(null);
  const leakStreamRef = useRef<MediaStream | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCamActive(false);
  };

  const startCameraStream = async () => {
    setCamErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamErr('الكاميرا المباشرة ما مدعوماش فهاد المتصفح.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCamActive(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => void 0);
        }
      }, 60);
    } catch {
      setCamErr('ما قدرناش نشغلو الكاميرا. تأكد من الإذن أو جرب رفع صورة.');
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      if (leakRafRef.current) cancelAnimationFrame(leakRafRef.current);
      if (leakStreamRef.current) leakStreamRef.current.getTracks().forEach((t) => t.stop());
      if (leakAudioCtxRef.current) void leakAudioCtxRef.current.close();
    };
  }, [toolId]);

  // Magnetometer listener
  useEffect(() => {
    if (toolId !== 'metal-detector') return;
    const MagCtor = (window as unknown as { Magnetometer?: new (opts?: { frequency?: number }) => {
      x: number;
      y: number;
      z: number;
      start: () => void;
      stop: () => void;
      addEventListener: (e: string, cb: () => void) => void;
    } }).Magnetometer;
    if (!MagCtor) return;
    try {
      const sensor = new MagCtor({ frequency: 10 });
      sensor.addEventListener('reading', () => {
        const mag = Math.round(Math.hypot(sensor.x || 0, sensor.y || 0, sensor.z || 0));
        setMagValue(mag);
        setHasMagSensor(true);
      });
      sensor.start();
      return () => sensor.stop();
    } catch {
      // fallback manual slider
    }
  }, [toolId]);

  // Device orientation for laser level
  useEffect(() => {
    if (toolId !== 'laser-level') return;
    const onOrient = (ev: DeviceOrientationEvent) => {
      if (typeof ev.gamma === 'number') setGamma(ev.gamma);
      if (typeof ev.beta === 'number') setBeta(ev.beta);
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [toolId]);

  // Beep sound for metal detector
  useEffect(() => {
    if (toolId !== 'metal-detector' || !beepOn) return;
    const delta = Math.abs(magValue - magBaseline);
    if (delta < 18) return;
    const id = window.setInterval(() => {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        setTimeout(() => {
          osc.stop();
          void ctx.close();
        }, 90);
      } catch {
        // ignore
      }
    }, 450);
    return () => window.clearInterval(id);
  }, [toolId, beepOn, magValue, magBaseline]);

  if (toolId === 'metal-detector') {
    const delta = Math.abs(magValue - magBaseline);
    const detected = delta >= 18;
    const pct = Math.min(100, Math.round((delta / 80) * 100));
    const speech = detected
      ? `انتباه! كاين حديد أو سلك كهربائي قريب على بعد أقل من خمسة سنتيمتر، قوة المغناطيس ${magValue} ميكروتسلا.`
      : `البلاصة نقية، ما كاين حتى حديد قريب، القراءة العادية هي ${magValue} ميكروتسلا.`;

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              كاشف الحديد (عمق 5 سم + فيديو مباشر)
            </h2>
            <p className="text-sm text-slate-400">
              وجه الكاميرا وقرب التليفون للحيط أو السارية باش تشوف وتكتشف الحديد قبل ما تثقب
            </p>
          </div>
          <SpeakButton id="smart-metal-voice" variant="primary" label="سمع النتيجة بالدارجة" text={speech} />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (camActive ? stopCameraStream() : void startCameraStream())}
            className={`min-h-[44px] inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-extrabold ${
              camActive ? 'bg-emerald-500 text-[#0a0f1e]' : 'bg-[#ff7a1a] text-[#0a0f1e]'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{camActive ? 'الكاميرا المباشرة شغالة (إيقاف)' : 'شعل الكاميرا المباشرة (طلب الإذن)'}</span>
          </button>

          <button
            type="button"
            onClick={() => setMagBaseline(magValue)}
            className="min-h-[44px] rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-xs font-bold text-white hover:border-[#ff7a1a]"
          >
            تصفير المعايرة
          </button>

          <button
            type="button"
            onClick={() => setBeepOn((v) => !v)}
            className={`min-h-[44px] rounded-xl px-4 text-xs font-extrabold transition-colors ${
              beepOn ? 'bg-[#ff7a1a] text-[#0a0f1e]' : 'bg-white/10 text-slate-200'
            }`}
          >
            {beepOn ? 'صوت التنبيه: مشعل' : 'شعل صوت التنبيه'}
          </button>
        </div>

        {camErr && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-200">
            <span>{camErr}</span>
            <button
              type="button"
              onClick={() => void startCameraStream()}
              className="rounded-lg bg-[#ff7a1a] text-[#0a0f1e] px-3 py-1.5 font-extrabold"
            >
              اطلب إذن الكاميرا
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch">
          <div className="md:col-span-7 relative min-h-[280px] rounded-2xl border border-white/15 bg-black overflow-hidden flex items-center justify-center">
            {camActive ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full max-h-[360px] object-cover"
              />
            ) : (
              <div className="p-6 text-center space-y-3">
                <Camera className="w-10 h-10 text-[#ff7a1a] mx-auto" />
                <p className="text-xs text-slate-300">شعل الكاميرا المباشرة باش تشوف البلاصة اللي كتفحصها</p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div
                className={`w-36 h-36 rounded-full border-4 flex flex-col items-center justify-center backdrop-blur-[1px] transition-colors ${
                  detected
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/20 text-white'
                    : 'border-emerald-400/70 bg-black/30 text-emerald-300'
                }`}
              >
                <Magnet className="w-7 h-7 mb-1" />
                <span className="text-2xl font-extrabold font-mono-nums">{magValue} µT</span>
                <span className="text-[11px] font-bold">
                  {detected ? 'حديد على بعد ~5 سم!' : 'حيط نقي'}
                </span>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex flex-col justify-between gap-4 rounded-2xl border border-white/10 bg-[#0a0f1e] p-5">
            <div className="space-y-4">
              <div
                className={`rounded-xl p-4 border text-center ${
                  detected
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/15 text-[#ff7a1a]'
                    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                }`}
              >
                <p className="text-sm font-extrabold">
                  {detected ? 'انتباه: تم اكتشاف حديد التسليح!' : 'الوضع آمن — ما كاينش حديد'}
                </p>
                <p className="text-xs text-slate-300 mt-1 font-mono-nums">
                  الفرق المغناطيسي: {delta} µT · العمق التقديري: ~5 سم
                </p>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>قوة الإشارة المغناطيسية</span>
                  <span className="font-mono-nums">{pct}%</span>
                </div>
                <div className="h-3 rounded-full bg-white/10 overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className={`h-full transition-all ${detected ? 'bg-[#ff7a1a]' : 'bg-emerald-400'}`}
                  />
                </div>
              </div>
            </div>

            {!hasMagSensor && (
              <div className="rounded-xl border border-white/10 bg-[#11182c] p-3.5 space-y-2">
                <p className="text-xs text-slate-300">
                  تجربة يدوية للمغناطيسية (فالهاتف كيقرا الحساس أوتوماتيكياً):
                </p>
                <input
                  type="range"
                  min="35"
                  max="140"
                  value={magValue}
                  onChange={(e) => setMagValue(parseInt(e.target.value, 10))}
                  className="w-full accent-[#ff7a1a]"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (toolId === 'laser-level') {
    const angle = laserMode === 'vertical' ? beta - 90 : gamma;
    const isPlumb = Math.abs(angle) <= 0.8;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">نيفو ليزر (DeviceOrientation + كاميرا)</h2>
            <p className="text-sm text-slate-400">
              خطوط ليزر أفقية وعمودية لتركيب الزليج، الشراجم والكادر
            </p>
          </div>
          <SpeakButton
            id="smart-laser-voice"
            variant="primary"
            label="سمع بالدارجة"
            text={
              isPlumb
                ? 'النيفو ليزر مقاد على الصفر نيشان! تقدر تراسي الخط.'
                : `الزاوية دابا هي ${angle.toFixed(1)} درجة، دور التليفون شوية حتى يولي الخط خضر.`
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['cross', 'horizontal', 'vertical'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLaserMode(m)}
              className={`min-h-[42px] px-4 rounded-xl text-xs font-bold ${
                laserMode === m
                  ? 'bg-[#ff7a1a] text-[#0a0f1e]'
                  : 'bg-[#0a0f1e] text-slate-300 border border-white/10'
              }`}
            >
              {m === 'cross' ? 'ليزر صليب (+)' : m === 'horizontal' ? 'خط أفقي' : 'خط عمودي'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              if (laserCam) {
                stopCameraStream();
                setLaserCam(false);
              } else {
                setLaserCam(true);
                void startCameraStream();
              }
            }}
            className={`min-h-[42px] inline-flex items-center gap-2 px-4 rounded-xl text-xs font-bold ${
              laserCam ? 'bg-emerald-500 text-[#0a0f1e]' : 'bg-white/10 text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{laserCam ? 'إيقاف الكاميرا' : 'شعل خلفية الكاميرا'}</span>
          </button>
        </div>

        <div className="relative h-72 rounded-2xl border border-white/15 bg-[#050814] overflow-hidden flex items-center justify-center">
          {laserCam && camActive && (
            <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-70" />
          )}

          <div
            style={{ transform: `rotate(${-angle}deg)` }}
            className="relative w-full h-full flex items-center justify-center transition-transform duration-75"
          >
            {(laserMode === 'cross' || laserMode === 'horizontal') && (
              <div
                className={`absolute left-0 right-0 h-0.5 ${
                  isPlumb ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                }`}
              />
            )}
            {(laserMode === 'cross' || laserMode === 'vertical') && (
              <div
                className={`absolute top-0 bottom-0 w-0.5 ${
                  isPlumb ? 'bg-emerald-400 shadow-[0_0_12px_#34d399]' : 'bg-red-500 shadow-[0_0_10px_#ef4444]'
                }`}
              />
            )}
          </div>

          <div className="relative z-10 rounded-xl bg-[#0a0f1e]/85 border border-white/15 px-4 py-2 text-center">
            <p className={`text-2xl font-extrabold font-mono-nums ${isPlumb ? 'text-emerald-400' : 'text-white'}`}>
              {angle.toFixed(1)}°
            </p>
            <p className="text-[11px] text-slate-300">{isPlumb ? 'مقاد نيشان 0°' : 'ميلان بسيط'}</p>
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-[#0a0f1e] p-4 space-y-2">
          <span className="text-xs text-slate-300">تجربة يدوية للميلان (فالحاسوب):</span>
          <input
            type="range"
            min="-25"
            max="25"
            step="0.5"
            value={laserMode === 'vertical' ? beta - 90 : gamma}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (laserMode === 'vertical') setBeta(90 + v);
              else setGamma(v);
            }}
            className="w-full accent-[#ff7a1a]"
          />
        </div>
      </div>
    );
  }

  if (toolId === 'ar-meter') {
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(b.x - a.x, b.y - a.y);
    const refPx = arPoints.length >= 2 ? dist(arPoints[0], arPoints[1]) : 0;
    const targetPx = arPoints.length >= 4 ? dist(arPoints[2], arPoints[3]) : 0;
    const refVal = Math.max(0.05, parseFloat(arRefMeters) || 1);
    const measuredMeters = refPx > 0 && targetPx > 0 ? (targetPx / refPx) * refVal : null;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">متر AR بالكاميرا</h2>
            <p className="text-sm text-slate-400">
              التقط لقطة من الكاميرا أو اختار صورة، علم على طول مرجعي وعبر أي مسافة
            </p>
          </div>
          <SpeakButton
            id="smart-ar-voice"
            variant="primary"
            label="سمع بالدارجة"
            text={
              measuredMeters
                ? `القياس التقريبي بالمتر ديال الكاميرا هو ${measuredMeters.toFixed(2)} متر، يعني ${Math.round(measuredMeters * 100)} سنتيمتر.`
                : 'شعل الكاميرا ولا اختار صورة، التقط لقطة، ومن بعد ورك على جوج نقط ديال قياس معروف وجوج نقط ديال المسافة اللي باغي تعبرها.'
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setArMode('camera');
              void startCameraStream();
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] px-4 py-2 text-xs font-extrabold"
          >
            <Camera className="w-4 h-4" />
            <span>شعل الكاميرا</span>
          </button>

          {camActive && arMode === 'camera' && (
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
                  setArPhoto(c.toDataURL('image/jpeg', 0.9));
                  setArMode('photo');
                  setArPoints([]);
                  stopCameraStream();
                }
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-[#0a0f1e] px-4 py-2 text-xs font-extrabold"
            >
              <ScanLine className="w-4 h-4" />
              <span>التقط لقطة متر AR</span>
            </button>
          )}

          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-2 text-xs font-bold text-white">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>أو ارفع صورة</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => {
                  if (typeof r.result === 'string') {
                    setArPhoto(r.result);
                    setArMode('photo');
                    setArPoints([]);
                    stopCameraStream();
                  }
                };
                r.readAsDataURL(file);
              }}
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-300">
            <span>المرجع (متر):</span>
            <input
              type="number"
              step="0.1"
              min="0.1"
              value={arRefMeters}
              onChange={(e) => setArRefMeters(e.target.value)}
              className="w-20 min-h-[40px] rounded-lg border border-white/15 bg-[#0a0f1e] px-2.5 text-white font-mono-nums"
            />
          </label>

          <button
            type="button"
            onClick={() => setArPoints([])}
            className="min-h-[40px] rounded-xl border border-white/15 px-3 text-xs text-slate-300 hover:bg-white/10"
          >
            مسح النقط
          </button>
        </div>

        {measuredMeters !== null && (
          <div className="rounded-xl border border-[#ff7a1a]/40 bg-[#ff7a1a]/10 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-white">القياس المحسوب:</span>
            <span className="text-xl font-extrabold font-mono-nums text-[#ff7a1a]">
              {measuredMeters.toFixed(2)} م ({Math.round(measuredMeters * 100)} سم)
            </span>
          </div>
        )}

        <div
          onClick={(e) => {
            if (arMode === 'camera' || !arPhoto) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            setArPoints((prev) => (prev.length >= 4 ? [{ x, y }] : [...prev, { x, y }]));
          }}
          className="relative w-full min-h-[300px] rounded-2xl overflow-hidden border border-white/15 bg-black flex items-center justify-center cursor-crosshair select-none"
        >
          {arMode === 'camera' && camActive ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-[380px] object-cover" />
          ) : arPhoto ? (
            <img src={arPhoto} alt="لقطة متر AR" referrerPolicy="no-referrer" className="w-full max-h-[400px] object-contain pointer-events-none" />
          ) : (
            <div className="p-6 text-center space-y-2">
              <Ruler className="w-10 h-10 text-[#ff7a1a] mx-auto" />
              <p className="text-xs text-slate-300">شعل الكاميرا أو ارفع صورة باش تبدا القياس</p>
            </div>
          )}

          {arPhoto && arMode === 'photo' && (
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {arPoints.length >= 2 && (
                <line x1={arPoints[0].x} y1={arPoints[0].y} x2={arPoints[1].x} y2={arPoints[1].y} stroke="#38bdf8" strokeWidth="0.7" />
              )}
              {arPoints.length >= 4 && (
                <line x1={arPoints[2].x} y1={arPoints[2].y} x2={arPoints[3].x} y2={arPoints[3].y} stroke="#ff7a1a" strokeWidth="0.8" />
              )}
              {arPoints.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r="1.4" fill={i < 2 ? '#38bdf8' : '#ff7a1a'} stroke="#0a0f1e" strokeWidth="0.4" />
              ))}
            </svg>
          )}
        </div>
      </div>
    );
  }

  if (toolId === 'crack-detector') {
    const compressCrackImage = (src: string): Promise<string> =>
      new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          try {
            const draw = (maxDim: number, q: number) => {
              let w = img.naturalWidth || img.width;
              let h = img.naturalHeight || img.height;
              if (w > maxDim || h > maxDim) {
                const r = Math.min(maxDim / w, maxDim / h);
                w = Math.max(1, Math.round(w * r));
                h = Math.max(1, Math.round(h * r));
              }
              const c = document.createElement('canvas');
              c.width = w;
              c.height = h;
              const ctx = c.getContext('2d');
              if (!ctx) return src;
              ctx.drawImage(img, 0, 0, w, h);
              return c.toDataURL('image/jpeg', q);
            };
            let out = draw(896, 0.68);
            if (out.length > 280_000) out = draw(720, 0.45);
            resolve(out);
          } catch {
            resolve(src);
          }
        };
        img.onerror = () => resolve(src);
        img.src = src;
      });

    const analyzeCrack = async (imgData: string) => {
      const allowance = await checkAllowanceBeforeAnalysis();
      if (!allowance.ok) {
        setCrackErr(allowance.message || 'ساليو تجارب هاد الكود.');
        return;
      }
      unlockAudio();
      setCrackLoading(true);
      setCrackErr(null);
      setCrackResult(null);
      try {
        const compactImg = imgData.startsWith('data:') && imgData.length > 280_000
          ? await compressCrackImage(imgData)
          : imgData;
        const { ok, data } = await postApiJson<{
          success?: boolean;
          diagnosis?: CrackDiagnosis;
          error?: string;
        }>(
          '/api/detect-cracks',
          { imageBase64: compactImg, mimeType: 'image/jpeg' },
          { timeoutMs: 26000, retries: 1 }
        );
        if (!ok || !data.success || !data.diagnosis) {
          throw new Error(data.error || 'تعذر فحص الصورة');
        }
        setCrackResult(data.diagnosis);
        await consumeTrial();
        if (settings.voiceEnabled && data.diagnosis?.audioScript) {
          void speakPro(data.diagnosis.audioScript, { id: 'crack-diagnosis-voice', useCloudTts: true });
        }
      } catch (err: unknown) {
        setCrackErr(err instanceof Error ? err.message : 'وقع خطأ أثناء فحص الشق');
      } finally {
        setCrackLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">كاشف الشقوق بالذكاء الاصطناعي</h2>
            <p className="text-sm text-slate-400">
              صور الشق اللي فالحيط ولا السارية وGemini كيشخص واش خطير ولا غير مرطوب ويعطيك الحل بالدارجة
            </p>
          </div>
          <SpeakButton
            id="crack-tool-intro"
            variant="secondary"
            label="سمع الشرح"
            text="صور الشق اللي عندك فالحيط أو الضالة، والذكاء الاصطناعي غادي يقول ليك واش غير تشقاق عادي ديال الصباغة والمرطوب ولا شق إنشائي خاصو مهندس، وكيفاش تصلحو."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => (camActive ? stopCameraStream() : void startCameraStream())}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] px-4 py-2 text-xs font-extrabold"
          >
            <Camera className="w-4 h-4" />
            <span>{camActive ? 'إيقاف الكاميرا' : 'شعل الكاميرا لتصوير الشق'}</span>
          </button>

          {camActive && (
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
                  const url = c.toDataURL('image/jpeg', 0.9);
                  setCrackImg(url);
                  stopCameraStream();
                  void analyzeCrack(url);
                }
              }}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-500 text-[#0a0f1e] px-4 py-2 text-xs font-extrabold"
            >
              <span>التقط وحلل الشق</span>
            </button>
          )}

          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-2 text-xs font-bold text-white">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>أو ارفع صورة من الهاتف</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const r = new FileReader();
                r.onload = () => {
                  if (typeof r.result === 'string') {
                    setCrackImg(r.result);
                    stopCameraStream();
                    void analyzeCrack(r.result);
                  }
                };
                r.readAsDataURL(file);
              }}
            />
          </label>
        </div>

        {camActive && (
          <div className="rounded-2xl overflow-hidden border border-white/15 bg-black">
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-72 object-cover" />
          </div>
        )}

        {crackImg && !camActive && (
          <div className="rounded-2xl overflow-hidden border border-white/15 bg-black max-h-72 flex items-center justify-center">
            <img src={crackImg} alt="صورة الشق" referrerPolicy="no-referrer" className="max-h-72 object-contain" />
          </div>
        )}

        {crackLoading && (
          <div className="rounded-xl border border-[#ff7a1a]/30 bg-[#0a0f1e] p-4 flex items-center gap-3 text-sm text-white">
            <Loader2 className="w-5 h-5 animate-spin text-[#ff7a1a]" />
            <span>جاري فحص الشق...</span>
          </div>
        )}

        {crackErr && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{crackErr}</span>
          </div>
        )}

        {crackResult && (
          <div className="rounded-2xl border border-white/10 bg-[#0a0f1e] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                {crackResult.severity === 'structural' ? (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                )}
                <span
                  className={`text-sm font-extrabold ${
                    crackResult.severity === 'structural'
                      ? 'text-red-300'
                      : crackResult.severity === 'moderate'
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                  }`}
                >
                  {crackResult.severityLabelDarija}
                </span>
              </div>
              <SpeakButton
                id="crack-result-speak"
                variant="primary"
                label="سمع التشخيص"
                text={crackResult.audioScript || crackResult.diagnosisDarija}
              />
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">{crackResult.diagnosisDarija}</p>
            <p className="text-xs text-slate-400">السبب المحتمل: {crackResult.causeDarija}</p>

            {crackResult.repairSteps?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <p className="text-xs font-bold text-[#ff7a1a]">خطوات الإصلاح بالترتيب:</p>
                <ul className="space-y-1.5 text-sm text-slate-200">
                  {crackResult.repairSteps.map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="font-mono-nums text-[#ff7a1a] font-bold">0{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // leak-detector
  const toggleLeakDetector = async () => {
    if (leakRunning) {
      if (leakRafRef.current) cancelAnimationFrame(leakRafRef.current);
      if (leakStreamRef.current) leakStreamRef.current.getTracks().forEach((t) => t.stop());
      if (leakAudioCtxRef.current) void leakAudioCtxRef.current.close();
      setLeakRunning(false);
      return;
    }

    setLeakErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      leakStreamRef.current = stream;
      const ctx = new AudioContext();
      leakAudioCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setLeakRunning(true);

      const tick = () => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const db = Math.min(98, Math.max(24, Math.round(24 + avg * 0.6)));
        setLeakDb(db);
        leakRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setLeakErr('تأكد من السماح للميكروفون باش تسمع ترددات التسريب.');
    }
  };

  const highLeak = leakDb >= 62;
  const leakSpeech = highLeak
    ? `انتباه! كاين صوت عالي ديال تسريب محتمل، القوة وصلت لـ ${leakDb} ديسيبل. قلب مزيان على الجعاب فهاد البلاصة.`
    : `الصوت عادي دابا، ${leakDb} ديسيبل، ما كيبانش شي تسريب باين فهاد البلاصة.`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold text-white">كاشف التسريب الصوتي (Web Audio)</h2>
          <p className="text-sm text-slate-400">
            قرب ميكروفون التليفون للحيط أو قادوس الما باش تسمع ترددات التسريب
          </p>
        </div>
        <SpeakButton id="leak-voice" variant="primary" label="سمع النتيجة بالدارجة" text={leakSpeech} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void toggleLeakDetector()}
          className={`min-h-[48px] inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-extrabold ${
            leakRunning ? 'bg-red-500 text-white' : 'bg-[#ff7a1a] text-[#0a0f1e]'
          }`}
        >
          {leakRunning ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          <span>{leakRunning ? 'حبس الميكروفون' : 'شعل كاشف التسريب'}</span>
        </button>
      </div>

      {leakErr && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
          {leakErr}
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-[#0a0f1e] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-5 h-5 ${highLeak ? 'text-red-400' : 'text-emerald-400'}`} />
            <span className="text-sm font-bold text-white">شدة الصوت والتردد</span>
          </div>
          <span className={`text-2xl font-extrabold font-mono-nums ${highLeak ? 'text-red-400' : 'text-emerald-400'}`}>
            {leakDb} dB
          </span>
        </div>

        <div className="h-4 rounded-full bg-white/10 overflow-hidden">
          <div
            style={{ width: `${Math.min(100, leakDb)}%` }}
            className={`h-full transition-all ${highLeak ? 'bg-red-500' : 'bg-emerald-400'}`}
          />
        </div>

        <p className={`text-sm font-bold ${highLeak ? 'text-red-300' : 'text-emerald-300'}`}>
          {highLeak ? 'احتمال تسريب عالي!' : 'وضع طبيعي'}
        </p>

        {!leakRunning && (
          <div className="pt-2 space-y-1.5 border-t border-white/10">
            <p className="text-xs text-slate-400">تجربة مستوى الصوت قبل تشغيل الميكروفون:</p>
            <input
              type="range"
              min="24"
              max="95"
              value={leakDb}
              onChange={(e) => setLeakDb(parseInt(e.target.value, 10))}
              className="w-full accent-[#ff7a1a]"
            />
          </div>
        )}
      </div>
    </div>
  );
};
