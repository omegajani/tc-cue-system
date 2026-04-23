import { EventEmitter } from "events";
import { setFPS } from "./tcUtils.js";

// MTC rate codes → fps
const MTC_FPS: Record<number, number> = { 0: 24, 1: 25, 2: 29.97, 3: 30 };

/**
 * Decodes MIDI Timecode (MTC) quarter-frame and full-frame messages.
 * Emits "tc" with a "HH:MM:SS:FF" string whenever a complete frame is assembled.
 */
export class MTCDecoder extends EventEmitter {
  // 8 nibbles: index = message type 0-7
  private pieces = new Array<number>(8).fill(0);
  // track which pieces we've received so we don't fire on the very first incomplete set
  private receivedMask = 0;

  /**
   * Feed a raw MIDI message (array of byte values).
   */
  processMidiMessage(bytes: number[]) {
    if (bytes.length === 0) return;

    // MTC Quarter Frame: 0xF1 <data>
    if (bytes[0] === 0xF1 && bytes.length >= 2) {
      this._handleQF(bytes[1]);
      return;
    }

    // MTC Full Frame SysEx: F0 7F <devId> 01 01 <hr> <mn> <sc> <fr> F7
    if (
      bytes[0] === 0xF0 &&
      bytes[1] === 0x7F &&
      bytes[3] === 0x01 &&
      bytes[4] === 0x01 &&
      bytes.length >= 10
    ) {
      const hr = bytes[5] & 0x1F;
      const rateCode = (bytes[5] >> 5) & 0x03;
      const mn = bytes[6] & 0x3F;
      const sc = bytes[7] & 0x3F;
      const fr = bytes[8] & 0x1F;
      setFPS(MTC_FPS[rateCode] ?? 25);
      this.emit("tc", this._fmt(hr, mn, sc, fr));
    }
  }

  private _handleQF(data: number) {
    const type   = (data >> 4) & 0x07;
    const nibble = data & 0x0F;
    this.pieces[type] = nibble;
    this.receivedMask |= (1 << type);

    // Emit a complete TC after we've collected all 8 pieces and receive type 7
    if (type === 7 && this.receivedMask === 0xFF) {
      const frames  = this.pieces[0] | ((this.pieces[1] & 0x01) << 4);
      const seconds = this.pieces[2] | ((this.pieces[3] & 0x03) << 4);
      const minutes = this.pieces[4] | ((this.pieces[5] & 0x03) << 4);
      const hours   = this.pieces[6] | ((this.pieces[7] & 0x01) << 4);
      const rateCode = (this.pieces[7] >> 1) & 0x03;
      setFPS(MTC_FPS[rateCode] ?? 25);
      this.emit("tc", this._fmt(hours, minutes, seconds, frames));
    }
  }

  private _fmt(h: number, m: number, s: number, f: number): string {
    return [h, m, s, f].map(v => String(v).padStart(2, "0")).join(":");
  }

  reset() {
    this.pieces.fill(0);
    this.receivedMask = 0;
  }
}
