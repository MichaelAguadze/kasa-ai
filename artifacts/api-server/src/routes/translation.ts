import { Router } from "express";
import { translateText } from "../services/translate.js";
import { TranslateTextBody } from "@workspace/api-zod";

const router = Router();

const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English" },
  { code: "es", name: "Spanish", nativeName: "Español" },
  { code: "fr", name: "French", nativeName: "Français" },
  { code: "de", name: "German", nativeName: "Deutsch" },
  { code: "it", name: "Italian", nativeName: "Italiano" },
  { code: "pt", name: "Portuguese", nativeName: "Português" },
  { code: "ru", name: "Russian", nativeName: "Русский" },
  { code: "zh", name: "Chinese (Simplified)", nativeName: "中文" },
  { code: "ja", name: "Japanese", nativeName: "日本語" },
  { code: "ko", name: "Korean", nativeName: "한국어" },
  { code: "ar", name: "Arabic", nativeName: "العربية" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands" },
  { code: "pl", name: "Polish", nativeName: "Polski" },
  { code: "sv", name: "Swedish", nativeName: "Svenska" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt" },
  { code: "th", name: "Thai", nativeName: "ภาษาไทย" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia" },
];

router.get("/languages", (_req, res) => {
  res.json(SUPPORTED_LANGUAGES);
});

router.post("/translate", async (req, res) => {
  const parsed = TranslateTextBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "validation_error", message: parsed.error.message });
    return;
  }

  const { text, sourceLanguage, targetLanguage } = parsed.data;

  try {
    const translatedText = await translateText(text, sourceLanguage, targetLanguage);
    res.json({
      originalText: text,
      translatedText,
      sourceLanguage,
      targetLanguage,
    });
  } catch (err) {
    req.log.error({ err }, "Translation failed");
    res.status(500).json({ error: "translation_failed", message: String(err) });
  }
});

export default router;
