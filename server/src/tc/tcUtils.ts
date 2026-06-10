import { TCFrames } from "../types.js";

let _fps: number = 25;

export function setFPS(fps: number) {
  _fps = fps;
  console.log(`[TC] FPS set to ${fps}`);
}

export function getFPS(): number { return _fps; }

export function parseTc(tc: string): TCFrames {
  const parts = tc.split(":").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    throw new Error(`Invalid TC: ${tc}`);
  }
  const [hours, minutes, seconds, frames] = parts;
  if (hours < 0 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59 || frames < 0 || frames >= _fps) {
    throw new Error(`Invalid TC: ${tc}`);
  }
  const fps = _fps;
  return {
    hours, minutes, seconds, frames,
    totalFrames: hours * 3600 * fps + minutes * 60 * fps + seconds * fps + frames,
  };
}

export function formatTc(totalFrames: number): string {
  const fps = _fps;
  const frames = totalFrames % fps;
  const totalSecs = Math.floor(totalFrames / fps);
  const seconds = totalSecs % 60;
  const totalMins = Math.floor(totalSecs / 60);
  const minutes = totalMins % 60;
  const hours = Math.floor(totalMins / 60);
  return [hours, minutes, seconds, frames].map((v) => String(v).padStart(2, "0")).join(":");
}

export function tcToSeconds(tc: string): number {
  return parseTc(tc).totalFrames / _fps;
}
