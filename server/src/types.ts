export type TCSource = "ltc" | "mtc" | "usb-mtc" | "rtpmidi" | "osc" | "artnet" | "simulator";
export type FallbackMode = "stop" | "continue" | "loop";

export interface Cue {
  id: string;
  tc: string; // HH:MM:SS:FF
  title: string;
  message: string;
  color: string;
  resetShow?: boolean;
  // Rollenzuordnung (clientseitige Filterung):
  gewerk?: string;       // 'licht'|'ton'|'buehne'|'regie'|'video'; undefined = allgemein (alle sehen)
  positions?: string[];  // Crew-Positionen im Gewerk (NICHT die Timeline-ShowPosition); leer = ganzes Gewerk
}

// Zugriffskonfiguration der Show (weiche, clientseitige Filterung).
export interface ShowAccess {
  adminPassword?: string;                     // Master-Passwort; leer = kein Gate
  gewerkPasswords?: Record<string, string>;   // Positions-Passwort pro Gewerk (sieht nur eigene Position)
  meisterPasswords?: Record<string, string>;  // Meister-Passwort pro Gewerk (sieht alle Cues des Gewerks)
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
  // Rollenzuordnung (clientseitige Filterung, wie bei Cue):
  gewerk?: string;       // 'licht'|'ton'|…; undefined = allgemein (alle sehen)
  positions?: string[];  // Crew-Positionen im Gewerk; leer = ganzes Gewerk
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
  midiPort?: string; // gewähltes USB-MIDI-Eingangsport (Name) für Auto-Start
  access?: ShowAccess;
  // Crew-Positionen je Gewerk (z. B. ton: ["FOH","Monitor"]). Überschreibt die
  // UI-Defaults; fehlt ein Gewerk hier, gelten die im Client hinterlegten Standards.
  gewerkPositions?: Record<string, string[]>;
  savedAt?: string;  // ISO-Zeitstempel des letzten Speicherns – „neuestes gewinnt" beim Repo-Sync
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

export interface ShowResetEvent {
  type: "SHOW_RESET";
}

export type WSEvent = TCUpdateEvent | CueFireEvent | ShowResetEvent;

// TC as frame count for arithmetic
export interface TCFrames {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  totalFrames: number;
}
