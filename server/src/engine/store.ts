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
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), "utf-8");
}

// Shows
export function getShows(): Show[] { return readJson<Show>("shows"); }
export function saveShows(shows: Show[]): void { writeJson("shows", shows); }

export function getShow(id: string): Show | undefined {
  return getShows().find((s) => s.id === id);
}

export function upsertShow(show: Show): void {
  const all = getShows().filter((s) => s.id !== show.id);
  saveShows([...all, show]);
}

export function deleteShow(id: string): void {
  saveShows(getShows().filter((s) => s.id !== id));
}
