import { EventEmitter } from "events";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Supported OSC address patterns for timecode
const TC_ADDRESSES = new Set(["/tc", "/timecode", "/clock/tc", "/mtc", "/smpte"]);

/**
 * Receives OSC timecode messages over UDP.
 *
 * Supported message formats:
 *   /tc "HH:MM:SS:FF"          — string (most DAWs, QLab)
 *   /timecode "HH:MM:SS:FF"
 *   /clock/tc "HH:MM:SS:FF"
 *
 * Also accepts QLab-style: /tc HH MM SS FF (4 int args)
 */
export class OscTcInput extends EventEmitter {
  private port: any = null;
  private _isRunning = false;
  private _udpPort = 9000;
  private _lastTc = "";

  start(udpPort = 9000) {
    if (this._isRunning) return;
    this._udpPort = udpPort;

    let osc: any;
    try {
      osc = require("osc");
    } catch {
      console.error("[OSC] Package not available");
      return;
    }

    this.port = new osc.UDPPort({
      localAddress: "0.0.0.0",
      localPort: udpPort,
      metadata: true,
    });

    this.port.on("message", (msg: any) => this._handleOsc(msg));
    this.port.on("error", (err: any) => console.error("[OSC] Error:", err.message));
    this.port.open();

    this._isRunning = true;
    console.log(`[OSC] Listening on UDP port ${udpPort}`);
  }

  stop() {
    if (!this._isRunning || !this.port) return;
    try { this.port.close(); } catch { /* ignore */ }
    this.port = null;
    this._isRunning = false;
    console.log("[OSC] Stopped");
  }

  private _handleOsc(msg: any) {
    const address: string = msg.address ?? "";
    if (!TC_ADDRESSES.has(address)) return;

    const args: any[] = msg.args ?? [];
    if (args.length === 0) return;

    let tc: string | null = null;

    // Single string arg: "HH:MM:SS:FF"
    const first = args[0]?.value ?? args[0];
    if (typeof first === "string" && /^\d{2}:\d{2}:\d{2}:\d{2}$/.test(first)) {
      tc = first;
    }
    // Four int/float args: HH MM SS FF
    else if (args.length >= 4) {
      const vals = args.slice(0, 4).map((a: any) => Math.floor(a?.value ?? a));
      if (vals.every(v => typeof v === "number" && !isNaN(v))) {
        tc = vals.map(v => String(v).padStart(2, "0")).join(":");
      }
    }

    if (tc && tc !== this._lastTc) {
      this._lastTc = tc;
      this.emit("tc", tc);
    }
  }

  isRunning() { return this._isRunning; }
  getPort() { return this._udpPort; }
}

export const oscTcInput = new OscTcInput();
