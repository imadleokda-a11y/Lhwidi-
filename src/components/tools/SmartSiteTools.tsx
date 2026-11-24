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
  RefreshCw,
  RotateCcw,
  Ruler,
  ScanLine,
  Smartphone,
  Upload,
} from 'lucide-react';
import type { CrackDiagnosis, ToolId } from '../../types';
import { SpeakButton, useDarijaSpeech } from '../../contexts/SpeechContext';
import { useCodeAccess } from '../../contexts/CodeContext';
import { postApiJson } from '../../utils/apiClient';

interface MagSensorInstance {
  x: number;
  y: number;
  z: number;
  start: () => void;
  stop: () => void;
  addEventListener: (e: string, cb: (ev?: unknown) => void) => void;
}

type MagSourceMode = 'none' | 'magnetometer' | 'compass';

const wrapAngleDiff = (a: number, b: number) => ((a - b + 540) % 360) - 180;

export const SmartSiteTools: React.FC<{ toolId: ToolId }> = ({ toolId }) => {
  const { speakPro, unlockAudio, settings } = useDarijaSpeech();
  const { checkAllowanceBeforeAnalysis, consumeTrial } = useCodeAccess();

  // Metal detector
  const [magValue, setMagValue] = useState(46);
  const [magBaseline, setMagBaseline] = useState(46);
  const [magPeakDelta, setMagPeakDelta] = useState(0);
  const [magSensitivity, setMagSensitivity] = useState<'high' | 'medium' | 'low'>('medium');
  const [magSource, setMagSource] = useState<MagSourceMode>('none');
  const [magNeedsPerm, setMagNeedsPerm] = useState(false);
  const [magStatusMsg, setMagStatusMsg] = useState<string | null>(null);
  const [beepOn, setBeepOn] = useState(false);
  const [camActive, setCamActive] = useState(false);
  const [camErr, setCamErr] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const magSensorRef = useRef<MagSensorInstance | null>(null);
  const beepCtxRef = useRef<AudioContext | null>(null);
  const magSourceRef = useRef<MagSourceMode>('none');
  const magValueRef = useRef(46);
  const magBaselineRef = useRef(46);
  const magThresholdRef = useRef(14);
  const magCalibSamplesRef = useRef<number[]>([]);
  const compassRefHeadingRef = useRef<number | null>(null);
  const lastCompassHeadingRef = useRef<number | null>(null);
  const lastRotRateRef = useRef<{ rate: number; ts: number }>({ rate: 0, ts: 0 });
  const hasAbsoluteOrientRef = useRef(false);
  const compassCleanupRef = useRef<(() => void) | null>(null);
  const magWatchdogRef = useRef<number | null>(null);
  const lastVibrateRef = useRef(0);

  // Laser level
  const [laserMode, setLaserMode] = useState<'cross' | 'horizontal' | 'vertical'>('cross');
  const [gamma, setGamma] = useState(0);
  const [beta, setBeta] = useState(90);
  const [laserOffset, setLaserOffset] = useState(0);
  const [hasLaserSensor, setHasLaserSensor] = useState(false);
  const [laserNeedsPerm, setLaserNeedsPerm] = useState(false);
  const [laserPermErr, setLaserPermErr] = useState<string | null>(null);
  const [laserCam, setLaserCam] = useState(false);

  // AR meter
  const [arMode, setArMode] = useState<'camera' | 'photo'>('photo');
  const [arPoints, setArPoints] = useState<{ x: number; y: number }[]>([]);
  const [arRefMeters, setArRefMeters] = useState('1.0');
  const [arPhoto, setArPhoto] = useState<string | null>(null);
  const [arImgDims, setArImgDims] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const arImgRef = useRef<HTMLImageElement | null>(null);

  // Crack detector
  const [crackImg, setCrackImg] = useState<string | null>(null);
  const [crackLoading, setCrackLoading] = useState(false);
  const [crackErr, setCrackErr] = useState<string | null>(null);
  const [crackResult, setCrackResult] = useState<CrackDiagnosis | null>(null);

  // Acoustic leak detector
  const [leakRunning, setLeakRunning] = useState(false);
  const [leakDb, setLeakDb] = useState(34);
  const [leakBaseline, setLeakBaseline] = useState(55);
  const [leakErr, setLeakErr] = useState<string | null>(null);
  const leakRafRef = useRef<number | null>(null);
  const leakAudioCtxRef = useRef<AudioContext | null>(null);
  const leakStreamRef = useRef<MediaStream | null>(null);

  const attachStreamToVideo = (videoEl: HTMLVideoElement | null, stream: MediaStream | null) => {
    if (!videoEl || !stream) return;
    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }
    void videoEl.play().catch(() => undefined);
  };

  useEffect(() => {
    if (camActive && streamRef.current && videoRef.current) {
      attachStreamToVideo(videoRef.current, streamRef.current);
    }
  }, [camActive, laserCam, arMode]);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => {
        try {
          t.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCamActive(false);
  };

  const startCameraStream = async () => {
    setCamErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCamErr('الكاميرا المباشرة ما مدعوماش فهاد المتصفح، جرب رفع صورة.');
        return;
      }
      stopCameraStream();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setCamActive(true);
      requestAnimationFrame(() => {
        attachStreamToVideo(videoRef.current, stream);
      });
    } catch {
      setCamErr('ما قدرناش نشغلو الكاميرا. تأكد من الإذن (Allow) ولا ارفع صورة.');
    }
  };

  useEffect(() => {
    magThresholdRef.current = magSensitivity === 'high' ? 10 : magSensitivity === 'low' ? 22 : 14;
  }, [magSensitivity]);

  const stopMetalSensors = () => {
    if (magWatchdogRef.current !== null) {
      window.clearTimeout(magWatchdogRef.current);
      magWatchdogRef.current = null;
    }
    if (magSensorRef.current) {
      try {
        magSensorRef.current.stop();
      } catch {
        // ignore
      }
      magSensorRef.current = null;
    }
    if (compassCleanupRef.current) {
      compassCleanupRef.current();
      compassCleanupRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
      stopMetalSensors();
      if (beepCtxRef.current) {
        void beepCtxRef.current.close().catch(() => undefined);
        beepCtxRef.current = null;
      }
      if (leakRafRef.current !== null) {
        cancelAnimationFrame(leakRafRef.current);
        leakRafRef.current = null;
      }
      if (leakStreamRef.current) {
        leakStreamRef.current.getTracks().forEach((t) => t.stop());
        leakStreamRef.current = null;
      }
      if (leakAudioCtxRef.current) {
        void leakAudioCtxRef.current.close().catch(() => undefined);
        leakAudioCtxRef.current = null;
      }
    };
  }, [toolId]);

  const startCompassMetalFallback = () => {
    if (compassCleanupRef.current) {
      compassCleanupRef.current();
      compassCleanupRef.current = null;
    }
    hasAbsoluteOrientRef.current = false;
    compassRefHeadingRef.current = null;
    lastCompassHeadingRef.current = null;
    const mountedAt = Date.now();

    const onMotion = (ev: DeviceMotionEvent) => {
      const rr = ev.rotationRate;
      if (!rr) return;
      const rate = Math.hypot(rr.alpha || 0, rr.beta || 0, rr.gamma || 0);
      if (Number.isFinite(rate)) {
        lastRotRateRef.current = { rate, ts: Date.now() };
      }
    };

    const handleHeading = (rawHeading: number) => {
      if (magSourceRef.current === 'magnetometer') return;

      if (magSourceRef.current !== 'compass') {
        magSourceRef.current = 'compass';
        setMagSource('compass');
        setMagNeedsPerm(false);
        setMagStatusMsg(null);
      }

      const prevH = lastCompassHeadingRef.current;
      const smoothedH =
        prevH === null ? rawHeading : (prevH + wrapAngleDiff(rawHeading, prevH) * 0.38 + 360) % 360;
      lastCompassHeadingRef.current = smoothedH;

      if (compassRefHeadingRef.current === null) {
        compassRefHeadingRef.current = smoothedH;
        magBaselineRef.current = 46;
        magValueRef.current = 46;
        setMagBaseline(46);
        setMagValue(46);
        return;
      }

      const recentRot = Date.now() - lastRotRateRef.current.ts < 350 ? lastRotRateRef.current.rate : 0;
      if (recentRot > 22) {
        compassRefHeadingRef.current =
          (compassRefHeadingRef.current + wrapAngleDiff(smoothedH, compassRefHeadingRef.current) * 0.25 + 360) %
          360;
      } else {
        const dev = Math.abs(wrapAngleDiff(smoothedH, compassRefHeadingRef.current));
        if (dev < 3.5) {
          compassRefHeadingRef.current =
            (compassRefHeadingRef.current +
              wrapAngleDiff(smoothedH, compassRefHeadingRef.current) * 0.015 +
              360) %
            360;
        }
      }

      const deviationDeg = Math.abs(wrapAngleDiff(smoothedH, compassRefHeadingRef.current));
      const deltaUt = Math.min(110, deviationDeg * 1.45);
      const equivUt = Math.round((46 + deltaUt) * 10) / 10;
      magValueRef.current = equivUt;
      setMagValue(Math.round(equivUt));
      setMagPeakDelta((prev) => Math.max(prev, Math.round(deltaUt)));
    };

    const onOrientAbs = (ev: DeviceOrientationEvent) => {
      if (typeof ev.alpha === 'number' && Number.isFinite(ev.alpha)) {
        hasAbsoluteOrientRef.current = true;
        handleHeading((360 - ev.alpha + 360) % 360);
      }
    };

    const onOrient = (ev: DeviceOrientationEvent) => {
      const wch = (ev as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof wch === 'number' && Number.isFinite(wch) && wch >= 0) {
        hasAbsoluteOrientRef.current = true;
        handleHeading(wch);
        return;
      }
      if (hasAbsoluteOrientRef.current) return;
      if (typeof ev.alpha === 'number' && Number.isFinite(ev.alpha)) {
        if (ev.absolute === true || Date.now() - mountedAt > 650) {
          handleHeading((360 - ev.alpha + 360) % 360);
        }
      }
    };

    window.addEventListener('devicemotion', onMotion);
    window.addEventListener('deviceorientationabsolute' as unknown as keyof WindowEventMap, onOrientAbs as EventListener);
    window.addEventListener('deviceorientation', onOrient);

    compassCleanupRef.current = () => {
      window.removeEventListener('devicemotion', onMotion);
      window.removeEventListener(
        'deviceorientationabsolute' as unknown as keyof WindowEventMap,
        onOrientAbs as EventListener
      );
      window.removeEventListener('deviceorientation', onOrient);
    };
  };

  const tryStartRawMagnetometer = async () => {
    const win = window as unknown as {
      Magnetometer?: new (opts?: { frequency?: number }) => MagSensorInstance;
      UncalibratedMagnetometer?: new (opts?: { frequency?: number }) => MagSensorInstance;
    };

    const tryCtor = (Ctor: (new (opts?: { frequency?: number }) => MagSensorInstance) | undefined): boolean => {
      if (!Ctor) return false;
      try {
        if (magSensorRef.current) {
          try {
            magSensorRef.current.stop();
          } catch {
            // ignore
          }
        }
        const sensor = new Ctor({ frequency: 20 });
        magSensorRef.current = sensor;
        let emaMag: number | null = null;
        magCalibSamplesRef.current = [];

        sensor.addEventListener('reading', () => {
          const raw = Math.hypot(sensor.x || 0, sensor.y || 0, sensor.z || 0);
          if (!Number.isFinite(raw) || raw <= 0) return;

          emaMag = emaMag === null ? raw : emaMag * 0.65 + raw * 0.35;
          if (magCalibSamplesRef.current.length < 5) {
            magCalibSamplesRef.current.push(emaMag);
            const avg =
              magCalibSamplesRef.current.reduce((s, v) => s + v, 0) / magCalibSamplesRef.current.length;
            magBaselineRef.current = avg;
            setMagBaseline(Math.round(avg));
          }

          magSourceRef.current = 'magnetometer';
          setMagSource('magnetometer');
          setMagNeedsPerm(false);
          setMagStatusMsg(null);
          magValueRef.current = emaMag;
          setMagValue(Math.round(emaMag));
          const d = Math.round(Math.abs(emaMag - magBaselineRef.current));
          setMagPeakDelta((prev) => Math.max(prev, d));
        });

        sensor.addEventListener('error', () => {
          if (magSourceRef.current === 'magnetometer') {
            magSourceRef.current = 'none';
            setMagSource('none');
          }
          if (Ctor === win.Magnetometer && win.UncalibratedMagnetometer) {
            tryCtor(win.UncalibratedMagnetometer);
          }
        });

        sensor.start();
        return true;
      } catch {
        return false;
      }
    };

    if (navigator.permissions?.query) {
      try {
        const perm = await navigator.permissions.query({ name: 'magnetometer' as PermissionName });
        if (perm.state === 'denied') return;
      } catch {
        // Ignore unsupported permission name
      }
    }

    if (!tryCtor(win.Magnetometer)) {
      tryCtor(win.UncalibratedMagnetometer);
    }
  };

  const startMetalSensors = async (fromUserGesture: boolean) => {
    setMagStatusMsg(null);

    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    const DME = window.DeviceMotionEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };

    // On iOS 13+, requestPermission MUST run directly inside the user click gesture before any unrelated await
    if (fromUserGesture && DOE && typeof DOE.requestPermission === 'function') {
      try {
        const orientRes = await DOE.requestPermission();
        if (DME && typeof DME.requestPermission === 'function') {
          try {
            await DME.requestPermission();
          } catch {
            // Motion permission optional; orientation compass still works
          }
        }
        if (orientRes === 'granted') {
          setMagNeedsPerm(false);
        } else {
          setMagStatusMsg('خاصك تعطي إذن مستشعر الاتجاه للآيفون باش يخدم كاشف الحديد.');
        }
      } catch {
        setMagStatusMsg('تعذر تفعيل حساس الآيفون، تأكد أن المتصفح فاتح الموقع عبر HTTPS.');
      }
    } else if (!fromUserGesture && DOE && typeof DOE.requestPermission === 'function') {
      setMagNeedsPerm(true);
    }

    startCompassMetalFallback();
    void tryStartRawMagnetometer();

    if (magWatchdogRef.current !== null) {
      window.clearTimeout(magWatchdogRef.current);
    }
    magWatchdogRef.current = window.setTimeout(() => {
      if (magSourceRef.current === 'none') {
        if (DOE && typeof DOE.requestPermission === 'function') {
          setMagStatusMsg('اضغط على زر "تفعيل حساس الهاتف" الفوق باش يشتغل مستشعر الآيفون.');
        } else {
          setMagStatusMsg('هاد الجهاز ما صيفطش قراءة الحساس (ممكن تستعمل المعايرة اليدوية لتحت أو تفتح من الهاتف).');
        }
      }
    }, 1800);
  };

  // Start metal detector sensors on mount
  useEffect(() => {
    if (toolId !== 'metal-detector') return;
    magSourceRef.current = 'none';
    setMagSource('none');
    setMagPeakDelta(0);
    void startMetalSensors(false);
    return () => {
      stopMetalSensors();
    };
  }, [toolId]);

  // Device orientation for laser level (with iOS 13+ permission check)
  useEffect(() => {
    if (toolId !== 'laser-level') return;
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (DOE && typeof DOE.requestPermission === 'function') {
      setLaserNeedsPerm(true);
    }

    const onOrient = (ev: DeviceOrientationEvent) => {
      if (typeof ev.gamma === 'number' || typeof ev.beta === 'number') {
        if (typeof ev.gamma === 'number') setGamma(ev.gamma);
        if (typeof ev.beta === 'number') setBeta(ev.beta);
        setHasLaserSensor(true);
        setLaserNeedsPerm(false);
      }
    };
    window.addEventListener('deviceorientation', onOrient);
    return () => window.removeEventListener('deviceorientation', onOrient);
  }, [toolId]);

  const requestLaserSensorPermission = async () => {
    setLaserPermErr(null);
    const DOE = window.DeviceOrientationEvent as unknown as {
      requestPermission?: () => Promise<'granted' | 'denied'>;
    };
    if (DOE && typeof DOE.requestPermission === 'function') {
      try {
        const res = await DOE.requestPermission();
        if (res === 'granted') {
          setLaserNeedsPerm(false);
          setHasLaserSensor(true);
        } else {
          setLaserPermErr('ما عطيتيش الإذن لحساس الدوران ديال التليفون.');
        }
      } catch {
        setLaserPermErr('تعذر تفعيل الحساس، تأكد من إعدادات المتصفح.');
      }
    }
  };

  // Geiger-style Beep & Vibration loop for metal detector (does NOT reset on sensor ticks)
  useEffect(() => {
    if (toolId !== 'metal-detector' || !beepOn) return;

    let stopped = false;
    let timerId: number | null = null;

    const tick = () => {
      if (stopped) return;
      const delta = Math.abs(magValueRef.current - magBaselineRef.current);
      const threshold = magThresholdRef.current;

      if (delta >= threshold) {
        const ctx = beepCtxRef.current;
        if (ctx && ctx.state !== 'closed') {
          try {
            if (ctx.state === 'suspended') {
              void ctx.resume();
            }
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.value = Math.min(1600, 780 + delta * 9);
            gain.gain.setValueAtTime(0.09, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.085);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.09);
          } catch {
            // ignore
          }
        }

        const now = Date.now();
        if (navigator.vibrate && now - lastVibrateRef.current > 240) {
          lastVibrateRef.current = now;
          try {
            navigator.vibrate(35);
          } catch {
            // ignore
          }
        }

        const nextDelay = Math.max(140, Math.round(420 - Math.min(280, (delta - threshold) * 5)));
        timerId = window.setTimeout(tick, nextDelay);
      } else {
        timerId = window.setTimeout(tick, 180);
      }
    };

    timerId = window.setTimeout(tick, 100);
    return () => {
      stopped = true;
      if (timerId !== null) window.clearTimeout(timerId);
    };
  }, [toolId, beepOn]);

  if (toolId === 'metal-detector') {
    const threshold = magSensitivity === 'high' ? 10 : magSensitivity === 'low' ? 22 : 14;
    const delta = Math.round(Math.abs(magValue - magBaseline));
    const detected = delta >= threshold;
    const pct = Math.min(100, Math.round((delta / 70) * 100));
    const speech = detected
      ? `انتباه! كاين حديد أو سلك كهربائي قريب على بعد أقل من خمسة سنتيمتر، قوة الإشارة ${delta} ميكروتسلا.`
      : `البلاصة نقية، ما كاين حتى حديد قريب، القراءة العادية هي ${magValue} ميكروتسلا.`;

    const calibrateMetalZero = () => {
      magBaselineRef.current = magValueRef.current;
      setMagBaseline(Math.round(magValueRef.current));
      compassRefHeadingRef.current = lastCompassHeadingRef.current;
      setMagPeakDelta(0);
    };

    const toggleBeepWithUnlock = () => {
      const next = !beepOn;
      if (next) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          if (!beepCtxRef.current || beepCtxRef.current.state === 'closed') {
            beepCtxRef.current = new AudioCtx();
          }
          if (beepCtxRef.current.state === 'suspended') {
            void beepCtxRef.current.resume().catch(() => undefined);
          }
        }
      }
      setBeepOn(next);
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">
              كاشف الحديد (عمق 5 سم + فيديو مباشر)
            </h2>
            <p className="text-sm text-slate-400">
              قرب ظهر التليفون للحيط أو السارية وحركو بشوية، وضغط تصفير المعايرة قبل الفحص
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
            <span>{camActive ? 'الكاميرا المباشرة شغالة (إيقاف)' : 'شعل الكاميرا المباشرة'}</span>
          </button>

          {(magSource === 'none' || magNeedsPerm) && (
            <button
              type="button"
              onClick={() => void startMetalSensors(true)}
              className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-[#ff7a1a]/50 bg-[#ff7a1a]/20 px-4 text-xs font-extrabold text-[#ff7a1a]"
            >
              <Magnet className="w-4 h-4" />
              <span>تفعيل حساس الهاتف (أندرويد / آيفون)</span>
            </button>
          )}

          <button
            type="button"
            onClick={calibrateMetalZero}
            className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-xs font-bold text-white hover:border-[#ff7a1a]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>تصفير المعايرة</span>
          </button>

          <button
            type="button"
            onClick={toggleBeepWithUnlock}
            className={`min-h-[44px] rounded-xl px-4 text-xs font-extrabold transition-colors ${
              beepOn ? 'bg-[#ff7a1a] text-[#0a0f1e]' : 'bg-white/10 text-slate-200'
            }`}
          >
            {beepOn ? 'صوت التنبيه: مشعل' : 'شعل صوت التنبيه'}
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0a0f1e] px-4 py-2.5 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                magSource !== 'none' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>
              {magSource === 'magnetometer'
                ? 'الحساس المباشر شغال (قياس مغناطيسي حقيقي µT)'
                : magSource === 'compass'
                  ? 'حساس البوصلة المغناطيسية شغال (كشف الانحراف المغناطيسي)'
                  : 'الحساس في وضع الاستعداد — اضغط تفعيل أو جرب المعايرة لتحت'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">الحساسية:</span>
            {(['high', 'medium', 'low'] as const).map((lvl) => (
              <button
                key={lvl}
                type="button"
                onClick={() => setMagSensitivity(lvl)}
                className={`rounded-lg px-2.5 py-1 font-bold transition-colors ${
                  magSensitivity === lvl
                    ? 'bg-[#ff7a1a] text-[#0a0f1e]'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {lvl === 'high' ? 'عالية' : lvl === 'medium' ? 'متوسطة' : 'منخفضة'}
              </button>
            ))}
          </div>
        </div>

        {magStatusMsg && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-2.5 text-xs text-amber-200">
            {magStatusMsg}
          </div>
        )}

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
                ref={(el) => {
                  videoRef.current = el;
                  attachStreamToVideo(el, streamRef.current);
                }}
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
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/25 text-white'
                    : 'border-emerald-400/70 bg-black/35 text-emerald-300'
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
                  الفرق المغناطيسي: {delta} µT · أعلى قراءة: {magPeakDelta} µT
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

              <p className="text-[11px] text-slate-400 leading-relaxed">
                نصيحة: حيد الكوفير المغناطيسي إلا كان فالتليفون، وحرك ظهر التليفون ببطء على الحيط بعد تصفير المعايرة.
              </p>
            </div>

            {magSource === 'none' && (
              <div className="rounded-xl border border-white/10 bg-[#11182c] p-3.5 space-y-2">
                <p className="text-xs text-slate-300">
                  اختبار يدوي للمغناطيسية (على الهاتف كيقرا الحساس أوتوماتيكياً):
                </p>
                <input
                  type="range"
                  min="35"
                  max="140"
                  value={magValue}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    magValueRef.current = v;
                    setMagValue(v);
                  }}
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
    const rawAngle = laserMode === 'vertical' ? beta - 90 : gamma;
    const angle = rawAngle - laserOffset;
    const isPlumb = Math.abs(angle) <= 0.8;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">نيفو ليزر (مستشعر الهاتف + كاميرا)</h2>
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
              onClick={() => {
                setLaserMode(m);
                setLaserOffset(0);
              }}
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

          <button
            type="button"
            onClick={() => setLaserOffset(rawAngle)}
            className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl border border-white/15 bg-[#0a0f1e] text-xs font-bold text-slate-200 hover:border-[#ff7a1a]"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#ff7a1a]" />
            <span>تصفير النيفو (0°)</span>
          </button>

          {laserNeedsPerm && (
            <button
              type="button"
              onClick={() => void requestLaserSensorPermission()}
              className="min-h-[42px] inline-flex items-center gap-1.5 px-4 rounded-xl bg-[#ff7a1a] text-[#0a0f1e] text-xs font-extrabold"
            >
              <Smartphone className="w-4 h-4" />
              <span>تفعيل مستشعر الآيفون</span>
            </button>
          )}
        </div>

        {(camErr || laserPermErr) && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            {laserPermErr || camErr}
          </div>
        )}

        <div className="relative h-72 rounded-2xl border border-white/15 bg-[#050814] overflow-hidden flex items-center justify-center">
          {laserCam && camActive && (
            <video
              ref={(el) => {
                videoRef.current = el;
                attachStreamToVideo(el, streamRef.current);
              }}
              autoPlay
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover opacity-70"
            />
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

        {!hasLaserSensor && (
          <div className="rounded-xl border border-white/10 bg-[#0a0f1e] p-4 space-y-2">
            <span className="text-xs text-slate-300">
              تجربة يدوية للميلان (فالحاسوب، وفالهاتف كيتحرك بالحساس أوتوماتيكياً):
            </span>
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
        )}
      </div>
    );
  }

  if (toolId === 'ar-meter') {
    const syncImgDims = () => {
      const el = arImgRef.current;
      if (el && el.clientWidth > 0 && el.clientHeight > 0) {
        setArImgDims({ w: el.clientWidth, h: el.clientHeight });
      }
    };

    const pxDist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot((b.x - a.x) * arImgDims.w, (b.y - a.y) * arImgDims.h);

    const refPx = arPoints.length >= 2 ? pxDist(arPoints[0], arPoints[1]) : 0;
    const targetPx = arPoints.length >= 4 ? pxDist(arPoints[2], arPoints[3]) : 0;
    const parsedRef = parseFloat((arRefMeters || '').replace(',', '.'));
    const refVal = Math.max(0.05, Number.isFinite(parsedRef) && parsedRef > 0 ? parsedRef : 1);
    const measuredMeters = refPx > 0 && targetPx > 0 ? (targetPx / refPx) * refVal : null;

    const guideMsg =
      arPoints.length === 0
        ? '1/4: برك على النقطة الأولى ديال الطول المرجعي (مثلا بداية باب أو زليجة)'
        : arPoints.length === 1
          ? '2/4: برك على النقطة الثانية ديال الطول المرجعي'
          : arPoints.length === 2
            ? '3/4: دابا برك على بداية البلاصة اللي باغي تعبرها'
            : arPoints.length === 3
              ? '4/4: برك على نهاية البلاصة اللي باغي تعبرها'
              : `تم القياس بنجاح: ${measuredMeters?.toFixed(2)} متر (${Math.round((measuredMeters || 0) * 100)} سم)`;

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold text-white">متر AR بالكاميرا</h2>
            <p className="text-sm text-slate-400">
              شعل الكاميرا والتقط صورة أو اختار صورة، علم على طول معروف ومن بعد عبر أي مسافة بدقة
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
            <span>{camActive && arMode === 'camera' ? 'الكاميرا شغالة' : 'شعل الكاميرا'}</span>
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

          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] px-4 py-2 text-xs font-bold text-white hover:border-[#ff7a1a]">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>أو ارفع صورة</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
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
              type="text"
              inputMode="decimal"
              value={arRefMeters}
              onChange={(e) => setArRefMeters(e.target.value)}
              className="w-20 min-h-[40px] rounded-lg border border-white/15 bg-[#0a0f1e] px-2.5 text-white font-mono-nums"
            />
          </label>

          {arPoints.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => setArPoints((prev) => prev.slice(0, -1))}
                className="min-h-[40px] rounded-xl border border-white/15 px-3 text-xs text-slate-200 hover:bg-white/10"
              >
                تراجع عن نقطة
              </button>
              <button
                type="button"
                onClick={() => setArPoints([])}
                className="min-h-[40px] rounded-xl border border-white/15 px-3 text-xs text-slate-300 hover:bg-white/10"
              >
                مسح النقط
              </button>
            </>
          )}
        </div>

        {camErr && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            {camErr}
          </div>
        )}

        {arPhoto && arMode === 'photo' && (
          <div className="rounded-xl border border-[#ff7a1a]/30 bg-[#0a0f1e] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-[#ff7a1a]">{guideMsg}</span>
            {measuredMeters !== null && (
              <span className="text-lg font-extrabold font-mono-nums text-white">
                {measuredMeters.toFixed(2)} م ({Math.round(measuredMeters * 100)} سم)
              </span>
            )}
          </div>
        )}

        <div className="relative w-full min-h-[280px] rounded-2xl overflow-hidden border border-white/15 bg-black flex items-center justify-center p-2">
          {arMode === 'camera' && camActive ? (
            <video
              ref={(el) => {
                videoRef.current = el;
                attachStreamToVideo(el, streamRef.current);
              }}
              autoPlay
              playsInline
              muted
              className="w-full max-h-[380px] object-cover rounded-xl"
            />
          ) : arPhoto ? (
            <div
              onPointerDown={(e) => {
                e.preventDefault();
                syncImgDims();
                const rect = e.currentTarget.getBoundingClientRect();
                if (!rect.width || !rect.height) return;
                const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
                setArPoints((prev) => (prev.length >= 4 ? [{ x, y }] : [...prev, { x, y }]));
              }}
              className="relative inline-block cursor-crosshair select-none touch-none"
            >
              <img
                ref={arImgRef}
                src={arPhoto}
                alt="لقطة متر AR"
                onLoad={syncImgDims}
                referrerPolicy="no-referrer"
                className="block max-w-full max-h-[420px] w-auto h-auto pointer-events-none select-none rounded-lg"
              />
              <svg
                className="absolute inset-0 w-full h-full pointer-events-none"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                {arPoints.length >= 2 && (
                  <line
                    x1={arPoints[0].x * 100}
                    y1={arPoints[0].y * 100}
                    x2={arPoints[1].x * 100}
                    y2={arPoints[1].y * 100}
                    stroke="#38bdf8"
                    strokeWidth="0.9"
                  />
                )}
                {arPoints.length >= 4 && (
                  <line
                    x1={arPoints[2].x * 100}
                    y1={arPoints[2].y * 100}
                    x2={arPoints[3].x * 100}
                    y2={arPoints[3].y * 100}
                    stroke="#ff7a1a"
                    strokeWidth="1"
                  />
                )}
                {arPoints.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x * 100}
                    cy={pt.y * 100}
                    r="1.8"
                    fill={i < 2 ? '#38bdf8' : '#ff7a1a'}
                    stroke="#0a0f1e"
                    strokeWidth="0.5"
                  />
                ))}
              </svg>
            </div>
          ) : (
            <div className="p-6 text-center space-y-2">
              <Ruler className="w-10 h-10 text-[#ff7a1a] mx-auto" />
              <p className="text-xs text-slate-300">شعل الكاميرا أو ارفع صورة باش تبدا القياس</p>
            </div>
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
            if (out.length > 300_000) out = draw(600, 0.36);
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
        const compactImg =
          imgData.startsWith('data:') && imgData.length > 260_000
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
                  const url = c.toDataURL('image/jpeg', 0.88);
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

          <label className="min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#0a0f1e] hover:border-[#ff7a1a] px-4 py-2 text-xs font-bold text-white">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>أو ارفع صورة من الهاتف</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
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

        {camErr && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-950/30 p-3 text-xs text-amber-200">
            {camErr}
          </div>
        )}

        {camActive && (
          <div className="rounded-2xl overflow-hidden border border-white/15 bg-black">
            <video
              ref={(el) => {
                videoRef.current = el;
                attachStreamToVideo(el, streamRef.current);
              }}
              autoPlay
              playsInline
              muted
              className="w-full max-h-72 object-cover"
            />
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
            <span>جاري فحص الشق بالذكاء الاصطناعي...</span>
          </div>
        )}

        {crackErr && (
          <div className="rounded-xl border border-red-500/40 bg-red-950/30 p-4 text-sm text-red-200 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{crackErr}</span>
            </div>
            {crackImg && !crackLoading && (
              <button
                type="button"
                onClick={() => void analyzeCrack(crackImg)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff7a1a] text-[#0a0f1e] px-3 py-1.5 text-xs font-extrabold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>عاود الفحص</span>
              </button>
            )}
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
      if (leakRafRef.current !== null) {
        cancelAnimationFrame(leakRafRef.current);
        leakRafRef.current = null;
      }
      if (leakStreamRef.current) {
        leakStreamRef.current.getTracks().forEach((t) => t.stop());
        leakStreamRef.current = null;
      }
      if (leakAudioCtxRef.current) {
        void leakAudioCtxRef.current.close().catch(() => undefined);
        leakAudioCtxRef.current = null;
      }
      setLeakRunning(false);
      return;
    }

    setLeakErr(null);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setLeakErr('المتصفح ما كيدعمش التقاط الصوت.');
        return;
      }
      // Disable noiseSuppression so steady water-leak hissing is NOT filtered out by browser DSP
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      leakStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        stream.getTracks().forEach((t) => t.stop());
        setLeakErr('متصفحك ما كيدعمش تحليل الصوت المباشر (Web Audio).');
        return;
      }

      const ctx = new AudioCtx();
      leakAudioCtxRef.current = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.75;
      src.connect(analyser);

      const freqData = new Uint8Array(analyser.frequencyBinCount);
      const timeData = new Uint8Array(analyser.fftSize);
      setLeakRunning(true);

      const binHz = ctx.sampleRate / analyser.fftSize;
      const hissMinBin = Math.max(1, Math.floor(800 / binHz));
      const hissMaxBin = Math.min(freqData.length - 1, Math.ceil(6500 / binHz));

      let smoothedDb = 34;
      const tick = () => {
        if (!leakAudioCtxRef.current) return;
        analyser.getByteFrequencyData(freqData);
        analyser.getByteTimeDomainData(timeData);

        let sumSq = 0;
        for (let i = 0; i < timeData.length; i++) {
          const n = (timeData[i] - 128) / 128;
          sumSq += n * n;
        }
        const rms = Math.sqrt(sumSq / timeData.length);

        let hissSum = 0;
        const span = Math.max(1, hissMaxBin - hissMinBin + 1);
        for (let i = hissMinBin; i <= hissMaxBin; i++) {
          hissSum += freqData[i];
        }
        const hissAvg = hissSum / span;

        const rawDb = Math.min(98, Math.max(24, Math.round(24 + rms * 145 + hissAvg * 0.42)));
        smoothedDb = smoothedDb * 0.65 + rawDb * 0.35;
        setLeakDb(Math.round(smoothedDb));
        leakRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setLeakErr('تأكد من السماح للميكروفون (Allow) باش تسمع ترددات التسريب.');
    }
  };

  const highLeak = leakDb >= leakBaseline;
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

        {leakRunning && (
          <button
            type="button"
            onClick={() => setLeakBaseline(Math.min(88, Math.max(40, leakDb + 12)))}
            className="min-h-[48px] rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-xs font-bold text-slate-200 hover:border-[#ff7a1a]"
          >
            معايرة الهدوء (تصفير الضجيج)
          </button>
        )}
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

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={`text-sm font-bold ${highLeak ? 'text-red-300' : 'text-emerald-300'}`}>
            {highLeak ? 'احتمال تسريب عالي!' : 'وضع طبيعي'}
          </p>
          <span className="text-xs text-slate-400 font-mono-nums">عتبة التنبيه: {leakBaseline} dB</span>
        </div>

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
