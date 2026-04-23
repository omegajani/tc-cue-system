import fs from "fs";
import path from "path";
import { Show, Cuelist } from "../types.js";

const DATA_DIR = path.join(process.cwd(), "data");

function filePath(name: string) {
  return path.join(DATA_DIR, `${name}.json`);
}

function readJson<T>(name: string): T[] {
  try {
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

// Cuelists
export function getCuelists(): Cuelist[] { return readJson<Cuelist>("cuelists"); }
export function saveCuelists(lists: Cuelist[]): void { writeJson("cuelists", lists); }

export function getCuelist(id: string): Cuelist | undefined {
  return getCuelists().find((c) => c.id === id);
}

export function getCuelistsForShow(showId: string): Cuelist[] {
  return getCuelists().filter((c) => c.showId === showId);
}

export function upsertCuelist(list: Cuelist): void {
  const all = getCuelists().filter((c) => c.id !== list.id);
  saveCuelists([...all, list]);
}

export function deleteCuelist(id: string): void {
  saveCuelists(getCuelists().filter((c) => c.id !== id));
}
