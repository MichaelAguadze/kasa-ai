import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const callsTable = pgTable("calls", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  callSid: text("call_sid").notNull().unique(),
  toNumber: text("to_number").notNull(),
  fromNumber: text("from_number").notNull(),
  sourceLanguage: text("source_language").notNull(),
  targetLanguage: text("target_language").notNull(),
  status: text("status").notNull().default("initiated"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  durationSeconds: integer("duration_seconds"),
});

export const transcriptEntriesTable = pgTable("transcript_entries", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  callSid: text("call_sid").notNull(),
  speaker: text("speaker").notNull().default("caller"),
  originalText: text("original_text").notNull(),
  translatedText: text("translated_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCallSchema = z.object({
  callSid: z.string(),
  toNumber: z.string(),
  fromNumber: z.string(),
  sourceLanguage: z.string(),
  targetLanguage: z.string(),
  status: z.string().default("initiated"),
  endedAt: z.date().nullable().optional(),
  durationSeconds: z.number().nullable().optional(),
});

export const insertTranscriptEntrySchema = z.object({
  callSid: z.string(),
  speaker: z.string().default("caller"),
  originalText: z.string(),
  translatedText: z.string(),
});

export type Call = typeof callsTable.$inferSelect;
export type InsertCall = z.infer<typeof insertCallSchema>;
export type TranscriptEntry = typeof transcriptEntriesTable.$inferSelect;
export type InsertTranscriptEntry = z.infer<typeof insertTranscriptEntrySchema>;
