import { Router } from "express";
import { simulator } from "../tc/simulator.js";

const router = Router();

router.get("/status", (_req, res) => {
  res.json({ state: simulator.getState(), tc: simulator.getCurrentTc() });
});

router.post("/start", (req, res) => {
  const { tc } = req.body ?? {};
  simulator.start(tc);
  res.json({ ok: true, state: simulator.getState(), tc: simulator.getCurrentTc() });
});

router.post("/pause", (_req, res) => {
  simulator.pause();
  res.json({ ok: true, state: simulator.getState(), tc: simulator.getCurrentTc() });
});

router.post("/stop", (_req, res) => {
  simulator.stop();
  res.json({ ok: true, state: simulator.getState(), tc: simulator.getCurrentTc() });
});

router.post("/seek", (req, res) => {
  const { tc } = req.body ?? {};
  if (!tc) return res.status(400).json({ error: "tc required" });
  simulator.seekTo(tc);
  res.json({ ok: true, tc: simulator.getCurrentTc() });
});

export default router;
