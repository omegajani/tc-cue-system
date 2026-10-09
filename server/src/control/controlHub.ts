import { ControlInput, Show, ShowTrigger } from "../types.js";
import { getShows, upsertShow, flushShows } from "../engine/store.js";
import { cueEngine } from "../engine/cueEngine.js";
import { activateShow } from "../engine/activeShow.js";
import { broadcast } from "../wsbroker.js";
import { isTcRunning } from "../engine/tcState.js";

// Nimmt alle Auslöser für den automatischen Showwechsel entgegen (OSC, MIDI).
// Drei Schutzmechanismen, damit ein Fehlsignal nichts kaputt macht:
//   1. kein Wechsel, solange Timecode läuft (Vorstellung)
//   2. kein Wechsel, wenn die Show ohnehin schon aktiv ist
//   3. Entprellung nach jedem Wechsel

const DEBOUNCE_MS = 2000;
const LOG_SIZE = 20;

let lastSwitchAt = 0;
const log: ControlInput[] = [];

export function getControlLog(): ControlInput[] {
  return [...log].reverse();   // neueste zuerst
}

function remember(input: ControlInput): ControlInput {
  log.push(input);
  if (log.length > LOG_SIZE) log.shift();
  broadcast({ type: "CONTROL_INPUT", input });
  return input;
}

/** Namen vergleichbar machen: Groß-/Kleinschreibung, Leerzeichen und Satzzeichen egal. */
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export interface TriggerQuery {
  source: ControlInput["source"];
  label: string;
  osc?: string;
  showIndex?: number;   // 1-basierte Position in der Show-Liste
  midiNote?: number;
  midiProgram?: number;
  midiChannel?: number;
}

function channelMatches(trigger: ShowTrigger | undefined, channel?: number): boolean {
  if (!trigger?.midiChannel) return true;    // kein Kanal gesetzt = jeder Kanal
  return channel === undefined || trigger.midiChannel === channel;
}

/** Show suchen, die auf diesen Auslöser hört. */
function findShow(q: TriggerQuery): Show | undefined {
  const shows = getShows();
  if (q.showIndex !== undefined) {
    return shows[q.showIndex - 1];
  }
  if (q.osc !== undefined) {
    const wanted = normalizeName(q.osc);
    if (!wanted) return undefined;
    return shows.find((s) => normalizeName(s.trigger?.osc || s.name) === wanted);
  }
  if (q.midiNote !== undefined) {
    return shows.find((s) => s.trigger?.midiNote === q.midiNote && channelMatches(s.trigger, q.midiChannel));
  }
  if (q.midiProgram !== undefined) {
    return shows.find((s) => s.trigger?.midiProgram === q.midiProgram && channelMatches(s.trigger, q.midiChannel));
  }
  return undefined;
}

/** Haken aller Aufgabenlisten zurücksetzen – jede Show startet sauber. */
export function resetChecklists(show: Show): Show {
  const reset: Show = {
    ...show,
    checklists: (show.checklists ?? []).map((cl) => ({
      ...cl,
      items: cl.items.map((item) => ({ ...item, checked: false })),
    })),
  };
  upsertShow(reset);
  flushShows();
  return reset;
}

/**
 * Einen eingegangenen Auslöser verarbeiten. Liefert, was passiert ist – auch
 * abgelehnte Auslöser landen im Protokoll, damit man beim Einrichten am Pult sieht,
 * dass das Signal ankommt.
 */
export function handleTrigger(q: TriggerQuery): ControlInput {
  const base = {
    at: new Date().toISOString(),
    source: q.source,
    label: q.label,
    osc: q.osc,
    midiNote: q.midiNote,
    midiProgram: q.midiProgram,
    midiChannel: q.midiChannel,
  };
  const show = findShow(q);
  if (!show) return remember({ ...base, result: "no-match" });
  if (cueEngine.getShow()?.id === show.id) {
    return remember({ ...base, result: "ignored-same", showName: show.name });
  }
  if (isTcRunning()) {
    console.warn(`[Control] Showwechsel auf "${show.name}" abgelehnt – Timecode läuft`);
    return remember({ ...base, result: "ignored-tc-running", showName: show.name });
  }
  if (Date.now() - lastSwitchAt < DEBOUNCE_MS) {
    return remember({ ...base, result: "ignored-debounce", showName: show.name });
  }

  lastSwitchAt = Date.now();
  const fresh = resetChecklists(show);
  activateShow(fresh, "trigger");
  console.log(`[Control] Show gewechselt auf "${fresh.name}" (${q.label})`);
  broadcast({ type: "SHOW_RESET" });
  return remember({ ...base, result: "switched", showName: fresh.name });
}
