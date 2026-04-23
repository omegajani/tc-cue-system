import { Router } from "express";
import { randomUUID } from "crypto";
import { Show } from "../types.js";
import { getShows, getShow, upsertShow, deleteShow, getCuelistsForShow } from "../engine/store.js";

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
  const show: Show = { ...req.body, id: randomUUID() };
  upsertShow(show);
  res.status(201).json(show);
});

router.put("/:id", (req, res) => {
  const existing = getShow(req.params.id);
  if (!existing) return res.status(404).json({ error: "Show not found" });
  const updated: Show = { ...existing, ...req.body, id: req.params.id };
  upsertShow(updated);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  deleteShow(req.params.id);
  res.status(204).send();
});

router.get("/:id/cuelists", (req, res) => {
  res.json(getCuelistsForShow(req.params.id));
});

export default router;
