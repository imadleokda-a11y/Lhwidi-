import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { KeyRound, Lock, ShieldCheck, X } from 'lucide-react';
import type { SubscriberCode } from '../types';
import { WHATSAPP_NUMBER, WHATSAPP_URL } from '../constants';
import { SpeakButton } from './SpeechContext';

const USER_CODE_KEY = 'fahem_user_code';
const CODES_LIST_KEY = 'fahem_codes';
const TRIALS_KEY = (code: string) => `fahem_trials_${code.trim().toUpperCase()}`;

export const MAX_CODE_TRIALS = 10;

const DEFAULT_CODES: SubscriberCode[] = [
  {
    id: 'default_vip',
    ownerId: 'system',
    name: 'كود الافتتاح VIP',
    code: 'FAHEM2026',
    isActive: true,
    trials: 0,
    createdAtMs: Date.now(),
    updatedAtMs: Date.now(),
    syncedToCloud: false,
  },
];

export function loadStoredCodes(): SubscriberCode[] {
  try {
    const raw = localStorage.getItem(CODES_LIST_KEY);
    if (!raw) {
      localStorage.setItem(CODES_LIST_KEY, JSON.stringify(DEFAULT_CODES));
      return DEFAULT_CODES;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_CODES;
    return parsed.map((c) => ({
      id: String(c.id || `code_${Date.now()}`),
      ownerId: String(c.ownerId || 'local'),
      name: String(c.name || 'مشترك'),
      code: String(c.code || '').trim().toUpperCase(),
      isActive: typeof c.isActive === 'boolean' ? c.isActive : true,
      trials: Number.isFinite(Number(c.trials)) ? Math.max(0, Number(c.trials)) : 0,
      createdAtMs: Number(c.createdAtMs || Date.now()),
      updatedAtMs: Number(c.updatedAtMs || c.createdAtMs || Date.now()),
      syncedToCloud: !!c.syncedToCloud,
    }));
  } catch {
    return DEFAULT_CODES;
  }
}

export function saveStoredCodes(list: SubscriberCode[]) {
  try {
    localStorage.setItem(CODES_LIST_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('fahem-codes-updated'));
  } catch {
    // ignore
  }
}

export function getLocalTrials(code: string): number {
  const norm = code.trim().toUpperCase();
  if (!norm) return 0;
  try {
    const raw = localStorage.getItem(TRIALS_KEY(norm));
    if (raw !== null) {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) return n;
    }
  } catch {
    // ignore
  }
  const found = loadStoredCodes().find((c) => c.code.toUpperCase() === norm);
  return found ? found.trials : 0;
}

export function setLocalTrials(code: string, trials: number) {
  const norm = code.trim().toUpperCase();
  if (!norm) return;
  const clamped = Math.max(0, Math.round(trials));
  try {
    localStorage.setItem(TRIALS_KEY(norm), String(clamped));
    const list = loadStoredCodes();
    const idx = list.findIndex((c) => c.code.toUpperCase() === norm);
    if (idx !== -1) {
      list[idx] = { ...list[idx], trials: clamped, updatedAtMs: Date.now() };
      localStorage.setItem(CODES_LIST_KEY, JSON.stringify(list));
    }
    window.dispatchEvent(new Event('fahem-codes-updated'));
  } catch {
    // ignore
  }
}

interface CodeContextValue {
  activeCode: string | null;
  activeRecord: SubscriberCode | null;
  usedTrials: number;
  remainingTrials: number;
  isBlocked: boolean;
  blockReason: 'inactive' | 'limit_reached' | null;
  paymentModalOpen: boolean;
  openPaymentModal: (reason?: 'inactive' | 'limit_reached') => void;
  closePaymentModal: () => void;
  verifyAndActivateCode: (
    code: string
  ) => Promise<{ ok: boolean; reason?: string; message: string }>;
  checkAllowanceBeforeAnalysis: () => Promise<{ ok: boolean; message?: string }>;
  consumeTrial: () => Promise<void>;
  switchCode: () => void;
}

