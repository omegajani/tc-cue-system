import { EventEmitter } from "events";
import { createRequire } from "module";
import { MTCDecoder } from "./mtcDecoder.js";

const require = createRequire(import.meta.url);

export interface RtpMidiPeer {
  name: string;
  address: string;
  port: number;
}

export class RtpMidiInput extends EventEmitter {
  private session: any = null;
  private decoder = new MTCDecoder();
  private _isRunning = false;
  private _port = 5004;
  private _name = "TC Cue System";

  constructor() {
    super();
    this.decoder.on("tc", (tc: string) => this.emit("tc", tc));
  }

  start(port = 5004, name = "TC Cue System") {
    if (this._isRunning) return;
    this._port = port;
    this._name = name;

    let rtpmidi: any;
    try {
      rtpmidi = require("rtpmidi");
    } catch {
      console.error("[rtpMIDI] Package not available");
      return;
    }

    this.session = rtpmidi.manager.createSession({
      localName: name,
      bonjourName: name,
      port,
    });

    this.session.on("message", (_delta: number, bytes: Uint8Array) => {
      this.decoder.processMidiMessage(Array.from(bytes));
    });

    this.session.on("connection", (peer: any) => {
      console.log(`[rtpMIDI] Peer connected: ${peer.name ?? peer.address}`);
      this.emit("peerConnected", peer);
    });

    this.session.on("disconnection", (peer: any) => {
      console.log(`[rtpMIDI] Peer disconnected: ${peer.name ?? peer.address}`);
      this.emit("peerDisconnected", peer);
    });

    this._isRunning = true;
    console.log(`[rtpMIDI] Session "${name}" listening on port ${port}`);
  }

  stop() {
    if (!this._isRunning || !this.session) return;
    try {
      const rtpmidi = require("rtpmidi");
      rtpmidi.manager.removeSession(this.session);
    } catch { /* ignore */ }
    this.session = null;
    this._isRunning = false;
    this.decoder.reset();
    console.log("[rtpMIDI] Stopped");
  }

  isRunning() { return this._isRunning; }
  getPort() { return this._port; }
  getName() { return this._name; }

  getConnectedPeers(): RtpMidiPeer[] {
    if (!this.session) return [];
    const addrs = this.session.remoteAddresses ?? this.session.acceptedAddresses ?? [];
    return addrs.map((a: any): RtpMidiPeer => ({
      name: a.name ?? "Unknown",
      address: a.address ?? "",
      port: a.port ?? 0,
    }));
  }
}

export const rtpMidiInput = new RtpMidiInput();
