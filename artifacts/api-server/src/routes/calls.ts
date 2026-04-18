import { Router } from "express";
import { randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { callsTable, transcriptEntriesTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { makeCall, endCall as twilioEndCall } from "../services/twilio.js";
import { registerCall, getCall, removeCall } from "../services/callManager.js";
import { InitiateCallBody, GetCallStatusParams, EndCallParams } from "@workspace/api-zod";
import { z } from "zod/v4";

const router = Router();

function getWebhookBaseUrl(req: { headers: Record<string, string | string[] | undefined> }): string {
  const domains = process.env.REPLIT_DOMAINS;
  if (domains) {
    const primary = domains.split(",")[0]?.trim();
    if (primary) return `https://${primary}`;
  }
  const devDomain = process.env.REPLIT_DEV_DOMAIN;
  if (devDomain) return `https://${devDomain}`;
  return "http://localhost:80";
}

router.post("/calls/initiate", async (req, res) => {
  const parsed = InitiateCallBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { toNumber, sourceLanguage, targetLanguage } = parsed.data;
  const callSid = randomUUID();
  const fromNumber = process.env.TWILIO_PHONE_NUMBER ?? "";
  const webhookBase = getWebhookBaseUrl(req as any);

  try {
    const twilioCallSid = await makeCall(toNumber, webhookBase, callSid);

    await db.insert(callsTable).values({
      callSid,
      toNumber,
      fromNumber,
      sourceLanguage,
      targetLanguage,
      status: "initiated",
    });

    registerCall(callSid, twilioCallSid, sourceLanguage, targetLanguage);

    req.log.info({ callSid, twilioCallSid }, "Call initiated");
    res.json({ callSid, status: "initiated", message: "Call is being connected" });
  } catch (err) {
    req.log.error({ err }, "Failed to initiate call");
    res.status(500).json({ error: "call_failed", message: String(err) });
  }
});

router.get("/calls/history", async (req, res) => {
  try {
    const calls = await db
      .select()
      .from(callsTable)
      .orderBy(desc(callsTable.startedAt))
      .limit(50);

    const history = await Promise.all(
      calls.map(async (call) => {
        const entries = await db
          .select()
          .from(transcriptEntriesTable)
          .where(eq(transcriptEntriesTable.callSid, call.callSid));

        return {
          callSid: call.callSid,
          toNumber: call.toNumber,
          sourceLanguage: call.sourceLanguage,
          targetLanguage: call.targetLanguage,
          startedAt: call.startedAt.toISOString(),
          endedAt: call.endedAt?.toISOString() ?? null,
          duration: call.durationSeconds ?? null,
          status: call.status,
          transcriptCount: entries.length,
        };
      })
    );

    res.json(history);
  } catch (err) {
    req.log.error({ err }, "Failed to get call history");
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

router.get("/calls/:callSid/status", async (req, res) => {
  const params = GetCallStatusParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const { callSid } = params.data;

  try {
    const callRecord = await db
      .select()
      .from(callsTable)
      .where(eq(callsTable.callSid, callSid))
      .limit(1);

    if (!callRecord[0]) {
      res.status(404).json({ error: "not_found", message: "Call not found" });
      return;
    }

    const call = callRecord[0];
    const entries = await db
      .select()
      .from(transcriptEntriesTable)
      .where(eq(transcriptEntriesTable.callSid, callSid))
      .orderBy(transcriptEntriesTable.createdAt);

    const activeCall = getCall(callSid);
    const startedAt = call.startedAt;
    const duration = activeCall
      ? Math.floor((Date.now() - startedAt.getTime()) / 1000)
      : (call.durationSeconds ?? 0);

    res.json({
      callSid: call.callSid,
      status: call.status,
      sourceLanguage: call.sourceLanguage,
      targetLanguage: call.targetLanguage,
      duration,
      transcript: entries.map((e) => ({
        id: String(e.id),
        timestamp: e.createdAt.toISOString(),
        originalText: e.originalText,
        translatedText: e.translatedText,
        speaker: e.speaker,
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get call status");
    res.status(500).json({ error: "db_error", message: String(err) });
  }
});

router.post("/calls/:callSid/end", async (req, res) => {
  const params = EndCallParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "validation_error", message: params.error.message });
    return;
  }

  const { callSid } = params.data;

  try {
    const callRecord = await db
      .select()
      .from(callsTable)
      .where(eq(callsTable.callSid, callSid))
      .limit(1);

    if (!callRecord[0]) {
      res.status(404).json({ error: "not_found", message: "Call not found" });
      return;
    }

    const call = callRecord[0];
    const activeCall = getCall(callSid);

    if (activeCall) {
      try {
        await twilioEndCall(activeCall.twilioCallSid);
      } catch (err) {
        req.log.warn({ err }, "Failed to end Twilio call, cleaning up anyway");
      }
      removeCall(callSid);
    }

    const duration = Math.floor((Date.now() - call.startedAt.getTime()) / 1000);
    await db
      .update(callsTable)
      .set({ status: "completed", endedAt: new Date(), durationSeconds: duration })
      .where(eq(callsTable.callSid, callSid));

    res.json({ success: true, message: "Call ended" });
  } catch (err) {
    req.log.error({ err }, "Failed to end call");
    res.status(500).json({ error: "end_call_failed", message: String(err) });
  }
});

export default router;
