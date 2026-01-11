
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  originalTranscription?: string;
  polishedVersion?: string;
  timestamp: number;
  audioUrl?: string;
}

export interface AudioConfig {
  gain: number;
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  PLAYING_TTS = 'PLAYING_TTS',
  IMPROVING = 'IMPROVING'
}

export type PlatformType = 'email' | 'chat' | 'instructions' | 'prompt_improver';
export type EmailTone = 'formal' | 'semi-formal' | 'neutral';
export type ChatTone = 'angry' | 'serious' | 'friendly' | 'professional' | 'formal';
export type InstructionTone = 'professional' | 'semi-formal' | 'neutral';
export type PromptCategory = 'image' | 'code' | 'video' | 'general';

export interface ImprovementOptions {
  type: PlatformType;
  emailTone?: EmailTone;
  chatTone?: ChatTone;
  instructionTone?: InstructionTone;
  promptCategory?: PromptCategory;
  imaginationLevel?: number; // 1 to 5
  useEmojis?: boolean;
  isHumanized?: boolean;
}

export interface ImprovementResult {
  subject?: string;
  body: string;
}