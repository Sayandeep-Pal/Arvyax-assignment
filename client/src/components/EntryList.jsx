import { useState } from "react";
import { analyzeStream } from "../services/api";

/**
 * Renders a list of journal entries.
 *
 * Each entry's Analyze button uses the SSE streaming endpoint, showing a
 * live typing effect as the Gemini model generates the response. Once the
 * stream ends the structured analysis (emotion, keywords, summary) is
 * rendered in place and persisted on the parent state via `onUpdated`.
 *
 * Props:
 * - entries   {Array}    Array of journal entry documents.
 * - onUpdated {Function} Called with an updated entry after analysis is stored.
 */
export default function EntryList({ entries, onUpdated }) {
  const [loadingId, setLoadingId] = useState(null);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState(null);

  const handleAnalyze = (entry) => {
    setLoadingId(entry._id);
    setStreamingText("");
    setError(null);

    analyzeStream(
      { text: entry.text, entryId: entry._id },
      {
        onChunk: (chunk) => setStreamingText((prev) => prev + chunk),
        onDone: (analysis) => {
          setLoadingId(null);
          setStreamingText("");
          onUpdated({ ...entry, analysis });
        },
        onError: (msg) => {
          setLoadingId(null);
          setStreamingText("");
          setError(msg);
        },
      }
    );
  };

  if (entries.length === 0) {
    return <p className="empty-state">No entries yet. Write your first one above!</p>;
  }

  return (
    <section className="entry-list">
      <h2>Previous Entries</h2>
      {error && <p className="error">{error}</p>}
      {entries.map((entry) => (
        <article key={entry._id} className="entry-card">
          <header>
            <span className="ambience-badge">{entry.ambience}</span>
            <time>{new Date(entry.createdAt).toLocaleDateString()}</time>
          </header>

          <p className="entry-text">{entry.text}</p>

          {entry.analysis ? (
            <div className="analysis-result">
              <p>
                <strong>Emotion:</strong> {entry.analysis.emotion}
              </p>
              <p>
                <strong>Keywords:</strong> {entry.analysis.keywords.join(", ")}
              </p>
              <p>
                <strong>Summary:</strong> {entry.analysis.summary}
              </p>
            </div>
          ) : loadingId === entry._id ? (
            <div className="analysis-streaming">
              <span className="streaming-label">Analyzing…</span>
              {streamingText && <pre className="streaming-text">{streamingText}</pre>}
            </div>
          ) : (
            <button className="analyze-btn" onClick={() => handleAnalyze(entry)}>
              Analyze
            </button>
          )}
        </article>
      ))}
    </section>
  );
}

