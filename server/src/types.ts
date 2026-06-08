export type TCSource = "ltc" | "mtc" | "rtpmidi" | "osc" | "simulator";
export type FallbackMode = "stop" | "continue" | "loop";

export interface Cue {
  id: string;
  tc: string; // HH:MM:SS:FF
  title: string;
  message: string;
  warnOffsetSec: number;
  color: string;
}

export interface Show {
  id: string;
  name: string;
  date: string;
  cues: Cue[];
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
