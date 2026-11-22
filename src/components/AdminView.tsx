import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight,
  Check,
  Copy,
  Lock,
  MessageCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { SubscriberCode } from '../types';
import { WHATSAPP_NUMBER } from '../constants';
import { SpeakButton } from '../contexts/SpeechContext';
import {
  loadStoredCodes,
  MAX_CODE_TRIALS,
  saveStoredCodes,
  setLocalTrials,
} from '../contexts/CodeContext';

export const AdminView: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const [pinInput, setPinInput] = useState('');
  const [unlockedPin, setUnlockedPin] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  const [codes, setCodes] = useState<SubscriberCode[]>(() => loadStoredCodes());
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const fetchServerCodes = useCallback(async (pin: string) => {
    try {
      const res = await fetch('/api/codes', { headers: { 'x-admin-pin': pin } });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.codes)) return;
      const merged = data.codes.map((c: SubscriberCode) => ({
        ...c,
        ownerId: 'server',
        code: c.code.toUpperCase(),
      }));
      setCodes(merged);
      saveStoredCodes(merged);
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    if (unlockedPin) {
      void fetchServerCodes(unlockedPin);
    }
  }, [unlockedPin, fetchServerCodes]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const pin = pinInput.trim();
    if (!pin) return;
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setPinError(data.message || 'الكود السري غلط! دخل الكود الصحيح ديال الإدارة.');
        return;
      }
      setUnlockedPin(pin);
    } catch {
      setPinError('تعذر التحقق من الكود السري.');
    }
  };

  const generateRandomCode = () => {
    const num = Math.floor(1000 + Math.random() * 9000);
    setNewCode(`FB-${num}`);
  };

  const handleCreateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!unlockedPin || !newCode.trim()) return;
    const codeStr = newCode.trim().toUpperCase();
    const nameStr = newName.trim() || 'مشترك';
    setSaving(true);
    try {
      const res = await fetch('/api/codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': unlockedPin,
        },
        body: JSON.stringify({ name: nameStr, code: codeStr }),
      });
      const data = await res.json();
      if (!res.ok) {
        flash(data.error || 'تعذر حفظ الكود');
      } else {
        await fetchServerCodes(unlockedPin);
        setNewName('');
        setNewCode('');
        flash(`تم حفظ الكود ${codeStr} باسم ${nameStr}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const toggleCodeActive = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    const nextActive = !item.isActive;
    await fetch(`/api/codes/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': unlockedPin,
      },
      body: JSON.stringify({ isActive: nextActive }),
    });
    await fetchServerCodes(unlockedPin);
    flash(
      nextActive
        ? `تم تفعيل كود ${item.name} (${item.code})`
        : `تم حظر/تعطيل كود ${item.name} (${item.code})`
    );
  };

  const resetCodeTrials = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    await fetch(`/api/codes/${item.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-pin': unlockedPin,
      },
      body: JSON.stringify({ trials: 0, isActive: true }),
    });
    setLocalTrials(item.code, 0);
    await fetchServerCodes(unlockedPin);
    flash(`تم تصفير العداد وتفعيل كود ${item.name} (${item.code}) من 0/10`);
  };

  const deleteCode = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    await fetch(`/api/codes/${item.id}`, {
      method: 'DELETE',
      headers: { 'x-admin-pin': unlockedPin },
    });
    await fetchServerCodes(unlockedPin);
    flash(`تم حذف الكود ${item.code}`);
  };

  const copyCode = async (item: SubscriberCode) => {
    try {
      await navigator.clipboard.writeText(item.code);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  if (!unlockedPin) {
    return (
      <div className="max-w-md mx-auto py-8 space-y-6">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع</span>
        </button>

        <div className="rounded-3xl border border-white/10 bg-[#11182c] p-6 sm:p-8 space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#ff7a1a]/15 border border-[#ff7a1a]/30 text-[#ff7a1a] flex items-center justify-center">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-white">دخول لوحة الإدارة</h1>
              <p className="text-xs text-slate-400">خاص بمدير تطبيق فاهم بلان (الرمز الافتراضي: 2026)</p>
            </div>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              dir="ltr"
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="دخل الكود السري للإدارة"
              className="w-full min-h-[48px] rounded-xl border border-white/15 bg-[#0a0f1e] px-4 text-center text-white font-mono-nums tracking-widest focus:border-[#ff7a1a] focus:outline-none"
            />
            {pinError && (
              <p className="text-xs font-bold text-red-300 bg-red-950/30 border border-red-500/30 rounded-xl p-3">
                {pinError}
              </p>
            )}
            <button
              type="submit"
              className="w-full min-h-[48px] rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] font-extrabold text-sm"
            >
              فتح لوحة الإدارة
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع</span>
        </button>

        <SpeakButton
          id="admin-intro-voice"
          variant="secondary"
          label="سمع الشرح"
          text="هاد لوحة الإدارة المطورة ديال فاهم بلان. تقدر تزيد أكواد المشتركين، تشوف كل واحد شحال استعمل من عشرة، تبلوكي اللي ما خلصش، ولا تصفّر العداد وترجعو خدام إلا خلص."
        />
      </div>

      {toast && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm font-bold text-emerald-200">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
            <ShieldCheck className="w-4 h-4" />
            <span>لوحة الإدارة</span>
          </div>
          <h1 className="text-2xl font-extrabold text-white mt-0.5">
            إدارة المشتركين والأكواد (حد {MAX_CODE_TRIALS} تجارب للكود)
          </h1>
        </div>
        <span className="text-xs text-slate-400">واتساب: {WHATSAPP_NUMBER}</span>
      </div>

      <form
        onSubmit={handleCreateCode}
        className="rounded-2xl border border-white/10 bg-[#11182c] p-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <div className="sm:col-span-4 space-y-1.5">
          <label className="text-xs font-bold text-slate-300">اسم المشترك (مثلا: المعلم حسن)</label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="اسم المشترك"
            className="w-full min-h-[46px] rounded-xl border border-white/15 bg-[#0a0f1e] px-3.5 text-sm text-white focus:border-[#ff7a1a] focus:outline-none"
          />
        </div>
        <div className="sm:col-span-5 space-y-1.5">
          <label className="text-xs font-bold text-slate-300">الكود (مثلا: FB-4520)</label>
          <div className="flex gap-2">
            <input
              type="text"
              dir="ltr"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="FB-4520"
              className="flex-1 min-h-[46px] rounded-xl border border-white/15 bg-[#0a0f1e] px-3.5 text-sm font-mono-nums uppercase text-white focus:border-[#ff7a1a] focus:outline-none"
            />
            <button
              type="button"
              onClick={generateRandomCode}
              title="توليد كود عشوائي"
              className="min-h-[46px] px-3 rounded-xl border border-white/15 bg-[#0a0f1e] text-xs font-bold text-[#ff7a1a] hover:border-[#ff7a1a]"
            >
              توليد
            </button>
          </div>
        </div>
        <div className="sm:col-span-3">
          <button
            type="submit"
            disabled={saving || !newCode.trim()}
            className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] text-sm font-extrabold disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ الكود'}</span>
          </button>
        </div>
      </form>

      <section className="rounded-2xl border border-white/10 bg-[#11182c] overflow-hidden">
        <div className="p-5 border-b border-white/10">
          <h2 className="text-base font-extrabold text-white">جدول المشتركين ({codes.length})</h2>
          <p className="text-xs text-slate-400 mt-1">
            كل كود عندو عداد بوحدو (حتى لـ {MAX_CODE_TRIALS}) — تقدر تحبسو أو تصفّر العداد إلا خلص
          </p>
        </div>

        {codes.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-400">مازال ما ضفتي حتى كود.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-[#0a0f1e] text-xs text-slate-400">
                <tr>
                  <th className="py-3 px-4 font-bold">الاسم</th>
                  <th className="py-3 px-4 font-bold">الكود</th>
                  <th className="py-3 px-4 font-bold">العداد</th>
                  <th className="py-3 px-4 font-bold">الحالة</th>
                  <th className="py-3 px-4 font-bold">تفعيل / تعطيل</th>
                  <th className="py-3 px-4 font-bold">تصفير العداد</th>
                  <th className="py-3 px-4 font-bold">مشاركة / حذف</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {codes.map((item) => {
                  const exhausted = item.trials >= MAX_CODE_TRIALS;
                  const shareMsg = encodeURIComponent(
                    `مرحبا ${item.name}، ها هو رمز الدخول الاشتراك ديالك في فاهم بلان: ${item.code}`
                  );
                  return (
                    <tr key={item.id} className="hover:bg-white/[0.02]">
                      <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{item.name}</td>
                      <td className="py-3 px-4 font-mono-nums font-bold text-[#ff7a1a] whitespace-nowrap">
                        {item.code}
                      </td>
                      <td className="py-3 px-4 font-mono-nums text-white whitespace-nowrap">
                        {item.trials} / {MAX_CODE_TRIALS}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-xs font-bold">
                        {!item.isActive ? (
                          <span className="text-red-300">مبلوكي</span>
                        ) : exhausted ? (
                          <span className="text-amber-300">سالا العداد</span>
                        ) : (
                          <span className="text-emerald-300">خدام</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void toggleCodeActive(item)}
                          className={`min-h-[36px] px-3 rounded-lg text-xs font-bold border ${
                            item.isActive
                              ? 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                              : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                          }`}
                        >
                          {item.isActive ? 'تعطيل (بلوك)' : 'تفعيل'}
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => void resetCodeTrials(item)}
                          className="min-h-[36px] inline-flex items-center gap-1.5 px-3 rounded-lg bg-[#0a0f1e] border border-white/15 hover:border-[#ff7a1a] text-xs font-bold text-slate-200"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-[#ff7a1a]" />
                          <span>تصفير + تفعيل</span>
                        </button>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyCode(item)}
                            title="نسخ الكود"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-white/10 text-slate-300 hover:text-white"
                          >
                            {copiedId === item.id ? (
                              <Check className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                          <a
                            href={`https://wa.me/?text=${shareMsg}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="إرسال فالواتساب"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </a>
                          <button
                            type="button"
                            onClick={() => void deleteCode(item)}
                            title="حذف الكود"
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border border-white/10 text-slate-400 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
