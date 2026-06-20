import { EventEmitter } from "events";
import { createRequire } from "module";
import { MTCDecoder } from "./mtcDecoder.js";

const require = createRequire(import.meta.url);

export interface UsbMidiPort {
  index: number;
  name: string;
}

/**
 * Server-seitiger MTC-Empfang über ein USB-MIDI-Interface (browserunabhängig).
 * Nutzt @julusian/midi (RtMidi) — CoreMIDI auf macOS, ALSA auf Linux.
 * Das native Modul wird lazy + guarded geladen, damit ein fehlendes Modul den
 * Server nicht crasht (gleiches Muster wie rtpMidiInput für "rtpmidi").
 */
export class UsbMidiInput extends EventEmitter {
  private input: any = null;
  private decoder = new MTCDecoder();
  private _isRunning = false;
  private _portName = "";

  constructor() {
    super();
    this.decoder.on("tc", (tc: string) => this.emit("tc", tc));
  }

  private loadMidi(): any | null {
    try {
      return require("@julusian/midi");
    } catch (err) {
      console.error("[USB-MIDI] Package @julusian/midi nicht verfügbar:", (err as Error).message);
      return null;
    }
  }

  /**
   * Erzeugt ein RtMidi-Input – gibt null zurück, wenn RtMidi nicht initialisiert
   * werden kann (z. B. fehlender ALSA-Zugriff: /dev/snd nicht erreichbar). So
   * stört ein fehlender MIDI-Zugriff weder die API-Endpoints noch den Server.
   */
  private newInput(): any | null {
    const midi = this.loadMidi();
    if (!midi) return null;
    try {
      return new midi.Input();
    } catch (err) {
      console.warn("[USB-MIDI] RtMidi nicht verfügbar:", (err as Error).message);
      return null;
    }
  }

  /** Aktuell verfügbare MIDI-Eingänge auflisten. */
  listPorts(): UsbMidiPort[] {
    const probe = this.newInput();
    if (!probe) return [];
    try {
      const count = probe.getPortCount();
      const ports: UsbMidiPort[] = [];
      for (let i = 0; i < count; i++) ports.push({ index: i, name: probe.getPortName(i) });
      return ports;
    } finally {
      try { probe.closePort(); } catch { /* ignore */ }
    }
  }

  /**
   * Öffnet das Port, dessen Name `portName` enthält (Substring-Match, robuster
   * als ein Index, der sich beim Ein-/Ausstecken verschiebt). Ohne `portName`
   * wird das erste verfügbare Port geöffnet.
   * @returns true, wenn ein Port geöffnet wurde.
   */
  start(portName?: string): boolean {
    if (this._isRunning) return true;
    const input = this.newInput();
    if (!input) return false;

    const count = input.getPortCount();
    let idx = -1;
    if (portName) {
      for (let i = 0; i < count; i++) {
        if (input.getPortName(i).includes(portName)) { idx = i; break; }
      }
    } else if (count > 0) {
      idx = 0;
    }
    if (idx === -1) {
      try { input.closePort(); } catch { /* ignore */ }
      console.warn(`[USB-MIDI] Port "${portName ?? "(erstes)"}" nicht gefunden (${count} Eingänge)`);
      return false;
    }

    // SysEx NICHT ignorieren → MTC Full-Frame kommt an; Clock/Active-Sensing aus.
    input.ignoreTypes(false, true, true);
    input.on("message", (_delta: number, bytes: number[]) => {
      this.decoder.processMidiMessage(bytes);
    });
    input.openPort(idx);

    this.input = input;
    this._portName = input.getPortName(idx);
    this._isRunning = true;
    console.log(`[USB-MIDI] Eingang geöffnet: "${this._portName}"`);
    return true;
  }

  stop() {
    if (!this._isRunning || !this.input) return;
    try { this.input.closePort(); } catch { /* ignore */ }
    this.input = null;
    this._isRunning = false;
    this.decoder.reset();
    console.log("[USB-MIDI] Eingang geschlossen");
  }

  isRunning() { return this._isRunning; }
  getPortName() { return this._portName; }
}

export const usbMidiInput = new UsbMidiInput();
