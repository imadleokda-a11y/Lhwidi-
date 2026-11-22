import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Pause, Play, RotateCcw } from 'lucide-react';
import { SpeakButton, useDarijaSpeech, VoiceGenderSwitch } from '../contexts/SpeechContext';

interface Lesson {
  id: string;
  title: string;
  durationSec: number;
  tag: string;
  summaryDarija: string;
  narrationDarija: string;
  steps: string[];
}

const LESSONS: Lesson[] = [
  {
    id: 'lesson-rebar',
    title: 'كيفاش تقرا بلان الحديد والسواري (Béton Armé)',
    durationSec: 18,
    tag: 'فيديو قصير · السواري والضالة',
    summaryDarija:
      'عرف معنى الرموز بحال 6Ø12، الكادرات (الأساور)، وشبكة الحديد ديال الضالة قبل ما تبدا التلحيم.',
    narrationDarija:
      'فالدرس اللول، كيفاش تقرا بلان الحديد. المربع الكبير هو السارية، والنقط الحمرين هما القضبان ديال الحديد. إلى شفتي ستة قطر طناش، معناها ستة دالبارات غلاظ داير عليهم الكادر بحديد رقيق. وفلجهة التانية، الشبكة الخضرا هي حديد الضالة لي كيكون متقاطع كل خمسطاش حتى لعشرين سنتيم.',
    steps: [
      'السارية (Poteau): كتحمل الثقل ديال الضالة والطوابق الفوق.',
      'الكادرات (Cadres / Étriers): كتحزم القضبان وتمنع الاعوجاج.',
      'شبكة الضالة: حديد متقاطع بمسافة منتظمة (15–20 سم).',
    ],
  },
  {
    id: 'lesson-rooms',
    title: 'تفصيل الغرف، الأبواب والسواري فبلان الدار',
    durationSec: 16,
    tag: 'فيديو قصير · البلان المعماري',
    summaryDarija:
      'فرق بين الحيوط الحاملة، السواري، اتجاه فتحان البيبان، والشراجم ديال التهوية.',
    narrationDarija:
      'فالدرس التاني، بلان الدار العادي. الخطوط البيضين العراض هما الحيوط، والمربعات البرتقاليين فالزوايا هما السواري. القوس لي مرسوم عند الفتحة هو الباب واتجاه الفتحان ديالو. وهكا كتفرق بسهولة بين الصالون والكوزينة والبيوت.',
    steps: [
      'الحيوط الخارجية كتكون أغلظ (20–25 سم) من القواطع الداخلية (10 سم).',
      'القوس المرسوم كيبين الجهة لي كيتحل ليها الباب.',
      'المربعات الملونة فالزوايا هي مواقع السواري الخرسانية.',
    ],
  },
  {
    id: 'lesson-scale',
    title: 'قراءة السلم 1/100 وحساب المساحة الحقيقية',
    durationSec: 15,
    tag: 'فيديو قصير · القياسات',
    summaryDarija:
      'تعلم تحول القياس من الورقة للواقع وتحسب مساحة كل غرفة بالمتر مربع.',
    narrationDarija:
      'فالدرس الثالث، كيفاش تعرف المساحة الحقيقية من البلان. شوف لتحت فالورقة، إلا لقيتي السلم واحد على مية، معناها كل سنتيمتر بالمسطرة فوق الورقة كيساوي متر واحد فالأرض. وإلى كانت الغرفة فيها ربعة ميترو على تلاتة ميترو، كتضرب ربعة فتلاتة كتساوي طناش متر مربع.',
    steps: [
      'السلم 1/100: كل 1 سنتيم على الورقة = 1 متر في الأرض.',
      'المساحة = الطول × العرض (مثال: 4م × 3م = 12 متر مربع).',
      'ديما قارن الأرقام المكتوبة مع مجموع الواجهة كاملة.',
    ],
  },
  {
    id: 'lesson-mistakes',
    title: 'أخطاء خطيرة فالشانطي خاصك ترد ليها البال',
    durationSec: 16,
    tag: 'فيديو قصير · نصائح المعلم',
    summaryDarija:
      'تجنب نقصان الغطاء الخرساني على الحديد، التوصيل القصير للحديد، وقلة السقي ديال البيطون بالماء.',
    narrationDarija:
      'فالدرس الرابع: رد البال من تلاتة دالأخطاء فالشانطي. اللول، الحديد ما خاصوش يبان أو يلامس الخشب ديال الكوفراج، خاص تخلي جوج سنتيم ونص بالكالات. التاني، إلا وصلتي بار مع بار، خاصو يركب عليه خمسين مرة القطر. والتالت، ديما سقي الضالة والسواري بالما سبع يام متابعة باش ما يتشقش البيطون.',
    steps: [
      'الكالات (2.5 سنتيم): كتحمي الحديد من الصدأ والرطوبة.',
      'توصيل الحديد: خاص تداخل 60 سنتيم لحديد قطر 12.',
      'سقي البيطون بالماء لمدة 7 أيام كيحمي من التشققات.',
    ],
  },
];

