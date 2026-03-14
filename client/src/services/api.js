import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
});

const API_BASE = import.meta.env.VITE_API_URL + "/api";

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
 * Runs LLM emotion analysis on a text (non-streaming).
 * Optionally persists the result against an existing entry.
 * @param {{ text: string, entryId?: string }} payload
 */
export const analyzeText = (payload) => api.post("/journal/analyze", payload).then((r) => r.data);

/**
 * Fetches aggregated insights for a user.
 * @param {string} userId
 */
export const getInsights = (userId) => api.get(`/journal/insights/${userId}`).then((r) => r.data);

/**
 * Streams a Gemini LLM analysis via SSE (Server-Sent Events).
 *
 * Calls the `/api/journal/analyze/stream` endpoint and invokes callbacks as
 * events arrive:
 *  - `onChunk(text)`  — called for each incremental text chunk from the model
 *  - `onDone(result)` — called once with the final parsed { emotion, keywords, summary }
 *  - `onError(msg)`   — called if the server emits an error event
 *
 * @param {{ text: string, entryId?: string }} payload
 * @param {{ onChunk: Function, onDone: Function, onError: Function }} callbacks
 */
export async function analyzeStream(payload, { onChunk, onDone, onError }) {
  const response = await fetch(`${API_BASE}/journal/analyze/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Stream request failed" }));
    onError(err.error || "Stream request failed");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();

    let eventType = null;
    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        const raw = line.slice(6).trim();
        if (eventType === "chunk") {
          onChunk(JSON.parse(raw));
        } else if (eventType === "done") {
          onDone(JSON.parse(raw));
        } else if (eventType === "error") {
          onError(JSON.parse(raw).error);
        }
        eventType = null;
      }
    }
  }
}

