import { Show } from "../types.js";
import { cueEngine } from "./cueEngine.js";
import { getConfig, getPublicConfig, updateConfig } from "./config.js";
import { getShow, getShows } from "./store.js";
import { getFPS, setFPS } from "../tc/tcUtils.js";
import { broadcast } from "../wsbroker.js";

// Aktive Show = die Show, auf die die Cue-Engine hört. Sie wird in config.json
// gemerkt, damit sie einen Server-Neustart überlebt, und allen Clients gemeldet.

export function broadcastConfig(reason: "manual" | "trigger" = "manual", showName?: string): void {
  broadcast({ type: "CONFIG_CHANGED", config: getPublicConfig(), reason, showName });
}

export function isActiveShow(id: string): boolean {
  return cueEngine.getShow()?.id === id;
}

/** Framerate der Show auf die Engine anwenden (Standard 25). */
export function applyShowFps(show: Show): void {
  const fps = show.fps ?? 25;
  if (getFPS() !== fps) setFPS(fps);
}

/** reason: "trigger" = automatisch per OSC/MIDI, damit die Geräte es anzeigen können. */
export function activateShow(show: Show, reason: "manual" | "trigger" = "manual"): void {
  cueEngine.loadShow(show);
  applyShowFps(show);
  if (getConfig().activeShowId !== show.id) updateConfig({ activeShowId: show.id });
  broadcastConfig(reason, show.name);
}

/** Beim Boot: gemerkte aktive Show laden, sonst die erste. */
export function loadInitialShow(): Show | undefined {
  const show = getShow(getConfig().activeShowId ?? "") ?? getShows()[0];
  if (!show) return undefined;
  cueEngine.loadShow(show);
  applyShowFps(show);
  if (getConfig().activeShowId !== show.id) updateConfig({ activeShowId: show.id });
  return show;
}