function drawLessonFrame(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lessonId: string,
  progress: number
) {
  ctx.fillStyle = '#070b16';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 28) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (lessonId === 'lesson-rebar') {
    const cx = w * 0.34;
    const cy = h * 0.5;
    const size = Math.min(w, h) * 0.42;

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - size / 2, cy - size / 2, size, size);

    if (progress > 0.15) {
      ctx.strokeStyle = '#ff7a1a';
      ctx.lineWidth = 3;
      ctx.strokeRect(cx - size * 0.38, cy - size * 0.38, size * 0.76, size * 0.76);
    }

    const bars: [number, number][] = [
      [cx - size * 0.34, cy - size * 0.34],
      [cx + size * 0.34, cy - size * 0.34],
      [cx - size * 0.34, cy + size * 0.34],
      [cx + size * 0.34, cy + size * 0.34],
      [cx, cy - size * 0.34],
      [cx, cy + size * 0.34],
    ];
    const count = Math.min(bars.length, Math.floor(progress * 8));
    for (let i = 0; i < count; i++) {
      ctx.fillStyle = '#ff7a1a';
      ctx.beginPath();
      ctx.arc(bars[i][0], bars[i][1], 8, 0, Math.PI * 2);
      ctx.fill();
    }

    const gx = w * 0.62;
    const gy = h * 0.25;
    const gw = w * 0.28;
    const gh = h * 0.5;
    ctx.strokeStyle = progress > 0.5 ? '#22c55e' : 'rgba(34,197,94,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      const px = gx + (gw / 4) * i;
      const py = gy + (gh / 4) * i;
      if (progress > 0.35 + i * 0.08) {
        ctx.beginPath();
        ctx.moveTo(px, gy);
        ctx.lineTo(px, gy + gh);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(gx, py);
        ctx.lineTo(gx + gw, py);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px Cairo, sans-serif';
    ctx.fillText('سارية: 6 بارات قطر 12', cx, cy + size / 2 + 24);
    ctx.fillText('شبكة الضالة: مسافة 15-20 سم', gx + gw / 2, gy + gh + 24);
  } else if (lessonId === 'lesson-rooms') {
    const rx = w * 0.18;
    const ry = h * 0.2;
    const rw = w * 0.64;
    const rh = h * 0.6;

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 6;
    ctx.strokeRect(rx, ry, rw, rh);

    if (progress > 0.1) {
      ctx.fillStyle = '#ff7a1a';
      const cols: [number, number][] = [
        [rx - 8, ry - 8],
        [rx + rw - 8, ry - 8],
        [rx - 8, ry + rh - 8],
        [rx + rw - 8, ry + rh - 8],
        [rx + rw * 0.5 - 8, ry - 8],
        [rx + rw * 0.5 - 8, ry + rh - 8],
      ];
      cols.forEach(([x, y]) => ctx.fillRect(x, y, 16, 16));
    }

    if (progress > 0.3) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(rx + rw * 0.5, ry);
      ctx.lineTo(rx + rw * 0.5, ry + rh);
      ctx.stroke();
    }

    if (progress > 0.5) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(rx + rw * 0.25, ry + rh, 36, Math.PI, Math.PI * 1.5);
      ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Cairo, sans-serif';
    ctx.fillText('الصالون', rx + rw * 0.25, ry + rh * 0.5);
    ctx.fillText('الكوزينة', rx + rw * 0.75, ry + rh * 0.5);
  } else if (lessonId === 'lesson-scale') {
    const rx = w * 0.22;
    const ry = h * 0.26;
    const rw = w * 0.56 * Math.min(1, progress * 1.4 + 0.2);
    const rh = h * 0.44;

    ctx.fillStyle = 'rgba(255, 122, 26, 0.14)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 3;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px Cairo, sans-serif';
    ctx.fillText('الطول = 4 متر', rx + rw / 2, ry - 18);
    ctx.fillText('العرض = 3 متر', rx - 54, ry + rh / 2);

    if (progress > 0.45) {
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 20px Cairo, sans-serif';
      ctx.fillText('المساحة = 4 × 3 = 12 متر مربع', rx + rw / 2, ry + rh / 2);
    }

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 14px Cairo, sans-serif';
    ctx.fillText('السلم 1/100: كل 1 سم فالورقة = 1 متر فالواقع', w / 2, h - 22);
  } else {
    const rx = w * 0.15;
    const ry = h * 0.38;
    const rw = w * 0.7;
    const rh = h * 0.26;

    ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(rx, ry, rw, rh);

    ctx.strokeStyle = '#ff7a1a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(rx + 18, ry + rh * 0.4);
    ctx.lineTo(rx + rw * 0.62, ry + rh * 0.4);
    ctx.stroke();

    if (progress > 0.35) {
      ctx.strokeStyle = '#38bdf8';
      ctx.beginPath();
      ctx.moveTo(rx + rw * 0.38, ry + rh * 0.6);
      ctx.lineTo(rx + rw - 18, ry + rh * 0.6);
      ctx.stroke();
    }

    if (progress > 0.6) {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(rx + 40, ry + rh - 12, 16, 12);
      ctx.fillRect(rx + rw - 56, ry + rh - 12, 16, 12);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Cairo, sans-serif';
    ctx.fillText('التداخل بين الحديد: 50 × القطر (مثلاً 60 سم)', w / 2, ry - 24);
    ctx.fillStyle = '#22c55e';
    ctx.fillText('الكالات 2.5 سم تحت الحديد + سقي بالما 7 أيام', w / 2, ry + rh + 28);
  }
}

