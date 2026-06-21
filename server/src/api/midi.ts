import { Router } from "express";
import { rtpMidiInput } from "../tc/rtpMidiInput.js";
import { oscTcInput } from "../tc/oscTcInput.js";
import { usbMidiInput } from "../tc/usbMidiInput.js";
import { artnetTcInput } from "../tc/artnetTcInput.js";

const router = Router();

// GET /api/midi/status — overall TC source status
router.get("/status", (_req, res) => {
  res.json({
    rtpMidi: {
      running: rtpMidiInput.isRunning(),
      port: rtpMidiInput.getPort(),
      name: rtpMidiInput.getName(),
      peers: rtpMidiInput.getConnectedPeers(),
    },
    osc: {
      running: oscTcInput.isRunning(),
      port: oscTcInput.getPort(),
    },
    usbMidi: {
      running: usbMidiInput.isRunning(),
      portName: usbMidiInput.getPortName(),
    },
    artnet: {
      running: artnetTcInput.isRunning(),
      port: artnetTcInput.getPort(),
    },
  });
});

// GET /api/midi/usb/ports — verfügbare USB-MIDI-Eingänge auflisten
router.get("/usb/ports", (_req, res) => {
  res.json({ ports: usbMidiInput.listPorts() });
});

// POST /api/midi/usb/start — USB-MIDI-Eingang öffnen (browserunabhängiger MTC)
router.post("/usb/start", (req, res) => {
  const { portName } = req.body as { portName?: string };
  if (usbMidiInput.isRunning()) return res.json({ ok: true, already: true, portName: usbMidiInput.getPortName() });
  const ok = usbMidiInput.start(portName);
  if (!ok) return res.status(400).json({ ok: false, error: "Port nicht gefunden oder MIDI nicht verfügbar" });
  res.json({ ok: true, portName: usbMidiInput.getPortName() });
});

// POST /api/midi/usb/stop
router.post("/usb/stop", (_req, res) => {
  usbMidiInput.stop();
  res.json({ ok: true });
});

// POST /api/midi/rtpmidi/start — start AppleMIDI listener
router.post("/rtpmidi/start", (req, res) => {
  const { port = 5004, name = "TC Cue System" } = req.body as { port?: number; name?: string };
  if (rtpMidiInput.isRunning()) {
    return res.json({ ok: true, already: true });
  }
  rtpMidiInput.start(port, name);
  res.json({ ok: true, port, name });
});

// POST /api/midi/rtpmidi/stop
router.post("/rtpmidi/stop", (_req, res) => {
  rtpMidiInput.stop();
  res.json({ ok: true });
});

// POST /api/midi/osc/start — start OSC UDP listener
router.post("/osc/start", (req, res) => {
  const { port = 9000 } = req.body as { port?: number };
  if (oscTcInput.isRunning()) {
    return res.json({ ok: true, already: true });
  }
  oscTcInput.start(port);
  res.json({ ok: true, port });
});

// POST /api/midi/osc/stop
router.post("/osc/stop", (_req, res) => {
  oscTcInput.stop();
  res.json({ ok: true });
});

// POST /api/midi/artnet/start — Art-Net Timecode UDP-Listener (Port 6454)
router.post("/artnet/start", (req, res) => {
  const { port = 6454 } = req.body as { port?: number };
  if (artnetTcInput.isRunning()) return res.json({ ok: true, already: true });
  artnetTcInput.start(port);
  res.json({ ok: true, port });
});

// POST /api/midi/artnet/stop
router.post("/artnet/stop", (_req, res) => {
  artnetTcInput.stop();
  res.json({ ok: true });
});

// POST /api/tc/midi-tick — browser Web MIDI relay (same pattern as browser-tick)
// Body: { tc: "HH:MM:SS:FF" }
// Handled in index.ts to keep cueEngine wiring central

export default router;
