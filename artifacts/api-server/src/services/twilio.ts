import twilio from "twilio";
import { logger } from "../lib/logger.js";

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

function getClient() {
  if (!accountSid || !authToken) {
    throw new Error("Twilio credentials not configured");
  }
  return twilio(accountSid, authToken);
}

export function getFromNumber(): string {
  if (!fromNumber) {
    throw new Error("TWILIO_PHONE_NUMBER is not configured");
  }
  return fromNumber;
}

export async function makeCall(
  toNumber: string,
  webhookBaseUrl: string,
  callSid: string
): Promise<string> {
  const client = getClient();
  const from = getFromNumber();

  const call = await client.calls.create({
    to: toNumber,
    from,
    url: `${webhookBaseUrl}/api/twilio/voice?callSid=${callSid}`,
    statusCallback: `${webhookBaseUrl}/api/twilio/status`,
    statusCallbackMethod: "POST",
    statusCallbackEvent: ["initiated", "ringing", "answered", "completed"],
  });

  logger.info({ callSid: call.sid, to: toNumber }, "Twilio call initiated");
  return call.sid;
}

export async function endCall(twilioCallSid: string): Promise<void> {
  const client = getClient();
  await client.calls(twilioCallSid).update({ status: "completed" });
  logger.info({ callSid: twilioCallSid }, "Twilio call ended");
}

export async function getCallDetails(twilioCallSid: string) {
  const client = getClient();
  return client.calls(twilioCallSid).fetch();
}
