import { Router } from "express";
import JournalEntry from "../models/JournalEntry.js";
import { analyzeJournalText } from "../services/geminiService.js";

const router = Router();

/**
 * POST /api/journal
 *
 * Creates a new journal entry for a user.
 *
 * Request body: { userId, ambience, text }
 * Response: 201 with the created entry document.
 */
router.post("/", async (req, res) => {
  const { userId, ambience, text } = req.body;

  if (!userId || !ambience || !text) {
    return res.status(400).json({ error: "userId, ambience, and text are required." });
  }

  const entry = await JournalEntry.create({ userId, ambience, text });
  res.status(201).json(entry);
});

/**
 * GET /api/journal/:userId
 *
 * Retrieves all journal entries for the given user, ordered newest first.
 *
 * Response: 200 with an array of entry documents.
 */
router.get("/:userId", async (req, res) => {
  const entries = await JournalEntry.find({ userId: req.params.userId }).sort({ createdAt: -1 });
  res.json(entries);
});

/**
 * POST /api/journal/analyze
 *
 * Analyses a journal text using the Gemini LLM.
 * If an `entryId` is provided, the analysis result is persisted on that entry
 * document so the same text is never re-analysed (simple LLM cost reduction).
 *
 * Request body: { text, entryId? }
 * Response: 200 with { emotion, keywords, summary }.
 */
router.post("/analyze", async (req, res) => {
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
 * GET /api/journal/insights/:userId
 *
 * Computes aggregated insights for a user across all their journal entries.
 *
 * Response: 200 with { totalEntries, topEmotion, mostUsedAmbience, recentKeywords }.
 */
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