const CodeContext = createContext<CodeContextValue | null>(null);

export const CodeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeCode, setActiveCode] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem(USER_CODE_KEY);
      if (saved && saved.trim()) return saved.trim().toUpperCase();
      return null;
    } catch {
      return null;
    }
  });
  const [codes, setCodes] = useState<SubscriberCode[]>(() => loadStoredCodes());
  const [usedTrials, setUsedTrials] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(USER_CODE_KEY);
      return saved ? getLocalTrials(saved) : 0;
    } catch {
      return 0;
    }
  });
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [blockReason, setBlockReason] = useState<'inactive' | 'limit_reached' | null>(null);

  const activeRecord =
    (activeCode && codes.find((c) => c.code.toUpperCase() === activeCode.toUpperCase())) || null;
  const isInactive = activeRecord ? !activeRecord.isActive : false;
  const isBlocked = !!activeCode && (isInactive || usedTrials >= MAX_CODE_TRIALS);
  const remainingTrials = Math.max(0, MAX_CODE_TRIALS - usedTrials);

  const syncFromLocal = useCallback(() => {
    const list = loadStoredCodes();
    setCodes(list);
    if (activeCode) {
      const found = list.find((c) => c.code.toUpperCase() === activeCode.toUpperCase());
      const t = getLocalTrials(activeCode);
      setUsedTrials(t);
      if (found) {
        if (!found.isActive) setBlockReason('inactive');
        else if (t >= MAX_CODE_TRIALS) setBlockReason('limit_reached');
        else setBlockReason(null);
      }
    }
  }, [activeCode]);

  const syncWithServer = useCallback(async () => {
    syncFromLocal();
    if (!activeCode) return;
    try {
      const res = await fetch('/api/codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        const list = loadStoredCodes();
        const idx = list.findIndex((c) => c.code.toUpperCase() === activeCode.toUpperCase());
        const serverTrials = Number(data.trials || 0);
        const localTrials = getLocalTrials(activeCode);
        const existing = idx === -1 ? null : list[idx];
        const chosenTrials =
          existing && (existing.updatedAtMs || 0) > (data.updatedAtMs || 0)
            ? localTrials
            : serverTrials;

        setLocalTrials(activeCode, chosenTrials);
        setUsedTrials(chosenTrials);
        setBlockReason(chosenTrials >= MAX_CODE_TRIALS ? 'limit_reached' : null);

        if (idx === -1) {
          saveStoredCodes([
            {
              id: data.id || `server_${Date.now()}`,
              ownerId: 'server',
              name: data.name || activeCode,
              code: activeCode,
              isActive: true,
              trials: chosenTrials,
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
              syncedToCloud: false,
            },
            ...list,
          ]);
        } else {
          list[idx] = {
            ...list[idx],
            name: data.name || list[idx].name,
            isActive: true,
            trials: chosenTrials,
          };
          saveStoredCodes(list);
        }
      } else if (res.status === 403) {
        const reason = data.reason === 'inactive' ? 'inactive' : 'limit_reached';
        const trials = Number.isFinite(Number(data.trials))
          ? Number(data.trials)
          : getLocalTrials(activeCode);
        const list = loadStoredCodes();
        const idx = list.findIndex((c) => c.code.toUpperCase() === activeCode.toUpperCase());
        if (idx !== -1) {
          list[idx] = { ...list[idx], isActive: reason !== 'inactive', trials };
          saveStoredCodes(list);
        }
        setLocalTrials(activeCode, trials);
        setUsedTrials(trials);
        setBlockReason(reason);
      }
    } catch {
      // ignore offline
    }
  }, [activeCode, syncFromLocal]);

  useEffect(() => {
    syncFromLocal();
    const handler = () => syncFromLocal();
    window.addEventListener('fahem-codes-updated', handler);
    window.addEventListener('storage', handler);
    return () => {
      window.removeEventListener('fahem-codes-updated', handler);
      window.removeEventListener('storage', handler);
    };
  }, [syncFromLocal]);

  useEffect(() => {
    void syncWithServer();
  }, [syncWithServer]);

  const openPaymentModal = useCallback((reason?: 'inactive' | 'limit_reached') => {
    if (reason) setBlockReason(reason);
    setPaymentModalOpen(true);
  }, []);

  const closePaymentModal = useCallback(() => {
    setPaymentModalOpen(false);
  }, []);

  const verifyAndActivateCode = useCallback(async (rawInput: string) => {
    const code = rawInput.trim().toUpperCase();
    if (!code) {
      return { ok: false, message: 'دخل رمز الدخول ديالك أولا.' };
    }
    const list = loadStoredCodes();
    const localRec = list.find((c) => c.code.toUpperCase() === code);
    if (localRec) {
      const trials = getLocalTrials(code);
      if (!localRec.isActive) {
        return {
          ok: false,
          reason: 'inactive',
          message: `هاد الكود (${code}) موقوف من الإدارة. تواصل مع واتساب ${WHATSAPP_NUMBER}.`,
        };
      }
      if (trials >= MAX_CODE_TRIALS) {
        return {
          ok: false,
          reason: 'limit_reached',
          message: `هاد الكود (${code}) وصل للحد الأقصى (10/10). تواصل مع واتساب ${WHATSAPP_NUMBER} باش تخلص وتصفر العداد.`,
        };
      }
    }

    try {
      const res = await fetch('/api/codes/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        const trials = localRec
          ? Math.max(getLocalTrials(code), Number(data.trials || 0))
          : Number(data.trials || 0);
        if (trials >= MAX_CODE_TRIALS) {
          return {
            ok: false,
            reason: 'limit_reached',
            message: `هاد الكود وصل للحد الأقصى (10/10). تواصل مع واتساب ${WHATSAPP_NUMBER}.`,
          };
        }
        localStorage.setItem(USER_CODE_KEY, code);
        setLocalTrials(code, trials);
        if (!localRec) {
          saveStoredCodes([
            {
              id: data.id || `code_${Date.now()}`,
              ownerId: 'server',
              name: data.name || code,
              code,
              isActive: true,
              trials,
              createdAtMs: Date.now(),
              updatedAtMs: Date.now(),
              syncedToCloud: false,
            },
            ...list,
          ]);
        }
        setActiveCode(code);
        setUsedTrials(trials);
        setBlockReason(null);
        setPaymentModalOpen(false);
        return { ok: true, message: `مرحبا بيك ${data.name || code}! الدخول تفعل بنجاح.` };
      }

      if (localRec && localRec.isActive) {
        const trials = getLocalTrials(code);
        localStorage.setItem(USER_CODE_KEY, code);
        setActiveCode(code);
        setUsedTrials(trials);
        setBlockReason(null);
        setPaymentModalOpen(false);
        return { ok: true, message: `مرحبا بيك ${localRec.name}! الدخول تفعل بنجاح.` };
      }

      return {
        ok: false,
        reason: data.reason,
        message: data.message || 'هاد الكود غير صحيح أو موقوف.',
      };
    } catch {
      if (localRec && localRec.isActive) {
        const trials = getLocalTrials(code);
        localStorage.setItem(USER_CODE_KEY, code);
        setActiveCode(code);
        setUsedTrials(trials);
        setBlockReason(null);
        setPaymentModalOpen(false);
        return { ok: true, message: `مرحبا بيك ${localRec.name}! تم الدخول.` };
      }
      return { ok: false, message: 'ما قدرناش نتحققو من الكود، تأكد من الاتصال وجرب مرة أخرى.' };
    }
  }, []);

  const checkAllowanceBeforeAnalysis = useCallback(async () => {
    if (!activeCode) {
      return { ok: false, message: 'خاصك تدخل رمز الدخول الاشتراك ديالك أولا.' };
    }
    const list = loadStoredCodes();
    const rec = list.find((c) => c.code.toUpperCase() === activeCode.toUpperCase());
    const trials = getLocalTrials(activeCode);
    if (rec && !rec.isActive) {
      setBlockReason('inactive');
      setPaymentModalOpen(true);
      return {
        ok: false,
        message: `هاد الكود (${activeCode}) موقوف من الإدارة. تواصل مع واتساب ${WHATSAPP_NUMBER}.`,
      };
    }
    if (trials >= MAX_CODE_TRIALS) {
      setBlockReason('limit_reached');
      setPaymentModalOpen(true);
      return {
        ok: false,
        message: `وصلتي للحد الأقصى (10/10) لهاد الكود. تواصل مع واتساب ${WHATSAPP_NUMBER} باش تخلص وتكمل.`,
      };
    }
    return { ok: true };
  }, [activeCode]);

  const consumeTrial = useCallback(async () => {
    if (!activeCode) return;
    const nextTrials = getLocalTrials(activeCode) + 1;
    setLocalTrials(activeCode, nextTrials);
    setUsedTrials(nextTrials);
    if (nextTrials >= MAX_CODE_TRIALS) {
      setBlockReason('limit_reached');
    }
    try {
      await fetch('/api/codes/consume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode }),
      });
    } catch {
      // ignore offline
    }
  }, [activeCode]);

  const switchCode = useCallback(() => {
    localStorage.removeItem(USER_CODE_KEY);
    setActiveCode(null);
    setPaymentModalOpen(false);
  }, []);

  return (
    <CodeContext.Provider
      value={{
        activeCode,
        activeRecord,
        usedTrials,
        remainingTrials,
        isBlocked,
        blockReason,
        paymentModalOpen,
        openPaymentModal,
        closePaymentModal,
        verifyAndActivateCode,
        checkAllowanceBeforeAnalysis,
        consumeTrial,
        switchCode,
      }}
    >
      {children}
    </CodeContext.Provider>
  );
};

