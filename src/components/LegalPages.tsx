import React from 'react';
import {
  ArrowRight,
  Building2,
  FileText,
  Mail,
  MessageCircle,
  Shield,
} from 'lucide-react';
import { COMPANY_NAME, CONTACT_EMAIL, WHATSAPP_NUMBER, WHATSAPP_URL } from '../constants';
import { SiteFooter, type InfoPageId } from './SiteFooter';

interface LegalPagesProps {
  page: InfoPageId;
  onBack: () => void;
  onOpenPage: (page: InfoPageId) => void;
  onOpenAdmin?: () => void;
}

export const LegalPagesView: React.FC<LegalPagesProps> = ({
  page,
  onBack,
  onOpenPage,
  onOpenAdmin,
}) => {
  return (
    <div className="min-h-screen bg-[#0a0f1e] blueprint-grid text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 h-14 border-b border-white/10 bg-[#0a0f1e]/95 backdrop-blur-md">
        <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <img src="/icon.svg" alt={COMPANY_NAME} className="w-7 h-7 rounded-lg shrink-0" />
            <span>{COMPANY_NAME} · فاهم بلان</span>
          </button>

          <button
            type="button"
            onClick={onBack}
            className="min-h-[40px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] hover:bg-[#16203a] px-4 py-2 text-xs sm:text-sm font-bold text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
            <span>رجوع للتطبيق</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        <nav aria-label="التنقل بين الصفحات التعريفية" className="flex flex-wrap gap-2">
          {(
            [
              { id: 'privacy', label: 'سياسة الخصوصية · Privacy Policy' },
              { id: 'terms', label: 'الشروط والأحكام · Terms' },
              { id: 'about', label: 'من نحن · About Us' },
              { id: 'contact', label: 'تواصل معنا · Contact Us' },
            ] as Array<{ id: InfoPageId; label: string }>
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onOpenPage(tab.id)}
              className={`min-h-[42px] px-4 py-2 rounded-xl text-xs sm:text-sm font-bold border transition-colors ${
                page === tab.id
                  ? 'bg-[#ff7a1a] text-[#0a0f1e] border-[#ff7a1a]'
                  : 'bg-[#11182c] text-slate-300 border-white/10 hover:text-white hover:border-white/25'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {page === 'privacy' && (
          <article className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-10 space-y-8">
            <div className="space-y-2 border-b border-white/10 pb-6">
              <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
                <Shield className="w-4 h-4 shrink-0" />
                <span>{COMPANY_NAME} · Privacy Policy</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                سياسة الخصوصية — Privacy Policy
              </h1>
              <p className="text-xs text-slate-400">
                آخر تحديث: نوفمبر 2026 · الجهة المسؤولة: {COMPANY_NAME} ({CONTACT_EMAIL})
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                1. المعطيات التي نجمعها (What Data We Collect)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                يجمع تطبيق <strong>{COMPANY_NAME}</strong> الحد الأدنى فقط من المعطيات اللازمة لتشغيل
                الخدمة: رمز الدخول الخاص باشتراكك، صور المخططات الهندسية أو الشقوق التي ترفعها
                بنفسك وقت التحليل، الملاحظات الصوتية والمشاريع التي تختار حفظها محلياً على جهازك،
                والمعطيات التقنية الأساسية اللازمة لحماية الاتصال ومنع إساءة الاستخدام.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                FAHEM collects only the minimum data needed to deliver the service: your subscriber
                access code, blueprint or site images you explicitly submit for analysis, project
                notes stored locally on your device, and essential technical request logs for
                security and reliability.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                2. كيف نستعمل معطياتك (How We Use Your Data)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                نستعمل صور المخططات والنصوص المرسلة فقط لتقديم التحليل الهندسي المبسط، حساب مواد
                البناء، وتشغيل الشرح الصوتي بالدارجة المغربية بناءً على طلبك المباشر. لا نستخدم
                معطياتك الشخصية في بيع الإعلانات ولا نستغل ملفات مشاريعك لأي غرض تجاري خارج تقديم
                الخدمة لك.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                Uploaded blueprints and queries are used strictly to generate your requested
                construction breakdowns, material estimates, and Darija voice explanations. We never
                use your project files for unauthorized profiling or commercial resale.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                3. خصوصية واستقلالية بيانات كل مستخدم (Private &amp; Separate User Data)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                بيانات كل مستخدم ورمز اشتراكه ومشاريعه المحفوظة تبقى خاصة به ومنفصلة تماماً عن
                باقي المستخدمين. يتم حفظ مشاريعك وملاحظاتك الصوتية محلياً داخل متصفح جهازك بشكل
                معزول، ولا يمكن لأي مستخدم آخر الاطلاع عليها أو الوصول إلى مخططاتك.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                Each user&apos;s workspace, saved plans, voice notes, and access code allowance are
                strictly private and isolated. No other subscriber or visitor can access your saved
                projects or uploaded blueprints.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                4. عدم مشاركة البيانات مع الغير (No Sharing With Third Parties)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                نحن لا نبيع ولا نؤجر ولا نشارك بياناتك أو مخططات البناء الخاصة بك مع أي أطراف خارجية
                أو شركات تسويق، باستثناء المعالجة التقنية الفورية والضرورية لتنفيذ التحليل الذي طلبته
                دون الاحتفاظ الدائم بصورك.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                We do not sell, rent, or share user data with third parties, advertisers, or brokers.
                Submitted media is processed solely to return your requested analysis response.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                5. كيفاش تمسح معطياتك (How You Can Delete Your Data)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                يمكنك مسح مشاريعك وملاحظاتك الصوتية في أي وقت مباشرة من داخل صفحة{' '}
                <strong>المشاريع</strong> أو عبر مسح بيانات التطبيق من إعدادات المتصفح. كما يمكنك
                طلب الحذف النهائي لرمز اشتراكك وأي سجل مرتبط به في أي وقت بمراسلتنا عبر البريد
                الإلكتروني{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  dir="ltr"
                  className="text-[#ff7a1a] underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                أو عبر واتساب على الرقم <span dir="ltr">{WHATSAPP_NUMBER}</span>.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                You may delete saved plans and notes anytime directly inside the app or by clearing
                browser storage. To request full deletion of any access-code record, email{' '}
                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="text-[#ff7a1a] underline underline-offset-4"
                >
                  {CONTACT_EMAIL}
                </a>{' '}
                and we will process your request promptly.
              </p>
            </section>
          </article>
        )}

        {page === 'terms' && (
          <article className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-10 space-y-8">
            <div className="space-y-2 border-b border-white/10 pb-6">
              <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
                <FileText className="w-4 h-4 shrink-0" />
                <span>{COMPANY_NAME} · Terms and Conditions</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                الشروط والأحكام — Terms &amp; Conditions
              </h1>
              <p className="text-xs text-slate-400">
                شروط استخدام منصة {COMPANY_NAME}
              </p>
            </div>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                1. كيفية استخدام التطبيق (How to Use the App)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                منصة <strong>{COMPANY_NAME}</strong> مصممة لمساعدة المقاولين، المعلمين، وأصحاب
                المشاريع على قراءة مخططات البناء، فهم التفاصيل بالدارجة المغربية صوتاً وصورة، وتقدير
                كميات المواد الأولية واستعمال الأدوات الميدانية بشكل قانوني ومهني. يُمنع محاولة
                اختراق الخدمة أو استغلالها خارج نطاقها المخصص.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                FAHEM is designed to help contractors, builders, and project owners read
                construction blueprints, understand structural details in Darija audio, and estimate
                site materials. Misuse, scraping, or unauthorized tampering with the platform is
                prohibited.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                2. الاشتراك والأكواد (Subscription &amp; Access)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                يتيح التطبيق تجربة مجانية مبدئية برمز الافتتاح، وبعدها يتم تفعيل أو تجديد الاشتراك
                عبر رموز دخول رسمية مخصصة لكل مشترك. كل رمز دخول مرتبط بعدد استخدامات محدد ويُمنع
                إعادة بيعه أو نشره للعموم دون موافقة إدارة {COMPANY_NAME}.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                Users may evaluate the app through the provided trial access and upgrade via official
                subscriber access codes issued by FAHEM. Access codes are personal to the subscriber
                and may not be resold without authorization.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-extrabold text-white">
                3. مسؤولية المستخدم (User Responsibility)
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                التقديرات الحسابية، قراءات المخططات بالذكاء الاصطناعي، ونتائج المستشعرات الهاتفية
                تُقدَّم كأداة مساعدة وإرشادية لتسهيل العمل في الورش. تبقى المسؤولية التقنية
                والهندسية الكاملة عن التحقق النهائي من القياسات، سلامة التسليح، والتنفيذ في الميدان
                على عاتق المستخدم والمقاول والمهندس المشرف على الورش.
              </p>
              <p className="text-sm text-slate-400 leading-relaxed" dir="ltr">
                AI blueprint explanations, material estimations, and mobile sensor tools are provided
                as operational assistance. Final structural verification, safety compliance, and
                on-site execution remain the sole responsibility of the user, contractor, and
                licensed engineer.
              </p>
            </section>
          </article>
        )}

        {page === 'about' && (
          <article className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-10 space-y-8">
            <div className="space-y-2 border-b border-white/10 pb-6">
              <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
                <Building2 className="w-4 h-4 shrink-0" />
                <span>{COMPANY_NAME} · About Us</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                من نحن — À propos — About {COMPANY_NAME}
              </h1>
              <p className="text-xs text-slate-400">
                تطبيق تسيير أوراش البناء وقراءة المخططات للمقاولين في المغرب
              </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <section className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6 space-y-2.5">
                <h2 className="text-lg font-extrabold text-[#ff7a1a]">بالعربية</h2>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  <strong>{COMPANY_NAME}</strong> (فاهم بلان) هو تطبيق مغربي متخصص في تسيير أوراش
                  البناء ومساعدة المقاولين، المعلمين، والمهنيين في المغرب على قراءة وفهم المخططات
                  الهندسية بالدارجة المغربية صوتاً وصورة، مع أدوات دقيقة لحساب مواد البناء، متابعة
                  مراحل العمل، وتنظيم المشاريع بسهولة من الهاتف.
                </p>
              </section>

              <section
                dir="ltr"
                className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6 space-y-2.5 text-left"
              >
                <h2 className="text-lg font-extrabold text-[#ff7a1a]">En Français</h2>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  <strong>{COMPANY_NAME}</strong> est une application marocaine de gestion de
                  chantiers conçue pour les entrepreneurs, maîtres d&apos;ouvrage et professionnels
                  du bâtiment au Maroc. Elle permet d&apos;analyser les plans d&apos;architecture et
                  de béton armé avec des explications audio claires en darija marocaine, de calculer
                  les quantités de matériaux et d&apos;utiliser des outils pratiques directement sur
                  le chantier.
                </p>
              </section>

              <section
                dir="ltr"
                className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6 space-y-2.5 text-left"
              >
                <h2 className="text-lg font-extrabold text-[#ff7a1a]">In English</h2>
                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  <strong>{COMPANY_NAME}</strong> is a construction management and blueprint
                  intelligence application built for contractors and builders in Morocco. It helps
                  professionals understand architectural and structural plans through clear Moroccan
                  Darija voice explanations, estimate building materials accurately, and manage site
                  tasks directly from their mobile phones.
                </p>
              </section>
            </div>
          </article>
        )}

        {page === 'contact' && (
          <article className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-10 space-y-8">
            <div className="space-y-2 border-b border-white/10 pb-6">
              <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
                <Mail className="w-4 h-4 shrink-0" />
                <span>{COMPANY_NAME} · Contact Us</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
                تواصل معنا — Contact Us
              </h1>
              <p className="text-sm text-slate-300">
                فريق <strong>{COMPANY_NAME}</strong> رهن إشارتكم لأي استفسار، دعم تقني، تفعيل
                اشتراك، أو طلب حذف البيانات.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-[#ff7a1a]">الشركة · Company</p>
                  <h2 className="text-xl font-extrabold text-white">{COMPANY_NAME}</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    للاستفسارات الرسمية، الدعم، أو طلبات الخصوصية وحذف المعطيات، تقدر تراسلنا عبر
                    البريد الإلكتروني:
                  </p>
                  <p dir="ltr" className="text-sm sm:text-base font-mono-nums font-bold text-white">
                    {CONTACT_EMAIL}
                  </p>
                </div>

                <a
                  href={`mailto:${CONTACT_EMAIL}`}
                  className="min-h-[48px] w-full rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-5 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" />
                  <span>إرسال إيميل إلى {COMPANY_NAME}</span>
                </a>
              </div>

              <div className="rounded-2xl border border-white/10 bg-[#0a0f1e]/80 p-6 flex flex-col justify-between gap-5">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-emerald-400">الدعم السريع · WhatsApp</p>
                  <h2 className="text-xl font-extrabold text-white">تواصل عبر واتساب</h2>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    للتفعيل السريع لأكواد الاشتراك أو المساعدة المباشرة في استعمال التطبيق:
                  </p>
                  <p dir="ltr" className="text-base font-mono-nums font-bold text-white">
                    {WHATSAPP_NUMBER}
                  </p>
                </div>

                <a
                  href={WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[48px] w-full rounded-xl bg-[#25D366] hover:bg-[#1ebe5b] text-[#062411] px-5 py-3 text-sm font-extrabold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 shrink-0" />
                  <span>تواصل عبر واتساب</span>
                </a>
              </div>
            </div>
          </article>
        )}
      </main>

      <SiteFooter onOpenPage={onOpenPage} onOpenAdmin={onOpenAdmin} />
    </div>
  );
};
