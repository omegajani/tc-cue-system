import { createRequire } from "module";
import { handleTrigger } from "./controlHub.js";

const require = createRequire(import.meta.url);

// OSC-Steuerbefehle auf einem eigenen Port (Standard 9001). Eigener Port, weil die
// verwendete OSC-Bibliothek ihren Socket ohne SO_REUSEADDR öffnet – der TC-Port
// (9000) lässt sich daher nicht ein zweites Mal belegen.
//
// Unterstützt:
//   /qlyst/show/load "SPOOKY"     Show am Namen laden
//   /qlyst/show/SPOOKY            Name direkt in der Adresse
//   /qlyst/show/index 2           Show nach Position in der Liste (1-basiert)

export class OscControl {
  private port: any = null;
  private _isRunning = false;
  private _udpPort = 9001;
  private _error = "";

  start(udpPort = 9001) {
    if (this._isRunning) return;
    this._udpPort = udpPort;
    this._error = "";

    let osc: any;
    try {
      osc = require("osc");
    } catch {
      this._error = "OSC-Paket nicht verfügbar";
      console.error("[Control/OSC] Package not available");
      return;
    }

    this.port = new osc.UDPPort({ localAddress: "0.0.0.0", localPort: udpPort, metadata: true });
    this.port.on("message", (msg: any) => this._handle(msg));
    this.port.on("error", (err: any) => {
      this._error = err.message;
      console.error("[Control/OSC] Error:", err.message);
    });
    this.port.open();

    this._isRunning = true;
    console.log(`[Control/OSC] Steuerbefehle auf UDP ${udpPort}`);
  }

  stop() {
    if (!this._isRunning || !this.port) return;
    try { this.port.close(); } catch { /* ignore */ }
    this.port = null;
    this._isRunning = false;
    console.log("[Control/OSC] Gestoppt");
  }

  private _handle(msg: any) {
    const address: string = msg.address ?? "";
    if (!address.startsWith("/qlyst/show")) return;
    const args: any[] = msg.args ?? [];
    const firstArg = args.length ? (args[0]?.value ?? args[0]) : undefined;

    // /qlyst/show/index 2 → zweite Show der Liste
    if (address === "/qlyst/show/index") {
      const n = Number(firstArg);
      if (!Number.isFinite(n)) return;
      handleTrigger({ source: "osc", label: `OSC ${address} ${n}`, showIndex: n });
      return;
    }

    // Name aus Argument (bevorzugt) oder aus der Adresse
    let name = typeof firstArg === "string" ? firstArg : "";
    if (!name && address !== "/qlyst/show/load") name = decodeURIComponent(address.slice("/qlyst/show/".length));
    if (!name) return;

    handleTrigger({
      source: "osc",
      label: `OSC ${address} "${name}"`,
      osc: name,
    });
  }

  isRunning() { return this._isRunning; }
  getPort() { return this._udpPort; }
  getError() { return this._error; }
}

export const oscControl = new OscControl();
