import http from "http";
import express from "express";
import path from "path";
import os from "os";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { Bonjour } = _require("bonjour-service");
import { initWS, broadcast, closeWS } from "./wsbroker.js";
import { simulator } from "./tc/simulator.js";
import { cueEngine } from "./engine/cueEngine.js";
import { setFPS, getFPS, parseTc } from "./tc/tcUtils.js";
import showsRouter from "./api/shows.js";
import simulatorRouter from "./api/simulator.js";
import importExportRouter from "./api/importExport.js";
import midiRouter from "./api/midi.js";
import updateRouter from "./api/update.js";
import { rtpMidiInput } from "./tc/rtpMidiInput.js";
import { oscTcInput } from "./tc/oscTcInput.js";
import { usbMidiInput } from "./tc/usbMidiInput.js";
import { artnetTcInput } from "./tc/artnetTcInput.js";

// Sicherheitsnetz: ein unerwarteter Fehler (z. B. in einer nativen MIDI-Lib oder
// einem Event-Handler) soll den Live-Server nicht beenden – loggen statt crashen.
process.on("uncaughtException", (err) => console.error("[Fatal] uncaughtException:", err));
process.on("unhandledRejection", (reason) => console.error("[Fatal] unhandledRejection:", reason));

const app = express();
const PORT = 3000;

app.use(express.json());

// Serve web-ui from root
const WEB_UI = path.join(process.cwd(), "..", "web-ui");
app.use(express.static(WEB_UI));

// API routes
app.use("/api/shows", showsRouter);
app.use("/api/simulator", simulatorRouter);
app.use("/api/io", importExportRouter);
app.use("/api/midi", midiRouter);
app.use("/api/update", updateRouter);

// Shared TC ingestion helper — deduplicates and feeds cueEngine + broadcasts.
// Zentrale, robuste Eintrittsstelle für ALLE Quellen: ungültige TC-Strings (z. B.
// aus einem Decoder mit Raten-Mismatch) werden hier abgefangen, statt dass eine
// parseTc-Exception bis in den EventEmitter durchschlägt und den Server crasht.
let lastBrowserTc = "";
let lastBrowserFrames = -1;
let _lastBadTcLog = 0;
function ingestTc(tc: string, _source: string) {
  if (!tc || tc === lastBrowserTc) return;
  let nowFrames: number;
  try {
    nowFrames = parseTc(tc).totalFrames;
  } catch {
    // gedrosselt loggen, damit ein Dauerstrom ungültiger Frames die Konsole nicht flutet
    const now = Date.now();
    if (now - _lastBadTcLog > 2000) { console.warn(`[Engine] Ungültiger TC ignoriert: "${tc}"`); _lastBadTcLog = now; }
    return;
  }
  // Detect significant TC rewind (>30 s backwards) → reset fired cues
  if (lastBrowserFrames > 0 && lastBrowserFrames - nowFrames > getFPS() * 30) {
    console.log(`[Engine] TC rewind detected (${lastBrowserTc} → ${tc}), resetting cue engine`);
    cueEngine.reset();
  }
  lastBrowserTc = tc;
  lastBrowserFrames = nowFrames;
  cueEngine.processTc(tc);
  broadcast({ type: "TC_UPDATE", tc, previousCue: cueEngine.getPreviousCue(), currentCue: cueEngine.getCurrentCue(), nextCue: cueEngine.getNextCue(), currentPosition: cueEngine.getCurrentPosition() });
}

// Browser LTC relay: browser decodes LTC, POSTs TC here → cue engine → broadcast
app.post("/api/tc/browser-tick", (req, res) => {
  const { tc } = req.body as { tc?: string };
  if (tc) ingestTc(tc, "ltc-browser");
  res.json({ ok: true });
});

// Browser Web MIDI relay: browser receives MTC via Web MIDI API, POSTs here
app.post("/api/tc/midi-tick", (req, res) => {
  const { tc } = req.body as { tc?: string };
  if (tc) ingestTc(tc, "mtc-browser");
  res.json({ ok: true });
});

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, tc: simulator.getCurrentTc(), state: simulator.getState(), fps: getFPS() });
});

// Network info for mobile clients
app.get("/api/network", (_req, res) => {
  const ips: string[] = [];
  for (const iface of Object.values(os.networkInterfaces())) {
    for (const addr of iface ?? []) {
      if (addr.family === "IPv4" && !addr.internal) ips.push(addr.address);
    }
  }
  res.json({ ips, port: PORT, urls: ips.map(ip => `http://${ip}:${PORT}`) });
});

// FPS switch
app.post("/api/engine/fps", (req, res) => {
  const { fps } = req.body as { fps?: number };
  if (!fps || ![24, 25, 29.97, 30].includes(fps)) return res.status(400).json({ error: "fps must be 24|25|29.97|30" });
  setFPS(fps);
  cueEngine.reset();
  // Reset sofort an die Clients spiegeln (sonst erst beim nächsten TC sichtbar)
  broadcast({ type: "TC_UPDATE", tc: "00:00:00:00", previousCue: null, currentCue: null, nextCue: cueEngine.getNextCue(), currentPosition: null });
  res.json({ ok: true, fps });
});

// Manual engine reset (fired cues zurücksetzen)
app.post("/api/engine/reset", (_req, res) => {
  cueEngine.reset();
  res.json({ ok: true });
});

// HTTP + WS server
const server = http.createServer(app);
initWS(server);

