import { getConfig } from "../engine/config.js";
import { oscControl } from "./oscControl.js";
import { midiControl } from "./midiControl.js";

// Steuer-Eingang für den automatischen Showwechsel. Läuft unabhängig von der
// Timecode-Quelle – sonst käme ein Auslöser bei Art-Net-Timecode nie an.

export function startControl(): void {
  const { control } = getConfig();
  if (!control.enabled) {
    console.log("[Control] Fernsteuerung ist ausgeschaltet");
    return;
  }
  oscControl.start(control.oscPort);
  midiControl.start(control.midiPort);
}

export function stopControl(): void {
  oscControl.stop();
  midiControl.stop();
}

/** Nach einer Änderung der Konfiguration neu starten. */
export function restartControl(): void {
  stopControl();
  startControl();
}
