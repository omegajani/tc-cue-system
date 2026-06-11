import { Router } from "express";
import { randomUUID } from "crypto";
import { Checklist, Cue, Show, ShowPosition } from "../types.js";
import { getShows, getShow, upsertShow, deleteShow } from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";

const router = Router();

router.get("/", (_req, res) => {
  res.json(getShows());
});

// Currently loaded show with cues pre-sorted by TC (must come before /:id)
router.get("/active", (_req, res) => {
  const show = cueEngine.getShow();
  if (!show) return res.status(404).json({ error: "No show loaded" });
  res.json({ ...show, cues: cueEngine.getSortedCues() });
});

router.get("/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  res.json(show);
});

router.post("/", (req, res) => {
  const show: Show = { ...req.body, id: randomUUID(), cues: req.body.cues ?? [], positions: req.body.positions ?? [], checklists: req.body.checklists ?? [] };
  upsertShow(show);
  cueEngine.loadShow(show);
  res.status(201).json(show);
});

router.put("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  const updated: Show = { ...existing, ...req.body, id: req.params.id };
  upsertShow(updated);
  // Use updateShowData to preserve fired-cue state.
  // Only do a full loadShow (which resets firedCueIds) if cues or positions
  // have structurally changed – detected by a change in serialised content.
  const cuesChanged =
    JSON.stringify(existing.cues) !== JSON.stringify(updated.cues) ||
    JSON.stringify(existing.positions) !== JSON.stringify(updated.positions);
  if (cuesChanged) {
    cueEngine.loadShow(updated);
  } else {
    cueEngine.updateShowData(updated);
  }
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
    resetShow: req.body.resetShow ?? false,
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
    resetShow: req.body.resetShow ?? show.cues[idx].resetShow ?? false,
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

router.post("/:id/checklists", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const checklist: Checklist = {
    id: randomUUID(),
    title: req.body.title,
    trigger: req.body.trigger,
    items: (req.body.items ?? []).map((item: { text: string; checked?: boolean }) => ({
      id: randomUUID(),
      text: item.text,
      checked: item.checked ?? false,
    })),
  };
  show.checklists = [...(show.checklists ?? []), checklist];
  upsertShow(show);
  res.status(201).json(checklist);
});

router.put("/:id/checklists/:checklistId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = (show.checklists ?? []).findIndex((checklist) => checklist.id === req.params.checklistId);
  if (idx === -1) return res.status(404).json({ error: "Checklist not found" });
  show.checklists![idx] = {
    ...show.checklists![idx],
    ...req.body,
    id: req.params.checklistId,
    items: (req.body.items ?? show.checklists![idx].items).map((item: { id?: string; text: string; checked?: boolean }) => ({
      id: item.id ?? randomUUID(),
      text: item.text,
      checked: item.checked ?? false,
    })),
  };
  upsertShow(show);
  res.json(show.checklists![idx]);
});

router.delete("/:id/checklists/:checklistId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  show.checklists = (show.checklists ?? []).filter((checklist) => checklist.id !== req.params.checklistId);
  upsertShow(show);
  res.status(204).send();
});

export default router;
