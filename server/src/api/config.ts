import { Router } from "express";
import { checkLogin, getConfig, getPublicConfig, setAccess, updateConfig } from "../engine/config.js";
import { broadcastConfig } from "../engine/activeShow.js";
import { applyTcConfig } from "../tc/tcSources.js";

// Programm-Einstellungen (gelten für die ganze Anlage, nicht für eine Show).
// Hinweis: Die API hat (noch) keine Authentifizierung – der Rollen-Login ist eine
// weiche, clientseitige Filterung. Passwörter gehen aber nur noch über
// /api/config/access an den Admin-Dialog, nicht mehr mit jeder Show-Liste raus.
const router = Router();

// GET /api/config — alles außer Passwörtern
router.get("/", (_req, res) => {
  res.json(getPublicConfig());
});

// PUT /api/config — Teiländerung { tc?, gewerkPositions? }. Die aktive Show wird
// über POST /api/shows/:id/activate gewechselt, nicht hier.
router.put("/", (req, res) => {
  const { tc, gewerkPositions } = (req.body ?? {}) as { tc?: object; gewerkPositions?: Record<string, string[]> };
  const { tcChanged } = updateConfig({ tc, gewerkPositions });
  if (tcChanged) applyTcConfig(getConfig().tc);
  broadcastConfig();
  res.json(getPublicConfig());
});

// GET /api/config/access — Passwörter für den Admin-Dialog
router.get("/access", (_req, res) => {
  res.json(getConfig().access);
});

// PUT /api/config/access — Passwörter setzen (ersetzt komplett)
router.put("/access", (req, res) => {
  setAccess(req.body);
  broadcastConfig();
  res.json(getConfig().access);
});

// POST /api/config/login { password } → { level, gewerk? } oder 401
router.post("/login", (req, res) => {
  const password = typeof req.body?.password === "string" ? req.body.password : "";
  const result = checkLogin(password);
  if (!result) return res.status(401).json({ error: "Passwort nicht erkannt" });
  res.json(result);
});

export default router;
