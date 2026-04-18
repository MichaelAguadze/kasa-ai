import { logger } from "../lib/logger.js";

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY;

export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> {
  if (!GOOGLE_TRANSLATE_API_KEY) {
    throw new Error("GOOGLE_TRANSLATE_API_KEY is not set");
  }

  if (sourceLanguage === targetLanguage) {
    return text;
  }

  const url = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      q: text,
      source: sourceLanguage,
      target: targetLanguage,
      format: "text",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error({ status: response.status, error: errorText }, "Google Translate API error");
    throw new Error(`Translation API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    data: { translations: Array<{ translatedText: string }> };
  };

  return data.data.translations[0]?.translatedText ?? text;
}
