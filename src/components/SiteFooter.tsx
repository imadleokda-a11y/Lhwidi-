import React from 'react';
import { Mail, ShieldCheck } from 'lucide-react';
import { COMPANY_NAME, CONTACT_EMAIL, WHATSAPP_NUMBER, WHATSAPP_URL } from '../constants';

export type InfoPageId = 'privacy' | 'terms' | 'about' | 'contact';

interface SiteFooterProps {
  onOpenPage: (page: InfoPageId) => void;
  onOpenAdmin?: () => void;
  extraBottomPadding?: boolean;
}

export const SiteFooter: React.FC<SiteFooterProps> = ({
  onOpenPage,
  onOpenAdmin,
  extraBottomPadding = false,
}) => {
  return (
    <footer
      className={`border-t border-white/10 bg-[#0a0f1e] text-slate-300 ${
        extraBottomPadding ? 'pb-20 md:pb-0' : ''
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <img src="/icon.svg" alt="FAHEM" className="w-5 h-5 rounded shrink-0" />
              <span>{COMPANY_NAME} · فاهم بلان</span>
            </div>
            <p className="text-xs text-slate-400">
              منصة ذكية لتسيير أوراش البناء وفهم المخططات الهندسية للمقاولين والمهنيين في المغرب
            </p>
          </div>

          <nav
            aria-label="روابط قانونية ومعلومات"
            className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm font-semibold"
          >
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onOpenPage('privacy');
              }}
              className="text-slate-300 hover:text-[#ff7a1a] transition-colors py-1"
            >
              سياسة الخصوصية (Privacy Policy)
            </a>
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onOpenPage('terms');
              }}
              className="text-slate-300 hover:text-[#ff7a1a] transition-colors py-1"
            >
              الشروط والأحكام (Terms &amp; Conditions)
            </a>
            <a
              href="/about"
              onClick={(e) => {
                e.preventDefault();
                onOpenPage('about');
              }}
              className="text-slate-300 hover:text-[#ff7a1a] transition-colors py-1"
            >
              من نحن (About Us)
            </a>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                onOpenPage('contact');
              }}
              className="text-slate-300 hover:text-[#ff7a1a] transition-colors py-1"
            >
              تواصل معنا (Contact Us)
            </a>
          </nav>
        </div>

        <div className="pt-5 border-t border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <span>© {new Date().getFullYear()} {COMPANY_NAME}</span>
            <span aria-hidden="true">·</span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              dir="ltr"
              className="inline-flex items-center gap-1.5 text-slate-200 hover:text-[#ff7a1a] transition-colors font-medium"
            >
              <Mail className="w-3.5 h-3.5 text-[#ff7a1a] shrink-0" />
              <span>{CONTACT_EMAIL}</span>
            </a>
          </div>

          <div className="flex items-center gap-4">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              واتساب: <span dir="ltr">{WHATSAPP_NUMBER}</span>
            </a>
            {onOpenAdmin && (
              <button
                type="button"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1 hover:text-[#ff7a1a] transition-colors py-1"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>الإدارة</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};
