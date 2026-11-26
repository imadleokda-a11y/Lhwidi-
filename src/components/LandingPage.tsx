import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpenCheck,
  CheckCircle2,
  Headphones,
  LogIn,
  Play,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { HERO_IMAGE, WHATSAPP_NUMBER, WHATSAPP_URL } from '../constants';
import { useDarijaSpeech } from '../contexts/SpeechContext';

interface LandingPageProps {
  onEnterApp: () => void;
  onOpenAdmin: () => void;
}

const STEPS = [
  {
    num: '01',
    title: 'كتدخل',
    desc: 'كتحل التطبيق من تيليفونك ولا بيسي وكتبدأ مباشرة بلا تعقيد.',
    icon: LogIn,
  },
  {
    num: '02',
    title: 'كتختار الدرس',
    desc: 'كتختار الدرس ولا كترفع الصورة اللي باغي تفهمها بضغطة وحدة.',
    icon: BookOpenCheck,
  },
  {
    num: '03',
    title: 'كتسمع الشرح بالصوت',
    desc: 'الصوت بالدارجة المغربية كيشرح لك كل حاجة بوضوح وبهدوء.',
    icon: Headphones,
  },
  {
    num: '04',
    title: 'كتفهم',
    desc: 'كتشد الفكرة بسرعة وكتعرف شنو خاصك دير خطوة بخطوة.',
    icon: CheckCircle2,
  },
];

const WHY_ITEMS = [
  {
    id: 'why-voice',
    num: '01',
    title: 'شرح بالصوت بالدارجة',
    desc: 'بلا ما تحماق مع القراية بزاف، الشرح كيوصلك بصوت واضح بالدارجة المغربية القريبة ليك.',
    icon: Volume2,
  },
  {
    id: 'why-easy',
    num: '02',
    title: 'ساهل',
    desc: 'واجهة نقية ومرتبة كتخدم بسلاسة فالتيليفون، أي واحد يقدر يستعملها من أول مرة.',
    icon: Sparkles,
  },
  {
    id: 'why-fast',
    num: '03',
    title: 'كتفهم بسرعة',
    desc: 'كتوصل للمعلومة المفيدة مباشرة فـ وقت قصير وبلا ضياع الوقت فالشروحات الطويلة.',
    icon: Zap,
  },
];

