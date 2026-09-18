import { TcConfig } from "../types.js";
import { rtpMidiInput } from "./rtpMidiInput.js";
import { oscTcInput } from "./oscTcInput.js";
import { usbMidiInput } from "./usbMidiInput.js";
import { artnetTcInput } from "./artnetTcInput.js";

// Startet/stoppt die serverseitigen TC-Empfänger passend zur Programm-Konfiguration.
// Browser-Quellen (LTC über Audio-Interface, MTC über Web MIDI) laufen im Browser
// des Rechners, der das Signal empfängt – für sie ist hier nichts zu tun.

let usbRetry: ReturnType<typeof setTimeout> | null = null;

function stopUsbRetry() {
  if (usbRetry) { clearTimeout(usbRetry); usbRetry = null; }
}

export function applyTcConfig(tc: TcConfig): void {
  // Nicht gewählte Quellen stoppen
  if (tc.source !== "usb-mtc") { stopUsbRetry(); usbMidiInput.stop(); }
  if (tc.source !== "rtpmidi") rtpMidiInput.stop();
  if (tc.source !== "osc") oscTcInput.stop();
  if (tc.source !== "artnet") artnetTcInput.stop();

  if (tc.source === "usb-mtc") {
    stopUsbRetry();
    // anderes Gerät offen → schließen und neu öffnen
    if (usbMidiInput.isRunning() && usbMidiInput.getPortName() !== tc.midiPort) usbMidiInput.stop();
    if (!tc.midiPort) return;
    // Ist das Gerät (z. B. beim Boot) noch nicht da, alle 5 s erneut versuchen
    const tryStart = () => {
      usbRetry = null;
      if (usbMidiInput.isRunning()) return;
      if (usbMidiInput.start(tc.midiPort)) console.log(`[TC] USB-MIDI gestartet auf "${tc.midiPort}"`);
      else usbRetry = setTimeout(tryStart, 5000);
    };
    tryStart();
  } else if (tc.source === "rtpmidi") {
    if (rtpMidiInput.isRunning() && (rtpMidiInput.getPort() !== tc.rtpmidiPort || rtpMidiInput.getName() !== tc.rtpmidiName)) rtpMidiInput.stop();
    rtpMidiInput.start(tc.rtpmidiPort, tc.rtpmidiName);
  } else if (tc.source === "osc") {
    if (oscTcInput.isRunning() && oscTcInput.getPort() !== tc.oscPort) oscTcInput.stop();
    oscTcInput.start(tc.oscPort);
  } else if (tc.source === "artnet") {
    artnetTcInput.start();
  }
}
