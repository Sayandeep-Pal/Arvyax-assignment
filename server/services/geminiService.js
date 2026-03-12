import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * Analyzes a journal entry text using the Gemini LLM.
 *
 * Returns a structured object containing:
 * - `emotion`  – the dominant emotion detected
 * - `keywords` – up to five relevant keywords extracted from the text
 * - `summary`  – a one-sentence summary of the user's mental state
 *
 * The function enforces JSON-only output from the model and validates the
 * parsed response before returning it.
 *
 * @param {string} text - The raw journal entry text to analyse.
 * @returns {Promise<{emotion: string, keywords: string[], summary: string}>}
 * @throws {Error} If the Gemini API call fails or the response cannot be parsed.
 */
export async function analyzeJournalText(text) {
  const prompt = `You are a mental-wellness assistant. Analyze the following journal entry and respond with ONLY valid JSON — no markdown, no extra text.

Journal entry:
"${text}"

Required JSON format:
{
  "emotion": "<single dominant emotion, e.g. calm, anxious, joyful>",
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "summary": "<one sentence describing the user's mental state>"
}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text().trim();

  const jsonString = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();

  const parsed = JSON.parse(jsonString);

  if (!parsed.emotion || !Array.isArray(parsed.keywords) || !parsed.summary) {
    throw new Error("Gemini returned an unexpected response shape.");
  }

  return {
    emotion: parsed.emotion,
    keywords: parsed.keywords.slice(0, 5),
    summary: parsed.summary,
  };
}
