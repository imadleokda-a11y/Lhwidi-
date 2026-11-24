import React, { useState } from 'react';
import {
  Activity,
  ArrowRight,
  Blocks,
  Calculator,
  Camera,
  Compass,
  FlaskConical,
  Gauge,
  Grid,
  Layers,
  Magnet,
  Mic,
  Paintbrush,
  Pencil,
  QrCode,
  Ruler,
  ScanLine,
  ShieldAlert,
} from 'lucide-react';
import type { ToolCategory, ToolId, VoiceNote } from '../types';
import { TOOLS_CATALOG } from '../constants';
import { SpeakButton, useDarijaSpeech, VoiceGenderSwitch } from '../contexts/SpeechContext';
import { MaterialCalculators } from './tools/MaterialCalculators';
import { SmartSiteTools } from './tools/SmartSiteTools';
import { FieldSiteTools } from './tools/FieldSiteTools';

interface ToolsViewProps {
  activeTool: ToolId | null;
  onSelectTool: (id: ToolId | null) => void;
  onBackHome: () => void;
  initialDrawImage: string | null;
  voiceNotes: VoiceNote[];
  onSaveVoiceNote: (title: string, raw: string, structured: string) => Promise<void>;
  onDeleteVoiceNote: (id: string) => Promise<void>;
}

const TOOL_ICON: Record<ToolId, React.ComponentType<{ className?: string }>> = {
  'metal-detector': Magnet,
  'laser-level': ScanLine,
  'ar-meter': Ruler,
  'crack-detector': ShieldAlert,
  'leak-detector': Activity,
  'cement-formula': FlaskConical,
  cement: Layers,
  concrete: Blocks,
  brick: Blocks,
  paint: Paintbrush,
  tile: Grid,
  rebar: Calculator,
  level: Gauge,
  compass: Compass,
  'camera-measure': Camera,
  'voice-ideas': Mic,
  draw: Pencil,
  qr: QrCode,
};

export const ToolsView: React.FC<ToolsViewProps> = ({
  activeTool,
  onSelectTool,
  onBackHome,
  initialDrawImage,
  voiceNotes,
  onSaveVoiceNote,
  onDeleteVoiceNote,
}) => {
  const { stop } = useDarijaSpeech();
  const [filter, setFilter] = useState<ToolCategory>('all');

  if (activeTool) {
    const toolMeta = TOOLS_CATALOG.find((t) => t.id === activeTool);
    const isMaterialCalc =
      activeTool === 'cement-formula' ||
      activeTool === 'cement' ||
      activeTool === 'concrete' ||
      activeTool === 'brick' ||
      activeTool === 'paint' ||
      activeTool === 'tile' ||
      activeTool === 'rebar';
    const isSmartTool =
      activeTool === 'metal-detector' ||
      activeTool === 'laser-level' ||
      activeTool === 'ar-meter' ||
      activeTool === 'crack-detector' ||
      activeTool === 'leak-detector';

    return (
      <div className="space-y-6 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              stop();
              onSelectTool(null);
            }}
            className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white hover:bg-[#16203a]"
          >
            <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
            <span>رجوع لصندوق العدة</span>
          </button>

          <div className="flex items-center gap-2">
            <VoiceGenderSwitch useCloudTts />
            {toolMeta && (
              <SpeakButton
                id={`tool-guide-${toolMeta.id}`}
                variant="ghost"
                label="شرح الأداة"
                text={toolMeta.voiceGuide}
              />
            )}
          </div>
        </div>

        <section className="rounded-3xl border border-white/10 bg-[#11182c] p-5 sm:p-7">
          {isMaterialCalc ? (
            <MaterialCalculators key={activeTool} toolId={activeTool} />
          ) : isSmartTool ? (
            <SmartSiteTools key={activeTool} toolId={activeTool} />
          ) : (
            <FieldSiteTools
              key={activeTool}
              toolId={activeTool}
              initialDrawImage={initialDrawImage}
              voiceNotes={voiceNotes}
              onSaveVoiceNote={onSaveVoiceNote}
              onDeleteVoiceNote={onDeleteVoiceNote}
            />
          )}
        </section>
      </div>
    );
  }

  const visibleTools =
    filter === 'all' ? TOOLS_CATALOG : TOOLS_CATALOG.filter((t) => t.category === filter);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBackHome}
          className="min-h-[44px] inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#11182c] px-4 py-2 text-sm font-bold text-white hover:bg-[#16203a]"
        >
          <ArrowRight className="w-4 h-4 text-[#ff7a1a]" />
          <span>رجوع للرئيسية</span>
        </button>

        <div className="flex items-center gap-2">
          <VoiceGenderSwitch useCloudTts />
          <SpeakButton
            id="tools-hub-guide"
            variant="secondary"
            label="سمع دليل العدة"
            text="مرحبا بيك فصندوق العدة الذكي: عندك كاشف الحديد، نيفو ليزر، متر الكاميرا، كاشف الشقوق بالذكاء الاصطناعي، كاشف التسريب، وحاسبة السيما بالفورمول الحقيقي، مع طناش أداة أخرى للبناء."
          />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-white">صندوق العدة الذكي وأدوات الشانطي</h1>
        <p className="text-sm text-slate-400 mt-1">
          كل مربع كيحل ليك أداة فصفحة مستقلة مع الشرح الصوتي بالدارجة (بنت أو ولد)
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl border border-white/10 bg-[#11182c] w-fit">
        {[
          { id: 'all' as const, label: 'الكل (18)' },
          { id: 'smart' as const, label: 'صندوق العدة الذكي (6)' },
          { id: 'calc' as const, label: 'حساب المواد (6)' },
          { id: 'field' as const, label: 'أدوات الشانطي (6)' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id)}
            className={`min-h-[40px] px-4 py-1.5 rounded-xl text-xs font-extrabold transition-colors whitespace-nowrap ${
              filter === tab.id
                ? 'bg-[#ff7a1a] text-[#0a0f1e]'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleTools.map((tool) => {
          const Icon = TOOL_ICON[tool.id];
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className="text-right rounded-2xl border border-white/10 bg-[#11182c] hover:border-[#ff7a1a]/60 hover:bg-[#151e36] p-5 flex items-start gap-4 transition-colors group"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#0a0f1e] border border-[#ff7a1a]/30 text-[#ff7a1a] flex items-center justify-center shrink-0 group-hover:bg-[#ff7a1a] group-hover:text-[#0a0f1e] transition-colors">
                <Icon className="w-6 h-6" />
              </div>
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-bold text-[#ff7a1a]">
                  {tool.category === 'smart'
                    ? 'العدة الذكية'
                    : tool.category === 'calc'
                      ? 'حاسبة'
                      : 'أداة شانطي'}
                </p>
                <h3 className="text-base font-extrabold text-white">{tool.title}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{tool.desc}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
