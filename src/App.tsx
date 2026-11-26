import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  FolderKanban,
  Home,
  ScanLine,
  Settings,
  Volume2,
  VolumeX,
  WifiOff,
  Wrench,
} from 'lucide-react';
import type { AppTab, BlueprintAnalysis, SavedPlan, ToolId, VoiceNote } from './types';
import { WHATSAPP_NUMBER, WHATSAPP_URL } from './constants';
import { SpeechProvider, useDarijaSpeech, VoiceGenderSwitch } from './contexts/SpeechContext';
import {
  CodeGateModal,
  CodeProvider,
  MAX_CODE_TRIALS,
  PaymentModal,
  useCodeAccess,
} from './contexts/CodeContext';
import { HomeView } from './components/HomeView';
import { AnalyzeView } from './components/AnalyzeView';
import { ToolsView } from './components/ToolsView';
import { LearnView } from './components/LearnView';
import { ProjectsView } from './components/ProjectsView';
import { SettingsView } from './components/SettingsView';
import { AdminView } from './components/AdminView';
import { CameraModal } from './components/CameraModal';
import { LandingPage } from './components/LandingPage';

const SAVED_PLANS_KEY = 'fahem_saved_plans_v1';
const VOICE_NOTES_KEY = 'fahem_voice_notes_v1';

function loadLocalArray<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveLocalArray<T>(key: string, data: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    // ignore
  }
}

const OfflineBanner: React.FC = () => {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/40 bg-[#11182c] px-3.5 py-2 text-xs font-semibold text-amber-300 shadow-lg">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>بلا أنترنيت — الأدوات الحسابية خدامة أوفلاين</span>
    </div>
  );
};

