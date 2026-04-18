import { WebSocket } from "ws";
import { logger } from "../lib/logger.js";

export interface ActiveCall {
  callSid: string;
  twilioCallSid: string;
  sourceLanguage: string;
  targetLanguage: string;
  startedAt: Date;
  clients: Set<WebSocket>;
}

const activeCalls = new Map<string, ActiveCall>();

export function registerCall(
  callSid: string,
  twilioCallSid: string,
  sourceLanguage: string,
  targetLanguage: string
): void {
  activeCalls.set(callSid, {
    callSid,
    twilioCallSid,
    sourceLanguage,
    targetLanguage,
    startedAt: new Date(),
    clients: new Set(),
  });
  logger.info({ callSid }, "Call registered in manager");
}

export function getCall(callSid: string): ActiveCall | undefined {
  return activeCalls.get(callSid);
}

export function removeCall(callSid: string): void {
  const call = activeCalls.get(callSid);
  if (call) {
    for (const ws of call.clients) {
      try {
        ws.close();
      } catch (_) {}
    }
    activeCalls.delete(callSid);
  }
}

export function addClient(callSid: string, ws: WebSocket): void {
  const call = activeCalls.get(callSid);
  if (call) {
    call.clients.add(ws);
  }
}

export function removeClient(callSid: string, ws: WebSocket): void {
  const call = activeCalls.get(callSid);
  if (call) {
    call.clients.delete(ws);
  }
}

export function broadcastToCall(callSid: string, message: object): void {
  const call = activeCalls.get(callSid);
  if (!call) return;

  const data = JSON.stringify(message);
  const dead: WebSocket[] = [];

  for (const ws of call.clients) {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      } else {
        dead.push(ws);
      }
    } catch (_) {
      dead.push(ws);
    }
  }

  for (const ws of dead) {
    call.clients.delete(ws);
  }
}

export function listActiveCalls(): ActiveCall[] {
  return Array.from(activeCalls.values());
}
