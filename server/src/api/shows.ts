import { Router } from "express";
import { randomUUID } from "crypto";
import { Cue, Show, ShowPosition } from "../types.js";
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
  const show: Show = { ...req.body, id: randomUUID(), cues: req.body.cues ?? [], positions: req.body.positions ?? [] };
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
  const cue: Cue = {
    id: randomUUID(),
    tc: req.body.tc,
    title: req.body.title,
    message: req.body.message ?? "",
    color: req.body.color ?? "#f59e0b",
  };
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
  show.cues[idx] = {
    id: req.params.cueId,
    tc: req.body.tc ?? show.cues[idx].tc,
    title: req.body.title ?? show.cues[idx].title,
    message: req.body.message ?? show.cues[idx].message,
    color: req.body.color ?? show.cues[idx].color,
  };
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

router.post("/:id/positions", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const position: ShowPosition = { ...req.body, id: randomUUID() };
  show.positions = [...(show.positions ?? []), position];
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(201).json(position);
});

router.put("/:id/positions/:positionId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = (show.positions ?? []).findIndex((position) => position.id === req.params.positionId);
  if (idx === -1) return res.status(404).json({ error: "Position not found" });
  show.positions[idx] = { ...show.positions[idx], ...req.body, id: req.params.positionId };
  upsertShow(show);
  cueEngine.loadShow(show);
  res.json(show.positions[idx]);
});

router.delete("/:id/positions/:positionId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  show.positions = (show.positions ?? []).filter((position) => position.id !== req.params.positionId);
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(204).send();
});

export default router;
