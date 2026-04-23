import { Router } from "express";
import { randomUUID } from "crypto";
import { Cuelist, Cue } from "../types.js";
import {
  getCuelists,
  getCuelist,
  upsertCuelist,
  deleteCuelist,
  getShow,
  upsertShow,
} from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getCuelists());
});

router.get("/:id", (req, res) => {
  const list = getCuelist(req.params.id);
  if (!list) return res.status(404).json({ error: "Cuelist not found" });
  res.json(list);
});

router.post("/", (req, res) => {
  const list: Cuelist = {
    ...req.body,
    id: randomUUID(),
    cues: req.body.cues ?? [],
    updatedAt: new Date().toISOString(),
    isActive: false,
  };
  upsertCuelist(list);
  res.status(201).json(list);
});

router.put("/:id", (req, res) => {
  const existing = getCuelist(req.params.id);
  if (!existing) return res.status(404).json({ error: "Cuelist not found" });
  const updated: Cuelist = {
    ...existing,
    ...req.body,
    id: req.params.id,
    updatedAt: new Date().toISOString(),
  };
  upsertCuelist(updated);
  // If this is the active cuelist, reload engine
  if (updated.isActive) cueEngine.loadCuelist(updated);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  deleteCuelist(req.params.id);
  res.status(204).send();
});

// Add / update / delete individual cues
router.post("/:id/cues", (req, res) => {
  const list = getCuelist(req.params.id);
  if (!list) return res.status(404).json({ error: "Cuelist not found" });
  const cue: Cue = { ...req.body, id: randomUUID() };
  list.cues.push(cue);
  list.updatedAt = new Date().toISOString();
  upsertCuelist(list);
  if (list.isActive) cueEngine.loadCuelist(list);
  res.status(201).json(cue);
});

router.put("/:id/cues/:cueId", (req, res) => {
  const list = getCuelist(req.params.id);
  if (!list) return res.status(404).json({ error: "Cuelist not found" });
  const idx = list.cues.findIndex((c) => c.id === req.params.cueId);
  if (idx === -1) return res.status(404).json({ error: "Cue not found" });
  list.cues[idx] = { ...list.cues[idx], ...req.body, id: req.params.cueId };
  list.updatedAt = new Date().toISOString();
  upsertCuelist(list);
  if (list.isActive) cueEngine.loadCuelist(list);
  res.json(list.cues[idx]);
});

router.delete("/:id/cues/:cueId", (req, res) => {
  const list = getCuelist(req.params.id);
  if (!list) return res.status(404).json({ error: "Cuelist not found" });
  list.cues = list.cues.filter((c) => c.id !== req.params.cueId);
  list.updatedAt = new Date().toISOString();
  upsertCuelist(list);
  if (list.isActive) cueEngine.loadCuelist(list);
  res.status(204).send();
});

// Activate a cuelist for a show
router.post("/:id/activate", (req, res) => {
  const list = getCuelist(req.params.id);
  if (!list) return res.status(404).json({ error: "Cuelist not found" });
  const show = getShow(list.showId);
  if (!show) return res.status(404).json({ error: "Show not found" });

  // Deactivate all others for this show
  const all = getCuelists();
  for (const l of all) {
    if (l.showId === list.showId) {
      l.isActive = l.id === list.id;
      upsertCuelist(l);
    }
  }

  show.activeCuelistId = list.id;
  upsertShow(show);
  cueEngine.loadCuelist({ ...list, isActive: true });
  res.json({ ok: true });
});

export default router;
