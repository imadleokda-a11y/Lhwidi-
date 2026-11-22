import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  MessageCircle,
  ShieldCheck,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '../constants';
import { SpeakButton, useDarijaSpeech } from '../contexts/SpeechContext';
import { MAX_CODE_TRIALS, useCodeAccess } from '../contexts/CodeContext';

interface SettingsViewProps {
  onOpenAdmin: () => void;
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onOpenAdmin, onBack }) => {
  const {
    settings,
    updateSettings,
    previewVoice,
    isConfirmingVoice,
    previewVoiceSelection,
    confirmVoiceSelection,
  } = useDarijaSpeech();
  const { activeCode, usedTrials, remainingTrials, switchCode } = useCodeAccess();

  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setAiConfigured(!!d?.aiConfigured))
      .catch(() => setAiConfigured(false));
  }, []);

  const selectedPersona = previewVoice ?? (settings.voiceGender === 'female' ? 'girl' : 'boy');

  return (
    <div className="space-y-6 pb-8 max-w-3xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white hover:bg-[#16203a]"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع</span>
        </button>
        <SpeakButton
          id="settings-intro-voice"
          variant="secondary"
          label="سمع الشرح"
          text="فهاد الصفحة تقدر تشعل ولا تطفي الصوت، تختار واش يهضر معاك صوت ولد ولا بنت، وتعدل سرعة القراءة، وتقدر تدير تجديد الكود ولا تدخل للإدارة."
        />
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-white">الضبط والإعدادات</h1>
        <p className="text-sm text-slate-400 mt-1">
          تحكم فالصوت بالدارجة، نوع المتكلم (ولد / بنت)، الاشتراك وإدارة المشاريع
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-[#11182c] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {settings.voiceEnabled ? (
              <Volume2 className="w-6 h-6 text-[#ff7a1a]" />
            ) : (
              <VolumeX className="w-6 h-6 text-slate-400" />
            )}
            <div>
              <h2 className="text-lg font-bold text-white">الشرح الصوتي بالدارجة</h2>
              <p className="text-xs text-slate-400">
                تفعيل القراءة الصوتية التلقائية ومكبر الصوت فكل صفحة
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => updateSettings({ voiceEnabled: !settings.voiceEnabled })}
            className={`min-h-[44px] px-5 rounded-xl text-sm font-extrabold transition-colors ${
              settings.voiceEnabled
                ? 'bg-[#ff7a1a] text-[#0a0f1e]'
                : 'bg-white/10 text-slate-300'
            }`}
          >
            {settings.voiceEnabled ? 'الصوت مشعل' : 'الصوت طافي'}
          </button>
        </div>

        <div className="border-t border-white/10 pt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">اختيار صوت المتكلم بالدارجة المغربية</span>
            <span className="text-[11px] text-[#ff7a1a]">أصوات ذكية نقية (ولد / بنت)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() =>
                previewVoiceSelection(
                  'boy',
                  'مرحبا بيك أخويا ف فاهم بلان، كيداير؟ أنا المعلم، غادي نشرح ليك المخطط بالدارجة المغربية بصوت راجل واضح.',
                  'settings-preview-boy',
                  true
                )
              }
              className={`min-h-[60px] rounded-xl border p-4 text-right transition-colors ${
                selectedPersona === 'boy'
                  ? 'border-[#ff7a1a] bg-[#ff7a1a]/15 text-white'
                  : 'border-white/10 bg-[#0a0f1e] text-slate-300 hover:border-white/25'
              }`}
            >
              <p className="text-sm font-extrabold">صوت ولد (المعلم)</p>
              <p className="text-xs text-slate-400 mt-1">صوت رجولي واضح ومباشر ديال البني</p>
            </button>

            <button
              type="button"
              onClick={() =>
                previewVoiceSelection(
                  'girl',
                  'أهلا ومرحبا بيك ف فاهم بلان، كيداير؟ أنا سلمى المهندسة، غادي نعاونك تفهم البلان خطوة بخطوة بالدارجة.',
                  'settings-preview-girl',
                  true
                )
              }
              className={`min-h-[60px] rounded-xl border p-4 text-right transition-colors ${
                selectedPersona === 'girl'
                  ? 'border-[#ff7a1a] bg-[#ff7a1a]/15 text-white'
                  : 'border-white/10 bg-[#0a0f1e] text-slate-300 hover:border-white/25'
              }`}
            >
              <p className="text-sm font-extrabold">صوت بنت (المهندسة)</p>
              <p className="text-xs text-slate-400 mt-1">صوت نسائي نقي ومرتب للتوضيح</p>
            </button>
          </div>

          {previewVoice && (
            <button
              type="button"
              disabled={isConfirmingVoice}
              onClick={() => void confirmVoiceSelection(true)}
              className="w-full min-h-[46px] rounded-xl bg-emerald-500 hover:bg-emerald-400 text-[#0a0f1e] text-sm font-extrabold transition-colors"
            >
              {isConfirmingVoice ? 'جاري التأكيد...' : 'تم · Confirm Selection'}
            </button>
          )}
        </div>

        <div className="border-t border-white/10 pt-4 space-y-2.5">
          <div className="flex items-center justify-between text-xs text-slate-300">
            <span className="font-bold">سرعة الكلام</span>
            <span className="font-mono-nums text-[#ff7a1a]">{settings.speechRate}x</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'بطيئة وواضحة', rate: 0.8 },
              { label: 'عادية', rate: 0.95 },
              { label: 'سريعة', rate: 1.15 },
            ].map((item) => (
              <button
                key={item.rate}
                type="button"
                onClick={() => updateSettings({ speechRate: item.rate })}
                className={`min-h-[42px] rounded-xl text-xs font-bold border transition-colors ${
                  Math.abs(settings.speechRate - item.rate) < 0.05
                    ? 'border-[#ff7a1a] bg-[#ff7a1a]/15 text-white'
                    : 'border-white/10 bg-[#0a0f1e] text-slate-300'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <SpeakButton
            id="settings-test-darija"
            variant="primary"
            label="جرب الصوت بالدارجة دابا"
            text="تبارك الله عليك! هاد الصوت خدام مزيان باش يشرح ليك بلان الدار، المساحات، الغرف، السيما والحديد بالدارجة المغربية."
          />
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#11182c] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-white">حالة الاشتراك والكود</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              كل كود عندو {MAX_CODE_TRIALS} تحاليل ذكية — للتجديد تواصل معنا فـ واتساب {WHATSAPP_NUMBER}
            </p>
          </div>
          <span className="text-xs font-mono-nums font-bold px-3 py-1.5 rounded-xl bg-[#0a0f1e] border border-[#ff7a1a]/35 text-[#ff7a1a]">
            {activeCode || '---'} · باقي {remainingTrials}/{MAX_CODE_TRIALS}
          </span>
        </div>
        <p className="text-xs text-slate-300">
          أنت داخل بكود {activeCode || 'غير محدد'}. استعملتي {usedTrials} من أصل {MAX_CODE_TRIALS}{' '}
          تحاليل، وباقي ليك {remainingTrials}.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-extrabold"
          >
            <MessageCircle className="w-4 h-4" />
            <span>تجديد الاشتراك</span>
          </a>
          <button
            type="button"
            onClick={switchCode}
            className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-4 py-2 text-xs font-bold text-slate-200"
          >
            تبديل الكود
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#11182c] p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Cpu className="w-6 h-6 text-[#ff7a1a]" />
            <div>
              <h2 className="text-lg font-bold text-white">محرك رؤية الجوزاء (Gemini Vision)</h2>
              <p className="text-xs text-slate-400">الاتصال كيدوز بشكل آمن ومباشر عبر الخادم</p>
            </div>
          </div>
          <span
            className={`text-xs font-bold px-3 py-1 rounded-lg ${
              aiConfigured === true
                ? 'bg-emerald-500/15 text-emerald-300'
                : aiConfigured === false
                  ? 'bg-amber-500/15 text-amber-300'
                  : 'bg-white/5 text-slate-400'
            }`}
          >
            {aiConfigured === true
              ? 'متصل وجاهز'
              : aiConfigured === false
                ? 'غير مهيأ'
                : 'جاري التحقق'}
          </span>
        </div>

        <div className="border-t border-white/10 pt-4 flex flex-wrap items-center justify-between gap-3">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 text-xs font-extrabold"
          >
            <MessageCircle className="w-4 h-4" />
            <span>تواصل واتساب: {WHATSAPP_NUMBER}</span>
          </a>
          <button
            type="button"
            onClick={onOpenAdmin}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold text-slate-300 hover:text-white"
          >
            <ShieldCheck className="w-4 h-4 text-[#ff7a1a]" />
            <span>لوحة الإدارة (/admin)</span>
          </button>
        </div>
      </section>
    </div>
  );
};
