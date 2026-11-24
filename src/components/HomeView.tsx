import React from 'react';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  BookOpen,
  Camera,
  FolderKanban,
  Layers,
  Ruler,
  Upload,
  Wrench,
} from 'lucide-react';
import type { AppTab, SavedPlan } from '../types';
import { HERO_IMAGE, HOME_CAPABILITIES, SAMPLE_PLANS } from '../constants';
import { SpeakButton } from '../contexts/SpeechContext';

interface HomeViewProps {
  onOpenCamera: () => void;
  onSelectImageForAnalysis: (src: string) => void;
  onNavigate: (tab: AppTab) => void;
  recentPlans: SavedPlan[];
  onOpenSavedPlan: (plan: SavedPlan) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  onOpenCamera,
  onSelectImageForAnalysis,
  onNavigate,
  recentPlans,
  onOpenSavedPlan,
}) => {
  return (
    <div className="space-y-10 pb-8">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-3xl border border-white/10 bg-[#11182c] overflow-hidden"
      >
        <div className="grid lg:grid-cols-12 items-stretch">
          <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-[#ff7a1a]">
                  فاهم بلان · رفيق البناء المغربي
                </p>
                <SpeakButton
                  id="home-hero-welcome"
                  label="سمع الترحيب"
                  variant="ghost"
                  text="مرحباً بيك فـ تطبيق فاهم بلان! صور مخطط البناء ديالك بالكاميرا ولا رفعو من الهاتف، وغادي نشرح ليك كلشي بالدارجة المغربية بالصوت: نوع البناء، المساحة، الغرف، المواد المطلوبة ومراحل العمل بالترتيب."
                />
              </div>

              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight [text-wrap:balance]">
                صور بلان ديالك وفهمو بالدارجة في ثواني
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                غير صور المخطط ديال الدار ولا الشقة، والتطبيق كيقرا الغرف والمساحات، كيحسب المواد
                المطلوبة، وكيشرح ليك مراحل البني بالصوت بالدارجة المغربية.
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={onOpenCamera}
                className="w-full min-h-[64px] rounded-2xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-6 py-4 text-lg sm:text-xl font-extrabold flex items-center justify-center gap-3 shadow-xl shadow-[#ff7a1a]/20 transition-transform active:scale-[0.98]"
              >
                <Camera className="w-7 h-7 shrink-0" />
                <span>صور بلان ديالك</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="min-h-[48px] cursor-pointer rounded-xl border border-white/15 bg-[#16203a] hover:bg-[#1e2b4d] text-slate-100 px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors">
                  <Upload className="w-4 h-4 text-[#ff7a1a] shrink-0" />
                  <span>رفع صورة من الهاتف</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        if (typeof reader.result === 'string') {
                          onSelectImageForAnalysis(reader.result);
                        }
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => onNavigate('tools')}
                  className="min-h-[48px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-slate-100 px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <Wrench className="w-4 h-4 text-[#ff7a1a] shrink-0" />
                  <span>الأدوات والصندوق الذكي</span>
                </button>

                <button
                  type="button"
                  onClick={() => onNavigate('learn')}
                  className="min-h-[48px] rounded-xl border border-[#ff7a1a]/35 bg-[#ff7a1a]/10 hover:bg-[#ff7a1a]/20 text-[#ff7a1a] px-3 py-3 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <BookOpen className="w-4 h-4 shrink-0" />
                  <span>تعلم البلان (فيديو)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-[#0a0f1e]">
            <img
              src={HERO_IMAGE}
              alt="مكتب هندسي بمخطط بناء مغربي ومسطرة القياس"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/90 via-[#0a0f1e]/25 to-transparent flex flex-col justify-end p-6">
              <p className="text-sm font-bold text-white">تحليل ذكي للمخططات + شرح صوتي بالدارجة</p>
              <p className="text-xs text-slate-300 mt-1">
                قراءة فورية للغرف، السواري، الحديد، وحساب المواد بدقة
              </p>
            </div>
          </div>
        </div>
      </motion.section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-white">مخططات جاهزة للتجربة الفورية</h2>
            <p className="text-sm text-slate-400">
              اختار واحد من هادو وجرب كيفاش كيشرح بالدارجة
            </p>
          </div>
          <SpeakButton
            id="home-samples-audio"
            variant="ghost"
            label="سمع الفكرة"
            text="إلى ما كانش عندك بلان قدامك دابا، تقدر تورك على بلان الفيلا ولا بلان السواري والحديد الجاهز باش تجرب تحليل الذكاء الاصطناعي والشرح بالدارجة."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SAMPLE_PLANS.map((sample) => (
            <div
              key={sample.id}
              className="rounded-2xl border border-white/10 bg-[#11182c] overflow-hidden flex flex-col sm:flex-row items-stretch"
            >
              <div className="sm:w-44 h-40 sm:h-auto shrink-0 bg-[#0a0f1e]">
                <img
                  src={sample.src}
                  alt={sample.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-white">{sample.title}</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">{sample.meta}</p>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectImageForAnalysis(sample.src)}
                  className="min-h-[44px] w-full rounded-xl bg-[#ff7a1a]/15 border border-[#ff7a1a]/40 text-[#ff7a1a] hover:bg-[#ff7a1a] hover:text-[#0a0f1e] px-4 py-2 text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                >
                  <span>حلل هاد البلان</span>
                  <ArrowLeft className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-white">شنو كيعطيك فاهم بلان؟</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {HOME_CAPABILITIES.map((cap, idx) => (
            <div
              key={cap.id}
              className="rounded-2xl border border-white/10 bg-[#11182c] p-5 flex flex-col justify-between gap-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-nums text-xs font-semibold text-[#ff7a1a]">
                    0{idx + 1}
                  </span>
                  {idx === 0 && <Layers className="w-4 h-4 text-slate-400" />}
                  {idx === 1 && <Ruler className="w-4 h-4 text-slate-400" />}
                  {idx === 2 && <FolderKanban className="w-4 h-4 text-slate-400" />}
                  {idx === 3 && <Wrench className="w-4 h-4 text-slate-400" />}
                </div>
                <h3 className="text-base font-bold text-white">{cap.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{cap.desc}</p>
              </div>
              <SpeakButton id={cap.id} text={cap.voice} variant="ghost" label="سمع الشرح" />
            </div>
          ))}
        </div>
      </section>

      {recentPlans.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">آخر البلانات المحفوظة</h2>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-sm font-semibold text-[#ff7a1a] hover:underline min-h-[44px] px-2"
            >
              شوف الكل ({recentPlans.length})
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {recentPlans.slice(0, 3).map((plan) => (
              <div
                key={plan.id}
                className="rounded-2xl border border-white/10 bg-[#11182c] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-white truncate">{plan.title}</h3>
                    <SpeakButton
                      id={`recent-${plan.id}`}
                      text={plan.audioScript || plan.darijaSummary}
                      compact
                      variant="ghost"
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    {plan.buildingType} ·{' '}
                    <span className="tabular-nums">{plan.totalAreaSqm}</span> ·{' '}
                    <span className="tabular-nums">{plan.roomsCount}</span> غرف
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenSavedPlan(plan)}
                  className="min-h-[42px] w-full rounded-xl border border-white/10 bg-[#0a0f1e] hover:border-[#ff7a1a]/40 text-xs font-bold text-slate-200 transition-colors"
                >
                  فتح التفاصيل
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
