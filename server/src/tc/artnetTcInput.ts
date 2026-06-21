import { EventEmitter } from "events";
import dgram from "dgram";

const ARTNET_PORT = 6454;
// "Art-Net\0" als ASCII-Bytes (ID-Feld am Paketanfang).
const ARTNET_ID = Buffer.from("Art-Net\0", "ascii");
const OPCODE_TIMECODE = 0x9700; // ArtTimeCode, OpCode little-endian an Byte 8/9.

/**
 * Empfängt Art-Net Timecode (ArtTimeCode, OpCode 0x9700) über UDP 6454.
 * Nutzt das eingebaute dgram-Modul – keine zusätzliche Abhängigkeit.
 *
 * Paketaufbau (relevante Bytes):
 *   0..7  : "Art-Net\0"
 *   8..9  : OpCode (little-endian) = 0x9700
 *   14    : Frames
 *   15    : Sekunden
 *   16    : Minuten
 *   17    : Stunden
 *   18    : Typ (0=24fps, 1=25, 2=29.97DF, 3=30) – informativ
 */
export class ArtNetTcInput extends EventEmitter {
  private socket: dgram.Socket | null = null;
  private _isRunning = false;
  private _udpPort = ARTNET_PORT;
  private _lastTc = "";

  start(udpPort = ARTNET_PORT) {
    if (this._isRunning) return;
    this._udpPort = udpPort;

    const socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    socket.on("message", (msg) => this._handlePacket(msg));
    socket.on("error", (err) => {
      console.error("[Art-Net] Socket-Fehler:", err.message);
      this.stop();
    });
    try {
      socket.bind(udpPort, () => {
        try { socket.setBroadcast(true); } catch { /* ignore */ }
        console.log(`[Art-Net] Listening on UDP port ${udpPort}`);
      });
    } catch (err) {
      console.error("[Art-Net] bind fehlgeschlagen:", (err as Error).message);
      return;
    }

    this.socket = socket;
    this._isRunning = true;
  }

  stop() {
    if (!this._isRunning || !this.socket) return;
    try { this.socket.close(); } catch { /* ignore */ }
    this.socket = null;
    this._isRunning = false;
    this._lastTc = "";
    console.log("[Art-Net] Stopped");
  }

  private _handlePacket(msg: Buffer) {
    // Mindestlänge eines ArtTimeCode-Pakets + gültige Art-Net-Kennung prüfen.
    if (msg.length < 19) return;
    if (!msg.subarray(0, 8).equals(ARTNET_ID)) return;
    const opcode = msg.readUInt16LE(8);
    if (opcode !== OPCODE_TIMECODE) return;

    const frames = msg[14];
    const seconds = msg[15];
    const minutes = msg[16];
    const hours = msg[17];
    if (hours > 23 || minutes > 59 || seconds > 59 || frames > 30) return;

    const tc = [hours, minutes, seconds, frames]
      .map(v => String(v).padStart(2, "0")).join(":");
    if (tc !== this._lastTc) {
      this._lastTc = tc;
      this.emit("tc", tc);
    }
  }

  isRunning() { return this._isRunning; }
  getPort() { return this._udpPort; }
}

export const artnetTcInput = new ArtNetTcInput();
