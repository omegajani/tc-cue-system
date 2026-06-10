export type TCSource = "ltc" | "mtc" | "rtpmidi" | "osc" | "simulator";
export type FallbackMode = "stop" | "continue" | "loop";

export interface Cue {
  id: string;
  tc: string; // HH:MM:SS:FF
  title: string;
  message: string;
  color: string;
}

export interface ShowPosition {
  id: string;
  name: string;
  startTc: string;
  endTc: string;
}

export type ChecklistTrigger =
  | { type: "before-first-cue" }
  | { type: "after-cue"; cueId: string }
  | { type: "time"; time: string };

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
}

export interface Checklist {
  id: string;
  title: string;
  trigger: ChecklistTrigger;
  items: ChecklistItem[];
}

export interface Show {
  id: string;
  name: string;
  date: string;
  cues: Cue[];
  positions: ShowPosition[];
  checklists?: Checklist[];
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
  currentPosition: ShowPosition | null;
}

export interface CueFireEvent {
  type: "CUE_FIRE";
  tc: string;
  cue: Cue;
  previousCue: Cue | null;
  nextCue: Cue | null;
}

export type WSEvent = TCUpdateEvent | CueFireEvent;

// TC as frame count for arithmetic
export interface TCFrames {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  totalFrames: number;
}