export const LandingPage: React.FC<LandingPageProps> = ({ onEnterApp, onOpenAdmin }) => {
  const { isSpeaking, isLoadingAudio, activeSpeechId, speakPro, stop } = useDarijaSpeech();
  const [videoNoticeOpen, setVideoNoticeOpen] = useState(false);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const isPlayingIntro = isSpeaking && activeSpeechId === 'landing-voice-demo';

  const handleToggleIntroVoice = () => {
    if (isPlayingIntro) {
      stop();
      return;
    }
    void speakPro(
      'مرحبا بيك فـ فاهم البلان. مع هاد التطبيق كتدخل، كتختار الدرس، كتسمع الشرح بالصوت بالدارجة المغربية، وكتفهم كلشي بسهولة وبسرعة.',
      { id: 'landing-voice-demo' }
    );
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] blueprint-grid text-slate-100 flex flex-col">
      {/* Top Bar Contract: Wordmark — Single-line Nav — Primary CTA */}
      <header className="sticky top-0 z-30 h-14 border-b border-white/10 bg-[#0a0f1e]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <img src="/icon.svg" alt="شعار فاهم البلان" className="w-7 h-7 rounded-lg shrink-0" />
            <span>فاهم البلان</span>
          </a>

          <nav
            aria-label="روابط الصفحة"
            className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-300"
          >
            <a
              href="#how-it-works"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              كيفاش كيخدم
            </a>
            <a
              href="#why"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              علاش فاهم البلان
            </a>
            <a
              href="#video-space"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              الفيديو
            </a>
            <a
              href="#pricing"
              className="hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              الأسعار
            </a>
          </nav>

          <button
            type="button"
            onClick={onEnterApp}
            className="min-h-[40px] rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-4 py-2 text-xs sm:text-sm font-extrabold transition-colors whitespace-nowrap shrink-0"
          >
            جرب مجانا
          </button>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* 1. Hero Section */}
        <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-12 sm:pt-12 sm:pb-16">
          <div className="rounded-3xl border border-white/10 bg-[#11182c] overflow-hidden">
            <div className="grid lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-7 p-6 sm:p-10 lg:p-12 flex flex-col justify-between gap-8">
                <div className="space-y-5">
                  <p className="text-sm font-semibold text-[#ff7a1a]">
                    شرح صوتي بالدارجة المغربية · ساهل وواضح فالتيليفون
                  </p>

                  <h1 className="text-[clamp(2rem,4.2vw,3.4rem)] font-extrabold text-white leading-[1.22] [text-wrap:balance]">
                    فاهم البلان - فهم الدرس بسهولة
                  </h1>

                  <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
                    تطبيق مبسط كيشرح لك الدروس والمخططات بالصوت بالدارجة المغربية: كتدخل، كتختار
                    الدرس، كتسمع الشرح بالصوت، وكتفهم كلشي بلا تعقيد.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={onEnterApp}
                      className="min-h-[58px] rounded-2xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-8 py-4 text-lg font-extrabold inline-flex items-center justify-center gap-2.5 shadow-lg shadow-[#ff7a1a]/20 transition-transform active:scale-[0.98] whitespace-nowrap"
                    >
                      <span>جرب مجانا</span>
                      <ArrowLeft className="w-5 h-5 shrink-0" />
                    </button>

                    <button
                      type="button"
                      onClick={handleToggleIntroVoice}
                      className="min-h-[58px] rounded-2xl border border-white/15 bg-[#16203a] hover:bg-[#1e2b4d] text-white px-6 py-4 text-sm sm:text-base font-bold inline-flex items-center justify-center gap-2.5 transition-colors whitespace-nowrap"
                    >
                      {isPlayingIntro ? (
                        <>
                          <VolumeX className="w-5 h-5 text-[#ff7a1a] shrink-0" />
                          <span>{isLoadingAudio ? 'جاري التحميل...' : 'حبس الصوت'}</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-5 h-5 text-[#ff7a1a] shrink-0" />
                          <span>سمع الشرح بالصوت</span>
                        </>
                      )}
                    </button>
                  </div>

                  <p className="text-xs text-slate-400">
                    كتدخل مباشرة من الهاتف أو الحاسوب · تجربة مجانية قبل الاشتراك
                  </p>
                </div>
              </div>

              <div className="lg:col-span-5 relative min-h-[240px] lg:min-h-full bg-[#0a0f1e] border-t lg:border-t-0 lg:border-r border-white/10">
                {heroImgFailed ? (
                  <div className="w-full h-full min-h-[240px] flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-[#16203a] to-[#0a0f1e]">
                    <Volume2 className="w-12 h-12 text-[#ff7a1a] mb-3" />
                    <p className="text-base font-bold text-white">فاهم البلان</p>
                    <p className="text-xs text-slate-300 mt-1">فهم الدرس بالصوت وبالدارجة</p>
                  </div>
                ) : (
                  <img
                    src={HERO_IMAGE}
                    alt="فاهم البلان - الشرح بالصوت والمخططات الواضحة"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e]/90 via-[#0a0f1e]/30 to-transparent flex flex-col justify-end p-6">
                  <p className="text-sm font-bold text-white">شرح واضح بالصوت خطوة بخطوة</p>
                  <p className="text-xs text-slate-300 mt-1">
                    مناسب للمراجعة والفهم السريع فـ أي وقت
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. How it works */}
        <section
          id="how-it-works"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 border-t border-white/10"
        >
          <div className="space-y-3 mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]">
              كيفاش كيخدم التطبيق؟
            </h2>
            <p className="text-base text-slate-300">
              أربع خطوات بساط باش توصل للفهم من الدقيقة اللولة:
              <span className="text-white font-bold">
                {' '}
                كتدخل · كتختار الدرس · كتسمع الشرح بالصوت · كتفهم
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="rounded-2xl border border-white/10 bg-[#11182c] p-6 flex flex-col justify-between gap-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-nums text-sm font-bold text-[#ff7a1a]">
                      {step.num}
                    </span>
                    <Icon className="w-5 h-5 text-slate-400 shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg font-extrabold text-white">{step.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Why Fahem Blan */}
        <section
          id="why"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 border-t border-white/10"
        >
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]">
                علاش فاهم البلان؟
              </h2>
              <p className="text-base text-slate-300">
                مصاوب باش يخلي الفهم ساهل وقريب ليك بالدارجة المغربية
              </p>
            </div>

            <button
              type="button"
              onClick={handleToggleIntroVoice}
              className="min-h-[44px] self-start sm:self-auto rounded-xl border border-[#ff7a1a]/40 bg-[#11182c] hover:bg-[#16203a] text-[#ff7a1a] px-4 py-2.5 text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Volume2 className="w-4 h-4 shrink-0" />
              <span>{isPlayingIntro ? 'وقف التجربة الصوتية' : 'جرب تسمع الصوت دابا'}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            {WHY_ITEMS.map((item, idx) => {
              const Icon = item.icon;
              const colSpan = idx === 0 ? 'md:col-span-6' : 'md:col-span-3';
              return (
                <div
                  key={item.id}
                  className={`${colSpan} rounded-2xl border border-white/10 bg-[#11182c] p-6 flex flex-col justify-between gap-4`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono-nums text-xs font-bold text-[#ff7a1a]">
                      {item.num}
                    </span>
                    <Icon className="w-5 h-5 text-[#ff7a1a] shrink-0" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-extrabold text-white">{item.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 4. Video Space Placeholder with Play Button */}
        <section
          id="video-space"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-14 border-t border-white/10"
        >
          <div className="space-y-2 mb-6">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]">
              بلاصة الفيديو
            </h2>
            <p className="text-base text-slate-300">
              شوف كيفاش كيخدم فاهم البلان بالصوت والصورة من داخل التطبيق
            </p>
          </div>

          <div className="relative aspect-video w-full rounded-3xl border border-white/10 bg-[#11182c] overflow-hidden flex items-center justify-center p-6">
            <div className="absolute inset-0 blueprint-grid opacity-70 pointer-events-none" />

            {!videoNoticeOpen ? (
              <div className="relative z-10 flex flex-col items-center text-center gap-4">
                <button
                  type="button"
                  onClick={() => setVideoNoticeOpen(true)}
                  aria-label="تشغيل الفيديو"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] flex items-center justify-center shadow-2xl shadow-[#ff7a1a]/30 transition-transform hover:scale-105 active:scale-95"
                >
                  <Play className="w-9 h-9 sm:w-10 sm:h-10 fill-current translate-x-0.5" />
                </button>
                <div className="space-y-1">
                  <p className="text-base sm:text-lg font-extrabold text-white">
                    فيديو الشرح التطبيقي
                  </p>
                  <p className="text-xs sm:text-sm text-slate-400">
                    ورك على Play للمعاينة (غادي يتزاد الفيديو هنا قريباً)
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative z-10 max-w-md text-center space-y-4">
                <p className="text-lg font-extrabold text-white">بلاصة الفيديو جاهزة</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  الفيديو التوضيحي غادي يتزاد فـ هاد البلاصة قريباً. فهاد الأثناء تقدر تسمع الشرح
                  بالصوت أو تدخل تجرب التطبيق مجاناً مباشرة.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={onEnterApp}
                    className="min-h-[44px] rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-5 py-2.5 text-sm font-extrabold transition-colors"
                  >
                    جرب مجانا
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoNoticeOpen(false)}
                    className="min-h-[44px] rounded-xl border border-white/15 bg-[#0a0f1e] hover:bg-white/5 text-slate-200 px-5 py-2.5 text-sm font-bold transition-colors"
                  >
                    رجوع
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 5. Pricing Section (Open placeholder for upcoming price) */}
        <section
          id="pricing"
          className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 border-t border-white/10"
        >
          <div className="space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white [text-wrap:balance]">
              الأسعار
            </h2>
            <p className="text-base text-slate-300">
              بدا بالتجربة المجانية دابا، وثمن الاشتراك الرسمي غادي يتحدد قريباً
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Free Trial Card */}
            <div className="rounded-3xl border border-[#ff7a1a]/45 bg-[#11182c] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-bold text-[#ff7a1a]">بداية سريعة</p>
                <h3 className="text-2xl font-extrabold text-white">التجربة المجانية</h3>
                <p className="text-3xl font-extrabold text-white font-mono-nums">0 درهم</p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  دخل دابا وجرب الشرح بالصوت بالدارجة وفهم الدروس والمخططات قبل ما تخلص أي حاجة.
                </p>
              </div>

              <button
                type="button"
                onClick={onEnterApp}
                className="min-h-[52px] w-full rounded-2xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-6 py-3.5 text-base font-extrabold flex items-center justify-center gap-2 transition-colors"
              >
                <span>جرب مجانا</span>
                <ArrowLeft className="w-5 h-5 shrink-0" />
              </button>
            </div>

            {/* Price Placeholder Card */}
            <div className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-8 flex flex-col justify-between gap-6">
              <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400">الاشتراك الكامل</p>
                <h3 className="text-2xl font-extrabold text-white">الباقة الشهرية / السنوية</h3>
                <p className="text-2xl sm:text-3xl font-extrabold text-slate-200">
                  الثمن غادي يتزاد قريباً
                </p>
                <p className="text-sm text-slate-300 leading-relaxed">
                  هاد البلاصة مخصصة للثمن الرسمي ديال الاشتراك. إلا بغيتي الكود ديالك دابا تقدر
                  تتواصل معنا مباشرة فـ واتساب.
                </p>
              </div>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[52px] w-full rounded-2xl border border-white/15 bg-[#16203a] hover:bg-[#1e2b4d] text-white px-6 py-3.5 text-base font-bold flex items-center justify-center gap-2 transition-colors"
              >
                <span>تواصل عبر واتساب {WHATSAPP_NUMBER}</span>
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-white/10 bg-[#0a0f1e]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">فاهم البلان</span>
            <span aria-hidden="true">·</span>
            <span>فهم الدرس بسهولة بالصوت بالدارجة</span>
          </div>

          <div className="flex items-center gap-5">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              واتساب {WHATSAPP_NUMBER}
            </a>
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1 hover:text-[#ff7a1a] transition-colors py-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>الإدارة</span>
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
