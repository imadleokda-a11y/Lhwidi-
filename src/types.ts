export type AppTab =
  | 'home'
  | 'analyze'
  | 'tools'
  | 'learn'
  | 'projects'
  | 'settings'
  | 'admin';

export type ToolCategory = 'all' | 'smart' | 'calc' | 'field';

export type ToolId =
  | 'metal-detector'
  | 'laser-level'
  | 'ar-meter'
  | 'crack-detector'
  | 'leak-detector'
  | 'cement-formula'
  | 'cement'
  | 'concrete'
  | 'brick'
  | 'paint'
  | 'tile'
  | 'rebar'
  | 'level'
  | 'compass'
  | 'camera-measure'
  | 'voice-ideas'
  | 'draw'
  | 'qr';

export interface BlueprintRoom {
  name: string;
  dimensions: string;
  areaSqm: string;
  notes?: string;
}

export interface BlueprintMaterial {
  name: string;
  quantity: string;
  unit: string;
  notes?: string;
}

export interface BlueprintPhase {
  stepNumber: number;
  phaseName: string;
  explanationDarija: string;
}

export interface BlueprintAnalysis {
  isBlueprint: boolean;
  title: string;
  buildingType: string;
  totalAreaSqm: string;
  roomsCount: number;
  darijaSummary: string;
  audioScript: string;
  structuralNotes?: string;
  rooms: BlueprintRoom[];
  materials: BlueprintMaterial[];
  phases: BlueprintPhase[];
  warnings: string[];
}

export interface SavedPlan extends BlueprintAnalysis {
  id: string;
  ownerId: string;
  thumbnailDataUrl?: string;
  createdAtMs: number;
  syncedToCloud?: boolean;
}

export interface VoiceNote {
  id: string;
  ownerId: string;
  title: string;
  rawTranscript: string;
  structuredDarija: string;
  createdAtMs: number;
  syncedToCloud?: boolean;
}

export interface SubscriberCode {
  id: string;
  ownerId: string;
  name: string;
  code: string;
  isActive: boolean;
  trials: number;
  createdAtMs: number;
  updatedAtMs: number;
  syncedToCloud?: boolean;
}

export interface VoiceSettings {
  voiceEnabled: boolean;
  voiceGender: 'male' | 'female';
  speechRate: number;
}

export interface CrackDiagnosis {
  severity: 'surface' | 'moderate' | 'structural';
  severityLabelDarija: string;
  diagnosisDarija: string;
  causeDarija: string;
  repairSteps: string[];
  audioScript: string;
}
