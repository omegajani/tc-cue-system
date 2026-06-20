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
  try {
    ensureDataFile(name);
    const raw = fs.readFileSync(filePath(name), "utf-8");
    return JSON.parse(raw) as T[];
  } catch {
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
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
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

/** Nur In-Memory – Persistenz erst per flushShows(). */
export function upsertShow(show: Show): void {
  const all = getShows().filter((s) => s.id !== show.id);
  cache = [...all, show];
}

/** Nur In-Memory – Persistenz erst per flushShows(). */
export function deleteShow(id: string): void {
  cache = getShows().filter((s) => s.id !== id);
}