const MainAppShell: React.FC<{ initialTab?: AppTab }> = ({ initialTab }) => {
  const { isSpeaking, isLoadingAudio, activeSpeechId, speakPro, stop } = useDarijaSpeech();
  const {
    activeCode,
    remainingTrials,
    isBlocked,
    blockReason,
    openPaymentModal,
  } = useCodeAccess();

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    if (initialTab) return initialTab;
    if (typeof window !== 'undefined' && window.location.pathname === '/admin') {
      return 'admin';
    }
    return 'home';
  });
  const [activeTool, setActiveTool] = useState<ToolId | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAnalyzeImg, setPendingAnalyzeImg] = useState<string | null>(null);
  const [drawImage, setDrawImage] = useState<string | null>(null);

  const [savedPlans, setSavedPlans] = useState<SavedPlan[]>(() =>
    loadLocalArray<SavedPlan>(SAVED_PLANS_KEY)
  );
  const [voiceNotes, setVoiceNotes] = useState<VoiceNote[]>(() =>
    loadLocalArray<VoiceNote>(VOICE_NOTES_KEY)
  );

  const handleCameraCapture = (dataUrl: string) => {
    setCameraOpen(false);
    setPendingAnalyzeImg(dataUrl);
    setActiveTab('analyze');
  };

  const handleSelectImageForAnalysis = (src: string) => {
    setPendingAnalyzeImg(src);
    setActiveTab('analyze');
  };

  const handleOpenInAnnotator = (src: string) => {
    setDrawImage(src);
    setActiveTool('draw');
    setActiveTab('tools');
  };

  const handleSavePlan = async (analysis: BlueprintAnalysis, thumbnailDataUrl?: string) => {
    const newPlan: SavedPlan = {
      ...analysis,
      id: `local_${Date.now()}`,
      ownerId: 'local',
      thumbnailDataUrl,
      createdAtMs: Date.now(),
      syncedToCloud: false,
    };
    const next = [newPlan, ...savedPlans];
    setSavedPlans(next);
    saveLocalArray(SAVED_PLANS_KEY, next);
  };

  const handleDeletePlan = async (id: string) => {
    const next = savedPlans.filter((p) => p.id !== id);
    setSavedPlans(next);
    saveLocalArray(SAVED_PLANS_KEY, next);
  };

  const handleRenamePlan = async (id: string, newTitle: string) => {
    const next = savedPlans.map((p) => (p.id === id ? { ...p, title: newTitle } : p));
    setSavedPlans(next);
    saveLocalArray(SAVED_PLANS_KEY, next);
  };

  const handleSaveVoiceNote = async (title: string, rawTranscript: string, structuredDarija: string) => {
    const note: VoiceNote = {
      id: `local_note_${Date.now()}`,
      ownerId: 'local',
      title,
      rawTranscript,
      structuredDarija,
      createdAtMs: Date.now(),
      syncedToCloud: false,
    };
    const next = [note, ...voiceNotes];
    setVoiceNotes(next);
    saveLocalArray(VOICE_NOTES_KEY, next);
  };

  const handleDeleteVoiceNote = async (id: string) => {
    const next = voiceNotes.filter((n) => n.id !== id);
    setVoiceNotes(next);
    saveLocalArray(VOICE_NOTES_KEY, next);
  };

  const handleOpenSavedPlan = (plan: SavedPlan) => {
    if (plan.thumbnailDataUrl) {
      setPendingAnalyzeImg(plan.thumbnailDataUrl);
      setActiveTab('analyze');
    } else {
      setActiveTab('projects');
    }
  };

  const navItems: Array<{
    id: AppTab;
    label: string;
    mobileLabel?: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { id: 'home', label: 'الرئيسية', icon: Home },
    { id: 'analyze', label: 'فهم البلان', mobileLabel: 'البلان', icon: ScanLine },
    { id: 'tools', label: 'الأدوات', icon: Wrench },
    { id: 'learn', label: 'تعلم البلان', mobileLabel: 'تعلم', icon: BookOpen },
    { id: 'projects', label: 'المشاريع', icon: FolderKanban },
    { id: 'settings', label: 'الضبط', icon: Settings },
  ];

  const triggerNavHaptic = () => {
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        navigator.vibrate(12);
      }
    } catch {
      // Ignore unsupported environments
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0f1e] blueprint-grid text-slate-100 flex flex-col">
      <header className="sticky top-0 z-30 h-14 border-b border-white/10 bg-[#0a0f1e]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            <img src="/icon.svg" alt="شعار فاهم بلان" className="w-7 h-7 rounded-lg shrink-0" />
            <span>فاهم بلان</span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  activeTab === item.id
                    ? 'border-[#ff7a1a] text-white'
                    : 'border-transparent hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <VoiceGenderSwitch className="hidden sm:inline-flex" />

            {isSpeaking && activeSpeechId === 'header-quick-voice' ? (
              <button
                type="button"
                onClick={stop}
                className="min-h-[40px] inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-3.5 py-1.5 text-xs font-extrabold text-[#0a0f1e] whitespace-nowrap shrink-0"
              >
                <VolumeX className="w-4 h-4 shrink-0" />
                <span>{isLoadingAudio ? 'جاري...' : 'حبس'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void speakPro(
                    'مرحبا بيك فـ فاهم بلان. ورك على صور بلان ديالك باش نقراو ليك مخطط البناء بالدارجة المغربية.',
                    { id: 'header-quick-voice' }
                  )
                }
                aria-label="تشغيل الصوت التعريفي"
                className="min-h-[40px] inline-flex items-center gap-1.5 rounded-xl border border-[#ff7a1a]/40 bg-[#16203a] px-3 py-1.5 text-xs font-bold text-[#ff7a1a] hover:bg-[#1e2b4d] whitespace-nowrap shrink-0"
              >
                <Volume2 className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">سمع</span>
              </button>
            )}

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              title={`واتساب ${WHATSAPP_NUMBER}`}
              aria-label="واتساب"
              className="relative min-h-[34px] inline-flex items-center gap-1.5 rounded-full bg-[#25D366] hover:bg-[#1ebe5b] px-2.5 py-1 text-[11px] font-extrabold text-[#062411] shadow-md shadow-[#25D366]/25 whitespace-nowrap shrink-0 transition-colors"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="w-3.5 h-3.5 shrink-0">
                <path d="M12.031 2c-5.516 0-9.969 4.453-9.969 9.969 0 1.766.453 3.484 1.328 5l-1.391 5.078 5.203-1.359a9.92 9.92 0 0 0 4.828 1.25c5.516 0 9.969-4.453 9.969-9.969S17.547 2 12.031 2zm5.813 14.125c-.25.703-1.438 1.344-1.984 1.422-.531.078-1.203.109-1.938-.125-.453-.141-1.031-.344-1.766-.656-3.094-1.344-5.109-4.484-5.266-4.688-.156-.203-1.266-1.688-1.266-3.219 0-1.531.797-2.281 1.078-2.594.281-.313.625-.391.828-.391.203 0 .422 0 .609.016.188.016.453-.078.703.531.266.625.891 2.172.969 2.328.078.156.125.344.031.547-.094.203-.156.344-.313.516-.156.172-.328.391-.469.516-.156.156-.313.328-.141.641.188.313.813 1.344 1.75 2.172 1.203 1.078 2.219 1.406 2.531 1.563.313.156.5.125.688-.078.188-.203.797-.938 1.016-1.25.219-.313.422-.266.719-.156.297.109 1.891.891 2.219 1.047.328.156.547.234.625.375.078.141.078.797-.172 1.5z" />
              </svg>
              <span>واتساب</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 pt-6 pb-24 md:pb-10">
        {activeTab === 'home' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {isBlocked ? (
                <button
                  type="button"
                  onClick={() => openPaymentModal(blockReason || 'limit_reached')}
                  className="text-xs font-bold text-red-300 hover:text-red-200 underline underline-offset-4"
                >
                  {blockReason === 'inactive'
                    ? `الكود (${activeCode}) موقوف — تواصل عبر واتساب ${WHATSAPP_NUMBER}`
                    : `ساليو تجارب الكود (${activeCode}: 0/${MAX_CODE_TRIALS}) — تواصل عبر واتساب ${WHATSAPP_NUMBER}`}
                </button>
              ) : (
                <span className="text-xs font-semibold text-slate-400">
                  الكود:{' '}
                  <span className="font-mono-nums text-[#ff7a1a] font-bold">
                    {activeCode || '---'}
                  </span>{' '}
                  · الباقي:{' '}
                  <span className="font-mono-nums text-white font-bold">
                    {remainingTrials} / {MAX_CODE_TRIALS}
                  </span>
                </span>
              )}
              <VoiceGenderSwitch />
            </div>

            <HomeView
              onOpenCamera={() => setCameraOpen(true)}
              onSelectImageForAnalysis={handleSelectImageForAnalysis}
              onNavigate={setActiveTab}
              recentPlans={savedPlans}
              onOpenSavedPlan={handleOpenSavedPlan}
            />
          </div>
        )}

        {activeTab === 'analyze' && (
          <AnalyzeView
            initialImageSrc={pendingAnalyzeImg}
            onClearInitialImage={() => setPendingAnalyzeImg(null)}
            onOpenCamera={() => setCameraOpen(true)}
            onSavePlan={handleSavePlan}
            onOpenInAnnotator={handleOpenInAnnotator}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'tools' && (
          <ToolsView
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            onBackHome={() => setActiveTab('home')}
            initialDrawImage={drawImage}
            voiceNotes={voiceNotes}
            onSaveVoiceNote={handleSaveVoiceNote}
            onDeleteVoiceNote={handleDeleteVoiceNote}
          />
        )}

        {activeTab === 'learn' && <LearnView onBack={() => setActiveTab('home')} />}

        {activeTab === 'projects' && (
          <ProjectsView
            plans={savedPlans}
            onDeletePlan={handleDeletePlan}
            onRenamePlan={handleRenamePlan}
            onOpenInAnnotator={handleOpenInAnnotator}
            onGoAnalyze={() => setActiveTab('analyze')}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            onOpenAdmin={() => setActiveTab('admin')}
            onBack={() => setActiveTab('home')}
          />
        )}

        {activeTab === 'admin' && <AdminView onBack={() => setActiveTab('home')} />}
      </main>

      <nav
        aria-label="التنقل الرئيسي"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0a0f1e]/95 backdrop-blur-md pb-safe"
      >
        <div className="grid grid-cols-6 h-16 items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerNavHaptic();
                  setActiveTab(item.id);
                }}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-1 transition-all duration-150 active:scale-90 ${
                  active ? 'text-[#ff7a1a]' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-bold tracking-tight whitespace-nowrap">
                  {item.mobileLabel || item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <CameraModal
        isOpen={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <CodeGateModal
        suppressGate={activeTab === 'admin'}
        onOpenAdmin={() => setActiveTab('admin')}
      />

      <PaymentModal />
      <OfflineBanner />
    </div>
  );
};

const EntryRouter: React.FC = () => {
  const { activeCode } = useCodeAccess();
  const { stop } = useDarijaSpeech();
  const isAdminRoute =
    typeof window !== 'undefined' && window.location.pathname === '/admin';
  const [enteredApp, setEnteredApp] = useState(false);
  const [entryTab, setEntryTab] = useState<AppTab | undefined>(undefined);

  if (!activeCode && !enteredApp && !isAdminRoute) {
    return (
      <LandingPage
        onEnterApp={() => {
          stop();
          setEntryTab(undefined);
          setEnteredApp(true);
        }}
        onOpenAdmin={() => {
          stop();
          setEntryTab('admin');
          setEnteredApp(true);
        }}
      />
    );
  }

  return <MainAppShell initialTab={entryTab} />;
};

export default function App() {
  return (
    <SpeechProvider>
      <CodeProvider>
        <EntryRouter />
      </CodeProvider>
    </SpeechProvider>
  );
}
