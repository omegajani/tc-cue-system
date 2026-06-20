#!/usr/bin/env node
// Synchronisiert die Live-Show-Datei mit der versionierten Repo-Kopie
// (server/data/shows.json). „Neuestes gewinnt": bei inhaltlichem Unterschied
// wird die Version mit dem jüngeren `savedAt` in beide Richtungen übernommen.
// Best-effort – bricht nie hart ab (für den Einsatz in einem git-Hook).
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoFile = path.join(repoRoot, "server", "data", "shows.json");

function liveDir() {
  if (process.env.TC_CUE_DATA_DIR) return path.resolve(process.env.TC_CUE_DATA_DIR);
  if (process.platform === "darwin")
    return path.join(os.homedir(), "Library", "Application Support", "TC Cue System");
  return path.join(os.homedir(), ".tc-cue-system");
}
const liveFile = path.join(liveDir(), "shows.json");

function read(p) {
  try { return JSON.parse(fs.readFileSync(p, "utf-8")); } catch { return null; }
}
function write(p, data) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2), "utf-8");
}
// Inhalt ohne savedAt vergleichbar machen (Zeitstempel allein soll keinen Sync auslösen)
function contentKey(shows) {
  return JSON.stringify((shows || []).map(({ savedAt, ...rest }) => rest));
}
function newestSavedAt(shows) {
  return (shows || []).reduce((m, s) => (s.savedAt && s.savedAt > m ? s.savedAt : m), "");
}

const live = read(liveFile);
const repo = read(repoFile);

let result;
if (!live && !repo) {
  result = "keine-show";
} else if (live && !repo) {
  write(repoFile, live); result = "repo-neu-angelegt";
} else if (repo && !live) {
  write(liveFile, repo); result = "live-neu-angelegt";
} else if (contentKey(live) === contentKey(repo)) {
  result = "identisch";
} else if (newestSavedAt(live) >= newestSavedAt(repo)) {
  write(repoFile, live); result = "repo-aktualisiert (live war neuer)";
} else {
  write(liveFile, repo); result = "live-aktualisiert (repo war neuer)";
}

console.log(`[sync-show] ${result} | live=${newestSavedAt(live) || "—"} repo=${newestSavedAt(repo) || "—"}`);
