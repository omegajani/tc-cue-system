import { Router } from "express";
import { randomUUID } from "crypto";
import { Show, Cuelist } from "../types.js";
import {
  getShow, upsertShow, getShows,
  getCuelist, getCuelists, getCuelistsForShow, upsertCuelist,
} from "../engine/store.js";

const router = Router();

// ── Export: single show + all its cuelists ─────────────────────────────────
router.get("/show/:id", (req, res) => {
  const show = getShow(req.params.id);
  if (!show) return res.status(404).json({ error: "Show not found" });
  const cuelists = getCuelistsForShow(show.id);
  res.setHeader("Content-Disposition", `attachment; filename="${show.name.replace(/[^a-z0-9]/gi, "_")}.json"`);
  res.json({ version: 1, exportedAt: new Date().toISOString(), show, cuelists });
});

// ── Export: everything ─────────────────────────────────────────────────────
router.get("/all", (_req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="tc-cue-export.json"');
  res.json({ version: 1, exportedAt: new Date().toISOString(), shows: getShows(), cuelists: getCuelists() });
});

// ── Import: show bundle { show, cuelists } ─────────────────────────────────
router.post("/show", (req, res) => {
  const { show, cuelists } = req.body as { show?: Show; cuelists?: Cuelist[] };
  if (!show || !show.name) return res.status(400).json({ error: "Invalid bundle: missing show" });

  // Remap IDs to avoid collisions
  const idMap: Record<string, string> = {};
  const newShowId = randomUUID();
  idMap[show.id] = newShowId;

  const newCuelists: Cuelist[] = (cuelists ?? []).map(l => {
    const newId = randomUUID();
    idMap[l.id] = newId;
    return { ...l, id: newId, showId: newShowId, isActive: false };
  });

  // Remap activeCuelistId
  const newShow: Show = {
    ...show,
    id: newShowId,
    activeCuelistId: show.activeCuelistId ? (idMap[show.activeCuelistId] ?? null) : null,
  };

  upsertShow(newShow);
  newCuelists.forEach(l => upsertCuelist(l));

  res.status(201).json({ show: newShow, cuelists: newCuelists });
});

export default router;
