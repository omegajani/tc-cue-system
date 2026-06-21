import { EventEmitter } from "events";
import { formatTc, parseTc, getFPS } from "./tcUtils.js";

export type SimulatorState = "stopped" | "running" | "paused";

export class TCSimulator extends EventEmitter {
  private state: SimulatorState = "stopped";
  private currentFrames: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

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
    // Frame-Intervall aus der aktuellen FPS ableiten, damit der TC in Echtzeit
    // läuft (vorher fix 25fps → bei 30fps zu langsam).
    const frameInterval = 1000 / Math.round(getFPS());
    this.intervalId = setInterval(() => {
      this.currentFrames++;
      this.emit("tc", formatTc(this.currentFrames));
    }, frameInterval);
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
