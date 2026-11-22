import React, { useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Check,
  Edit3,
  FolderKanban,
  HardDrive,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react';
import type { SavedPlan } from '../types';
import { SpeakButton, VoiceGenderSwitch } from '../contexts/SpeechContext';

interface ProjectsViewProps {
  plans: SavedPlan[];
  onDeletePlan: (id: string) => Promise<void>;
  onRenamePlan: (id: string, newTitle: string) => Promise<void>;
  onOpenInAnnotator: (src: string) => void;
  onGoAnalyze: () => void;
  onBack: () => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({
  plans,
  onDeletePlan,
  onRenamePlan,
  onOpenInAnnotator,
  onGoAnalyze,
  onBack,
}) => {
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const filtered = plans.filter((p) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      p.title.toLowerCase().includes(q) ||
      p.buildingType.toLowerCase().includes(q) ||
      p.darijaSummary.toLowerCase().includes(q)
    );
  });

  const startEdit = (plan: SavedPlan) => {
    setEditingId(plan.id);
    setEditingTitle(plan.title);
  };

  const commitEdit = async (id: string) => {
    if (editingTitle.trim()) {
      await onRenamePlan(id, editingTitle.trim());
    }
    setEditingId(null);
  };

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white hover:bg-[#16203a]"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع</span>
        </button>
        <div className="flex items-center gap-2">
          <VoiceGenderSwitch useCloudTts />
          <SpeakButton
            id="projects-page-voice"
            variant="secondary"
            label="سمع الشرح"
            text={`عندك دابا ${plans.length} بلان محفوظ فالمشاريع ديالك. تقدر تسمع الشرح ديال أي بلان، تعدل السمية ديالو، ولا ترسم فوقو.`}
          />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-white">المشاريع والبلانات المحفوظة</h1>
        <p className="text-sm text-slate-400 mt-1">
          كاع البلانات اللي صورتي وحللتي كيبقاو محفوظين هنا باش ترجع ليهم فأي وقت
        </p>
      </div>

      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="قلب على بلان بالسمية أو نوع البناء..."
          className="w-full min-h-[48px] rounded-xl border border-white/10 bg-[#11182c] pr-11 pl-4 text-sm text-white placeholder:text-slate-500 focus:border-[#ff7a1a] focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-[#11182c] p-10 text-center space-y-4">
          <FolderKanban className="w-12 h-12 text-[#ff7a1a] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white">
              {plans.length === 0 ? 'مازال ما حفظتي حتى بلان' : 'ما كاين حتى نتيجة لهاد البحث'}
            </h3>
            <p className="text-sm text-slate-400">
              {plans.length === 0
                ? 'صور البلان اللول ديالك وحللو بالذكاء الاصطناعي ومن بعد ورك على زر الحفظ.'
                : 'جرب تبدل كلمة البحث.'}
            </p>
          </div>
          {plans.length === 0 && (
            <button
              type="button"
              onClick={onGoAnalyze}
              className="min-h-[48px] inline-flex items-center justify-center rounded-xl bg-[#ff7a1a] text-[#0a0f1e] px-6 py-3 text-sm font-extrabold hover:bg-[#ff8d3b]"
            >
              صور وحلل بلان دابا
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((plan) => (
            <div
              key={plan.id}
              className="rounded-2xl border border-white/10 bg-[#11182c] overflow-hidden flex flex-col justify-between"
            >
              <div>
                {plan.thumbnailDataUrl ? (
                  <div className="h-44 bg-[#0a0f1e] border-b border-white/10 overflow-hidden">
                    <img
                      src={plan.thumbnailDataUrl}
                      alt={plan.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-28 bg-[#0a0f1e] border-b border-white/10 flex items-center justify-center text-slate-500 text-xs">
                    بلان محفوظ بدون صورة مصغرة
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {editingId === plan.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={editingTitle}
                        onChange={(e) => setEditingTitle(e.target.value)}
                        className="flex-1 min-h-[40px] rounded-lg border border-[#ff7a1a] bg-[#0a0f1e] px-3 text-sm text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => void commitEdit(plan.id)}
                        className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg bg-[#ff7a1a] text-[#0a0f1e]"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-bold text-white leading-snug">{plan.title}</h3>
                      <button
                        type="button"
                        onClick={() => startEdit(plan)}
                        aria-label="تعديل العنوان"
                        className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  <div className="text-xs text-slate-400 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>{plan.buildingType}</span>
                    <span>·</span>
                    <span className="font-mono-nums text-[#ff7a1a]">{plan.totalAreaSqm}</span>
                    <span>·</span>
                    <span className="font-mono-nums">{plan.roomsCount} غرف</span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {plan.darijaSummary}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(plan.createdAtMs).toLocaleDateString('ar-MA')}
                    </span>
                    <span className="inline-flex items-center gap-1 text-slate-300">
                      <HardDrive className="w-3.5 h-3.5 text-amber-400" />
                      <span>محفوظ محلياً</span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 pt-0 flex flex-wrap items-center justify-between gap-2 border-t border-white/5 mt-2">
                <SpeakButton
                  id={`proj-${plan.id}`}
                  compact
                  variant="primary"
                  text={plan.audioScript || plan.darijaSummary}
                />
                <div className="flex items-center gap-2 pt-3">
                  {plan.thumbnailDataUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenInAnnotator(plan.thumbnailDataUrl!)}
                      className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 px-3 text-xs font-bold text-slate-200"
                    >
                      <Pencil className="w-3.5 h-3.5 text-[#ff7a1a]" />
                      <span>رسم فوق البلان</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void onDeletePlan(plan.id)}
                    aria-label="حذف البلان"
                    className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-red-400 hover:border-red-500/40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
