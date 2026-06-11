import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { WSEvent } from "./types.js";

let wss: WebSocketServer;

export function initWS(server: Server) {
  wss = new WebSocketServer({ server });
  wss.on("connection", (ws: WebSocket) => {
    // Disable Nagle algorithm so TC frames are sent immediately, not batched
    (ws as any)._socket?.setNoDelay(true);
    console.log("[WS] Client connected");
    ws.on("close", () => console.log("[WS] Client disconnected"));
  });
  console.log("[WS] WebSocket server ready");
}

export function broadcast(event: WSEvent) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    client.send(msg);
  });
}
