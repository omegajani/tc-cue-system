import { Router, raw } from "express";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { DATA_DIR, writeFileAtomic } from "../engine/store.js";
import { broadcastConfig } from "../engine/activeShow.js";

// Eigene Alarmtöne: liegen im Datenordner (programmweit, damit jedes Gerät sie
// auswählen kann). Welcher Ton gespielt wird, entscheidet jedes Gerät für sich.

const SOUNDS_DIR = path.join(DATA_DIR, "sounds");
const INDEX_FILE = path.join(SOUNDS_DIR, "index.json");
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".m4a": "audio/mp4",
  ".aac": "audio/aac",
  ".flac": "audio/flac",
};

interface SoundMeta {
  id: string;
  name: string;   // Anzeigename (Dateiname ohne Endung)
  file: string;   // Dateiname im sounds-Ordner
  size: number;
  uploadedAt: string;
}

function readIndex(): SoundMeta[] {
  try {
    const list = JSON.parse(fs.readFileSync(INDEX_FILE, "utf-8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeIndex(list: SoundMeta[]): void {
  writeFileAtomic(INDEX_FILE, JSON.stringify(list, null, 2));
}

const router = Router();

// GET /api/sounds — hochgeladene Alarmtöne (die mitgelieferten kennt der Client selbst)
router.get("/", (_req, res) => {
  res.json(readIndex());
});

// GET /api/sounds/:id/file — Tondatei ausliefern
router.get("/:id/file", (req, res) => {
  const sound = readIndex().find((s) => s.id === req.params.id);
  if (!sound) return res.status(404).json({ error: "Sound not found" });
  const file = path.join(SOUNDS_DIR, sound.file);
  if (!fs.existsSync(file)) return res.status(404).json({ error: "File missing" });
  res.type(TYPES[path.extname(sound.file).toLowerCase()] ?? "application/octet-stream");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.sendFile(file);
});

// POST /api/sounds — Datei im Rumpf, Name im Header X-Filename
router.post("/", raw({ type: () => true, limit: MAX_BYTES }), (req, res) => {
  const rawName = decodeURIComponent(String(req.header("x-filename") ?? "")).trim();
  const ext = path.extname(rawName).toLowerCase();
  if (!TYPES[ext]) {
    return res.status(400).json({ error: `Dateiformat nicht unterstützt (${Object.keys(TYPES).join(", ")})` });
  }
  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) return res.status(400).json({ error: "Leere Datei" });

  const id = randomUUID();
  const sound: SoundMeta = {
    id,
    name: path.basename(rawName, ext).slice(0, 60) || "Alarmton",
    file: `${id}${ext}`,
    size: body.length,
    uploadedAt: new Date().toISOString(),
  };
  fs.mkdirSync(SOUNDS_DIR, { recursive: true });
  writeFileAtomic(path.join(SOUNDS_DIR, sound.file), body);
  writeIndex([...readIndex(), sound]);
  broadcastConfig(); // andere Geräte sollen den neuen Ton sofort in der Auswahl haben
  res.status(201).json(sound);
});

// DELETE /api/sounds/:id
router.delete("/:id", (req, res) => {
  const list = readIndex();
  const sound = list.find((s) => s.id === req.params.id);
  if (!sound) return res.status(404).json({ error: "Sound not found" });
  try { fs.unlinkSync(path.join(SOUNDS_DIR, sound.file)); } catch { /* egal, Eintrag fliegt trotzdem raus */ }
  writeIndex(list.filter((s) => s.id !== sound.id));
  broadcastConfig();
  res.status(204).send();
});

export default router;
