import React, { useEffect, useRef, useState } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (dataUrl: string) => void;
}

export const CameraModal: React.FC<CameraModalProps> = ({ isOpen, onClose, onCapture }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setReady(false);
      setError(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('الكاميرا المباشرة ما مدعوماش فهاد المتصفح. تقدر ترفع صورة مباشرة.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => void 0);
          setReady(true);
        }
      } catch {
        setError('ما قدرناش نشغلو الكاميرا (تأكد من السماح للإذن أو رفع صورة من الهاتف).');
      }
    })();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    onCapture(dataUrl);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onCapture(reader.result);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تصوير البلان بالكاميرا"
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl rounded-3xl border border-white/15 bg-[#11182c] overflow-hidden shadow-2xl">
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Camera className="w-5 h-5 text-[#ff7a1a]" />
            <h2 className="text-base font-extrabold text-white">صور البلان بالكاميرا</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
          {!error ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="p-6 text-center space-y-3 max-w-sm">
              <Camera className="w-10 h-10 text-[#ff7a1a] mx-auto" />
              <p className="text-sm text-slate-300 leading-relaxed">{error}</p>
            </div>
          )}
          <div className="pointer-events-none absolute inset-6 border-2 border-dashed border-[#ff7a1a]/50 rounded-2xl" />
        </div>

        <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-[#0a0f1e]">
          <label className="min-h-[46px] cursor-pointer inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] hover:bg-[#16203a] px-4 py-2 text-sm font-bold text-slate-200">
            <Upload className="w-4 h-4 text-[#ff7a1a]" />
            <span>اختار صورة من الهاتف</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
          </label>

          {!error && (
            <button
              type="button"
              disabled={!ready}
              onClick={handleCapture}
              className="min-h-[46px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-6 py-2 text-sm font-extrabold disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              <span>التقط الصورة</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
