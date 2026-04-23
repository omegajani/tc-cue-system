import { WebSocketServer, WebSocket } from "ws";
import { IncomingMessage, Server } from "http";
import { WSEvent } from "./types.js";

let wss: WebSocketServer;

export function initWS(server: Server) {
  wss = new WebSocketServer({ server });
  wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
    // Disable Nagle algorithm so TC frames are sent immediately, not batched
    (ws as any)._socket?.setNoDelay(true);
    const role = new URL(req.url ?? "/", "http://localhost").searchParams.get("role") ?? "all";
    (ws as any).role = role;
    console.log(`[WS] Client connected, role="${role}"`);
    ws.on("close", () => console.log(`[WS] Client disconnected, role="${role}"`));
  });
  console.log("[WS] WebSocket server ready");
}

export function broadcast(event: WSEvent, targetRoles?: string[]) {
  if (!wss) return;
  const msg = JSON.stringify(event);
  wss.clients.forEach((client) => {
    if (client.readyState !== WebSocket.OPEN) return;
    const clientRole = (client as any).role as string;
    if (!targetRoles || targetRoles.length === 0 || targetRoles.includes(clientRole) || clientRole === "all") {
      client.send(msg);
    }
  });
}
