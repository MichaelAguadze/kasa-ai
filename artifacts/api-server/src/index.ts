import http from "node:http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { addClient, removeClient } from "./services/callManager.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

const wss = new WebSocketServer({ server, path: "/api/ws" });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "", `http://localhost`);
  const pathParts = url.pathname.split("/");
  const callIdx = pathParts.findIndex((p) => p === "call");
  const callSid = callIdx !== -1 ? pathParts[callIdx + 1] : undefined;

  if (!callSid) {
    ws.close(1008, "Missing callSid in path");
    return;
  }

  logger.info({ callSid }, "WebSocket client connected");
  addClient(callSid, ws);

  ws.on("close", () => {
    logger.info({ callSid }, "WebSocket client disconnected");
    removeClient(callSid, ws);
  });

  ws.on("error", (err) => {
    logger.error({ err, callSid }, "WebSocket error");
    removeClient(callSid, ws);
  });

  ws.send(JSON.stringify({ type: "connected", callSid }));
});

server.listen(port, () => {
  logger.info({ port }, "Server listening");
});
