import http from "http";
import express from "express";
import path from "path";
import os from "os";
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
const { Bonjour } = _require("bonjour-service");
import { initWS, broadcast } from "./wsbroker.js";
import { simulator } from "./tc/simulator.js";
import { cueEngine } from "./engine/cueEngine.js";
import { setFPS, getFPS, parseTc } from "./tc/tcUtils.js";
import showsRouter from "./api/shows.js";
import simulatorRouter from "./api/simulator.js";
import importExportRouter from "./api/importExport.js";
import midiRouter from "./api/midi.js";
import { rtpMidiInput } from "./tc/rtpMidiInput.js";
import { oscTcInput } from "./tc/oscTcInput.js";

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

// Shared TC ingestion helper — deduplicates and feeds cueEngine + broadcasts
let lastBrowserTc = "";
let lastBrowserFrames = -1;
function ingestTc(tc: string, source: string) {
  if (!tc || tc === lastBrowserTc) return;
  const nowFrames = parseTc(tc).totalFrames;
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

// Wire rtpMIDI → cueEngine
rtpMidiInput.on("tc", (tc: string) => {
  cueEngine.processTc(tc);
  broadcast({ type: "TC_UPDATE", tc, previousCue: cueEngine.getPreviousCue(), currentCue: cueEngine.getCurrentCue(), nextCue: cueEngine.getNextCue(), currentPosition: cueEngine.getCurrentPosition() });
});

// Wire OSC → cueEngine
oscTcInput.on("tc", (tc: string) => {
  cueEngine.processTc(tc);
  broadcast({ type: "TC_UPDATE", tc, previousCue: cueEngine.getPreviousCue(), currentCue: cueEngine.getCurrentCue(), nextCue: cueEngine.getNextCue(), currentPosition: cueEngine.getCurrentPosition() });
});

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
  const bonjour = new Bonjour();
  // IP im Instanznamen: Bei Netzwerkwechsel entsteht ein neuer Name, sodass
  // Clients nicht den (bis zu 75 min) gecachten TXT-Record der alten IP sehen
  bonjour.publish({ name: `TC Cue System (${localIP})`, type: "tccue", protocol: "tcp", port: PORT, txt: { ip: localIP, port: String(PORT) } });
  console.log(`[Bonjour] Advertising _tccue._tcp on port ${PORT} (ip=${localIP})`);
});
