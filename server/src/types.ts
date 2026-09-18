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

// Zugriffskonfiguration (programmweit in config.json; weiche, clientseitige Filterung).
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

// Optionales automatisches Abhaken/Schließen einer Checklist, unabhängig vom
// Einblende-Trigger oben. "position" bezieht sich auf einen Song/Abschnitt
// (ShowPosition) der Show, "countdown" zählt ab dem Moment, in dem die
// Checklist eingeblendet wird (Show-TC, nicht Wanduhr).
export type ChecklistAutoClose =
  | { type: "none" }
  | { type: "tc"; tc: string }
  | { type: "position"; positionId: string; anchor: "start" | "mid" | "end" }
  | { type: "countdown"; seconds: number };

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
  autoClose?: ChecklistAutoClose;
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
  fps?: 24 | 25 | 29.97 | 30;  // Framerate des Show-Timecodes; wird beim Aktivieren angewendet
  savedAt?: string;  // ISO-Zeitstempel des letzten Speicherns – „neuestes gewinnt" beim Repo-Sync
  // Veraltet – früher pro Show, heute programmweit in config.json (AppConfig).
  // Nur noch für die einmalige Migration bzw. alte Import-Dateien gelesen.
  tcSource?: TCSource;
  fallbackMode?: FallbackMode;
  audioDevice?: string;
  audioChannel?: "left" | "right" | "mix";
  midiPort?: string;
  access?: ShowAccess;
  gewerkPositions?: Record<string, string[]>;
}

/** Felder, die früher an der Show hingen und jetzt programmweit gelten. */
export const LEGACY_SHOW_FIELDS = ["tcSource", "fallbackMode", "audioDevice", "audioChannel", "midiPort", "access", "gewerkPositions"] as const;

// ── Programm-Konfiguration (config.json im Datenordner, nicht im Git) ────────
export interface TcConfig {
  source: TCSource;
  audioDevice?: string;                    // Browser-deviceId des Rechners, der LTC dekodiert
  audioChannel: "left" | "right" | "mix";
  midiPort?: string;                       // USB-MIDI-Eingang (Name) – Auto-Start beim Boot
  oscPort: number;
  rtpmidiPort: number;
  rtpmidiName: string;
}

export interface AppConfig {
  activeShowId?: string;
  tc: TcConfig;
  access: ShowAccess;
  // Crew-Positionen je Gewerk (z. B. ton: ["FOH","Monitor"]). Fehlt ein Gewerk,
  // gelten die im Client hinterlegten Standards.
  gewerkPositions: Record<string, string[]>;
}

/** Was jeder Client sehen darf: Konfiguration ohne Passwörter. */
export interface PublicConfig extends Omit<AppConfig, "access"> {
  access: {
    gated: boolean;                                              // Admin-Passwort gesetzt → Login nötig
    gewerke: Record<string, { position: boolean; meister: boolean }>; // welche Gewerk-Passwörter gesetzt sind
  };
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

export interface ConfigChangedEvent {
  type: "CONFIG_CHANGED";
  config: PublicConfig;
}

export type WSEvent = TCUpdateEvent | CueFireEvent | ShowResetEvent | ConfigChangedEvent;

// TC as frame count for arithmetic
export interface TCFrames {
  hours: number;
  minutes: number;
  seconds: number;
  frames: number;
  totalFrames: number;
}
