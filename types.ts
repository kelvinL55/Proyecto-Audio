
export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  originalTranscription?: string; // The raw transcription before polish
  polishedVersion?: string; // The grammatically corrected version
  timestamp: number;
  audioUrl?: string; // If it's a user audio message
}

export interface AudioConfig {
  gain: number; // Amplification level (1.0 = normal, 2.0 = double volume)
}

export enum AppState {
  IDLE = 'IDLE',
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  PLAYING_TTS = 'PLAYING_TTS',
  IMPROVING = 'IMPROVING'
}

export type PlatformType = 'email' | 'chat' | 'instructions';
export type EmailTone = 'formal' | 'semi-formal' | 'neutral';
export type ChatTone = 'angry' | 'serious' | 'friendly' | 'professional' | 'formal';
export type InstructionTone = 'professional' | 'semi-formal' | 'neutral';

export interface ImprovementOptions {
  type: PlatformType;
  emailTone?: EmailTone;
  chatTone?: ChatTone;
  instructionTone?: InstructionTone;
  useEmojis?: boolean;
  isHumanized?: boolean;
}

export interface ImprovementResult {
  subject?: string; // Only for email
  body: string;
}