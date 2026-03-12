import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import JournalEntry from "../models/JournalEntry.js";
import { analyzeJournalText, streamAnalysis } from "../services/geminiService.js";

const router = Router();

/**
 * Stricter rate limit applied only to the LLM analysis endpoints.
 * 10 requests per minute per IP to guard against abuse and runaway LLM costs.
 */
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many analysis requests, please wait a moment." },
});


//  POST /api/journal
//  Creates a new journal entry for a user.

router.post("/", async (req, res) => {
  const { userId, ambience, text } = req.body;

  if (!userId || !ambience || !text) {
    return res.status(400).json({ error: "userId, ambience, and text are required." });
  }

  const entry = await JournalEntry.create({ userId, ambience, text });
  res.status(201).json(entry);
});

// GET /api/journal/:userId
// Fetches all journal entries for a given user, sorted by creation date (newest first).

router.get("/:userId", async (req, res) => {
  const entries = await JournalEntry.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  res.json(entries);
});

// POST /api/journal/analyze
// Analyzes a journal entry text using the Gemini LLM.
// If entryId is provided, it will persist the analysis result against that entry.

router.post("/analyze", analyzeLimiter, async (req, res) => {
  const { text, entryId } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text is required." });
  }

  if (entryId) {
    const existing = await JournalEntry.findById(entryId);
    if (existing?.analysis) {
      return res.json(existing.analysis);
    }
  }

  const analysis = await analyzeJournalText(text);

  if (entryId) {
    await JournalEntry.findByIdAndUpdate(entryId, { analysis });
  }

  res.json(analysis);
});

/**
 * POST /api/journal/analyze/stream
 *
 * Streams a Gemini LLM analysis response using Server-Sent Events (SSE).
 *
 * The client receives incremental text chunks as `event: chunk` SSE events
 * while Gemini generates the response. Once the full response is accumulated
 * and parsed, a final `event: done` event is sent containing the structured
 * JSON analysis. This allows the UI to show a live "typing" effect.
 *
 * If a cached result (LRU or MongoDB) is available, a single `event: done`
 * is sent immediately without streaming.
 *
 * Request body: { text, entryId? }
 */
router.post("/analyze/stream", analyzeLimiter, async (req, res) => {
  const { text, entryId } = req.body;

  if (!text) {
    return res.status(400).json({ error: "text is required." });
  }

  if (entryId) {
    const existing = await JournalEntry.findById(entryId);
    if (existing?.analysis) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`event: done\ndata: ${JSON.stringify(existing.analysis)}\n\n`);
      return res.end();
    }
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    for await (const chunk of streamAnalysis(text)) {
      if (chunk.startsWith("DONE:")) {
        const analysis = JSON.parse(chunk.slice(5));
        if (entryId) {
          await JournalEntry.findByIdAndUpdate(entryId, { analysis });
        }
        res.write(`event: done\ndata: ${JSON.stringify(analysis)}\n\n`);
      } else {
        res.write(`event: chunk\ndata: ${JSON.stringify(chunk)}\n\n`);
      }
    }
  } catch (err) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
  }

  res.end();
});

// GET /api/journal/insights/:userId
// Fetches aggregated insights for a user based on their journal entries.

router.get("/insights/:userId", async (req, res) => {
  const entries = await JournalEntry.find({ userId: req.params.userId });

  if (entries.length === 0) {
    return res.json({
      totalEntries: 0,
      topEmotion: null,
      mostUsedAmbience: null,
      recentKeywords: [],
    });
  }

  const emotionCount = {};
  const ambienceCount = {};

  for (const entry of entries) {
    if (entry.ambience) {
      ambienceCount[entry.ambience] = (ambienceCount[entry.ambience] || 0) + 1;
    }
    if (entry.analysis?.emotion) {
      emotionCount[entry.analysis.emotion] = (emotionCount[entry.analysis.emotion] || 0) + 1;
    }
  }

  const topEmotion = Object.keys(emotionCount).length
    ? Object.keys(emotionCount).reduce((a, b) => (emotionCount[a] > emotionCount[b] ? a : b))
    : null;

  const mostUsedAmbience = Object.keys(ambienceCount).reduce((a, b) =>
    ambienceCount[a] > ambienceCount[b] ? a : b
  );

  const recentKeywords = entries
    .slice(0, 5)
    .flatMap((e) => e.analysis?.keywords ?? [])
    .filter((kw, idx, arr) => arr.indexOf(kw) === idx)
    .slice(0, 10);

  res.json({
    totalEntries: entries.length,
    topEmotion,
    mostUsedAmbience,
    recentKeywords,
  });
});

export default router;
