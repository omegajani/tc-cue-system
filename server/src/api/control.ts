import { Router } from "express";
import { getControlLog, handleTrigger } from "../control/controlHub.js";
import { oscControl } from "../control/oscControl.js";
import { midiControl } from "../control/midiControl.js";
import { getConfig } from "../engine/config.js";
import { isTcRunning, lastTcAgoMs } from "../engine/tcState.js";

const router = Router();

// GET /api/control/status — läuft die Fernsteuerung, und was kam zuletzt an?
router.get("/status", (_req, res) => {
  const { control } = getConfig();
  res.json({
    enabled: control.enabled,
    osc: { running: oscControl.isRunning(), port: oscControl.getPort(), error: oscControl.getError() },
    midi: {
      running: midiControl.isRunning(),
      portName: midiControl.getPortName(),
      configuredPort: control.midiPort ?? "",
      error: midiControl.getError(),
      ports: midiControl.listPorts(),
    },
    tcRunning: isTcRunning(),
    tcAgoMs: lastTcAgoMs(),
    log: getControlLog(),
  });
});

// POST /api/control/trigger { show } — derselbe Weg wie OSC, für alles, was nur
// eine Web-Anfrage schicken kann (und zum Testen aus der Oberfläche).
router.post("/trigger", (req, res) => {
  const name = typeof req.body?.show === "string" ? req.body.show : "";
  if (!name) return res.status(400).json({ error: "Feld \"show\" fehlt" });
  const result = handleTrigger({ source: "http", label: `HTTP "${name}"`, osc: name });
  res.json(result);
});

export default router;
