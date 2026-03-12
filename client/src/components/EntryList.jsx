import { useState } from "react";
import { analyzeText } from "../services/api";

/**
 * Renders a list of journal entries.
 * Each entry can be individually analysed via the Gemini LLM.
 *
 * Props:
 * - entries   {Array}    Array of journal entry documents.
 * - onUpdated {Function} Called with an updated entry after analysis is stored.
 */
export default function EntryList({ entries, onUpdated }) {
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = async (entry) => {
    setLoadingId(entry._id);
    setError(null);
    try {
      const analysis = await analyzeText({ text: entry.text, entryId: entry._id });
      onUpdated({ ...entry, analysis });
    } catch (err) {
      setError(err.response?.data?.error || "Analysis failed.");
    } finally {
      setLoadingId(null);
    }
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
          ) : (
            <button
              className="analyze-btn"
              onClick={() => handleAnalyze(entry)}
              disabled={loadingId === entry._id}
            >
              {loadingId === entry._id ? "Analyzing…" : "Analyze"}
            </button>
          )}
        </article>
      ))}
    </section>
  );
}
