// Läuft gerade Timecode? Wird von allen TC-Quellen gesetzt und u. a. vom
// automatischen Showwechsel abgefragt (kein Wechsel während der Vorstellung).

const RUNNING_MS = 3000;

let lastTcAt = 0;

export function markTc(): void {
  lastTcAt = Date.now();
}

export function isTcRunning(): boolean {
  return lastTcAt > 0 && Date.now() - lastTcAt < RUNNING_MS;
}

export function lastTcAgoMs(): number | null {
  return lastTcAt ? Date.now() - lastTcAt : null;
}