export function useCodeAccess(): CodeContextValue {
  const ctx = useContext(CodeContext);
  if (!ctx) throw new Error('useCodeAccess must be used inside CodeProvider');
  return ctx;
}

export const CodeGateModal: React.FC<{
  suppressGate: boolean;
  onOpenAdmin: () => void;
}> = ({ suppressGate, onOpenAdmin }) => {
  const { activeCode, verifyAndActivateCode } = useCodeAccess();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (activeCode || suppressGate) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await verifyAndActivateCode(input);
    setLoading(false);
    if (!res.ok) setError(res.message);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="فاهم بلان — الدخول الإجباري"
      className="fixed inset-0 z-50 bg-[#0a0f1e]/95 backdrop-blur-md flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#ff7a1a]/35 bg-[#11182c] p-6 sm:p-8 space-y-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="شعار فاهم بلان" className="w-12 h-12 rounded-2xl shrink-0" />
          <div>
            <h2 className="text-xl font-extrabold text-white">فاهم بلان — الدخول الإجباري</h2>
            <p className="text-xs text-[#ff7a1a] font-bold">خاص بالمشتركين والمهنيين</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          مرحبا بيك فـ تطبيق فاهم بلان. باش تبدا تستعمل التطبيق، خاصك تدخل رمز الدخول ديال الاشتراك
          وتورك على تأكيد. إلا ما عندكش الكود، تواصل معنا فـ واتساب {WHATSAPP_NUMBER}.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300">رمز الدخول الاشتراك ديالك</label>
            <input
              type="text"
              dir="ltr"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="دخل الرمز هنا (مثلا: FAHEM2026)"
              className="w-full min-h-[50px] rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-center text-base font-extrabold tracking-widest uppercase text-white placeholder:text-slate-500 focus:border-[#ff7a1a] focus:outline-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-3 text-xs font-bold text-red-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[50px] rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] text-base font-extrabold transition-colors disabled:opacity-60"
          >
            {loading ? 'جاري التحقق...' : 'تأكيد'}
          </button>

          <button
            type="button"
            onClick={() => void verifyAndActivateCode('FAHEM2026')}
            className="w-full min-h-[44px] rounded-xl border border-[#ff7a1a]/35 bg-[#ff7a1a]/10 hover:bg-[#ff7a1a]/20 text-[#ff7a1a] text-xs font-bold transition-colors"
          >
            تجربة مجانية بكود الافتتاح (FAHEM2026)
          </button>
        </form>

        <div className="border-t border-white/10 pt-4 space-y-3 text-center">
          <p className="text-xs text-slate-400">مازال ما عندكش رمز الدخول؟ خد الاشتراك ديالك دابا:</p>
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold transition-colors"
          >
            <span>طلب رمز الاشتراك عبر واتساب {WHATSAPP_NUMBER}</span>
          </a>

          <div className="flex justify-center pt-1">
            <button
              type="button"
              onClick={onOpenAdmin}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-[#ff7a1a] transition-colors py-1 px-2"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>دخول الإدارة (/admin)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PaymentModal: React.FC = () => {
  const { activeCode, usedTrials, blockReason, paymentModalOpen, closePaymentModal, switchCode } =
    useCodeAccess();

  if (!paymentModalOpen) return null;
  const isInactive = blockReason === 'inactive';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="تفعيل الاشتراك أو تجديد الرصيد"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-md rounded-3xl border border-[#ff7a1a]/40 bg-[#11182c] p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a1a]/15 border border-[#ff7a1a]/30 flex items-center justify-center text-[#ff7a1a] shrink-0">
              {isInactive ? <Lock className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                {isInactive ? 'هاد الكود موقوف مؤقتاً' : 'ساليو تجارب هاد الكود (10/10)'}
              </h2>
              <p className="text-xs text-slate-400">
                الكود: <span className="font-mono-nums text-[#ff7a1a]">{activeCode}</span> ·
                الاستعمال: <span className="font-mono-nums">{usedTrials}/{MAX_CODE_TRIALS}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePaymentModal}
            aria-label="إغلاق"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed">
          {isInactive
            ? 'تم توقيف هاد رمز الدخول من طرف الإدارة. باش ترجعو يخدم ولا تخلص الاشتراك، تواصل معانا مباشرة على الواتساب.'
            : 'الكود ديالك وصل لـ 10 ديال التحاليل بالذكاء الاصطناعي. باش نرجعو نصفروا ليك العداد وتكمل الخدمة، تواصل معانا فـ واتساب باش تخلص.'}
        </p>

        <SpeakButton
          id="payment-modal-voice"
          label="سمع التنبيه بالدارجة"
          variant="ghost"
          text={
            isInactive
              ? 'هاد الكود موقوف حاليا من الإدارة. تواصل معنا فـ واتساب صفر ستة سبعة وأربعين عشرين تلاتة وخمسين تلاتة وتمانين باش نعاودو نفعّلوه ليك.'
              : 'ساليو العشرة تجارب ديال هاد الكود. تواصل معنا فـ واتساب صفر ستة سبعة وأربعين عشرين تلاتة وخمسين تلاتة وتمانين باش تخلص وتصفّر العداد.'
          }
        />

        <div className="space-y-2.5 pt-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold"
          >
            <span>واتساب {WHATSAPP_NUMBER} باش تخلص وتفعّل</span>
          </a>
          <button
            type="button"
            onClick={switchCode}
            className="w-full min-h-[44px] rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200"
          >
            دخل كود اشتراك آخر
          </button>
        </div>
      </div>
    </div>
  );
};
