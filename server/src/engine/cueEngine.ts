import { EventEmitter } from "events";
import { Cue, Cuelist, CueFireEvent, CueWarningEvent } from "../types.js";
import { parseTc, getFPS } from "../tc/tcUtils.js";

export class CueEngine extends EventEmitter {
  private cuelist: Cuelist | null = null;
  private sortedCues: Cue[] = [];
  private firedCueIds = new Set<string>();
  private warnedCueIds = new Set<string>();
  private previousCue: Cue | null = null;
  private currentCue: Cue | null = null;
  private nextCue: Cue | null = null;

  loadCuelist(cuelist: Cuelist) {
    this.cuelist = cuelist;
    this.sortedCues = [...cuelist.cues].sort(
      (a, b) => parseTc(a.tc).totalFrames - parseTc(b.tc).totalFrames
    );
    this.firedCueIds.clear();
    this.warnedCueIds.clear();
    this.currentCue = null;
    this.nextCue = this.sortedCues[0] ?? null;
    console.log(`[CueEngine] Loaded cuelist "${cuelist.name}" with ${this.sortedCues.length} cues`);
  }

  unload() {
    this.cuelist = null;
    this.sortedCues = [];
    this.firedCueIds.clear();
    this.warnedCueIds.clear();
    this.currentCue = null;
    this.nextCue = null;
  }

  reset() {
    this.firedCueIds.clear();
    this.warnedCueIds.clear();
    this.previousCue = null;
    this.currentCue = null;
    this.nextCue = this.sortedCues[0] ?? null;
  }

  processTc(tc: string) {
    if (!this.cuelist || this.sortedCues.length === 0) return;

    const nowFrames = parseTc(tc).totalFrames;

    for (const cue of this.sortedCues) {
      const cueFrames = parseTc(cue.tc).totalFrames;

      // Warning: warnOffsetSec seconds before cue.
      // No upper-bound check — if setInterval skips frames we still want the warning
      // as long as the cue hasn't fired yet.
      if (
        cue.warnOffsetSec > 0 &&
        !this.warnedCueIds.has(cue.id) &&
        !this.firedCueIds.has(cue.id)
      ) {
        const warnFrames = cueFrames - cue.warnOffsetSec * getFPS();
        if (nowFrames >= warnFrames) {
          this.warnedCueIds.add(cue.id);
          const secondsUntil = Math.max(0, Math.round((cueFrames - nowFrames) / getFPS()));
          const event: CueWarningEvent = {
            type: "CUE_WARNING",
            tc,
            cue,
            secondsUntil,
          };
          this.emit("cueWarning", event);
        }
      }

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
}

export const cueEngine = new CueEngine();
