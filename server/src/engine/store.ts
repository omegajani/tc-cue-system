import fs from "fs";
import os from "os";
import path from "path";
import { Show } from "../types.js";

const SEED_DATA_DIR = path.join(process.cwd(), "data");
const DATA_DIR = process.env.TC_CUE_DATA_DIR
  ? path.resolve(process.env.TC_CUE_DATA_DIR)
  : process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Application Support", "TC Cue System")
    : path.join(os.homedir(), ".tc-cue-system");

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

function seedFilePath(name: string) {
  return path.join(SEED_DATA_DIR, `${name}.json`);
}

function ensureDataFile(name: string): void {
  const target = filePath(name);
  if (fs.existsSync(target)) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const seed = seedFilePath(name);
  if (fs.existsSync(seed)) fs.copyFileSync(seed, target);
}

function readJson<T>(name: string): T[] {
  ensureDataFile(name);
  const target = filePath(name);
  let raw: string;
  try {
    raw = fs.readFileSync(target, "utf-8");
  } catch {
    return []; // Datei (noch) nicht vorhanden
  }
  try {
    return JSON.parse(raw) as T[];
  } catch {
    // Beschädigte Datei NICHT stillschweigend als leer behandeln (würde beim
    // nächsten Schreiben überschrieben → Datenverlust). Stattdessen sichern.
    try {
      const backup = `${target}.corrupt-${Date.now()}`;
      fs.copyFileSync(target, backup);
      console.error(`[Store] "${name}.json" ist beschädigt – Sicherung unter ${backup}`);
    } catch { /* ignore */ }
    return [];
  }
}

function writeJson<T>(name: string, data: T[]): void {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  // Shows beim Schreiben mit Zeitstempel versehen → „neuestes gewinnt" beim Repo-Sync
  if (name === "shows") {
    const now = new Date().toISOString();
    for (const show of data as unknown as Array<{ savedAt?: string }>) show.savedAt = now;
  }
  // Atomar schreiben: erst in temp-Datei, dann umbenennen. Ein Crash mitten im
  // Schreiben kann so die einzige Datenquelle nicht korrumpieren.
  const target = filePath(name);
  const tmp = `${target}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmp, target);
}

// Shows
// In-Memory-Arbeitskopie: granulare Edits (upsertShow/deleteShow) mutieren nur
// den Cache. Auf die Platte geschrieben wird erst per flushShows() (Speichern,
// neue/gelöschte Show, Import, Live-Abhaken).
let cache: Show[] | null = null;

export function getShows(): Show[] {
  if (cache === null) cache = readJson<Show>("shows");
  return cache;
}

/** Setzt die Arbeitskopie und schreibt sie sofort auf die Platte. */
export function saveShows(shows: Show[]): void {
  cache = shows;
  writeJson("shows", shows);
}

/** Schreibt die aktuelle In-Memory-Arbeitskopie auf die Platte. */
export function flushShows(): void {
  if (cache !== null) writeJson("shows", cache);
}

export function getShow(id: string): Show | undefined {
  return getShows().find((s) => s.id === id);
}

/** Nur In-Memory – Persistenz erst per flushShows().
 *  Ersetzt eine bestehende Show an ihrer Position (keine Reihenfolge-Änderung),
 *  neue Shows werden angehängt. */
export function upsertShow(show: Show): void {
  const all = getShows();
  const idx = all.findIndex((s) => s.id === show.id);
  if (idx === -1) cache = [...all, show];
  else { const next = [...all]; next[idx] = show; cache = next; }
}

/** Nur In-Memory – Persistenz erst per flushShows(). */
export function deleteShow(id: string): void {
  cache = getShows().filter((s) => s.id !== id);
}