export const LearnView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const { speakPro, stop, settings } = useDarijaSpeech();
  const [activeLesson, setActiveLesson] = useState<Lesson>(LESSONS[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) drawLessonFrame(ctx, canvas.width, canvas.height, activeLesson.id, progress);
  }, [progress, activeLesson.id]);

  useEffect(() => {
    if (!isPlaying) return;
    const step = 50 / (activeLesson.durationSec * 1000);
    const id = window.setInterval(() => {
      setProgress((p) => {
        const next = p + step;
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
    }, 50);
    return () => window.clearInterval(id);
  }, [isPlaying, activeLesson.durationSec]);

  const selectAndPlay = (lesson: Lesson) => {
    setActiveLesson(lesson);
    setProgress(0);
    setIsPlaying(true);
    if (settings.voiceEnabled) {
      void speakPro(lesson.narrationDarija, { id: `learn-${lesson.id}`, useCloudTts: true });
    }
  };

  const togglePlay = () => {
    if (isPlaying) {
      setIsPlaying(false);
      stop();
    } else {
      if (progress >= 0.99) setProgress(0);
      setIsPlaying(true);
      if (settings.voiceEnabled) {
        void speakPro(activeLesson.narrationDarija, {
          id: `learn-${activeLesson.id}`,
          useCloudTts: true,
        });
      }
    }
  };

  const elapsedSec = Math.round(progress * activeLesson.durationSec);

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
            id="learn-hub-voice"
            variant="ghost"
            label="سمع الدليل"
            text="مرحبا بيك فقسم تعلم البلان. هنا كاين فيديوهات قصيرة مشروحة بالدارجة المغربية باش تتعلم كيفاش تقرا بلان الحديد، السواري، الغرف، وحساب المساحات."
          />
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold mb-1">
          <BookOpen className="w-4 h-4" />
          <span>أكاديمية فاهم بلان</span>
        </div>
        <h1 className="text-2xl font-extrabold text-white">تعلم تقرا البلان — فيديوهات مختصرة</h1>
        <p className="text-sm text-slate-400 mt-1">
          شاهد الشرح بالرسم المتحرك واسمع التفاصيل بالدارجة المغربية خطوة بخطوة
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 rounded-2xl border border-[#ff7a1a]/35 bg-[#11182c] overflow-hidden">
          <div className="relative bg-[#070b16] aspect-video">
            <canvas ref={canvasRef} width={720} height={405} className="w-full h-full object-contain" />
            {!isPlaying && progress === 0 && (
              <button
                type="button"
                onClick={togglePlay}
                aria-label="تشغيل الفيديو"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 hover:bg-black/30 transition-colors"
              >
                <div className="w-16 h-16 rounded-full bg-[#ff7a1a] text-[#0a0f1e] flex items-center justify-center shadow-xl">
                  <Play className="w-8 h-8 fill-current" />
                </div>
                <span className="text-sm font-extrabold text-white bg-[#0a0f1e]/80 px-4 py-1.5 rounded-xl">
                  شغل الفيديو بالدارجة
                </span>
              </button>
            )}
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max="100"
                value={Math.round(progress * 100)}
                onChange={(e) => setProgress(Number(e.target.value) / 100)}
                className="w-full accent-[#ff7a1a]"
              />
              <div className="flex items-center justify-between text-xs font-mono-nums text-slate-400">
                <span>00:{String(elapsedSec).padStart(2, '0')}</span>
                <span>00:{String(activeLesson.durationSec).padStart(2, '0')}</span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlay}
                  className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-5 py-2 text-sm font-extrabold"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{isPlaying ? 'توقيف' : 'تشغيل'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => selectAndPlay(activeLesson)}
                  className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-[#0a0f1e] px-3.5 py-2 text-xs font-bold text-slate-200"
                >
                  <RotateCcw className="w-4 h-4 text-[#ff7a1a]" />
                  <span>إعادة</span>
                </button>
              </div>
              <SpeakButton
                id={`lesson-speak-${activeLesson.id}`}
                variant="secondary"
                label="سمع الدرس كامل"
                text={activeLesson.narrationDarija}
              />
            </div>

            <div className="border-t border-white/10 pt-3 space-y-2">
              <p className="text-xs font-bold text-[#ff7a1a]">{activeLesson.tag}</p>
              <h2 className="text-lg font-extrabold text-white">{activeLesson.title}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{activeLesson.summaryDarija}</p>
              <ul className="space-y-1.5 pt-2">
                {activeLesson.steps.map((s, idx) => (
                  <li key={idx} className="text-xs sm:text-sm text-slate-200 flex items-start gap-2">
                    <span className="font-mono-nums text-[#ff7a1a] font-bold">0{idx + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-300">
            قائمة الدروس المختصرة ({LESSONS.length})
          </h3>
          {LESSONS.map((lesson, idx) => {
            const active = lesson.id === activeLesson.id;
            return (
              <button
                key={lesson.id}
                type="button"
                onClick={() => selectAndPlay(lesson)}
                className={`w-full text-right rounded-2xl border p-4 transition-colors space-y-1.5 ${
                  active
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/10'
                    : 'border-white/10 bg-[#11182c] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono-nums font-bold text-[#ff7a1a]">فيديو 0{idx + 1}</span>
                  <span className="font-mono-nums text-slate-400">{lesson.durationSec} ثانية</span>
                </div>
                <p className="text-sm font-bold text-white leading-snug">{lesson.title}</p>
                <p className="text-xs text-slate-400 line-clamp-2">{lesson.summaryDarija}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
