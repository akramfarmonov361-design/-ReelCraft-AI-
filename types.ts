
export type GenerationStatus = 'IDLE' | 'GENERATING' | 'COMPLETE' | 'ERROR';

export type ProgressStepStatus = 'pending' | 'running' | 'complete' | 'error';

export interface ProgressStep {
  id: 'script' | 'image' | 'audio';
  label: string;
  status: ProgressStepStatus;
  progress?: number; // 0-100
  detail?: string; // e.g. "2/4 rasm"
}

// Voice names must be PascalCase for the API.
export type VoiceOption =
  'Zephyr'
  | 'Kore'
  | 'Fenrir'
  | 'Charon'
  | 'Achernar'
  | 'Puck'
  | 'Gacrux'
  | 'Umbriel'
  | 'Schedar'
  | 'Sulafat'
  | 'Despina';

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

export interface TimedScriptChunk {
  text: string;
  start: number;
  end: number;
  words: WordTiming[];
}

export interface ReelContent {
  script: string[];
  timedScript: TimedScriptChunk[];
  imagePrompts?: string[];
  imageUrls: string[];
  audioB64: string;
  sources?: {
    uri: string;
    title: string;
  }[];
  hashtags?: string[];
}

export interface TopicCategory {
  category: string;
  topics: string[];
}

export type ImageSourceOption = 'generate' | 'upload' | 'find';
export type AudioSourceOption = 'generate' | 'upload';
export type ContentLanguage = 'uz' | 'ru' | 'en';

export type VideoQuality = '720p' | '1080p';

export interface VideoQualityConfig {
  width: number;
  height: number;
  label: string;
}

export interface SubtitleStyle {
  fontFamily: string;
  fontSize: number;
  activeColor: string;
  defaultColor: string;
  bgEnabled: boolean;
  bgColor: string;
}
