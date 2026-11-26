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
  Upload,
  Video,
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
import { postApiJson } from '../utils/apiClient';
import {
  clearLocalVideoAd,
  fetchVideoAdMeta,
  loadLocalVideoAd,
  saveLocalVideoAd,
  type VideoAdMeta,
} from '../utils/videoAdStore';

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

  const [videoAd, setVideoAd] = useState<VideoAdMeta>({ exists: false });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [deletingVideo, setDeletingVideo] = useState(false);

  const flash = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2600);
  };

  const refreshVideoAd = useCallback(async () => {
    const serverMeta = await fetchVideoAdMeta();
    if (serverMeta.exists && serverMeta.url) {
      setVideoAd(serverMeta);
      return;
    }
    const localCached = await loadLocalVideoAd();
    if (localCached) {
      setVideoAd(localCached.meta);
      return;
    }
    setVideoAd({ exists: false });
  }, []);

  const fetchServerCodes = useCallback(async (pin: string) => {
    try {
      const res = await fetch('/api/codes', {
        headers: { 'x-admin-pin': pin },
        cache: 'no-store',
      });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.codes)) return;
      const serverCodes: SubscriberCode[] = data.codes.map((c: SubscriberCode) => ({
        ...c,
        ownerId: 'server',
        code: c.code.toUpperCase(),
      }));
      const localCodes = loadStoredCodes();
      const map = new Map<string, SubscriberCode>();
      for (const lc of localCodes) {
        map.set(lc.code.toUpperCase(), lc);
      }
      for (const sc of serverCodes) {
        const key = sc.code.toUpperCase();
        const existing = map.get(key);
        if (!existing || (sc.updatedAtMs || 0) >= (existing.updatedAtMs || 0)) {
          map.set(key, sc);
        }
      }
      const merged = Array.from(map.values()).sort(
        (a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)
      );
      setCodes(merged);
      saveStoredCodes(merged);
    } catch {
      // ignore offline
    }
  }, []);

  useEffect(() => {
    if (unlockedPin) {
      void fetchServerCodes(unlockedPin);
      void refreshVideoAd();
    }
  }, [unlockedPin, fetchServerCodes, refreshVideoAd]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const pin = pinInput.trim();
    if (!pin) return;
    try {
      const { ok, data } = await postApiJson<{ ok?: boolean; message?: string }>(
        '/api/admin/verify-pin',
        { pin },
        { timeoutMs: 12000, retries: 1 }
      );
      if (!ok || !data.ok) {
        setPinError(data.message || 'الكود السري غلط! دخل الكود الصحيح ديال الإدارة.');
        return;
      }
      setUnlockedPin(pin);
    } catch {
      setPinError('تعذر التحقق من الكود السري، عاود حاول.');
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
        const created: SubscriberCode = {
          id: data.code?.id || `code_${Date.now()}`,
          ownerId: 'server',
          name: nameStr,
          code: codeStr,
          isActive: true,
          trials: 0,
          createdAtMs: data.code?.createdAtMs || Date.now(),
          updatedAtMs: data.code?.updatedAtMs || Date.now(),
          syncedToCloud: false,
        };
        const nextList = [created, ...codes.filter((c) => c.code.toUpperCase() !== codeStr)];
        setCodes(nextList);
        saveStoredCodes(nextList);
        setNewName('');
        setNewCode('');
        flash(`تم حفظ الكود ${codeStr} باسم ${nameStr}`);
      }
    } catch {
      flash('تعذر الاتصال بالخادم أثناء حفظ الكود');
    } finally {
      setSaving(false);
    }
  };

  const toggleCodeActive = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    const nextActive = !item.isActive;
    try {
      const res = await fetch(`/api/codes/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': unlockedPin,
        },
        body: JSON.stringify({ isActive: nextActive, code: item.code, name: item.name }),
      });
      if (!res.ok) {
        flash('تعذر تحديث حالة الكود');
        return;
      }
      const nextList = codes.map((c) =>
        c.id === item.id || c.code.toUpperCase() === item.code.toUpperCase()
          ? { ...c, isActive: nextActive, updatedAtMs: Date.now() }
          : c
      );
      setCodes(nextList);
      saveStoredCodes(nextList);
      flash(
        nextActive
          ? `تم تفعيل كود ${item.name} (${item.code})`
          : `تم حظر/تعطيل كود ${item.name} (${item.code})`
      );
    } catch {
      flash('تعذر الاتصال بالخادم لتحديث الكود');
    }
  };

  const resetCodeTrials = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    try {
      const res = await fetch(`/api/codes/${encodeURIComponent(item.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-pin': unlockedPin,
        },
        body: JSON.stringify({ trials: 0, isActive: true, code: item.code, name: item.name }),
      });
      if (!res.ok) {
        flash('تعذر تصفير العداد');
        return;
      }
      setLocalTrials(item.code, 0);
      const nextList = codes.map((c) =>
        c.id === item.id || c.code.toUpperCase() === item.code.toUpperCase()
          ? { ...c, trials: 0, isActive: true, updatedAtMs: Date.now() }
          : c
      );
      setCodes(nextList);
      saveStoredCodes(nextList);
      flash(`تم تصفير العداد وتفعيل كود ${item.name} (${item.code}) من 0/10`);
    } catch {
      flash('تعذر الاتصال بالخادم لتصفير العداد');
    }
  };

  const deleteCode = async (item: SubscriberCode) => {
    if (!unlockedPin) return;
    try {
      const res = await fetch(`/api/codes/${encodeURIComponent(item.id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': unlockedPin },
      });
      if (!res.ok) {
        flash('تعذر حذف الكود');
        return;
      }
      const nextList = codes.filter(
        (c) => c.id !== item.id && c.code.toUpperCase() !== item.code.toUpperCase()
      );
      setCodes(nextList);
      saveStoredCodes(nextList);
      flash(`تم حذف الكود ${item.code}`);
    } catch {
      flash('تعذر الاتصال بالخادم لحذف الكود');
    }
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

  const handleUploadVideoAd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !unlockedPin) return;

    const MAX_BYTES = 35 * 1024 * 1024;
    if (file.size === 0) {
      flash('هاد الملف خاوي.');
      return;
    }
    if (file.size > MAX_BYTES) {
      flash('حجم الفيديو كبير بزاف (الحد الأقصى 35 MB). صغّرو شوية وعاود رفعو.');
      return;
    }

    setUploadingVideo(true);
    setUploadProgress(5);
    const mimeType = file.type || 'video/mp4';
    const chunkSize = 2 * 1024 * 1024;
    const totalChunks = Math.max(1, Math.ceil(file.size / chunkSize));
    const uploadId = `ad_${Date.now()}`;

    try {
      let latestMeta: VideoAdMeta | null = null;
      for (let i = 0; i < totalChunks; i++) {
        const slice = file.slice(i * chunkSize, Math.min(file.size, (i + 1) * chunkSize));
        const res = await fetch('/api/admin/video-ad', {
          method: 'POST',
          headers: {
            'x-admin-pin': unlockedPin,
            'Content-Type': 'application/octet-stream',
            'x-video-name': encodeURIComponent(file.name || 'video-ad.mp4'),
            'x-video-mime': mimeType,
            'x-chunk-index': String(i),
            'x-total-chunks': String(totalChunks),
            'x-upload-id': uploadId,
          },
          body: slice,
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          meta?: VideoAdMeta;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'تعذر رفع الفيديو.');
        }
        setUploadProgress(Math.round(((i + 1) / totalChunks) * 100));
        if (data.meta) {
          latestMeta = data.meta;
        }
      }

      const updatedAtMs = latestMeta?.updatedAtMs || Date.now();
      await saveLocalVideoAd(file, {
        fileName: file.name || 'video-ad.mp4',
        mimeType,
        updatedAtMs,
      });

      if (latestMeta?.exists && latestMeta.url) {
        setVideoAd(latestMeta);
      } else {
        await refreshVideoAd();
      }
      window.dispatchEvent(new Event('fahem-video-ad-updated'));
      flash('تم رفع الفيديو بنجاح وبان دابا فـ بلاصة الإعلان.');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'تعذر رفع الفيديو، عاود حاول.';
      flash(msg);
    } finally {
      setUploadingVideo(false);
      setUploadProgress(0);
    }
  };

  const handleDeleteVideoAd = async () => {
    if (!unlockedPin) return;
    setDeletingVideo(true);
    try {
      await fetch('/api/admin/video-ad', {
        method: 'DELETE',
        headers: { 'x-admin-pin': unlockedPin },
      });
      await clearLocalVideoAd();
      setVideoAd({ exists: false });
      window.dispatchEvent(new Event('fahem-video-ad-updated'));
      flash('تم حذف فيديو الإعلان.');
    } catch {
      flash('تعذر حذف الفيديو.');
    } finally {
      setDeletingVideo(false);
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
              <p className="text-xs text-slate-400">خاص بمدير تطبيق فاهم بلان</p>
            </div>
          </div>

          <form onSubmit={handlePinSubmit} className="space-y-4">
            <input
              type="password"
              dir="ltr"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
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

      <section className="rounded-2xl border border-white/10 bg-[#11182c] p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-[#ff7a1a] text-xs font-bold">
              <Video className="w-4 h-4 shrink-0" />
              <span>بلاصة الإشهار</span>
            </div>
            <h2 className="text-lg font-extrabold text-white">Video Ads</h2>
            <p className="text-xs text-slate-400">
              ارفع فيديو من الهاتف هنا وغادي يبان مباشرة فـ &quot;بلاصة الفيديو&quot; فصفحة البداية
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label
              className={`min-h-[44px] cursor-pointer inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] hover:bg-[#ff8d3b] text-[#0a0f1e] px-4 py-2.5 text-sm font-extrabold transition-colors ${
                uploadingVideo ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <Upload className="w-4 h-4 shrink-0" />
              <span>
                {uploadingVideo
                  ? `جاري الرفع (${uploadProgress}%)...`
                  : videoAd.exists
                    ? 'تبديل الفيديو من الهاتف'
                    : 'رفع فيديو من الهاتف'}
              </span>
              <input
                type="file"
                accept="video/mp4,video/webm,video/quicktime,video/*"
                disabled={uploadingVideo}
                onChange={(e) => void handleUploadVideoAd(e)}
                className="hidden"
              />
            </label>

            {videoAd.exists && (
              <button
                type="button"
                disabled={deletingVideo || uploadingVideo}
                onClick={() => void handleDeleteVideoAd()}
                className="min-h-[44px] inline-flex items-center gap-1.5 rounded-xl border border-red-500/40 px-3.5 py-2 text-xs font-bold text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4 shrink-0" />
                <span>{deletingVideo ? 'جاري الحذف...' : 'حذف الفيديو'}</span>
              </button>
            )}
          </div>
        </div>

        {videoAd.exists && videoAd.url ? (
          <div className="space-y-2.5">
            <div className="aspect-video w-full max-w-2xl rounded-2xl overflow-hidden border border-white/10 bg-black">
              <video
                key={videoAd.url}
                src={videoAd.url}
                controls
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs text-slate-400">
              الملف الحالي: <span className="text-slate-200 font-semibold">{videoAd.fileName}</span>
              {typeof videoAd.sizeBytes === 'number' && (
                <>
                  {' '}
                  ·{' '}
                  <span className="font-mono-nums">
                    {(videoAd.sizeBytes / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </>
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-white/15 bg-[#0a0f1e]/70 p-6 text-center text-xs text-slate-400">
            مازال ما ترفع حتى فيديو للإشهار. ورك على &quot;رفع فيديو من الهاتف&quot; باش تختار الفيديو.
          </div>
        )}
      </section>
    </div>
  );
};