// Wire TC events → CueEngine → WebSocket broadcast
let lastSimulatorFrames = -1;
simulator.on("stop", () => {
  cueEngine.reset();
  lastSimulatorFrames = -1;
  lastBrowserTc = "";
  lastBrowserFrames = -1;
  broadcast({ type: "TC_UPDATE", tc: "00:00:00:00", previousCue: null, currentCue: null, nextCue: cueEngine.getNextCue(), currentPosition: null });
});

simulator.on("tc", (tc: string) => {
  const nowFrames = parseTc(tc).totalFrames;
  if (lastSimulatorFrames >= 0 && nowFrames < lastSimulatorFrames) cueEngine.reset();
  lastSimulatorFrames = nowFrames;
  cueEngine.processTc(tc);
  broadcast({ type: "TC_UPDATE", tc, previousCue: cueEngine.getPreviousCue(), currentCue: cueEngine.getCurrentCue(), nextCue: cueEngine.getNextCue(), currentPosition: cueEngine.getCurrentPosition() });
});

// Alle netzw/decoder-basierten Quellen über ingestTc (Dedup + Rewind-Reset + TC-Guard)
rtpMidiInput.on("tc", (tc: string) => ingestTc(tc, "rtpmidi"));
oscTcInput.on("tc", (tc: string) => ingestTc(tc, "osc"));
usbMidiInput.on("tc", (tc: string) => ingestTc(tc, "mtc-usb"));
artnetTcInput.on("tc", (tc: string) => ingestTc(tc, "artnet"));

cueEngine.on("cueFire", (event) => {
  console.log(`[Engine] CUE FIRE: ${event.cue.title} @ ${event.tc}`);
  broadcast(event);
  if (event.cue.resetShow) {
    const show = cueEngine.getShow();
    if (show) {
      const reset = {
        ...show,
        checklists: (show.checklists ?? []).map(cl => ({
          ...cl,
          items: cl.items.map(item => ({ ...item, checked: false })),
        })),
      };
      upsertShow(reset);
      cueEngine.updateShowData(reset);
      console.log(`[Engine] SHOW RESET triggered by cue "${event.cue.title}"`);
    }
    broadcast({ type: "SHOW_RESET" });
  }
});

import { getShows, upsertShow } from "./engine/store.js";

function loadInitialShow() {
  const show = getShows()[0];
  if (show) {
    cueEngine.loadShow(show);
    console.log(`[Startup] Auto-loaded show "${show.name}"`);
    // Browserunabhängiger MTC: konfiguriertes USB-MIDI-Port automatisch öffnen.
    // Ist das Gerät beim Boot noch nicht da, alle 5 s erneut versuchen.
    if (show.tcSource === "usb-mtc" && show.midiPort) {
      const tryStart = () => {
        if (usbMidiInput.isRunning()) return;
        if (usbMidiInput.start(show.midiPort)) {
          console.log(`[Startup] USB-MIDI auto-started on "${show.midiPort}"`);
        } else {
          setTimeout(tryStart, 5000);
        }
      };
      tryStart();
    }
    // Server-seitige Netzwerk-Quellen ebenfalls headless beim Boot starten
    // (Default-Ports; keine Browser-/Geräteinteraktion nötig).
    if (show.tcSource === "rtpmidi") rtpMidiInput.start();
    else if (show.tcSource === "osc") oscTcInput.start();
    else if (show.tcSource === "artnet") artnetTcInput.start();
  }
}

server.listen(PORT, () => {
  console.log(`\n🎭 TC Cue Server running on http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Web UI:    http://localhost:${PORT}\n`);
  loadInitialShow();

  // Advertise via Bonjour so iOS can discover without typing IP
  // Include IPv4 in TXT record so iOS can read it without NWConnection resolution
  const localIP = (() => {
    for (const iface of Object.values(os.networkInterfaces())) {
      for (const addr of iface ?? []) {
        if (addr.family === "IPv4" && !addr.internal) return addr.address;
      }
    }
    return "localhost";
  })();
  bonjour = new Bonjour();
  // IP im Instanznamen: Bei Netzwerkwechsel entsteht ein neuer Name, sodass
  // Clients nicht den (bis zu 75 min) gecachten TXT-Record der alten IP sehen
  bonjour.publish({ name: `TC Cue System (${localIP})`, type: "tccue", protocol: "tcp", port: PORT, txt: { ip: localIP, port: String(PORT) } });
  console.log(`[Bonjour] Advertising _tccue._tcp on port ${PORT} (ip=${localIP})`);
});

// Graceful Shutdown: bei systemd-Restart/Strg-C alle Listener/Sockets sauber
// schließen, damit Ports/Bonjour nicht hängen bleiben.
let bonjour: any = null;
let _shuttingDown = false;
function shutdown(signal: string) {
  if (_shuttingDown) return;
  _shuttingDown = true;
  console.log(`\n[Shutdown] ${signal} – schließe Listener…`);
  try { simulator.stop(); } catch { /* ignore */ }
  try { rtpMidiInput.stop(); } catch { /* ignore */ }
  try { oscTcInput.stop(); } catch { /* ignore */ }
  try { usbMidiInput.stop(); } catch { /* ignore */ }
  try { artnetTcInput.stop(); } catch { /* ignore */ }
  closeWS();
  if (bonjour) { try { bonjour.unpublishAll(() => bonjour.destroy()); } catch { /* ignore */ } }
  server.close(() => process.exit(0));
  // Notausstieg, falls server.close hängt
  setTimeout(() => process.exit(0), 3000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
