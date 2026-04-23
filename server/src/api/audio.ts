import { Router } from "express";
import fs from "fs";
import path from "path";

const AUDIO_DIR = path.join(process.cwd(), "audio");

export function ensureAudioDir() {
  fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

const ALLOWED_EXT = new Set([".mp3", ".wav", ".ogg", ".m4a", ".aac"]);

const router = Router();

// List uploaded audio files
router.get("/", (_req, res) => {
  ensureAudioDir();
  const files = fs.readdirSync(AUDIO_DIR)
    .filter(f => ALLOWED_EXT.has(path.extname(f).toLowerCase()))
    .map(f => ({
      name: f,
      size: fs.statSync(path.join(AUDIO_DIR, f)).size,
      url: `/audio/${f}`,
    }));
  res.json(files);
});

// Upload a file as base64 JSON: { filename, data }
router.post("/", (req, res) => {
  ensureAudioDir();
  const { filename, data } = req.body as { filename?: string; data?: string };
  if (!filename || !data) return res.status(400).json({ error: "filename and data required" });

  const ext = path.extname(filename).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) return res.status(400).json({ error: "Only mp3/wav/ogg/m4a/aac allowed" });

  // Sanitise filename
  const safe = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const dest = path.join(AUDIO_DIR, safe);

  const buf = Buffer.from(data, "base64");
  fs.writeFileSync(dest, buf);
  console.log(`[Audio] Saved ${safe} (${buf.length} bytes)`);
  res.status(201).json({ name: safe, url: `/audio/${safe}` });
});

// Delete
router.delete("/:name", (req, res) => {
  const safe = path.basename(req.params.name);
  const dest = path.join(AUDIO_DIR, safe);
  if (!fs.existsSync(dest)) return res.status(404).json({ error: "Not found" });
  fs.unlinkSync(dest);
  res.status(204).send();
});

export default router;
