import { EventEmitter } from "events";
import { Cue, CueFireEvent, Show, ShowPosition } from "../types.js";
import { parseTc } from "../tc/tcUtils.js";

export class CueEngine extends EventEmitter {
  private show: Show | null = null;
  private sortedCues: Cue[] = [];
  private sortedPositions: ShowPosition[] = [];
  private firedCueIds = new Set<string>();
  private previousCue: Cue | null = null;
  private currentCue: Cue | null = null;
  private nextCue: Cue | null = null;
  private currentPosition: ShowPosition | null = null;

  loadShow(show: Show) {
    this.show = show;
    this.sortedCues = [...show.cues].filter(
      (cue) => this.hasValidTc(cue.tc, `cue "${cue.title}"`)
    ).sort(
      (a, b) => parseTc(a.tc).totalFrames - parseTc(b.tc).totalFrames
    );
    this.sortedPositions = [...(show.positions ?? [])].filter(
      (position) =>
        this.hasValidTc(position.startTc, `position "${position.name}" start`) &&
        this.hasValidTc(position.endTc, `position "${position.name}" end`)
    ).sort(
      (a, b) => parseTc(a.startTc).totalFrames - parseTc(b.startTc).totalFrames
    );
    this.firedCueIds.clear();
    this.currentCue = null;
    this.nextCue = this.sortedCues[0] ?? null;
    this.currentPosition = null;
    console.log(`[CueEngine] Loaded show "${show.name}" with ${this.sortedCues.length} cues`);
  }

  getShow(): Show | null {
    return this.show;
  }

  /** Aktualisiert die Show-Daten (z.B. Checklisten) ohne fired-State zu löschen. */
  updateShowData(show: Show) {
    this.show = show;
  }

  getSortedCues(): Cue[] {
    return this.sortedCues;
  }

  private hasValidTc(tc: string, label: string): boolean {
    try {
      parseTc(tc);
      return true;
    } catch {
      console.warn(`[CueEngine] Ignoring ${label} with invalid TC "${tc}"`);
      return false;
    }
  }

  unload() {
    this.show = null;
    this.sortedCues = [];
    this.sortedPositions = [];
    this.firedCueIds.clear();
    this.currentCue = null;
    this.nextCue = null;
    this.currentPosition = null;
  }

  reset() {
    this.firedCueIds.clear();
    this.previousCue = null;
    this.currentCue = null;
    this.nextCue = this.sortedCues[0] ?? null;
    this.currentPosition = null;
  }

  processTc(tc: string) {
    if (!this.show) return;

    const nowFrames = parseTc(tc).totalFrames;
    this.currentPosition = this.sortedPositions.find((position) => {
      const startFrames = parseTc(position.startTc).totalFrames;
      const endFrames = parseTc(position.endTc).totalFrames;
      return nowFrames >= startFrames && nowFrames <= endFrames;
    }) ?? null;

    for (const cue of this.sortedCues) {
      const cueFrames = parseTc(cue.tc).totalFrames;

      // Fire cue
      if (!this.firedCueIds.has(cue.id) && nowFrames >= cueFrames) {
        this.firedCueIds.add(cue.id);
        this.previousCue = this.currentCue;
        this.currentCue = cue;
        const idx = this.sortedCues.indexOf(cue);
        this.nextCue = this.sortedCues[idx + 1] ?? null;
        const event: CueFireEvent = {
          type: "CUE_FIRE",
          tc,
          cue,
          previousCue: this.previousCue,
          nextCue: this.nextCue,
        };
        this.emit("cueFire", event);
      }
    }
  }

  getPreviousCue(): Cue | null {
    return this.previousCue;
  }

  getCurrentCue(): Cue | null {
    return this.currentCue;
  }

  getNextCue(): Cue | null {
    return this.nextCue;
  }

  getCurrentPosition(): ShowPosition | null {
    return this.currentPosition;
  }
}

export const cueEngine = new CueEngine();
