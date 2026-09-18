import fs from "fs";
import path from "path";
import { Show } from "../types.js";
import { DATA_DIR, writeFileAtomic } from "./store.js";

// Sicherungen einzelner Shows: backups/shows/<showId>/<zeit>__<art>.json im
// Datenordner. „manual" = vom Nutzer angelegt (wird nie automatisch gelöscht),
// „auto" = vor riskanten Aktionen bzw. höchstens stündlich bei Änderungen.

const BACKUP_ROOT = path.join(DATA_DIR, "backups", "shows");
const MAX_AUTO_PER_SHOW = 50;
const AUTO_INTERVAL_MS = 60 * 60 * 1000;

export type BackupKind = "manual" | "auto";

export interface BackupMeta {
  id: string;          // Dateiname ohne .json
  showId: string;
  showName: string;
  createdAt: string;
  kind: BackupKind;
  label?: string;      // Name (manuell) bzw. Anlass (auto)
  counts: { cues: number; positions: number; checklists: number };
}

interface BackupFile {
  version: 1;
  meta: BackupMeta;
  show: Show;
}

const lastAutoAt = new Map<string, number>();

function showDir(showId: string): string {
  // showId kommt aus den eigenen Daten, trotzdem gegen Pfad-Tricks absichern
  return path.join(BACKUP_ROOT, showId.replace(/[^A-Za-z0-9_-]/g, "_"));
}

function readBackup(file: string): BackupFile | null {
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf-8")) as BackupFile;
    return data && data.meta && data.show ? data : null;
  } catch {
    return null;
  }
}

export function createBackup(show: Show, kind: BackupKind, label?: string): BackupMeta {
  const now = new Date();
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  let id = `${stamp}__${kind}`;
  const dir = showDir(show.id);
  // gleiche Millisekunde (z. B. Auto + manuell direkt hintereinander) → eindeutig machen
  for (let i = 2; fs.existsSync(path.join(dir, `${id}.json`)); i++) id = `${stamp}__${kind}-${i}`;
  const meta: BackupMeta = {
    id,
    showId: show.id,
    showName: show.name,
    createdAt: now.toISOString(),
    kind,
    label: label?.trim() || undefined,
    counts: {
      cues: show.cues?.length ?? 0,
      positions: show.positions?.length ?? 0,
      checklists: show.checklists?.length ?? 0,
    },
  };
  const file: BackupFile = { version: 1, meta, show: JSON.parse(JSON.stringify(show)) };
  writeFileAtomic(path.join(dir, `${id}.json`), JSON.stringify(file, null, 2));
  if (kind === "auto") {
    lastAutoAt.set(show.id, now.getTime());
    pruneAuto(show.id);
  }
  return meta;
}

/** Vor einer Änderung aufrufen: sichert den bisherigen Stand höchstens einmal pro Stunde. */
export function autoBackupBeforeChange(show: Show | undefined): void {
  if (!show) return;
  let last = lastAutoAt.get(show.id);
  if (last === undefined) {
    // nach Neustart: jüngste Auto-Sicherung auf der Platte zählt
    const newest = listBackups(show.id).find((b) => b.kind === "auto");
    last = newest ? Date.parse(newest.createdAt) : 0;
    lastAutoAt.set(show.id, last);
  }
  if (Date.now() - last < AUTO_INTERVAL_MS) return;
  try {
    createBackup(show, "auto", "Stündliche Sicherung vor Änderung");
  } catch (err) {
    console.warn("[Backup] Auto-Sicherung fehlgeschlagen:", (err as Error).message);
  }
}

function pruneAuto(showId: string): void {
  const autos = listBackups(showId).filter((b) => b.kind === "auto");
  for (const b of autos.slice(MAX_AUTO_PER_SHOW)) {
    try { fs.unlinkSync(path.join(showDir(showId), `${b.id}.json`)); } catch { /* ignore */ }
  }
}

/** Sicherungen, neueste zuerst. Ohne showId: alle (auch von gelöschten Shows). */
export function listBackups(showId?: string): BackupMeta[] {
  const dirs = showId
    ? [showDir(showId)]
    : (fs.existsSync(BACKUP_ROOT) ? fs.readdirSync(BACKUP_ROOT).map((d) => path.join(BACKUP_ROOT, d)) : []);
  const out: BackupMeta[] = [];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".json")) continue;
      const b = readBackup(path.join(dir, f));
      if (b) out.push({ ...b.meta, id: f.slice(0, -5) });
    }
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadBackup(showId: string, backupId: string): Show | null {
  if (!/^[A-Za-z0-9_-]+$/.test(backupId)) return null;
  return readBackup(path.join(showDir(showId), `${backupId}.json`))?.show ?? null;
}
