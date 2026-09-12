import { Router } from "express";
import { randomUUID } from "crypto";
import { Checklist, ChecklistAutoClose, Cue, Show, ShowPosition } from "../types.js";
import { getShows, getShow, upsertShow, deleteShow, flushShows } from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";

const router = Router();

function normalizeAutoClose(raw: unknown): ChecklistAutoClose | undefined {
  const ac = raw as Partial<ChecklistAutoClose> | null | undefined;
  if (!ac || !ac.type || ac.type === "none") return undefined;
  if (ac.type === "tc" && typeof (ac as { tc?: unknown }).tc === "string" && (ac as { tc: string }).tc) {
    return { type: "tc", tc: (ac as { tc: string }).tc };
  }
  if (ac.type === "position" && typeof (ac as { positionId?: unknown }).positionId === "string" && (ac as { positionId: string }).positionId) {
    const anchorRaw = (ac as { anchor?: unknown }).anchor;
    const anchor = anchorRaw === "mid" || anchorRaw === "end" ? anchorRaw : "start";
    return { type: "position", positionId: (ac as { positionId: string }).positionId, anchor };
  }
  if (ac.type === "countdown") {
    const seconds = Number((ac as { seconds?: unknown }).seconds);
    if (Number.isFinite(seconds) && seconds > 0) return { type: "countdown", seconds };
  }
  return undefined;
}

router.get("/", (_req, res) => {
  res.json(getShows());
});

// Schreibt die In-Memory-Arbeitskopie auf die Platte (Live-Abhaken).
// Muss vor /:id-Routen stehen.
router.post("/persist", (_req, res) => {
  flushShows();
  res.json({ ok: true });
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
  flushShows();
  cueEngine.loadShow(show);
  res.status(201).json(show);
});

router.put("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  const updated: Show = { ...existing, ...req.body, id: req.params.id };
  upsertShow(updated);
  flushShows(); // PUT = expliziter „Speichern"-Pfad → auf Platte schreiben
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
  flushShows();
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
    gewerk: req.body.gewerk || undefined,
    positions: Array.isArray(req.body.positions) && req.body.positions.length ? req.body.positions : undefined,
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
    // gewerk/positions: leeres Feld bedeutet bewusst "entfernen" → direkt übernehmen
    gewerk: req.body.gewerk !== undefined ? (req.body.gewerk || undefined) : show.cues[idx].gewerk,
    positions: req.body.positions !== undefined
      ? (Array.isArray(req.body.positions) && req.body.positions.length ? req.body.positions : undefined)
      : show.cues[idx].positions,
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
    autoClose: normalizeAutoClose(req.body.autoClose),
    gewerk: req.body.gewerk || undefined,
    positions: Array.isArray(req.body.positions) && req.body.positions.length ? req.body.positions : undefined,
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
  const prev = show.checklists![idx];
  show.checklists![idx] = {
    ...prev,
    ...req.body,
    id: req.params.checklistId,
    autoClose: req.body.autoClose !== undefined ? normalizeAutoClose(req.body.autoClose) : prev.autoClose,
    gewerk: req.body.gewerk !== undefined ? (req.body.gewerk || undefined) : prev.gewerk,
    positions: req.body.positions !== undefined
      ? (Array.isArray(req.body.positions) && req.body.positions.length ? req.body.positions : undefined)
      : prev.positions,
    items: (req.body.items ?? prev.items).map((item: { id?: string; text: string; checked?: boolean }) => ({
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
