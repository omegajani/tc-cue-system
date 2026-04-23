import { EventEmitter } from "events";
import { formatTc, parseTc } from "./tcUtils.js";

export type SimulatorState = "stopped" | "running" | "paused";

export class TCSimulator extends EventEmitter {
  private state: SimulatorState = "stopped";
  private currentFrames: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private readonly frameInterval = 1000 / 25; // 25fps

  getState(): SimulatorState {
    return this.state;
  }

  getCurrentTc(): string {
    return formatTc(this.currentFrames);
  }

  start(fromTc?: string) {
    if (fromTc) {
      this.currentFrames = parseTc(fromTc).totalFrames;
    }
    if (this.state === "running") return;
    this.state = "running";
    this.intervalId = setInterval(() => {
      this.currentFrames++;
      this.emit("tc", formatTc(this.currentFrames));
    }, this.frameInterval);
  }

  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
  }

  stop() {
    this.state = "stopped";
    if (this.intervalId) clearInterval(this.intervalId);
    this.intervalId = null;
    this.currentFrames = 0;
    this.emit("stop");
    this.emit("tc", formatTc(this.currentFrames));
  }

  seekTo(tc: string) {
    this.currentFrames = parseTc(tc).totalFrames;
    this.emit("tc", formatTc(this.currentFrames));
  }

  setSpeed(_multiplier: number) {
    // reserved for future implementation
  }
}

export const simulator = new TCSimulator();
