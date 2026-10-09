import { createRequire } from "module";
import { handleTrigger } from "./controlHub.js";
import { usbMidiInput } from "../tc/usbMidiInput.js";
import { rtpMidiInput } from "../tc/rtpMidiInput.js";

const require = createRequire(import.meta.url);

// MIDI-Steuerbefehle für den automatischen Showwechsel: Note On und Programmwechsel.
//
// Die TC-Eingänge (USB-MIDI, rtpMIDI) reichen ihre Rohdaten als "raw" weiter – läuft
// MIDI ohnehin als Timecode-Quelle, hören wir dort einfach mit. Ist eine andere
// Quelle aktiv (z. B. Art-Net), öffnet dieses Modul den konfigurierten MIDI-Eingang
// selbst, mit Wiederholversuch, falls das Gerät beim Start noch nicht da ist.

const RETRY_MS = 5000;

export class MidiControl {
  private input: any = null;
  private _portName = "";
  private _isRunning = false;
  private _error = "";
  private retry: ReturnType<typeof setTimeout> | null = null;
  private wired = false;

  /** Rohnachricht auswerten – egal, woher sie kommt. */
  handleRaw = (bytes: number[]): void => {
    if (!bytes || bytes.length < 2) return;
    const status = bytes[0] & 0xf0;
    const channel = (bytes[0] & 0x0f) + 1;   // 1–16, wie an Pulten angezeigt
    if (status === 0x90 && bytes.length >= 3 && bytes[2] > 0) {
      handleTrigger({
        source: "midi",
        label: `MIDI Note ${bytes[1]} (Kanal ${channel})`,
        midiNote: bytes[1],
        midiChannel: channel,
      });
    } else if (status === 0xc0) {
      handleTrigger({
        source: "midi",
        label: `MIDI Programmwechsel ${bytes[1]} (Kanal ${channel})`,
        midiProgram: bytes[1],
        midiChannel: channel,
      });
    }
  };

  start(portName?: string): void {
    // Immer bei den TC-Eingängen mithören (nur einmal verdrahten)
    if (!this.wired) {
      usbMidiInput.on("raw", this.handleRaw);
      rtpMidiInput.on("raw", this.handleRaw);
      this.wired = true;
    }
    this._error = "";
    if (!portName) return;                       // nur mithören
    if (usbMidiInput.isRunning() && usbMidiInput.getPortName().includes(portName)) {
      return;                                     // TC nutzt dasselbe Gerät → mithören genügt
    }
    this.openPort(portName);
  }

  private openPort(portName: string): void {
    this.stopPort();
    let midi: any;
    try {
      midi = require("@julusian/midi");
    } catch {
      this._error = "MIDI-Paket nicht verfügbar";
      return;
    }
    let input: any;
    try {
      input = new midi.Input();
    } catch (err) {
      this._error = (err as Error).message;
      return;
    }
    const count = input.getPortCount();
    let idx = -1;
    for (let i = 0; i < count; i++) {
      if (input.getPortName(i).includes(portName)) { idx = i; break; }
    }
    if (idx === -1) {
      try { input.closePort(); } catch { /* ignore */ }
      this._error = `MIDI-Eingang "${portName}" nicht gefunden`;
      this.retry = setTimeout(() => { this.retry = null; this.openPort(portName); }, RETRY_MS);
      return;
    }
    input.ignoreTypes(true, true, true);        // nur Kanalnachrichten, kein MTC/SysEx
    input.on("message", (_delta: number, bytes: number[]) => this.handleRaw(bytes));
    input.openPort(idx);
    this.input = input;
    this._portName = input.getPortName(idx);
    this._isRunning = true;
    this._error = "";
    console.log(`[Control/MIDI] Steuer-Eingang geöffnet: "${this._portName}"`);
  }

  private stopPort(): void {
    if (this.retry) { clearTimeout(this.retry); this.retry = null; }
    if (this.input) {
      try { this.input.closePort(); } catch { /* ignore */ }
      this.input = null;
    }
    this._isRunning = false;
    this._portName = "";
  }

  stop(): void {
    this.stopPort();
    if (this.wired) {
      usbMidiInput.off("raw", this.handleRaw);
      rtpMidiInput.off("raw", this.handleRaw);
      this.wired = false;
    }
  }

  listPorts(): string[] {
    return usbMidiInput.listPorts().map((p) => p.name);
  }

  isRunning() { return this._isRunning; }
  getPortName() { return this._portName; }
  getError() { return this._error; }
}

export const midiControl = new MidiControl();
