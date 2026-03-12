import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

/**
 * Creates a new journal entry.
 * @param {{ userId: string, ambience: string, text: string }} payload
 */
export const createEntry = (payload) => api.post("/journal", payload).then((r) => r.data);

/**
 * Fetches all journal entries for a given user.
 * @param {string} userId
 */
export const getEntries = (userId) => api.get(`/journal/${userId}`).then((r) => r.data);

/**
 * Runs LLM emotion analysis on a text.
 * Optionally persists the result against an existing entry.
 * @param {{ text: string, entryId?: string }} payload
 */
export const analyzeText = (payload) => api.post("/journal/analyze", payload).then((r) => r.data);

/**
 * Fetches aggregated insights for a user.
 * @param {string} userId
 */
export const getInsights = (userId) => api.get(`/journal/insights/${userId}`).then((r) => r.data);
