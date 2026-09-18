import { Router } from "express";
import { getShow, upsertShow, flushShows } from "../engine/store.js";
import { createBackup, listBackups, loadBackup } from "../engine/backups.js";
import { stripLegacyShowFields } from "../engine/config.js";
import { cueEngine } from "../engine/cueEngine.js";
import { applyShowFps, isActiveShow } from "../engine/activeShow.js";

const router = Router();

// GET /api/backups?showId=… — Sicherungen (neueste zuerst); ohne showId alle,
// auch die von gelöschten Shows.
router.get("/", (req, res) => {
  const showId = typeof req.query.showId === "string" ? req.query.showId : undefined;
  res.json(listBackups(showId));
});

// POST /api/backups/:showId { label? } — Sicherung von Hand anlegen
router.post("/:showId", (req, res) => {
  const show = getShow(req.params.showId);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const label = typeof req.body?.label === "string" ? req.body.label : undefined;
  res.status(201).json(createBackup(show, "manual", label));
});

// POST /api/backups/:showId/:backupId/restore — Stand zurückholen. Der aktuelle
// Stand wird vorher selbst gesichert (Wiederherstellen lässt sich rückgängig machen).
// Funktioniert auch für gelöschte Shows: sie werden wieder angelegt.
router.post("/:showId/:backupId/restore", (req, res) => {
  const backup = loadBackup(req.params.showId, req.params.backupId);
  if (!backup) return res.status(404).json({ error: "Backup not found" });
  const current = getShow(req.params.showId);
  if (current) createBackup(current, "auto", "Vor dem Wiederherstellen");
  const restored = stripLegacyShowFields({ ...backup, id: req.params.showId });
  upsertShow(restored);
  flushShows();
  if (isActiveShow(restored.id)) {
    cueEngine.loadShow(restored);
    applyShowFps(restored);
  }
  res.json(restored);
});

export default router;
