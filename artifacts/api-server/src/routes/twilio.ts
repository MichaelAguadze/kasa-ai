import { Router } from "express";
import { db } from "@workspace/db";
import { callsTable, transcriptEntriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { translateText } from "../services/translate.js";
import { textToSpeechBase64 } from "../services/elevenlabs.js";
import { getCall, broadcastToCall } from "../services/callManager.js";
import { logger } from "../lib/logger.js";
import type { Request, Response } from "express";

const router = Router();

router.post("/twilio/voice", async (req: Request, res: Response) => {
  const callSid = (req.query["callSid"] as string) ?? "";
  const callRecord = await db
    .select()
    .from(callsTable)
    .where(eq(callsTable.callSid, callSid))
    .limit(1);

  const call = callRecord[0];
  const sourceLanguage = call?.sourceLanguage ?? "en";
  const targetLanguage = call?.targetLanguage ?? "es";

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Hello! Your call is being connected with real-time translation.</Say>
  <Gather input="speech" action="/api/twilio/gather?callSid=${callSid}&amp;sourceLang=${sourceLanguage}&amp;targetLang=${targetLanguage}" speechTimeout="auto" language="${sourceLanguage}">
    <Say>Please speak after the tone. Your speech will be translated automatically.</Say>
  </Gather>
  <Redirect>/api/twilio/voice?callSid=${callSid}</Redirect>
</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

router.post("/twilio/gather", async (req: Request, res: Response) => {
  const callSid = (req.query["callSid"] as string) ?? "";
  const sourceLang = (req.query["sourceLang"] as string) ?? "en";
  const targetLang = (req.query["targetLang"] as string) ?? "es";
  const speechResult = req.body?.SpeechResult as string | undefined;

  if (!speechResult) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" action="/api/twilio/gather?callSid=${callSid}&amp;sourceLang=${sourceLang}&amp;targetLang=${targetLang}" speechTimeout="auto" language="${sourceLang}">
    <Say>I didn't catch that. Please speak clearly.</Say>
  </Gather>
  <Redirect>/api/twilio/voice?callSid=${callSid}</Redirect>
</Response>`;
    res.set("Content-Type", "text/xml");
    res.send(twiml);
    return;
  }

  let translatedText = speechResult;
  let audioBase64 = "";

  try {
    translatedText = await translateText(speechResult, sourceLang, targetLang);
    logger.info({ callSid, original: speechResult, translated: translatedText }, "Text translated");
  } catch (err) {
    logger.error({ err }, "Translation failed, using original");
    translatedText = speechResult;
  }

  try {
    audioBase64 = await textToSpeechBase64(translatedText);
  } catch (err) {
    logger.error({ err }, "TTS failed, using Say verb fallback");
  }

  try {
    const entry = await db
      .insert(transcriptEntriesTable)
      .values({
        callSid,
        speaker: "caller",
        originalText: speechResult,
        translatedText,
      })
      .returning();

    broadcastToCall(callSid, {
      type: "transcript",
      entry: {
        id: String(entry[0]?.id),
        timestamp: new Date().toISOString(),
        originalText: speechResult,
        translatedText,
        speaker: "caller",
      },
    });
  } catch (err) {
    logger.error({ err }, "Failed to save transcript entry");
  }

  let twiml: string;

  if (audioBase64) {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>data:audio/mpeg;base64,${audioBase64}</Play>
  <Gather input="speech" action="/api/twilio/gather?callSid=${callSid}&amp;sourceLang=${sourceLang}&amp;targetLang=${targetLang}" speechTimeout="auto" language="${sourceLang}">
    <Say>Your message has been translated. Please continue speaking.</Say>
  </Gather>
  <Redirect>/api/twilio/voice?callSid=${callSid}</Redirect>
</Response>`;
  } else {
    twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${targetLang}">${translatedText}</Say>
  <Gather input="speech" action="/api/twilio/gather?callSid=${callSid}&amp;sourceLang=${sourceLang}&amp;targetLang=${targetLang}" speechTimeout="auto" language="${sourceLang}">
    <Say>Your message has been translated. Please continue speaking.</Say>
  </Gather>
  <Redirect>/api/twilio/voice?callSid=${callSid}</Redirect>
</Response>`;
  }

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

router.post("/twilio/status", async (req: Request, res: Response) => {
  const { CallSid, CallStatus } = req.body as { CallSid: string; CallStatus: string };

  logger.info({ twilioCallSid: CallSid, status: CallStatus }, "Twilio status callback");

  try {
    const statusMap: Record<string, string> = {
      initiated: "initiated",
      ringing: "ringing",
      "in-progress": "active",
      completed: "completed",
      failed: "failed",
      busy: "failed",
      "no-answer": "failed",
      canceled: "completed",
    };

    const mappedStatus = statusMap[CallStatus] ?? CallStatus;

    const callRecord = await db
      .select()
      .from(callsTable)
      .where(eq(callsTable.callSid, req.body?.callSid ?? ""))
      .limit(1);

    await db
      .update(callsTable)
      .set({ status: mappedStatus })
      .where(eq(callsTable.callSid, req.body?.callSid ?? CallSid));

    if (CallStatus === "completed" || CallStatus === "failed") {
      const record = callRecord[0];
      if (record) {
        const duration = Math.floor((Date.now() - record.startedAt.getTime()) / 1000);
        await db
          .update(callsTable)
          .set({ endedAt: new Date(), durationSeconds: duration, status: mappedStatus })
          .where(eq(callsTable.callSid, record.callSid));
      }
    }
  } catch (err) {
    logger.error({ err }, "Failed to update call status from Twilio callback");
  }

  res.status(204).send();
});

export default router;
