
export interface SRTItem {
  id: number;
  startTime: number; // in seconds
  endTime: number; // in seconds
  text: string;
}

export interface LayoutConfigStep {
  startTime: number;
  endTime: number;
  layoutMode: 'split' | 'full-video' | 'full-html' | 'pip-html';
  splitRatio?: number; // 0 to 1 (percentage of height given to HTML/Animation layer)
  captionPosition?: 'top' | 'bottom' | 'center' | 'hidden';
}

export interface GeneratedContent {
  html: string;
  layoutConfig: LayoutConfigStep[];
  reasoning?: string;
}

export enum AppState {
  WELCOME = 'WELCOME',
  UPLOAD = 'UPLOAD',
  GENERATING = 'GENERATING',
  EDITOR = 'EDITOR',
  PREVIEW = 'PREVIEW'
}
