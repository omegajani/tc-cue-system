import fs from "fs";
import path from "path";
import { AppConfig, LEGACY_SHOW_FIELDS, PublicConfig, ShowAccess, TCSource, TcConfig } from "../types.js";
import { DATA_DIR, getShows, saveShows, writeFileAtomic } from "./store.js";

// Programm-Konfiguration: alles, was für die ganze Anlage gilt (TC-Eingang,
// Zugang/Passwörter, Crew-Positionen, aktive Show). Liegt als config.json im
// Datenordner – bewusst NICHT im Git (Passwörter).

const CONFIG_FILE = path.join(DATA_DIR, "config.json");
const TC_SOURCES: TCSource[] = ["ltc", "mtc", "usb-mtc", "rtpmidi", "osc", "artnet", "simulator"];

const DEFAULT_TC: TcConfig = {
  source: "simulator",
  audioChannel: "left",
  oscPort: 9000,
  rtpmidiPort: 5004,
  rtpmidiName: "TC Cue System",
};

let config: AppConfig | null = null;

function cleanRecord(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim()) out[k] = v;
    }
  }
  return out;
}

function normalizeAccess(raw: unknown): ShowAccess {
  const a = (raw ?? {}) as ShowAccess;
  const access: ShowAccess = {
    gewerkPasswords: cleanRecord(a.gewerkPasswords),
    meisterPasswords: cleanRecord(a.meisterPasswords),
  };
  if (typeof a.adminPassword === "string" && a.adminPassword.trim()) access.adminPassword = a.adminPassword;
  return access;
}

function normalizeGewerkPositions(raw: unknown): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (raw && typeof raw === "object") {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(v)) out[k] = v.filter((p): p is string => typeof p === "string" && !!p.trim());
    }
  }
  return out;
}

function port(raw: unknown, fallback: number): number {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 65535 ? n : fallback;
}

function normalizeTc(raw: unknown, base: TcConfig = DEFAULT_TC): TcConfig {
  const t = (raw ?? {}) as Partial<TcConfig>;
  const tc: TcConfig = {
    source: TC_SOURCES.includes(t.source as TCSource) ? (t.source as TCSource) : base.source,
    audioChannel: t.audioChannel === "right" || t.audioChannel === "mix" || t.audioChannel === "left" ? t.audioChannel : base.audioChannel,
    oscPort: port(t.oscPort, base.oscPort),
    rtpmidiPort: port(t.rtpmidiPort, base.rtpmidiPort),
    rtpmidiName: typeof t.rtpmidiName === "string" && t.rtpmidiName.trim() ? t.rtpmidiName.trim() : base.rtpmidiName,
  };
  const audioDevice = t.audioDevice !== undefined ? t.audioDevice : base.audioDevice;
  const midiPort = t.midiPort !== undefined ? t.midiPort : base.midiPort;
  if (audioDevice) tc.audioDevice = audioDevice;
  if (midiPort) tc.midiPort = midiPort;
  return tc;
}

function writeConfig(): void {
  writeFileAtomic(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Einmalige Migration: früher hingen TC-Eingang, Passwörter und Crew-Positionen
 * an jeder Show; faktisch galt immer die erste. Diese Werte werden übernommen
 * und aus allen Shows entfernt (damit auch aus der versionierten shows.json).
 */
function migrateFromShows(): AppConfig {
  const shows = getShows();
  const first = shows[0];
  const migrated: AppConfig = {
    activeShowId: first?.id,
    tc: normalizeTc(first ? {
      source: first.tcSource,
      audioDevice: first.audioDevice,
      audioChannel: first.audioChannel,
      midiPort: first.midiPort,
    } : {}),
    access: normalizeAccess(first?.access),
    gewerkPositions: normalizeGewerkPositions(first?.gewerkPositions),
  };
  if (shows.some((s) => LEGACY_SHOW_FIELDS.some((f) => f in s))) {
    saveShows(shows.map((s) => stripLegacyShowFields(s)));
    console.log("[Config] Programm-Einstellungen aus den Shows übernommen und dort entfernt");
  }
  return migrated;
}

/** Entfernt die früher show-bezogenen Programm-Felder (Import alter Dateien, Migration). */
export function stripLegacyShowFields<T extends object>(show: T): T {
  const copy = { ...show } as Record<string, unknown>;
  for (const f of LEGACY_SHOW_FIELDS) delete copy[f];
  return copy as T;
}

export function getConfig(): AppConfig {
  if (config) return config;
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      config = {
        activeShowId: typeof raw.activeShowId === "string" ? raw.activeShowId : undefined,
        tc: normalizeTc(raw.tc),
        access: normalizeAccess(raw.access),
        gewerkPositions: normalizeGewerkPositions(raw.gewerkPositions),
      };
      return config;
    } catch {
      const backup = `${CONFIG_FILE}.corrupt-${Date.now()}`;
      try { fs.copyFileSync(CONFIG_FILE, backup); } catch { /* ignore */ }
      console.error(`[Config] config.json ist beschädigt – Sicherung unter ${backup}, starte mit Standardwerten`);
      config = { tc: { ...DEFAULT_TC }, access: normalizeAccess({}), gewerkPositions: {} };
      writeConfig();
      return config;
    }
  }
  config = migrateFromShows();
  writeConfig();
  return config;
}

export interface ConfigPatch {
  activeShowId?: string;
  tc?: Partial<TcConfig>;
  gewerkPositions?: Record<string, string[]>;
}

/** Teiländerung übernehmen und sofort speichern. Liefert die geänderten Bereiche. */
export function updateConfig(patch: ConfigPatch): { tcChanged: boolean } {
  const cur = getConfig();
  const prevTc = JSON.stringify(cur.tc);
  const next: AppConfig = { ...cur };
  if (patch.activeShowId !== undefined) next.activeShowId = patch.activeShowId || undefined;
  if (patch.tc) next.tc = normalizeTc({ ...cur.tc, ...patch.tc }, cur.tc);
  if (patch.gewerkPositions) next.gewerkPositions = normalizeGewerkPositions(patch.gewerkPositions);
  config = next;
  writeConfig();
  return { tcChanged: JSON.stringify(next.tc) !== prevTc };
}

export function setAccess(raw: unknown): void {
  config = { ...getConfig(), access: normalizeAccess(raw) };
  writeConfig();
}

export function getPublicConfig(): PublicConfig {
  const { access, ...rest } = getConfig();
  const gewerke: PublicConfig["access"]["gewerke"] = {};
  const ids = new Set([...Object.keys(access.gewerkPasswords ?? {}), ...Object.keys(access.meisterPasswords ?? {})]);
  for (const g of ids) {
    gewerke[g] = { position: !!access.gewerkPasswords?.[g], meister: !!access.meisterPasswords?.[g] };
  }
  return { ...rest, access: { gated: !!access.adminPassword, gewerke } };
}

export type LoginResult = { level: "admin" } | { level: "meister" | "position"; gewerk: string };

/** Passwort prüfen: Admin vor Meister vor Position (wie bisher im Client). */
export function checkLogin(password: string): LoginResult | null {
  if (!password) return null;
  const { access } = getConfig();
  if (access.adminPassword && password === access.adminPassword) return { level: "admin" };
  const m = Object.entries(access.meisterPasswords ?? {}).find(([, p]) => p === password);
  if (m) return { level: "meister", gewerk: m[0] };
  const g = Object.entries(access.gewerkPasswords ?? {}).find(([, p]) => p === password);
  if (g) return { level: "position", gewerk: g[0] };
  return null;
}
