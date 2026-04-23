export type AlertType = "info" | "warning" | "urgent";
export type TCSource = "ltc" | "mtc" | "rtpmidi" | "osc" | "simulator";
export type FallbackMode = "stop" | "continue" | "loop";
export type AudioType = "none" | "beep" | "double-beep" | "chime" | "buzz" | "file";

export interface Cue {
  id: string;
  tc: string; // HH:MM:SS:FF
  title: string;
  message: string;
  targetRoles: string[];
  alertType: AlertType;
  warnOffsetSec: number;
  color: string;
  audioType: AudioType;
  audioFile?: string;  // filename in /api/audio/ – only used when audioType === "file"
  audioVolume: number; // 0.0 – 1.0
}

export interface Cuelist {
  id: string;
  showId: string;
  name: string;
  cues: Cue[];
  updatedAt: string;
  isActive: boolean;
}

export interface Show {
  id: string;
  name: string;
  date: string;
  activeCuelistId: string | null;
  roles: string[];
  tcSource: TCSource;
  fallbackMode: FallbackMode;
  fps?: 24 | 25 | 29.97 | 30;
  audioDevice?: string;
  audioChannel?: "left" | "right" | "mix";
}

// WebSocket event payloads
export interface TCUpdateEvent {
  type: "TC_UPDATE";
  tc: string;
  previousCue: Cue | null;
  currentCue: Cue | null;
  nextCue: Cue | null;
}

export interface CueFireEvent {
  type: "CUE_FIRE";
  tc: string;
  cue: Cue;
  previousCue: Cue | null;
  nextCue: Cue | null;
}

export interface CueWarningEvent {
  type: "CUE_WARNING";
  tc: string;
  cue: Cue;
  secondsUntil: number;
}

export type WSEvent = TCUpdateEvent | CueFireEvent | CueWarningEvent;

// TC as frame count for arithmetic
export interface TCFrames {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  totalFrames: number;
}
