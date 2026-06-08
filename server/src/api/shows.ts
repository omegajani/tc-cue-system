import { Router } from "express";
import { randomUUID } from "crypto";
import { Cue, Show } from "../types.js";
import { getShows, getShow, upsertShow, deleteShow } from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getShows());
});

router.get("/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  res.json(show);
});

router.post("/", (req, res) => {
  const show: Show = { ...req.body, id: randomUUID(), cues: req.body.cues ?? [] };
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(201).json(show);
});

router.put("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  const updated: Show = { ...existing, ...req.body, id: req.params.id };
  upsertShow(updated);
  cueEngine.loadShow(updated);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  deleteShow(req.params.id);
  res.status(204).send();
});

router.post("/:id/activate", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  cueEngine.loadShow(show);
  res.json({ ok: true });
});

router.post("/:id/cues", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const cue: Cue = { ...req.body, id: randomUUID() };
  show.cues.push(cue);
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(201).json(cue);
});

router.put("/:id/cues/:cueId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = show.cues.findIndex((cue) => cue.id === req.params.cueId);
  if (idx === -1) return res.status(404).json({ error: "Cue not found" });
  show.cues[idx] = { ...show.cues[idx], ...req.body, id: req.params.cueId };
  upsertShow(show);
  cueEngine.loadShow(show);
  res.json(show.cues[idx]);
});

router.delete("/:id/cues/:cueId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  show.cues = show.cues.filter((cue) => cue.id !== req.params.cueId);
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(204).send();
});

export default router;
