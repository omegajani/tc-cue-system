import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { WSEvent } from "./types.js";

let wss: WebSocketServer;
let heartbeat: ReturnType<typeof setInterval> | null = null;

// Tote Clients (z. B. schlafende Handys) erkennen: per Ping/Pong; antwortet ein
// Client zwei Intervalle nicht, wird die Verbindung terminiert, damit sich keine
// halb-offenen Sockets in wss.clients ansammeln.
const HEARTBEAT_MS = 30000;

export function initWS(server: Server) {
  wss = new WebSocketServer({ server });
  wss.on("connection", (ws: WebSocket) => {
    // Disable Nagle algorithm so TC frames are sent immediately, not batched
    (ws as any)._socket?.setNoDelay(true);
    (ws as any).isAlive = true;
    ws.on("pong", () => { (ws as any).isAlive = true; });
    ws.on("error", (err) => console.warn("[WS] client error:", err.message));
    console.log("[WS] Client connected");
    ws.on("close", () => console.log("[WS] Client disconnected"));
  });
  wss.on("error", (err) => console.error("[WS] server error:", err.message));

  heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if ((ws as any).isAlive === false) { try { ws.terminate(); } catch { /* ignore */ } return; }
      (ws as any).isAlive = false;
      try { ws.ping(); } catch { /* ignore */ }
    });
  }, HEARTBEAT_MS);

  console.log("[WS] WebSocket server ready");
}

export function broadcast(event: WSEvent) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    try { client.send(msg); } catch (err) { console.warn("[WS] send failed:", (err as Error).message); }
  });
}

/** Für Graceful-Shutdown: Heartbeat stoppen und Server schließen. */
export function closeWS(): void {
  if (heartbeat) { clearInterval(heartbeat); heartbeat = null; }
  if (wss) { try { wss.close(); } catch { /* ignore */ } }
}
