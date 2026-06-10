import { Router } from "express";
import { randomUUID } from "crypto";
import { Show } from "../types.js";
import { getShow, upsertShow, getShows } from "../engine/store.js";

const router = Router();

// ── Export: single show ────────────────────────────────────────────────────
router.get("/show/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  res.setHeader("Content-Disposition", `attachment; filename="${show.name.replace(/[^a-z0-9]/gi, "_")}.json"`);
  res.json({ version: 2, exportedAt: new Date().toISOString(), show });
});

// ── Export: everything ─────────────────────────────────────────────────────
router.get("/all", (_req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="tc-cue-export.json"');
  res.json({ version: 2, exportedAt: new Date().toISOString(), shows: getShows() });
});

// ── Import: show bundle { show } ───────────────────────────────────────────
router.post("/show", (req, res) => {
  const { show } = req.body as { show?: Show };
  if (!show || !show.name) return res.status(400).json({ error: "Invalid bundle: missing show" });

  // Remap IDs to avoid collisions
  const newShowId = randomUUID();
  const newShow: Show = {
    ...show,
    id: newShowId,
    cues: (show.cues ?? []).map((cue) => ({
      id: randomUUID(),
      tc: cue.tc,
      title: cue.title,
      message: cue.message,
      color: cue.color,
    })),
    positions: (show.positions ?? []).map((position) => ({ ...position, id: randomUUID() })),
    checklists: (show.checklists ?? []).map((checklist) => ({
      ...checklist,
      id: randomUUID(),
      items: checklist.items.map((item) => ({ ...item, id: randomUUID() })),
    })),
  };

  upsertShow(newShow);
  res.status(201).json({ show: newShow });
});

export default router;
