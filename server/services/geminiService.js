import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { LRUCache } from "lru-cache";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * In-process LRU cache for analysis results.
 * Key   : SHA-256 hash of the normalised journal text.
 * Value : { emotion, keywords, summary }
 * Stores up to 500 entries for up to 1 hour, reducing duplicate Gemini calls.
 */
const analysisCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60,
});

function hashText(text) {
  return createHash("sha256").update(text.trim().toLowerCase()).digest("hex");
}

function buildPrompt(text) {
  return `You are a mental-wellness assistant. Analyze the following journal entry and respond with ONLY valid JSON — no markdown, no extra text.

Journal entry:
"${text}"

Required JSON format:
{
  "emotion": "<single dominant emotion, e.g. calm, anxious, joyful>",
  "keywords": ["<keyword1>", "<keyword2>", "<keyword3>"],
  "summary": "<one sentence describing the user's mental state>"
}`;
}

function parseGeminiJson(raw) {
  const clean = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  const parsed = JSON.parse(clean);
  if (!parsed.emotion || !Array.isArray(parsed.keywords) || !parsed.summary) {
    throw new Error("Gemini returned an unexpected response shape.");
  }
  return {
    emotion: parsed.emotion,
    keywords: parsed.keywords.slice(0, 5),
    summary: parsed.summary,
  };
}

/**
 * Analyzes a journal entry text using the Gemini LLM.
 *
 * Lookup order:
 *  1. In-process LRU cache (keyed by SHA-256 hash of text) — sub-millisecond
 *  2. Gemini 2.5 Flash API call
 *
 * The result is stored in the LRU cache after a successful API call.
 * Callers can also persist results in MongoDB (handled at the route layer).
 *
 * @param {string} text - The raw journal entry text to analyse.
 * @returns {Promise<{emotion: string, keywords: string[], summary: string}>}
 */
export async function analyzeJournalText(text) {
  const key = hashText(text);
  const cached = analysisCache.get(key);
  if (cached) return cached;

  const result = await model.generateContent(buildPrompt(text));
  const analysis = parseGeminiJson(result.response.text());

  analysisCache.set(key, analysis);
  return analysis;
}

/**
 * Streams a Gemini analysis response as raw text chunks via an async generator.
 *
 * Each yielded value is a partial text string from the model. The caller is
 * responsible for writing chunks to the HTTP response (e.g., as SSE events).
 * When the stream is exhausted the full accumulated text is parsed into the
 * structured analysis object, which is returned as the final yield (prefixed
 * with the sentinel string "DONE:").
 *
 * @param {string} text - The raw journal entry text to analyse.
 * @yields {string} Partial text chunk or "DONE:<json string>"
 */
export async function* streamAnalysis(text) {
  const key = hashText(text);
  const cached = analysisCache.get(key);
  if (cached) {
    yield `DONE:${JSON.stringify(cached)}`;
    return;
  }

  const streamResult = await model.generateContentStream(buildPrompt(text));

  let accumulated = "";
  for await (const chunk of streamResult.stream) {
    const part = chunk.text();
    if (part) {
      accumulated += part;
      yield part;
    }
  }

  const analysis = parseGeminiJson(accumulated);
  analysisCache.set(key, analysis);
  yield `DONE:${JSON.stringify(analysis)}`;
}

