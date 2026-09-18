import { Router } from "express";
import { randomUUID } from "crypto";
import { Checklist, ChecklistAutoClose, Cue, Show, ShowPosition } from "../types.js";
import { getShows, getShow, upsertShow, deleteShow, flushShows } from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";
import { stripLegacyShowFields, updateConfig } from "../engine/config.js";
import { activateShow, applyShowFps, broadcastConfig, isActiveShow } from "../engine/activeShow.js";
import { autoBackupBeforeChange, createBackup } from "../engine/backups.js";
import { broadcast } from "../wsbroker.js";

const router = Router();

// „Alles speichert sofort": jede Änderung wird direkt auf die Platte geschrieben.
// Vorher sichert autoBackupBeforeChange() den alten Stand (höchstens stündlich).

/** Nach einer Cue-/Song-Änderung: Engine nur nachladen, wenn es die aktive Show ist. */
function reloadIfActive(show: Show) {
  if (isActiveShow(show.id)) cueEngine.loadShow(show);
}

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

// Schreibt die Arbeitskopie auf die Platte. Seit „alles speichert sofort" nicht
// mehr nötig, bleibt für ältere Clients bestehen. Muss vor /:id-Routen stehen.
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

// Neue Show wird (wie bisher) sofort die aktive Show.
router.post("/", (req, res) => {
  const show: Show = stripLegacyShowFields({ ...req.body, id: randomUUID(), cues: req.body.cues ?? [], positions: req.body.positions ?? [], checklists: req.body.checklists ?? [] });
  upsertShow(show);
  flushShows();
  activateShow(show);
  res.status(201).json(show);
});

router.put("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  autoBackupBeforeChange(existing);
  const updated: Show = stripLegacyShowFields({ ...existing, ...req.body, id: req.params.id });
  upsertShow(updated);
  flushShows();
  if (isActiveShow(updated.id)) {
    // Voller loadShow (setzt gefeuerte Cues zurück) nur bei geänderten Cues/Songs
    const cuesChanged =
      JSON.stringify(existing.cues) !== JSON.stringify(updated.cues) ||
      JSON.stringify(existing.positions) !== JSON.stringify(updated.positions);
    if (cuesChanged) cueEngine.loadShow(updated);
    else cueEngine.updateShowData(updated);
    if ((existing.fps ?? 25) !== (updated.fps ?? 25)) {
      applyShowFps(updated);
      cueEngine.reset();
      broadcast({ type: "TC_UPDATE", tc: "00:00:00:00", previousCue: null, currentCue: null, nextCue: cueEngine.getNextCue(), currentPosition: null });
    }
  }
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  createBackup(existing, "auto", "Vor dem Löschen");
  const wasActive = isActiveShow(existing.id);
  deleteShow(existing.id);
  flushShows();
  if (wasActive) {
    const next = getShows()[0];
    if (next) activateShow(next);
    else { cueEngine.unload(); updateConfig({ activeShowId: "" }); broadcastConfig(); }
  }
  res.status(204).send();
});

router.post("/:id/activate", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  activateShow(show);
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
  autoBackupBeforeChange(show);
  show.cues.push(cue);
  upsertShow(show);
  flushShows();
  reloadIfActive(show);
  res.status(201).json(cue);
});

router.put("/:id/cues/:cueId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = show.cues.findIndex((cue) => cue.id === req.params.cueId);
  if (idx === -1) return res.status(404).json({ error: "Cue not found" });
  autoBackupBeforeChange(show);
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
  flushShows();
  reloadIfActive(show);
  res.json(show.cues[idx]);
});

router.delete("/:id/cues/:cueId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  autoBackupBeforeChange(show);
  show.cues = show.cues.filter((cue) => cue.id !== req.params.cueId);
  upsertShow(show);
  flushShows();
  reloadIfActive(show);
  res.status(204).send();
});

router.post("/:id/positions", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const position: ShowPosition = { ...req.body, id: randomUUID() };
  autoBackupBeforeChange(show);
  show.positions = [...(show.positions ?? []), position];
  upsertShow(show);
  flushShows();
  reloadIfActive(show);
  res.status(201).json(position);
});

router.put("/:id/positions/:positionId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = (show.positions ?? []).findIndex((position) => position.id === req.params.positionId);
  if (idx === -1) return res.status(404).json({ error: "Position not found" });
  autoBackupBeforeChange(show);
  show.positions[idx] = { ...show.positions[idx], ...req.body, id: req.params.positionId };
  upsertShow(show);
  flushShows();
  reloadIfActive(show);
  res.json(show.positions[idx]);
});

router.delete("/:id/positions/:positionId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  autoBackupBeforeChange(show);
  show.positions = (show.positions ?? []).filter((position) => position.id !== req.params.positionId);
  upsertShow(show);
  flushShows();
  reloadIfActive(show);
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
  autoBackupBeforeChange(show);
  show.checklists = [...(show.checklists ?? []), checklist];
  upsertShow(show);
  flushShows();
  if (isActiveShow(show.id)) cueEngine.updateShowData(show);
  res.status(201).json(checklist);
});

router.put("/:id/checklists/:checklistId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const idx = (show.checklists ?? []).findIndex((checklist) => checklist.id === req.params.checklistId);
  if (idx === -1) return res.status(404).json({ error: "Checklist not found" });
  const prev = show.checklists![idx];
  autoBackupBeforeChange(show);
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
  flushShows();
  if (isActiveShow(show.id)) cueEngine.updateShowData(show);
  res.json(show.checklists![idx]);
});

router.delete("/:id/checklists/:checklistId", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  autoBackupBeforeChange(show);
  show.checklists = (show.checklists ?? []).filter((checklist) => checklist.id !== req.params.checklistId);
  upsertShow(show);
  flushShows();
  if (isActiveShow(show.id)) cueEngine.updateShowData(show);
  res.status(204).send();
});

export default router;
